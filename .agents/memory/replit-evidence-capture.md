---
name: Replit evidence capture semantics
description: How to gather trustworthy browser-console and prod-serve evidence in this workspace; instrument semantics proven in session 01.
---

# Replit evidence capture semantics

The rules:
- The Screenshot tool prints a "Browser logs" section ONLY when the page
  emitted console lines; no section means a genuinely empty console. This
  was proven positively: a temporary beacon hook injected into a served
  dist DID surface its own marker line through the tool.
- Screenshot sessions do NOT feed the RefreshAllLogs browser-console
  stream; only the user's open preview pane does. Never treat stream
  silence as evidence about a screenshot session, or vice versa.
- The artifact proxy (port 80 → artifact port) deregisters the route when
  the artifact's workflow stops. A manually started server on the same
  port is unreachable through the proxy/Screenshot. To serve a production
  build for evidence: temporarily point the delegator's `dev` script at
  `vite preview` (config already maps injected PORT/BASE_PATH for preview),
  restart the managed workflow, capture, then revert and restart.
- A workflow restart makes the user's preview pane reconnect and reload,
  which is the only way to force a fresh pane session into the console
  stream (useful for verifying dev-only warnings are gone).

**Why:** In session 01 an "empty console" claim was nearly shipped on
absence-of-instrument: three screenshot loads produced no stream lines,
which meant nothing because screenshot sessions never reach the stream.
The beacon-hook round established what silence from which instrument
actually proves.

**How to apply:** For any "console must be clean" gate: use Screenshot
results (presence-proven capture) for the served page, and a
post-restart pane session in RefreshAllLogs for dev. If extra rigor is
ever needed, the beacon-hook pattern (inject into built dist only, never
source; sendBeacon to a 127.0.0.1 sink; liveness marker line; rebuild
clean afterward) works — but mind that sink processes started from a
ShellExec die with the shell session.

Related trap while cleaning up instruments: see shell-env-quirks.md —
pgrep/pkill -f self-match killed the working shell twice this session;
kill listeners by port (`fuser -k <port>/tcp`), never by cmdline pattern.

## Harness-dispute protocol (when live tests contradict correct-reading code)

Escalate instrumentation, not rounds. Artifact classes actually hit in
session 01, each of which masqueraded as an app bug:
- UI timers vs harness pacing (an auto-revert shorter than the harness's
  evidence-capture gap between two presses reverts state mid-scenario);
- focus-scoped key handlers (keys silently ignored unless the exact element
  is focused; initial dialog focus is the container, not the action button);
- dead/detached page reads (`<noscript>` text is visible ONLY with JS off —
  seeing it proves the page object died, never that React crashed: a root
  unmount leaves a BLANK page);
- emulation state dropped between contexts (reduced-motion gate must be
  asserted per-context before measuring, not assumed);
- adjacent-row locators (`following::` style selection hits the NEXT row's
  button; the proof is `btn.closest('tr').innerText`).

**How to apply:** after the second contradictory round, (1) expose a
dev-gated state global from the component under test and assert STATE, not
copy; (2) verify fixture/roster ground truth yourself (source + screenshot);
(3) mandate per-context environment gates in the test script; (4) require
zero-coordinate activation (row-scoped query + focus + real key event) with
pre-action proof strings. A dispute that survives all four is a real bug —
in session 01 exactly one did (unkeyed AnimatePresence modals).

## Testers vs manual dev servers (S04, July 2026)
Testing subagents restart managed workflows — a hand-launched dev server squatting on the workflow's port gets evicted mid-round and the tester sees the wrong build. Deliver test-only env through the env store + managed workflow restart, never via a nohup'd server. Also: batching several Screenshot calls fires concurrent tabs whose simultaneous load bursts can stall a rate-limited upstream — capture zero-error evidence one viewport at a time.

## Staged UI delays race screenshot capture
Fixture/demo modes that stage loading skeletons on a timer (e.g. 900ms)
consistently beat the screenshot tool's capture, which fires around page
load — you get skeleton evidence, never content, on every retake. Fix at
the source: make the staged delay URL-tunable (?delay=0) as a genuine
rehearsal knob instead of hand-editing constants for evidence and
reverting. When parsing, guard the Number(null)===0 pitfall: an absent
param must keep the default, not zero the delay.
