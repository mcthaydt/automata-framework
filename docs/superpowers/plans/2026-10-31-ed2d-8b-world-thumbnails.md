# ED2D.8b: level pictures on the World map, and a map the drawers do not hide

**Row:** `docs/02-master-delivery-plan.md` ED2D.8, second part (after ED2D.8a, #328, on which this is stacked). Lane
**editors**. Size M. Accepted under the Owner's "Auto accept all spec and plans".
**Spec:** [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §8 (the World row: "Levels as rectangles at world
positions"), §12 (medium: drawers; compact: sheets; nothing hover-only), §13 (no WebGL: the map says so). Mockup
`world` (each map drawn inside its rectangle).
**Coordinator follow-up (review of #328):** in medium portrait and compact the open drawer or sheet covers the map
(Inn cut, Forest Path hidden, Fit underneath). "Either fit to the map area the drawer leaves uncovered, or keep Fit
reachable while the drawer is open."

## Decisions (veto-defaults)

1. **Each level is drawn inside its rectangle by the level canvas's own scene builder** (`createLevelScene` over
   `createLevelDrawList` with a view that has no overlays, the one Home's thumbnails use, now exported once as
   `plainDrawView`), in the world renderer, at the camera: a picture, not a separate image. The map loads every image
   the levels use through one `TextureManager`; a missing image draws numbered placeholders, as everywhere. Outlines,
   names and links draw over the pictures.
2. **Both halves of the follow-up:** fitting (the automatic fit and Fit) uses the part of the map no open drawer or
   sheet covers, and below wide Fit sits in the bar above the map with Levels and Inspector, which no drawer covers.
   In wide it stays over the map's corner.

## Files

**Modify:** `canvas/level-thumbnails.ts` (export `plainDrawView`), `canvas/world-view.ts` (+ `world-view.canvas.test.ts`:
pictures inside rectangles, outlines over them), `app/world/WorldCanvas.svelte` and `app/views/view-props.ts`
(`project`, `read` for the map), `app/world/world-camera.ts` (+ test: fit inside an area), `app/world/world-model.ts`
(+ test: `uncoveredArea`), `app/world/WorldView.svelte` (measure the drawers, Fit in the bar),
`app/world/world-view.layout.test.ts` (every level inside the uncovered part with a drawer open; Fit in view),
`testing/FakeWorldCanvas.svelte` if its props change.
**Interfaces:** `WorldCanvasProps` gains `project` and `read` (the World view's own prop type). No published API.

## Steps

- [x] 1. Plan (this file).
- [ ] 2. `uncoveredArea(map, covers)` (left, right and bottom covers; none) and `fit(rects, area)` in the camera (unit).
- [ ] 3. The World view fits to the uncovered area when a drawer or sheet opens or closes and on Fit; Fit in the bar
  below wide (layout, three browsers: every level inside the uncovered part with the inspector open; Fit 44 px in view).
- [ ] 4. Pictures: the world view draws a level scene inside each rectangle under its outline (Chromium canvas test:
  a pixel inside the rectangle is the level's background, the outline still the accent); WorldCanvas loads the images.
- [ ] 5. Review images beside the `world` mockup; gates: `pnpm format`, `TURBO_FORCE=true pnpm check`, editor-2d
  `test:parity` and `test:canvas`.

## Execution log

- 2026-10-31: plan written on `claude/ed2d-8a-world-ipad` at `5402516b`.
