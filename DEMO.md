# DEMO — the three-minute walk

Stage kit: the console (run locally: `cd web && npm install && npm run dev`,
then open `/console`), one terminal sitting in `contracts/`, one Blockscout tab
(https://sepolia-explorer.giwa.io). A wallet is optional — this walk never
signs anything from the browser.

**The contingency rule — decide in five seconds, not on stage:** if the
top-bar ticker reads `#—` for more than ~10 seconds, or Registry shows the
error card, append `?demo=fixtures&delay=0` to the URL and run the exact same
walk offline. Fixture-mode differences are marked ⬦ below.

## Before the lights (T-10 min)

1. Open `/console` — ticker pulsing. The live registry carries no fictional
   cast: expect the `rehearsal` row (Revoked) from the recorded arc, plus any
   agents licensed since. The scripted eight-row theater lives exclusively
   behind `?demo=fixtures` and is labeled as fixtures.
2. If playing the live beats (the 2:00 section): paste the live-beats block
   (bottom of this file) into the terminal — derive the fresh key, do **not**
   run yet.
3. Load Blockscout once, so cold-start latency dies in preflight.

## 0:00 · Registry — the roster

- Say: "Every AI agent here carries a license a human minted. This is live —
  the block number is GIWA Sepolia, right now." (point at the ticker)
- Point: the `rehearsal` row in ash — **REVOKED** — the recorded arc's agent.
- Expect: a sparse, honest registry, pulsing ticker, no wallet needed.
- ⬦ fixtures: eight rows, three ghosts — same layout, zero chain.

## 0:30 · Agents — the dossiers

- Click **Agents**, then **Papers** on the rehearsal agent.
- Expect: identity fields up top (license nº, scope, expiry), caps and venues
  below. Say: "The license is identity; caps and venues are policy — the
  principal can tighten them mid-day without touching the license."
- Expect in the Court Record: the full arc R1–R5 — trade, two refusals,
  the sentinel verdict, the ghost.
- Close with Esc.

## 1:10 · Ledger — the court record

- Click **Ledger**. Point at the tally chips, then the vermillion rows.
- Say: "Refusals are public. The chain remembers who was told no, and why."
- Click the tx link on the sentinel-verdict row → Blockscout opens in the
  spare tab.
- ⬦ fixtures: twenty rows; tx links are inert (no chain to link to).

## 1:40 · Standard — the law

- Click **Standard**. Point at the two questions — authority, accountability —
  and Laws 1–2 in vermillion.
- Say: "This is a draft ERC. The interface is small enough to read on stage —
  any chain, any registry can adopt it."

## 2:00 · The beats, live — fresh agent, full arc

*(Skip in fixture mode — narrate the recorded rehearsal beats from the README
table instead.)*

- Terminal: run the prepared live-beats block. On ~1s blocks the whole arc
  lands in well under a minute.
- While it runs, click **Registry** — a new `rehearsal` row appears, Active.
- Click **Ledger** — the arc marches in newest-first: trade → cap refusal →
  venue refusal → sentinel verdict → ghost refusal.
- Click **Registry** once more — the row is ash now. Revoked.
- Say: "Fresh agent, fresh budget, same law. Nobody edited a config; the
  chain refused, the Sentinel judged, the license died."

## 2:50 · Close

- "One signed call by the guardian. One block — about a second. The agent
  still speaks; the chain no longer listens. That's HAETAE: the trust rail
  for the agent economy."

## The live-beats block (prep at T-10, run at 2:00)

Standing rules this block obeys: every show uses a fresh agent with a fresh
UTC day budget (ruling, S06 ratification) — prior rehearsal records and any
real licensed agents are never touched. Keys live in env only — never in
files, logs, chat, or argv (S04 rule). The script enforces this itself: a
rehearsal key that derives a core cast address (principal / sentinel /
deployer), or an address carrying any non-`rehearsal`-scoped license, aborts
before a single transaction is sent.

```sh
cd contracts
export LICENSE_ADDR=0x1a70E5DA8895bEc96eCa6c87E29988b380dFEe40
export POLICY_ADDR=0x6f5Bb9764847d0500262D7F092E4a6999E0b6a33
export SENTINEL_AUTH_ADDR=0x145f77a1545f3A5953477f2E4c9EC02d99327976
export VAULT_ADDR=0xB57D465b97A1e9db46BB063E410E94765C9Dc564
export USDC_ADDR=0xEF35A848a3dF83Eed3d5DC93BA291FF99e5EEe19
# DEPLOYER_PK / PRINCIPAL_PK / SENTINEL_PK are already environment secrets.
# Fresh show, fresh agent — derive a NEW key every run; never reuse, never echo:
export REHEARSAL_AGENT_PK=0x$(openssl rand -hex 32)
forge script script/Rehearsal.s.sol:Rehearsal \
  --rpc-url https://sepolia-rpc.giwa.io --broadcast -vv
```

What the script does (`contracts/script/Rehearsal.s.sol`): tops up gas from
the deployer, mints the fresh agent a license (scope `rehearsal`, cap 2,000
tUSDC/day, venue dex-alpha), then plays R1 legal trade (300) → R2 cap refusal
(1,900 vs 1,700 remaining) → R3 venue refusal (attacker-sink) → R4 sentinel
flag + revoke → R5 ghost refusal (50). It is idempotent per key and asserts
the agent ends Revoked.

## Failure ladder (on stage)

1. **RPC slow** — the walk still works; skip the live beats, narrate the
   recorded rehearsal beats from the README table.
2. **RPC dead** — `?demo=fixtures&delay=0`: the full walk, offline, zero chain.
3. **Laptop dead** — the README beat table *is* the demo: five Blockscout
   links, same story, any browser.
