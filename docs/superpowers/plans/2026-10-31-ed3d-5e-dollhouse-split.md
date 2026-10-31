# ED3D.5e Dollhouse viewport and Split: TDD plan

- **Task:** ED3D.5e in [02](../../02-master-delivery-plan.md), the first part of milestone "ED3D.5e–7d" (with ED3D.5f and ED3D.7d; one branch, one PR when the milestone is done). [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §3 (ED3D-D6: an editor-private flat-shaded PixiJS v8 renderer of `buildSectorMesh`, not `@pixi/3d`), §6 (Dollhouse: sectors extruded with the near walls cut away; select and highlight; orbit, pitch 30° default; Split: Plan and Dollhouse side by side with one selection), §9 (the Split frame), §10 (wide: Split by default ... medium: the 3D modes replace Plan; touch: twist rotates the dollhouse), §11 / ED3-p (with WebGL unavailable or lost, Plan keeps working and the viewport offers a recover action). Mockup `Split · landscape`.
- **Lane:** editors. **Depends on:** ED3D.5d (the Plan view in the shell), ED3D.4 (`buildSectorMesh`, `pickMesh`, `fitOrbit`, `orbitBy`, `projectPoint`, `rayThrough`, `surfaceVisibility`). All merged.
- **Status:** Drafted 2026-10-31. Accepted under the Owner's "Auto accept all spec and plans" once reviewed. Steps are ticked only when their checks pass.
- **Progress:** 4 of 8 steps.

## Scope

**In:** the dollhouse paint list (surfaces projected through the orbit camera, near walls cut, faded ones at a quarter, flat shade per surface, the selection in the accent, far to near); a headless dollhouse controller (fit, orbit by drag, pitch, zoom by pinch and wheel, twist by two-finger rotation, tap to select through `pickMesh`, one selection with Plan); a WebGL2-only Pixi renderer drawing the paint list in one `Graphics`, with context loss; the Dollhouse canvas with its own "can't draw" notice and Try again (Plan unaffected); Split (Plan and Dollhouse side by side) and 3D (Dollhouse alone) chosen in the bar at `wide`.

**Out:** Walk and the material sheet (ED3D.8b); the portrait layout's floating tool strip and a views control below `wide` (ED3D.5f, which also offers 3D at `medium`); props and lamps drawn in the dollhouse (things as boxes are a follow-up; the mesh has sectors only).

## Decisions (veto-defaults)

1. **Painter's algorithm, not a depth buffer.** Each visible surface's triangles are projected to the canvas and drawn far to near by their farthest point's depth. A blockout has tens of rooms, so this is fast enough, and it keeps the renderer a plain Pixi `Graphics` like the plan's (ED3D-D6 asks for flat shading only).
2. **One drag orbits** (left-right turns the yaw, up-down the pitch); two fingers pinch to zoom and twist to turn; the wheel zooms; a tap selects what it hits, and a tap on nothing clears the selection, as on the plan. The orbit is the canvas's own state, not the document's or the view store's: it is not undoable (spec §5.4: `camera.set` is not undoable) and is framed once per level.
3. **Split is the default only when chosen**: the level still opens on Plan (the current mode store default), and Split and 3D are enabled in the bar at `wide`. Opening on Split at `wide` would change ED3D.5d's accepted layout tests and the images; that is left for the Owner's veto.

## Interfaces

**Produced (editor-private):** `app/dollhouse-paint.ts` (`dollhousePaint(mesh, orbit, size, selected): DollhousePaint`), `app/dollhouse-controller.ts` (`createDollhouseController(editor, size)`), `ui/dollhouse/dollhouse-renderer.ts` (`createDollhouseRenderer`, `DollhouseRendererFactory`), `ui/dollhouse/DollhouseCanvas.svelte`; `modeOptions()` enables Split and 3D.

**Consumed:** `buildSectorMesh`, `fitOrbit`, `orbitBy`, `orbitCamera`, `projectPoint`, `rayThrough`, `pickMesh`, `surfaceVisibility` (`view/mesh/`); the geometry cache (`app/geometry-cache.ts`); the kit's `attachGestures` with pinch rotation.

## Steps

- [x] 1. Plan (this file).
- [x] 2. `dollhousePaint` (unit, red first): a floor and a wall of a toy room project inside the canvas; the near walls are cut and the far ones drawn; faded surfaces at alpha 0.25; polygons sorted far to near; a selected sector's surfaces carry the accent; a surface behind the eye is left out.
- [x] 3. `createDollhouseController` (unit, red first): `fit` frames the level's bounds; a drag of `dx` turns the yaw and `dy` the pitch (held to 5–85°); pinch and wheel change the distance; twist turns the yaw; a tap on the hall's floor selects `sector:hall`, a tap on the sky clears the selection; subscribers hear each change; the view's mode and the document are untouched.
- [x] 4. Renderer (Chromium canvas test, red first): a paint list's polygon colour at its middle; a later polygon drawn over an earlier one; pause and redraw on context loss and restore.
- [ ] 5. `DollhouseCanvas` (DOM with a fake renderer): makes the renderer at its measured size and draws the framed level; a tap selects; the "can't draw" notice and Try again; the plan's selection outline follows.
- [ ] 6. `DocumentFrame` and `modeOptions` (DOM): Split and 3D enabled at `wide`; Split shows both canvases, 3D the dollhouse alone; a selection made in one shows in the other and in the status line.
- [ ] 7. Layout (three browsers): Split at the `wide` sizes: both viewports side by side filling the canvas region, the bar's views on screen at full size; 3D fills the region. Review images (Chromium, WebGL2) beside the `Split · landscape` mockup in `docs/evidence/owner-visual/2026-10-31-ed3d-5e/`.
- [ ] 8. Gates: biome, `pnpm format`, `TURBO_FORCE=true pnpm check`; editor-3d `test:parity`. No changeset (private package).

## Execution log
- 2026-10-31, step 2: `dollhouse-paint.test.ts` red (module missing), then 5 of 5. Hand-made surfaces, so each expectation is plain; colours by role scaled by the surface's shade over a 35% ambient.
- 2026-10-31, step 3: `dollhouse-controller.test.ts` red (module missing), then 6 of 6. The orbit reframes on resize and on a new level only until it is moved by hand (as editor-2d's World camera).
- 2026-10-31, step 4: the renderer test red (module missing), then 3 of 3 after one test fix: the outline pixel was on the stroke's edge (row 11 of a 2 px stroke centred on row 10). `createWebGL2Renderer` is now exported from `plan-renderer.ts` and shared, not copied. With the plan renderer's tests: 8 of 8.
