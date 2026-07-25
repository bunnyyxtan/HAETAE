import { motion } from "framer-motion";
import { navigateToConsole, getConsolePath } from "../../utils/path";

// 06 · The Walk — the first-time user's path through the console, condensed
// from DEMO.md and the gate-walk brief. Five steps, one line each, plus the
// wallet-free /verify page and the integrator pointer. No walls of text.
const STEPS = [
    {
        n: "1",
        title: "Verify",
        line: "Prove you're human once — click Get Verified and the testnet desk seals an attestation to your wallet. Stands in for Upbit Dojang KYC.",
        where: "the console asks before your first mint",
    },
    {
        n: "2",
        title: "License",
        line: "Registry → License an Agent: agent address, term, scope. One signature — the license seals soulbound to you.",
        where: "Registry · License an Agent",
    },
    {
        n: "3",
        title: "Policy",
        line: "Set the daily cap and allowed venues. Tighten them mid-day without touching the license.",
        where: "Registry · Policy, on your agent's row",
    },
    {
        n: "4",
        title: "Trade",
        line: "The Gate walks license → scope → venue → cap in-line at every trade. Refusals are public.",
        where: "watch it in the Ledger",
    },
    {
        n: "5",
        title: "Revoke",
        line: "Hold the dial. One block — about a second — and the agent is a ghost, forever.",
        where: "Registry · Revoke, on your agent's row",
    },
];

export default function Walk() {
    return (
        <section id="walk" data-testid="section-walk" style={{ padding: "120px var(--gx) 80px var(--gx-l)" }}>
            <div className="origin-head" style={{ marginBottom: 48 }}>
                <span className="chapter-num">06 · The Walk</span>
                <div className="rule" />
                <span className="meta">first time here — five steps</span>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 28,
                }}
            >
                {STEPS.map((s, i) => (
                    <motion.div
                        key={s.n}
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.3 }}
                        transition={{ delay: i * 0.08, duration: 0.5 }}
                        data-testid={`walk-step-${s.n}`}
                    >
                        <div
                            className="font-mono"
                            style={{ color: "var(--vermillion)", fontSize: 12, letterSpacing: "0.12em" }}
                        >
                            {s.n} · {s.title.toUpperCase()}
                        </div>
                        <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.55, color: "var(--ink)" }}>{s.line}</p>
                        <div className="meta" style={{ marginTop: 8, color: "var(--stone)" }}>
                            {s.where}
                        </div>
                    </motion.div>
                ))}
            </div>

            <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.6 }}
                style={{ marginTop: 44, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}
            >
                <a
                    href={getConsolePath()}
                    onClick={(e) => {
                        e.preventDefault();
                        navigateToConsole();
                    }}
                    className="btn-primary"
                    data-testid="walk-cta-console"
                    style={{ textDecoration: "none" }}
                >
                    Start the walk <span aria-hidden>→</span>
                </a>
                <span className="meta" style={{ color: "var(--stone)" }}>
                    Anyone can check any agent, wallet-free: <span className="font-mono">/verify/&lt;agent&gt;</span>
                </span>
            </motion.div>

            {/* For integrators — the guide exists; point at it. */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.6 }}
                data-testid="walk-integrators"
                style={{
                    marginTop: 64,
                    paddingTop: 32,
                    borderTop: "1px solid rgba(26,24,21,0.12)",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: 28,
                    alignItems: "start",
                }}
            >
                <div>
                    <span className="caps" style={{ color: "var(--vermillion)" }}>
                        For integrators
                    </span>
                    <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.55, color: "var(--ink)", maxWidth: 420 }}>
                        Put any vault or executor behind the checkpoint with one
                        external call. The verdict list is closed: any revert
                        means no.
                    </p>
                    <a
                        href="https://github.com/bunnyyxtan/HAETAE/blob/main/standard/integrator-guide.md"
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost"
                        data-testid="walk-cta-integrators"
                        style={{ textDecoration: "none", marginTop: 14, display: "inline-flex" }}
                    >
                        Read the integrator guide ↗
                    </a>
                </div>
                <div>
                    <pre
                        className="font-mono"
                        style={{
                            margin: 0,
                            padding: "16px 18px",
                            fontSize: 12,
                            lineHeight: 1.7,
                            background: "rgba(26,24,21,0.04)",
                            border: "1px solid rgba(26,24,21,0.1)",
                            overflowX: "auto",
                        }}
                    >{`gate.check(msg.sender, venue, token, amount);
IERC20(token).safeTransfer(venue, amount);
// no code between check and transfer`}</pre>
                    <div className="meta" style={{ marginTop: 10, color: "var(--stone)" }}>
                        HaetaeGate · GIWA Sepolia ·{" "}
                        <span className="font-mono">0x82345FC0…dc48EF</span>
                        {" · "}HaetaeLicense{" "}
                        <span className="font-mono">0x7409E7Dc…0773f8</span>
                    </div>
                </div>
            </motion.div>
        </section>
    );
}
