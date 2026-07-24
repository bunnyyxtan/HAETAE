import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { flags, ledgerFixtures } from "./fixtures";
import { isFixtureMode } from "../chain/mode";
import { fetchLedger } from "../chain/reads";
import { explorerTx } from "../chain/deployment";
import type { LedgerRow } from "../chain/types";
import { kindColor } from "./PapersModal";

const TALLY: { kind: LedgerRow["kind"]; label: string }[] = [
    { kind: "licensed", label: "Licensed" },
    { kind: "revoked", label: "Revoked" },
    { kind: "verdict", label: "Verdicts" },
    { kind: "executed", label: "Executed" },
    { kind: "refused", label: "Refused" },
];

const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function LedgerPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [rows, setRows] = useState<LedgerRow[]>([]);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        setLoading(true);
        setError(false);
        if (isFixtureMode) {
            const timer = setTimeout(() => {
                if (flags.forceError) {
                    setError(true);
                } else {
                    setRows(flags.forceEmpty ? [] : ledgerFixtures);
                }
                setLoading(false);
            }, flags.loadDelayMs);
            return () => clearTimeout(timer);
        }
        // Live: the network's whole court record in one batched scan.
        // Failure is explicit — error card + retry, never a fixture fallback.
        let cancelled = false;
        fetchLedger()
            .then((events) => {
                if (cancelled) return;
                setRows(events);
                setLoading(false);
            })
            .catch(() => {
                if (cancelled) return;
                setError(true);
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    const display = [...rows].reverse(); // newest verdict first
    const tally = (kind: LedgerRow["kind"]) => rows.filter((r) => r.kind === kind).length;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
        >
            <div className="co-page-header">
                <h1 className="co-page-title font-display">The Ledger</h1>
                <p className="co-page-desc">
                    The network's full court record — every license, verdict, and trade, from the deploy
                    block forward.
                </p>
            </div>

            {loading && (
                <div className="co-ledger-wrap" aria-hidden>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="co-ledger-row">
                            <div className="co-skel" style={{ width: 90, height: 12 }} />
                            <div className="co-skel" style={{ width: 140, height: 14 }} />
                            <div className="co-skel" style={{ width: "70%", height: 14 }} />
                            <div className="co-skel" style={{ width: 80, height: 12 }} />
                        </div>
                    ))}
                </div>
            )}

            {!loading && error && (
                <div className="co-empty">
                    <div className="co-empty-msg" style={{ color: "var(--vermillion)" }}>Ledger Unreachable</div>
                    <p className="co-page-desc" style={{ margin: "0 auto" }}>The chain is not responding. Check your connection.</p>
                    <button className="co-action-btn co-retry-btn" onClick={() => setReloadKey((k) => k + 1)}>
                        Retry
                    </button>
                </div>
            )}

            {!loading && !error && rows.length === 0 && (
                <div className="co-empty">
                    <div className="co-empty-msg">No verdicts on record.</div>
                    <p className="co-page-desc" style={{ margin: "0 auto" }}>The court has not spoken on this network yet.</p>
                </div>
            )}

            {!loading && !error && rows.length > 0 && (
                <>
                    <div className="co-tally">
                        {TALLY.map((t) => {
                            const n = tally(t.kind);
                            return (
                                <span key={t.kind} className="co-tally-chip">
                                    <span
                                        className="co-tally-n"
                                        style={n > 0 ? { color: kindColor[t.kind] } : undefined}
                                    >
                                        {n}
                                    </span>
                                    {t.label}
                                </span>
                            );
                        })}
                    </div>

                    <div className="co-ledger-wrap">
                        {display.map((ev, i) => (
                            <motion.div
                                key={`${ev.txHash ?? ev.agentName}-${ev.block}-${i}`}
                                className="co-ledger-row"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: Math.min(i, 12) * 0.04, duration: 0.3 }}
                            >
                                <span className="co-ledger-kind" style={{ color: kindColor[ev.kind] }}>
                                    {ev.label}
                                </span>
                                <span className="co-ledger-agent">
                                    {ev.agentName}
                                    {!isFixtureMode && ev.agent && (
                                        <span className="mono">{shortAddr(ev.agent)}</span>
                                    )}
                                </span>
                                <span className="co-ledger-detail">{ev.detail}</span>
                                {ev.txHash ? (
                                    <a
                                        className="co-tx-link font-mono co-ledger-block"
                                        href={explorerTx(ev.txHash)}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        #{ev.block.toLocaleString()} ↗
                                    </a>
                                ) : (
                                    <span
                                        className="co-tx-link font-mono co-ledger-block"
                                        style={{ borderBottom: "none" }}
                                    >
                                        #{ev.block.toLocaleString()}
                                    </span>
                                )}
                            </motion.div>
                        ))}
                    </div>
                </>
            )}
        </motion.div>
    );
}
