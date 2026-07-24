import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { agentFixtures, flags, AgentLicense, formatAddress } from "./fixtures";
import { isFixtureMode } from "../chain/mode";
import { fetchRegistry } from "../chain/reads";
import PapersModal from "./PapersModal";
import RevokeModal from "./RevokeModal";

interface RegistryProps {
    connectedAddress: string | null;
}

export default function Registry({ connectedAddress }: RegistryProps) {
    const [loading, setLoading] = useState(true);
    const [agents, setAgents] = useState<AgentLicense[]>([]);
    const [error, setError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    // Monotone token: overlapping silent refetches (rapid successive revokes)
    // can resolve out of order — only the newest snapshot may land.
    const refetchSeqRef = useRef(0);

    // Modals state
    const [papersAgent, setPapersAgent] = useState<AgentLicense | null>(null);
    const [papersOpener, setPapersOpener] = useState<HTMLElement | null>(null);

    const [revokeAgent, setRevokeAgent] = useState<AgentLicense | null>(null);
    const [revokeOpener, setRevokeOpener] = useState<HTMLElement | null>(null);
    const papersBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

    useEffect(() => {
        refetchSeqRef.current++; // a fresh load invalidates in-flight silent refetches
        setLoading(true);
        setError(false);
        if (isFixtureMode) {
            const timer = setTimeout(() => {
                if (flags.forceError) {
                    setError(true);
                } else {
                    setAgents(flags.forceEmpty ? [] : agentFixtures);
                }
                setLoading(false);
            }, flags.loadDelayMs);
            return () => clearTimeout(timer);
        }
        // Live: registry rows from ERC721Enumerable + licenseById + policy
        // views. Failure shows the error state — no silent fixture fallback.
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
        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    const openPapers = (agent: AgentLicense) => {
        setPapersOpener(document.activeElement as HTMLElement);
        setPapersAgent(agent);
    };

    const openRevoke = (agent: AgentLicense) => {
        setRevokeOpener(document.activeElement as HTMLElement);
        setRevokeAgent(agent);
    };

    const handleRevoked = (revokedAgent: AgentLicense) => {
        setAgents(prev => prev.map(a => a.licenseNo === revokedAgent.licenseNo ? { ...a, status: "ghost" } : a));
        // Fallback focus to the Papers button since the Revoke button will be removed from the DOM.
        const papersBtn = papersBtnRefs.current.get(revokedAgent.licenseNo);
        if (papersBtn) {
            setRevokeOpener(papersBtn);
        }
        // Live: the receipt already confirmed the revoke; refresh the rows
        // silently so the table shows chain truth, not a local guess.
        // Ghost-clamp: the public RPC is load-balanced, and a lagging replica
        // can still report the row as licensed for a beat. Revocation is
        // terminal on-chain (status 2, no un-revoke path), so a locally
        // ghosted row must never be resurrected by a stale read.
        if (!isFixtureMode) {
            const seq = ++refetchSeqRef.current;
            fetchRegistry()
                .then((rows) => {
                    if (seq !== refetchSeqRef.current) return; // stale response, drop
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
                    /* row already ghosted locally; next load reconciles */
                });
        }
    };

    // In live mode the revoke ceremony is real: only the license's principal
    // can sign it, so the button only shows for rows the connected wallet owns.
    // Fixture mode keeps the ungated S02 ceremony as demo insurance.
    const canRevoke = (agent: AgentLicense) =>
        agent.status !== "ghost" &&
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
                <h1 className="co-page-title font-display">Agent Registry</h1>
                <p className="co-page-desc">Licensed agents operating on the GIWA network. Revocation is one block.</p>
            </div>

            <div className="co-table-wrap">
                <table className="co-table">
                    <thead>
                        <tr>
                            <th className="co-th">Agent</th>
                            <th className="co-th">Address</th>
                            <th className="co-th">License Nº</th>
                            <th className="co-th">Cap/Day</th>
                            <th className="co-th">Venues</th>
                            <th className="co-th">Expiry</th>
                            <th className="co-th">Status</th>
                            <th className="co-th"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && Array.from({ length: 6 }).map((_, i) => (
                            <tr key={i} className="co-tr">
                                <td className="co-td"><div className="co-skel" style={{ width: 120, height: 16 }} /></td>
                                <td className="co-td"><div className="co-skel" style={{ width: 100, height: 16 }} /></td>
                                <td className="co-td"><div className="co-skel" style={{ width: 80, height: 16 }} /></td>
                                <td className="co-td"><div className="co-skel" style={{ width: 60, height: 16 }} /></td>
                                <td className="co-td"><div className="co-skel" style={{ width: 140, height: 16 }} /></td>
                                <td className="co-td"><div className="co-skel" style={{ width: 100, height: 16 }} /></td>
                                <td className="co-td"><div className="co-skel" style={{ width: 80, height: 16 }} /></td>
                                <td className="co-td"><div className="co-skel" style={{ width: 100, height: 16 }} /></td>
                            </tr>
                        ))}

                        {!loading && error && (
                            <tr>
                                <td colSpan={8}>
                                    <div className="co-empty">
                                        <div className="co-empty-msg" style={{ color: "var(--vermillion)" }}>Ledger Unreachable</div>
                                        <p className="co-page-desc" style={{ margin: "0 auto" }}>The chain is not responding. Check your connection.</p>
                                        <button className="co-action-btn co-retry-btn" onClick={() => setReloadKey(k => k + 1)}>
                                            Retry
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )}

                        {!loading && !error && agents.length === 0 && (
                            <tr>
                                <td colSpan={8}>
                                    <div className="co-empty">
                                        <div className="co-empty-msg">The ledger is empty.</div>
                                        <p className="co-page-desc" style={{ margin: "0 auto" }}>No agents have been licensed on this network yet.</p>
                                    </div>
                                </td>
                            </tr>
                        )}

                        {!loading && !error && agents.map((agent, i) => (
                            <motion.tr 
                                key={agent.licenseNo} 
                                className={`co-tr ${agent.status === 'ghost' ? 'is-ghost' : ''}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05, duration: 0.3 }}
                            >
                                <td className="co-td" style={{ fontWeight: 500 }}>{agent.name}</td>
                                <td className="co-td co-address">{formatAddress(agent.address)}</td>
                                <td className="co-td font-mono">{agent.licenseNo}</td>
                                <td className="co-td font-mono">${agent.capPerDay.toLocaleString()}</td>
                                <td className="co-td">{agent.venues.length > 0 ? agent.venues.join(", ") : "—"}</td>
                                <td className="co-td font-mono">{agent.expiry.split(" · ")[0]}</td>
                                <td className="co-td">
                                    <span className={`co-status ${agent.status}`}>
                                        <span className="co-status-dot" aria-hidden />
                                        {agent.status}
                                    </span>
                                </td>
                                <td className="co-td">
                                    <div className="co-actions">
                                        <button 
                                            ref={el => {
                                                if (el) papersBtnRefs.current.set(agent.licenseNo, el);
                                                else papersBtnRefs.current.delete(agent.licenseNo);
                                            }}
                                            className="co-action-btn" 
                                            onClick={() => openPapers(agent)}
                                        >
                                            Papers
                                        </button>
                                        {canRevoke(agent) && (
                                            <button className="co-action-btn is-revoke" onClick={() => openRevoke(agent)}>Revoke</button>
                                        )}
                                    </div>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* key={licenseNo} is load-bearing: without it, AnimatePresence recycles an
                EXITING modal instance (props frozen at the old agent) when another row's
                modal opens inside the exit window — stale content for the wrong agent. */}
            <AnimatePresence>
                {papersAgent && (
                    <PapersModal key={papersAgent.licenseNo} agent={papersAgent} opener={papersOpener} onClose={() => setPapersAgent(null)} />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {revokeAgent && (
                    <RevokeModal key={revokeAgent.licenseNo} agent={revokeAgent} opener={revokeOpener} onClose={() => setRevokeAgent(null)} onRevoked={handleRevoked} />
                )}
            </AnimatePresence>
        </motion.div>
    );
}
