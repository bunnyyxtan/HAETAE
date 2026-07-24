import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { agentFixtures, flags, AgentLicense, FIXTURE_WALLET, formatAddress, ledgerFixtures } from "./fixtures";
import { isFixtureMode } from "../chain/mode";
import { fetchRegistry, fetchLedger } from "../chain/reads";
import { explorerAddr } from "../chain/deployment";
import { navigateToVerify } from "../utils/path";
import PapersModal from "./PapersModal";
import RevokeModal from "./RevokeModal";
import PolicyModal from "./PolicyModal";
import MintModal, { type MintResult } from "./MintModal";

interface Activity {
    count: number;
    lastBlock: number;
}

interface AgentsPageProps {
    connectedAddress: string | null;
    onRequestConnect: () => void;
}

// Dossier address: longer than the table's 6…4 short form — a dossier is
// where you come to actually read the address — but still overflow-safe.
const dossierAddr = (a: string) => `${a.slice(0, 18)}…${a.slice(-6)}`;

export default function AgentsPage({ connectedAddress, onRequestConnect }: AgentsPageProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [agents, setAgents] = useState<AgentLicense[]>([]);
    const [activity, setActivity] = useState<Map<string, Activity> | null>(null);
    const [activityError, setActivityError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const refetchSeqRef = useRef(0);

    const [papersAgent, setPapersAgent] = useState<AgentLicense | null>(null);
    const [papersOpener, setPapersOpener] = useState<HTMLElement | null>(null);
    const [revokeAgent, setRevokeAgent] = useState<AgentLicense | null>(null);
    const [revokeOpener, setRevokeOpener] = useState<HTMLElement | null>(null);
    const [policyAgent, setPolicyAgent] = useState<AgentLicense | null>(null);
    const [policyOpener, setPolicyOpener] = useState<HTMLElement | null>(null);
    const [mintOpen, setMintOpen] = useState(false);
    const [mintOpener, setMintOpener] = useState<HTMLElement | null>(null);
    const [relicenseAgent, setRelicenseAgent] = useState<AgentLicense | null>(null);

    useEffect(() => {
        refetchSeqRef.current++;
        setLoading(true);
        setError(false);
        setActivityError(false);
        setActivity(null);
        if (isFixtureMode) {
            const timer = setTimeout(() => {
                if (flags.forceError) {
                    setError(true);
                } else {
                    setAgents(flags.forceEmpty ? [] : agentFixtures);
                    const map = new Map<string, Activity>();
                    for (const ev of ledgerFixtures) {
                        const cur = map.get(ev.agentName);
                        map.set(ev.agentName, {
                            count: (cur?.count ?? 0) + 1,
                            lastBlock: Math.max(cur?.lastBlock ?? 0, ev.block),
                        });
                    }
                    setActivity(map);
                }
                setLoading(false);
            }, flags.loadDelayMs);
            return () => clearTimeout(timer);
        }
        // Live: dossiers require the registry. The activity line degrades
        // EXPLICITLY (never silently) if the event scan fails — the card
        // says "record unavailable" in vermillion rather than pretending
        // the agent has no history.
        let cancelled = false;
        fetchRegistry()
            .then((rows) => {
                if (cancelled) return;
                setAgents(rows);
                setLoading(false);
            })
            .catch(() => {
                if (cancelled) return;
                setError(true);
                setLoading(false);
            });
        fetchLedger()
            .then((events) => {
                if (cancelled) return;
                const map = new Map<string, Activity>();
                for (const ev of events) {
                    if (!ev.agent) continue;
                    const key = ev.agent.toLowerCase();
                    const cur = map.get(key);
                    map.set(key, {
                        count: (cur?.count ?? 0) + 1,
                        lastBlock: Math.max(cur?.lastBlock ?? 0, ev.block),
                    });
                }
                setActivity(map);
            })
            .catch(() => {
                if (!cancelled) setActivityError(true);
            });
        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    const activityFor = (agent: AgentLicense): Activity | null => {
        if (!activity) return null;
        return (
            activity.get(isFixtureMode ? agent.name : agent.address.toLowerCase()) ?? {
                count: 0,
                lastBlock: 0,
            }
        );
    };

    // Same ghost-clamp discipline as Registry: a lagging replica must never
    // resurrect a locally ghosted dossier (revocation is terminal on-chain).
    const silentRefetch = () => {
        if (isFixtureMode) return;
        const seq = ++refetchSeqRef.current;
        fetchRegistry()
            .then((rows) => {
                if (seq !== refetchSeqRef.current) return;
                setAgents((prev) =>
                    rows.map((r) => {
                        const local = prev.find((p) => p.licenseNo === r.licenseNo);
                        return local?.status === "ghost" && r.status !== "ghost"
                            ? { ...r, status: "ghost" as const }
                            : r;
                    }),
                );
            })
            .catch(() => {
                /* local state already reflects the receipt; next load reconciles */
            });
    };

    const openPapers = (agent: AgentLicense) => {
        setPapersOpener(document.activeElement as HTMLElement);
        setPapersAgent(agent);
    };
    const openRevoke = (agent: AgentLicense) => {
        setRevokeOpener(document.activeElement as HTMLElement);
        setRevokeAgent(agent);
    };
    const openPolicy = (agent: AgentLicense) => {
        setPolicyOpener(document.activeElement as HTMLElement);
        setPolicyAgent(agent);
    };
    const openMint = (relicense: AgentLicense | null) => {
        if (!isFixtureMode && !connectedAddress) {
            onRequestConnect();
            return;
        }
        setMintOpener(document.activeElement as HTMLElement);
        setRelicenseAgent(relicense);
        setMintOpen(true);
    };

    const handleRevoked = (revokedAgent: AgentLicense) => {
        setAgents((prev) =>
            prev.map((a) => (a.licenseNo === revokedAgent.licenseNo ? { ...a, status: "ghost" } : a)),
        );
        silentRefetch();
    };

    const handleMinted = (r: MintResult) => {
        if (!isFixtureMode) {
            silentRefetch();
            return;
        }
        setAgents((prev) => {
            const nextNum =
                prev.reduce((m, a) => {
                    const n = parseInt(a.licenseNo.replace(/\D/g, ""), 10);
                    return Number.isFinite(n) ? Math.max(m, n) : m;
                }, 0) + 1;
            const maxBlock = prev.reduce((m, a) => Math.max(m, a.issuedBlock), 4_100_000);
            const known = prev.find((p) => p.address.toLowerCase() === r.agent.toLowerCase());
            const row: AgentLicense = {
                licenseId: null,
                name: known?.name ?? formatAddress(r.agent),
                address: r.agent,
                principal: connectedAddress ?? FIXTURE_WALLET,
                licenseNo: `HT-${String(nextNum).padStart(4, "0")}`,
                capPerDay: 0,
                venues: [],
                expiry: `${new Date(r.expiryUnix * 1000).toISOString().slice(0, 10)} · ${r.expiryUnix}`,
                expiryUnix: r.expiryUnix,
                issuedBlock: maxBlock + 1,
                scope: r.scope,
                status: "licensed",
            };
            return [...prev, row];
        });
    };

    const handlePolicyChanged = (agentAddr: string, patch: { capPerDay?: number; venues?: string[] }) => {
        if (!isFixtureMode) {
            silentRefetch();
            return;
        }
        setAgents((prev) =>
            prev.map((a) =>
                a.address.toLowerCase() === agentAddr.toLowerCase() && a.status !== "ghost"
                    ? {
                          ...a,
                          capPerDay: patch.capPerDay ?? a.capPerDay,
                          venues: patch.venues ?? a.venues,
                      }
                    : a,
            ),
        );
    };

    const canOperate = (agent: AgentLicense) =>
        agent.status !== "ghost" &&
        (isFixtureMode ||
            (!!connectedAddress &&
                !!agent.principal &&
                connectedAddress.toLowerCase() === agent.principal.toLowerCase()));

    const canRelicense = (agent: AgentLicense) =>
        agent.status === "ghost" &&
        !agents.some(
            (a) => a.status === "licensed" && a.address.toLowerCase() === agent.address.toLowerCase(),
        ) &&
        (isFixtureMode ||
            (!!connectedAddress &&
                !!agent.principal &&
                connectedAddress.toLowerCase() === agent.principal.toLowerCase()));

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
        >
            <div className="co-page-header">
                <h1 className="co-page-title font-display">The Agents</h1>
                <p className="co-page-desc">
                    Every dossier binds an autonomous agent to the human principal who answers for it.
                </p>
            </div>

            {loading && (
                <div className="co-agent-grid" aria-hidden>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="co-agent-card">
                            <div className="co-skel" style={{ width: "60%", height: 22 }} />
                            <div className="co-skel" style={{ width: "45%", height: 13 }} />
                            <div className="co-skel" style={{ width: "100%", height: 72 }} />
                            <div className="co-skel" style={{ width: "70%", height: 13 }} />
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

            {!loading && !error && agents.length === 0 && (
                <div className="co-empty">
                    <div className="co-empty-msg">The ledger is empty.</div>
                    <p className="co-page-desc" style={{ margin: "0 auto" }}>No agents have been licensed on this network yet.</p>
                    <button className="co-action-btn co-retry-btn" onClick={() => openMint(null)}>
                        License the first agent
                    </button>
                </div>
            )}

            {!loading && !error && agents.length > 0 && (
                <div className="co-agent-grid">
                    {agents.map((agent, i) => {
                        const act = activityFor(agent);
                        return (
                            <motion.article
                                key={agent.licenseNo}
                                className={`co-agent-card ${agent.status === "ghost" ? "is-ghost" : ""}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05, duration: 0.3 }}
                            >
                                <div className="co-agent-head">
                                    <h2 className="co-agent-name font-display">{agent.name}</h2>
                                    <span className={`co-status ${agent.status}`}>
                                        <span className="co-status-dot" aria-hidden />
                                        {agent.status}
                                    </span>
                                </div>

                                {isFixtureMode ? (
                                    <span className="co-agent-addr">{dossierAddr(agent.address)}</span>
                                ) : (
                                    <a
                                        className="co-agent-addr"
                                        href={explorerAddr(agent.address)}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {dossierAddr(agent.address)} ↗
                                    </a>
                                )}

                                <div className="co-agent-fields">
                                    <div className="co-papers-field">
                                        <div className="co-papers-label">License Nº</div>
                                        <div className="co-papers-value mono">{agent.licenseNo}</div>
                                    </div>
                                    <div className="co-papers-field">
                                        <div className="co-papers-label">Cap per Day</div>
                                        <div className="co-papers-value mono">${agent.capPerDay.toLocaleString()} USDC</div>
                                    </div>
                                    <div className="co-papers-field">
                                        <div className="co-papers-label">Allowed Venues</div>
                                        <div className="co-papers-value">
                                            {agent.venues.length > 0 ? agent.venues.join(", ") : "—"}
                                        </div>
                                    </div>
                                    <div className="co-papers-field">
                                        <div className="co-papers-label">{agent.expiryUnix ? "Expiry" : "Expiry Block"}</div>
                                        <div className="co-papers-value mono">{agent.expiry.split(" · ")[0]}</div>
                                    </div>
                                    {agent.principal && (
                                        <div className="co-papers-field">
                                            <div className="co-papers-label">Principal</div>
                                            <div className="co-papers-value mono">{formatAddress(agent.principal)}</div>
                                        </div>
                                    )}
                                    {agent.scope && (
                                        <div className="co-papers-field">
                                            <div className="co-papers-label">Scope</div>
                                            <div className="co-papers-value mono">{agent.scope}</div>
                                        </div>
                                    )}
                                </div>

                                <div className="co-agent-foot">
                                    <span
                                        className="co-agent-activity"
                                        style={activityError ? { color: "var(--vermillion)" } : undefined}
                                    >
                                        {activityError
                                            ? "record unavailable"
                                            : act === null
                                              ? "…"
                                              : act.count === 0
                                                ? "no verdicts on record"
                                                : `${act.count} on record · last #${act.lastBlock.toLocaleString()}`}
                                    </span>
                                    <div className="co-actions">
                                        <button className="co-action-btn" onClick={() => openPapers(agent)}>
                                            Papers
                                        </button>
                                        {canOperate(agent) && (
                                            <button className="co-action-btn" onClick={() => openPolicy(agent)}>
                                                Policy
                                            </button>
                                        )}
                                        <button className="co-action-btn" onClick={() => navigateToVerify(agent.address)}>
                                            Verify
                                        </button>
                                        {canOperate(agent) && (
                                            <button className="co-action-btn is-revoke" onClick={() => openRevoke(agent)}>
                                                Revoke
                                            </button>
                                        )}
                                        {canRelicense(agent) && (
                                            <button className="co-action-btn" onClick={() => openMint(agent)}>
                                                Re-license
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </motion.article>
                        );
                    })}
                </div>
            )}

            {/* key: same AnimatePresence identity rule as Registry — an exiting
                modal instance must never be recycled for another agent. */}
            <AnimatePresence>
                {papersAgent && (
                    <PapersModal
                        key={papersAgent.licenseNo}
                        agent={papersAgent}
                        opener={papersOpener}
                        onClose={() => setPapersAgent(null)}
                    />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {revokeAgent && (
                    <RevokeModal
                        key={revokeAgent.licenseNo}
                        agent={revokeAgent}
                        opener={revokeOpener}
                        onClose={() => setRevokeAgent(null)}
                        onRevoked={handleRevoked}
                    />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {policyAgent && (
                    <PolicyModal
                        key={policyAgent.licenseNo}
                        agent={policyAgent}
                        opener={policyOpener}
                        onClose={() => setPolicyAgent(null)}
                        onPolicyChanged={handlePolicyChanged}
                    />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {mintOpen && (
                    <MintModal
                        key={`mint-${relicenseAgent?.licenseNo ?? "new"}`}
                        opener={mintOpener}
                        onClose={() => {
                            setMintOpen(false);
                            setRelicenseAgent(null);
                        }}
                        onMinted={handleMinted}
                        connectedAddress={connectedAddress}
                        agents={agents}
                        relicense={relicenseAgent}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
}
