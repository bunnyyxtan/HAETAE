import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";

export default function Hero() {
    const stageRef = useRef<HTMLDivElement | null>(null);
    const [spot, setSpot] = useState({ x: 0.5, y: 0.5 });
    const [stamped, setStamped] = useState(false);
    const [blockNo, setBlockNo] = useState(8412004);

    const { scrollY } = useScroll();
    const yShift = useTransform(scrollY, [0, 800], [0, -80]);
    const rotShift = useTransform(scrollY, [0, 800], [0, 4]);
    const numeralY = useTransform(scrollY, [0, 600], [0, -140]);

    // stamp on-load
    useEffect(() => {
        const t = setTimeout(() => setStamped(true), 480);
        return () => clearTimeout(t);
    }, []);

    // live block ticker
    useEffect(() => {
        const id = setInterval(() => setBlockNo((n) => n + 1), 1000);
        return () => clearInterval(id);
    }, []);

    // cursor parallax (2.5D)
    useEffect(() => {
        const el = stageRef.current;
        if (!el) return;
        let raf = 0;
        const onMove = (e: MouseEvent) => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const r = el.getBoundingClientRect();
                const x = (e.clientX - r.left) / r.width;
                const y = (e.clientY - r.top) / r.height;
                setSpot({ x, y });
            });
        };
        const onLeave = () => setSpot({ x: 0.5, y: 0.5 });
        el.addEventListener("mousemove", onMove);
        el.addEventListener("mouseleave", onLeave);
        return () => {
            el.removeEventListener("mousemove", onMove);
            el.removeEventListener("mouseleave", onLeave);
            cancelAnimationFrame(raf);
        };
    }, []);

    // tilt values from spot (2.5D)
    const tiltX = (0.5 - spot.y) * 12;
    const tiltY = (spot.x - 0.5) * 14;
    const shift = { x: (spot.x - 0.5) * 22, y: (spot.y - 0.5) * 22 };

    const goto = (id: string) => (e: { preventDefault: () => void }) => {
        e.preventDefault();
        const el = document.getElementById(id);
        if (!el) return;
        if (window.__lenis) window.__lenis.scrollTo(el, { offset: -40 });
        else el.scrollIntoView({ behavior: "smooth" });
    };

    return (
        <section id="top" className="hero" data-testid="hero">
            {/* GIANT FOLIO NUMERAL — sits behind, editorial folio mark */}
            <motion.span
                className="hero-numeral font-display"
                aria-hidden
                style={{ y: numeralY }}
            >
                00
            </motion.span>

            {/* Left column */}
            <div className="hero-copy">
                <motion.div
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
                    className="hero-eyebrow"
                    data-testid="hero-eyebrow"
                >
                    <span className="hero-eyebrow-hair" />
                    <span className="meta">Manifesto · Chapter 00</span>
                </motion.div>

                <h1 className="hero-headline" data-testid="hero-headline">
                    <span className="line-mask">
                        <span className="line-inner" style={{ animationDelay: "60ms" }}>
                            The chain
                        </span>
                    </span>
                    <span className="line-mask hero-line-2">
                        <span className="line-inner" style={{ animationDelay: "180ms" }}>
                            does not
                        </span>
                    </span>
                    <span className="line-mask hero-line-3">
                        <span className="line-inner italic" style={{ animationDelay: "320ms" }}>
                            care.
                        </span>
                    </span>
                </h1>

                <motion.p
                    className="hero-sub"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.85, duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
                    data-testid="hero-sub"
                >
                    A <em style={{ fontStyle: "italic", color: "var(--vermillion)" }}>trust
                    rail</em> for the AI agent economy. Every agent carries a
                    license, sealed to a human. Break the rules — the guardian
                    revokes it. One block.
                </motion.p>

                {/* Live ticker replaces static meta */}
                <motion.div
                    className="hero-ticker"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.05, duration: 0.5 }}
                    data-testid="hero-ticker"
                >
                    <span className="hero-ticker-dot" aria-hidden />
                    <div className="hero-ticker-cols">
                        <div>
                            <div className="hero-ticker-k">GIWA · L2</div>
                            <div className="hero-ticker-v">chainId 91342</div>
                        </div>
                        <div>
                            <div className="hero-ticker-k">Block</div>
                            <AnimatePresence mode="popLayout">
                                <motion.div
                                    key={blockNo}
                                    className="hero-ticker-v"
                                    initial={{ y: 6, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: -6, opacity: 0 }}
                                    transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
                                >
                                    #{blockNo.toLocaleString()}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                        <div>
                            <div className="hero-ticker-k">Tempo</div>
                            <div className="hero-ticker-v">~1.00s</div>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    className="hero-actions"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2, duration: 0.5 }}
                >
                    <a
                        href="#ceremony"
                        onClick={goto("ceremony")}
                        className="btn-primary"
                        data-testid="hero-cta-console"
                        style={{ textDecoration: "none" }}
                    >
                        Open the Console
                        <span aria-hidden>→</span>
                    </a>
                    <a
                        href="#standard"
                        onClick={goto("standard")}
                        className="btn-ghost"
                        data-testid="hero-cta-standard"
                        style={{ textDecoration: "none" }}
                    >
                        Read the Standard
                    </a>
                </motion.div>
            </div>

            {/* Right: stage */}
            <div className="hero-stage" ref={stageRef} data-testid="hero-stage">
                {/* Cursor spotlight */}
                <div
                    className="spot"
                    style={{
                        transform: `translate(calc(${spot.x * 100}% - 190px), calc(${spot.y * 100}% - 190px))`,
                    }}
                    aria-hidden
                />

                {/* Faint grid ticks */}
                <svg
                    aria-hidden
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        opacity: 0.16,
                        color: "var(--stone)",
                    }}
                >
                    <defs>
                        <pattern id="tick" width="46" height="46" patternUnits="userSpaceOnUse">
                            <path d="M0 0h1v1H0z" fill="currentColor" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#tick)" />
                </svg>

                {/* the stamp ceremony — drop-and-set */}
                <div
                    className="hero-seal-wrap"
                    style={{
                        transform: `perspective(1200px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
                    }}
                >
                    <motion.div
                        className="seal hero-seal"
                        initial={{ y: -60, scale: 1.12, opacity: 0 }}
                        animate={
                            stamped
                                ? { y: 0, scale: 1, opacity: 1 }
                                : { y: -60, scale: 1.12, opacity: 0 }
                        }
                        transition={{
                            duration: 0.5,
                            ease: [0.4, 0, 0.2, 1],
                            times: [0, 1],
                        }}
                        style={{
                            y: yShift,
                            rotate: rotShift,
                            transformOrigin: "center center",
                        }}
                        data-testid="hero-seal"
                    >
                        {/* faint stamp splash on impact */}
                        <motion.span
                            className="stamp-splash"
                            initial={{ scale: 0.4, opacity: 0 }}
                            animate={stamped ? { scale: 1.9, opacity: 0 } : {}}
                            transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1], delay: 0.02 }}
                            aria-hidden
                        />
                        <span
                            className="font-display"
                            style={{
                                fontSize: "1em",
                                lineHeight: 1,
                                transform: `translate(${shift.x * 0.35}px, ${shift.y * 0.35 - 6}px)`,
                                transition: "transform 320ms var(--ease)",
                            }}
                        >
                            해태
                        </span>

                        {/* circular running text */}
                        <svg
                            style={{
                                position: "absolute",
                                inset: -2,
                                width: "calc(100% + 4px)",
                                height: "calc(100% + 4px)",
                                pointerEvents: "none",
                            }}
                            viewBox="0 0 400 400"
                        >
                            <defs>
                                <path
                                    id="cir"
                                    d="M 200,200 m -170,0 a 170,170 0 1,1 340,0 a 170,170 0 1,1 -340,0"
                                />
                            </defs>
                            <text
                                fill="rgba(244,239,230,0.55)"
                                fontFamily="JetBrains Mono, monospace"
                                fontSize="13"
                                letterSpacing="6"
                            >
                                <textPath href="#cir">
                                    LICENSE · SEALED · GUARDIAN · WATCHES · LICENSE · SEALED · GUARDIAN · WATCHES ·
                                </textPath>
                            </text>
                        </svg>
                    </motion.div>
                </div>

                {/* fig. label bottom-left */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.3, duration: 0.6 }}
                    className="hero-fig"
                >
                    <span className="caps">Fig. 00</span>
                    <span className="hero-fig-note">the guardian&apos;s mark</span>
                </motion.div>

                {/* bottom-right coordinates */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.4, duration: 0.6 }}
                    className="hero-coords"
                    aria-hidden
                >
                    <span>N 37.5665°</span>
                    <span>E 126.9780°</span>
                    <span>Seoul · draft · 2026</span>
                </motion.div>
            </div>

            {/* scroll hint */}
            <motion.div
                className="hero-scroll"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5, duration: 0.6 }}
                aria-hidden
                data-testid="hero-scroll-hint"
            >
                <span className="hero-scroll-label">scroll</span>
                <span className="hero-scroll-line" />
            </motion.div>
        </section>
    );
}
