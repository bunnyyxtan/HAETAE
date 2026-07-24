import { createWalletClient, getAddress, http, parseEventLogs, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import {
    connect,
    disconnect,
    getAccount,
    getConnectors,
    reconnect,
    switchChain,
    watchAccount,
    writeContract,
} from "wagmi/actions";
import { licenseAbi, licensedEvent, policyAbi } from "./abi";
import { addresses, RPC_URL } from "./deployment";
import { decodeHaetaeError } from "./errors";
import { giwaSepolia, publicClient, wagmiConfig } from "./giwa";

// ---------------------------------------------------------------------------
// Scratch signer (dev/test only). Enabled ONLY when the dev server is started
// with VITE_SCRATCH_PK in its environment — the variable is never written to
// any file, and production builds (no such env) compile scratchAvailable to
// false and drop the UI path. Purpose: tester rounds revoke a fresh scratch
// license instead of burning the seeded demo cast (S04 GO ruling).
// ---------------------------------------------------------------------------
const SCRATCH_PK = import.meta.env.VITE_SCRATCH_PK as Hex | undefined;
export const scratchAvailable = Boolean(SCRATCH_PK);

let scratchAccount: PrivateKeyAccount | null = null;
let scratchActive = false;

export function connectScratch(): string {
    if (!SCRATCH_PK) throw new Error("Scratch signer not available in this build");
    // Clear any latent injected session first: a restored wagmi session would
    // otherwise resurface as connected after scratch disconnects. The flags
    // flip synchronously, so subscribeAccount ignores the resulting null.
    void disconnect(wagmiConfig).catch(() => {});
    scratchAccount = privateKeyToAccount(SCRATCH_PK);
    scratchActive = true;
    return scratchAccount.address;
}

export function isScratchActive(): boolean {
    return scratchActive;
}

// ---------------------------------------------------------------------------
// Injected wallets (EIP-6963 discovery via wagmi)
// ---------------------------------------------------------------------------
export interface WalletOption {
    id: string;
    name: string;
    kind: "injected" | "scratch";
}

export function listWalletOptions(): WalletOption[] {
    const connectors = getConnectors(wagmiConfig);
    // Hide the generic "Injected" entry when EIP-6963 announced named wallets.
    const named = connectors.filter((c) => !(c.id === "injected" && connectors.length > 1));
    const options: WalletOption[] = named.map((c) => ({
        id: c.id,
        name: c.name,
        kind: "injected",
    }));
    if (scratchAvailable) {
        options.push({ id: "__scratch", name: "Scratch Signer", kind: "scratch" });
    }
    // WalletConnect: REJECTED by standing ruling (S06 ratification) — injected
    // wallets fully cover the demo; WC would mean a new dep + cloud project id.
    return options;
}

export async function connectWallet(connectorId: string): Promise<string> {
    if (connectorId === "__scratch") return connectScratch();
    const connector = getConnectors(wagmiConfig).find((c) => c.id === connectorId);
    if (!connector) throw new Error("Wallet not found — is the extension enabled?");
    const result = await connect(wagmiConfig, { connector });
    // The console only speaks GIWA Sepolia. switchChain adds the chain to the
    // wallet if it is unknown (wagmi falls back to wallet_addEthereumChain).
    if (result.chainId !== giwaSepolia.id) {
        try {
            await switchChain(wagmiConfig, { chainId: giwaSepolia.id });
        } catch (err) {
            // A connected session on the wrong chain is a divergence bomb:
            // the modal reports failure while watchAccount surfaces an
            // address. Roll the connector back before rethrowing.
            await disconnect(wagmiConfig).catch(() => {});
            throw err;
        }
    }
    return getAddress(result.accounts[0]);
}

export async function disconnectWallet(): Promise<void> {
    if (scratchActive) {
        scratchActive = false;
        scratchAccount = null;
        // Belt-and-braces: clear any wagmi session that predated scratch so
        // the two state machines cannot diverge on the next reconnect.
        await disconnect(wagmiConfig).catch(() => {});
        return;
    }
    try {
        await disconnect(wagmiConfig);
    } catch {
        /* already disconnected */
    }
}

// Restore a previous injected session (no-op if none). Fire-and-forget.
export function initWallet(): void {
    void reconnect(wagmiConfig).catch(() => {});
}

// Subscribe to wagmi account changes (wallet-side disconnects, account
// switches). Scratch mode bypasses wagmi entirely, so its null updates are
// ignored while scratch is active. Returns the unwatch function.
export function subscribeAccount(onChange: (address: string | null) => void): () => void {
    return watchAccount(wagmiConfig, {
        onChange(account) {
            if (scratchActive) return;
            onChange(
                account.status === "connected" && account.address
                    ? getAddress(account.address)
                    : null,
            );
        },
    });
}

export function currentAccount(): string | null {
    if (scratchActive && scratchAccount) return scratchAccount.address;
    const acc = getAccount(wagmiConfig);
    return acc.status === "connected" && acc.address ? getAddress(acc.address) : null;
}

// ---------------------------------------------------------------------------
// Write paths (S04 revoke; operator-loop mint/setCap/setVenue). Every sender
// splits the same way: scratch signer bypasses wagmi with a direct wallet
// client; injected sessions go through wagmi with the chain pinned.
// ---------------------------------------------------------------------------
function scratchClient() {
    if (!scratchAccount) throw new Error("Scratch signer not connected");
    return createWalletClient({
        account: scratchAccount,
        chain: giwaSepolia,
        transport: http(RPC_URL),
    });
}

export async function sendRevoke(agentAddr: string): Promise<Hex> {
    const agent = getAddress(agentAddr);
    const call = {
        address: addresses.license,
        abi: licenseAbi,
        functionName: "revoke",
        args: [agent],
    } as const;
    if (scratchActive && scratchAccount) return scratchClient().writeContract(call);
    return writeContract(wagmiConfig, { ...call, chainId: giwaSepolia.id });
}

// mint(agent, expiry, scope): permissionless behind the verifier gate — the
// deployed DemoVerifier passes every address (Dojang stand-in; the UI says so).
export async function sendMint(agentAddr: string, expiryUnix: number, scopeHex: Hex): Promise<Hex> {
    const agent = getAddress(agentAddr);
    const call = {
        address: addresses.license,
        abi: licenseAbi,
        functionName: "mint",
        args: [agent, BigInt(expiryUnix), scopeHex],
    } as const;
    if (scratchActive && scratchAccount) return scratchClient().writeContract(call);
    return writeContract(wagmiConfig, { ...call, chainId: giwaSepolia.id });
}

// setCap: capRaw is in the token's base units (tUSDC: 6 decimals).
export async function sendSetCap(agentAddr: string, tokenAddr: string, capRaw: bigint): Promise<Hex> {
    const call = {
        address: addresses.policy,
        abi: policyAbi,
        functionName: "setCap",
        args: [getAddress(agentAddr), getAddress(tokenAddr), capRaw],
    } as const;
    if (scratchActive && scratchAccount) return scratchClient().writeContract(call);
    return writeContract(wagmiConfig, { ...call, chainId: giwaSepolia.id });
}

export async function sendSetVenue(agentAddr: string, venueAddr: string, allowed: boolean): Promise<Hex> {
    const call = {
        address: addresses.policy,
        abi: policyAbi,
        functionName: "setVenue",
        args: [getAddress(agentAddr), getAddress(venueAddr), allowed],
    } as const;
    if (scratchActive && scratchAccount) return scratchClient().writeContract(call);
    return writeContract(wagmiConfig, { ...call, chainId: giwaSepolia.id });
}

// Resolves true when the tx landed successfully, false when it reverted.
// Throws on timeout (30s — thirty 1s blocks without inclusion means something
// is genuinely wrong; the UI unlocks and points at the explorer).
export async function waitTx(hash: Hex): Promise<boolean> {
    const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 30_000,
    });
    return receipt.status === "success";
}

// Historical name kept for the revoke ceremony (S04).
export const waitRevoke = waitTx;

// Mint wait that also reads the verdict: the Licensed event in the receipt
// carries the freshly minted licenseId (the ceremony's sealed screen shows it).
export async function waitMint(hash: Hex): Promise<{ ok: boolean; licenseId: number | null }> {
    const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 30_000,
    });
    if (receipt.status !== "success") return { ok: false, licenseId: null };
    const logs = parseEventLogs({ abi: [licensedEvent], logs: receipt.logs });
    const id = logs[0]?.args.licenseId;
    return { ok: true, licenseId: id !== undefined ? Number(id) : null };
}

// One decoder for every failure surface (RULES R4.6): delegate to the shared
// HAETAE error decoder so wallet rejections and contract reverts read the same
// everywhere.
export function walletErrorMessage(err: unknown): string {
    return decodeHaetaeError(err).message;
}
