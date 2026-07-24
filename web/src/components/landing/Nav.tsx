import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { navigateToConsole, getConsolePath } from "../../utils/path";

export default function Nav() {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 12);
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const goTo = (id: string) => (e: { preventDefault: () => void }) => {
        e.preventDefault();
        const el = document.getElementById(id);
        if (!el) return;
        if (window.__lenis) {
            window.__lenis.scrollTo(el, { offset: -80 });
        } else {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    return (
        <motion.nav
            className={`nav-bar ${scrolled ? "scrolled" : ""}`}
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
            data-testid="nav-bar"
        >
            <a
                href="#top"
                onClick={goTo("top")}
                data-testid="nav-logo"
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    textDecoration: "none",
                    color: "var(--ink)",
                }}
            >
                <span
                    className="font-display"
                    style={{
                        color: "var(--vermillion)",
                        fontSize: 22,
                        lineHeight: 1,
                        fontWeight: 500,
                    }}
                >
                    해태
                </span>
                <span
                    style={{
                        fontFamily: "Manrope",
                        fontWeight: 600,
                        letterSpacing: "0.14em",
                        fontSize: 13,
                        textTransform: "uppercase",
                    }}
                >
                    Haetae
                </span>
            </a>
            <div className="nav-links">
                <a href="#wound" onClick={goTo("wound")} data-testid="nav-wound">01 · Wound</a>
                <a href="#seal" onClick={goTo("seal")} data-testid="nav-seal">02 · Seal</a>
                <a href="#rail" onClick={goTo("rail")} data-testid="nav-rail">03 · Rail</a>
                <a href="#ceremony" onClick={goTo("ceremony")} data-testid="nav-ceremony">04 · Ceremony</a>
                <a href="#standard" onClick={goTo("standard")} data-testid="nav-standard">05 · Standard</a>
            </div>
            <a
                href={getConsolePath()}
                onClick={(e) => {
                    e.preventDefault();
                    navigateToConsole();
                }}
                className="btn-primary"
                data-testid="nav-cta"
                style={{ padding: "10px 18px", minHeight: 40, fontSize: 13, textDecoration: "none" }}
            >
                Open Console
                <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>→</span>
            </a>
        </motion.nav>
    );
}
