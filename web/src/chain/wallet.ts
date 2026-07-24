import { createWalletClient, getAddress, http, type Hex } from "viem";
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
import { licenseAbi } from "./abi";
import { addresses, RPC_URL } from "./deployment";
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
// The revoke path (S04 order Stage B item 2): real tx states — the ceremony
// shows pending during confirmation and the verdict on receipt.
// ---------------------------------------------------------------------------
export async function sendRevoke(agentAddr: string): Promise<Hex> {
    const agent = getAddress(agentAddr);
    if (scratchActive && scratchAccount) {
        const walletClient = createWalletClient({
            account: scratchAccount,
            chain: giwaSepolia,
            transport: http(RPC_URL),
        });
        return walletClient.writeContract({
            address: addresses.license,
            abi: licenseAbi,
            functionName: "revoke",
            args: [agent],
        });
    }
    return writeContract(wagmiConfig, {
        address: addresses.license,
        abi: licenseAbi,
        functionName: "revoke",
        args: [agent],
        chainId: giwaSepolia.id,
    });
}

// Resolves true when the revoke landed successfully, false when it reverted.
// Throws on timeout (30s — thirty 1s blocks without inclusion means something
// is genuinely wrong; the UI unlocks and points at the explorer).
export async function waitRevoke(hash: Hex): Promise<boolean> {
    const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 30_000,
    });
    return receipt.status === "success";
}

export function walletErrorMessage(err: unknown): string {
    let cur: unknown = err;
    while (cur && typeof cur === "object") {
        const e = cur as { name?: string; code?: number; cause?: unknown };
        if (e.name === "UserRejectedRequestError" || e.code === 4001) {
            return "Rejected in wallet.";
        }
        cur = e.cause;
    }
    const msg = err instanceof Error ? err.message : String(err);
    for (const name of ["NotAuthorized", "AlreadyRevoked", "NotLicensed"]) {
        if (msg.includes(name)) {
            return name === "NotAuthorized"
                ? "Chain refused: connected wallet is not this license's principal."
                : `Chain refused: ${name}.`;
        }
    }
    const first = msg.split("\n")[0];
    return first.length > 90 ? `${first.slice(0, 90)}…` : first;
}
