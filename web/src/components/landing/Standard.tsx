import { motion } from "framer-motion";

export default function Standard() {
    return (
        <section id="standard" className="section" data-testid="section-standard">
            <div className="chapter-head">
                <span className="chapter-num">05 · The Standard</span>
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
                    maxWidth: 900,
                    marginBottom: 24,
                    fontWeight: 400,
                }}
                data-testid="standard-headline"
            >
                A shape{" "}
                <em
                    style={{
                        fontStyle: "italic",
                        color: "var(--vermillion)",
                        fontVariationSettings: "'opsz' 144, 'SOFT' 100, 'WONK' 1",
                    }}
                >
                    anyone can implement.
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
                    marginBottom: 56,
                }}
            >
                Two methods. One truth. Draft — open for review.
            </motion.p>

            <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
                data-testid="standard-code"
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        marginBottom: 16,
                    }}
                >
                    <span className="meta">EIP-DRAFT · IAgentLicense.sol</span>
                    <span className="meta">Solidity ≥ 0.8.20</span>
                </div>
                <pre className="code">
{`// SPDX-License-Identifier: MIT
`}<span className="kw">interface</span>{` `}<span className="fn">IAgentLicense</span>{` {
    `}<span className="cm">/// @notice checked inside ERC-4337 validation, before a tx is born</span>{`
    `}<span className="kw">function</span>{` `}<span className="fn">isLicensed</span>{`(
        `}<span className="ty">address</span>{` agent,
        `}<span className="ty">address</span>{` target,
        `}<span className="ty">bytes4</span>{`   selector,
        `}<span className="ty">uint256</span>{`  value
    ) `}<span className="kw">external view returns</span>{` (`}<span className="ty">bool</span>{`);

    `}<span className="cm">/// @notice one signed call by the guardian. one block. one second.</span>{`
    `}<span className="kw">function</span>{` `}<span className="fn">revoke</span>{`(`}<span className="ty">address</span>{` agent, `}<span className="ty">bytes32</span>{` reason) `}<span className="kw">external</span>{`;

    `}<span className="kw">event</span>{` `}<span className="fn">Sealed</span>{`(`}<span className="ty">address</span>{` indexed agent, `}<span className="ty">address</span>{` indexed owner);
    `}<span className="kw">event</span>{` `}<span className="fn">Ghost</span>{` (`}<span className="ty">address</span>{` indexed agent, `}<span className="ty">bytes32</span>{` reason);
}`}
                </pre>
                <div
                    style={{
                        marginTop: 20,
                        display: "flex",
                        gap: 12,
                        flexWrap: "wrap",
                    }}
                >
                    <a
                        href="#top"
                        onClick={(e) => e.preventDefault()}
                        className="btn-ghost"
                        data-testid="standard-cta-read"
                        style={{ textDecoration: "none" }}
                    >
                        Read the full draft
                    </a>
                    <a
                        href="#top"
                        onClick={(e) => e.preventDefault()}
                        className="btn-ghost"
                        data-testid="standard-cta-implement"
                        style={{ textDecoration: "none", opacity: 0.55 }}
                    >
                        View reference impl. →
                    </a>
                </div>
            </motion.div>
        </section>
    );
}
