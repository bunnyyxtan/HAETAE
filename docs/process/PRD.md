# HAETAE — Product Requirements Document

**Version 2.0 (FULL PRODUCTION SCOPE) · 22 Jul 2026 · Owner: Ranbir · Target: production-grade on GIWA Sepolia, mainnet-ready**

> **North star:** Every AI agent carries a verifiable on-chain license bound to a KYC-verified human — enforced at the account-abstraction validation layer, watched by an autonomous Sentinel, revocable in under one second, consumable by any dApp through one SDK call, and specified as a draft ERC with HAETAE as the reference implementation.

**Scope doctrine v2:** There is no deadline-driven cut. Everything below is a build target at production quality. Quality gates replace deadlines — a feature ships when its gate passes, and phases are sequenced by dependency, not calendar.

---

## 1. Problem

AI agents hold wallets and move money. No chain can answer: *was this agent allowed to do that, and which human answers for it?* GIWA ships the primitives — Dojang (EAS attestations) and Verified Address (KYC-anchored identity) — but nothing consumes them. HAETAE is the trust rail: licensing, policy, enforcement, observability, and a standard.

## 2. Users

| User | Need | How HAETAE serves it |
| --- | --- | --- |
| **Agent operator** (human principal) | Deploy agents with money without losing sleep | Mint license, plain-language policy, one-click + automated kill switch |
| **dApp / protocol dev on GIWA** | Reject rogue agents with zero integration pain | `@haetae/sdk`: `isLicensed(agent, target, value)`; or inherit `HaetaeGate` |
| **Smart-account / wallet devs** | Enforce before execution, not after | 4337 validator module + paymaster that only serves licensed agents |
| **Ecosystem (GIWA team, judges, other chains)** | A standard for agent accountability | Draft ERC `IAgentLicense` + HAETAE as reference implementation |

## 3. System pillars (all in scope, all production)

1. **License Registry** — non-transferable license SBT bound to a Dojang-verified human principal.
2. **Policy Vault** — on-chain spend caps, budgets, allowlists per agent.
3. **Enforcement, two layers** — (a) contract-level `HaetaeGate` for any dApp; (b) **ERC-4337 validation-phase**: validator module + paymaster so unlicensed/violating UserOps die before execution, verified end-to-end against GIWA's rundler.
4. **Sentinel** — autonomous rule-based watcher with delegated revocation authority: detects violation patterns, auto-revokes, notifies.
5. **Trust Feed** — indexer-backed live observability API + UI over every license, policy, violation, and revocation event.
6. **SDK** — `@haetae/sdk` (TypeScript/viem): license checks, policy reads, event watching, typed error decoding.
7. **Standard** — `standard/ERC-agent-license.md` draft + `IAgentLicense.sol` reference interface; HAETAE contracts are the reference implementation.

## 4. Features & acceptance criteria

| # | Feature | Acceptance criteria |
| --- | --- | --- |
| F1 | Verification gate | Mint reverts without a valid Dojang Verified Address attestation (real EAS integration — no mock in any deployed path) |
| F2 | License SBT | ERC-721, transfers revert; principal, agent, expiry, scope; one active license per agent; enumerable per principal |
| F3 | Policy vault | Per-tx cap, rolling 24h budget, target allowlist, function-selector allowlist; principal-only writes; `check` returns named reason |
| F4 | Contract gate | `HaetaeGate` abstract + `DemoVault` example; custom errors name the exact violation |
| F5 | 4337 enforcement | Validator module rejects violating UserOps in validation phase; `HaetaePaymaster` sponsors only licensed agents; e2e test through EntryPoint + rundler on GIWA Sepolia |
| F6 | Revocation | Manual (principal) + delegated (Sentinel authority); next agent action reverts; measured propagation < 2s |
| F7 | Trust Feed | Indexer ingests all protocol events into SQLite; REST API; UI feed with explorer links; survives restart; backfills from deploy block |
| F8 | SDK | Published package (local tarball ok): `isLicensed`, `getPolicy`, `watchAgent`, `decodeHaetaeError`; typed; zero runtime deps beyond viem; ≥90% test coverage |
| F9 | Sentinel | Configurable rules (velocity, repeated violations, expiry drift); auto-revoke via `SENTINEL_ROLE`; webhook notify; dry-run mode; every action logged and replayable |
| F10 | Public verify page | `web/verify/<agent-address>`: license status, policy summary, violation history — shareable proof-of-accountability |
| F11 | Demo agent | Scripted agent (`agents/demo-agent`) that acts legally, then is prompt-injected live and fails structurally; the theater is reproducible with one command |
| F12 | ERC draft | Complete spec (motivation, interface, events, rationale, security); `IAgentLicense.sol` compiled + implemented by `HaetaeLicense` |

## 5. Out of scope (product strategy, not time)

**Only three things:** a token (no token exists on GIWA; shipping one is brand damage) · non-GIWA deployments (the standard is chain-agnostic on paper; deployments are GIWA-only for the ecosystem story) · native mobile apps (responsive web serves it).

## 6. Success criteria (production definition of done)

1. Full loop live on **GIWA Sepolia** including the 4337 path: mint → licensed UserOp executes → violating UserOp rejected in validation → Sentinel auto-revoke → agent dead everywhere. Real receipts, zero mocks.
2. All contracts **verified on Blockscout**; `forge test` green with ≥90% line coverage on `src/`; Slither clean or every finding triaged in LOG.md; NatSpec on every public function.
3. Indexer + Sentinel run as services with structured logs, typed config, graceful shutdown; restart-safe.
4. SDK tests green; a third-party integration example compiles against it.
5. README: architecture diagram, deployed addresses, one-command demo, standard link. `standard/ERC-agent-license.md` complete.
6. Mainnet-readiness checklist complete (audit-prep doc, upgrade/ownership policy, key rotation runbook).

## 7. Network facts (single source of truth)

| Item | Value |
| --- | --- |
| Chain | GIWA Sepolia, chain ID **91342** |
| RPC | `https://sepolia-rpc.giwa.io` |
| Explorer | `https://sepolia-explorer.giwa.io` (Blockscout) |
| Faucet / onboarding | `https://sepolia-playground.giwa.io` (Dojang issuance, up.id) |
| Dojang contracts | `https://github.com/giwa-io/dojang` (EAS-based; use deployed testnet addresses) |
| 4337 infra | GIWA maintains `rundler` (github.com/giwa-io/rundler); standard EntryPoint |
| Docs | `https://docs.giwa.io` |
