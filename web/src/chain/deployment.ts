// Typed view over the committed deployment record — the single source of truth
// for live addresses. deployments/giwa-sepolia.json is written by the Stage A
// deploy (commit 4b43402 lineage); nothing here is hand-maintained.
import record from "../../../deployments/giwa-sepolia.json";
import { getAddress, type Address } from "viem";

const c = record.contracts;

export const addresses = {
    license: getAddress(c.HaetaeLicense.address),
    policy: getAddress(c.HaetaePolicy.address),
    gate: getAddress(c.HaetaeGate.address),
    sentinel: getAddress(c.SentinelAuthority.address),
    vault: getAddress(c.DemoVault.address),
    usdc: getAddress(c.MockUSDC.address),
} as const;

// License deploy block: the earliest block any event we render can exist in.
export const DEPLOY_BLOCK = BigInt(c.HaetaeLicense.block);
export const RPC_URL = record.rpc;
export const EXPLORER = record.explorer;
export const CHAIN_ID = record.chainId;

const titleCase = (s: string) =>
    s
        .split(/[-_]/)
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(" ");

// Demo cast: address -> display name (roster from the deployment record).
const agentNames = new Map<string, string>();
for (const [key, entry] of Object.entries(record.cast)) {
    const addr = (entry as { address?: string }).address;
    if (addr) agentNames.set(addr.toLowerCase(), titleCase(key));
}

export const venueList: { name: string; address: Address }[] = Object.entries(
    record.venues,
).map(([key, addr]) => ({ name: titleCase(key), address: getAddress(addr as string) }));

const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function agentDisplayName(addr: string): string | null {
    return agentNames.get(addr.toLowerCase()) ?? null;
}

export function venueDisplayName(addr: string): string {
    return (
        venueList.find((v) => v.address.toLowerCase() === addr.toLowerCase())?.name ??
        shortAddr(addr)
    );
}

export const explorerTx = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const explorerAddr = (addr: string) => `${EXPLORER}/address/${addr}`;
