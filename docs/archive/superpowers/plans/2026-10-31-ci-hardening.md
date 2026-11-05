# CI hardening plan: CI.E2E2 and CI.JRN1

> Rows: CI.E2E2 (lane testing; follows CI.E2E1) and CI.JRN1 (lane ship; follows EDK.6b) in
> [02](../../02-master-delivery-plan.md). One PR (coordinator, 2026-10-31: "Next milestone for you (ONE PR, plan
> first)"; Owner, 2026-10-31: "PRs should be milestone level"). Strict TDD in `packages/` and `tooling/`; a
> workflow change goes in a "Workflow change" section of the PR body. No retry and no raised budget without its cause.

## CI.JRN1: the iPad journeys in the checks job

EDK.6b's harness (`journeyProject` in `@mcthaydt/automata-editor-kit`, WebKit with touch and a 2x screen) gives
`editor-kit` 18 journeys and `editor-2d` an empty journeys project (`--passWithNoTests`). Locally the journeys took
14 s for editor-kit and 2 s for editor-2d, so every pull request runs them in full rather than through
`turbo --affected`.

### Files

- Modify `package.json`: `test:journeys` = `VITEST_MAX_WORKERS=${VITEST_MAX_WORKERS:-${CI:+2}} turbo run test:journeys`,
  and `ci:local` runs it after `pnpm test:unit`.
- Modify `turbo.json`: a `test:journeys` task, uncached, passing `PLAYWRIGHT_BROWSERS_PATH` on (as `test:parity`).
- Modify `.github/workflows/ci.yml` (checks job, after `pnpm test:unit`): install WebKit (with its system libraries on a
  hosted runner; the browser alone on a self-hosted one, whose libraries are installed once), then `pnpm test:journeys`.
- Test `packages/ship/src/workflows.test.ts`: the workspace-package helpers move to module scope; a new describe.

### Steps

1. [x] Red: every package whose `vitest.config.ts` has a journeys project (`journeyProject(` or a project named
       `journeys`) has `test:journeys`; the root script and the turbo task exist; the checks job installs WebKit before
       `pnpm test:journeys`. Failed for the expected reasons: no root script, no step. A first detection by project name
       found no package, because the kit builds the project with `journeyProject(...)`. The detection now matches both.
2. [x] Green: the script, task and steps. The `ci:local` order test leaves out runner browser installs, as it already
       leaves out the Mac's.

## CI.E2E2: the examples e2e under SwiftShader

### What is known (CI.E2E1, [its plan](2026-10-31-core-saves-e2e-budget.md))

Headless Chromium on Linux composites the page in software. So each frame of a rendering example blocks the page's
main thread on a `ReadPixels` of the whole canvas (~200 ms at the `Pixel 7` size), and each Playwright action waits
about one such frame. `--use-angle=swiftshader` removes the readback, but with 2 workers the S-c reload then stalled
5–7 s before the new document parsed.

### The reload stall's cause (measured here)

- I reproduced it in one test: a second browser plays `core-basic-window` while core-saves reloads from its paused
  screen. Without the flag, `domInteractive` comes at 67 ms. With it, the first resource starts at 3.1 s.
- A trace of the flagged reload shows the renderer main thread in `Frame::Detach` for 953 ms. It waits on the GPU
  process's `GpuChannel::OnDestroyCommandBuffer` (1003 ms): tearing down the old document's WebGL context.
- The game was paused (61 fps, nothing drawing), so the context had no queued frames. The teardown itself is slow
  under SwiftShader on a CPU the other browser's rendering keeps busy.

### The whole examples suite, 2 workers on 4 CPUs

| Run                                                   | Result                                                                                                                                                  | Time    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `examples`, as on main                                | 52 passed, 1 failed: display-policy D-b at 31.8 s, past its 30 s budget                                                                                 | 7.9 min |
| `examples`, `--use-angle=swiftshader`                 | 44 passed, 9 failed: S-c (the reload stall) and 8 of the 3D examples (render3d ×3, figures ×5; e.g. `canvasColours` never above 40 within its 5 s poll) | 7.2 min |
| `examples` + `examples-compact`, device-pixel ratio 1 | 106 passed, 0 failed (2 skipped, as on main)                                                                                                            | 7.4 min |

D-b's trace on main shows the same cause as CI.E2E1: each action on the play screen takes 0.7–1.8 s (one tap took
5.8 s), and the budget is spent waiting on frames.

### Decision (no retry, no raised budget)

- **No renderer flag.** ANGLE's SwiftShader backend removes the readback, but 8 of the 3D examples stop drawing under
  it, and a reload waits on the old WebGL context's teardown. With no flag, the reload stall is gone too.
- **The examples projects emulate a device-pixel ratio of 1** (`EXAMPLES_PIXEL_RATIO` in `playwright.config.ts`).
  The readback is per canvas pixel, and the canvas goes from 728×1678 to 412×948, about a third of the pixels. With
  2 workers, D-b went from 30.9 s to 8.8 s and the conflict journey from 35.3 s to 13.8 s; across the whole suite,
  the conflict journey ran 15.4 s and 14.5 s (compact). The journeys check DOM state, not pixel density. The
  renderer's resolution rules keep their unit and parity tests, and the games' own journeys keep the phone's ratio.
- **CI.E2E1's 45 s budget returns to the default 30 s.** Its cause is gone, and the journey now runs in half that.

## Execution log

- 2026-10-31: CI.JRN1 steps 1–2 above. `workflows.test.ts` 137 passed (`--testTimeout=90000`, as `test:unit`
  passes; at vitest's 5 s default, one existing git-fixture test timed out while the e2e suite loaded the CPU).
- 2026-10-31: reload stall reproduced and traced (above).
- 2026-10-31: the whole-suite runs above; DPR 1 applied to `examples` and `examples-compact`; core-saves' `test.setTimeout(45_000)` removed.

## Gates

- Selected:
  - `TURBO_FORCE=true pnpm check`: 36/36.
  - Root `pnpm test:journeys`: editor-kit 18 passed, editor-2d has no journeys yet.
  - The whole `examples` and `examples-compact` suites with 2 workers: 106 passed (above).
  - core-saves on both projects at the default budget: 6 passed (conflict journey 13.8 s and 11.8 s).
- Omitted:
  - `pnpm lint:actions`: actionlint needs a Docker daemon, which this container doesn't have. Run it on the runner.
  - build, api-report, api-index, agent-skills and changesets: no package source, exports or doc comments changed.
  - Parity: no sim, renderer, ui or golden touched.
- Pending: the PR's CI.
