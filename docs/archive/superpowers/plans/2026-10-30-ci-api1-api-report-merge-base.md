# CI.API1: compare API reports with the main a pull request was built on (plan)

**Status:** implemented and locally checked 2026-10-30; size S; coordinator lane.

**Why:** `pnpm api-report` compared the checkout's reports with `origin/main`'s tip. CI checks out the merge commit GitHub built when the run was queued, and on the Owner's runners a run waits for hours. When main gains a merge that adds published exports meanwhile, the old merge commit reads them as removed: an "undeclared break" the pull request never made. Seen on #243 (docs only) at d8f5c1d: `@mcthaydt/automata-ui . CameraDragSurface: removed` and four more.

**Fix:** with no `--since`, the base is `git merge-base HEAD origin/main` (the merge commit's first parent; a branch's fork point), falling back to `origin/main` without common history. No workflow change.

## Files

- Create: `tooling/api-report/src/base-ref.ts`, `tooling/api-report/src/base-ref.test.ts`.
- Modify: `tooling/api-report/src/cli.ts`.

## Steps

- [x] 1. Failing test `base-ref.test.ts` (a merge commit built before main moved on resolves to its first parent; `--since` wins; no common history falls back). Failed: `./base-ref.ts` did not exist.
- [x] 2. `baseRefFor`, used by `cli.ts`. 3 of 3 pass.
- [x] 3. Reproduced on #243's head d8f5c1d against today's origin/main: the old CLI printed `56 API breaks against the base, 5 undeclared` with `CameraDragSurface: removed`; with this change, `0 API breaks against the base, 0 undeclared`.
- [x] 4. Gates: `pnpm format`, `TURBO_FORCE=true pnpm check`.

## Follow-ups

- `pnpm deps:new --base origin/main` has the same moving base; it only lists packages, so a stale run over-reports rather than fails.
