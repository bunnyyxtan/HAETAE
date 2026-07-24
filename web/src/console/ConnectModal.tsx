import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { flags } from "./fixtures";
import { isFixtureMode } from "../chain/mode";
import { connectWallet, listWalletOptions, walletErrorMessage, type WalletOption } from "../chain/wallet";
import { useModal } from "./useModal";

interface ConnectModalProps {
    opener: HTMLElement | null;
    onClose: () => void;
    onSuccess: (address: string) => void;
}

// Fixture-mode wallet list (S02 demo insurance — no chain traffic).
const fixtureWallets = [
    { id: "metamask", name: "MetaMask", detect: () => (window as any).ethereum?.isMetaMask },
    { id: "rabby", name: "Rabby", detect: () => (window as any).ethereum?.isRabby },
    { id: "coinbase", name: "Coinbase Wallet", detect: () => (window as any).ethereum?.isCoinbaseWallet },
];

export default function ConnectModal({ opener, onClose, onSuccess }: ConnectModalProps) {
    const [connecting, setConnecting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const connectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Wallet options resolve once per open: EIP-6963 announcements land well
    // before a human can open this modal.
    const [options] = useState<WalletOption[]>(() => (isFixtureMode ? [] : listWalletOptions()));

    // Interpose on the hook's close-intent path: EVERY close (Escape, backdrop,
    // ×, programmatic) clears any in-flight connect timer before the parent
    // learns about the close — a late close can never resurrect onSuccess.
    const handleRequestClose = () => {
        if (connectTimer.current) {
            clearTimeout(connectTimer.current);
            connectTimer.current = null;
        }
        onClose();
    };

    const { dialogRef, requestClose } = useModal(handleRequestClose, opener);

    useEffect(() => () => {
        if (connectTimer.current) clearTimeout(connectTimer.current);
    }, []);

    const connectFixture = (id: string) => {
        if (connectTimer.current) clearTimeout(connectTimer.current);
        setConnecting(id);
        setError(null);
        connectTimer.current = setTimeout(() => {
            connectTimer.current = null;
            if (id === flags.rejectWallet) {
                setError("Connection rejected by user.");
                setConnecting(null);
            } else {
                // Success shares the single close-intent path: teardown
                // (stack, locks, focus) happens NOW, not at deferred unmount.
                requestClose();
                onSuccess("0x9A8B7C6D5E4F3A2B1C0D9E8F7A6B5C4D3E2F1A0B");
            }
        }, 1400);
    };

    const connectLive = async (opt: WalletOption) => {
        if (connecting) return;
        setConnecting(opt.id);
        setError(null);
        try {
            const address = await connectWallet(opt.id);
            requestClose();
            onSuccess(address);
        } catch (err) {
            setError(walletErrorMessage(err));
            setConnecting(null);
        }
    };

    const liveStatus = (opt: WalletOption) => {
        if (connecting === opt.id) return "Connecting…";
        if (opt.kind === "scratch") return "Dev signer";
        return "Detected";
    };

    return (
        <div className="co-modal-overlay" onClick={(e) => {
            if (e.target === e.currentTarget) requestClose();
        }}>
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
            >
                <div className="co-modal-header">
                    <h2 className="co-modal-title">Present Papers</h2>
                    <button className="co-modal-close" onClick={requestClose} aria-label="Close">×</button>
                </div>
                <div className="co-modal-body">
                    <div className="co-wallet-list">
                        {isFixtureMode && fixtureWallets.map(w => {
                            const installed = w.detect();
                            const isConnecting = connecting === w.id;
                            return (
                                <button 
                                    key={w.id}
                                    className="co-wallet-btn"
                                    onClick={() => connectFixture(w.id)}
                                    disabled={connecting !== null && !isConnecting}
                                >
                                    <span className="co-wallet-name">{w.name}</span>
                                    <span className="co-wallet-status">
                                        {isConnecting ? "Connecting…" : installed ? "Detected" : "QR / Extension"}
                                    </span>
                                </button>
                            );
                        })}

                        {!isFixtureMode && options.length === 0 && (
                            <div className="co-wallet-none">
                                No wallet extension detected. Install MetaMask (or any EIP-6963 wallet) and reload.
                            </div>
                        )}

                        {!isFixtureMode && options.map(opt => (
                            <button
                                key={opt.id}
                                className="co-wallet-btn"
                                onClick={() => connectLive(opt)}
                                disabled={connecting !== null && connecting !== opt.id}
                            >
                                <span className="co-wallet-name">{opt.name}</span>
                                <span className="co-wallet-status">{liveStatus(opt)}</span>
                            </button>
                        ))}
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div 
                                className="co-wallet-error"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="12" y1="8" x2="12" y2="12"/>
                                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                                </svg>
                                <span>{error}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <div className="co-modal-footer">
                    GIWA · CHAIN 91342 · NO SIGNATURE ON CONNECT
                </div>
            </motion.div>
        </div>
    );
}
