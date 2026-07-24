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
`5286c97`.

| Contract | Address |
| --- | --- |
| [`HaetaeLicense`](https://sepolia-explorer.giwa.io/address/0x1a70E5DA8895bEc96eCa6c87E29988b380dFEe40?tab=contract) | `0x1a70E5DA8895bEc96eCa6c87E29988b380dFEe40` |
| [`HaetaePolicy`](https://sepolia-explorer.giwa.io/address/0x6f5Bb9764847d0500262D7F092E4a6999E0b6a33?tab=contract) | `0x6f5Bb9764847d0500262D7F092E4a6999E0b6a33` |
| [`HaetaeGate`](https://sepolia-explorer.giwa.io/address/0x6600dC76377089D814A6575d6c43D19D7D66dF99?tab=contract) | `0x6600dC76377089D814A6575d6c43D19D7D66dF99` |
| [`SentinelAuthority`](https://sepolia-explorer.giwa.io/address/0x145f77a1545f3A5953477f2E4c9EC02d99327976?tab=contract) | `0x145f77a1545f3A5953477f2E4c9EC02d99327976` |
| [`DemoVault`](https://sepolia-explorer.giwa.io/address/0xB57D465b97A1e9db46BB063E410E94765C9Dc564?tab=contract) | `0xB57D465b97A1e9db46BB063E410E94765C9Dc564` |
| [`MockUSDC`](https://sepolia-explorer.giwa.io/address/0xEF35A848a3dF83Eed3d5DC93BA291FF99e5EEe19?tab=contract) | `0xEF35A848a3dF83Eed3d5DC93BA291FF99e5EEe19` |
| [`HaetaeDojang`](https://sepolia-explorer.giwa.io/address/0x1bD4b3284B73095179f00Ff566C9165B57ec9648?tab=contract) | `0x1bD4b3284B73095179f00Ff566C9165B57ec9648` |
| [`DemoVerifier`](https://sepolia-explorer.giwa.io/address/0xd657fc11C4dff7955f56838055b5e87114457498?tab=contract) | `0xd657fc11C4dff7955f56838055b5e87114457498` |

The live registry starts empty by design — no fictional demo cast is seeded.
Scripted fixtures live exclusively behind the console's `?demo=fixtures` mode
and are labeled as such.

## The five beats — one real rehearsal, already on-chain

A rehearsal agent (scratch key, scope `rehearsal`, licensed by a
Dojang-verified principal) played the whole HAETAE arc exactly once, in five
public transactions:

1. **The legal trade.** The rehearsal agent moves 300 tUSDC through dex-alpha;
   the Gate walks license → scope → venue → cap and lets it pass.
   [tx ↗](https://sepolia-explorer.giwa.io/tx/0xc77cf848e837abcd0b5ae966707fe84933231ba6de622f5ba23a5746177558ec)
2. **The cap refusal.** The same agent asks for 1,900 with 1,700 left in its
   day budget — refused, on-chain, in public.
   [tx ↗](https://sepolia-explorer.giwa.io/tx/0xaeb00c188fc6325cfb7ad3177b17ae7fe2e66a46eeac29153fe68f9481d7f32d)
3. **The injection.** The agent aims 100 tUSDC at the attacker's venue —
   `VenueNotAllowed`.
   [tx ↗](https://sepolia-explorer.giwa.io/tx/0x4296fb379086c348bf2b50249012825f01e2cdda03f6aa5f7cefe6b2d78feb32)
4. **The verdict.** The Sentinel flags the agent with a hash-anchored reason;
   license 1 is Revoked in one transaction.
   [tx ↗](https://sepolia-explorer.giwa.io/tx/0x823f99c05ba7940e53e26f9b8d3b326f05e52e6f015952fa8bb52ce7d2ac1b37)
5. **The ghost.** The revoked agent tries once more — refused, forever.
   [tx ↗](https://sepolia-explorer.giwa.io/tx/0x59e854c885a1a7707175ff3c2ca4735cc005732b0d0bd1fc439fa4aeb0e82de6)

Anyone can read the revoked license, right now:

```sh
cast call 0x1a70E5DA8895bEc96eCa6c87E29988b380dFEe40 \
  'licenseById(uint256)((address,address,uint64,bytes32,uint8))' 1 \
  --rpc-url https://sepolia-rpc.giwa.io
```

**Demo-grade verifier — not production trust.** The deployed `DemoVerifier`
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
