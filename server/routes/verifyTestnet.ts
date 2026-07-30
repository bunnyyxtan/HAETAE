// POST /api/verify-testnet — the self-serve testnet verification desk.
//
// Testnet stand-in for Upbit Dojang KYC: attests the connected principal
// under the HAETAE schema from the server-held attester key, then registers
// the attestation on HaetaeDojang (lane 2). On mainnet this endpoint does
// not exist — principals verify through Upbit (the chain-id guard below is
// the enforcement, not a comment).
//
// HARD RULES (ordered):
// - ATTESTER_PK lives ONLY here, server-side. Never in any client bundle.
// - Rate-limited per address AND per IP.
// - Refuses outright if the RPC's chain id is not GIWA Sepolia (91342).
import { Router, type IRouter, type Request } from "express";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeAbiParameters,
  getAddress,
  http,
  isAddress,
  parseAbi,
  parseEventLogs,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { logger } from "../lib/logger.js";

// ---------------------------------------------------------------------------
// Deployment record: deployments/giwa-sepolia.json is the single source of
// truth. Resolved from the repo root; the function bundle preserves repo
// paths (see vercel.json includeFiles).
// ---------------------------------------------------------------------------
interface DeployRecord {
  chainId: number;
  rpc: string;
  explorer: string;
  contracts: Record<string, { address: Address }>;
  eas: { registry: Address; schemaUid: Hex; attester: Address };
}

function loadRecord(): DeployRecord {
  const candidates = ["deployments/giwa-sepolia.json"];
  for (const c of candidates) {
    try {
      const raw = JSON.parse(readFileSync(resolve(process.cwd(), c), "utf8"));
      return {
        chainId: raw.chainId,
        rpc: raw.rpc,
        explorer: raw.explorer,
        contracts: raw.contracts,
        eas: {
          registry: raw.eas?.easPredeploy ?? "0x4200000000000000000000000000000000000021",
          schemaUid: raw.eas?.haetaeSchemaUid,
          attester: raw.eas?.haetaeAttester,
        },
      };
    } catch {
      /* try next */
    }
  }
  throw new Error("deployments/giwa-sepolia.json not found from cwd or package dir");
}

const record = loadRecord();
const GIWA_CHAIN_ID = 91342;

const dojangAbi = parseAbi([
  "function isVerified(address subject) view returns (bool)",
  "function attestationUidOf(address subject) view returns (bytes32)",
  "function registerAttestation(bytes32 uid)",
  "function haetaeSchemaUid() view returns (bytes32)",
  "function haetaeAttester() view returns (address)",
]);

const easAbi = parseAbi([
  "struct AttestationRequestData { address recipient; uint64 expirationTime; bool revocable; bytes32 refUID; bytes data; uint256 value; }",
  "struct AttestationRequest { bytes32 schema; AttestationRequestData data; }",
  "function attest(AttestationRequest request) payable returns (bytes32)",
  "event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaUID)",
]);

const chain = defineChain({
  id: GIWA_CHAIN_ID,
  name: "GIWA Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [record.rpc] } },
});

const publicClient = createPublicClient({ chain, transport: http(record.rpc) });

// Shared with /api/healthz: balance visibility for the desk signer.
export const deskPublicClient = publicClient;
export const deskAttesterAddress: Address = record.eas.attester;
const DOJANG = record.contracts["HaetaeDojang"]!.address;
const EAS = record.eas.registry;

// ---------------------------------------------------------------------------
// Rate limiting — in-memory, honest for an autoscale testnet desk: each
// instance enforces independently; the per-address idempotence check below
// (already verified -> no tx) is the real backstop.
// ---------------------------------------------------------------------------
const ADDR_WINDOW_MS = 10 * 60 * 1000; // one attempt per address / 10 min
const IP_WINDOW_MS = 60 * 60 * 1000; // five attempts per IP / hour
const IP_MAX = 5;
const addrLast = new Map<string, number>();
const ipHits = new Map<string, number[]>();

export function rateLimitCheck(
  addr: string,
  ip: string,
  now: number,
): string | null {
  const a = addrLast.get(addr);
  if (a !== undefined && now - a < ADDR_WINDOW_MS) return "address rate limit: one attempt per 10 minutes";
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS);
  if (hits.length >= IP_MAX) return "ip rate limit: five attempts per hour";
  addrLast.set(addr, now);
  hits.push(now);
  ipHits.set(ip, hits);
  return null;
}

// req.ip is proxy-aware via `trust proxy` in app.ts — never read
// X-Forwarded-For directly (user-controlled beyond the trusted hop).
const clientIp = (req: Request): string => req.ip ?? "unknown";

// Serialize the desk: the attester account has one nonce lane; concurrent
// ceremonies would race it. A simple promise chain is enough at testnet scale.
let deskQueue: Promise<unknown> = Promise.resolve();

const router: IRouter = Router();

router.post("/verify-testnet", (req, res) => {
  const addrRaw = typeof req.body?.address === "string" ? req.body.address.trim() : "";
  if (!isAddress(addrRaw)) {
    res.status(400).json({ error: "invalid address" });
    return;
  }
  const subject = getAddress(addrRaw);

  const run = async () => {
    // Testnet-only guard: live chain id must be GIWA Sepolia.
    const chainId = await publicClient.getChainId();
    if (chainId !== GIWA_CHAIN_ID) {
      res.status(503).json({ error: `verification desk is testnet-only (chain ${chainId} != ${GIWA_CHAIN_ID})` });
      return;
    }

    // Idempotence before rate limit: an already-verified principal never
    // burns an attempt or a transaction.
    const already = await publicClient.readContract({
      address: DOJANG, abi: dojangAbi, functionName: "isVerified", args: [subject],
    });
    if (already) {
      const uid = await publicClient.readContract({
        address: DOJANG, abi: dojangAbi, functionName: "attestationUidOf", args: [subject],
      });
      res.json({ alreadyVerified: true, uid });
      return;
    }

    const pk = process.env["ATTESTER_PK"];
    if (!pk) {
      res.status(503).json({ error: "verification desk offline" });
      return;
    }
    const attester = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as Hex);
    const wallet = createWalletClient({ account: attester, chain, transport: http(record.rpc) });

    // Bindings sanity: refuse rather than mint a dead-on-arrival attestation.
    const [schemaUid, boundAttester] = await Promise.all([
      publicClient.readContract({ address: DOJANG, abi: dojangAbi, functionName: "haetaeSchemaUid" }),
      publicClient.readContract({ address: DOJANG, abi: dojangAbi, functionName: "haetaeAttester" }),
    ]);
    if (boundAttester.toLowerCase() !== attester.address.toLowerCase()) {
      res.status(503).json({ error: "attester key does not match the deployed Dojang binding" });
      return;
    }

    // Rate limit only after every precondition passes: a misconfigured or
    // unreachable desk must never burn a user's quota.
    const limited = rateLimitCheck(subject.toLowerCase(), clientIp(req), Date.now());
    if (limited) {
      res.status(429).json({ error: limited });
      return;
    }

    // 1 · Attest under the HAETAE schema ("bool isVerifiedPrincipal").
    const request = {
      schema: schemaUid,
      data: {
        recipient: subject,
        expirationTime: 0n,
        revocable: true,
        refUID: "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex,
        data: encodeAbiParameters([{ type: "bool" }], [true]),
        value: 0n,
      },
    } as const;
    // Simulate for early revert detection only. The uid MUST come from the
    // receipt's Attested event: EAS derives the uid over contents including
    // block.timestamp, so a simulated uid differs from the mined one.
    await publicClient.simulateContract({
      account: attester, address: EAS, abi: easAbi, functionName: "attest", args: [request],
    });
    const attestTx = await wallet.writeContract({
      address: EAS, abi: easAbi, functionName: "attest", args: [request],
    });
    const attestRcpt = await publicClient.waitForTransactionReceipt({ hash: attestTx, timeout: 60_000 });
    if (attestRcpt.status !== "success") {
      res.status(502).json({ error: "attestation transaction reverted", attestTx });
      return;
    }
    const attested = parseEventLogs({ abi: easAbi, eventName: "Attested", logs: attestRcpt.logs });
    const uid = attested[0]?.args.uid;
    if (!uid) {
      res.status(502).json({ error: "attestation mined but no Attested event found", attestTx });
      return;
    }

    // 2 · Register on HaetaeDojang (lane 2) — permissionless, sent from the
    // same key so the user pays nothing.
    const registerTx = await wallet.writeContract({
      address: DOJANG, abi: dojangAbi, functionName: "registerAttestation", args: [uid],
    });
    const registerRcpt = await publicClient.waitForTransactionReceipt({ hash: registerTx, timeout: 60_000 });
    if (registerRcpt.status !== "success") {
      res.status(502).json({ error: "registration transaction reverted", uid, attestTx, registerTx });
      return;
    }

    const verified = await publicClient.readContract({
      address: DOJANG, abi: dojangAbi, functionName: "isVerified", args: [subject],
    });
    logger.info({ subject, uid, attestTx, registerTx }, "testnet verification sealed");
    res.json({ verified, uid, attestTx, registerTx, explorer: record.explorer });
  };

  deskQueue = deskQueue.then(run, run).catch((err) => {
    logger.error({ err }, "verify-testnet failed");
    if (!res.headersSent) res.status(500).json({ error: "verification failed; no state was hidden — check the txs on the explorer or retry" });
  });
});

export default router;
