# API-report seams test: a 240 s timeout for the full-build test

- **Spec:** none (CI reliability). Decided by the hub 2026-10-23 and reversible; the Owner is not needed.
- **Task:** none in 02. It sits beside the load-sensitive follow-up row for the Mac runners.
- **Status:** drafted and implemented 2026-10-23; draft PR open, CI pending.
- **Progress:** 2 of 2 steps.

## What is wrong

`tooling/api-report/src/seams.test.ts` line 17, "match the current source of every core package", calls `runApiReport`, which reads every core package through one TypeScript program (`extractApi`): a whole-program typecheck of the core. It has its own 90 s timeout (the "budget floor" of #54). On the loaded Mac runners it exceeds that: it took 93 s on PR #142 (`a37be1c`, 2026-10-23) and failed with `Test timed out in 90000ms`, while the same test takes 1.7 s on an idle machine here. Each such failure costs a 20 to 30 minute slot in the CI queue, because turbo stops the other tasks (they show `exit code 130`) and the job has to run again.

The hub's note called this test `examples-runner src/exports.test.ts:17`. No such file exists on any branch; `tooling/api-report/src/seams.test.ts:17` matches the line, the symptom and the timeout, so that is the test changed here.

## Decision

Give that one test a 240 s timeout, with a comment that says why. The assertion is unchanged: it still compares every committed report with the current source and expects exit code 0. The root script's 90 s `--testTimeout` and the per-file pre-commit budget stay as they are. Two heavy jobs share one Mac (the second runner made the queue faster but slows each job), so this is a trade-off, not a bug; the root cause is for later.

## Files

- **Modify:** `tooling/api-report/src/seams.test.ts` (one timeout value and its comment); this plan.
- No production code, no golden, no changeset (`@mcthaydt/api-report` is private).

## Steps

- [x] **1. The change.** `90_000` becomes `240_000` on the full-build test, with the measurement in the comment.
- [x] **2. Gates.** `pnpm format`; `pnpm --filter @mcthaydt/api-report test:unit` (55 of 55); `pnpm check`.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-23 | Plan | | |
