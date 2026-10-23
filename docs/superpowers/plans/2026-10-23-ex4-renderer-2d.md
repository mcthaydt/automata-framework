# EX.4: port `render-pixi/renderer-2d` TDD plan

- **Spec:** [EX spec](../specs/2026-10-16-examples-one-file-design.md) §2 (one file, public imports, 100 code lines), §6 (`render-pixi/renderer-2d` → `render/render-interpolation.ts`, `render/render-filter.ts`; tests to `packages/render-pixi`), §7 (smoke, no CSP violation); [EX plan](2026-10-16-examples-one-file.md) Task EX.4 (the three steps per demo).
- **Task:** `EX.4 — port the existing demos`, the `render-pixi/renderer-2d` row. One PR per demo.
- **Status:** drafted 2026-10-23. Stacked on EX.6 (#98): the example imports `@mcthaydt/automata`, which the catalog only accepts after EX.6.
- **Progress:** 4 of 4 steps.

## What the old demo checked

`examples/render-pixi/renderer-2d` is a hand-wired page (`createPixiRenderer`, a geometry owner, an Effect scope, a `requestAnimationFrame` loop that feeds the renderer fake `StepResult`s) with one e2e. The e2e asserts four things; each already has a home, so step 1 adds no test, only records the pin:

| Old e2e assertion | Where it is pinned now | Kind |
|---|---|---|
| Boots under the fake host with zero CSP violations | The catalog smoke over every example (`<id> boots under the fake host with no errors`, `collectErrors` includes CSP); `packages/render-pixi/src/no-eval.test.ts` | Regression pin |
| The canvas has `af-stage` and `data-renderer` is `webgl` (`webgpu` on request) | `renderer.test.ts`: `initializes with WebGL2 default, stamps renderer dataset and appends canvas`, `respects preference: webgpu` | Regression pin |
| The entity's position changes frame to frame, interpolated by alpha | `renderer.test.ts` (`draw` passes the frame's alpha to the consumer), `render-delta-consumer.test.ts` (`advances prev = curr on changed and updates view`), `rect-view.test.ts` (`interpolates through the consumer between ticks`), `view-pose.test.ts`, and `parity/entity-views.parity.test.ts` in Chromium, WebKit and Firefox | Regression pin |
| A screen-space filter on the stage compiles | `renderer.test.ts` (the post-filter slot tests), `filter-programs.test.ts`, `parity/filter.parity.test.ts` in the three engines | Regression pin |

The old demo's "filter" was an identity pass-through, and its "interpolation" was a square the page moved itself each frame with `alpha: 1`, so neither was shown for real. The example does better on the first and defers the second.

## Decisions

- **`render-interpolation` shows the frame's alpha, not a hand-made loop.** The game is an ordinary `defineGame`: a runner crosses the field at 5 px a tick (a tick is a visible step) and the `rect` view draws it between the last two ticks. A marker line drawn by `draw` sits where the sim says the runner is, and the HUD prints the frame's `alpha`. `I` turns interpolation off for the view (it asks for alpha 1, the current tick), so the square snaps onto the marker. The toggle is presentation: it never reaches the sim (law 1), the same shape as `render-quality`'s tier keys.
- **`render-filter` waits for a core verb.** A filter needs a Pixi `Filter` built from a GLSL and WGSL pair (`filterPrograms`). Neither `Filter` nor `filterPrograms` is reachable through `@mcthaydt/automata` (the catalog allows nothing else), so the example cannot be written within EX spec §2 ("a core verb is missing; the budget is not raised"). A pending example would be a file that cannot compile, so none is added; a follow-up row in 02 ("Follow-up (found in EX.4) — A screen-space filter verb for the umbrella") records what is missing, and the example is written when it lands. The bus carries the question of which verb shape (best guess: a `postFilter(name, { glsl, wgsl })` helper in `render-pixi`, re-exported by the umbrella).
- **Knip loses its only reference to the root Playwright config.** The old demo's `test:e2e` script passed `--config=../../../playwright.config.ts`, and knip's Playwright plugin takes a config from a workspace's scripts, so that one workspace was making every workspace's e2e files entries (`games/*/e2e`, `tooling/*/e2e`, `examples/e2e`). Deleting it left `pnpm knip` red on ten e2e files, five dev dependencies and five exports. The `examples` workspace (permanent) now names the root config in `knip.jsonc` (`playwright.config`), with a comment saying why. This was the hidden dependency of the delete; the next four demo deletions inherit the fix.
- **The ship config goes with the folder.** The old demo had a `ship.config.ts` and a workspace package; nothing else references it (`packages/ship` tests name `physics/bodies-2d` and `ui/primitives`, not this demo). `examples/render-pixi/` has no other member, so the folder goes.

## Files

- **Create:** `examples/render/render-interpolation.ts`.
- **Delete:** `examples/render-pixi/renderer-2d/` (`git rm -r`; `dist/` and `node_modules/` are disposable local output).
- **Modify:** `playwright.config.ts` (the `rendererDemo` import and its `webServer` entry), `knip.jsonc` (its workspace entry), `examples/README.md` (the demo table's `render-pixi/renderer-2d` row), `pnpm-lock.yaml` (via `pnpm install`), `docs/02-master-delivery-plan.md` (the EX.4 follow-up row for the filter verb, a QB.1a note, and the execution record), this plan, the EX plan's EX.4 checklist, `docs/03-continuation-prompt.md`.
- **No changeset:** no published package changes.

## Interfaces

- **Consumed:** `defineComponent`, `defineSystem`, `definePlugin`, `defineGame`, `rect` from `@mcthaydt/automata`; `GameSpec.renderer.setup(stage)`; `GameSpec.draw` (`ctx.sim.query`, `ctx.frame.alpha`, `ctx.line`, `ctx.text`).
- **Produced:** the example `render-interpolation` (Tier core, `Packages: @mcthaydt/automata`); nothing else.

## Steps

- [x] **1. The behavior pins pass.** Run `pnpm --filter @mcthaydt/automata-render-pixi test:unit`. Every test in the table above passes on its first run, so each is a regression pin and none is new. Record the counts.
- [x] **2. The example.** Write `examples/render/render-interpolation.ts` within the budget. Red first: the catalog's real-examples test and `pnpm --filter @af-examples/examples typecheck` are the checks an example has (EX spec §5), so run them after each draft and record any failure. Then boot it through the runner under the fake host in Chromium and read the screenshot and the HUD (alpha varies; `I` flips the label and the square lands on the marker).
- [x] **3. Delete the old demo.** `git rm -r examples/render-pixi/renderer-2d`, remove the `playwright.config.ts` and `knip.jsonc` entries, update the README, `pnpm install`. Then `pnpm check` and `pnpm build:examples`; the e2e and three-engine parity are the CI runner's.
- [x] **4. Docs.** Tick `renderer-2d` in the EX plan with the filter note, add the 02 follow-up row and execution record, update 03.

## Gates

- Selected: `pnpm check`; `pnpm build:examples`; render-pixi unit tests; the examples-runner Node tests; a local Chromium boot of the new example under the fake host.
- Omitted here, pending on CI: the `examples` smoke project (it needs `/favicon.ico` handling this container's full-Chrome build lacks, the same on untouched `main`), `pnpm test:parity` in WebKit and Firefox, `pnpm test:e2e`.
- No changeset.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-23 | Plan | `93036d4` | |
| 2026-10-23 | 1 | | `pnpm --filter @mcthaydt/automata-render-pixi test:unit`: 15 files, 109 tests passed on the first run, so every row of the table is a regression pin and none is new. |
| 2026-10-23 | 2 | | `examples/render/render-interpolation.ts` (about 55 code lines). `pnpm --filter @af-examples/examples typecheck` exit 0; the examples-runner catalog test passes (51 passed, 1 skipped). Booted through the runner (`vite build` + `vite preview` on this checkout's derived ports, the fake host beside it) in Chromium with swiftshader at Pixel 7: the title screen has Play, play shows the pink marker and the square, the HUD says `blend on   alpha 0.55` and the square sits a fraction of a tick off the marker (it was moving left, so it is to the right of it); after `I` the HUD says `blend off   alpha 0.85` and the square sits on the marker. Console: one 404 (the favicon, as on every example here), no CSP violation. Screenshots read, not promoted. |
| 2026-10-23 | 3 | | `git rm -r examples/render-pixi/renderer-2d` (9 tracked files), the `playwright.config.ts` import, `demos` testMatch entry and `webServer` entry, the `knip.jsonc` workspace entry and the README row; `pnpm install --offline` dropped 61 lockfile lines. Red on the first `pnpm check`: knip failed on ten e2e files, five `@playwright/test` dev dependencies and five exports (see the decision above); with the `examples` workspace naming the config, `pnpm knip` is clean on this branch and on the base. `pnpm check` 30 of 30 tasks successful; `pnpm build:examples` built every example. |
| 2026-10-23 | 4 | | EX plan checklist ticked with the filter note; 02 gets the filter-verb follow-up row, the EX.4 progress note and the QB.1a edit (the `renderer-2d` ignore is gone). The execution-record row and 03 come with the docs sync PR. |
