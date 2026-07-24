import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import "../console.css";
import TopBar from "./TopBar";
import Registry from "./Registry";
import AgentsPage from "./AgentsPage";
import StandardPage from "./StandardPage";
import LedgerPage from "./LedgerPage";
import ConnectModal from "./ConnectModal";
import SettingsModal from "./SettingsModal";
import { isFixtureMode } from "../chain/mode";
import { disconnectWallet, initWallet, subscribeAccount } from "../chain/wallet";

const VIEWS = ["registry", "agents", "standard", "ledger"];

// Each view is hash-deep-linkable (/console#ledger). replaceState keeps
// ?demo=fixtures intact and avoids filling history with every tab hop.
const initialView = () => {
    const h = window.location.hash.replace("#", "");
    return VIEWS.includes(h) ? h : "registry";
};

export default function ConsoleApp() {
    const [view, setViewState] = useState<string>(initialView);
    const setView = (v: string) => {
        setViewState(v);
        window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${window.location.search}#${v}`,
        );
    };

    // Hash is two-way: tab clicks write it (replaceState above, which never
    // fires hashchange — no loop), and external navigation (manual edits,
    // back/forward across hash states) updates the view here. An erased hash
    // returns to registry; unknown hashes are ignored.
    useEffect(() => {
        const onHash = () => {
            const h = window.location.hash.replace("#", "");
            if (h === "") setViewState("registry");
            else if (VIEWS.includes(h)) setViewState(h);
        };
        window.addEventListener("hashchange", onHash);
        return () => window.removeEventListener("hashchange", onHash);
    }, []);
    const [modalOpen, setModalOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [address, setAddress] = useState<string | null>(null);
    const [connectOpener, setConnectOpener] = useState<HTMLElement | null>(null);
    const [settingsOpener, setSettingsOpener] = useState<HTMLElement | null>(null);

    // Live wallet plumbing: restore a prior injected session and mirror
    // wallet-side changes (disconnects, account switches) into UI state.
    useEffect(() => {
        if (isFixtureMode) return;
        initWallet();
        return subscribeAccount(setAddress);
    }, []);

    const handleDisconnect = () => {
        if (!isFixtureMode) void disconnectWallet();
        setAddress(null);
    };

    const openConnect = () => {
        setConnectOpener(document.activeElement as HTMLElement);
        setModalOpen(true);
    };

    const openSettings = () => {
        setSettingsOpener(document.activeElement as HTMLElement);
        setSettingsOpen(true);
    };

    return (
        <div className="co-app" data-testid="console-app">
            <TopBar 
                view={view} 
                onNav={setView} 
                onConnect={openConnect}
                onSettings={openSettings}
                address={address}
                onDisconnect={handleDisconnect}
            />
            
            <main className="co-main">
                <AnimatePresence mode="wait">
                    {view === "registry" && <Registry key="registry" connectedAddress={address} />}
                    {view === "agents" && <AgentsPage key="agents" />}
                    {view === "standard" && <StandardPage key="standard" />}
                    {view === "ledger" && <LedgerPage key="ledger" />}
                </AnimatePresence>
            </main>

            <AnimatePresence>
                {modalOpen && (
                    <ConnectModal 
                        opener={connectOpener}
                        onClose={() => setModalOpen(false)} 
                        onSuccess={(addr) => {
                            setAddress(addr);
                            setModalOpen(false);
                        }} 
                    />
                )}
            </AnimatePresence>
            <AnimatePresence>
                {settingsOpen && (
                    <SettingsModal
                        opener={settingsOpener}
                        onClose={() => setSettingsOpen(false)}
                        hasAddress={!!address}
                        onDisconnect={() => {
                            handleDisconnect();
                            setSettingsOpen(false);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
