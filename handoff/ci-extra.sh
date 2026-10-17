#!/bin/bash
# The ci.yml checks-job steps that pnpm check does not run.
set -e
git fetch -q origin main
pnpm changeset status --since=origin/main
node tooling/release/src/check-changesets.ts
pnpm build:examples
if grep -q "\"api-report\"" package.json; then pnpm api-report; fi
pnpm build
pnpm --filter @mcthaydt/release test:dist
if grep -q '"api-index"' package.json; then pnpm api-index; fi
if grep -q '"agent-skills"' package.json; then pnpm agent-skills; pnpm plugin:validate; fi
pnpm build:demos
pnpm --filter @af-examples/placeholder budget:size
