# HANDOFF — read me first

Updated 2026-07-24, end of S08 (REPO REBOOT). Numbering alias: the human's
"SESSION N ORDER" headers run one behind LOG numbering (their N = LOG S(N+1));
the reboot order arrived unnumbered and is logged as S08.

## State

- **History rebooted 2026-07-24** (one-time, human-authorized). main =
  `207b359` — 9 curated Conventional Commits, all authored/committed as
  bunnyyxtan. CI green (run 30097708162). Contributors API: bunnyyxtan only.
- Old history (48 commits, phase tags, stray branches) exists ONLY in the
  off-repo bundle: platform object storage, bucket
  `replit-objstore-8ef0f0e9-9662-40d1-ada4-6dcd42fc2e24`, object
  `.private/archive/haetae-pre-reboot-20260724-133108.bundle`,
  sha256 `3d9be9abdb6c90c4d08a39c973c2ed25fed2d2e9fd0e7a91ebd10112c3957059`,
  6,972,595 bytes. Never commit it back.
- **The history-rewrite ban is back in force, permanently** — see the
  History/authorship/release law section in RULES.md.
- Release tags (annotated, pushed after CI green): `v0.1.0-contracts`,
  `v0.2.0-console-live`, `v0.3.0-giwa-deploy`.
- On-chain: the pre-reboot deployment on GIWA Sepolia (chain 91342) is
  ORPHANED but live; the committed deployments/giwa-sepolia.json still cites
  it. STEP 4 of the reboot order (fresh deploy from the new head) is the fix.

## Blocked on human (single blocker, unlocks STEP 4)

Fund deployer `0x3Af656d9Ad1307543623133bDB64A39599E08E4B` to ~0.01+ ETH
(currently 0.001194; faucet sepolia-playground.giwa.io). Then, per the reboot
order: Deploy.s.sol from head → Blockscout re-verify all 7 → Seed beats →
regenerate deployments/giwa-sepolia.json (new addresses, tx hashes, commit
hash) → update README deployment table + LOG preamble block number →
Rehearsal R1–R5 trail into DEMO.md → publish app → real console URL into
README + DEMO.md.

## Standing rulings (carried)

- artifacts/ MUST stay git-tracked (platform deregisters previews otherwise).
- attached_assets/ stays on disk, gitignored (platform upload target).
- Product packages npm-clean; web/package-lock.json must be generated in a
  pristine context, never inside the pnpm workspace.
- Push auth: basic-scheme extraheader b64(x-access-token:GITHUB_PUSH_TOKEN)
  via GIT_CONFIG_* env; poll Actions by head SHA.

## Open items / flags

- S06+S07+S08 ratification lines pending human walk of the console.
- web/ standalone `npm ci && npx tsc` fails (no @types/node dev-dep; types
  ride workspace hoisting; vite build unaffected; not in the gate sequence).
  Frozen — fix only under an ordered web session.
- web/src/chain/deployment.ts comment cites pre-reboot hash 4b43402
  (frozen comment; truthful against the archive; regenerates with STEP 4).
- contracts/lib/account-abstraction dir lacks its .git gitfile (checkout
  content verified at pin 7af70c89 via .git/modules; unused by sources —
  remapping only).
- api-server artifact: deregistration candidate for a future ordered session.
- Local platform refs (refs/replit/agent-ledger, gitsafe-backup remote) still
  reach old objects locally; origin is clean; the bundle is the canonical
  archive.
