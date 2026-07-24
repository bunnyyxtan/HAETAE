import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const CHAPTERS = [
    { id: "top", n: "00" },
    { id: "wound", n: "01" },
    { id: "seal", n: "02" },
    { id: "rail", n: "03" },
    { id: "ceremony", n: "04" },
    { id: "standard", n: "05" },
    { id: "origin", n: "06" },
];

export default function SideRail() {
    const [active, setActive] = useState("top");
    const [block, setBlock] = useState(8412004);
    const [tick, setTick] = useState(0);

    // "chain heartbeat" — increments a block every ~1s
    useEffect(() => {
        const id = setInterval(() => {
            setBlock((b) => b + 1);
            setTick((t) => t + 1);
        }, 1000);
        return () => clearInterval(id);
    }, []);

    // observe sections
    useEffect(() => {
        const obs = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) setActive(e.target.id);
                });
            },
            { rootMargin: "-40% 0px -55% 0px", threshold: 0 },
        );
        CHAPTERS.forEach((c) => {
            const el = document.getElementById(c.id);
            if (el) obs.observe(el);
        });
        return () => obs.disconnect();
    }, []);

    const jump = (id: string) => (e: { preventDefault: () => void }) => {
        e.preventDefault();
        const el = document.getElementById(id);
        if (!el) return;
        if (window.__lenis) window.__lenis.scrollTo(el, { offset: -40 });
        else el.scrollIntoView({ behavior: "smooth" });
    };

    return (
        <aside className="side-rail" aria-label="Chapter navigation" data-testid="side-rail">
            {/* chain heartbeat */}
            <div className="rail-heart" data-testid="rail-heartbeat">
                <motion.span
                    key={tick}
                    className="rail-heart-dot"
                    initial={{ scale: 0.6, opacity: 0.35 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
                />
                <span className="rail-heart-label">
                    <span className="rail-heart-block">{block.toLocaleString()}</span>
                    <span className="rail-heart-sub">block · GIWA</span>
                </span>
            </div>

            {/* chapter dots */}
            <ol className="rail-list">
                {CHAPTERS.map((c) => (
                    <li key={c.id}>
                        <a
                            href={`#${c.id}`}
                            onClick={jump(c.id)}
                            className={`rail-item ${active === c.id ? "is-active" : ""}`}
                            data-testid={`rail-item-${c.n}`}
                            aria-current={active === c.id ? "true" : undefined}
                        >
                            <span className="rail-num">{c.n}</span>
                            <span className="rail-tick" />
                        </a>
                    </li>
                ))}
            </ol>
        </aside>
    );
}
