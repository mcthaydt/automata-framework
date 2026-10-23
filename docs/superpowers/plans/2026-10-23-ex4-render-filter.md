# EX.4: `render/render-filter` example TDD plan

- **Spec:** [EX spec](../specs/2026-10-16-examples-one-file-design.md) §2 (one file, public imports, 100 code lines), §5 (smoke), §6 (`render-pixi/renderer-2d` → `render/render-interpolation.ts`, `render/render-filter.ts`); [EX plan](2026-10-16-examples-one-file.md) Task EX.4; [postFilter verb plan](2026-10-23-post-filter-verb.md) (the verb this example shows); [M4 spec](../specs/2026-10-16-m4-input-display-design.md) §4.11 (quality tiers) and §6 (a filter that cannot be built is absent).
- **Task:** the second half of the `render-pixi/renderer-2d` row, which [the renderer-2d plan](2026-10-23-ex4-renderer-2d.md) deferred until the verb existed. Closes the `Follow-up (found in EX.4) — A screen-space filter verb for the umbrella` row in 02.
- **Status:** drafted 2026-10-23. Stacked on the verb PR (#111). No PR is opened until the shared runner's queue drains (the merge thread asked for that); the branch is pushed so the work is not lost.
- **Progress:** 4 of 4 steps.

## What the old demo checked

The old `renderer-2d` demo's "filter" was an identity pass-through, so its e2e only proved that a stage with a post filter booted. That pin lives on: the post-filter slot and `filterPrograms` keep their render-pixi unit and three-engine parity tests, and the verb adds `post-filter.test.ts`, the renderer cases and `parity/post-filter.parity.test.ts`. The example adds no test of the verb; it shows it, and its checks are the ones every example has (EX spec §5): the catalog test, `typecheck`, and the smoke boot under the fake host with no console error and no CSP violation.

## Decisions

- **Two filters, to show what the verb is for.** `dusk` tints the picture warm and darkens its corners (all tiers, order 0). `scanlines` darkens every second row of the 180-row playfield (`minTier: 'medium'`, order 1, so it runs on the tinted picture). One filter would show that a filter draws; two show `order` and `minTier`, the two options a game reaches for first (a palette lock and a `high`-only bloom, in the verb plan).
- **The tier keys drive the demo, as in `render-quality`.** `1`, `2`, `3` set the quality tier on the stage, so a reader sees `scanlines` leave at `low` and return at `medium` and `high`. `render-quality` says in its header that a tier "leaves out post filters registered with a higher minTier" but registers none; this example is the one that shows it. The HUD prints the tier and `stage.postFilters.ids`, the filters running now, so the claim is on screen rather than only in the header.
- **No uniforms.** Both shaders are constants; a filter with a parameter waits for a uniform API (deferred in the verb plan).
- **The shaders are written as the example's data.** GLSL and WGSL are template strings in the file. They count toward the 100 code lines, so they are short; that is part of the point of the budget.
- **HUD at y = 40.** The playfield is cropped top and bottom on wide landscape phones (found in the previous two ports), so the HUD sits where it shows at Pixel 7 landscape.
- **`render-quality`'s own HUD (y = 4) is not touched here.** It is clipped at 780 × 270 for the same reason; it is another example's fix, recorded in 02 as a follow-up rather than folded into this PR.

## Files

- **Create:** `examples/render/render-filter.ts`.
- **Modify:** `examples/README.md` if it lists examples by name (the catalog is generated, so likely not); `docs/02-master-delivery-plan.md` (close the follow-up row; add the `render-quality` HUD follow-up); the EX plan's EX.4 checklist; this plan; `docs/03-continuation-prompt.md` (with the docs sync PR).
- **No changeset:** no published package changes.

## Interfaces

- **Consumed:** `defineComponent`, `defineSystem`, `definePlugin`, `defineGame`, `rect`, `postFilter` from `@mcthaydt/automata`; `GameSpec.renderer.postFilters`; `GameSpec.renderer.setup(stage)` for `stage.setQuality` and `stage.postFilters.ids`; `GameSpec.draw` (`ctx.rect`, `ctx.text`).
- **Produced:** the example `render-filter` (Tier core, `Packages: @mcthaydt/automata`); nothing else.

## Steps

- [x] **1. The checks, run after each draft.** An example's tests are the catalog's real-examples test and `pnpm --filter @af-examples/examples typecheck` (EX spec §5), so there is no test to write before the file exists. Write the first draft, run both, and record any rule it breaks (the 100-line budget, the header, the import list) before bringing it within them.
- [x] **2. The example.** Bring it within the budget; the catalog test and `typecheck` pass. Boot it through the runner under the fake host in Chromium at Pixel 7 and at 780 × 270 and read the screenshots at each tier: `dusk` tints and darkens the corners at every tier, `scanlines` appears from `medium` up, and the HUD names the filters running.
- [x] **3. Prove the filter is on the screen.** A screenshot shows it to a reader but does not pin it. Measure the screenshot's pixels at `high`, `medium` and `low` in the same boot: the row-to-row roughness down a square's column (the vignette is smooth, scanlines are not) is high where `scanlines` runs and low where it does not. This is a one-off check recorded here, not a committed test: the verb's own parity test is the permanent pin, and a fixture cannot prove a real host/game journey (AGENTS.md), which the smoke boot covers.
- [x] **4. Docs.** Tick `render-filter` in the EX plan; close the 02 follow-up row and add the `render-quality` HUD row; the execution record and 03 come with the docs sync PR.

## Gates

- Selected: `pnpm check`; `pnpm build:examples`; the examples-runner Node tests; a local Chromium boot of the example under the fake host at two sizes.
- Omitted here, pending on CI: the `examples` smoke projects, `pnpm test:parity` in WebKit and Firefox, `pnpm test:e2e`.
- No changeset.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-23 | Plan | `656432d` | |
| 2026-10-23 | 1 | | First draft `examples/render/render-filter.ts` (71 code lines of 100, shaders included): `pnpm --filter @af-examples/examples typecheck` exit 0 and the examples-runner catalog test 51 passed, 1 skipped, so the first draft broke no rule; no red state to record. The check that it does what the header says is step 3. |
| 2026-10-23 | 2 | | Booted through the runner (`vite build` + `vite preview` on this checkout's own ports, the fake host beside it) in a local Chromium with swiftshader. At 780 × 270: at `high` the HUD says `quality high   filters dusk scanlines`, the squares carry horizontal bands one game row tall and the picture is warm with dark corners; at `low` it says `filters dusk`, the bands are gone and the tint and vignette stay. At Pixel 7 portrait the HUD sits at y = 40 inside the playfield and the filter runs. The only console error was the favicon 404 this container's full-Chrome build makes on every example; no CSP violation. Screenshots read, not promoted. |
| 2026-10-23 | 3 | | Row-to-row roughness down a square's column, from the screenshots at 780 × 270: `high` 6.5, `medium` 7.1, `low` 1.6 (Pixel 7 portrait: 5.7, 6.1, 3.0). `scanlines` is on at `medium` and above and absent at `low`, as `minTier` says; the vignette is smooth so `low` stays near zero. A scratch measurement under `/tmp`, not a committed test: the verb's own parity test is the permanent pin. |
| 2026-10-23 | 4 | | EX plan checklist ticked; 02's follow-up row updated (it stays unchecked until CI and review) and a follow-up row added for the two examples whose HUDs sit outside the visible band on wide phones (`render-quality` at the top, `shapes-draw-hud` at the bottom). The execution-record row and 03 come with the docs sync PR. |
