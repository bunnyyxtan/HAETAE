import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useModal } from "./useModal";
import { AgentLicense } from "./fixtures";
import { isFixtureMode } from "../chain/mode";
import { explorerTx } from "../chain/deployment";
import { sendRevoke, waitRevoke, walletErrorMessage } from "../chain/wallet";
import { useSettings } from "@/utils/settings";

const HOLD_MS = 900;

// armed → holding (hold gesture) → [live: wallet → pending] → ghost | failed.
// Reduced motion swaps the hold for a two-step confirm. Fixture mode skips the
// wallet/pending states and ghosts instantly after the gesture (S02 behavior).
type Phase = "armed" | "holding" | "confirm" | "wallet" | "pending" | "ghost" | "failed";

interface RevokeModalProps {
    agent: AgentLicense;
    opener: HTMLElement | null;
    onClose: () => void;
    onRevoked: (agent: AgentLicense) => void;
}

export default function RevokeModal({ agent, opener, onClose, onRevoked }: RevokeModalProps) {
    const settings = useSettings();
    const resolvedMotionRef = useRef(settings.resolvedMotion);
    resolvedMotionRef.current = settings.resolvedMotion;

    const [phase, setPhase] = useState<Phase>("armed");
    const phaseRef = useRef(phase);
    phaseRef.current = phase;
    if (import.meta.env.DEV) {
        // Dev-only observability for test harnesses (same precedent as __scrollSlots).
        (window as unknown as { __revokePhase?: string }).__revokePhase = phase;
    }

    const [progress, setProgress] = useState(0);
    const [blockMs, setBlockMs] = useState(0);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [failMsg, setFailMsg] = useState<string | null>(null);
    const holdRef = useRef<{ raf: number | null; start: number }>({ raf: null, start: 0 });
    const pendingRef = useRef<{ raf: number | null; start: number }>({ raf: null, start: 0 });
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);
    // Keyup latch for the reduced-motion two-step: the keydown that ARMS confirm
    // must be followed by a real keyup before any keydown can COMMIT. Encodes
    // "a real second press" directly — robust even if e.repeat is unreliable,
    // and a continuously held key (down…repeat…up) can never commit.
    const confirmKeyUpLatchRef = useRef(true);

    const clearTimers = () => {
        if (holdRef.current.raf !== null) {
            cancelAnimationFrame(holdRef.current.raf);
            holdRef.current.raf = null;
        }
        if (pendingRef.current.raf !== null) {
            cancelAnimationFrame(pendingRef.current.raf);
            pendingRef.current.raf = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const handleRequestClose = () => {
        // A transaction in flight owns the modal: closing mid-signature or
        // mid-confirmation would orphan the ceremony from its verdict.
        if (phaseRef.current === "wallet" || phaseRef.current === "pending") return;
        clearTimers();
        onClose();
    };

    const { dialogRef, requestClose } = useModal(handleRequestClose, opener);

    const setPhaseSync = (p: Phase) => {
        // Sync ref transition: a racing second activation (same-frame double-tap)
        // must see the new phase via the idempotent check before React re-renders.
        phaseRef.current = p;
        setPhase(p);
    };

    const finishGhost = () => {
        setPhaseSync("ghost");
        setProgress(1);
        onRevoked(agent); // Mutates row, switches opener, fires aria-live
        timeoutRef.current = setTimeout(() => {
            timeoutRef.current = null;
            requestClose();
        }, 2000); // 2 second pause before closing
    };

    const fail = (msg: string) => {
        if (!mountedRef.current) return;
        setPhaseSync("failed");
        setFailMsg(msg);
        setProgress(0);
        setBlockMs(0);
    };

    const startPendingMeter = () => {
        pendingRef.current.start = performance.now();
        const step = (now: number) => {
            if (!mountedRef.current) return;
            setBlockMs(Math.round(now - pendingRef.current.start));
            pendingRef.current.raf = requestAnimationFrame(step);
        };
        pendingRef.current.raf = requestAnimationFrame(step);
    };

    const stopPendingMeter = () => {
        if (pendingRef.current.raf !== null) {
            cancelAnimationFrame(pendingRef.current.raf);
            pendingRef.current.raf = null;
        }
    };

    // The live path: pending during confirmation, verdict on receipt. On the
    // 1s GIWA cadence the payoff is genuine — the meter counts real elapsed ms.
    const runLiveRevoke = async () => {
        setPhaseSync("wallet");
        setFailMsg(null);
        try {
            const hash = await sendRevoke(agent.address);
            if (!mountedRef.current) return;
            setTxHash(hash);
            setPhaseSync("pending");
            startPendingMeter();
            const ok = await waitRevoke(hash);
            stopPendingMeter();
            if (!mountedRef.current) return;
            if (ok) {
                setBlockMs(Math.round(performance.now() - pendingRef.current.start));
                finishGhost();
            } else {
                fail("Transaction reverted on-chain.");
            }
        } catch (err) {
            stopPendingMeter();
            fail(walletErrorMessage(err));
        }
    };

    const commitRevoke = () => {
        if (isFixtureMode) {
            setBlockMs(984);
            finishGhost();
            return;
        }
        void runLiveRevoke();
    };

    const startHold = (e?: React.SyntheticEvent | Event) => {
        const currentPhase = phaseRef.current;
        // Idempotent guards: gestures are ignored while holding, while a tx is
        // in flight, and after the verdict. "failed" re-arms via this press.
        if (currentPhase === "ghost" || currentPhase === "holding" || currentPhase === "wallet" || currentPhase === "pending") return;
        if (e?.preventDefault) e.preventDefault();
        if (currentPhase === "failed") setFailMsg(null);

        if (resolvedMotionRef.current === "reduce") {
            if (currentPhase === "armed" || currentPhase === "failed") {
                setPhaseSync("confirm"); // sync — fast double-tap must not double-arm
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                // Auto-revert window: generous on purpose. Screen-reader users need
                // time to hear the confirm announcement and act (WCAG 2.2.1);
                // Escape/close already provide the hard reset path.
                timeoutRef.current = setTimeout(() => {
                    timeoutRef.current = null;
                    if (phaseRef.current === "confirm") {
                        setPhaseSync("armed");
                    }
                }, 30000);
                return;
            } else if (currentPhase === "confirm") {
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                setProgress(1);
                commitRevoke();
                return;
            }
        }

        if (currentPhase === "confirm") return; // Should not happen in allow-motion unless changed midway, but handled

        setPhaseSync("holding"); // sync — pointer+key mixed input must see holding immediately
        holdRef.current.start = performance.now();
        const step = (now: number) => {
            const t = Math.min(1, (now - holdRef.current.start) / HOLD_MS);
            setProgress(t);
            setBlockMs(Math.round(t * (isFixtureMode ? 984 : HOLD_MS)));
            if (t < 1) {
                holdRef.current.raf = requestAnimationFrame(step);
            } else {
                holdRef.current.raf = null;
                commitRevoke();
            }
        };
        holdRef.current.raf = requestAnimationFrame(step);
    };

    const endHold = () => {
        if (phaseRef.current !== "holding") return;
        if (holdRef.current.raf !== null) {
            cancelAnimationFrame(holdRef.current.raf);
            holdRef.current.raf = null;
        }
        setPhaseSync("armed"); // sync — immediate re-press after early release must re-arm
        setProgress(0);
        setBlockMs(0);
    };

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            clearTimers();
        };
    }, []);

    // Keyboard support for space or enter on the button
    useEffect(() => {
        const kd = (e: KeyboardEvent) => {
            if (e.repeat) return; // Ignore hold-repeat events (fast path; latch below is the guarantee)
            const currentPhase = phaseRef.current;
            if ((e.code === "Space" || e.code === "Enter") && (currentPhase === "armed" || currentPhase === "confirm" || currentPhase === "failed")) {
                const active = document.activeElement;
                if (active && active.classList.contains("dial-btn")) {
                    if (e.code === "Space") e.preventDefault();
                    if (resolvedMotionRef.current === "reduce") {
                        // Commit keydown only counts after a real keyup since the arming keydown.
                        if (currentPhase === "confirm" && !confirmKeyUpLatchRef.current) return;
                        if (currentPhase === "armed" || currentPhase === "failed") confirmKeyUpLatchRef.current = false;
                    }
                    startHold();
                }
            }
        };
        const ku = (e: KeyboardEvent) => {
            if (e.code === "Space" || e.code === "Enter") {
                confirmKeyUpLatchRef.current = true;
                endHold();
            }
        };
        window.addEventListener("keydown", kd);
        window.addEventListener("keyup", ku);
        return () => {
            window.removeEventListener("keydown", kd);
            window.removeEventListener("keyup", ku);
        };
    }, []);

    const R = 118;
    const C = 2 * Math.PI * R;
    const offset = C * (1 - progress);
    const isReduce = settings.resolvedMotion === "reduce";
    const ghosted = phase === "ghost";
    const holding = phase === "holding";
    const confirmed = phase === "confirm";
    const awaitingWallet = phase === "wallet";
    const pending = phase === "pending";
    const failed = phase === "failed";
    const txLocked = awaitingWallet || pending;

    const ariaLabel = ghosted
        ? "License revoked"
        : txLocked
            ? "Revocation transaction in progress"
            : failed
                ? "Revocation failed, press to retry"
                : isReduce
                    ? (confirmed ? "Press again to confirm revocation" : "Press to revoke license")
                    : "Press and hold to revoke license";

    const dialLabel = ghosted
        ? "Revoked"
        : awaitingWallet
            ? "Sign…"
            : pending
                ? "Pending"
                : failed
                    ? "Retry"
                    : holding
                        ? "Hold…"
                        : confirmed
                            ? "Confirm"
                            : "Revoke";

    const statusLine = ghosted
        ? "License Revoked"
        : awaitingWallet
            ? "Awaiting wallet signature…"
            : pending
                ? "Confirming on GIWA…"
                : failed
                    ? failMsg ?? "Failed."
                    : holding
                        ? (isFixtureMode ? "Signing Transaction..." : "Arming…")
                        : confirmed
                            ? "Press again to revoke"
                            : isReduce
                                ? "Press space or click button"
                                : "Hold space or press button";

    const meterLabel = isFixtureMode ? "signing" : txLocked || ghosted ? "confirmation" : "arming";
    const meterValue = isFixtureMode
        ? (ghosted ? "984 / 984 ms" : `${blockMs.toString().padStart(3, "0")} / 984 ms`)
        : awaitingWallet
            ? "…"
            : pending || ghosted
                ? `${blockMs.toLocaleString()} ms`
                : holding
                    ? `${blockMs.toString().padStart(3, "0")} / ${HOLD_MS} ms`
                    : "—";

    return (
        <div className="co-modal-overlay" onClick={(e) => {
            if (e.target === e.currentTarget && !ghosted && !txLocked) requestClose();
        }}>
            <motion.div
                ref={dialogRef}
                tabIndex={-1}
                className="co-modal co-revoke-modal"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
                role="dialog"
                aria-modal="true"
                aria-live="polite"
            >
                <div className="co-modal-header" style={{ borderBottom: "none", paddingBottom: 0 }}>
                    <h2 className="co-modal-title" style={{ color: "var(--vermillion)" }}>Revoke License</h2>
                    {!ghosted && !txLocked && (
                        <button className="co-modal-close" onClick={requestClose} aria-label="Close">×</button>
                    )}
                </div>

                <div className="co-modal-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16 }}>
                    <div style={{ textAlign: "center", marginBottom: 32 }}>
                        <div className="co-papers-label">Agent</div>
                        <div className="co-papers-value" style={{ fontSize: 18 }}>{agent.name}</div>
                        <div className="co-papers-value mono" style={{ color: "var(--stone)", marginTop: 4 }}>{agent.licenseNo}</div>
                    </div>

                    <div className="dial" style={{ margin: "0 auto", transform: "scale(0.85)" }}>
                        <svg viewBox="0 0 260 260" className="dial-svg" aria-hidden>
                            <circle cx="130" cy="130" r={R} fill="none" stroke="rgba(244,239,230,0.14)" strokeWidth="2" />
                            <circle cx="130" cy="130" r={R - 12} fill="none" stroke="rgba(244,239,230,0.06)" strokeWidth="1" />
                            <circle
                                className="hold-ring"
                                cx="130"
                                cy="130"
                                r={R}
                                fill="none"
                                stroke="var(--vermillion)"
                                strokeWidth="2"
                                strokeDasharray={C}
                                strokeDashoffset={offset}
                                strokeLinecap="round"
                                style={{ transform: "rotate(-90deg)", transformOrigin: "130px 130px", transition: ghosted ? "none" : "stroke-dashoffset 60ms linear", opacity: txLocked ? 0.85 : 1 }}
                            />
                        </svg>

                        <button
                            className={`dial-btn ${ghosted ? "ghosted" : ""}`}
                            onMouseDown={startHold}
                            onMouseUp={endHold}
                            onMouseLeave={endHold}
                            onTouchStart={startHold}
                            onTouchEnd={endHold}
                            onTouchCancel={endHold}
                            onPointerCancel={endHold}
                            onPointerLeave={endHold}
                            disabled={ghosted || txLocked}
                            aria-label={ariaLabel}
                            style={{ 
                                background: ghosted ? "var(--ash)" : "transparent",
                                color: ghosted ? "var(--ivory)" : "var(--vermillion)",
                                opacity: txLocked ? 0.75 : 1
                            }}
                        >
                            <span className="dial-btn-inner" style={{ fontSize: 18, fontWeight: 500, fontFamily: "Manrope, sans-serif" }}>
                                {dialLabel}
                            </span>
                        </button>
                    </div>

                    <div className="dial-meter" style={{ marginTop: 24, width: 220 }}>
                        <div className="dial-meter-row" style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                            <span className="meta" style={{ color: "var(--stone-2)" }}>{meterLabel}</span>
                            <span className="font-mono" style={{ color: "var(--ink)", fontSize: 12 }}>
                                {meterValue}
                            </span>
                        </div>
                        <div className="dial-meter-bar" style={{ height: 2, background: "var(--paper-line)", width: "100%", position: "relative" }}>
                            <span
                                className="dial-meter-fill"
                                style={{
                                    position: "absolute", left: 0, top: 0, bottom: 0,
                                    background: "var(--vermillion)",
                                    width: `${(ghosted || txLocked ? 1 : progress) * 100}%`,
                                    transition: ghosted ? "none" : "width 60ms linear"
                                }}
                            />
                        </div>
                    </div>

                    {txHash && (pending || ghosted) && (
                        <a
                            className="co-tx-link font-mono"
                            href={explorerTx(txHash)}
                            target="_blank"
                            rel="noreferrer"
                            style={{ marginTop: 14 }}
                        >
                            tx {txHash.slice(0, 10)}…{txHash.slice(-6)} ↗
                        </a>
                    )}

                    <div style={{ marginTop: txHash && (pending || ghosted) ? 12 : 24, height: 24, textAlign: "center", color: ghosted ? "var(--vermillion)" : failed ? "var(--vermillion)" : "var(--stone)", fontFamily: "JetBrains Mono, monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                        {statusLine}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
