# MEMORY — HAETAE · updated 2026-07-24 · session-08 · REBOOTED + SUBMISSION-SHAPED

## Where we are
Phase 1 CLOSED (tag phase-1-done, S03). S04 deployed and verified the
seven-contract spine on GIWA Sepolia (chain 91342) and seeded the demo
cast; S05 made all four console tabs real (Registry / Agents / Standard
/ Ledger), live-wired with fixture parity; S06 shipped the submission
package (README judge's landing, DEMO.md stage script, Rehearsal.s.sol
with museum guard); S07 swept the repo judge-clean (no history rewrite).
S08 REBOOTED HISTORY (one-time, human-authorized): main = 207b359, nine
Conventional Commits, single author bunnyyxtan, tags v0.1.0-contracts /
v0.2.0-console-live / v0.3.0-giwa-deploy, CI green (30097708162);
pre-reboot hashes (d5776b9, c1a40a1, a84f32a...) live only in the archived
bundle — see HANDOFF.md. Rewrite ban back in force permanently. OPEN:
S06 stage 2 (human: fund deployer → live rehearsal tx trail; publish →
real URL into README/DEMO). Ratification S06+S07 pending in LOG.

## What exists and works
- contracts/src spine (frozen, ratified S03): HaetaeLicense,
  HaetaePolicy, HaetaeGate, SentinelAuthority, DemoVault + interfaces.
  84/84 Foundry tests green (S07 fresh-clone re-run). DemoVault refuses
  by event (TradeRefused), never reverts the probe.
- standard/ERC-agent-license.md locked; IAgentLicense mirrors it
  exactly; parity is a gate.
- deployments/giwa-sepolia.json = single source of truth for the seven
  verified addresses (Blockscout links in README table, all curl-200).
- web/ console: four real tabs, live GIWA reads (registry multicall +
  one batched 5-getLogs scan; Standard = zero reads), fixture mode
  ?demo=fixtures (&delay=N knob), hash deep-links (#agents/#standard/
  #ledger). Self-contained package: builds standalone via cd web && npm
  install && npm run build (font-host smoke inside the build).
- contracts/script/Rehearsal.s.sol: R1–R5 beat arc, idempotent, museum
  guard (CastCollision / MuseumAgent reverts) — awaits funded run.
- DEMO.md at root: 3-minute script + contingency + live-beats env block.

## Repo shape after S07 (law for future sessions)
- Root: README, ARCHITECTURE, DEMO, LICENSE, contracts/, standard/,
  deployments/, web/, docs/, scripts/ (post-merge hook only) + build
  plumbing (.github/, .replit, replit.nix, pnpm files, tsconfigs).
- docs/process/: LOG, HANDOFF, MEMORY (this file), RULES, PHASES, PRD,
  PROMPTS, SESSION_PROTOCOL, replit.md. Read order unchanged, paths new.
- DELETED: lib/* (workspace packages), sdk/, indexer/, sentinel/,
  agents/ stubs, scripts/src. attached_assets/ untracked+ignored.
- artifacts/ (landing shim, api-server, mockup-sandbox) is TRACKED and
  must stay tracked — the Replit registry deregisters previews and
  deletes workflows when it goes git-invisible (proven mid-S07; recovery
  = re-track + toml revalidation). It is workspace plumbing, not
  submission surface; README never points at it.
- web/package.json declares @tanstack/react-query (wagmi peer) since
  S07 — before that it rode a hoisting phantom via deleted lib/.

## Standing rulings (carry forward)
- WalletConnect permanently rejected (S06); removal comments in web/src
  are ruling documentation.
- Museum cast: anvil/public dev keys carry EIP-7702 sweeper delegations
  on live testnets — fresh keccak-derived keys only; Rehearsal.s.sol
  self-enforces.
- Ticker label honesty ruling scoped: header ticker says "~1s blocks";
  landing "one block, one second" copy is frozen marketing surface.
- Keys env-only (PRINCIPAL_PK, SENTINEL_PK, DEPLOYER_PK, SWAP_RUNNER_PK,
  YIELD_SCOUT_PK + fresh REHEARSAL key at run time). Never in files,
  logs, chat, or argv.
- Numbering alias: human's "SESSION N ORDER" = LOG S(N+1), twice
  running. Log under LOG numbering, note alias inline.

## Env facts
GIWA Sepolia: chain 91342, RPC https://sepolia-rpc.giwa.io, explorer
https://sepolia-explorer.giwa.io, faucet sepolia-playground.giwa.io.
Deployer 0x3Af656d9Ad1307543623133bDB64A39599E08E4B (needs ~0.01 ETH for
rehearsal). CI: frozen-lockfile pnpm install → forge fmt/build/test →
root typecheck → pnpm -r test. Push auth: basic-scheme extraheader,
b64(x-access-token:PAT), GIT_CONFIG_* env, helper disabled.
