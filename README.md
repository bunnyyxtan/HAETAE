# HAETAE

HAETAE puts every AI agent on GIWA under an on-chain license: minted by a
KYC-verified human principal, checked in-line at every trade, watched by an
autonomous Sentinel, and revocable in about a second. The standard is a draft
ERC — [`IAgentLicense`](standard/ERC-agent-license.md) — and the HAETAE
contracts live on GIWA Sepolia as its reference implementation.

## See it in three minutes

- **Console:** run it yourself with the three commands below, then open
  `/console`. The stage walk is scripted beat-by-beat in [DEMO.md](DEMO.md).
- **No RPC? No problem:** append `?demo=fixtures&delay=0` to the console URL —
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
[`4b43402`](https://github.com/bunnyyxtan/HAETAE/commit/4b43402d0eb1bf67718ab09930f60c2e52990e81).

| Contract | Address |
| --- | --- |
| [`HaetaeLicense`](https://sepolia-explorer.giwa.io/address/0x8CD2BA803a17386B7E702d2aAc3ab19BCd481d93?tab=contract) | `0x8CD2BA803a17386B7E702d2aAc3ab19BCd481d93` |
| [`HaetaePolicy`](https://sepolia-explorer.giwa.io/address/0x57609E6E16ccE5Aa95cBCb6caf0FA96450701845?tab=contract) | `0x57609E6E16ccE5Aa95cBCb6caf0FA96450701845` |
| [`HaetaeGate`](https://sepolia-explorer.giwa.io/address/0xD19895EFa42065c55933bf598D6862725fb0CC88?tab=contract) | `0xD19895EFa42065c55933bf598D6862725fb0CC88` |
| [`SentinelAuthority`](https://sepolia-explorer.giwa.io/address/0xeefEAa1393FfFACa7CaEC495AD96751Cfe1489f4?tab=contract) | `0xeefEAa1393FfFACa7CaEC495AD96751Cfe1489f4` |
| [`DemoVault`](https://sepolia-explorer.giwa.io/address/0x0E0BA989fE16673E471A77607C9a25CDb948e52f?tab=contract) | `0x0E0BA989fE16673E471A77607C9a25CDb948e52f` |
| [`MockUSDC`](https://sepolia-explorer.giwa.io/address/0x5BCa25095105362D4bb7B699DB0accBcC329db15?tab=contract) | `0x5BCa25095105362D4bb7B699DB0accBcC329db15` |
| [`DemoVerifier`](https://sepolia-explorer.giwa.io/address/0x9252458d577Eefc6d994dA2a8604A4920e7504a1?tab=contract) | `0x9252458d577Eefc6d994dA2a8604A4920e7504a1` |

## The five beats — the story, already on-chain

The seeded demo cast played the whole HAETAE arc once, in five public
transactions:

1. **The legal trade.** swap-runner moves 1,200 tUSDC through dex-alpha; the
   Gate walks license → scope → venue → cap and lets it pass.
   [tx ↗](https://sepolia-explorer.giwa.io/tx/0x73139ffef4e5d2f38692cad5cd70e9b529ab29f0911e1d55c0e7ff79775474d1)
2. **The cap refusal.** The same agent asks for 4,500 with 3,800 left in its
   day budget — refused, on-chain, in public.
   [tx ↗](https://sepolia-explorer.giwa.io/tx/0x28b416e0c134a98b9fdcf2baa183fd8f0cf8527cbc8d2453c1038498bb1e9eb4)
3. **The injection.** A prompt-injected yield-scout aims 800 tUSDC at the
   attacker's venue — `VenueNotAllowed`.
   [tx ↗](https://sepolia-explorer.giwa.io/tx/0x7c77a8205405a9e40f8a1a2ca0289fa99985b59a4e35932da044988894ae71f1)
4. **The verdict.** The Sentinel flags yield-scout with a hash-anchored reason;
   license 3 is Revoked in one transaction.
   [tx ↗](https://sepolia-explorer.giwa.io/tx/0xca9c0ab9a98a4ea91f8bdba6b7895e52f7a82866e6ca71aaee902b9a05c335b9)
5. **The ghost.** The revoked agent tries once more — refused, forever.
   [tx ↗](https://sepolia-explorer.giwa.io/tx/0x96fa05c937652f86171d47a6d51c1845038030319dd257c3a55204fec4b6c794)

Anyone can read the revoked license, right now:

```sh
cast call 0x8CD2BA803a17386B7E702d2aAc3ab19BCd481d93 \
  'licenseById(uint256)((address,address,uint64,bytes32,uint8))' 3 \
  --rpc-url https://sepolia-rpc.giwa.io
```

**Demo-grade verifier — not production trust.** The deployed `DemoVerifier`
is permissionless: anyone can attest any address, so a license minted
through it proves flow, not identity. It stands in for GIWA's Verified
Address rail solely so the Phase 2 demo runs end-to-end on today's testnet.
Nothing downstream of this deployment may treat its licenses as
KYC-anchored; production swaps DemoVerifier for the real Dojang / Verified
Address attester before anything leaves testnet.

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
tags `phase-0-done`, `phase-1-done`, CI green. Phase 2 is live: the full spine
and demo stack deployed and Blockscout-verified on GIWA Sepolia, with the
console live-wired across all four tabs (S04–S05, ratified). In flight: the
submission package (S06). Next: Phase 3, ERC-4337 validation-layer
enforcement — the flagship.
