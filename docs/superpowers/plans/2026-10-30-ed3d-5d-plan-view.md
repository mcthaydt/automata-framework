# ED3D.5d Plan view in the shell: TDD plan

- **Task:** ED3D.5d in [02](../../02-master-delivery-plan.md). [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §3 (ED3D-D7, D11, D12, D15), §5.2 (layers), §5.3 flows 3 and 7, §6 (Plan), §9 (the Split frame's top bar, plan viewport, layers and status line), §10, §11 (pointer cancelled, rotation, WebGL lost), §12. [Kit spec](../specs/2026-10-23-editor-kit-design.md) §4.2 (shell geometry 56/320), §4.5 (`attachGestures`, `Viewport2D`).
- **Lane:** editor-3d. **Depends on:** ED3D.5c (#258, the scaffold and `DocumentFrame`), ED3D.5a (#150, `plan-controller`), EDK.3 (gestures), all merged. **Unblocks:** ED3D.5e (Dollhouse and Split), ED3D.5f (inspector cards), ED3D.6g (sector tools in Plan), ED3D.9c, ED3D.10b.
- **Owner priorities (2026-10-30, through the coordinator, APP spec §5b in PR #263):** "tablet ready, cloud collaboration, and designed for non-game devs". For this slice: WebKit iPad layout checks and a touch and Pencil journey from this first PR, 44 px targets, and plain words in every label and message (a disabled control says why, an error says what to do next).
- **Status:** Drafted 2026-10-30. Owner, 2026-10-30: "Auto accept all spec and plans": accepted once its review is done.
- **Progress:** 5 of 9 steps.

## Why

ED3D.5c opens a level into a frame whose canvas is a placeholder. The headless pieces of the Plan view are merged: `planScene` (the draw list of fills and walls), `plan-pick`, `thing-pick`, `plan-snap`, `plan-viewport` and `createPlanController` (Select: hover, tap, drag a corner or a sector, pan, zoom, fit). This slice puts them on screen: a PixiJS renderer of the plan, the kit's gestures feeding the controller, the layers panel, the top bar's modes and checks pill, and the status line.

## Scope

**In:** the Plan view as the only mode that draws (Split, 3D, Walk and World are listed and disabled with the row that brings them); fills by zone or style, walls by kind, things by their definition's colour and shape (Last Light's nav nodes and camera zones are things, ED3D-D14), grid (0.25 m, 0.5 m zoomed out, ED3D-D11), rulers along the top and left edges; the Select tool through `plan-controller`; the layers panel (Sectors, Walls, Things with one sub-layer per definition; show/hide and lock); the checks pill (counts only; the panel is ED3D.10b); the status line (the pointer's place in metres, the zoom, the selection, the save state); the kit's 56/320 geometry with the mockups updated.

**Out (their rows):** the tool rail and every drawing tool (ED3D.6g, ED3D.7d); the inspector cards and the portrait bottom sheet (ED3D.5f; below `wide` the layers panel is the kit's drawer); Dollhouse and Split (ED3D.5e); the checks list and Ask (ED3D.10b); World (ED3D.9c); nav edges as lines (they are a link field of Last Light's nav things; ED3D.7c's link mode draws them, so this slice draws the nodes only).

## Interfaces

**Consumed:** `createPlanController(editor, size)` and `PlanView` (`app/plan-controller.ts`); `planScene(layers, select, options)` (`view/plan/plan-scene.ts`); `planViewport`, `cameraOf`, `toScreen` (`view/plan/plan-viewport.ts`); `thingLayer`, `ViewStore` (`model/view-store.ts`); the level's `EntityKit` (`entities/things.ts`, read as `thing-pick` reads it); `createChecksPanel` counts (`app/checks-panel-controller.ts`); kit `attachGestures`, `EditorShell`, `StatusLine`, `Segmented`, `Pill`, `Button`, `shellModeOf`, `layout-sizes`, `fake-pointer`.

**Produced (editor-private; editor-3d is a private package):**

| File | What |
|---|---|
| `src/view/plan/plan-paint.ts` | `planPaint(input): PlanPaint`: the headless paint list. Fills with a colour per group (a stable palette over the groups in level order, tinted by floor height), walls with the stroke of their kind (`ent/wall`, `ent/portal` dashed, `ent/door`, `ent/window`), the selection outline, things as marks (point: a disc; box: a rect; `area`: a dashed rect) in their definition's `color`, the grid lines inside the visible rectangle (major every metre) and the ruler ticks with their labels. Pure numbers and hex colours, no Pixi |
| `src/view/plan/plan-colors.ts` | The `Editor 3D` viewport colours of the mockups (`ent/*`, `view/plan`) as constants, one place, with the mockup file named |
| `src/ui/plan/plan-renderer.ts` | `createPlanRenderer(canvas, options)`: a WebGL2-only Pixi `Application` (no WebGPU or canvas fallback, the same rule as editor-2d's level view) that draws a `PlanPaint` into one `Graphics` per pass; `resize`, `draw`, `destroy`; `onContextLost`/`onRestored` |
| `src/ui/plan/PlanCanvas.svelte` | The canvas host: makes the renderer (injected factory, so DOM tests use a fake), measures with `ResizeObserver`, `attachGestures` → controller (tap, drag start/move/end/cancel, two-finger pan and pinch, wheel zoom; Pencil never pans), redraws on the editor, the view store and the controller; a `role="status"` notice when WebGL is unavailable or lost, with the reason and a Try again button |
| `src/ui/plan/LayersPanel.svelte` | The layers list: a row per layer and per thing definition with Show/Hide and Lock toggles (44 px, `aria-pressed`, labels that name the layer), the active layer marked |
| `src/ui/plan/layers-model.ts` | `layerRows(profile, kit, view)`: the rows, their labels, colours and states. Pure |
| `src/ui/document/ModeSwitch.svelte` | The top bar's modes (Plan, Split, 3D, Walk, World) on the kit's `Segmented`; the unbuilt ones disabled with a reason in plain words |
| `src/ui/document/ChecksPill.svelte` | "No problems", "2 warnings", "1 error · 3 warnings" with the kit pill's tone |
| `src/ui/plan/plan-status.ts` | `planStatus(view, pointer, zoom, selection)`: the status line's words ("x 3.25 m · z −1.50 m", "Zoom 48 px/m", "Sector hall selected"). Pure |
| `src/ui/document/DocumentFrame.svelte` (modify) | The placeholder gives way to `PlanCanvas`; the panel snippet is `LayersPanel`; the top bar gains `ModeSwitch` and `ChecksPill`; the status line gains the plan's words |
| `src/main.ts`, `src/ui/boot.ts`, `src/ui/App.svelte` (modify) | The renderer factory reaches the frame (a dynamic `import()` so Pixi is not in the first chunk) |
| `package.json`, `vitest.config.ts` (modify) | `pixi.js` 8.22.0 (the repo's one pin); a `canvas` project (Chromium, WebGL2); `layout` in Chromium, WebKit and Firefox; `test:canvas`, `test:parity` |
| `docs/design/editor-3d/ui.mjs` (modify) | `RAIL` 64 → 56, `INSP` 296 → 320 (ED3D-D12); its gallery test stays green |

No contract of another package changes. No public API (the package is private and has no api report).

## Ordered flows (what the tests pin)

1. **Open:** the frame mounts; the canvas measures its box, then the renderer draws once at that size; `fit()` frames the level.
2. **Tap (mouse, touch or Pencil):** the controller selects the wall, else the sector, under the point; the plan redraws with the selection outlined; the status line names it. A tap on nothing clears the selection.
3. **Drag:** past the slop, a press on a selected sector's corner moves the corner, else on a selected sector moves the sector; one undo step at the end; a cancelled pointer keeps nothing (§11).
4. **Pan and zoom:** two fingers pan and pinch; a mouse wheel zooms about the pointer, and with Shift or a trackpad pans; a Pencil never pans (it is a tap or a drag).
5. **Layers:** Hide takes a layer out of the drawing and out of hit testing; Lock leaves it drawn and not hit (§5.2). Each is a view-store change, not an undo step.
6. **Context lost:** the notice says "The plan stopped drawing. Your level is safe." with Try again; the level, selection and history are untouched; the restore redraws.
7. **Resize and rotation:** no remount; the camera keeps its centre; the selection and the active layer stay.

## Steps (each: failing test first, its reason confirmed, then the minimal code)

1. [x] **Toolchain.** `pixi.js` 8.22.0, the `canvas` project with `optimizeDeps` as in editor-2d, `layout` in three browsers, the scripts. Test: a `plan-renderer.canvas.test.ts` placeholder that imports `pixi.js` fails before the dependency. Run: `pnpm --filter @mcthaydt/automata-editor-3d test:canvas`.
2. [x] **Colours and paint list.** `plan-colors.ts`, `plan-paint.ts`. Unit tests with fixed numbers: a fill per sector with its group colour, a stable colour for the same group across calls and levels; walls by kind with their stroke and width; door and window spans as pieces; the selected sector's outline; a point thing, a box thing and an area thing in their definition's colour; a thing whose sub-layer is hidden is absent, a locked one present; grid lines only inside the view (0.25 m at or above 40 px/m, 0.5 m below, majors on whole metres); ruler ticks and labels. Run: `vitest run --project unit src/view/plan/plan-paint.test.ts`.
3. [x] **Renderer.** `plan-renderer.ts`, Chromium canvas tests reading pixels: a fill's colour at its centre, a wall's colour on its line, the background colour outside, a resize that changes the drawing buffer, a WebGL 1 context refused, context loss reported and a restore redrawn.
4. [x] **Layers model and panel.** `layers-model.ts` (unit: rows for Sectors, Walls, Things and one per definition in the kit's order, each with its label, colour and state), `LayersPanel.svelte` (DOM: Show/Hide and Lock toggle the view store; `aria-pressed`; the buttons' names say what they do, "Hide Walls", "Lock Lamps").
5. [x] **Plan canvas.** `PlanCanvas.svelte` with a fake renderer (DOM): the first draw after the measure; a tap through `attachGestures` with the kit's `fake-pointer` selects a sector (the editor's selection changes and a redraw follows); a two-finger pan moves the camera; a wheel zooms; a Pencil drag on empty plan does not pan; a cancelled drag leaves the level as it was; the notice for unavailable and lost WebGL, with Try again.
6. [ ] **Top bar and status line.** `ModeSwitch.svelte` (DOM: Plan pressed, the others disabled with their reason as the accessible description), `ChecksPill.svelte` (DOM: the three wordings and tones), `plan-status.ts` (unit: the words for each case, the minus sign, two decimals).
7. [ ] **Frame wiring and boot.** `DocumentFrame.svelte`, `App.svelte`, `boot.ts`, `main.ts`. DOM: the frame shows the canvas, the layers panel, the mode switch, the pill and the plan's status words; the boot hands the renderer factory over; `vite build` keeps Pixi out of the main chunk (recorded with sizes).
8. [ ] **Layout and tablet journeys (Chromium, WebKit, Firefox).** `plan-view.layout.test.ts` at the kit's eight sizes: the canvas fills its region, the layers panel is 320 px at `wide` and a drawer below it, every button at least 44 px, no horizontal page scroll, the frame not remounted by a resize (the selection survives). The iPad journey (WebKit at 1194×834 and 834×1194, touch and pen samples): open a fixture level, tap a sector (selected), drag its corner with the Pencil (one undo step), rotate (selection kept), hide Walls (a tap on a wall now selects the sector).
9. [ ] **Mockups and gates.** `ui.mjs` 56/320 and its gallery test; spec §6 "As built (ED3D.5d)" paragraph; `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm --filter @mcthaydt/automata-editor-3d test:parity` and `test:canvas`, `pnpm --filter @mcthaydt/automata-editor-3d build`. Review images of the plan at `wide` (written with `ED3D_VISUALS=1`) for visual acceptance; real-iPad runs stay the Owner's.

## Gates

- Selected: `pnpm format`; `TURBO_FORCE=true pnpm check`; editor-3d `test:parity` (layout in three browsers); `test:canvas` (Chromium); the package build. Omitted: `api-report`, `api-index`, `agent-skills`, changesets (editor-3d is private and exports no new public API). Pending: CI, the GPU runner, a real iPad.

## Execution record

- **Step 1** (2026-10-30): `pixi.js` 8.22.0 and the `canvas` project; the placeholder canvas test failed in Node (no `document`) before the project existed, then passed in Chromium. The `layout` project now runs Chromium, WebKit and Firefox: the existing 192 layout cases passed in all three at the first run.
- **Step 2** (2026-10-30): `plan-colors.ts` and `plan-paint.ts` (11 tests), failing first on the missing modules. Deviations from the plan text: the grid reuses ED3D.4's `gridLines` (the step doubles until lines are 16 px apart, majors every fourth line) rather than a new 40 px/m rule; a group's fill comes from a hash of its name into eight muted fills, not a floor-height tint, so a zone keeps its colour across levels; nav edges are drawn after all, as `links`, because `LevelProfile.links` already lists them (ED3D.7c). One test of mine was wrong (it linked a lamp to a crate; a link joins two things of one definition) and was corrected. `halfFootprint` is now exported from `thing-pick.ts`, so the paint and the pick share a box's footprint.
- **Step 3** (2026-10-30): `plan-renderer.ts` (5 Chromium tests: background, fill, wall and thing pixels; a hole cut; resize redraws at the new size; WebGL 1 and no-WebGL refused; context loss pauses, keeps the newest list and redraws on restore), failing first on the missing module, then passing at the first run. `createWebGL2Renderer` is the same 12 lines as editor-2d's in #255; it is private to each editor until a shared home exists (the kit has no Pixi dependency), recorded as a follow-up. Rulers are left to the DOM (step 5): labels as text stay crisp and need no Pixi text.
- **Step 4** (2026-10-30): `layers-model.ts` (3 unit tests) and `LayersPanel.svelte` (4 DOM tests), each failing first on the missing module. The first DOM run found the name button's accessible name included its count ("Sectors 3"); the button is now labelled with the layer's name (and ", off with Things" for a sub-layer under a hidden or locked Things).
- **Step 5** (2026-10-30): split into two pure modules and the host. `app/plan-picture.ts` (3 unit tests: the level at the camera with the selection outlined, hidden layers, the depot's things) and `ui/plan/plan-gestures.ts` (5 unit tests: taps with kind and keys, drags from the press, a cancelled end, two-finger pan, pinch and wheel, Pencil hover, two- and three-finger taps for Undo and Redo), each failing first on the missing module. Deviation: `PlanCanvas.svelte` was written before its DOM test; the test (5 cases: the first draw after the measure, a tap through the kit's gestures selecting the hall, no WebGL2 with Try again, a lost context keeping the selection, a resize without a new renderer) then failed twice on my assertions (the notice appears after the factory's promise; a hidden status is not found by role) and passed after they waited and queried correctly. A Pencil drag on empty plan not panning, and a cancelled drag keeping nothing, are the controller's (ED3D.5a tests) and are walked again in step 8's journey.
