# HAETAE — Architecture

**Version 2.0 (FULL PRODUCTION SCOPE) · 22 Jul 2026 · Read docs/process/PRD.md first. The tree here is LAW — see docs/process/RULES.md R2.**

## 1. Stack (locked)

| Layer | Choice | Why |
| --- | --- | --- |
| Contracts | Solidity ^0.8.24, **Foundry** | Mirrors GIWA's own dojang repo conventions |
| Contract deps | OpenZeppelin, forge-std, EAS interfaces (dojang deployments), @account-abstraction/contracts (EntryPoint v0.7 interfaces) | Audited, minimal |
| Monorepo | **pnpm workspaces** | contracts / sdk / indexer / sentinel / agents / web |
| SDK | TypeScript + **viem** only; built with tsup; tested with vitest | Zero-dep credibility for integrators |
| Services (indexer, sentinel) | Node 22 + TypeScript, **Hono** (HTTP), **better-sqlite3**, **zod** (config), **pino** (logs) | Boring, restart-safe, no ORM |
| Frontend | Vite + React + TS, wagmi v2 + viem | No framework ceremony |
| Styling | Hand-written CSS, semantic markup | Design.md arrives separately; reskin without rewiring |
| CI | GitHub Actions: forge test + coverage + slither, pnpm -r typecheck/test | Green main branch is law |

## 2. Contract map (production set)

| Contract | Responsibility |
| --- | --- |
| `interfaces/IAgentLicense.sol` | **The standard.** Minimal interface + events the ERC draft specifies |
| `interfaces/IVerifiedAddress.sol` | Isolation seam for Dojang/EAS |
| `HaetaeLicense.sol` | SBT registry implementing `IAgentLicense`; mint gated by Verified Address; revoke paths: principal + `SENTINEL_ROLE`; expiry; enumeration |
| `HaetaePolicy.sol` | Per-agent policy: per-tx cap, rolling 24h budget, target allowlist, selector allowlist; `check(agent,target,selector,value) → (bool, bytes32 reason)` |
| `HaetaeGate.sol` | Abstract guard for any dApp: `modifier haetaeGuarded(...)`; custom errors |
| `integrations/DojangVerifiedAddress.sol` | Real EAS attestation lookup (schema UID pinned, fork-tested) |
| `aa/HaetaeValidator.sol` | ERC-4337 validation-phase enforcement module: license + policy check inside `validateUserOp` path (ERC-7579-style module) |
| `aa/HaetaePaymaster.sol` | Sponsors gas ONLY for licensed, policy-clean UserOps; staked with EntryPoint |
| `sentinel/SentinelAuthority.sol` | Role management + rate-limited delegated revocation with on-chain reason codes |
| `examples/DemoVault.sol` | Gated demo action; the prompt-injection theater target |

## 3. Flows (canonical)

```
MINT   principal (Dojang Verified Address) ▶ HaetaeLicense.mint(agent, expiry, scope)

ACT/CONTRACT   agent ▶ DemoVault.execute ▶ haetaeGuarded ▶ License.isValid + Policy.check
               fail ▶ revert NotLicensed() | PolicyViolation(reason)

ACT/4337   agent UserOp ▶ rundler ▶ EntryPoint ▶ HaetaeValidator.validateUserOp
           unlicensed/violating ▶ rejected BEFORE execution (never hits a block)
           HaetaePaymaster refuses sponsorship on the same checks

WATCH  indexer ▶ SQLite ▶ Trust Feed API ▶ web feed + verify pages
       sentinel ▶ rules over event stream ▶ SentinelAuthority.revoke(reason) ▶ notify

KILL   principal one-click OR sentinel auto ▶ revoke ▶ next action reverts everywhere < 2s
```

## 4. Repository tree (hard budget: ~70 source files — additions need human sign-off)

```
haetae/
├── ARCHITECTURE.md README.md DEMO.md LICENSE
├── docs/process/  (PRD RULES PHASES SESSION_PROTOCOL PROMPTS MEMORY LOG HANDOFF replit.md)
├── package.json  pnpm-workspace.yaml  .github/workflows/ci.yml
├── contracts/
│   ├── foundry.toml  remappings.txt
│   ├── src/
│   │   ├── HaetaeLicense.sol  HaetaePolicy.sol  HaetaeGate.sol
│   │   ├── interfaces/{IAgentLicense.sol, IVerifiedAddress.sol}
│   │   ├── integrations/DojangVerifiedAddress.sol
│   │   ├── aa/{HaetaeValidator.sol, HaetaePaymaster.sol}
│   │   ├── sentinel/SentinelAuthority.sol
│   │   └── examples/DemoVault.sol
│   ├── script/{Deploy.s.sol, DeployAA.s.sol}
│   └── test/{License.t.sol, Policy.t.sol, Gate.t.sol, Validator.t.sol,
│            Paymaster.t.sol, Sentinel.t.sol, DemoFlow.t.sol, fork/Dojang.fork.t.sol}
├── standard/ERC-agent-license.md        # draft spec; IAgentLicense is its interface
├── sdk/                                 # @haetae/sdk
│   └── src/{index.ts, license.ts, policy.ts, watch.ts, errors.ts} + test/
├── indexer/
│   └── src/{main.ts, ingest.ts, db.ts, api.ts, config.ts}
├── sentinel/
│   └── src/{main.ts, rules.ts, actions.ts, notify.ts, config.ts}
├── agents/demo-agent/{run.ts, inject.ts}
└── web/
    ├── index.html vite.config.ts package.json tsconfig.json
    └── src/
        ├── main.tsx App.tsx styles.css
        ├── config/{chain.ts, addresses.ts, abis.ts}
        ├── hooks/{useLicense.ts, usePolicy.ts, useTrustFeed.ts, useSentinel.ts}
        └── views/{MintLicense.tsx, PolicyEditor.tsx, AgentConsole.tsx,
                  TrustFeed.tsx, SentinelPanel.tsx, VerifyAgent.tsx}
```

LOC budgets: contracts ≤ 250 · tests ≤ 300 · service files ≤ 200 · SDK files ≤ 150 · views ≤ 180 · hooks ≤ 100.

## 5. Key decisions (settled — do not reopen without human sign-off)

| Decision | Choice | Why |
| --- | --- | --- |
| 4337 enforcement shape | Validator module (7579-style) + Paymaster, against standard EntryPoint v0.7 + GIWA rundler | Enforce without shipping a whole smart-account implementation |
| Dual enforcement | Contract gate AND 4337 layer both ship | dApps without AA still get protection; AA path is the flagship |
| Sentinel authority | On-chain role with rate-limit + reason codes; watcher itself stays off-chain and rule-based | Auto-revoke power must be bounded and auditable; no "AI decides" hand-waving |
| License token | ERC-721 with reverting transfers | Simplest credible SBT |
| Indexer storage | better-sqlite3, single file DB | Restart-safe, zero infra; Postgres is a swap-later seam |
| Trust Feed reads | Web reads indexer API; falls back to viem getLogs if API down | Honest degradation |
| Wallets | PRINCIPAL, AGENT, SENTINEL keys, separated roles, in .env | Sentinel key can only revoke, never spend |
| Standard-first naming | Public surface uses IAgentLicense names | The ERC draft and the code never drift |
