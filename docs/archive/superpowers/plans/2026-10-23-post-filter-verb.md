# `postFilter`: a screen-space filter verb for the umbrella TDD plan

- **Spec:** [EX spec](../specs/2026-10-16-examples-one-file-design.md) §2 ("a core verb is missing; the budget is not raised") and §6 (`render/render-filter.ts`); [PRODUCT spec](../specs/2026-10-16-product-core-and-plus-design.md) §2 F1 (the post-filter slot), §7 (the umbrella); [M4 spec](../specs/2026-10-16-m4-input-display-design.md) §6 (a filter that cannot be built is absent, not a throw). Filters stay GLSL + WGSL pairs (ADR 0002, AGENTS.md).
- **Task:** `Follow-up (found in EX.4) — A screen-space filter verb for the umbrella` (02). Approved on the bus by the hub, 2026-10-23: "add the core verb as you proposed: `postFilter(name, { glsl, wgsl })` in `render-pixi`, exported through `game` and the umbrella, registering in the stage's post-filter slot. Then write the one-file example."
- **Status:** drafted 2026-10-23. Stacked on the host-lifecycle port (#110) only so the stack merges in one order; apart from `docs/02` it touches none of the files those PRs change.
- **Progress:** 7 of 7 steps.

## What exists, what is missing

`render-pixi` has the parts: `filterPrograms(name, glsl, wgsl)` builds a `GlProgram` and `GpuProgram` pair with the shared vertex stage, `PixiStage.postFilters` is the slot, `PixiStage.tryFilter` builds a filter or drops it with a warning and `render.filter.dropped`, and `setup(stage)` is the hook a game uses. Putting them together takes `new Filter({ glProgram, gpuProgram })` from `pixi.js`, `filterPrograms` from `render-pixi` and a `setup` callback, and an example may import only `@mcthaydt/automata`. The umbrella has none of the three.

## Decisions

- **Declarative, on the renderer options.** `postFilter(name, spec)` returns a `PostFilterDef` (a frozen `{ name, glsl, wgsl, order, minTier }`), and `PixiRendererOptions.postFilters` takes a list of them. A game writes `renderer: { postFilters: [postFilter('vignette', { glsl, wgsl })] }`, which `defineGame` already merges into the Pixi options (`GameSpec.renderer`), so `game` only re-exports the verb and its types and changes no logic. The alternative, a function that takes the stage (`postFilter(stage, …)`), would make every game write a `setup` callback for what is one declaration.
- **What `createPixiRenderer` does with each def.** Before the game's own `setup` runs, for each def in list order: build `new Filter({ glProgram, gpuProgram })` from `filterPrograms(def.name, def.glsl, def.wgsl)` through `stage.tryFilter(def.name, …)`, and, when it is built, `stage.postFilters.set(def.name, [filter], def.order, { minTier })`. A filter that cannot be built or whose GLSL does not link is dropped by `tryFilter` (warning, `render.filter.dropped`), and the frame draws without it, like every other filter (M4 spec §6). The game's own `setup` then sees the slot already holding the declared filters and may add more.
- **Names are the slot's owner ids.** A name must be non-empty and unique in the list; a duplicate throws `postFilter "<name>" is declared twice` from `createPixiRenderer` (the slot would silently replace the first). An empty name or an empty shader throws from `postFilter` itself, naming the field. Both are programmer errors the game finds on its first boot; neither is a runtime condition to recover from.
- **`order` and `minTier` are the slot's own options**, passed through unchanged (`order` default 0, lower first; `minTier` the lowest quality tier it runs at, absent for every tier). They are in the spec because a pixel-art game's palette lock and a `high`-only bloom are the first two filters anyone writes, and the slot already supports both.
- **No uniforms in this change.** The spec carries two shader sources and nothing else. A filter with parameters (a vignette strength) waits for a use: the example's filter needs none, and a uniform API is its own design. Recorded as a deferred item in 02's row.
- **`Filter` and `filterPrograms` stay where they are.** `filterPrograms` remains exported from `render-pixi` for extensions (`render-pixi3d`, Plus filters) that build several filters or need uniforms. The verb is the 80% path, not a replacement.

## Files

- **Create:** `packages/render-pixi/src/filter/post-filter.ts`, `post-filter.test.ts`.
- **Modify:** `packages/render-pixi/src/renderer.ts` (the `postFilters` option and the registration), `renderer.test.ts`, `index.ts` (exports), `index.test.ts` if it pins exports; `packages/render-pixi/src/parity/post-filter.parity.test.ts` (new: a real-engine case); `packages/game/src/index.ts` and `index.test.ts`; `packages/automata/src/index.test.ts` (the pinned list); `tooling/api-report/reports/{render-pixi,game,automata}.api.md`; `docs/cheatsheet.md` and `tooling/api-index/undocumented-baseline.json` if the generators ask; a changeset (patch, the fixed group); `docs/02-master-delivery-plan.md` (the follow-up row); this plan.
- **No example here.** `examples/render/render-filter.ts` is the next PR, on this one.

## Interfaces

- **Consumed:** `filterPrograms`, `PostFilterSlot.set`, `PixiStage.tryFilter`, `QualityTier` (runtime).
- **Produced:** `postFilter(name, spec): PostFilterDef`, `PostFilterSpec`, `PostFilterDef`, `PixiRendererOptions.postFilters`; re-exported by `@mcthaydt/automata-game` and `@mcthaydt/automata`.

## Steps

- [x] **1. The verb's own contract, red first.** `post-filter.test.ts`: `postFilter('vignette', { glsl, wgsl })` returns a frozen def with `order` 0 and no `minTier`; `order` and `minTier` pass through; an empty name, an empty `glsl` and an empty `wgsl` each throw with the field named. Run `pnpm --filter @mcthaydt/automata-render-pixi test:unit`; they fail because the module does not exist.
- [x] **2. The renderer registers the defs, red first.** `renderer.test.ts` (the mocked-renderer suite): with `postFilters: [def]`, `stage.postFilters.ids` is `[name]` and `stage.filters` holds one `Filter` whose `glProgram.fragment` is the def's `glsl`; `order` places it among filters the game's `setup` adds; `minTier: 'medium'` at quality `low` leaves it out until `setQuality('high')`; a def whose build throws is dropped (one `render.filter.dropped` on the bus, the other defs still apply); a duplicate name throws. Fails on the missing option.
- [x] **3. Green.** `post-filter.ts` and the `createPixiRenderer` registration; the unit suites pass.
- [x] **4. A real engine.** `post-filter.parity.test.ts` (Chromium, WebKit, Firefox on CI; this container has Chromium): a renderer built with a `postFilter` that paints the scene one flat colour draws that colour (read back from the canvas), and the same renderer with a broken GLSL still draws, unfiltered, with the filter dropped. Run `vitest run --project browsers --browser.name=chromium`.
- [x] **5. The exports.** `game` re-exports the verb and its types, the umbrella's pinned list gains `postFilter` (red first: the pin test names it before it is exported), the three API reports are regenerated, the cheatsheet and baseline are regenerated and JSDoc written so `api-index` is green; changeset.
- [x] **6. Gates.** `pnpm format`, `pnpm check`, `pnpm api-report`, `pnpm build && pnpm api-index`, `pnpm changeset status --since=origin/main`, the render-pixi browser parity in Chromium.
- [x] **7. Docs.** 02's follow-up row says what landed and what is deferred (uniforms); the execution record and 03 come with the docs sync PR.

## Gates

- Selected: the render-pixi, game and automata unit suites; `pnpm check`; `pnpm api-report`; `pnpm api-index`; the changeset check; render-pixi parity in Chromium.
- Omitted here, pending on CI: parity in WebKit and Firefox, `pnpm test:e2e`.
- Changeset: none. `render-pixi`, `game` and the umbrella are private, and CI's `check-changesets` refuses a changeset that names a package AF does not publish (a first version of this plan added one, and CI's checks job failed on it).

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-23 | Plan | `2cdddb8` | |
| 2026-10-23 | 1, 2 | | Red first: `post-filter.test.ts` and the new `renderer.test.ts` cases failed on the missing module and the missing option (`Failed to resolve import "./post-filter.js"`; `postFilters` ignored). The pre-commit hook runs the unit suites, so the red state was run and recorded here but not committed on its own. |
| 2026-10-23 | 3 | `78daf3b` | `post-filter.ts` and the `createPixiRenderer` registration; `pnpm --filter @mcthaydt/automata-render-pixi test:unit` 118 passed (109 before). |
| 2026-10-23 | 4 | `097eedb` | `parity/post-filter.parity.test.ts` in real WebGL2: a flat-red filter turns a white 8 × 8 graphic red at pixel (2, 2); a broken GLSL is dropped and reported while the other filter still draws. Passes in Chromium here; WebKit and Firefox are CI's. |
| 2026-10-23 | 5 | | Red first: `packages/game/src/index.test.ts` (`exports postFilter`: `undefined` is not `function`) and `packages/automata/src/index.test.ts` (the pinned list, and "re-exports everything the game package exports") failed; after `game` re-exports the verb and its two types, game 146 and umbrella 20 tests pass. `pnpm api-report --update` rewrote the render-pixi, game and automata reports (additive). `pnpm build && pnpm api-index`: 528 exports, 182 undocumented (the baseline is unchanged: the new exports carry doc comments), cheatsheet not stale. Changeset `post-filter-verb.md` (patch, `@mcthaydt/automata-render-pixi`). |
| 2026-10-23 | 6 | `1c51bf0` | `pnpm format` (no fixes), `pnpm check` 30 of 30 tasks (lint, typecheck, boundaries, style, knip, unit), `pnpm api-report` (12 core packages, 1 change in `PixiRendererOptions`, 0 undeclared), `pnpm build && pnpm api-index` clean, `pnpm changeset status --since=origin/main` lists the fixed group bumped by the patch. render-pixi parity in Chromium through a temporary local config (this container's browsers are an older build than the pinned Playwright expects): 4 files, 8 tests passed. WebKit, Firefox and the full CI run are pending on the runner. |
| 2026-10-23 | CI fix | `baabdf7` | The hosted checks job failed at `check-changesets` (`.changeset/post-filter-verb.md: @mcthaydt/automata-render-pixi is not a published package`), a step `pnpm check` does not run. The changeset was removed; `node tooling/release/src/check-changesets.ts` (38 changesets, 0 problems) and `pnpm changeset status --since=origin/main` (exit 0) pass locally. |
