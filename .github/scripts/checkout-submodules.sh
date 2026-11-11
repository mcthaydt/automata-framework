#!/usr/bin/env bash
# Puts the private submodules (.gitmodules) at the commits the repository pins, with the Owner's read-only
# SUBMODULES_TOKEN. Every job that runs `pnpm install` runs this first: the self-hosted runners keep their work folders
# between jobs, so a submodule an earlier job left at another commit would otherwise stay there, and the install's
# `prepare` (vendor/figure-builder/types.mjs) would build from sources that do not match the lockfile.
#
# The token rides this one command, never git's config, and the checkout step before it keeps the workflow's own token.
# With no token (a pull request from a fork gets no secrets) the submodules are emptied and a warning says so: nothing
# builds from a stale copy, and what imports the submodule fails by name instead of quietly using another version.
set -euo pipefail

if [ -z "${SUBMODULES_TOKEN:-}" ]; then
  echo "::warning::SUBMODULES_TOKEN is not available, so the private submodules are not checked out and were emptied. What imports them will fail."
  git -c safe.directory='*' submodule deinit --force --all
  exit 0
fi

auth="$(printf 'x-access-token:%s' "$SUBMODULES_TOKEN" | base64 | tr -d '\n')"
# --force: drop whatever an earlier job left in the checkout; the pinned commit is the only one a job may build from.
git -c safe.directory='*' -c "http.https://github.com/.extraheader=AUTHORIZATION: basic $auth" \
  submodule update --init --force --depth 1
