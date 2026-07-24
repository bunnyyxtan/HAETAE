import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { agentFixtures, FIXTURE_WALLET, flags, ledgerFixtures } from "./fixtures";
import { isFixtureMode } from "../chain/mode";
import { fetchLedger, fetchRegistry } from "../chain/reads";
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

// Mine-only matching key: fixture rows have no address (agent: null), so the
// fixture key space is agent names; live rows key on lowercased addresses.
const rowKey = (r: LedgerRow) => (isFixtureMode ? r.agentName : (r.agent ?? "").toLowerCase());

const downloadFile = (name: string, mime: string, text: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
};

const csvEscape = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

interface LedgerPageProps {
    connectedAddress: string | null;
}

export default function LedgerPage({ connectedAddress }: LedgerPageProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [rows, setRows] = useState<LedgerRow[]>([]);
    const [reloadKey, setReloadKey] = useState(0);

    // Toolbar state. kindFilter empty = all kinds pass.
    const [kindFilter, setKindFilter] = useState<Set<LedgerRow["kind"]>>(new Set());
    const [query, setQuery] = useState("");
    const [mineOnly, setMineOnly] = useState(false);
    // Principal map for mine-only: null = not loaded yet. Failure is explicit.
    const [mineKeys, setMineKeys] = useState<Set<string> | null>(null);
    const [mineErr, setMineErr] = useState(false);

    useEffect(() => {
        setLoading(true);
        setError(false);
        setMineErr(false);
        if (isFixtureMode) {
            const timer = setTimeout(() => {
                if (flags.forceError) {
                    setError(true);
                } else {
                    setRows(flags.forceEmpty ? [] : ledgerFixtures);
                    const me = (connectedAddress ?? FIXTURE_WALLET).toLowerCase();
                    setMineKeys(
                        new Set(
                            agentFixtures
                                .filter((a) => a.principal && a.principal.toLowerCase() === me)
                                .map((a) => a.name),
                        ),
                    );
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
        // The registry ride-along maps agents to principals for mine-only.
        // Its failure degrades the toggle explicitly, not the whole page.
        if (connectedAddress) {
            fetchRegistry()
                .then((agents) => {
                    if (cancelled) return;
                    const me = connectedAddress.toLowerCase();
                    setMineKeys(
                        new Set(
                            agents
                                .filter((a) => a.principal && a.principal.toLowerCase() === me)
                                .map((a) => a.address.toLowerCase()),
                        ),
                    );
                })
                .catch(() => {
                    if (!cancelled) setMineErr(true);
                });
        }
        return () => {
            cancelled = true;
        };
    }, [reloadKey, connectedAddress]);

    const toggleKind = (kind: LedgerRow["kind"]) => {
        setKindFilter((prev) => {
            const next = new Set(prev);
            if (next.has(kind)) next.delete(kind);
            else next.add(kind);
            return next;
        });
    };

    const q = query.trim().toLowerCase();
    const filtered = rows.filter((r) => {
        if (kindFilter.size > 0 && !kindFilter.has(r.kind)) return false;
        if (
            q &&
            !r.agentName.toLowerCase().includes(q) &&
            !(r.agent ?? "").toLowerCase().includes(q) &&
            !r.detail.toLowerCase().includes(q)
        )
            return false;
        if (mineOnly && mineKeys !== null && !mineKeys.has(rowKey(r))) return false;
        return true;
    });
    const display = [...filtered].reverse(); // newest verdict first
    const tally = (kind: LedgerRow["kind"]) => rows.filter((r) => r.kind === kind).length;
    const hasActiveFilters = kindFilter.size > 0 || q !== "" || mineOnly;

    const clearFilters = () => {
        setKindFilter(new Set());
        setQuery("");
        setMineOnly(false);
    };

    const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

    // Exports serialize the FILTERED view — what you see is what you save.
    const exportJson = () => {
        downloadFile(
            `haetae-ledger-${stamp()}.json`,
            "application/json",
            JSON.stringify(
                filtered.map(({ kind, label, detail, block, txHash, agent, agentName }) => ({
                    kind,
                    label,
                    detail,
                    block,
                    txHash,
                    agent,
                    agentName,
                })),
                null,
                2,
            ),
        );
    };

    const exportCsv = () => {
        const header = "block,kind,label,agent_name,agent_address,detail,tx_hash";
        const lines = filtered.map((r) =>
            [r.block, r.kind, r.label, r.agentName, r.agent ?? "", r.detail, r.txHash ?? ""]
                .map(csvEscape)
                .join(","),
        );
        downloadFile(`haetae-ledger-${stamp()}.csv`, "text/csv", [header, ...lines].join("\n") + "\n");
    };

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
                    <div className="co-ledger-tools">
                        <input
                            className="co-input"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search agent, address, detail…"
                            aria-label="Search the ledger"
                            spellCheck={false}
                        />
                        {connectedAddress && (
                            <button
                                className={`co-chip ${mineOnly ? "is-on" : ""}`}
                                aria-pressed={mineOnly}
                                onClick={() => setMineOnly((v) => !v)}
                            >
                                Mine only
                            </button>
                        )}
                        <button className="co-chip" onClick={() => setReloadKey((k) => k + 1)}>
                            Refresh
                        </button>
                        <span className="co-tool-spacer" />
                        <button className="co-chip" onClick={exportCsv} disabled={filtered.length === 0}>
                            Export CSV
                        </button>
                        <button className="co-chip" onClick={exportJson} disabled={filtered.length === 0}>
                            Export JSON
                        </button>
                    </div>

                    {mineOnly && mineErr && (
                        <p className="co-field-err" style={{ marginBottom: 14 }}>
                            Principal map unreachable — “mine only” cannot be applied right now.
                        </p>
                    )}

                    {/* Tally chips double as kind filters: count = whole record, press = filter the view. */}
                    <div className="co-tally">
                        {TALLY.map((t) => {
                            const n = tally(t.kind);
                            const on = kindFilter.has(t.kind);
                            return (
                                <button
                                    key={t.kind}
                                    className={`co-tally-chip is-filter ${on ? "is-on" : ""}`}
                                    aria-pressed={on}
                                    onClick={() => toggleKind(t.kind)}
                                >
                                    <span
                                        className="co-tally-n"
                                        style={n > 0 && !on ? { color: kindColor[t.kind] } : undefined}
                                    >
                                        {n}
                                    </span>
                                    {t.label}
                                </button>
                            );
                        })}
                    </div>

                    {display.length === 0 ? (
                        <div className="co-empty">
                            <div className="co-empty-msg">No rows match the current filters.</div>
                            <button className="co-action-btn co-retry-btn" onClick={clearFilters}>
                                Clear filters
                            </button>
                        </div>
                    ) : (
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
                    )}
                </>
            )}
        </motion.div>
    );
}
