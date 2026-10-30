# ED2D.4c4a: the Level view (canvas, layers, palettes and tools)

- **Lane:** editor-2d (editors lane). **Depends on:** ED2D.4c2b (open flows, merged), ED2D.4c3b (the Pixi level canvas, #255), EDK.3 (gestures and `Viewport2D`, merged). **Unblocks:** ED2D.4c4b (inspector, dock, shortcuts), EDFF.2a, ED2D.5b, ED2D.5c.
- **Spec:** [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §5.9 (tools and the controller), §7 (`ViewDef`), §8 (the Level row, flows 1 to 3), §12 (sizes and input), §13 (pointer cancelled), §14, §15 (G-a, G-c, G-j); [kit spec](../specs/2026-10-23-editor-kit-design.md) §4.2 (shell), §4.5 (gestures, `Viewport2D`); the Owner's editor priorities of 2026-10-30 (APP spec §5b, PR #263): tablet ready (WebKit and touch from the first PR, 44 px targets), git-backed collaboration (nothing here: no new storage path) and plain words for people who are not developers.
- **Status:** drafted 2026-10-30. Accepted under the Owner's standing rule (2026-10-30): "Auto accept all spec and plans".
- **Branch:** `claude/editors-ed2d-4c4a-level-view`, stacked on #255's head (`c798efc0`) until #255 merges; main is merged in then.

## Scope

In: a view router driven by the profile's `ViewDef`s that replaces `DocumentFrame`; the rail (a column in `wide`, a tab bar below it); the Level view with the layer panel (select, show or hide, lock, the kind in words), the palette for the selected layer (tileset tiles, IntGrid values, entity definitions), the toolbar (tools and brush size), and the canvas: `attachGestures` and a `Viewport2D` feeding the ED2D.4b controller over the open document's `History`, with pan, pinch, wheel zoom and fit; a two-finger tap undoes and three fingers redo; a pointer cancelled mid-stroke leaves nothing (spec §13). G-a, G-c and G-j automated. DOM, layout and canvas tests, the canvas ones in Chromium and WebKit (moved here from #255: its `canvas` project ran Chromium only).

Out (owner): the inspector tabs, the dock of level cards, keyboard shortcuts, portrait drawers' extra sheets (ED2D.4c4b); the other views' content (World ED2D.6b, Tilesets ED2D.5b, Entities ED2D.5c, Checks ED2D.7a, Export ED2D.7): their rail entries open a plain "coming later" view that says the project is safe; select-tool marquee, stamps, dice, handles (ED2D.4d); Playwright iPad journeys and device passes (ED2D.8, the Owner).

## Decisions (the agent's defaults; open to the Owner's veto)

1. **Router.** `app/document/view-router.ts` (pure): `viewsOf(profile)` gives the rail's entries; `routeOf(views, id)` picks the view (unknown id → the first), and `componentOf(name)` in `app/views/views.ts` maps a `ViewDef.component` name to a Svelte component, with `PendingView` for a name not built yet. No profile id appears (G-s): the component names are the profile's data. `DocumentFrame.svelte` is replaced by `app/document/DocumentScreen.svelte`, which keeps the top bar, status line, dialogs and toasts and hands them to the chosen view as a `frame` prop; each view renders the kit's `EditorShell` with its own panel, canvas and inspector. Switching view remounts only the view; the document, its history and its session stay.
2. **The view's state lives in a session.** `app/level/level-session.ts` (plain TS, Node-tested) owns one `createLevelEditor` over the document's history (an `EditHistory` adapter from `History<unknown>`; the Level view is only offered by a profile whose value is a `Project`, and the adapter refuses a value with no `levels` array, so a wrong pairing says so instead of throwing in a handler), subscribes `refresh()` to the history, and holds the viewport: the first measure fits the level (padding 24), a resize keeps the centre (`Viewport2D.resize`), pan, pinch and wheel go through `panBy` and `zoomAt`, and the camera handed to `LevelCanvas` is `{ x: pan.x, y: pan.y, scale: zoom }`. Screen points go to level pixels through `screenToWorld`.
3. **Gestures** (`app/level/level-gestures.ts`, a plain function like editor-3d's `planGestures`): a tap is `pointerDown` then `pointerUp` at the point; `dragStart` is `pointerDown` at the start then `pointerMove` to the current point; `drag` moves; `dragEnd` is `pointerUp`, or `cancel` when cancelled; hover moves (the footprint); `pointerLeave` on leaving. A middle-button mouse drag pans. Once a pen has touched the canvas, a one-finger drag pans instead of drawing (spec §5.9, kit §4.5; the recogniser already turns a touch during the pen's contact into a palm). Two fingers pan and pinch; a two-finger tap undoes and a three-finger tap redoes.
4. **Plain words.** Tools are named Select, Brush, Rectangle, Fill, Eraser and Pick (the `picker` tool); layer kinds read "Tiles", "Grid values", "Auto tiles", "Things" and "Objects"; a hidden layer's button says "Show <name>", a locked one "Unlock <name>"; a locked or hidden layer under a tool shows "This layer is locked. Unlock it to draw." over the canvas rather than silently doing nothing. Every control is at least 44 px; palette cells are 44 px on `compact` and `medium` (spec §12) and 44 px on `wide` too in this slice (the grid-size scaling is ED2D.8 polish).
5. **The palette shows real tiles when the image is there.** A tile cell is a CSS sprite of the tileset image (an object URL from the workspace bytes, made by an injected `objectUrls` port so jsdom tests run, revoked on unmount); without the image it is the numbered flat placeholder the canvas uses (`canvas/colors.ts`). IntGrid values are swatches of their colour with their name; entity definitions are their colour, name and size.
6. **Where it sits.** The panel holds the layers above the palette (one scroll region each); the toolbar is a row over the canvas; no inspector or dock yet (4c4b), so in `wide` the canvas takes their room. Below `wide` the panel is the kit's drawer (medium) or sheet (compact), opened by a **Layers** button in the top bar, as Home's Sources.

## Files

Create (all under `packages/editor-2d/src/`):

| File | Produces |
|---|---|
| `app/document/view-router.ts` + `.test.ts` | `viewsOf`, `routeOf` |
| `app/views/views.ts` + `.test.ts` | `componentOf(name)` |
| `app/views/PendingView.svelte` + `.dom.test.ts` | the "coming later" view |
| `app/document/DocumentScreen.svelte` + `.dom.test.ts` | the router screen (replaces `DocumentFrame`) |
| `app/document/ViewRail.svelte` + `.dom.test.ts` | the rail (`role="tablist"`, vertical or horizontal) |
| `app/level/edit-history.ts` + `.test.ts` | `projectHistory(history)` |
| `app/level/level-session.ts` + `.test.ts` | `createLevelSession` (editor, viewport, camera, measure, pan, zoom, fit) |
| `app/level/level-session-acceptance.test.ts` | G-a, G-c, G-j through the real `History`, profile and workspace |
| `app/level/level-gestures.ts` + `.test.ts` | `levelGestures(session, history)` |
| `app/level/LayersPanel.svelte` + `.dom.test.ts` | layer list |
| `app/level/Palette.svelte` + `.dom.test.ts`, `app/level/palette-model.ts` + `.test.ts` | the palette and its items |
| `app/level/LevelToolbar.svelte` + `.dom.test.ts` | tools and brush size |
| `app/level/LevelView.svelte` + `.dom.test.ts` | the Level view in the shell |
| `app/level/level-view.layout.test.ts` | the Level view at the eight sizes, three browsers |
| `app/level/level-view.canvas.test.ts` | real pointer events into the mounted view, Chromium and WebKit |

Modify: `app/App.svelte` (mount `DocumentScreen`), `app/boot.ts` (pass the workspace's `read` and the object-URL port), `main.ts` (the real `URL.createObjectURL`), `vitest.config.ts` (the `canvas` project adds WebKit), `testing/` fixtures as needed. Delete: `app/DocumentFrame.svelte` and `app/DocumentFrame.dom.test.ts` (their cases move to `DocumentScreen.dom.test.ts`, none dropped). Spec §8: an "As built (ED2D.4c4a)" paragraph.

Consumed: kit `attachGestures`, `GestureHandlers`, `createViewport`/`Viewport2D`, `EditorShell`, `shellModeOf`, `Segmented`, `Stepper`, `Button`, `History`; editor-2d `createLevelEditor`, `LevelCanvas.svelte`, `fitCamera`, `colors.ts`, `OpenDocument`, `DocumentController`. No published package changes, so no changeset (editor-2d is private) and no API report change unless the kit is touched.

## Steps (strict TDD: each test fails first for the stated reason)

- [ ] 1. **Router.** `view-router.test.ts`: the level-project profile's six views come back in order with labels; an unknown id routes to the first; a profile with no views routes to none (the screen shows the pending view). Fails: no module. `views.test.ts`: `LevelView` maps to the Level view, any other name to `PendingView`.
- [x] 2. **Edit history adapter.** `edit-history.test.ts`: `projectHistory` over a kit `History` applies, begins and commits as the kit does; a value with no `levels` array is refused with a plain message. Fails: no module.
- [x] 3. **Session.** `level-session.test.ts`: the first `measure` fits the level centred with 24 px padding; `resize` keeps the centre; `panBy`, `zoomAt` change the camera and never the history; screen to level pixels through the viewport; history changes call `refresh` (a deleted selected id drops); `dispose` stops the subscriptions. Fails: no module.
- [x] 4. **Gestures.** `level-gestures.test.ts` with a fake session: tap → down and up at level pixels; drag → down at start, moves, up; cancelled drag → `cancel`, no step; middle-button drag pans; after a pen, a one-finger drag pans; two and three finger taps undo and redo; wheel zoom and pan; pinch zooms about its centre. Fails: no module.
- [x] 5. **Acceptance in Node** (`level-session-acceptance.test.ts`, real profile, `History`, in-memory workspace): **G-a** create from the platformer template, paint on `collision`, `decor` and `ground`, place a `slime` and a `coin`, save, open again: the re-opened project equals the saved one. **G-c** paint IntGrid cells under the auto layer: the draw list's auto tiles equal the engine's full recompute (`autoTiles` over the final IntGrid with the compiled rules, overrides applied); the stroke is one undo step. **G-j** a pen drag over five cells is one undo step labelled `Paint`; a two-finger tap undoes it to the project before the stroke. Fails: no session.
- [x] 6. **Palette model.** `palette-model.test.ts`: tiles layer → tileset tiles (index, packed word, sprite position, placeholder colour without image); IntGrid → values; auto → its tileset's tiles (the brush stamps an override, spec §5.9); entities → definitions; objects → its tileset's tiles; selection follows the controller's word. Fails: no module.
- [ ] 7. **Components (DOM).** `LayersPanel`, `Palette`, `LevelToolbar`, `ViewRail`, `PendingView`, `LevelView` (fake canvas), `DocumentScreen` (every case of the old frame test, plus: the rail lists the six views, choosing one shows it, Back still works, the document stays across views, Take theirs makes a new session). Plain words and 44 px in the markup. Fails: no components.
- [ ] 8. **Mount.** `App.svelte` and `boot.ts` mount `DocumentScreen`; `boot.dom.test.ts` journey: New → the Level view on the template's first level → paint a stroke through the gestures → Undo enabled and named "Undo Paint" → Back. Old frame files deleted.
- [ ] 9. **Layout** (`level-view.layout.test.ts`, Chromium, WebKit, Firefox, the eight sizes of Home's layout test): no clipped or overlapping control, every control ≥ 44 px, the canvas region non-zero and not scrolling the page, the rail inside the screen, the panel reachable (inline in `wide`, by **Layers** below), rotation 1194×834 → 834×1194 keeps the selected layer and tool.
- [ ] 10. **Canvas and touch** (`level-view.canvas.test.ts`, Chromium and WebKit, iPad 11" landscape): the mounted Level view draws (`data-state="drawn"`); a pen pointer stroke over the canvas paints cells and is one undo step; a touch stroke cancelled mid-way leaves the project unchanged; a two-finger tap undoes; a wheel with Ctrl zooms. Fails first on WebKit until the project lists it.
- [ ] 11. **Spec as built** and gates.

## Gates

`pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm --filter @mcthaydt/automata-editor-2d test:parity` (layout and browsers, three browsers); `pnpm --filter @mcthaydt/automata-editor-2d test:canvas` (Chromium and WebKit); `pnpm changeset status --since=origin/main` and `node tooling/release/src/check-changesets.ts` (expect nothing: private package). If the kit changes: its `test:parity`, `pnpm build`, `pnpm api-report`. Omitted: the GPU runner's visuals (no goldens yet), Playwright iPad journeys (ED2D.8), real devices (the Owner).

## Execution log

- 2026-10-30: plan written; branch stacked on #255 (`c798efc0`).
- 2026-10-30, steps 2 to 6: each unit test failed first on its missing module, then passed (edit history 2, session 9, gestures 9, palette 8). Step 5's acceptance file was written after the session existed, so it never failed on "no session"; it passed at once (3 tests). Deviation from decision 5's palette list: an auto layer offers its tileset's tiles, not its source's values, since spec §5.9 has the brush stamp an override there.
