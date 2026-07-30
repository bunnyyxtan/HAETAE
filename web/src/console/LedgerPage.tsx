import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { agentFixtures, flags, ledgerFixtures } from "./fixtures";
import { isFixtureMode } from "../chain/mode";
import { fetchLedger, fetchRegistry } from "../chain/reads";
import { explorerTx } from "../chain/deployment";
import type { LedgerRow } from "../chain/types";
import { kindColor } from "./PapersModal";
import EntryGate from "./EntryGate";

const TALLY: { kind: LedgerRow["kind"]; label: string }[] = [
    { kind: "licensed", label: "Licensed" },
    { kind: "revoked", label: "Revoked" },
    { kind: "verdict", label: "Verdicts" },
    { kind: "executed", label: "Executed" },
    { kind: "refused", label: "Refused" },
];

const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

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
    onRequestConnect: () => void;
}

// FINAL RULING (wallet-scoped console): the Ledger shows only verdicts
// belonging to the connected principal's agents. Disconnected shows the
// entry state and fetches nothing. The global court-record feed and the
// optional mine-only toggle are deleted, not hidden; if the principal
// mapping cannot be read, the page shows the explicit error state and
// never falls back to the network-wide feed.
export default function LedgerPage({ connectedAddress, onRequestConnect }: LedgerPageProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [rows, setRows] = useState<LedgerRow[]>([]);
    const [reloadKey, setReloadKey] = useState(0);
    const gateActive = !connectedAddress;

    // Toolbar state. kindFilter empty = all kinds pass.
    const [kindFilter, setKindFilter] = useState<Set<LedgerRow["kind"]>>(new Set());
    const [query, setQuery] = useState("");

    useEffect(() => {
        // Entry state fetches nothing: no data behind the curtain and no
        // loading rows before a known result (ceremony law).
        if (!connectedAddress) return;
        const me = connectedAddress.toLowerCase();
        setLoading(true);
        setError(false);
        if (isFixtureMode) {
            // Sandbox rehearses the same law: fixture rows key on agent
            // names (fixture rows carry no addresses), scoped through the
            // fixture principal assignments.
            const timer = setTimeout(() => {
                if (flags.forceError) {
                    setError(true);
                } else {
                    const mine = new Set(
                        agentFixtures
                            .filter((a) => a.principal && a.principal.toLowerCase() === me)
                            .map((a) => a.name),
                    );
                    setRows(
                        flags.forceEmpty ? [] : ledgerFixtures.filter((r) => mine.has(r.agentName)),
                    );
                }
                setLoading(false);
            }, flags.loadDelayMs);
            return () => clearTimeout(timer);
        }
        // Live: the registry ride-along maps agents to principals; the event
        // scan is filtered through it before rows touch state. Either read
        // failing is explicit — error card + retry, never a fixture fallback
        // and never the unscoped feed.
        let cancelled = false;
        Promise.all([fetchLedger(), fetchRegistry()])
            .then(([events, agents]) => {
                if (cancelled) return;
                const mine = new Set(
                    agents
                        .filter((a) => a.principal && a.principal.toLowerCase() === me)
                        .map((a) => a.address.toLowerCase()),
                );
                setRows(events.filter((ev) => ev.agent && mine.has(ev.agent.toLowerCase())));
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
        return true;
    });
    const display = [...filtered].reverse(); // newest verdict first
    const tally = (kind: LedgerRow["kind"]) => rows.filter((r) => r.kind === kind).length;

    const clearFilters = () => {
        setKindFilter(new Set());
        setQuery("");
    };

    const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

    // Exports serialize the FILTERED view of the scoped record — what you
    // see is what you save, never another principal's rows.
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
                    This wallet's court record: every license, verdict, and trade for its agents,
                    from the deploy block forward.
                </p>
            </div>

            {gateActive && <EntryGate onConnect={onRequestConnect} />}

            {!gateActive && !loading && error && (
                <div className="co-empty">
                    <div className="co-empty-msg" style={{ color: "var(--vermillion)" }}>Ledger Unreachable</div>
                    <p className="co-page-desc" style={{ margin: "0 auto" }}>The chain is not responding. Check your connection.</p>
                    <button className="co-action-btn co-retry-btn" onClick={() => setReloadKey((k) => k + 1)}>
                        Retry
                    </button>
                </div>
            )}

            {!gateActive && !loading && !error && rows.length === 0 && (
                <div className="co-empty">
                    <div className="co-empty-msg">No verdicts on this wallet's record yet.</div>
                    <p className="co-page-desc" style={{ margin: "0 auto" }}>The court has not spoken on your agents yet.</p>
                </div>
            )}

            {!gateActive && !loading && !error && rows.length > 0 && (
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

                    {/* Tally chips double as kind filters: count = the wallet's record, press = filter the view. */}
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
