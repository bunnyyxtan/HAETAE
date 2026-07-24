import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AgentLicense, formatAddress } from "./fixtures";
import { isFixtureMode } from "../chain/mode";
import { explorerTx } from "../chain/deployment";
import { fetchCourtRecord, type CourtEvent } from "../chain/reads";
import { useModal } from "./useModal";

interface PapersModalProps {
    agent: AgentLicense;
    opener: HTMLElement | null;
    onClose: () => void;
}

// Shared verdict palette — the Ledger view renders the same event kinds.
// Vermillion stays reserved for refusals and sentinel verdicts (design law);
// a completed revocation reads as ash: the row is dead, not alarming.
export const kindColor: Record<CourtEvent["kind"], string> = {
    licensed: "var(--jade)",
    executed: "var(--jade)",
    refused: "var(--vermillion)",
    verdict: "var(--vermillion)",
    revoked: "var(--ash)",
};

export default function PapersModal({ agent, opener, onClose }: PapersModalProps) {
    const { dialogRef, requestClose } = useModal(onClose, opener);

    // Court record: the agent's full on-chain verdict history from event logs
    // (Licensed/Revoked/SentinelVerdict/TradeExecuted/TradeRefused). Live only.
    const [court, setCourt] = useState<CourtEvent[] | null>(null);
    const [courtError, setCourtError] = useState(false);

    useEffect(() => {
        if (isFixtureMode) return;
        let cancelled = false;
        fetchCourtRecord(agent.address)
            .then((events) => {
                if (!cancelled) setCourt(events);
            })
            .catch(() => {
                if (!cancelled) setCourtError(true);
            });
        return () => {
            cancelled = true;
        };
    }, [agent.address]);

    return (
        <div className="co-modal-overlay" onClick={(e) => {
            if (e.target === e.currentTarget) requestClose();
        }}>
            <motion.div 
                ref={dialogRef}
                tabIndex={-1}
                className="co-modal"
                style={{ maxWidth: 540, maxHeight: "88vh", overflowY: "auto" }}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
                role="dialog"
                aria-modal="true"
            >
                <div className="co-modal-header">
                    <h2 className="co-modal-title">License Record</h2>
                    <button className="co-modal-close" onClick={requestClose} aria-label="Close">×</button>
                </div>
                <div className="co-modal-body co-papers">
                    <div className="co-papers-seal">
                        <div className={`co-papers-seal-mark ${agent.status === 'ghost' ? 'ghost' : ''}`}>
                            해태
                        </div>
                    </div>
                    
                    <div className="co-papers-grid">
                        <div className="co-papers-field">
                            <div className="co-papers-label">Agent Name</div>
                            <div className="co-papers-value">{agent.name}</div>
                        </div>
                        <div className="co-papers-field">
                            <div className="co-papers-label">License Nº</div>
                            <div className="co-papers-value mono">{agent.licenseNo}</div>
                        </div>
                        <div className="co-papers-field" style={{ gridColumn: "1 / -1" }}>
                            <div className="co-papers-label">On-chain Address</div>
                            <div className="co-papers-value mono">{agent.address}</div>
                        </div>
                        {agent.principal && (
                            <div className="co-papers-field" style={{ gridColumn: "1 / -1" }}>
                                <div className="co-papers-label">Principal</div>
                                <div className="co-papers-value mono">{agent.principal}</div>
                            </div>
                        )}
                        <div className="co-papers-field">
                            <div className="co-papers-label">Cap per Day</div>
                            <div className="co-papers-value mono">${agent.capPerDay.toLocaleString()} USDC</div>
                        </div>
                        <div className="co-papers-field">
                            <div className="co-papers-label">Allowed Venues</div>
                            <div className="co-papers-value">{agent.venues.length > 0 ? agent.venues.join(", ") : "—"}</div>
                        </div>
                        <div className="co-papers-field">
                            <div className="co-papers-label">{agent.expiryUnix ? "Expiry" : "Expiry Block"}</div>
                            <div className="co-papers-value mono">{agent.expiry}</div>
                        </div>
                        <div className="co-papers-field">
                            <div className="co-papers-label">Issued Block</div>
                            <div className="co-papers-value mono">#{agent.issuedBlock.toLocaleString()}</div>
                        </div>
                        {agent.scope && (
                            <div className="co-papers-field">
                                <div className="co-papers-label">Scope</div>
                                <div className="co-papers-value mono">{agent.scope}</div>
                            </div>
                        )}
                        <div className="co-papers-field">
                            <div className="co-papers-label">Current Status</div>
                            <div className="co-papers-value" style={{ color: agent.status === 'ghost' ? 'var(--ash)' : 'var(--jade)', textTransform: 'capitalize' }}>
                                {agent.status}
                            </div>
                        </div>
                    </div>

                    {!isFixtureMode && (
                        <div className="co-court">
                            <div className="co-papers-label" style={{ marginBottom: 10 }}>Court Record</div>
                            {courtError && (
                                <div className="co-court-empty" style={{ color: "var(--vermillion)" }}>
                                    Record unavailable — the chain is not responding.
                                </div>
                            )}
                            {!courtError && court === null && (
                                <div className="co-skel" style={{ width: "100%", height: 14 }} />
                            )}
                            {!courtError && court !== null && court.length === 0 && (
                                <div className="co-court-empty">No verdicts on record.</div>
                            )}
                            {!courtError && court !== null && court.map((ev, i) => (
                                <div className="co-court-row" key={`${ev.txHash}-${ev.logIndex}-${i}`}>
                                    <span className="co-court-kind font-mono" style={{ color: kindColor[ev.kind] }}>
                                        {ev.label}
                                    </span>
                                    <span className="co-court-detail">{ev.detail}</span>
                                    <a
                                        className="co-tx-link font-mono"
                                        href={explorerTx(ev.txHash)}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        #{ev.block.toLocaleString()} ↗
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
