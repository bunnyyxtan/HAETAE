export default function Footer() {
    return (
        <footer data-testid="footer">
            <div className="footer-line">
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                    }}
                >
                    <span
                        className="font-display"
                        style={{
                            color: "var(--vermillion)",
                            fontSize: 20,
                            lineHeight: 1,
                        }}
                    >
                        해태
                    </span>
                    <span
                        style={{
                            fontFamily: "Manrope",
                            fontSize: 12,
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            color: "var(--ink)",
                        }}
                    >
                        HAETAE
                    </span>
                </div>

                <div
                    className="meta"
                    style={{
                        display: "flex",
                        gap: 24,
                        flexWrap: "wrap",
                    }}
                >
                    <span>GIWA · chainId 91342</span>
                    <span>~1s blocks</span>
                    <span>Draft · 2026</span>
                </div>

                <div
                    style={{
                        fontFamily: "Fraunces",
                        fontStyle: "italic",
                        fontSize: 13,
                        color: "var(--stone)",
                    }}
                >
                    the chain listens.
                </div>
            </div>
        </footer>
    );
}
