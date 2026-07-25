import type { Hex } from "viem";

// ---------------------------------------------------------------------------
// Tx watch layer (Task #20 root-cause fix).
//
// The P3 gate walk reproduced the stuck-seal failure: the mint tx confirmed
// on-chain while the modal never left "Awaiting signature…". Two mechanisms,
// one class — the ceremony state machine lost the tx between the wallet
// response and the receipt watch:
//
//   1. The wallet phase awaited eth_sendTransaction with no deadline and the
//      modal locked against closing — a slow wallet/RPC left the ceremony
//      wedged on a stale label with no tx link.
//   2. waitForTransactionReceipt ran with a single hard 30s timeout, and the
//      callers treated the timeout THROW as ceremony failure — converting
//      "not yet included" into "failed" while the tx later landed (the walk's
//      mint included ~55s after send).
//
// Ruling honored here: when the UI cannot determine tx state it must say so
// explicitly and keep watching — never hang on a stale label, never report
// failure for a tx that may still land.
// ---------------------------------------------------------------------------

/** Thrown when the watcher is stopped by its owner (e.g. modal unmounted).
 *  Callers' mountedRef guards swallow it — it must never surface as a verdict. */
export class WatchAbortedError extends Error {
    constructor() {
        super("Tx watch aborted by its owner.");
        this.name = "WatchAbortedError";
    }
}

/** Thrown when a submitted tx is still unconfirmed after maxMs of watching. */
export class TxUnconfirmedError extends Error {
    readonly hash: Hex;
    constructor(hash: Hex) {
        super(
            "Submitted but still unconfirmed — the transaction may yet land. Check it on the explorer before retrying.",
        );
        this.name = "TxUnconfirmedError";
        this.hash = hash;
    }
}

/** Minimal receipt shape the watcher needs (viem receipt is a superset). */
export interface WatchableReceipt {
    status: string; // "success" | "reverted"
    logs: unknown[];
}

/** Minimal client surface — injectable for tests. */
export interface ReceiptClient {
    waitForTransactionReceipt(args: { hash: Hex; timeout?: number }): Promise<WatchableReceipt>;
}

const isTimeoutError = (err: unknown): boolean =>
    err instanceof Error && /timed?\s?out|timeout/i.test(`${err.name} ${err.message}`);

export interface WatchTxOptions {
    /** Per-attempt receipt wait (ms). Default 30s. */
    attemptMs?: number;
    /** Total watch budget (ms) before TxUnconfirmedError. Default 5 min. */
    maxMs?: number;
    /**
     * Fired every time an attempt times out without a receipt. The UI uses it
     * to switch to the honest "submitted — still confirming" state.
     */
    onStillWaiting?: (elapsedMs: number) => void;
    /**
     * Polled between attempts; return true to stop watching (throws
     * WatchAbortedError). Prevents closed/unmounted ceremonies from keeping
     * background receipt polls alive for the full budget.
     */
    shouldStop?: () => boolean;
    /** Injectable clock for tests. */
    now?: () => number;
}

export interface WatchTxResult {
    status: "success" | "reverted";
    logs: unknown[];
}

/**
 * Watch a submitted tx until a receipt exists. A per-attempt timeout is NOT
 * failure: the watcher reports it via onStillWaiting and keeps going. Only a
 * real receipt resolves ("success"/"reverted"); exhausting the total budget
 * throws TxUnconfirmedError (an explicitly *unknown* verdict, never "failed").
 */
export async function watchTx(
    client: ReceiptClient,
    hash: Hex,
    opts: WatchTxOptions = {},
): Promise<WatchTxResult> {
    const { attemptMs = 30_000, maxMs = 300_000, onStillWaiting, shouldStop, now = Date.now } = opts;
    const start = now();
    for (;;) {
        if (shouldStop?.()) throw new WatchAbortedError();
        try {
            const receipt = await client.waitForTransactionReceipt({ hash, timeout: attemptMs });
            return {
                status: receipt.status === "success" ? "success" : "reverted",
                logs: receipt.logs,
            };
        } catch (err) {
            if (!isTimeoutError(err)) throw err;
            const elapsed = now() - start;
            if (elapsed >= maxMs) throw new TxUnconfirmedError(hash);
            onStillWaiting?.(elapsed);
        }
    }
}

/**
 * Deadline for the wallet phase: fires onSlow once if the wallet has not
 * answered within slowMs. It never rejects or cancels the underlying request —
 * the wallet may still answer — it only lets the UI switch to an honest
 * "no wallet response yet" state instead of hanging on "Awaiting signature…".
 */
export function walletSlowTimer(onSlow: () => void, slowMs = 15_000): { clear: () => void } {
    const t = setTimeout(onSlow, slowMs);
    return { clear: () => clearTimeout(t) };
}
