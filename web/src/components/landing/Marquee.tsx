import { useState, type ReactNode } from "react";

const ROW = ["Sealed", "Watched", "Revoked", "Ghost", "Guardian", "Bound"];

function Row({ dir = "left", accents = ["Revoked", "Ghost"] }) {
    // build two copies for seamless loop
    const items: ReactNode[] = [];
    for (let n = 0; n < 2; n++) {
        ROW.forEach((w, i) => {
            const isAccent = accents.includes(w);
            items.push(
                <span
                    key={`${dir}-${n}-${i}`}
                    className={`m-item ${isAccent ? "m-item--accent" : ""}`}
                >
                    {w}
                </span>,
            );
            items.push(
                <span key={`${dir}-d-${n}-${i}`} className="m-divider" aria-hidden>
                    해태
                </span>,
            );
        });
    }
    return (
        <div className={`m-track m-track--${dir}`}>
            <div className="m-inner">{items}</div>
        </div>
    );
}

export default function Marquee() {
    const [paused, setPaused] = useState(false);
    return (
        <div
            className={`marquee-band-2 ${paused ? "m-paused" : ""}`}
            data-testid="marquee"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            <Row dir="left" accents={["Revoked", "Ghost"]} />
            <Row dir="right" accents={["Sealed", "Guardian"]} />
        </div>
    );
}
