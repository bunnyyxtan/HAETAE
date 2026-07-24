import { motion } from "framer-motion";
import { addresses, explorerAddr } from "../chain/deployment";

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

const sectionMotion = (i: number) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.08 * i, duration: 0.45, ease: [0.2, 0.7, 0.2, 1] as const },
});

export default function StandardPage() {
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
                <pre className="co-std-code">{INTERFACE_TEXT}</pre>
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

            <motion.div className="co-std-links" {...sectionMotion(4)}>
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
