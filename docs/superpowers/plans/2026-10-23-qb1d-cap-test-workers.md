# QB.1d: cap the test workers one CI job starts, TDD plan

- **Spec:** [QB spec](../specs/2026-10-16-quality-bar-design.md) §2 (what AF actually runs); hub request `automata/inbox/2026-10-23-1705-hub-cap-test-workers.md` (orchestrator-bus). No spec change.
- **Task:** `QB.1d — Cap the test workers per CI job` (02, a follow-up of QB.1). Lane ship. Requested by the Examples and DX thread for the hub; the 02 row and 03 come with the docs sync PR.
- **Status:** drafted 2026-10-23, based on `main` (`8bd81b7`).
- **Progress:** 4 of 5 steps (5 waits for the merge).

## What is wrong

The Mac M1 behind `af-mac`, `af-mac-2` and `af-mac-web` ran three jobs at once with a load average up to 115 (hub evidence, 2026-10-23), and every failure was a 30 s or 90 s timeout. Nothing caps what one job starts:

- `playwright.config.ts` sets no `workers`, so a journey run starts Playwright's default of half the cores.
- `turbo.json` sets no `concurrency`, so `pnpm typecheck` and `pnpm test:unit` run up to 10 packages at once, and each package's vitest starts `cores - 1` workers (more than 70 threads on 8 cores).
- `pnpm test:parity` and `pnpm evidence` already run 3 suites at a time (`--concurrency=3`), but each suite starts Chromium, WebKit and Firefox and each browser opens `cores - 1` pages. Nine browsers with several pages each is the shape of the `renderer.browser.test.ts:24` hook timeout on #120.

The website already caps itself (`QB_E2E_WORKERS`, default 2).

## Decisions

- **Playwright:** `AF_E2E_WORKERS` (a positive integer) wins; otherwise 2 on CI (`CI` set) and Playwright's default locally. The rule is a function, `e2eWorkers(env)`, in `tooling/frame-budget/src/playwright-run.ts` beside `selectRun`, so it has a unit test; `selectRun` applies it to the journeys. The frame-budget run keeps its one worker, which needs the GPU to itself. A bad `AF_E2E_WORKERS` throws instead of passing `NaN` to Playwright.
- **Vitest:** vitest 5 reads `VITEST_MAX_WORKERS` for every project, browser and layout projects included (`resolveConfig`: `resolved.maxWorkers`; the browser pool uses `project.config.maxWorkers`). The root scripts that CI calls (`test:unit`, `test:parity`, `evidence`) set it to `${VITEST_MAX_WORKERS:-${CI:+2}}`: 2 on CI, a caller's own value wins, empty (so ignored by vitest) locally. `turbo.json` lists it in `globalPassThroughEnv`, because turbo's strict mode would drop it. One definition, no edit to the 19 vitest configs, and a developer's `pnpm --filter … test` is not slowed.
- **Turbo:** `"concurrency": "4"` in `turbo.json`, unconditional. Ten parallel packages exceed the cores of any machine that runs them; 4 packages with 2 workers each are 8 threads. `--concurrency=3` on the parity scripts still wins.
- **Not chosen:** stopping a runner or moving the website to its own label (hub: the Owner's rule, and a workflow change), and any `.github/workflows` edit: `CI` is already set on every Actions job.
- **Frame budget** keeps `workers: 1` and its exclusive-GPU rule.

## Files

- **Modify:** `tooling/frame-budget/src/playwright-run.ts` and `playwright-run.test.ts`; `playwright.config.ts` (no change needed if `selectRun` applies the cap; checked in step 2); `turbo.json`; `package.json` (`test:unit`, `test:parity`, `evidence`); `packages/ship/src/workflows.test.ts` (the three script pins and a `turbo.json` case); this plan.
- **Create:** `.changeset/cap-test-workers.md` (empty, CI only: `ship`'s test changes and `changeset status` asks for one, as for `release-approval-publish-only.md`).

## Interfaces

- **Produced:** `e2eWorkers(env): number | undefined` (exported from `tooling/frame-budget/src/playwright-run.ts`); env vars `AF_E2E_WORKERS` (Playwright) and `VITEST_MAX_WORKERS` (vitest, an existing vitest name).
- **Consumed:** vitest's `VITEST_MAX_WORKERS`; turbo's `concurrency` and `globalPassThroughEnv`; `CI`.

## Steps

- [x] **1. Red.** In `playwright-run.test.ts`: `e2eWorkers` gives 2 on CI, `AF_E2E_WORKERS` over CI, `undefined` locally, throws on `0`, `-1`, `1.5` and `abc`; `selectRun` applies it to the journeys and leaves `workers: 1` for the frame-budget run. In `workflows.test.ts`: the `test:unit`, `test:parity` and `evidence` scripts carry the `VITEST_MAX_WORKERS` prefix, and `turbo.json` has `concurrency` `"4"` and `VITEST_MAX_WORKERS` in `globalPassThroughEnv`. Run both files; they fail for the missing code.
- [x] **2. Green.** `e2eWorkers`, `selectRun`, `turbo.json`, the three scripts. Both files pass.
- [x] **3. Prove it reaches the tools.** The script prefix evaluated by `sh` with `CI` unset, `CI=true`, and `VITEST_MAX_WORKERS=3`; a throwaway test run through `turbo run test:unit` reads the worker count from vitest's own config (2 with `CI`, the default without); `playwright test --list` loads the config; `turbo` prints its concurrency.
- [x] **4. Gates.** `pnpm format`, `pnpm check` (the same script with `CI=1`, to see the cap on a real run), `pnpm changeset status --since=origin/main` with the empty changeset.
- [ ] **5. Hand off.** Draft PR, merge thread told to put it at the front of its queue. After it merges: a `kind: test-request` on the bus (the two load-sensitive journeys and the display-policy A/B pass on the Mac without reruns), then tell the existing plan and website threads the result.

## Gates

- Selected: the two test files above, `pnpm check`, the step 3 probes.
- Omitted, not runnable here: any Actions run, and the Mac itself (this container has 4 cores, not 8). Whether the cap ends the timeouts is the step 5 test request, not something this PR claims.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-23 | Plan | `05bdc19` | |
| 2026-10-23 | 1 | | Red: `playwright-run.test.ts` 4 failed, 2 passed (no `e2eWorkers`; `selectRun` set no workers); `workflows.test.ts` 6 failed, 112 passed (the three script pins, the three new cases). |
| 2026-10-23 | 2 | `c7713c7` | `e2eWorkers` and `selectRun` (the journeys are returned unchanged when there is no cap), `turbo.json` (`concurrency` `"4"`, `globalPassThroughEnv`), the three scripts. Green: `playwright-run.test.ts` 6 passed, `workflows.test.ts` 118 passed. |
| 2026-10-23 | 3 | | Through `turbo run test:unit` a throwaway test read vitest's resolved `maxWorkers`: no `CI` gave `env=""`, `maxWorkers=undefined`; `CI=true` gave 2 and 2; `CI=true VITEST_MAX_WORKERS=3` gave 3 and 3. (A first probe replayed turbo's cached log: `passThroughEnv` is not part of the task hash, so the probe needed `--force`.) Browser mode honors it: twelve 2 s test files in one Chromium project took 11.7 s by default (3 workers on this 4-core box), 15.6 s with `VITEST_MAX_WORKERS=2` and 27.2 s with 1. `turbo.json`'s `concurrency` has an effect: `typecheck` of `packages/*` took 55.1 s at 1, 36.9 s at 4 and 29.8 s at 10 here, so the cap costs about 7 s on an idle 4-core box. `playwright test --list --reporter=json` gives `workers` 2 with `CI=1`, 3 with `AF_E2E_WORKERS=3`, 1 with `AF_FRAME_BUDGET=1`, and `AF_E2E_WORKERS=abc` stops with "AF_E2E_WORKERS must be a positive integer". |
| 2026-10-23 | 4 | `c7713c7` | `pnpm format`; `CI=1 pnpm check` exit 0 (33 tasks, 3 min 14 s on this 4-core container, so the capped path ran end to end); `pnpm changeset status --since=origin/main` exit 0 once the empty changeset was committed; `check-changesets`: 49 changesets, 0 problems. Not run: WebKit and Firefox (the container has Chromium only), any Actions run, the Mac. |
