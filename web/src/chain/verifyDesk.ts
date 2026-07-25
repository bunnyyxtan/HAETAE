// The verification desk — client side of the self-serve testnet lane.
//
// Reads: HaetaeDojang.isVerified / attestationUidOf (chain truth, wallet-free).
// Write: POST /api/verify-testnet — a server-side desk holding the attester
// key; the browser never sees ATTESTER_PK. The endpoint is testnet-only and
// stands in for Upbit Dojang KYC (on mainnet, principals verify via Upbit).
import { parseAbi, type Address, type Hex } from "viem";
import { addresses } from "./deployment";
import { publicClient } from "./giwa";

export const dojangAbi = parseAbi([
    "function isVerified(address subject) view returns (bool)",
    "function attestationUidOf(address subject) view returns (bytes32)",
]);

const ZERO_UID = `0x${"00".repeat(32)}` as Hex;

export type VerificationLane = "dojang" | "haetae" | null;

export interface PrincipalVerification {
    verified: boolean;
    /** HAETAE attestation uid (lane 2) — zero uid means lane 1 or unverified. */
    uid: Hex | null;
    /** Which lane satisfied the check; approximate: uid present -> haetae. */
    lane: VerificationLane;
}

export async function fetchPrincipalVerification(
    principal: string,
): Promise<PrincipalVerification> {
    const dojang = addresses.dojang as Address;
    const [verified, uid] = await Promise.all([
        publicClient.readContract({
            address: dojang, abi: dojangAbi, functionName: "isVerified", args: [principal as Address],
        }),
        publicClient.readContract({
            address: dojang, abi: dojangAbi, functionName: "attestationUidOf", args: [principal as Address],
        }),
    ]);
    const hasUid = uid !== ZERO_UID;
    return {
        verified,
        uid: hasUid ? uid : null,
        lane: verified ? (hasUid ? "haetae" : "dojang") : null,
    };
}

export interface DeskResult {
    verified?: boolean;
    alreadyVerified?: boolean;
    uid: Hex;
    attestTx?: Hex;
    registerTx?: Hex;
}

export class DeskError extends Error {}

/** BASE_URL already ends with "/" (vite law) — /api rides the same origin. */
const DESK_URL = `${import.meta.env.BASE_URL}api/verify-testnet`;

export async function requestTestnetVerification(address: string): Promise<DeskResult> {
    // Bounded ceremony: two ~1s-block txs should land well inside 90s. A
    // hung desk must surface as a failed (closable) state, never a trapped
    // modal — the stuck-"Sealing…" law applies here too.
    const abort = new AbortController();
    const deadline = setTimeout(() => abort.abort(), 90_000);
    let res: Response;
    try {
        res = await fetch(DESK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address }),
            signal: abort.signal,
        });
    } catch (err) {
        throw new DeskError(
            err instanceof DOMException && err.name === "AbortError"
                ? "The desk did not answer within 90 seconds. The transactions may still land — retry in a minute; an already-verified address costs nothing."
                : "The verification desk is unreachable. Check your connection and retry.",
        );
    } finally {
        clearTimeout(deadline);
    }
    let body: Record<string, unknown> = {};
    try {
        body = (await res.json()) as Record<string, unknown>;
    } catch {
        /* non-JSON error body */
    }
    if (!res.ok) {
        throw new DeskError(
            typeof body["error"] === "string"
                ? (body["error"] as string)
                : `Verification desk refused (HTTP ${res.status}).`,
        );
    }
    return body as unknown as DeskResult;
}
