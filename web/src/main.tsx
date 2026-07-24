import "./assets/fonts/fonts.css";
import React from "react";
import ReactDOM from "react-dom/client";
import "@/styles.css";
import App from "@/App";
import { initSettings } from "@/utils/settings";

initSettings();

const rootEl = document.getElementById("root");
if (!rootEl) {
    throw new Error("Root element #root not found");
}

ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
