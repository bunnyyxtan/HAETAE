import { useRef, useState, type FormEvent } from "react";
import { getAddress, isAddress } from "viem";
import { navigateToVerify } from "../utils/path";

interface EntryGateProps {
    onConnect: () => void;
}

// Disconnected entry state (FINAL RULING: wallet-scoped console): a visitor
// lands on what this place IS plus exactly two actions, connect a wallet or
// look up one agent by exact address. The console never enumerates the
// record; the only public surface is /verify, reached deliberately by
// look-up or deep link. Ceremony law: this state renders no fake previews
// and no skeleton rows; while it is on screen the page fetches nothing and
// pretends nothing.
export default function EntryGate({ onConnect }: EntryGateProps) {
    const [lookupOpen, setLookupOpen] = useState(false);
    const [value, setValue] = useState("");
    const [invalid, setInvalid] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const openLookup = () => {
        setLookupOpen(true);
        // Focus lands after the row renders.
        requestAnimationFrame(() => inputRef.current?.focus());
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const raw = value.trim();
        // Strict viem validation: mixed-case input with a bad EIP-55 checksum
        // is a typo risk — rejected explicitly, never "fixed" silently.
        if (!isAddress(raw)) {
            setInvalid(true);
            return;
        }
        navigateToVerify(getAddress(raw));
    };

    return (
        <div className="co-entry">
            <p className="co-entry-line font-display">
                The public court record of licensed agents on GIWA
            </p>
            <div className="co-entry-ctas">
                <button className="co-btn-primary" onClick={onConnect}>
                    Connect Wallet
                </button>
                {!lookupOpen && (
                    <button className="co-action-btn" onClick={openLookup}>
                        Look up an agent
                    </button>
                )}
            </div>
            {lookupOpen && (
                <form className="co-entry-lookup" onSubmit={submit}>
                    <input
                        ref={inputRef}
                        className={`co-input ${invalid ? "is-invalid" : ""}`}
                        placeholder="0x… agent address"
                        aria-label="Agent address"
                        value={value}
                        onChange={(e) => {
                            setValue(e.target.value);
                            setInvalid(false);
                        }}
                        spellCheck={false}
                    />
                    <button className="co-action-btn" type="submit">
                        View record
                    </button>
                </form>
            )}
            {invalid && <div className="co-field-err">Not a valid agent address.</div>}
        </div>
    );
}
