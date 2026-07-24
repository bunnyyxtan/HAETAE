import { motion } from "framer-motion";
import { useModal } from "./useModal";

interface MobileMenuProps {
    view: string;
    onNav: (v: string) => void;
    opener: HTMLElement | null;
    onClose: () => void;
}

export default function MobileMenu({ view, onNav, opener, onClose }: MobileMenuProps) {
    const { dialogRef, requestClose } = useModal(onClose, opener);

    return (
        <div className="co-modal-overlay" onClick={(e) => {
            if (e.target === e.currentTarget) requestClose();
        }}>
            <motion.div 
                ref={dialogRef}
                tabIndex={-1}
                className="co-mobile-drawer"
                initial={{ opacity: 0, x: "-100%" }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: "-100%" }}
                transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
                role="dialog"
                aria-modal="true"
            >
                <div className="co-drawer-header">
                    <span className="co-logo-mark font-display">해태</span>
                    <button className="co-modal-close" onClick={requestClose} aria-label="Close">×</button>
                </div>
                <div className="co-drawer-body">
                    {["registry", "agents", "standard", "ledger"].map(v => (
                        <button 
                            key={v}
                            className={`co-drawer-link ${view === v ? "is-active" : ""}`}
                            onClick={() => { onNav(v); requestClose(); }}
                        >
                            {v.charAt(0).toUpperCase() + v.slice(1)}
                        </button>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}