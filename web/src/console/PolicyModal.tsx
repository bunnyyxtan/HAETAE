import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { isAddress } from "viem";
import { AgentLicense, formatAddress } from "./fixtures";
import { isFixtureMode } from "../chain/mode";
import { fetchPolicyDetail, fetchTokenPolicy, type PolicyDetail } from "../chain/reads";
import { sendSetCap, sendSetVenue, waitTx, walletErrorMessage } from "../chain/wallet";
import { addresses, explorerTx } from "../chain/deployment";
import { useModal } from "./useModal";

interface PolicyModalProps {
    opener: HTMLElement | null;
    onClose: () => void;
    agent: AgentLicense;
    /** Fixture: patch applied to the row locally. Live: parent refetches. */
    onPolicyChanged: (agentAddr: string, patch: { capPerDay?: number; venues?: string[] }) => void;
}

const CAP_PRESETS = [1_000, 5_000, 25_000, 100_000];

type Busy =
    | null
    | { kind: "cap" }
    | { kind: "venue"; key: string }
    | { kind: "customVenue" }
    | { kind: "tokenCap" };

interface TxState {
    stage: "idle" | "wallet" | "pending" | "ok" | "failed";
    msg: string | null;
    txHash: string | null;
}

export default function PolicyModal({ opener, onClose, agent, onPolicyChanged }: PolicyModalProps) {
    // ---- policy state ------------------------------------------------------
    // Fixture detail is derived from the row: cap as shown, nothing spent
    // today, every listed venue allowed under its display name.
    const [detail, setDetail] = useState<PolicyDetail | null>(
        isFixtureMode
            ? {
                  capPerDay: agent.capPerDay,
                  remainingToday: agent.capPerDay,
                  spentToday: 0,
                  venues: agent.venues.map((name) => ({ name, address: "", allowed: true })),
              }
            : null,
    );
    const [loadErr, setLoadErr] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    const [capInput, setCapInput] = useState(String(agent.capPerDay));
    const [venueInput, setVenueInput] = useState("");
    const [tokenInput, setTokenInput] = useState("");
    const [tokenStats, setTokenStats] = useState<{ cap: bigint; remaining: bigint; spent: bigint } | null>(null);
    const [tokenErr, setTokenErr] = useState<string | null>(null);
    const [tokenBusy, setTokenBusy] = useState(false);
    const [tokenCapInput, setTokenCapInput] = useState("");

    const [busy, setBusy] = useState<Busy>(null);
    const busyRef = useRef<Busy>(null);
    const setBusySync = (b: Busy) => {
        busyRef.current = b;
        setBusy(b);
    };
    const [tx, setTx] = useState<TxState>({ stage: "idle", msg: null, txHash: null });

    const mountedRef = useRef(true);
    useEffect(() => {
        // StrictMode-safe: the dev double-mount runs this cleanup once before
        // the real mount, so the body must re-arm the flag (RevokeModal law).
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (isFixtureMode) return;
        let cancelled = false;
        setLoadErr(false);
        fetchPolicyDetail(agent.address)
            .then((d) => {
                if (cancelled) return;
                setDetail(d);
                setCapInput(String(d.capPerDay));
            })
            .catch(() => {
                if (!cancelled) setLoadErr(true);
            });
        return () => {
            cancelled = true;
        };
    }, [agent.address, reloadKey]);

    const handleRequestClose = () => {
        // Same law as every tx ceremony: an in-flight write owns the modal.
        if (busyRef.current !== null) return;
        onClose();
    };
    const { dialogRef, requestClose } = useModal(handleRequestClose, opener);

    // ---- write plumbing ----------------------------------------------------
    const runWrite = async (
        b: Exclude<Busy, null>,
        send: () => Promise<`0x${string}`>,
        onOk: () => void,
    ) => {
        if (busyRef.current) return;
        setBusySync(b);
        setTx({ stage: "wallet", msg: "Awaiting signature…", txHash: null });
        try {
            const hash = await send();
            if (!mountedRef.current) return;
            setTx({ stage: "pending", msg: "Sealing — awaiting confirmation…", txHash: hash });
            const ok = await waitTx(hash);
            if (!mountedRef.current) return;
            if (ok) {
                setTx({ stage: "ok", msg: "Policy sealed.", txHash: hash });
                onOk();
                // Silent re-read: the modal shows chain truth, not a local guess.
                setReloadKey((k) => k + 1);
            } else {
                setTx({ stage: "failed", msg: "Transaction reverted on-chain.", txHash: hash });
            }
        } catch (err) {
            if (!mountedRef.current) return;
            setTx({ stage: "failed", msg: walletErrorMessage(err), txHash: null });
        } finally {
            if (mountedRef.current) setBusySync(null);
        }
    };

    const fixtureApply = (patch: { capPerDay?: number; venues?: string[] }, next: PolicyDetail) => {
        setDetail(next);
        setTx({ stage: "ok", msg: "Policy updated (fixture — no chain traffic).", txHash: null });
        onPolicyChanged(agent.address, patch);
    };

    // ---- cap ---------------------------------------------------------------
    const capValue = Number(capInput.replace(/[^\d]/g, "") || "0");
    const capValid = Number.isFinite(capValue) && capValue >= 0 && capInput.trim() !== "";

    const saveCap = () => {
        if (!capValid || !detail) return;
        if (isFixtureMode) {
            fixtureApply(
                { capPerDay: capValue },
                { ...detail, capPerDay: capValue, remainingToday: Math.max(0, capValue - detail.spentToday) },
            );
            return;
        }
        void runWrite(
            { kind: "cap" },
            () => sendSetCap(agent.address, addresses.usdc, BigInt(capValue) * 1_000_000n),
            () => onPolicyChanged(agent.address, {}),
        );
    };

    // ---- venues ------------------------------------------------------------
    const toggleVenue = (key: string) => {
        if (!detail) return;
        const target = detail.venues.find((v) => (isFixtureMode ? v.name : v.address) === key);
        if (!target) return;
        if (isFixtureMode) {
            const nextVenues = detail.venues.map((v) =>
                v.name === key ? { ...v, allowed: !v.allowed } : v,
            );
            fixtureApply(
                { venues: nextVenues.filter((v) => v.allowed).map((v) => v.name) },
                { ...detail, venues: nextVenues },
            );
            return;
        }
        void runWrite(
            { kind: "venue", key },
            () => sendSetVenue(agent.address, target.address, !target.allowed),
            () => onPolicyChanged(agent.address, {}),
        );
    };

    const venueInputValid = isFixtureMode
        ? venueInput.trim().length > 0
        : isAddress(venueInput.trim());

    const addCustomVenue = (allowed: boolean) => {
        if (!venueInputValid || !detail) return;
        if (isFixtureMode) {
            const name = venueInput.trim();
            if (detail.venues.some((v) => v.name.toLowerCase() === name.toLowerCase())) return;
            const nextVenues = [...detail.venues, { name, address: "", allowed: true }];
            setVenueInput("");
            fixtureApply(
                { venues: nextVenues.filter((v) => v.allowed).map((v) => v.name) },
                { ...detail, venues: nextVenues },
            );
            return;
        }
        void runWrite(
            { kind: "customVenue" },
            () => sendSetVenue(agent.address, venueInput.trim(), allowed),
            () => {
                setVenueInput("");
                onPolicyChanged(agent.address, {});
            },
        );
    };

    // ---- custom token (live only) ------------------------------------------
    const queryToken = () => {
        if (!isAddress(tokenInput.trim())) {
            setTokenErr("Not a valid token address.");
            return;
        }
        setTokenErr(null);
        setTokenBusy(true);
        setTokenStats(null);
        fetchTokenPolicy(agent.address, tokenInput.trim())
            .then((s) => {
                if (!mountedRef.current) return;
                setTokenStats(s);
                setTokenCapInput(String(s.cap));
            })
            .catch(() => {
                if (mountedRef.current) setTokenErr("Chain read failed.");
            })
            .finally(() => {
                if (mountedRef.current) setTokenBusy(false);
            });
    };

    const tokenCapValid = /^\d+$/.test(tokenCapInput.trim());
    const saveTokenCap = () => {
        if (!tokenCapValid || !isAddress(tokenInput.trim())) return;
        void runWrite(
            { kind: "tokenCap" },
            () => sendSetCap(agent.address, tokenInput.trim(), BigInt(tokenCapInput.trim())),
            () => {
                onPolicyChanged(agent.address, {});
                queryToken();
            },
        );
    };

    const locked = busy !== null;
    const busyVenueKey = busy?.kind === "venue" ? busy.key : null;

    return (
        <div
            className="co-modal-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget && !locked) requestClose();
            }}
        >
            <motion.div
                ref={dialogRef}
                tabIndex={-1}
                className="co-modal"
                style={{ maxWidth: 560 }}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
                role="dialog"
                aria-modal="true"
                aria-live="polite"
            >
                <div className="co-modal-header">
                    <h2 className="co-modal-title">Policy — {agent.name}</h2>
                    {!locked && (
                        <button className="co-modal-close" onClick={requestClose} aria-label="Close">×</button>
                    )}
                </div>

                <div className="co-modal-body co-form-grid">
                    {!detail && !loadErr && (
                        <>
                            <div className="co-skel" style={{ width: "60%", height: 16 }} />
                            <div className="co-skel" style={{ width: "100%", height: 44 }} />
                            <div className="co-skel" style={{ width: "100%", height: 120 }} />
                        </>
                    )}
                    {loadErr && (
                        <div className="co-tx-strip is-failed">
                            <span>Policy read failed — the chain is not responding.</span>
                            <button className="co-chip" onClick={() => setReloadKey((k) => k + 1)}>Retry</button>
                        </div>
                    )}

                    {detail && (
                        <>
                            <div className="co-policy-stats">
                                <div className="co-papers-field">
                                    <div className="co-papers-label">Cap / day</div>
                                    <div className="co-papers-value mono">${detail.capPerDay.toLocaleString()}</div>
                                </div>
                                <div className="co-papers-field">
                                    <div className="co-papers-label">Spent today</div>
                                    <div className="co-papers-value mono">${detail.spentToday.toLocaleString()}</div>
                                </div>
                                <div className="co-papers-field">
                                    <div className="co-papers-label">Remaining today</div>
                                    <div className="co-papers-value mono">${detail.remainingToday.toLocaleString()}</div>
                                </div>
                            </div>

                            <div className="co-field">
                                <label className="co-field-label" htmlFor="policy-cap">Daily cap (tUSDC)</label>
                                <div className="co-preset-row">
                                    {CAP_PRESETS.map((p) => (
                                        <button
                                            key={p}
                                            className={`co-chip ${capValue === p ? "is-on" : ""}`}
                                            onClick={() => setCapInput(String(p))}
                                            disabled={locked}
                                        >
                                            {p.toLocaleString()}
                                        </button>
                                    ))}
                                </div>
                                <div className="co-preset-row">
                                    <input
                                        id="policy-cap"
                                        className="co-input"
                                        style={{ flex: 1 }}
                                        value={capInput}
                                        onChange={(e) => setCapInput(e.target.value.replace(/[^\d]/g, ""))}
                                        inputMode="numeric"
                                        disabled={locked}
                                    />
                                    <button
                                        className="co-btn-primary"
                                        onClick={saveCap}
                                        disabled={locked || !capValid || capValue === detail.capPerDay}
                                    >
                                        {busy?.kind === "cap" ? "Sealing…" : "Save cap"}
                                    </button>
                                </div>
                                <span className="co-field-hint">
                                    Caps reset at the UTC day boundary. Spend already recorded today survives cap changes.
                                </span>
                            </div>

                            <div className="co-field">
                                <span className="co-field-label">Venues</span>
                                <div className="co-venue-list">
                                    {detail.venues.length === 0 && (
                                        <span className="co-field-hint">No venues on the allowlist yet.</span>
                                    )}
                                    {detail.venues.map((v) => {
                                        const key = isFixtureMode ? v.name : v.address;
                                        return (
                                            <div className="co-venue-row" key={key}>
                                                <span className="co-venue-name">{v.name}</span>
                                                {!isFixtureMode && (
                                                    <span className="co-venue-addr font-mono">{formatAddress(v.address)}</span>
                                                )}
                                                <button
                                                    className={`co-switch ${v.allowed ? "is-on" : ""}`}
                                                    role="switch"
                                                    aria-checked={v.allowed}
                                                    aria-label={`${v.name} ${v.allowed ? "allowed" : "denied"}`}
                                                    onClick={() => toggleVenue(key)}
                                                    disabled={locked}
                                                >
                                                    {busyVenueKey === key && <span className="co-switch-busy" aria-hidden />}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="co-field">
                                <label className="co-field-label" htmlFor="policy-venue">
                                    {isFixtureMode ? "Add venue (fixture)" : "Custom venue address"}
                                </label>
                                <div className="co-preset-row">
                                    <input
                                        id="policy-venue"
                                        className="co-input"
                                        style={{ flex: 1 }}
                                        value={venueInput}
                                        onChange={(e) => setVenueInput(e.target.value)}
                                        placeholder={isFixtureMode ? "venue name" : "0x…"}
                                        spellCheck={false}
                                        disabled={locked}
                                    />
                                    {isFixtureMode ? (
                                        <button
                                            className="co-btn-primary"
                                            onClick={() => addCustomVenue(true)}
                                            disabled={locked || !venueInputValid}
                                        >
                                            Add
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                className="co-btn-primary"
                                                onClick={() => addCustomVenue(true)}
                                                disabled={locked || !venueInputValid}
                                            >
                                                Allow
                                            </button>
                                            <button
                                                className="co-chip"
                                                onClick={() => addCustomVenue(false)}
                                                disabled={locked || !venueInputValid}
                                            >
                                                Deny
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {!isFixtureMode && (
                                <div className="co-field">
                                    <label className="co-field-label" htmlFor="policy-token">Custom token</label>
                                    <div className="co-preset-row">
                                        <input
                                            id="policy-token"
                                            className="co-input"
                                            style={{ flex: 1 }}
                                            value={tokenInput}
                                            onChange={(e) => setTokenInput(e.target.value)}
                                            placeholder="token address 0x…"
                                            spellCheck={false}
                                            disabled={locked || tokenBusy}
                                        />
                                        <button
                                            className="co-chip"
                                            onClick={queryToken}
                                            disabled={locked || tokenBusy || tokenInput.trim() === ""}
                                        >
                                            {tokenBusy ? "Reading…" : "Query"}
                                        </button>
                                    </div>
                                    {tokenErr && <span className="co-field-err">{tokenErr}</span>}
                                    {tokenStats && (
                                        <>
                                            <span className="co-field-hint font-mono">
                                                cap {tokenStats.cap.toString()} · spent {tokenStats.spent.toString()} · remaining{" "}
                                                {tokenStats.remaining.toString()} (raw base units — decimals unknown)
                                            </span>
                                            <div className="co-preset-row">
                                                <input
                                                    className="co-input"
                                                    style={{ flex: 1 }}
                                                    value={tokenCapInput}
                                                    onChange={(e) => setTokenCapInput(e.target.value.replace(/[^\d]/g, ""))}
                                                    inputMode="numeric"
                                                    aria-label="Custom token cap (raw base units)"
                                                    disabled={locked}
                                                />
                                                <button
                                                    className="co-btn-primary"
                                                    onClick={saveTokenCap}
                                                    disabled={locked || !tokenCapValid}
                                                >
                                                    {busy?.kind === "tokenCap" ? "Sealing…" : "Set cap (raw)"}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {tx.stage !== "idle" && (
                                <div
                                    className={`co-tx-strip ${tx.stage === "failed" ? "is-failed" : ""} ${tx.stage === "ok" ? "is-ok" : ""}`}
                                    role="status"
                                >
                                    <span>{tx.msg}</span>
                                    {tx.txHash && (
                                        <a
                                            className="co-tx-link font-mono"
                                            href={explorerTx(tx.txHash)}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            tx {tx.txHash.slice(0, 10)}…{tx.txHash.slice(-6)} ↗
                                        </a>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="co-modal-footer">
                    {isFixtureMode
                        ? "FIXTURE MODE · NO CHAIN TRAFFIC"
                        : "POLICY WRITES REQUIRE THE AGENT'S PRINCIPAL · DEAD-ON-READ AFTER RE-MINT BY ANOTHER"}
                </div>
            </motion.div>
        </div>
    );
}
