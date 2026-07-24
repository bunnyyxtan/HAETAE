import { BaseError, ContractFunctionRevertedError } from "viem";

// One decoder for every HAETAE custom error (RULES R4.6: the UI shows decoded
// names and plain sentences, never raw hex). viem surfaces simulated and
// mined reverts as ContractFunctionRevertedError with the errorName resolved
// against the ABI that made the call; RPC-mangled paths degrade to message
// sniffing against the known names rather than guessing.
const HUMAN: Record<string, string> = {
    NotLicensed: "Chain refused: this agent has never been licensed.",
    NotAuthorized: "Chain refused: connected wallet is not this license's principal.",
    AlreadyRevoked: "Chain refused: the license is already revoked.",
    AlreadyLicensed: "Chain refused: this agent already holds an active license.",
    NotVerified: "Chain refused: principal is not Dojang-verified.",
    ZeroAddress: "Chain refused: the zero address cannot be licensed.",
    InvalidExpiry: "Chain refused: expiry must be in the future.",
    TransfersDisabled: "Chain refused: licenses are soulbound and cannot move.",
    LicenseNotActive: "Chain refused: the agent's license is not Active.",
    NotPrincipal: "Chain refused: connected wallet is not this agent's principal.",
    NotGate: "Chain refused: only the gate may record spend.",
    CapExceeded: "Chain refused: this spend exceeds the daily cap.",
    SpendExceedsRemaining: "Chain refused: this spend exceeds what remains today.",
    VenueNotAllowed: "Chain refused: that venue is not on the agent's allowlist.",
    NotAuthorizedCaller: "Chain refused: caller is not authorized.",
    LicenseExpired: "Chain refused: the agent's license has expired.",
};

export interface DecodedError {
    /** Custom-error name when one could be decoded, else null. */
    name: string | null;
    /** Ready-to-render sentence. Never raw hex. */
    message: string;
}

function isUserRejection(err: unknown): boolean {
    let cur: unknown = err;
    while (cur && typeof cur === "object") {
        const e = cur as { name?: string; code?: number; cause?: unknown };
        if (e.name === "UserRejectedRequestError" || e.code === 4001) return true;
        cur = e.cause;
    }
    return false;
}

export function decodeHaetaeError(err: unknown): DecodedError {
    if (isUserRejection(err)) {
        return { name: null, message: "Rejected in wallet." };
    }

    if (err instanceof BaseError) {
        const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
        if (reverted instanceof ContractFunctionRevertedError) {
            const name = reverted.data?.errorName ?? reverted.reason ?? null;
            if (name && HUMAN[name]) return { name, message: HUMAN[name] };
            if (name) return { name, message: `Chain refused: ${name}.` };
        }
    }

    // Degraded path: some RPC/wallet stacks flatten the revert into text.
    const msg = err instanceof Error ? err.message : String(err);
    for (const name of Object.keys(HUMAN)) {
        if (msg.includes(name)) return { name, message: HUMAN[name] };
    }
    const first = msg.split("\n")[0];
    return {
        name: null,
        message: first.length > 90 ? `${first.slice(0, 90)}…` : first,
    };
}
