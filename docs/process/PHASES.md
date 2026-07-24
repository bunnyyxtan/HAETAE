# HAETAE — Phases

**Version 2.0 (FULL PRODUCTION SCOPE). No calendar. Phases are sequenced by DEPENDENCY and gated by binary exit criteria. The order is law: a capable agent moving fast out of order produces fast slop. A phase is done when every box checks and the exit commit is tagged.**

---

## Phase 0 — Monorepo bootstrap

**Goal:** empty-but-correct skeleton; environment and CI proven.

- pnpm workspace with the exact ARCHITECTURE.md tree; `.gitignore` (`.env` from commit zero); `.env.example` with PRINCIPAL_PK / AGENT_PK / SENTINEL_PK placeholders.
- Foundry configured (OpenZeppelin, forge-std, @account-abstraction/contracts, EAS interfaces); `forge build` green.
- Web boots on wagmi + GIWA Sepolia (91342); wallet connects; chain badge renders.
- CI workflow runs the full gate (forge test, pnpm -r typecheck/test) on push.
- **Human tasks:** faucet-fund PRINCIPAL/AGENT/SENTINEL; Dojang Verified Address for PRINCIPAL; up.id.
- **Exit:** CI green on the skeleton. Tag `phase-0-done`.

## Phase 1 — Core protocol contracts (local)

**Goal:** the standard's surface + core loop green locally; Dojang behind `IVerifiedAddress`.

- `IAgentLicense.sol` first — the interface IS the future ERC; names locked here.
- `HaetaeLicense` (SBT, dual revoke paths incl. `SENTINEL_ROLE` stub), `HaetaePolicy` (caps, budget, target + selector allowlists), `HaetaeGate` + `examples/DemoVault`, `sentinel/SentinelAuthority` (role, rate limit, reason codes).
- Full test matrix per RULES.md R4.2–3 (except fork/AA tests — later phases).
- **Forbidden:** frontend, services, 4337, testnet deploys.
- **Exit:** forge test green; coverage ≥ 90%; Slither triaged. Tag `phase-1-done`.

## Phase 2 — GIWA integration: real Dojang, real deployment

**Goal:** real chain, real attestations, verified contracts.

- `integrations/DojangVerifiedAddress.sol` against the real EAS deployment (addresses + schema UID from github.com/giwa-io/dojang and docs.giwa.io); `fork/Dojang.fork.t.sol` proves it against a live playground-issued attestation.
- `Deploy.s.sol` with 91342 assertion; addresses → `web/src/config/addresses.ts` + MEMORY.md; **all contracts verified on Blockscout**.
- On-chain proof transcript (mint → act → violate → revoke) with explorer links in LOG.md.
- **No mock fallback in v2.** If Dojang blocks you, it's a top-of-HANDOFF blocker escalated to the human — never faked, never silently deferred.
- **Exit:** verified addresses + fork test green + transcript. Tag `phase-2-done`.

## Phase 3 — Account-abstraction enforcement (the flagship)

**Goal:** violations die in the validation phase, proven through GIWA's own rundler.

- `aa/HaetaeValidator.sol` (7579-style module: license + policy checks in `validateUserOp` path) and `aa/HaetaePaymaster.sol` (sponsors only clean UserOps; stake/deposit = human GO).
- `Validator.t.sol` / `Paymaster.t.sol` against a real EntryPoint locally; then e2e on GIWA Sepolia: licensed UserOp lands, violating UserOp rejected pre-execution via rundler.
- **Exit:** both e2e transcripts (accept + reject) with explorer/bundler evidence in LOG.md. Tag `phase-3-done`.

## Phase 4 — SDK + indexer + Trust Feed API

**Goal:** the protocol becomes consumable and observable.

- `@haetae/sdk`: `isLicensed`, `getPolicy`, `watchAgent`, `decodeHaetaeError`; vitest ≥ 90%; tarball + integration example.
- Indexer: idempotent ingestion from deploy block → SQLite; Hono REST (`/agents/:addr`, `/feed`, `/violations`); restart-safe.
- **Exit:** SDK example runs against live testnet; API serves full backfilled history after a cold restart. Tag `phase-4-done`.

## Phase 5 — Sentinel

**Goal:** autonomous, bounded, auditable enforcement.

- Rules engine (velocity, repeated violations, expiry drift) over the indexer stream; actions via `SENTINEL_ROLE` (rate-limited, reason-coded); webhook notify; **dry-run mode first** — live auto-revoke only after human reviews dry-run output.
- **Exit:** live demo of rule-tripped auto-revoke on testnet, replayable from logs. Tag `phase-5-done`.

## Phase 6 — Web app (all six views)

**Goal:** the full product surface, wired to live contracts + Trust Feed API.

- `MintLicense`, `PolicyEditor` (plain-language policy summary), `AgentConsole` (drive the demo agent), `TrustFeed` (live, API-backed with getLogs fallback), `SentinelPanel` (rules, dry-run output, action history), `VerifyAgent` (public shareable page).
- Every async state per RULES.md R4.6. Semantic markup; minimal CSS; Design.md reskins later without rewiring.
- **Exit:** every PRD F-feature clickable by a human, zero console usage. Tag `phase-6-done`.

## Phase 7 — Standard, hardening, demo package

**Goal:** reference-implementation grade.

- `standard/ERC-agent-license.md` complete (motivation, spec, rationale, security considerations, reference implementation pointer).
- `agents/demo-agent` one-command theater: legal trade → live prompt injection → structural failure → sentinel/manual revoke → ghost.
- Hardening: coverage/Slither/gas final pass; audit-prep doc; key-rotation + ownership runbook; mainnet-readiness checklist.
- README: architecture diagram, addresses, one-command demo, SDK quickstart, standard link.
- **Exit:** PRD §6 success criteria all green. Tag `v1.0-haetae`.

---

### Sequencing guardrails (replace the old calendar)

| Gate | Must be true before |
| --- | --- |
| Phase 3 starts | Phase 2 verified on Blockscout (AA builds on deployed core) |
| Phase 5 starts | Phase 4 indexer stable (Sentinel consumes its stream) |
| Sentinel goes live | Human has reviewed dry-run output (RULES.md R5.2) |
| Any GASOK submission cut | Whatever phases are DONE ship as-is; unfinished phases are roadmap — never demo vaporware |
