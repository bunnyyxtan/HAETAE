import { motion } from "framer-motion";

const nodes = [
    { k: "01", t: "UserOp", d: "agent signs an intent" },
    { k: "02", t: "validateUserOp()", d: "before the tx is born" },
    { k: "03", t: "isLicensed?", d: "the rail asks the seal", accent: true },
    { k: "04", t: "execute", d: "if yes — mempool" },
    { k: "05", t: "void", d: "if no — never created" },
];

export default function Rail() {
    return (
        <section id="rail" className="section" data-testid="section-rail">
            <div className="chapter-head">
                <span className="chapter-num">03 · The Rail</span>
                <div className="rule" />
            </div>

            <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
                className="font-display"
                style={{
                    fontSize: "clamp(40px, 6.4vw, 88px)",
                    lineHeight: 0.95,
                    letterSpacing: "-0.03em",
                    maxWidth: 960,
                    marginBottom: 24,
                    fontWeight: 400,
                }}
                data-testid="rail-headline"
            >
                Checked{" "}
                <em
                    style={{
                        fontStyle: "italic",
                        color: "var(--vermillion)",
                        fontVariationSettings: "'opsz' 144, 'SOFT' 100, 'WONK' 1",
                    }}
                >
                    before it is born.
                </em>
            </motion.h2>

            <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15, duration: 0.6 }}
                style={{
                    maxWidth: 620,
                    color: "var(--ink-2)",
                    fontSize: 17,
                    marginBottom: 72,
                }}
            >
                The license check lives inside ERC-4337 validation. An unlicensed
                action isn&apos;t reverted. It never enters the mempool.
            </motion.p>

            <div className="rail-track">
                <div className="track" />
                <div className="rail-nodes">
                    {nodes.map((n, i) => (
                        <motion.div
                            key={n.k}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.4 }}
                            transition={{
                                duration: 0.5,
                                delay: 0.15 + i * 0.09,
                                ease: [0.2, 0.7, 0.2, 1],
                            }}
                            className="rail-node"
                            data-testid={`rail-node-${n.k}`}
                        >
                            <div
                                className={`rail-dot ${n.accent ? "active" : ""}`}
                            />
                            <div className="meta" style={{ letterSpacing: "0.14em" }}>
                                {n.k}
                            </div>
                            <div
                                className="font-display"
                                style={{
                                    fontSize: 22,
                                    lineHeight: 1.1,
                                    color: n.accent
                                        ? "var(--vermillion)"
                                        : "var(--ink)",
                                    fontStyle: n.accent ? "italic" : "normal",
                                    fontVariationSettings: n.accent
                                        ? "'opsz' 96, 'SOFT' 100, 'WONK' 1"
                                        : "'opsz' 96",
                                }}
                            >
                                {n.t}
                            </div>
                            <div
                                style={{
                                    fontSize: 13,
                                    color: "var(--stone)",
                                    maxWidth: 180,
                                }}
                            >
                                {n.d}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6, duration: 0.6 }}
                style={{
                    marginTop: 72,
                    fontFamily: "Fraunces",
                    fontStyle: "italic",
                    fontSize: "clamp(20px, 2.6vw, 30px)",
                    color: "var(--ink)",
                    maxWidth: 720,
                    letterSpacing: "-0.01em",
                }}
                data-testid="rail-verdict"
            >
                Guardrails in a prompt are hope.{" "}
                <span style={{ color: "var(--vermillion)" }}>
                    Guardrails in validation are law.
                </span>
            </motion.p>
        </section>
    );
}
