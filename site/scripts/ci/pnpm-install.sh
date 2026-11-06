#!/bin/bash
# `pnpm install --frozen-lockfile` for CI, with one recovery (CI.WEB1).
#
# Why: website run 41186832093 (job 124504416573) failed with ERR_PNPM_ENOENT, a reflink out of the pnpm store that no longer had its
# file, eight seconds into an install that had downloaded 501 packages. The store sat in a folder shared by every job on that runner
# (see ci.yml's pnpm setup, which now gives each job its own folder and store). That removes the known way two jobs can touch one
# store. This script covers what is left: a failed install may leave half a `node_modules` and a half-written store, so a second
# attempt on top of them could fail the same way. The recovery starts from nothing.
#
# It is not a retry that hides a problem: the first failure is printed whole, as a warning, so it stays in the log. A second failure
# is a real failure and fails the job. Arguments go to `pnpm install` (the framework install passes --ignore-scripts).
set -uo pipefail

if pnpm install --frozen-lockfile "$@"; then
  exit 0
fi

echo "::warning::pnpm install failed once (output above); clearing node_modules and the pnpm store, then installing again"
rm -rf node_modules
if [[ -n "${npm_config_store_dir:-}" ]]; then
  rm -rf "${npm_config_store_dir:?}"
  mkdir -p "$npm_config_store_dir"
fi

if pnpm install --frozen-lockfile "$@"; then
  exit 0
fi

echo "::error::pnpm install failed twice, the second time from a clean node_modules and store: this is not the one-off store failure"
exit 1
