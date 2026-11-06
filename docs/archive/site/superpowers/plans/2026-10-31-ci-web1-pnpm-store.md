# CI.WEB1: `pnpm install` ERR_PNPM_ENOENT on af-mac-web (plan and log)

- **Row:** CI.WEB1 in the framework's `docs/02-master-delivery-plan.md` (found in website#31). Size S. Workflow changes are auto-approved
  (Owner, 2026-10-31: "everything is auto approved and accepted").
- **Branch:** `claude/website-CI.WEB1-pnpm-store`. Status: built and locally tested; CI on the head pending.

## The failure

Run 41186832093, job 124504416573 (`checks`, runner `af-mac-web`, 2026-10-31 10:18Z): `pnpm install --frozen-lockfile` died at
`ERR_PNPM_ENOENT ... reflink '<RUNNER_TEMP>/setup-pnpm/node_modules/.bin/store/v10/files/d5/791e…' -> '<workspace>/node_modules/.pnpm/…_tmp_92389_3/LICENSE.md'`,
eight seconds in, after 501 of 511 packages. No test had run. It passed on its one re-run. It is a clone of a store file that did not exist.

## Root cause, as far as the evidence goes

- The store lived inside the folder `pnpm/action-setup` was given: `${{ runner.temp }}/setup-pnpm`. `RUNNER_TEMP` belongs to the runner, not
  the job, so that path was **the same for every job and every attempt on that runner**. The comment above it said "own folder per job"
  and a test pinned the fixed path: the intent was never met.
- The same folder is rewritten by each job's own pnpm setup (the failing log shows pnpm v11 switching itself to v10 and refreshing the
  shims in `PNPM_HOME` seconds before the install), and the runner went through many cancelled and re-run jobs that morning (runs 133,
  137, 139 and 140 were cancelled by `cancel-in-progress`; 134 was re-run). A store folder shared across those is exposed to a
  teardown, an orphaned process or a re-created folder removing a store file between pnpm writing it and cloning it.
- What the evidence does **not** prove: which of those removed the file. The log has no second writer, and the job cannot be re-run
  to watch. So the fix removes the shared path and adds recovery, and it does not claim to have reproduced the race.

## The change

1. `pnpm/action-setup`'s `dest` is `…/setup-pnpm-<run_id>-<run_attempt>-<job>` in `ci.yml` and `deploy.yml`.
2. A step after it sets `npm_config_store_dir` to `…/pnpm-store-<run_id>-<run_attempt>-<job>` through `$GITHUB_ENV` (pnpm reads it: checked with
   `pnpm store path`). Nothing a job needs lives at a fixed path in the runner's temp folder.
3. Every install goes through `scripts/ci/pnpm-install.sh`: one `pnpm install --frozen-lockfile "$@"`; on failure it prints a `::warning::`
   (the first failure stays in the log), removes `node_modules` and the store, and installs once more; a second failure is `::error::` and
   fails the job. This is recovery from a half-written install, not a blind retry: it starts from nothing.

## Tests (red first)

- `tests/workflows.test.ts`: every job and `deploy.yml` have a `dest` named by run, attempt and job; the step after pnpm setup points the store
  at a folder of its own; no workflow runs a bare `pnpm install`; the framework install and the install-order tests follow the script.
- The script is run against a fake `pnpm` that fails 0, 1 or 5 times: one call and exit 0; two calls, a warning carrying the first failure and
  `node_modules` removed; two calls and an error, never a third.

## Gates

`pnpm exec vitest run tests/workflows.test.ts` 41 of 41. The rest of the unit suite has five files that read the sibling framework
checkout and fail here for that reason, as before. Pending: the first CI run on this branch on `af-mac-web`.

## Follow-ups

- If the failure returns with unique folders, the next suspect is two runner instances sharing one `_work` folder, which the Owner
  would have to check on the Mac; the warning from the script will show the first failure's text.
