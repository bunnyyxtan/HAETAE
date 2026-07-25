import { useState } from "react";
import { motion } from "framer-motion";
import { getAddress, isAddress } from "viem";
import { addresses, explorerAddr } from "../chain/deployment";
import { isFixtureMode } from "../chain/mode";
import { fetchLicenseSummary } from "../chain/reads";
import { agentFixtures, flags, formatAddress } from "./fixtures";
import { navigateToVerify } from "../utils/path";
import { useCopy } from "./useCopy";

// The canonical text lives in standard/ERC-agent-license.md — this page is a
// reading surface for it, not a second source of truth. Signatures and laws
// below are transcribed from the draft; edit the draft first, then this page.
const DRAFT_URL = "https://github.com/bunnyyxtan/HAETAE/blob/main/standard/ERC-agent-license.md";

const INTERFACE_TEXT = `enum Status { None, Active, Revoked }

struct License {
    address principal; // human who answers for the agent
    address agent;     // agent address bound by this license
    uint64  expiry;    // isLicensed flips false at expiry
    bytes32 scope;     // opaque tag; semantics caller-defined
    Status  status;    // one-way: Active -> Revoked
}

function isLicensed(address agent) external view returns (bool);
function licenseOf(address agent) external view returns (License memory);
function licenseById(uint256 id) external view returns (License memory);
function revoke(address agent) external;

event Licensed(uint256 indexed licenseId, address indexed principal,
               address indexed agent, uint64 expiry, bytes32 scope);
event Revoked(uint256 indexed licenseId, address indexed agent,
              address indexed revoker);

error NotLicensed();
error NotAuthorized();
error AlreadyLicensed(address agent);
error AlreadyRevoked();`;

const LAWS: { n: string; text: string; red?: boolean }[] = [
    {
        n: "Law 1",
        text: "Revocation takes effect in the block it is called. No timelock, no grace period — the next agent action reverts everywhere.",
        red: true,
    },
    {
        n: "Law 2",
        text: "Revoked is terminal. A revoked id can never return to Active; re-licensing is a new mint with a new id.",
        red: true,
    },
    {
        n: "Law 3",
        text: "Transfers and approvals revert. The license is soulbound to the principal — it cannot be sold or reassigned.",
    },
    {
        n: "Law 4",
        text: "licenseById returns a zero struct for unminted ids and MUST NOT revert. Every verdict stays readable on-chain, forever.",
    },
    {
        n: "Law 5",
        text: "isLicensed is true only while all three hold: a record exists, status is Active, and expiry is ahead of the clock.",
    },
    {
        n: "Law 6",
        text: "Caps, venues, and selectors are policy, not license terms. The policy layer reads isLicensed as a precondition.",
    },
];

// Deployed addresses: adopters wire against these — copyable, explorable.
const CONTRACTS: { name: string; role: string; addr: string }[] = [
    { name: "HaetaeLicense", role: "the license registry (IAgentLicense)", addr: addresses.license },
    { name: "HaetaePolicy", role: "caps + venue allowlists", addr: addresses.policy },
    { name: "HaetaeGate", role: "pre-trade enforcement", addr: addresses.gate },
    { name: "SentinelAuthority", role: "watchdog verdicts", addr: addresses.sentinel },
    { name: "ReferenceVault", role: "reference integration", addr: addresses.vault },
    { name: "TestUSDC", role: "tUSDC test token (6 decimals)", addr: addresses.usdc },
];

const SOLIDITY_SNIPPET = `import {IAgentLicense} from "haetae/interfaces/IAgentLicense.sol";

contract MyVault {
    IAgentLicense constant LICENSE =
        IAgentLicense(${addresses.license});

    error AgentNotLicensed(address agent);

    modifier onlyLicensed(address agent) {
        if (!LICENSE.isLicensed(agent)) revert AgentNotLicensed(agent);
        _;
    }
}`;

const TS_SNIPPET = `import { isLicensed, getPolicy, watchAgent, decodeHaetaeError } from "@haetae/sdk";

// 1 · gate the action
if (!(await isLicensed(agent))) throw new Error("agent is not licensed");

// 2 · respect the policy layer
const policy = await getPolicy(agent); // caps, venues, remaining today

// 3 · halt the moment the license dies
const stop = watchAgent(agent, (ev) => {
    if (ev.kind === "revoked") halt(agent);
});

// 4 · typed errors, never raw hex
try {
    await runTrade(agent);
} catch (err) {
    console.error(decodeHaetaeError(err).message);
}`;

const sectionMotion = (i: number) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.08 * i, duration: 0.45, ease: [0.2, 0.7, 0.2, 1] as const },
});

interface CheckResult {
    tone: "ok" | "bad" | "muted";
    text: string;
}

const toneColor: Record<CheckResult["tone"], string> = {
    ok: "var(--jade)",
    bad: "var(--vermillion)",
    muted: "var(--stone)",
};

export default function StandardPage() {
    const { copied, copy } = useCopy();

    // Live check widget: the standard's one question, answerable on the spot.
    const [checkInput, setCheckInput] = useState("");
    const [checkBusy, setCheckBusy] = useState(false);
    const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
    const [checkedAddr, setCheckedAddr] = useState<string | null>(null);

    const runCheck = () => {
        const v = checkInput.trim();
        if (!isAddress(v)) {
            setCheckResult({ tone: "bad", text: "Not a valid EVM address." });
            setCheckedAddr(null);
            return;
        }
        const addr = getAddress(v);
        setCheckBusy(true);
        setCheckResult(null);
        setCheckedAddr(null);

        if (isFixtureMode) {
            setTimeout(() => {
                const row = agentFixtures.find((a) => a.address.toLowerCase() === addr.toLowerCase());
                setCheckResult(
                    row
                        ? row.status === "ghost"
                            ? { tone: "bad", text: `isLicensed(${formatAddress(addr)}) → false · revoked (${row.licenseNo})` }
                            : {
                                  tone: "ok",
                                  text: `isLicensed(${formatAddress(addr)}) → true · ${row.licenseNo} · expires ${row.expiry.split(" · ")[0]}`,
                              }
                        : { tone: "muted", text: `isLicensed(${formatAddress(addr)}) → false · no record` },
                );
                setCheckedAddr(addr);
                setCheckBusy(false);
            }, Math.max(flags.loadDelayMs, 200));
            return;
        }

        fetchLicenseSummary(addr)
            .then((s) => {
                setCheckResult(
                    s.licensed
                        ? {
                              tone: "ok",
                              text: `isLicensed(${formatAddress(addr)}) → true${
                                  s.expiryUnix
                                      ? ` · expires ${new Date(s.expiryUnix * 1000).toISOString().slice(0, 10)}`
                                      : ""
                              }`,
                          }
                        : {
                              tone: s.statusCode === null ? "muted" : "bad",
                              text: `isLicensed(${formatAddress(addr)}) → false · ${
                                  s.statusCode === 2 ? "revoked" : s.statusCode === 1 ? "expired" : "no record"
                              }`,
                          },
                );
                setCheckedAddr(addr);
            })
            .catch(() => {
                setCheckResult({ tone: "bad", text: "Chain read failed — the ledger is unreachable." });
            })
            .finally(() => setCheckBusy(false));
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="co-std"
        >
            <div className="co-page-header">
                <h1 className="co-page-title font-display">The Standard</h1>
                <p className="co-page-desc">
                    ERC-Agent-License, draft. One read surface for the question every protocol must ask:
                    was this agent allowed, and which human answers for it?
                </p>
            </div>

            <motion.p className="co-std-lead font-display" {...sectionMotion(0)}>
                A license is <em>identity + authority + expiry</em> — not policy. Spend caps and
                allowlists live in a separate layer that reads the license as a precondition.
            </motion.p>

            <motion.div className="co-std-questions" {...sectionMotion(1)}>
                <div className="co-std-q">
                    <div className="co-std-q-label">01 · Authority</div>
                    <div className="co-std-q-text">Was this agent licensed to act at all?</div>
                </div>
                <div className="co-std-q">
                    <div className="co-std-q-label">02 · Accountability</div>
                    <div className="co-std-q-text">Which verified human principal answers for it?</div>
                </div>
            </motion.div>

            <motion.div {...sectionMotion(2)}>
                <div className="co-papers-label" style={{ marginBottom: 12 }}>
                    Interface — IAgentLicense
                </div>
                <div className="co-snippet-wrap">
                    <pre className="co-std-code">{INTERFACE_TEXT}</pre>
                    <button
                        className="co-chip co-snippet-copy"
                        onClick={() => copy("iface", INTERFACE_TEXT)}
                    >
                        {copied === "iface" ? "Copied ✓" : "Copy"}
                    </button>
                </div>
            </motion.div>

            <motion.div {...sectionMotion(3)}>
                <div className="co-papers-label" style={{ marginBottom: 12 }}>
                    The Laws
                </div>
                <div className="co-std-laws">
                    {LAWS.map((law) => (
                        <div key={law.n} className={`co-std-law ${law.red ? "is-red" : ""}`}>
                            <span className="co-std-law-n">{law.n}</span>
                            {law.text}
                        </div>
                    ))}
                </div>
            </motion.div>

            <motion.div {...sectionMotion(4)}>
                <div className="co-papers-label" style={{ margin: "48px 0 12px" }}>
                    Deployed — GIWA Sepolia · chain 91342
                </div>
                <div className="co-addr-table">
                    {CONTRACTS.map((c) => (
                        <div className="co-addr-row" key={c.name}>
                            <span className="co-addr-name">
                                {c.name}
                                <span className="co-std-note" style={{ display: "block", marginTop: 2 }}>{c.role}</span>
                            </span>
                            <span className="co-addr-val">{c.addr}</span>
                            <button className="co-chip" onClick={() => copy(c.name, c.addr)}>
                                {copied === c.name ? "Copied ✓" : "Copy"}
                            </button>
                            <a
                                className="co-tx-link font-mono"
                                href={explorerAddr(c.addr)}
                                target="_blank"
                                rel="noreferrer"
                            >
                                ↗
                            </a>
                        </div>
                    ))}
                </div>
            </motion.div>

            <motion.div {...sectionMotion(5)}>
                <div className="co-papers-label" style={{ margin: "48px 0 12px" }}>
                    Adopt it — Solidity
                </div>
                <div className="co-snippet-wrap">
                    <pre className="co-std-code">{SOLIDITY_SNIPPET}</pre>
                    <button
                        className="co-chip co-snippet-copy"
                        onClick={() => copy("sol", SOLIDITY_SNIPPET)}
                    >
                        {copied === "sol" ? "Copied ✓" : "Copy"}
                    </button>
                </div>

                <div className="co-papers-label" style={{ margin: "32px 0 12px" }}>
                    Adopt it — TypeScript
                </div>
                <div className="co-snippet-wrap">
                    <pre className="co-std-code">{TS_SNIPPET}</pre>
                    <button className="co-chip co-snippet-copy" onClick={() => copy("ts", TS_SNIPPET)}>
                        {copied === "ts" ? "Copied ✓" : "Copy"}
                    </button>
                </div>
                <p className="co-std-note">
                    @haetae/sdk publishes from this repository and is in progress — the names above
                    (isLicensed, getPolicy, watchAgent, decodeHaetaeError) are the standard's surface.
                </p>
            </motion.div>

            <motion.div {...sectionMotion(6)}>
                <div className="co-papers-label" style={{ margin: "48px 0 12px" }}>
                    Ask the ledger
                </div>
                <div className="co-check-widget">
                    <div className="co-check-row">
                        <input
                            className="co-input"
                            value={checkInput}
                            onChange={(e) => setCheckInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") runCheck();
                            }}
                            placeholder="Any agent address — 0x…"
                            aria-label="Agent address to check"
                            spellCheck={false}
                        />
                        <button className="co-btn-primary" onClick={runCheck} disabled={checkBusy}>
                            {checkBusy ? "Consulting…" : "Check"}
                        </button>
                    </div>
                    <div
                        className="co-check-line"
                        role="status"
                        style={checkResult ? { color: toneColor[checkResult.tone] } : undefined}
                    >
                        {checkBusy ? "consulting the ledger…" : checkResult?.text ?? "\u00A0"}
                    </div>
                    {checkedAddr && (
                        <button
                            className="co-action-btn"
                            style={{ alignSelf: "flex-start" }}
                            onClick={() => navigateToVerify(checkedAddr)}
                        >
                            Full report ↗
                        </button>
                    )}
                </div>
            </motion.div>

            <motion.div className="co-std-links" {...sectionMotion(7)}>
                <a className="co-tx-link font-mono" href={DRAFT_URL} target="_blank" rel="noreferrer">
                    Full draft — standard/ERC-agent-license.md ↗
                </a>
                <a
                    className="co-tx-link font-mono"
                    href={explorerAddr(addresses.license)}
                    target="_blank"
                    rel="noreferrer"
                >
                    Reference implementation — HaetaeLicense on GIWA Sepolia ↗
                </a>
            </motion.div>
        </motion.div>
    );
}
