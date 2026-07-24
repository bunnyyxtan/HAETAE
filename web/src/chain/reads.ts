import { getAddress, hexToString, type GetLogsReturnType } from "viem";
import type { AgentRow, LedgerRow } from "./types";
import {
    licenseAbi,
    policyAbi,
    licensedEvent,
    revokedEvent,
    sentinelVerdictEvent,
    tradeExecutedEvent,
    tradeRefusedEvent,
    verdictName,
} from "./abi";
import {
    addresses,
    agentDisplayName,
    venueDisplayName,
    venueList,
    DEPLOY_BLOCK,
} from "./deployment";
import { publicClient } from "./giwa";

const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const usdc = (amount: bigint) => Number(amount / 1_000_000n).toLocaleString();

function decodeScope(scope: `0x${string}`): string | null {
    try {
        const s = hexToString(scope).replace(/\u0000+$/g, "").trim();
        return s.length > 0 ? s : null;
    } catch {
        return null;
    }
}

// Registry rows: ERC721Enumerable walk -> licenseById -> policy views.
// Cap/day and venues come from HaetaePolicy (the UI concern deferred in S02,
// live now). Reads batch through multicall; ~30 calls collapse to a handful.
export async function fetchRegistry(): Promise<AgentRow[]> {
    const total = await publicClient.readContract({
        address: addresses.license,
        abi: licenseAbi,
        functionName: "totalSupply",
    });

    const ids = await Promise.all(
        Array.from({ length: Number(total) }, (_, i) =>
            publicClient.readContract({
                address: addresses.license,
                abi: licenseAbi,
                functionName: "tokenByIndex",
                args: [BigInt(i)],
            }),
        ),
    );

    const [records, issuedBlocks] = await Promise.all([
        Promise.all(
            ids.map((id) =>
                publicClient.readContract({
                    address: addresses.license,
                    abi: licenseAbi,
                    functionName: "licenseById",
                    args: [id],
                }),
            ),
        ),
        fetchIssuedBlocks(),
    ]);

    const rows = await Promise.all(
        records.map(async (rec, i): Promise<AgentRow> => {
            const id = ids[i];
            const [cap, venueFlags] = await Promise.all([
                publicClient.readContract({
                    address: addresses.policy,
                    abi: policyAbi,
                    functionName: "capPerDay",
                    args: [rec.agent, addresses.usdc],
                }),
                Promise.all(
                    venueList.map((v) =>
                        publicClient.readContract({
                            address: addresses.policy,
                            abi: policyAbi,
                            functionName: "isVenueAllowed",
                            args: [rec.agent, v.address],
                        }),
                    ),
                ),
            ]);

            const expiryUnix = Number(rec.expiry);
            const expiryDate = new Date(expiryUnix * 1000).toISOString().slice(0, 10);
            const scope = decodeScope(rec.scope);
            return {
                licenseId: Number(id),
                name: agentDisplayName(rec.agent) ?? shortAddr(rec.agent),
                address: getAddress(rec.agent),
                principal: getAddress(rec.principal),
                licenseNo: `HT-${String(id).padStart(4, "0")}`,
                capPerDay: Number(cap / 1_000_000n),
                venues: venueList.filter((_, vi) => venueFlags[vi]).map((v) => v.name),
                expiry: `${expiryDate} · ${expiryUnix}`,
                expiryUnix,
                issuedBlock: Number(issuedBlocks.get(id) ?? 0n),
                scope,
                status: rec.status === 2 ? "ghost" : "licensed",
            };
        }),
    );

    return rows.sort((a, b) => (a.licenseId ?? 0) - (b.licenseId ?? 0));
}

async function fetchIssuedBlocks(): Promise<Map<bigint, bigint>> {
    const logs = await publicClient.getLogs({
        address: addresses.license,
        event: licensedEvent,
        fromBlock: DEPLOY_BLOCK,
    });
    const map = new Map<bigint, bigint>();
    for (const log of logs) {
        if (log.args.licenseId !== undefined) map.set(log.args.licenseId, log.blockNumber);
    }
    return map;
}

// Court record: every on-chain verdict touching one agent, straight from event
// logs (S04 order: no indexer this session — getLogs over the deploy range is
// fast enough at demo scale).
export interface CourtEvent {
    kind: "licensed" | "revoked" | "verdict" | "executed" | "refused";
    label: string;
    detail: string;
    block: number;
    txHash: string;
    logIndex: number;
    agent: string; // checksummed agent address the event binds
}

// All five HAETAE events index the agent; absent args only occur on malformed
// logs, which we surface as the zero address rather than guessing.
const ZERO_AGENT = "0x0000000000000000000000000000000000000000";
const evAgent = (agent: string | undefined): string =>
    agent ? getAddress(agent) : ZERO_AGENT;

export async function fetchCourtRecord(agentAddr: string): Promise<CourtEvent[]> {
    const agent = getAddress(agentAddr);
    const fromBlock = DEPLOY_BLOCK;

    const [lic, rev, verd, exec, ref] = await Promise.all([
        publicClient.getLogs({ address: addresses.license, event: licensedEvent, args: { agent }, fromBlock }),
        publicClient.getLogs({ address: addresses.license, event: revokedEvent, args: { agent }, fromBlock }),
        publicClient.getLogs({ address: addresses.sentinel, event: sentinelVerdictEvent, args: { agent }, fromBlock }),
        publicClient.getLogs({ address: addresses.vault, event: tradeExecutedEvent, args: { agent }, fromBlock }),
        publicClient.getLogs({ address: addresses.vault, event: tradeRefusedEvent, args: { agent }, fromBlock }),
    ]);

    return toCourtEvents(lic, rev, verd, exec, ref);
}

// The Ledger view: the same five event streams, unfiltered — the network's
// entire court record in one batched read (5 getLogs, shared via JSON-RPC
// batching; no per-agent fan-out).
export async function fetchLedger(): Promise<LedgerRow[]> {
    const fromBlock = DEPLOY_BLOCK;

    const [lic, rev, verd, exec, ref] = await Promise.all([
        publicClient.getLogs({ address: addresses.license, event: licensedEvent, fromBlock }),
        publicClient.getLogs({ address: addresses.license, event: revokedEvent, fromBlock }),
        publicClient.getLogs({ address: addresses.sentinel, event: sentinelVerdictEvent, fromBlock }),
        publicClient.getLogs({ address: addresses.vault, event: tradeExecutedEvent, fromBlock }),
        publicClient.getLogs({ address: addresses.vault, event: tradeRefusedEvent, fromBlock }),
    ]);

    return toCourtEvents(lic, rev, verd, exec, ref).map((ev) => ({
        kind: ev.kind,
        label: ev.label,
        detail: ev.detail,
        block: ev.block,
        txHash: ev.txHash,
        agent: ev.agent,
        agentName: agentDisplayName(ev.agent) ?? shortAddr(ev.agent),
    }));
}

function toCourtEvents(
    lic: GetLogsReturnType<typeof licensedEvent>,
    rev: GetLogsReturnType<typeof revokedEvent>,
    verd: GetLogsReturnType<typeof sentinelVerdictEvent>,
    exec: GetLogsReturnType<typeof tradeExecutedEvent>,
    ref: GetLogsReturnType<typeof tradeRefusedEvent>,
): CourtEvent[] {
    const events: CourtEvent[] = [
        ...lic.map((l): CourtEvent => ({
            kind: "licensed",
            label: "Licensed",
            detail: `HT-${String(l.args.licenseId).padStart(4, "0")} · principal ${shortAddr(l.args.principal ?? "")}`,
            block: Number(l.blockNumber),
            txHash: l.transactionHash,
            logIndex: l.logIndex,
            agent: evAgent(l.args.agent),
        })),
        ...rev.map((l): CourtEvent => ({
            kind: "revoked",
            label: "Revoked",
            detail:
                l.args.revoker?.toLowerCase() === addresses.sentinel.toLowerCase()
                    ? "by Sentinel Authority"
                    : `by ${shortAddr(l.args.revoker ?? "")}`,
            block: Number(l.blockNumber),
            txHash: l.transactionHash,
            logIndex: l.logIndex,
            agent: evAgent(l.args.agent),
        })),
        ...verd.map((l): CourtEvent => ({
            kind: "verdict",
            label: "Sentinel Verdict",
            detail: `reason ${(l.args.reasonHash ?? "").slice(0, 10)}…`,
            block: Number(l.blockNumber),
            txHash: l.transactionHash,
            logIndex: l.logIndex,
            agent: evAgent(l.args.agent),
        })),
        ...exec.map((l): CourtEvent => ({
            kind: "executed",
            label: "Trade Executed",
            detail: `${usdc(l.args.amount ?? 0n)} tUSDC → ${venueDisplayName(l.args.venue ?? "")}`,
            block: Number(l.blockNumber),
            txHash: l.transactionHash,
            logIndex: l.logIndex,
            agent: evAgent(l.args.agent),
        })),
        ...ref.map((l): CourtEvent => ({
            kind: "refused",
            label: "Trade Refused",
            detail: `${verdictName(l.args.selector ?? "0x")} · ${usdc(l.args.amount ?? 0n)} tUSDC → ${venueDisplayName(l.args.venue ?? "")}`,
            block: Number(l.blockNumber),
            txHash: l.transactionHash,
            logIndex: l.logIndex,
            agent: evAgent(l.args.agent),
        })),
    ];

    return events.sort((a, b) => a.block - b.block || a.logIndex - b.logIndex);
}

// Live block ticker. 1500ms cadence instead of the chain's 1s: the ticker
// stays visibly alive while cutting sustained RPC rate by a third — the
// public endpoint 429s under burst load, and any 429 shows up as a browser
// console error. Returns the unwatch function.
export function watchBlockTicker(onBlock: (block: number) => void): () => void {
    return publicClient.watchBlockNumber({
        emitOnBegin: true,
        pollingInterval: 1_500,
        onBlockNumber: (b) => onBlock(Number(b)),
        onError: () => {
            /* transient RPC hiccups: keep the last block on screen */
        },
    });
}
