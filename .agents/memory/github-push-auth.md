---
name: GitHub push auth for this repo
description: How pushes to bunnyyxtan/HAETAE actually work from this workspace, and the auth traps hit in session 01.
---

# GitHub push auth (bunnyyxtan/HAETAE)

The rule: push with the fine-grained PAT in the Replit secret
`GITHUB_PUSH_TOKEN` (Contents + Workflows read-write), injected as an env-var
Basic auth header (`x-access-token:<PAT>` base64) via `GIT_CONFIG_*` env vars
on a `git push` child process. Never put the token in argv, output, or files.

**Why:** Every Replit-native git path failed in session 01:
- `replit-git-askpass` / Git pane / platform push served invalid or
  wrong-account credentials ("Invalid username or token", generic
  PUSH_REJECTED).
- The Replit GitHub connector's OAuth token lacks the `workflow` scope, so
  GitHub rejects ANY push that adds or modifies `.github/workflows/*` —
  regardless of repo permissions.
- The connection can be authorized as a different GitHub account than the
  repo owner (it was `s4chiz`, not `bunnyyxtan`, until the human
  reconnected). A wrong identity reads private repos as 404 "Not Found".

**How to apply:**
- Before debugging git mechanics, check identity: call `GET /user` with the
  candidate token and compare `login` to the repo owner.
- Scheme matters by endpoint: `AUTHORIZATION: basic <b64(x-access-token:PAT)>`
  for git smart-HTTP (push/fetch/ls-remote); `Bearer <PAT>` only for
  api.github.com. Bearer on a git endpoint fails as "remote: invalid
  credentials" even when the same token passes `GET /user` — a green identity
  check does not validate the scheme (re-hit in session 04). Pair the header
  with `credential.helper=` (empty) via `GIT_CONFIG_*` env vars so nothing
  else injects auth and the token stays out of argv.
- Public-repo reads prove nothing about a fine-grained PAT's grants; only a
  write reveals missing Contents/Workflows permissions.
- Connectors credential endpoint quirk: the `connector_names=github` query
  filter returned zero items; fetch `/api/v2/connection?include_secrets=true`
  unfiltered and match `item.connector_name === "github"`.
- The CodeExecution sandbox's `listConnections` can go stale after a
  connection is (re)bound mid-session; a fresh shell process reads current
  identity env, so run token work from a /tmp node script instead.
- The PAT may expire or be revoked by the human at any time (HANDOFF notes
  this); on 403, ask for a reissue rather than hunting new mechanisms.
