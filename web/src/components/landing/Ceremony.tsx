import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const HOLD_MS = 900;

type Ash = {
    id: number;
    angle: number;
    dist: number;
    size: number;
    delay: number;
};

export default function Ceremony() {
    const [phase, setPhase] = useState("armed"); // armed → holding → ghost
    const [progress, setProgress] = useState(0);
    const [blockMs, setBlockMs] = useState(0);
    const [ashes, setAshes] = useState<Ash[]>([]);
    const [ripples, setRipples] = useState<{ id: number }[]>([]);
    const [cursorInside, setCursorInside] = useState(false);
    const [cursor, setCursor] = useState({ x: 0, y: 0 });
    const dialWrapRef = useRef<HTMLDivElement | null>(null);
    const holdRef = useRef<{ raf: number | null; start: number }>({ raf: null, start: 0 });
    const finalMsRef = useRef(984);

    // Track cursor for custom hold-cursor label
    useEffect(() => {
        const el = dialWrapRef.current;
        if (!el) return;
        const onMove = (e: MouseEvent) => {
            const r = el.getBoundingClientRect();
            setCursor({ x: e.clientX - r.left, y: e.clientY - r.top });
        };
        const onEnter = () => setCursorInside(true);
        const onLeave = () => setCursorInside(false);
        el.addEventListener("mousemove", onMove);
        el.addEventListener("mouseenter", onEnter);
        el.addEventListener("mouseleave", onLeave);
        return () => {
            el.removeEventListener("mousemove", onMove);
            el.removeEventListener("mouseenter", onEnter);
            el.removeEventListener("mouseleave", onLeave);
        };
    }, []);

    const startHold = (e?: { preventDefault?: () => void }) => {
        if (phase === "ghost") return;
        if (e?.preventDefault) e.preventDefault();
        setPhase("holding");
        holdRef.current.start = performance.now();
        const step = (now: number) => {
            const t = Math.min(1, (now - holdRef.current.start) / HOLD_MS);
            setProgress(t);
            setBlockMs(Math.round(t * 984));
            if (t < 1) {
                holdRef.current.raf = requestAnimationFrame(step);
            } else {
                finalMsRef.current = 984;
                fireRevoke();
            }
        };
        holdRef.current.raf = requestAnimationFrame(step);
    };

    const endHold = () => {
        if (phase !== "holding") return;
        if (holdRef.current.raf !== null) {
            cancelAnimationFrame(holdRef.current.raf);
        }
        setPhase("armed");
        setProgress(0);
        setBlockMs(0);
    };

    const fireRevoke = () => {
        setPhase("ghost");
        // spawn shockwave rings
        const now = Date.now();
        setRipples([{ id: now }, { id: now + 1 }, { id: now + 2 }]);
        // spawn ash particles
        const bits = Array.from({ length: 18 }).map((_, i) => ({
            id: now + 10 + i,
            angle: (Math.PI * 2 * i) / 18 + Math.random() * 0.4,
            dist: 90 + Math.random() * 90,
            size: 2 + Math.random() * 3,
            delay: Math.random() * 0.12,
        }));
        setAshes(bits);
    };

    const restore = () => {
        setPhase("armed");
        setProgress(0);
        setBlockMs(0);
        setAshes([]);
        setRipples([]);
    };

    useEffect(() => {
        const ref = holdRef.current;
        return () => {
            if (ref.raf !== null) cancelAnimationFrame(ref.raf);
        };
    }, []);

    // keyboard: Space to hold when dial is focused
    useEffect(() => {
        const kd = (e: KeyboardEvent) => {
            if (
                e.code === "Space" &&
                (document.activeElement as HTMLElement | null)?.dataset?.testid === "ceremony-dial"
            ) {
                e.preventDefault();
                if (phase === "armed") startHold();
            }
        };
        const ku = (e: KeyboardEvent) => {
            if (e.code === "Space") endHold();
        };
        window.addEventListener("keydown", kd);
        window.addEventListener("keyup", ku);
        return () => {
            window.removeEventListener("keydown", kd);
            window.removeEventListener("keyup", ku);
        };
    }, [phase]);

    const R = 118;
    const C = 2 * Math.PI * R;
    const offset = C * (1 - progress);
    const ghosted = phase === "ghost";
    const holding = phase === "holding";

    return (
        <section id="ceremony" className="ceremony section-full" data-testid="section-ceremony">
            {/* atmospheric dust — 40 slow motes */}
            <div className="ceremony-dust" aria-hidden>
                {Array.from({ length: 40 }).map((_, i) => (
                    <span
                        key={i}
                        className="dust"
                        style={{
                            left: `${(i * 137) % 100}%`,
                            top: `${(i * 43) % 100}%`,
                            animationDelay: `${(i % 12) * 0.6}s`,
                            animationDuration: `${8 + (i % 6)}s`,
                        }}
                    />
                ))}
            </div>

            <div className="ceremony-inner">
                <div className="chapter-head" style={{ marginBottom: 24 }}>
                    <span className="chapter-num" style={{ color: "var(--stone-2)" }}>
                        04 · The Ceremony
                    </span>
                    <div className="rule" style={{ background: "rgba(244,239,230,0.16)" }} />
                    <span className="meta" style={{ color: "var(--stone-2)" }}>
                        press · hold · release
                    </span>
                </div>

                <h2 className="ceremony-headline" data-testid="ceremony-headline">
                    When the agent goes rogue,{" "}
                    <span className="em">the guardian answers.</span>
                </h2>

                <p className="ceremony-sub">
                    Press &amp; hold the guardian. Revocation is one signed call —
                    one block, one second. Then the agent still speaks. The
                    chain no longer listens.
                </p>

                <div className="ceremony-grid">
                    {/* Left: the dial */}
                    <div className="ceremony-left" ref={dialWrapRef}>
                        {/* custom hover label */}
                        <AnimatePresence>
                            {cursorInside && !ghosted && !holding && (
                                <motion.span
                                    className="cursor-tag"
                                    style={{
                                        left: cursor.x,
                                        top: cursor.y,
                                    }}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.16 }}
                                    aria-hidden
                                >
                                    hold to revoke
                                </motion.span>
                            )}
                        </AnimatePresence>

                        <div className="dial">
                            {/* concentric bg rings */}
                            <svg
                                viewBox="0 0 260 260"
                                className="dial-svg"
                                aria-hidden
                            >
                                <circle
                                    cx="130"
                                    cy="130"
                                    r={R}
                                    fill="none"
                                    stroke="rgba(244,239,230,0.14)"
                                    strokeWidth="2"
                                />
                                <circle
                                    cx="130"
                                    cy="130"
                                    r={R - 12}
                                    fill="none"
                                    stroke="rgba(244,239,230,0.06)"
                                    strokeWidth="1"
                                />
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
                                    style={{ transform: "rotate(-90deg)", transformOrigin: "130px 130px" }}
                                />
                            </svg>

                            {/* tick marks */}
                            <svg viewBox="0 0 260 260" className="dial-svg" aria-hidden>
                                {Array.from({ length: 48 }).map((_, i) => {
                                    const a = (i / 48) * Math.PI * 2;
                                    const outer = 128;
                                    const inner = i % 6 === 0 ? 118 : 122;
                                    const x1 = 130 + Math.cos(a) * outer;
                                    const y1 = 130 + Math.sin(a) * outer;
                                    const x2 = 130 + Math.cos(a) * inner;
                                    const y2 = 130 + Math.sin(a) * inner;
                                    return (
                                        <line
                                            key={i}
                                            x1={x1}
                                            y1={y1}
                                            x2={x2}
                                            y2={y2}
                                            stroke="rgba(244,239,230,0.3)"
                                            strokeWidth="1"
                                        />
                                    );
                                })}
                                {/* 12/3/6/9 labels */}
                                {[
                                    { a: -Math.PI / 2, l: "N" },
                                    { a: 0, l: "E" },
                                    { a: Math.PI / 2, l: "S" },
                                    { a: Math.PI, l: "W" },
                                ].map((p, i) => (
                                    <text
                                        key={i}
                                        x={130 + Math.cos(p.a) * 100}
                                        y={130 + Math.sin(p.a) * 100 + 4}
                                        textAnchor="middle"
                                        fontFamily="JetBrains Mono"
                                        fontSize="9"
                                        fill="rgba(244,239,230,0.35)"
                                        letterSpacing="1"
                                    >
                                        {p.l}
                                    </text>
                                ))}
                            </svg>

                            <button
                                className={`dial-btn ${ghosted ? "ghosted" : ""}`}
                                onMouseDown={startHold}
                                onMouseUp={endHold}
                                onMouseLeave={endHold}
                                onTouchStart={startHold}
                                onTouchEnd={endHold}
                                onTouchCancel={endHold}
                                disabled={ghosted}
                                data-testid="ceremony-dial"
                                aria-label="Press and hold to revoke license"
                            >
                                <span className="dial-btn-inner">
                                    {ghosted ? "Ghost" : holding ? "Hold…" : "Revoke"}
                                </span>
                            </button>
                        </div>

                        <div className="dial-meter">
                            <div className="dial-meter-row">
                                <span className="meta" style={{ color: "var(--stone-2)" }}>
                                    signing
                                </span>
                                <span
                                    className="font-mono"
                                    style={{
                                        color: "var(--ivory)",
                                        fontSize: 12,
                                    }}
                                >
                                    {ghosted
                                        ? `984 / 984 ms`
                                        : `${blockMs.toString().padStart(3, "0")} / 984 ms`}
                                </span>
                            </div>
                            <div className="dial-meter-bar">
                                <span
                                    className="dial-meter-fill"
                                    style={{
                                        width: `${(ghosted ? 1 : progress) * 100}%`,
                                    }}
                                />
                            </div>
                        </div>

                        <AnimatePresence mode="wait">
                            {phase !== "ghost" ? (
                                <motion.div
                                    key="hint"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="meta"
                                    style={{ color: "var(--stone-2)" }}
                                >
                                    ceremony · 0.9s · space also works
                                </motion.div>
                            ) : (
                                <motion.button
                                    key="restore"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.4 }}
                                    className="restore-btn"
                                    onClick={restore}
                                    data-testid="ceremony-restore"
                                >
                                    <span aria-hidden>↺</span> Restore seal
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Right: seal + verdict */}
                    <div className="ceremony-right">
                        <div className="seal-stage">
                            {/* shockwave rings */}
                            <AnimatePresence>
                                {ripples.map((r, i) => (
                                    <motion.span
                                        key={r.id}
                                        className="shockwave"
                                        initial={{ scale: 0.6, opacity: 0.55 }}
                                        animate={{ scale: 2.6, opacity: 0 }}
                                        exit={{ opacity: 0 }}
                                        transition={{
                                            duration: 1.4,
                                            delay: i * 0.16,
                                            ease: [0.2, 0.7, 0.2, 1],
                                        }}
                                        aria-hidden
                                    />
                                ))}
                            </AnimatePresence>

                            {/* ash particles */}
                            <AnimatePresence>
                                {ashes.map((a) => (
                                    <motion.span
                                        key={a.id}
                                        className="ash"
                                        style={{
                                            width: a.size,
                                            height: a.size,
                                        }}
                                        initial={{ x: 0, y: 0, opacity: 0.85, scale: 1 }}
                                        animate={{
                                            x: Math.cos(a.angle) * a.dist,
                                            y: Math.sin(a.angle) * a.dist - 24,
                                            opacity: 0,
                                            scale: 0.4,
                                        }}
                                        transition={{
                                            duration: 1.4 + Math.random() * 0.5,
                                            delay: a.delay,
                                            ease: [0.2, 0.7, 0.2, 1],
                                        }}
                                        aria-hidden
                                    />
                                ))}
                            </AnimatePresence>

                            <motion.div
                                animate={
                                    holding
                                        ? {
                                              x: [-1, 1, -1, 1, 0],
                                              transition: { duration: 0.16, repeat: Infinity },
                                          }
                                        : { x: 0 }
                                }
                                style={{ position: "relative" }}
                            >
                                <div
                                    className={`seal ${ghosted ? "seal-ghost seal-crack" : ""}`}
                                    style={{
                                        width: 220,
                                        height: 220,
                                        fontSize: 92,
                                    }}
                                    data-testid="ceremony-seal"
                                >
                                    <span className="font-display">해태</span>
                                </div>
                            </motion.div>
                        </div>

                        <div className="verdict">
                            <div className="verdict-label caps" style={{ color: "var(--stone-2)" }}>
                                Status
                            </div>
                            <div className="verdict-value" data-testid="ceremony-status">
                                {ghosted ? (
                                    <>
                                        <motion.em
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.5, delay: 0.05 }}
                                            className="verdict-em"
                                        >
                                            Ghost.
                                        </motion.em>{" "}
                                        <motion.span
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.5, delay: 0.22 }}
                                        >
                                            Speaks.
                                        </motion.span>{" "}
                                        <motion.span
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.5, delay: 0.42 }}
                                        >
                                            Unheard.
                                        </motion.span>
                                    </>
                                ) : (
                                    <>
                                        <span style={{ color: "var(--jade)" }}>●</span>{" "}
                                        Licensed · Listening
                                    </>
                                )}
                            </div>
                            <div
                                className="meta"
                                style={{ color: "var(--stone-2)" }}
                                data-testid="ceremony-metric"
                            >
                                {phase === "ghost"
                                    ? `revoked in 1 block · ${finalMsRef.current}ms`
                                    : holding
                                      ? `signing · ${blockMs}ms elapsed`
                                      : "chain listens · block 8,412,004"}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
