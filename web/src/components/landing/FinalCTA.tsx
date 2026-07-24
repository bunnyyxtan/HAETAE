import { motion } from "framer-motion";

export default function FinalCTA() {
    return (
        <section className="cta-final" data-testid="section-cta">
            <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.6 }}
            >
                <span className="chapter-num">Coda</span>
            </motion.div>

            <motion.h2
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
                data-testid="cta-headline"
                style={{ marginTop: 24 }}
            >
                Give your agents a seal.{" "}
                <span className="em">Take back the leash.</span>
            </motion.h2>

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: 0.15, duration: 0.6 }}
                style={{ display: "flex", flexWrap: "wrap", gap: 14 }}
            >
                <a
                    href="#ceremony"
                    onClick={(e) => {
                        e.preventDefault();
                        const t = document.getElementById("ceremony");
                        if (window.__lenis && t)
                            window.__lenis.scrollTo(t, { offset: -60 });
                        else t?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="btn-primary"
                    data-testid="cta-console"
                    style={{ textDecoration: "none" }}
                >
                    Open the Console
                    <span aria-hidden>→</span>
                </a>
                <a
                    href="#standard"
                    onClick={(e) => {
                        e.preventDefault();
                        const t = document.getElementById("standard");
                        if (window.__lenis && t)
                            window.__lenis.scrollTo(t, { offset: -60 });
                        else t?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="btn-ghost"
                    data-testid="cta-standard"
                    style={{ textDecoration: "none" }}
                >
                    Read the Standard
                </a>
            </motion.div>
        </section>
    );
}
