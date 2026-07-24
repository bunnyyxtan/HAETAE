import { motion } from "framer-motion";

const rise = {
    hidden: { opacity: 0, y: 18 },
    show: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.55, delay: i * 0.09, ease: [0.2, 0.7, 0.2, 1] },
    }),
};

export default function Seal() {
    return (
        <section id="seal" className="section" data-testid="section-seal">
            <div className="chapter-head">
                <span className="chapter-num">02 · The Seal</span>
                <div className="rule" />
            </div>

            <div
                className="two-col"
                style={{ alignItems: "center", gap: "clamp(32px, 5vw, 96px)" }}
            >
                <div>
                    <motion.h2
                        variants={rise}
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, amount: 0.4 }}
                        custom={0}
                        className="font-display"
                        style={{
                            fontSize: "clamp(40px, 6.4vw, 88px)",
                            lineHeight: 0.95,
                            letterSpacing: "-0.03em",
                            fontWeight: 400,
                            margin: 0,
                        }}
                        data-testid="seal-headline"
                    >
                        Every agent{" "}
                        <em
                            style={{
                                fontStyle: "italic",
                                color: "var(--vermillion)",
                                fontVariationSettings:
                                    "'opsz' 144, 'SOFT' 100, 'WONK' 1",
                            }}
                        >
                            wears a seal.
                        </em>
                    </motion.h2>

                    <motion.p
                        variants={rise}
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, amount: 0.4 }}
                        custom={1}
                        style={{
                            marginTop: 32,
                            fontSize: 17,
                            maxWidth: 460,
                            color: "var(--ink-2)",
                        }}
                    >
                        A license, minted on-chain and bound — through Dojang
                        attestation — to one KYC&apos;d human.
                    </motion.p>

                    <motion.ul
                        variants={rise}
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, amount: 0.3 }}
                        custom={2}
                        style={{
                            listStyle: "none",
                            padding: 0,
                            margin: "40px 0 0",
                            display: "grid",
                            gap: 12,
                            maxWidth: 460,
                        }}
                    >
                        {[
                            ["Owner", "one human · attested"],
                            ["Cap", "daily · per-tx · aggregate"],
                            ["Venues", "allowed contracts only"],
                            ["Expiry", "auto-lapse · rotatable"],
                        ].map(([k, v]) => (
                            <li
                                key={k}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    padding: "14px 0",
                                    borderBottom:
                                        "1px solid var(--paper-line)",
                                }}
                            >
                                <span className="caps">{k}</span>
                                <span
                                    style={{
                                        fontFamily: "JetBrains Mono",
                                        fontSize: 13,
                                        color: "var(--ink)",
                                    }}
                                >
                                    {v}
                                </span>
                            </li>
                        ))}
                    </motion.ul>
                </div>

                {/* Right: the license card, editorial */}
                <motion.div
                    variants={rise}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, amount: 0.3 }}
                    custom={3}
                    className="vitrine"
                    style={{
                        position: "relative",
                        padding: "56px 40px",
                        aspectRatio: "5/7",
                        maxWidth: 460,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                    }}
                    data-testid="license-card"
                >
                    {/* corner marks */}
                    {[
                        { top: 12, left: 12 },
                        { top: 12, right: 12 },
                        { bottom: 12, left: 12 },
                        { bottom: 12, right: 12 },
                    ].map((pos, i) => (
                        <span
                            key={i}
                            style={{
                                position: "absolute",
                                width: 14,
                                height: 14,
                                border: "1px solid var(--ink)",
                                ...pos,
                            }}
                        />
                    ))}

                    <div>
                        <div
                            className="caps"
                            style={{ color: "var(--ink)", letterSpacing: "0.24em" }}
                        >
                            IAgentLicense
                        </div>
                        <div
                            className="font-display"
                            style={{
                                fontSize: 38,
                                lineHeight: 1,
                                marginTop: 20,
                                fontStyle: "italic",
                                color: "var(--ink)",
                                fontVariationSettings:
                                    "'opsz' 144, 'SOFT' 80",
                            }}
                        >
                            License № 0x7a9d…c14e
                        </div>
                        <div
                            style={{
                                fontFamily: "JetBrains Mono",
                                fontSize: 11,
                                color: "var(--stone)",
                                marginTop: 6,
                                letterSpacing: "0.08em",
                            }}
                        >
                            issued · block 8,412,004
                        </div>
                    </div>

                    {/* the seal itself */}
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            padding: "20px 0",
                        }}
                    >
                        <div
                            className="seal"
                            style={{ width: 130, height: 130, fontSize: 52 }}
                        >
                            <span className="font-display">해태</span>
                        </div>
                    </div>

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 12,
                            fontFamily: "JetBrains Mono",
                            fontSize: 11,
                            letterSpacing: "0.06em",
                        }}
                    >
                        <div>
                            <div
                                style={{
                                    color: "var(--stone)",
                                    textTransform: "uppercase",
                                    fontSize: 9,
                                    letterSpacing: "0.14em",
                                }}
                            >
                                Cap · daily
                            </div>
                            <div style={{ marginTop: 4 }}>
                                2,500 USDC
                            </div>
                        </div>
                        <div>
                            <div
                                style={{
                                    color: "var(--stone)",
                                    textTransform: "uppercase",
                                    fontSize: 9,
                                    letterSpacing: "0.14em",
                                }}
                            >
                                Expires
                            </div>
                            <div style={{ marginTop: 4 }}>2026-06-01</div>
                        </div>
                        <div>
                            <div
                                style={{
                                    color: "var(--stone)",
                                    textTransform: "uppercase",
                                    fontSize: 9,
                                    letterSpacing: "0.14em",
                                }}
                            >
                                Venues
                            </div>
                            <div style={{ marginTop: 4 }}>
                                3 contracts
                            </div>
                        </div>
                        <div>
                            <div
                                style={{
                                    color: "var(--stone)",
                                    textTransform: "uppercase",
                                    fontSize: 9,
                                    letterSpacing: "0.14em",
                                }}
                            >
                                Owner
                            </div>
                            <div style={{ marginTop: 4 }}>
                                attested · EAS
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
