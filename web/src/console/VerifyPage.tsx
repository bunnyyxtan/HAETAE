import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getAddress, isAddress } from "viem";
import "../console.css";
import { isFixtureMode } from "../chain/mode";
import { fetchVerifyReport } from "../chain/reads";
import { explorerAddr } from "../chain/deployment";
import { agentFixtures, flags, formatAddress, ledgerFixtures } from "./fixtures";
import { kindColor } from "./PapersModal";
import { useCopy } from "./useCopy";
import {
    getVerifyPath,
    navigateToConsole,
    navigateToLanding,
    navigateToVerify,
    parseVerifyAgent,
} from "../utils/path";

// The wallet-free public answer to the standard's question: was this agent
// allowed, and which human answers for it? (PRD F10.)

type Verdict = "licensed" | "expired" | "revoked" | "unlicensed" | "invalid";

interface HistRow {
    kind: "licensed" | "revoked" | "verdict" | "executed" | "refused";
    label: string;
    detail: string;
    block: number;
    txHash: string | null;
}

interface ViewModel {
    verdict: Verdict;
    name: string | null;
    licenseNo: string | null;
    principal: string | null;
    expiryLabel: string | null;
    scope: string | null;
    policy: { capPerDay: number; remainingToday: number; spentToday: number; venues: { name: string; allowed: boolean }[] } | null;
    history: HistRow[];
}

const VERDICT_TEXT: Record<Verdict, { word: string; sub: string }> = {
    licensed: { word: "LICENSED", sub: "Active license · isLicensed() answers true on GIWA Sepolia." },
    expired: { word: "EXPIRED", sub: "Record still Active, but expiry has passed — isLicensed() answers false." },
    revoked: { word: "REVOKED", sub: "License revoked — one-way, effective the block it was called." },
    unlicensed: { word: "NOT LICENSED", sub: "No license record for this address on GIWA Sepolia." },
    invalid: { word: "INVALID ADDRESS", sub: "That is not a valid EVM address." },
};

const verdictColor = (v: Verdict): string =>
    v === "licensed"
        ? kindColor.licensed
        : v === "revoked"
          ? kindColor.revoked
          : v === "invalid"
            ? "var(--vermillion)"
            : "var(--stone)";

const isViolation = (k: HistRow["kind"]) => k === "refused" || k === "verdict" || k === "revoked";

export default function VerifyPage() {
    const [agent, setAgent] = useState(() => parseVerifyAgent(window.location.pathname));
    const [view, setView] = useState<ViewModel | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [checkInput, setCheckInput] = useState("");
    const [checkErr, setCheckErr] = useState(false);
    const { copied, copy } = useCopy();

    // Back/Forward across verify URLs stays inside this page (App's router
    // early-returns on same-route transitions) — re-parse here.
    useEffect(() => {
        const onPop = () => setAgent(parseVerifyAgent(window.location.pathname));
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, []);

    useEffect(() => {
        const prev = document.title;
        document.title = `Verify ${isAddress(agent) ? formatAddress(agent) : "agent"} — HAETAE`;
        return () => {
            document.title = prev;
        };
    }, [agent]);

    useEffect(() => {
        setLoading(true);
        setError(false);
        setView(null);

        if (!isAddress(agent)) {
            setView({
                verdict: "invalid",
                name: null,
                licenseNo: null,
                principal: null,
                expiryLabel: null,
                scope: null,
                policy: null,
                history: [],
            });
            setLoading(false);
            return;
        }

        if (isFixtureMode) {
            const timer = setTimeout(() => {
                if (flags.forceError) {
                    setError(true);
                    setLoading(false);
                    return;
                }
                const row = agentFixtures.find(
                    (a) => a.address.toLowerCase() === agent.toLowerCase(),
                );
                if (!row) {
                    setView({
                        verdict: "unlicensed",
                        name: null,
                        licenseNo: null,
                        principal: null,
                        expiryLabel: null,
                        scope: null,
                        policy: null,
                        history: [],
                    });
                } else {
                    setView({
                        verdict: row.status === "ghost" ? "revoked" : "licensed",
                        name: row.name,
                        licenseNo: row.licenseNo,
                        principal: row.principal,
                        expiryLabel: row.expiry.split(" · ")[0],
                        scope: row.scope,
                        policy: {
                            capPerDay: row.capPerDay,
                            remainingToday: row.status === "ghost" ? 0 : row.capPerDay,
                            spentToday: 0,
                            venues: row.venues.map((name) => ({
                                name,
                                allowed: row.status !== "ghost",
                            })),
                        },
                        history: ledgerFixtures
                            .filter((r) => r.agentName === row.name)
                            .map((r) => ({
                                kind: r.kind,
                                label: r.label,
                                detail: r.detail,
                                block: r.block,
                                txHash: r.txHash,
                            })),
                    });
                }
                setLoading(false);
            }, flags.loadDelayMs);
            return () => clearTimeout(timer);
        }

        let cancelled = false;
        fetchVerifyReport(agent)
            .then((report) => {
                if (cancelled) return;
                const s = report.summary;
                const verdict: Verdict =
                    s.statusCode === null
                        ? "unlicensed"
                        : s.statusCode === 2
                          ? "revoked"
                          : s.licensed
                            ? "licensed"
                            : "expired";
                setView({
                    verdict,
                    name: null,
                    licenseNo: report.licenseId !== null ? `HT-${String(report.licenseId).padStart(4, "0")}` : null,
                    principal: s.principal,
                    expiryLabel:
                        s.expiryUnix !== null
                            ? `${new Date(s.expiryUnix * 1000).toISOString().slice(0, 10)} · ${s.expiryUnix}`
                            : null,
                    scope: s.scope,
                    policy: report.policy
                        ? {
                              capPerDay: report.policy.capPerDay,
                              remainingToday: report.policy.remainingToday,
                              spentToday: report.policy.spentToday,
                              venues: report.policy.venues.map((v) => ({ name: v.name, allowed: v.allowed })),
                          }
                        : null,
                    history: report.history.map((ev) => ({
                        kind: ev.kind,
                        label: ev.label,
                        detail: ev.detail,
                        block: ev.block,
                        txHash: ev.txHash,
                    })),
                });
                setLoading(false);
            })
            .catch(() => {
                if (cancelled) return;
                setError(true);
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [agent, reloadKey]);

    const checkAnother = () => {
        const v = checkInput.trim();
        if (!isAddress(v)) {
            setCheckErr(true);
            return;
        }
        setCheckErr(false);
        setCheckInput("");
        navigateToVerify(getAddress(v));
        setAgent(getAddress(v));
    };

    const violations = view ? view.history.filter((h) => isViolation(h.kind)).length : 0;
    const verifyLink = `${window.location.origin}${getVerifyPath(agent)}${window.location.search}`;

    return (
        <div className="co-app co-verify-page" data-testid="verify-page">
            <div className="co-verify-shell">
                <header className="co-verify-top">
                    <button className="co-verify-brand font-display" onClick={() => navigateToLanding()}>
                        HAETAE<span aria-hidden>˚</span>
                    </button>
                    <span className="co-verify-net font-mono">LICENSE VERIFICATION · GIWA · CHAIN 91342</span>
                </header>

                {loading && (
                    <div aria-hidden>
                        <div className="co-skel" style={{ width: "100%", height: 160, marginBottom: 24 }} />
                        <div className="co-skel" style={{ width: "70%", height: 20, marginBottom: 12 }} />
                        <div className="co-skel" style={{ width: "50%", height: 20 }} />
                    </div>
                )}

                {!loading && error && (
                    <div className="co-empty">
                        <div className="co-empty-msg" style={{ color: "var(--vermillion)" }}>Ledger Unreachable</div>
                        <p className="co-page-desc" style={{ margin: "0 auto" }}>
                            The chain is not responding. The verdict cannot be read right now.
                        </p>
                        <button className="co-action-btn co-retry-btn" onClick={() => setReloadKey((k) => k + 1)}>
                            Retry
                        </button>
                    </div>
                )}

                {!loading && !error && view && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                        <section
                            className={`co-verify-banner is-${view.verdict}`}
                            aria-label="Verification verdict"
                        >
                            <div className="co-papers-label">The verdict</div>
                            <h1 className="co-verify-verdict font-display" style={{ color: verdictColor(view.verdict) }}>
                                {VERDICT_TEXT[view.verdict].word}
                            </h1>
                            <p className="co-verify-sub">{VERDICT_TEXT[view.verdict].sub}</p>
                            <div className="co-verify-addr font-mono">
                                {isAddress(agent) ? getAddress(agent) : agent || "(no address)"}
                                {view.name && <span className="co-verify-name"> · {view.name}</span>}
                            </div>
                        </section>

                        {view.verdict !== "invalid" && view.verdict !== "unlicensed" && (
                            <section className="co-verify-section">
                                <div className="co-papers-label">License record</div>
                                <div className="co-verify-grid">
                                    <div className="co-papers-field">
                                        <div className="co-papers-label">License Nº</div>
                                        <div className="co-papers-value mono">{view.licenseNo ?? "—"}</div>
                                    </div>
                                    <div className="co-papers-field">
                                        <div className="co-papers-label">Principal</div>
                                        <div className="co-papers-value mono">
                                            {view.principal ? formatAddress(view.principal) : "—"}
                                        </div>
                                    </div>
                                    <div className="co-papers-field">
                                        <div className="co-papers-label">Expiry</div>
                                        <div className="co-papers-value mono">{view.expiryLabel ?? "—"}</div>
                                    </div>
                                    <div className="co-papers-field">
                                        <div className="co-papers-label">Scope</div>
                                        <div className="co-papers-value mono">{view.scope ?? "—"}</div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {view.policy && (
                            <section className="co-verify-section">
                                <div className="co-papers-label">Policy summary</div>
                                <div className="co-verify-grid">
                                    <div className="co-papers-field">
                                        <div className="co-papers-label">Cap / day</div>
                                        <div className="co-papers-value mono">${view.policy.capPerDay.toLocaleString()} tUSDC</div>
                                    </div>
                                    <div className="co-papers-field">
                                        <div className="co-papers-label">Spent today</div>
                                        <div className="co-papers-value mono">${view.policy.spentToday.toLocaleString()}</div>
                                    </div>
                                    <div className="co-papers-field">
                                        <div className="co-papers-label">Remaining today</div>
                                        <div className="co-papers-value mono">${view.policy.remainingToday.toLocaleString()}</div>
                                    </div>
                                </div>
                                <div className="co-venue-chips">
                                    {view.policy.venues.length === 0 && (
                                        <span className="co-field-hint">No venues on the allowlist.</span>
                                    )}
                                    {view.policy.venues.map((v) => (
                                        <span key={v.name} className={`co-venue-chip ${v.allowed ? "" : "is-off"}`}>
                                            {v.name}
                                        </span>
                                    ))}
                                </div>
                            </section>
                        )}

                        {view.verdict !== "invalid" && (
                            <section className="co-verify-section">
                                <div className="co-papers-label">
                                    Court record
                                    {view.history.length > 0 && (
                                        <span
                                            className="co-verify-violations"
                                            style={violations > 0 ? { color: "var(--vermillion)" } : undefined}
                                        >
                                            {" "}
                                            · {violations === 0 ? "no violations" : `${violations} violation${violations === 1 ? "" : "s"} on record`}
                                        </span>
                                    )}
                                </div>
                                {view.history.length === 0 ? (
                                    <p className="co-field-hint">No events on record for this address.</p>
                                ) : (
                                    <div className="co-ledger-wrap co-verify-hist">
                                        {[...view.history].reverse().map((ev, i) => (
                                            <div
                                                key={`${ev.txHash ?? ev.label}-${ev.block}-${i}`}
                                                className={`co-ledger-row ${isViolation(ev.kind) ? "is-violation" : ""}`}
                                            >
                                                <span className="co-ledger-kind" style={{ color: kindColor[ev.kind] }}>
                                                    {ev.label}
                                                </span>
                                                <span className="co-ledger-detail">{ev.detail}</span>
                                                <span className="co-tx-link font-mono co-ledger-block" style={{ borderBottom: "none" }}>
                                                    #{ev.block.toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}

                        <div className="co-verify-actions">
                            <button
                                className="co-action-btn"
                                onClick={() => copy("link", verifyLink)}
                            >
                                {copied === "link" ? "Copied ✓" : "Copy verification link"}
                            </button>
                            {!isFixtureMode && isAddress(agent) && (
                                <a
                                    className="co-action-btn"
                                    href={explorerAddr(getAddress(agent))}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Explorer ↗
                                </a>
                            )}
                            <button className="co-action-btn" onClick={() => navigateToConsole()}>
                                Open Console
                            </button>
                        </div>

                        <div className="co-verify-check">
                            <input
                                className={`co-input ${checkErr ? "is-invalid" : ""}`}
                                value={checkInput}
                                onChange={(e) => {
                                    setCheckInput(e.target.value);
                                    setCheckErr(false);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") checkAnother();
                                }}
                                placeholder="Check another agent — 0x…"
                                spellCheck={false}
                                aria-label="Check another agent address"
                            />
                            <button className="co-btn-primary" onClick={checkAnother}>
                                Verify
                            </button>
                        </div>
                        {checkErr && <span className="co-field-err">Not a valid EVM address.</span>}
                    </motion.div>
                )}

                <footer className="co-verify-foot font-mono">
                    {isFixtureMode
                        ? "SANDBOX MODE · NO CHAIN TRAFFIC"
                        : "READ-ONLY · NO WALLET REQUIRED · VERDICTS STRAIGHT FROM GIWA SEPOLIA"}
                </footer>
            </div>
        </div>
    );
}
