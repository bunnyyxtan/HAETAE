#!/usr/bin/env node
// Build gate: built output must contain ZERO external font-host references.
// Fonts were self-hosted in LOG S01 Addendum 4; this assertion prevents a
// future change from silently reintroducing the Google Fonts link.
// Runs as part of `npm run build` (vite build && node scripts/check-no-external-fonts.mjs).
// Usage: node scripts/check-no-external-fonts.mjs [distDir]
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const dist =
    process.argv[2] ??
    join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const NEEDLES = ["googleapis", "gstatic"];

function* walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(p);
        else if (entry.isFile()) yield p;
    }
}

let files;
try {
    files = [...walk(dist)];
} catch (err) {
    console.error(
        `font-host smoke check: FAIL — cannot read ${dist} (${err.code ?? err.message}); run the build first`,
    );
    process.exit(1);
}
if (files.length === 0) {
    console.error(
        `font-host smoke check: FAIL — ${dist} is empty; run the build first`,
    );
    process.exit(1);
}

const offenders = [];
for (const f of files) {
    const text = readFileSync(f).toString("latin1").toLowerCase();
    for (const n of NEEDLES) {
        if (text.includes(n)) offenders.push(`${relative(dist, f)} contains "${n}"`);
    }
}

if (offenders.length > 0) {
    console.error(
        "font-host smoke check: FAIL — external font-host reference(s) in built output:",
    );
    for (const line of offenders) console.error(`  ${line}`);
    process.exit(1);
}
console.log(
    `font-host smoke check: PASS — ${files.length} files scanned, zero googleapis/gstatic references`,
);
