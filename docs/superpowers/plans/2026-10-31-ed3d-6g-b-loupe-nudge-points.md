# ED3D.6g-b Loupe, nudge pad, point list and the draw journeys: TDD plan

- **Task:** ED3D.6g in [02](../../02-master-delivery-plan.md), second part (after ED3D.6g-a, #341, on whose branch this is built). [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §5.3 flow 2 (Pencil: the loupe shows the corner under the tip, the nudge pad moves it by one grid step), §9 (`Draw a sector`: loupe, nudge pad, the point list; loupe and nudge only for touch and Pencil), §10 (placed clear of the contact point and of the screen edge), §13 (ED3-c, ED3-d). Mockup `Draw sector · landscape`.
- **Lane:** editors. **Depends on:** ED3D.6g-a (#341), ED3D.6a (`SectorToolView.loupe`, `nudge`).
- **Status:** Drafted 2026-10-31. Accepted under the Owner's "Auto accept all spec and plans" once reviewed. Steps are ticked only when their checks pass.
- **Progress:** 7 of 9 steps.

## Scope

**In:** the loupe (a round lens magnifying the plan around `view.loupe`, with the snap kind under it); the nudge pad (four 44 px arrows moving the last corner one grid step, and a 48 px check that closes the sector) shown while a sector is being drawn with touch or a Pencil; both placed clear of the contact point and the canvas edge; the New sector card in the inspector at `wide` (each point's coordinates and the length of the edge to it, and the cursor row); ED3-c and ED3-d as layout journeys.

**Out:** ED3-l in the UI (rebuilding the clinic needs sector ids and heights edited in the inspector, ED3D.5f); the Grid, Snap and heights chips (follow-up of #341).

## Decisions (veto-defaults)

1. **The loupe is drawn by the plan renderer itself,** as a second pass of the same paint lists for a camera centred on the loupe point at four times the zoom, masked to a 140 px circle: no second WebGL context, and the lens can never disagree with the plan.
2. **Placement** (`loupePlace`): the lens sits above and right of the point with a gap that clears a finger (the kit's touch reach), flipping left or below when it would leave the canvas; the nudge pad sits in the canvas's bottom-right corner, above the status line, or bottom-left when the point is under it.
3. **The nudge pad's check closes the sector** (as Close sector), the action the mockup's amber centre button stands for.
4. **The pad shows for touch and Pencil only:** the tools remember the last pointer kind; a mouse never sees it (spec §9).

## Interfaces

**Produced (editor-private):** `app/loupe-place.ts` (`loupePlace(at, canvas, lens)`, `nudgePlace(at, canvas, pad)`); `PlanTools.pointerKind`; `createPlanPicture(editor)(size, camera?)`; `PlanRenderer.draw(paint, tool?, loupe?)` with `LoupeDraw { paint, tool, x, y, size }`; `ui/plan/NudgePad.svelte`; `ui/plan/NewSectorCard.svelte`.

## Steps

- [x] 1. Plan (this file).
- [x] 2. `loupePlace` and `nudgePlace` (unit, red first): above-right by default; flipped at the right and top edges; never covering the point; the pad in the bottom-right, moved left when the point is under it.
- [x] 3. `PlanTools.pointerKind` (unit): the last tap or hover's kind; `undefined` before any.
- [x] 4. `createPlanPicture(editor)(size, camera)` (unit): a camera centred on a point of the hall at four times the zoom puts the hall's fill under the middle of a 140 px paint.
- [x] 5. Renderer (Chromium canvas test, red first): a lens drawn at (x, y) shows its own paint inside the circle (its centre pixel is the lens paint's fill), the plan outside it, and an accent ring.
- [x] 6. `NudgePad` and `NewSectorCard` (DOM, red first): the arrows call `nudge(±1, 0)` and `(0, ±1)`, the check closes, each is 44 px (48 for the check) and named; the card lists the points with three decimals and the edge lengths, and the cursor row.
- [x] 7. `PlanCanvas` and `DocumentFrame` (DOM): with a Pencil the pad shows and its arrow moves the last corner; with a mouse it does not; the lens is handed to the renderer while `view.loupe` is set; the card shows in the inspector at `wide` while the Sector tool is chosen.
- [ ] 8. Layout (three browsers): the pad and the lens on screen, clear of the edges and the status line; ED3-c (a rectangle against the hall's top wall: a portal is offered, Portal adds both portals, the checks pill stays clear) and ED3-d (a polygon over the hall: refused, naming the hall, nothing added), placing points from the rulers' metre ticks. Review images beside the mockup in `docs/evidence/owner-visual/2026-10-31-ed3d-6g-b/`.
- [ ] 9. Gates: biome, `pnpm format`, `TURBO_FORCE=true pnpm check`; editor-3d `test:parity`. No changeset (private package).

## Execution log
- 2026-10-31, step 2: `loupe-place.test.ts` red (module missing), then 4 of 4.
- 2026-10-31, step 3: the `pointerKind` test red (`undefined` after a Pencil hover), then 11 of 11 with the switcher's other tests.
- 2026-10-31, step 4: the loupe picture test red (`loupeCamera` missing), then 6 of 6. `createPlanPicture(editor)(size, camera?)` and `loupeCamera(camera, at)`.
- 2026-10-31, step 5: the lens test red (the lens's middle was the background), then 7 of 7 in Chromium. The renderer now renders a stage: the plan's `Graphics`, then the lens (background disc, the lens paint masked to the circle, the accent ring).
- 2026-10-31, step 6: `NudgePad` and `NewSectorCard` DOM tests red (components missing), then 4 of 4. The pad's middle is named "Close" inside its "Nudge the last corner" group, since the draw actions already have a "Close sector".
- 2026-10-31, step 7: `app/loupe.ts` (`loupeOf`, `nudgePadOf`) because `ui/` may not import `view/`: `loupeOf` red (module missing), then green; `nudgePadOf`'s test was written first but its red run was skipped (it was added to the same file in one edit), 3 of 3. Three new `PlanCanvas` DOM tests red (no pad, no lens), then 12 of 12; the `DocumentFrame` card test red, then green. Deviation: the card shows in the inspector at `wide` while the Sector tool is chosen, not only while drawing, so choosing the tool (not the first corner) narrows the plan; below `wide` the plan keeps its width. editor-3d `src/ui` DOM 77 of 77; `svelte-check` 0 errors.
