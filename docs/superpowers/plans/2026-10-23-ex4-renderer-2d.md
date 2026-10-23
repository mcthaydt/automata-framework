# EX.4: port `render-pixi/renderer-2d` TDD plan

- **Spec:** [EX spec](../specs/2026-10-16-examples-one-file-design.md) §2 (one file, public imports, 100 code lines), §6 (`render-pixi/renderer-2d` → `render/render-interpolation.ts`, `render/render-filter.ts`; tests to `packages/render-pixi`), §7 (smoke, no CSP violation); [EX plan](2026-10-16-examples-one-file.md) Task EX.4 (the three steps per demo).
- **Task:** `EX.4 — port the existing demos`, the `render-pixi/renderer-2d` row. One PR per demo.
- **Status:** drafted 2026-10-23. Stacked on EX.6 (#98): the example imports `@mcthaydt/automata`, which the catalog only accepts after EX.6.
- **Progress:** 0 of 4 steps.

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

- [ ] **1. The behavior pins pass.** Run `pnpm --filter @mcthaydt/automata-render-pixi test:unit`. Every test in the table above passes on its first run, so each is a regression pin and none is new. Record the counts.
- [ ] **2. The example.** Write `examples/render/render-interpolation.ts` within the budget. Red first: the catalog's real-examples test and `pnpm --filter @af-examples/examples typecheck` are the checks an example has (EX spec §5), so run them after each draft and record any failure. Then boot it through the runner under the fake host in Chromium and read the screenshot and the HUD (alpha varies; `I` flips the label and the square lands on the marker).
- [ ] **3. Delete the old demo.** `git rm -r examples/render-pixi/renderer-2d`, remove the `playwright.config.ts` and `knip.jsonc` entries, update the README, `pnpm install`. Then `pnpm check` and `pnpm build:examples`; the e2e and three-engine parity are the CI runner's.
- [ ] **4. Docs.** Tick `renderer-2d` in the EX plan with the filter note, add the 02 follow-up row and execution record, update 03.

## Gates

- Selected: `pnpm check`; `pnpm build:examples`; render-pixi unit tests; the examples-runner Node tests; a local Chromium boot of the new example under the fake host.
- Omitted here, pending on CI: the `examples` smoke project (it needs `/favicon.ico` handling this container's full-Chrome build lacks, the same on untouched `main`), `pnpm test:parity` in WebKit and Firefox, `pnpm test:e2e`.
- No changeset.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-23 | Plan | | |
