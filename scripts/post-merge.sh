#!/bin/bash
# Platform post-merge reconciliation hook: re-sync dependencies after a task
# merge. The former `pnpm --filter db push` step died with lib/db (S07 sweep);
# HAETAE has no Replit database — the chain is the store.
set -e
pnpm install --frozen-lockfile
