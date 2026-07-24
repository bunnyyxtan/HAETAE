import { motion } from "framer-motion";
import { useModal } from "./useModal";
import { useSettings, updateSettings } from "../utils/settings";

interface SettingsModalProps {
    opener: HTMLElement | null;
    onClose: () => void;
    onDisconnect: () => void;
    hasAddress: boolean;
}

export default function SettingsModal({ opener, onClose, onDisconnect, hasAddress }: SettingsModalProps) {
    const handleRequestClose = () => {
        onClose();
    };

    const { dialogRef, requestClose } = useModal(handleRequestClose, opener);
    const settings = useSettings();

    const handleDisconnect = () => {
        // Disconnect shares the single close-intent path: teardown
        // (stack, locks, focus) happens NOW, not at deferred unmount.
        requestClose();
        onDisconnect();
    };

    return (
        <div className="co-modal-overlay" onClick={(e) => {
            if (e.target === e.currentTarget) requestClose();
        }}>
            <motion.div 
                ref={dialogRef}
                tabIndex={-1}
                className="co-modal"
                style={{ maxWidth: 400 }}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
                role="dialog"
                aria-modal="true"
                aria-label="Settings"
            >
                <div className="co-modal-header">
                    <h2 className="co-modal-title">Settings</h2>
                    <button className="co-modal-close" onClick={requestClose} aria-label="Close">×</button>
                </div>
                
                <div className="co-modal-body" style={{ padding: "32px 24px" }}>
                    <div style={{ marginBottom: 32, padding: "16px 20px", background: "var(--ivory-2)", border: "1px solid var(--paper-line)" }}>
                        <div className="co-papers-label" style={{ marginBottom: 4 }}>Network</div>
                        <div className="co-papers-value font-mono">GIWA · chain 91342</div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontWeight: 500, fontSize: 15 }}>Reduced Motion</div>
                                <div style={{ fontSize: 13, color: "var(--stone)" }}>Override system animation preference</div>
                            </div>
                            <select 
                                value={settings.motionOverride}
                                onChange={(e) => updateSettings({ motionOverride: e.target.value as any })}
                                style={{
                                    padding: "6px 12px",
                                    background: "var(--bone)",
                                    border: "1px solid var(--paper-line)",
                                    borderRadius: 4,
                                    fontFamily: "Manrope, sans-serif",
                                    fontSize: 13,
                                    outline: "none",
                                    cursor: "pointer",
                                    color: "var(--ink)"
                                }}
                            >
                                <option value="system">System Default</option>
                                <option value="reduce">Reduce Motion</option>
                                <option value="allow">Allow Motion</option>
                            </select>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontWeight: 500, fontSize: 15 }}>Sound Effects</div>
                                <div style={{ fontSize: 13, color: "var(--stone)" }}>Ceremony feedback sounds</div>
                            </div>
                            <button 
                                onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                                style={{
                                    width: 44,
                                    height: 24,
                                    background: settings.soundEnabled ? "var(--jade)" : "var(--stone)",
                                    borderRadius: 12,
                                    border: "none",
                                    position: "relative",
                                    cursor: "pointer",
                                    transition: "background var(--t-base) var(--ease)"
                                }}
                                aria-label="Toggle sound effects"
                                role="switch"
                                aria-checked={settings.soundEnabled}
                            >
                                <span style={{
                                    position: "absolute",
                                    top: 2,
                                    left: settings.soundEnabled ? 22 : 2,
                                    width: 20,
                                    height: 20,
                                    background: "var(--ivory)",
                                    borderRadius: "50%",
                                    transition: "left var(--t-base) var(--ease)",
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
                                }} />
                            </button>
                        </div>
                    </div>

                    {hasAddress && (
                        <div style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid var(--paper-line)" }}>
                            <button 
                                onClick={handleDisconnect}
                                className="btn-ghost"
                                style={{ width: "100%", justifyContent: "center", color: "var(--vermillion)", borderColor: "var(--vermillion)" }}
                            >
                                Disconnect Wallet
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}