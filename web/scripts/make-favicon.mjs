#!/usr/bin/env node
// Generates web/public/favicon.ico — 32×32 PNG-in-ICO, drawn in code (zero deps).
// Design: solid vermillion rounded-square seal (--vermillion #C8341C, the SEAL
// color per styles.css), transparent background, geometry identical to
// favicon.svg (rect 2,2 28×28 r7). The SVG carries the 해 glyph for modern
// browsers; this ICO is the legacy / direct-/favicon.ico-request fallback.
// Re-run to regenerate: node scripts/make-favicon.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 32;
const FILL = [0xc8, 0x34, 0x1c]; // --vermillion
const RECT = { x: 2, y: 2, w: 28, h: 28, r: 7 };

// Signed distance to rounded rect, sampled at pixel centers, ~1px anti-alias.
function alphaAt(px, py) {
    const cx = RECT.x + RECT.w / 2;
    const cy = RECT.y + RECT.h / 2;
    const hx = RECT.w / 2 - RECT.r;
    const hy = RECT.h / 2 - RECT.r;
    const qx = Math.abs(px - cx) - hx;
    const qy = Math.abs(py - cy) - hy;
    const d =
        Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
        Math.min(Math.max(qx, qy), 0) -
        RECT.r;
    return Math.min(1, Math.max(0, 0.5 - d));
}

// Raw scanlines: 1 filter byte (0 = None) + 32 RGBA pixels per row.
const raw = Buffer.alloc(SIZE * (1 + SIZE * 4));
let o = 0;
for (let y = 0; y < SIZE; y++) {
    raw[o++] = 0;
    for (let x = 0; x < SIZE; x++) {
        raw[o++] = FILL[0];
        raw[o++] = FILL[1];
        raw[o++] = FILL[2];
        raw[o++] = Math.round(alphaAt(x + 0.5, y + 0.5) * 255);
    }
}

const CRC_TABLE = [];
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    CRC_TABLE[n] = c >>> 0;
}
function crc32(buf) {
    let c = 0xffffffff;
    for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
    const t = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type: RGBA
const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
]);

// ICO container: ICONDIR (6) + one ICONDIRENTRY (16) + PNG payload.
const ico = Buffer.alloc(22 + png.length);
ico.writeUInt16LE(0, 0); // reserved
ico.writeUInt16LE(1, 2); // type: icon
ico.writeUInt16LE(1, 4); // image count
ico[6] = SIZE; // width
ico[7] = SIZE; // height
ico[8] = 0; // palette count
ico[9] = 0; // reserved
ico.writeUInt16LE(1, 10); // color planes
ico.writeUInt16LE(32, 12); // bits per pixel
ico.writeUInt32LE(png.length, 14); // payload size
ico.writeUInt32LE(22, 18); // payload offset
png.copy(ico, 22);

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "favicon.ico");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, ico);
console.log(`wrote ${out} (${ico.length} bytes, PNG-in-ICO 32x32)`);
