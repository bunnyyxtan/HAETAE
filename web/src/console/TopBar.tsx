import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { AnimatePresence } from "framer-motion";
import { navigateToLanding, getLandingPath } from "../utils/path";
import { isFixtureMode } from "../chain/mode";
import { watchBlockTicker } from "../chain/reads";
import MobileMenu from "./MobileMenu";

interface TopBarProps {
    view: string;
    onNav: (v: string) => void;
    onConnect: () => void;
    onSettings: () => void;
    address: string | null;
    onDisconnect: () => void;
}

export default function TopBar({ view, onNav, onConnect, onSettings, address, onDisconnect }: TopBarProps) {
    // Live mode: the ticker is finally real — block numbers stream from the
    // GIWA RPC at its 1s cadence. Fixture mode keeps the S02 simulation.
    const [block, setBlock] = useState<number | null>(isFixtureMode ? 8412004 : null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 900);
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuOpener, setMenuOpener] = useState<HTMLElement | null>(null);

    useEffect(() => {
        if (isFixtureMode) {
            const id = setInterval(() => {
                setBlock(b => (b ?? 0) + 1);
            }, 1000);
            return () => clearInterval(id);
        }
        return watchBlockTicker(setBlock);
    }, []);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 900);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const goHome = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        navigateToLanding();
    };

    const openMenu = () => {
        setMenuOpener(document.activeElement as HTMLElement);
        setMenuOpen(true);
    };

    return (
        <header className="co-topbar">
            <div className="co-topbar-left">
                <a href={getLandingPath()} onClick={goHome} className="co-logo" aria-label="Return to landing">
                    <span className="co-logo-mark font-display">해태</span>
                    <span className="co-logo-text">Haetae</span>
                </a>
                
                {isMobile && (
                    <button className="co-btn-icon co-hamburger" onClick={openMenu} aria-label="Menu" title="Menu" style={{ marginLeft: 8 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </button>
                )}

                <nav className="co-nav">
                    {["registry", "agents", "standard", "ledger"].map(v => (
                        <a 
                            key={v}
                            href={`#${v}`}
                            className={`co-nav-link ${view === v ? "is-active" : ""}`}
                            onClick={(e) => { e.preventDefault(); onNav(v); }}
                        >
                            {v.charAt(0).toUpperCase() + v.slice(1)}
                        </a>
                    ))}
                </nav>
            </div>

            <div className="co-topbar-right">
                <div
                    className="co-ticker"
                    title="GIWA head block · ~1s blocks"
                    role="status"
                    aria-live="off"
                    aria-label="GIWA head block, about one-second cadence"
                >
                    <motion.span 
                        key={block ?? "pending"}
                        className="rail-heart-dot" 
                        aria-hidden 
                        initial={{ scale: 0.6, opacity: 0.35 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
                    />
                    <span>{block === null ? "#—" : `#${block.toLocaleString()}`}</span>
                </div>
                
                <button className="co-btn-icon" onClick={onSettings} aria-label="Settings">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                </button>

                {address ? (
                    <div className="co-addr-chip">
                        {address.slice(0,6)}…{address.slice(-4)}
                        <button className="co-addr-chip-btn" onClick={onDisconnect} aria-label="Disconnect">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                ) : (
                    <button className="co-btn-connect" onClick={onConnect}>
                        Connect Wallet
                    </button>
                )}
            </div>

            <AnimatePresence>
                {menuOpen && isMobile && (
                    <MobileMenu view={view} onNav={onNav} opener={menuOpener} onClose={() => setMenuOpen(false)} />
                )}
            </AnimatePresence>
        </header>
    );
}
