---
name: Replit artifact registry requires git-tracked artifacts
description: Untracking artifacts/ deregisters previews and deletes their workflows; disk presence is not enough. Recovery recipe inside.
---

# Artifact registry ↔ git tracking

Untracking `artifacts/` (git rm --cached + gitignore) causes the platform to
REMOVE all artifact registrations and DELETE their managed workflows shortly
after — even though every file, including `.replit-artifact/artifact.toml`,
remains on disk. Previews die; `listArtifacts()` returns `[]`.

**Why:** the registry syncs with git-visible state, not the filesystem.
Proven mid-sweep on this repo: all three artifacts deregistered minutes
after the untracking commit landed.

**How to apply:**
- Never gitignore or untrack `artifacts/` in a repo whose previews matter.
- Recovery without scaffold churn: re-track the files, then for each
  artifact copy `.replit-artifact/artifact.toml` to a sibling temp file and
  call `verifyAndReplaceArtifactToml({ tempFilePath, artifactTomlPath })`
  with IDENTICAL content — the revalidation re-registers the artifact and
  recreates its managed workflows (restart them afterwards). Do not call
  `createArtifact` (fails on existing dirs).
