import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export default function Origin() {
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"],
    });
    const parallax = useTransform(scrollYProgress, [0, 1], [80, -80]);
    const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0.5]);

    return (
        <section
            id="origin"
            className="origin-full"
            ref={ref}
            data-testid="section-origin"
        >
            <div className="origin-head">
                <span className="chapter-num">06 · Origin</span>
                <div className="rule" />
                <span className="meta">Joseon · palace gates</span>
            </div>

            {/* Full-bleed monument */}
            <div className="origin-monument">
                <motion.span
                    className="hangul-mono font-display"
                    aria-label="Haetae — Korean guardian beast"
                    data-testid="origin-hangul"
                    style={{ y: parallax, opacity }}
                >
                    해태
                </motion.span>

                {/* Bottom-left prose block */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
                    className="origin-prose"
                >
                    <h2
                        className="font-display origin-h"
                        data-testid="origin-headline"
                    >
                        A beast
                        <br />
                        <em className="origin-em">that could tell.</em>
                    </h2>
                    <p className="origin-p">
                        Joseon-era guardians. Palace gates. The Haetae knew the
                        guilty from the innocent — and only let one through.
                    </p>
                    <p className="origin-p origin-p--italic">
                        We built ours in Solidity.
                    </p>
                </motion.div>

                {/* Bottom-right footnote */}
                <div className="origin-footnote">
                    <span className="caps">Etymology</span>
                    <span className="origin-foot-text">
                        해태 · hae · tae
                        <br />
                        <span style={{ color: "var(--stone)" }}>
                            n. Korean unicorn-lion. Judge of hearts.
                        </span>
                    </span>
                </div>
            </div>
        </section>
    );
}
