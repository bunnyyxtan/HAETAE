import { describe, expect, it, vi } from "vitest";
import type { Hex } from "viem";
import {
    TxUnconfirmedError,
    walletSlowTimer,
    watchTx,
    type ReceiptClient,
    type WatchableReceipt,
} from "./txWatch";

// ---------------------------------------------------------------------------
// REGRESSION: P3 gate walk, step 2 (Task #20).
//
// Chain conditions reproduced from the walk: the wallet answered slowly and
// the mint tx was included ~55s after send — past the single 30s receipt
// timeout the old code used. Pre-fix behavior (kept here as the documented
// reproduction) turned that timeout into a ceremony verdict; the watcher must
// not.
// ---------------------------------------------------------------------------

const HASH = "0x7b96c67c1b07d2e1261decdd685edc67d61e4e386aeadc2a381b001965509d62" as Hex;

/** Fake chain where the receipt only exists after `availableAtMs` of fake time. */
function slowInclusionClient(availableAtMs: number, clock: { now: number }): ReceiptClient {
    return {
        async waitForTransactionReceipt({ timeout = 30_000 }): Promise<WatchableReceipt> {
            if (clock.now + timeout < availableAtMs) {
                // viem behavior: no receipt within the attempt window -> throw.
                clock.now += timeout;
                throw new Error(`Timed out while waiting for transaction with hash "${HASH}"`);
            }
            clock.now = Math.max(clock.now, availableAtMs);
            return { status: "success", logs: [] };
        },
    };
}

describe("gate-walk step 2 reproduction (tx lands after the 30s attempt window)", () => {
    it("pre-fix semantics: a single 30s receipt wait rejects even though the tx later succeeds", async () => {
        // This IS the old waitTx/waitMint shape: one attempt, timeout treated
        // as a throw that the modal converted into phase "failed"/wedged.
        const clock = { now: 0 };
        const client = slowInclusionClient(55_000, clock);
        await expect(client.waitForTransactionReceipt({ hash: HASH, timeout: 30_000 })).rejects.toThrow(
            /timed out/i,
        );
    });

    it("watchTx keeps watching past attempt timeouts, reports honest waiting, and returns the real verdict", async () => {
        const clock = { now: 0 };
        const client = slowInclusionClient(55_000, clock);
        const waits: number[] = [];
        const result = await watchTx(client, HASH, {
            attemptMs: 30_000,
            maxMs: 300_000,
            now: () => clock.now,
            onStillWaiting: (ms) => waits.push(ms),
        });
        expect(result.status).toBe("success");
        expect(waits.length).toBeGreaterThan(0); // UI was told "submitted — confirming…"
    });

    it("watchTx reports 'reverted' from a real receipt, not from a timeout", async () => {
        const client: ReceiptClient = {
            async waitForTransactionReceipt() {
                return { status: "reverted", logs: [] };
            },
        };
        const result = await watchTx(client, HASH);
        expect(result.status).toBe("reverted");
    });

    it("exhausting the total budget yields an explicit UNKNOWN verdict (TxUnconfirmedError), never 'failed'", async () => {
        const clock = { now: 0 };
        const client: ReceiptClient = {
            async waitForTransactionReceipt({ timeout = 30_000 }) {
                clock.now += timeout;
                throw new Error("Timed out while waiting for transaction receipt");
            },
        };
        await expect(
            watchTx(client, HASH, { attemptMs: 30_000, maxMs: 90_000, now: () => clock.now }),
        ).rejects.toBeInstanceOf(TxUnconfirmedError);
    });

    it("non-timeout errors still propagate (a real failure is a real failure)", async () => {
        const client: ReceiptClient = {
            async waitForTransactionReceipt() {
                throw new Error("nonce too low");
            },
        };
        await expect(watchTx(client, HASH)).rejects.toThrow(/nonce too low/);
    });
});

describe("wallet phase deadline", () => {
    it("fires onSlow when the wallet has not answered, without cancelling anything", () => {
        vi.useFakeTimers();
        const onSlow = vi.fn();
        walletSlowTimer(onSlow, 15_000);
        vi.advanceTimersByTime(14_999);
        expect(onSlow).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(onSlow).toHaveBeenCalledOnce();
        vi.useRealTimers();
    });

    it("clear() disarms the deadline once the wallet answers", () => {
        vi.useFakeTimers();
        const onSlow = vi.fn();
        const t = walletSlowTimer(onSlow, 15_000);
        vi.advanceTimersByTime(10_000);
        t.clear();
        vi.advanceTimersByTime(60_000);
        expect(onSlow).not.toHaveBeenCalled();
        vi.useRealTimers();
    });
});
