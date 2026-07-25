import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { getAddress, isAddress, stringToHex, type Hex } from "viem";
import { AgentLicense, FIXTURE_WALLET, formatAddress } from "./fixtures";
import { isFixtureMode } from "../chain/mode";
import { sendMint, waitMint, walletErrorMessage } from "../chain/wallet";
import { TxUnconfirmedError, walletSlowTimer } from "../chain/txWatch";
import { explorerTx } from "../chain/deployment";
import { useModal } from "./useModal";

// What the ceremony hands back to its parent. Fixture mode: the parent builds
// and appends the local row (it owns numbering). Live mode: txHash/licenseId
// are real and the parent silently refetches chain truth.
export interface MintResult {
    agent: string; // checksummed
    expiryUnix: number;
    scope: string | null;
    txHash: string | null;
    licenseId: number | null;
}

interface MintModalProps {
    opener: HTMLElement | null;
    onClose: () => void;
    onMinted: (r: MintResult) => void;
    connectedAddress: string | null;
    /** Current rows — powers the AlreadyLicensed pre-check (chain parity). */
    agents: AgentLicense[];
    /** Re-license mode: agent address prefilled and locked (new id, Law 2). */
    relicense?: AgentLicense | null;
}

type Phase = "form" | "review" | "wallet" | "pending" | "sealed" | "failed";

const TERMS = [
    { label: "30 days", days: 30 },
    { label: "90 days", days: 90 },
    { label: "180 days", days: 180 },
    { label: "1 year", days: 365 },
];

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

export default function MintModal({
    opener,
    onClose,
    onMinted,
    connectedAddress,
    agents,
    relicense = null,
}: MintModalProps) {
    const [phase, setPhase] = useState<Phase>("form");
    const phaseRef = useRef(phase);
    phaseRef.current = phase;
    if (import.meta.env.DEV) {
        // Dev-only observability (same precedent as __revokePhase).
        (window as unknown as { __mintPhase?: string }).__mintPhase = phase;
    }

    const [agentInput, setAgentInput] = useState(relicense?.address ?? "");
    const [termDays, setTermDays] = useState(90);
    const [scope, setScope] = useState(relicense?.scope ?? "");
    // Expiry freezes when review opens: the number the operator reads is the
    // number that signs — no drifting clock between review and commit.
    const [reviewExpiry, setReviewExpiry] = useState<number | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [mintedId, setMintedId] = useState<number | null>(null);
    const [failMsg, setFailMsg] = useState<string | null>(null);
    // Task #20: honest slow states. "wallet" = no wallet response within the
    // deadline; "confirm" = submitted but no receipt within the poll window.
    // Either unlocks close — the user is never trapped behind a stale label.
    const [slow, setSlow] = useState<null | "wallet" | "confirm">(null);
    const slowRef = useRef(slow);
    slowRef.current = slow;

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);
    useEffect(() => {
        // StrictMode-safe: the dev double-mount runs this cleanup once before
        // the real mount, so the body must re-arm the flag (RevokeModal law).
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const handleRequestClose = () => {
        // A transaction in flight owns the modal (same law as the revoke
        // ceremony): closing mid-signature or mid-confirmation would orphan
        // the ceremony from its verdict. Exception (Task #20): once the UI has
        // honestly said it cannot determine tx state, the user may leave — the
        // registry refetch shows chain truth.
        if ((phaseRef.current === "wallet" || phaseRef.current === "pending") && slowRef.current === null)
            return;
        if (timerRef.current) clearTimeout(timerRef.current);
        onClose();
    };

    const { dialogRef, requestClose } = useModal(handleRequestClose, opener);

    const setPhaseSync = (p: Phase) => {
        phaseRef.current = p;
        setPhase(p);
    };

    // ---- validation -------------------------------------------------------
    const trimmedAddr = agentInput.trim();
    const addrValid = isAddress(trimmedAddr);
    const addrErr =
        trimmedAddr === ""
            ? null
            : !addrValid
              ? "Not a valid EVM address."
              : trimmedAddr.toLowerCase() === ZERO_ADDR
                ? "The zero address cannot be licensed."
                : null;
    const duplicate =
        addrValid &&
        agents.some(
            (a) => a.status === "licensed" && a.address.toLowerCase() === trimmedAddr.toLowerCase(),
        );
    const scopeBytes = new TextEncoder().encode(scope.trim()).length;
    const scopeErr = scopeBytes > 32 ? `Scope tag is ${scopeBytes} bytes — bytes32 holds at most 32.` : null;
    const canReview = addrValid && !addrErr && !duplicate && !scopeErr;

    const principal = isFixtureMode ? (connectedAddress ?? FIXTURE_WALLET) : connectedAddress;

    // ---- flow -------------------------------------------------------------
    const openReview = () => {
        if (!canReview) return;
        setFailMsg(null);
        setReviewExpiry(Math.floor(Date.now() / 1000) + termDays * 86400);
        setPhaseSync("review");
    };

    const seal = (result: MintResult) => {
        setPhaseSync("sealed");
        onMinted(result); // parent appends (fixture) or silently refetches (live)
        // No auto-close (micro-task ruling): the sealed verdict persists until
        // dismissed — a verdict you cannot read is not a verdict.
    };

    const commit = () => {
        if (phaseRef.current !== "review" || reviewExpiry === null) return;
        const agent = getAddress(trimmedAddr);
        const scopeText = scope.trim() || null;

        if (isFixtureMode) {
            // Fixture theater: simulated confirmation, no chain traffic.
            setPhaseSync("pending");
            timerRef.current = setTimeout(() => {
                timerRef.current = null;
                if (!mountedRef.current) return;
                seal({ agent, expiryUnix: reviewExpiry, scope: scopeText, txHash: null, licenseId: null });
            }, 1200);
            return;
        }

        void (async () => {
            setPhaseSync("wallet");
            setFailMsg(null);
            setSlow(null);
            // A retry must not wear the previous attempt's tx link.
            setTxHash(null);
            setMintedId(null);
            // Wallet deadline: if the wallet has not answered in 15s, say so
            // and unlock close instead of hanging on "Awaiting signature…".
            const deadline = walletSlowTimer(() => {
                if (mountedRef.current && phaseRef.current === "wallet") setSlow("wallet");
            });
            try {
                const scopeHex: Hex = scopeText
                    ? stringToHex(scopeText, { size: 32 })
                    : (`0x${"00".repeat(32)}` as Hex);
                const hash = await sendMint(agent, reviewExpiry, scopeHex);
                deadline.clear();
                if (!mountedRef.current) return;
                setTxHash(hash);
                setSlow(null);
                setPhaseSync("pending");
                const { ok, licenseId } = await waitMint(hash, {
                    onStillWaiting: () => {
                        if (mountedRef.current && phaseRef.current === "pending") setSlow("confirm");
                    },
                    // Closed/unmounted ceremony must not keep polling receipts.
                    shouldStop: () => !mountedRef.current,
                });
                if (!mountedRef.current) return;
                if (ok) {
                    setMintedId(licenseId);
                    seal({ agent, expiryUnix: reviewExpiry, scope: scopeText, txHash: hash, licenseId });
                } else {
                    setPhaseSync("failed");
                    setFailMsg("Transaction reverted on-chain.");
                }
            } catch (err) {
                deadline.clear();
                if (!mountedRef.current) return;
                setPhaseSync("failed");
                // An unconfirmed tx is NOT a failure verdict: keep the tx link
                // so the user can watch it land (or not) on the explorer.
                if (!(err instanceof TxUnconfirmedError)) setTxHash(null);
                setFailMsg(walletErrorMessage(err));
            } finally {
                if (mountedRef.current) setSlow(null);
            }
        })();
    };

    const txLocked = (phase === "wallet" || phase === "pending") && slow === null;
    const expiryLabel = (unix: number) => `${new Date(unix * 1000).toISOString().slice(0, 10)} · ${unix}`;

    const statusLine =
        phase === "wallet"
            ? slow === "wallet"
                ? "No wallet response yet — approve or reject the request in your wallet. Nothing is submitted without your signature; you may close this dialog."
                : "Awaiting signature…"
            : phase === "pending"
              ? isFixtureMode
                  ? "Sealing (sandbox theater)…"
                  : slow === "confirm"
                    ? "Submitted — still confirming on GIWA. The transaction is broadcast; follow it via the tx link."
                    : "Sealing — awaiting confirmation…"
              : phase === "sealed"
                ? isFixtureMode
                    ? "License sealed. No chain traffic in sandbox mode."
                    : mintedId !== null
                      ? `HT-${String(mintedId).padStart(4, "0")} sealed on GIWA.`
                      : "License sealed on GIWA."
                : phase === "failed"
                  ? failMsg
                  : null;

    return (
        <div
            className="co-modal-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget && !txLocked) requestClose();
            }}
        >
            <motion.div
                ref={dialogRef}
                tabIndex={-1}
                className="co-modal"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
                role="dialog"
                aria-modal="true"
                aria-live="polite"
            >
                <div className="co-modal-header">
                    <h2 className="co-modal-title">{relicense ? "Re-license Agent" : "License an Agent"}</h2>
                    {!txLocked && (
                        <button className="co-modal-close" onClick={requestClose} aria-label="Close">×</button>
                    )}
                </div>

                <div className="co-modal-body">
                    {phase === "form" && (
                        <div className="co-form-grid">
                            {relicense && (
                                <div className="co-field-hint">
                                    Re-licensing <strong>{relicense.name}</strong>. The revoked record
                                    ({relicense.licenseNo}) stays on-chain forever — this mints a new id (Law&nbsp;2).
                                </div>
                            )}
                            <div className="co-field">
                                <label className="co-field-label" htmlFor="mint-agent">Agent address</label>
                                <input
                                    id="mint-agent"
                                    className={`co-input ${addrErr || duplicate ? "is-invalid" : ""}`}
                                    value={agentInput}
                                    onChange={(e) => setAgentInput(e.target.value)}
                                    placeholder="0x…"
                                    spellCheck={false}
                                    disabled={!!relicense}
                                />
                                {addrErr && <span className="co-field-err">{addrErr}</span>}
                                {duplicate && (
                                    <span className="co-field-err">
                                        This agent already holds an active license — the chain refuses with AlreadyLicensed.
                                    </span>
                                )}
                            </div>
                            <div className="co-field">
                                <span className="co-field-label">Term</span>
                                <div className="co-preset-row" role="group" aria-label="License term">
                                    {TERMS.map((t) => (
                                        <button
                                            key={t.days}
                                            type="button"
                                            className={`co-chip ${termDays === t.days ? "is-on" : ""}`}
                                            onClick={() => setTermDays(t.days)}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                                <span className="co-field-hint">isLicensed() flips false at expiry — renewal is a re-mint.</span>
                            </div>
                            <div className="co-field">
                                <label className="co-field-label" htmlFor="mint-scope">Scope tag (optional)</label>
                                <input
                                    id="mint-scope"
                                    className={`co-input ${scopeErr ? "is-invalid" : ""}`}
                                    value={scope}
                                    onChange={(e) => setScope(e.target.value)}
                                    placeholder="swap · treasury · grants…"
                                    spellCheck={false}
                                />
                                {scopeErr ? (
                                    <span className="co-field-err">{scopeErr}</span>
                                ) : (
                                    <span className="co-field-hint">Stored verbatim as bytes32; semantics are yours.</span>
                                )}
                            </div>
                            <button className="co-btn-primary" onClick={openReview} disabled={!canReview}>
                                Review
                            </button>
                        </div>
                    )}

                    {phase !== "form" && (
                        <div className="co-form-grid">
                            <div className="co-agent-fields" style={{ margin: 0 }}>
                                <div className="co-papers-field">
                                    <div className="co-papers-label">Agent</div>
                                    <div className="co-papers-value mono">{formatAddress(trimmedAddr)}</div>
                                </div>
                                <div className="co-papers-field">
                                    <div className="co-papers-label">Principal</div>
                                    <div className="co-papers-value mono">
                                        {principal ? formatAddress(principal) : "—"}
                                    </div>
                                </div>
                                <div className="co-papers-field">
                                    <div className="co-papers-label">Expiry</div>
                                    <div className="co-papers-value mono">
                                        {reviewExpiry !== null ? expiryLabel(reviewExpiry) : "—"}
                                    </div>
                                </div>
                                <div className="co-papers-field">
                                    <div className="co-papers-label">Scope</div>
                                    <div className="co-papers-value mono">{scope.trim() || "—"}</div>
                                </div>
                            </div>

                            {phase === "review" && (
                                <>
                                    <div className="co-field-hint">
                                        mint(agent, expiry, scope) — permissionless, gated by the verifier.
                                        The license seals to the connected principal as a soulbound token.
                                    </div>
                                    <div className="co-preset-row">
                                        <button className="co-chip" onClick={() => setPhaseSync("form")}>
                                            ← Edit
                                        </button>
                                        <button className="co-btn-primary" style={{ flex: 1 }} onClick={commit}>
                                            Sign &amp; Seal
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* Gate on phase, not txLocked: the strip must stay visible
                                during honest slow states, when close is unlocked. */}
                            {(phase === "wallet" || phase === "pending" || phase === "sealed" || phase === "failed") && (
                                <div
                                    className={`co-tx-strip ${phase === "failed" ? "is-failed" : ""} ${phase === "sealed" ? "is-ok" : ""}`}
                                    role="status"
                                >
                                    <span>{statusLine}</span>
                                    {txHash && (
                                        <a
                                            className="co-tx-link font-mono"
                                            href={explorerTx(txHash)}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            tx {txHash.slice(0, 10)}…{txHash.slice(-6)} ↗
                                        </a>
                                    )}
                                </div>
                            )}

                            {phase === "failed" && (
                                <button className="co-btn-primary" onClick={() => setPhaseSync("review")}>
                                    Try again
                                </button>
                            )}

                            {phase === "sealed" && (
                                <button className="co-btn-primary" onClick={requestClose}>
                                    Done
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="co-modal-footer">
                    {isFixtureMode
                        ? "SANDBOX MODE · NO CHAIN TRAFFIC"
                        : "TESTNET: PRINCIPALS VERIFY VIA HAETAE DOJANG — DOJANG SCROLL OR A HAETAE ATTESTATION."}
                </div>
            </motion.div>
        </div>
    );
}
