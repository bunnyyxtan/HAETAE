# HAETAE

HAETAE puts every AI agent on GIWA under an on-chain license: minted by a
KYC-verified human principal, checked in-line at every trade, watched by an
autonomous Sentinel, and revocable in about a second. The standard is a draft
ERC — [`IAgentLicense`](standard/ERC-agent-license.md) — and the HAETAE
contracts live on GIWA Sepolia as its reference implementation.

## See it in three minutes

- **Console:** run it yourself with the three commands below, then open
  `/console`. The stage walk is scripted beat-by-beat in [DEMO.md](DEMO.md).
- **No RPC? No problem:** append `?sandbox&delay=0` to the console URL —
  the entire walk works offline from fixtures.

```sh
git submodule update --init --recursive   # 1 · pinned contract deps (once)
cd web && npm install && npm run dev      # 2 · the console, at /console
cd contracts && forge build               # 3 · the contracts (optional)
```

## Deployed & verified — GIWA Sepolia (chain 91342)

Every address below is Blockscout-verified. `deployments/giwa-sepolia.json` is
the single source of truth — the console imports it directly. Deployed from
commit
`a394800`.

| Contract | Address |
| --- | --- |
| [`HaetaeLicense`](https://sepolia-explorer.giwa.io/address/0x7409E7Dc675f13957343340D2a6935fACA0773f8?tab=contract) | `0x7409E7Dc675f13957343340D2a6935fACA0773f8` |
| [`HaetaePolicy`](https://sepolia-explorer.giwa.io/address/0xF8f909C5Dc9D0e80D5E1b0332450fAF3D79D9C7d?tab=contract) | `0xF8f909C5Dc9D0e80D5E1b0332450fAF3D79D9C7d` |
| [`HaetaeGate`](https://sepolia-explorer.giwa.io/address/0x82345FC04BDaa853A11115C557B1c54dF9dc48EF?tab=contract) | `0x82345FC04BDaa853A11115C557B1c54dF9dc48EF` |
| [`SentinelAuthority`](https://sepolia-explorer.giwa.io/address/0xE5f518d0F2326878cd248785eA54B82B7dE2E359?tab=contract) | `0xE5f518d0F2326878cd248785eA54B82B7dE2E359` |
| [`ReferenceVault`](https://sepolia-explorer.giwa.io/address/0xb419F747AF35490F6c8e26aA2A07B1AbEc126879?tab=contract) | `0xb419F747AF35490F6c8e26aA2A07B1AbEc126879` |
| [`TestUSDC`](https://sepolia-explorer.giwa.io/address/0x3f9EC3DBFEca9ddc6c41A7f8924C39665EBfCE12?tab=contract) | `0x3f9EC3DBFEca9ddc6c41A7f8924C39665EBfCE12` |
| [`HaetaeDojang`](https://sepolia-explorer.giwa.io/address/0x93F054B9F9f957e323C66A4c4D8A03a67dA15F1B?tab=contract) | `0x93F054B9F9f957e323C66A4c4D8A03a67dA15F1B` |
| [`SandboxVerifier`](https://sepolia-explorer.giwa.io/address/0x0be98AC93313172791BCF5Aaf19ef28bB9265Cba?tab=contract) | `0x0be98AC93313172791BCF5Aaf19ef28bB9265Cba` |

The live registry starts empty by design — no fictional demo cast is seeded.
Scripted fixtures live exclusively behind the console's `?sandbox` mode
and are labeled as such.

## The five beats — one real rehearsal, already on-chain

A rehearsal agent (scratch key, scope `rehearsal`, licensed by a
Dojang-verified principal) played the whole HAETAE arc exactly once, in five
public transactions:

1. **The legal trade.** The rehearsal agent moves 300 tUSDC through dex-alpha;
   the Gate walks license → scope → venue → cap and lets it pass.
   [tx ↗](https://sepolia-explorer.giwa.io/tx/0x1503bbc1ff6e0b86555a9e49efc4aa7ce8672eb999166c50c1dfaeea430263fb)
2. **The cap refusal.** The same agent asks for 1,900 with 1,700 left in its
   day budget — refused, on-chain, in public.
   [tx ↗](https://sepolia-explorer.giwa.io/tx/0xb7403ff1b13e0e4a4758d5fa6326f6384d0d62e1f121936fcfd7bcccbaa13cd6)
3. **The injection.** The agent aims 100 tUSDC at the attacker's venue —
   `VenueNotAllowed`.
   [tx ↗](https://sepolia-explorer.giwa.io/tx/0xfaf47ec155aba61c2724751c802d3be6f7f0a8a8733f54665fd2aa48c4f64de8)
4. **The verdict.** The Sentinel flags the agent with a hash-anchored reason;
   license 1 is Revoked in one transaction.
   [tx ↗](https://sepolia-explorer.giwa.io/tx/0x68eb591733756c77d715689028a10da9822dc8cd5f69c23b03ba135147097fa5)
5. **The ghost.** The revoked agent tries once more — refused, forever.
   [tx ↗](https://sepolia-explorer.giwa.io/tx/0xe3575e7736fea5ffdb68362395d815ae350565bd5dfe0a9235d0bc82d75f09cf)

Anyone can read the revoked license, right now:

```sh
cast call 0x7409E7Dc675f13957343340D2a6935fACA0773f8 \
  'licenseById(uint256)((address,address,uint64,bytes32,uint8))' 1 \
  --rpc-url https://sepolia-rpc.giwa.io
```

**Demo-grade verifier — not production trust.** The deployed `SandboxVerifier`
is permissionless: anyone can attest any address, so a license minted
through it proves flow, not identity. It stands in for GIWA's Verified
Address rail solely so the Phase 2 demo runs end-to-end on today's testnet.
The license gate now runs through `HaetaeDojang` — a dual-lane verifier
(GIWA DojangScroll Upbit lane OR a registered HAETAE EAS attestation).
On this testnet the HAETAE lane is live with a project attester; production
narrows to the Upbit Dojang lane by constructor arguments alone.

## Stack

| Layer | Choice |
| --- | --- |
| Contracts | Solidity ^0.8.24, Foundry; OpenZeppelin v5.6.1, EAS v1.4.0, EntryPoint v0.7 (exact-pinned submodules) |
| SDK | TypeScript + viem (tsup, vitest) |
| Services | Node 22 + TypeScript, Hono, better-sqlite3, zod, pino |
| Web | Vite + React 19 + TypeScript, wagmi v2 + viem, hand-written CSS |
| CI | GitHub Actions: forge gate + workspace typecheck/test |

## Development

Full CI mirror (what `.github/workflows/ci.yml` runs):

```sh
pnpm install --frozen-lockfile && pnpm run typecheck && pnpm -r test
cd contracts && forge build
```

`sdk/`, `indexer/`, `sentinel/`, and `agents/` are phase-gated skeletons —
they gain source when their phase opens (see docs/process/PHASES.md).

## Repository law

Read order: docs/process/RULES.md > docs/process/PHASES.md > ARCHITECTURE.md
> docs/process/PRD.md. Session state lives in docs/process/: HANDOFF.md
(start here), LOG.md, and MEMORY.md. Root pnpm
workspace files (`artifacts/`, `lib/`, `scripts/`, root tsconfigs) are
Replit environment plumbing, not product code (LOG S01, Addendum 3).

## Status

Phase 0 (bootstrap + landing) and Phase 1 (License Registry spine) are closed —
release tags now follow the post-reboot `v0.x.y-slug` scheme (`v0.1.0-contracts` onward), CI green. Phase 2 is live: the full spine
and demo stack deployed and Blockscout-verified on GIWA Sepolia, with the
console live-wired across all four tabs (S04–S05, ratified). In flight: the
submission package (S06). Next: Phase 3, ERC-4337 validation-layer
enforcement — the flagship.
