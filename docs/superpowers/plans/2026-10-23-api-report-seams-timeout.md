# Two load-sensitive tests: a 240 s timeout for each

- **Spec:** none (CI reliability). Decided by the hub 2026-10-23 and reversible; the Owner is not needed.
- **Task:** none in 02. It sits beside the load-sensitive follow-up row for the Mac runners.
- **Status:** drafted and implemented 2026-10-23; ready, first in the merge queue.
- **Progress:** 3 of 3 steps.

## What is wrong

Two tests exceed their 90 s timeout when the af-mac runners are loaded. Each failure costs a 20 to 30 minute slot in the CI queue, because turbo stops the other tasks (they show `exit code 130`) and the job has to run again.

1. `games/emberwick/src/exports.test.ts:17`, "./game has the game as one definition for `startGame`". It imports the whole game (screens and renderer included) cold. It timed out at 90 s on PRs #105, #106 and #116 (twice) and passed on #111 and #129 against the same main. It takes 2.4 s on an idle machine here. The hub's note called it `examples-runner src/exports.test.ts:17`; the merge thread's check-run annotation names `src/exports.test.ts:17:3` run in `games/emberwick`, which is this test.
2. `tooling/api-report/src/seams.test.ts:17`, "match the current source of every core package". `runApiReport` reads every core package through one TypeScript program (`extractApi`), a whole-program typecheck. It took 93 s on PR #142 (`a37be1c`) and failed with `Test timed out in 90000ms`; it takes 1.7 s idle. It already had its own 90 s timeout (the budget floor of #54).

## Decision

Give each of those two tests a 240 s timeout, with a comment that says why. The assertions are unchanged. The root script's 90 s `--testTimeout`, the describe-level 90 s on the emberwick block and the per-file pre-commit budget stay as they are; the emberwick test's own option overrides the block's for that one test only. Two heavy jobs share one Mac (the second runner made the queue faster but slows each job), so this is a trade-off, not a bug; the root cause is for later.

## Files

- **Modify:** `games/emberwick/src/exports.test.ts` (the one test's timeout and a comment), `tooling/api-report/src/seams.test.ts` (the same); this plan.
- No production code, no golden, no changeset (`@af-examples/base-2d` and `@mcthaydt/api-report` are private).

## Steps

- [x] **1. api-report seams test.** `90_000` becomes `240_000` on the full-build test, with the measurement in the comment.
- [x] **2. emberwick exports test.** `{ timeout: 240_000 }` on the `./game` test only. A temporary `timeout: 1` made that test fail with `Test timed out in 1ms` while its two neighbours passed, so the option overrides the block's 90 s as intended; the value is restored.
- [x] **3. Gates.** `pnpm format`; `pnpm --filter @mcthaydt/api-report test:unit` (55 of 55); the emberwick exports test (3 of 3); `pnpm check`.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-23 | Plan | | First version named only the api-report test, because the hub's note pointed at a file that does not exist. |
| 2026-10-23 | 1 | | `pnpm format` no fixes; api-report 55 of 55; `pnpm check` 32 of 32. |
| 2026-10-23 | 2 | | Added at the merge thread's request after it read the check-run annotation of #116's job. Emberwick exports 3 of 3 (2.4 s for the `./game` test idle). |
