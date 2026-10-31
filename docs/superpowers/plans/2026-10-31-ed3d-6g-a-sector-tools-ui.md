# ED3D.6g-a Sector tools in the Plan view (rail, routing, overlays, Close and offers): TDD plan

- **Task:** ED3D.6g in [02](../../02-master-delivery-plan.md), first part. [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §5.3 flow 2 (draw a sector: corners, lengths, Close, refusals, the portal offer), §9 (the `Draw a sector` frame: sector toolbar, length labels, shared-wall hint, Undo point, Close sector), §10 (keys V S X P D N; Pencil draws and never pans), §13 (ED3-c, ED3-d, ED3-m). Mockup `Draw sector · landscape` (`docs/design/editor-3d/screens.mjs`, `draw`).
- **Lane:** editors. **Depends on:** ED3D.5d (#265, the Plan view in the shell), the headless tools ED3D.6a to 6f (`app/{sector,wall,vertex,split,merge}-tool-controller.ts`), EDK.2 (command registry and keymap), EDK.3 (gestures). All merged.
- **Status:** Drafted 2026-10-31. Accepted under the Owner's "Auto accept all spec and plans" once reviewed. Steps are ticked only when their checks pass.
- **Progress:** 2 of 9 steps.

## Why

The six sector tools exist as controllers with tests, but nothing on screen chooses one or shows what it would do. This part puts them in the Plan view: a tool rail, the sector toolbar, the gestures routed to the active tool, each tool's view painted over the plan, the Close sector and Undo point buttons, edge lengths, the portal offer and refusals in plain words. ED3D.6g-b follows with the loupe, the nudge pad, the point list and the acceptance journeys ED3-c, ED3-d, ED3-m and ED3-l in the UI.

## Scope

**In:** the rail (Select, Sector, Vertex, Portal, Door, Window); the sector toolbar (Polygon, Rectangle, Split, Merge) while Sector is the tool; keys V, S, X, P, D, N, Enter (Close), Backspace (Undo point), Escape (cancel the drawing); the active tool gets taps and hovers, while two fingers, the wheel and the two- and three-finger taps keep panning, zooming, undoing and redoing whatever the tool; the drawing (corners, placed and pending edges, the snap point, the closing ring), the Wall and Vertex tools' target, the Split cut and the Merge pair painted over the plan; each edge's length as a label; Undo point and Close sector; the portal offers (Accept, Decline, Accept all) as the mockup's shared-wall hint; a refusal as the tool's sentence over the canvas.

**Out:** the loupe and the nudge pad, the New sector point list in the inspector, the ED3-c/d/m/l journeys (ED3D.6g-b); the Things tools B H L (ED3D.7d); inspector cards (ED3D.5f).

## Decisions (veto-defaults)

1. **One switcher, `createPlanTools`,** owns the active tool: it makes the tool's controller when it is chosen and disposes the last one. The Select controller stays alive throughout because it owns the camera's pan and zoom; taps, hovers and drags go to the active tool. Choosing another tool while a polygon is open cancels it; while portal offers are open it calls `finish` first (the sector stays, with the portals already accepted), so switching never loses a closed sector.
2. **The tool's overlay is a separate paint list,** `toolPaint(state, viewport)`, drawn by the plan renderer after the plan, so `planPaint` is unchanged. Labels (lengths, the offer hint, the refusal) are DOM over the canvas, as the rulers are.
3. **Keys go through the kit's command registry and keymap** (`plan.tool.*`, `sector.close`, `sector.undoPoint`, `sector.cancel`), so 6g-b and 7d add to the same registry.
4. **Below `wide` the rail is the shell's horizontal rail** (the kit's `rail` snippet with its orientation); a phone shows Select only (spec §10: compact is view and select).

## Interfaces

**Consumed:** `createPlanController`, `PlanPointer`; `createSectorTool`, `createVertexTool`, `createWallTool`, `createSplitTool`, `createMergeTool` and their views; `planViewport`, `toScreen`; `createCommandRegistry`, `defineCommand`, `createKeymap`; `EditorShell`'s `rail` snippet.

**Produced (editor-private):**

| File | What |
|---|---|
| `src/app/plan-tools.ts` | `createPlanTools(editor, size)`: `active`, `choose(tool)`, `state` (the active tool and its view), `subscribe`, `hover`/`leave`/`tap`/`dragStart`/`drag`/`dragEnd`, `select` (the Select controller for pan and zoom), `sector` (the Sector tool when active), `resize`, `dispose`. `PlanToolId`. |
| `src/app/plan-tool-commands.ts` | `planToolCommands(tools)`: the commands with their shortcuts. |
| `src/view/plan/tool-paint.ts` | `toolPaint(state, viewport): ToolPaint` (strokes, dots, labels in canvas pixels). |
| `src/ui/plan/ToolRail.svelte` | The rail: one 44 px button per tool, `aria-pressed`, the key in the title. |
| `src/ui/plan/SectorOptions.svelte` | The floating sector toolbar and the draw actions (Undo point, Close sector) and the offers. |

**Modified:** `ui/plan/plan-gestures.ts` (to the switcher), `ui/plan/PlanCanvas.svelte` (the switcher, the overlay, labels), `ui/plan/plan-renderer.ts` (draws a `ToolPaint`), `app/plan-picture.ts` (unchanged API; the canvas pairs it with the overlay), `ui/document/DocumentFrame.svelte` (rail, keymap).

## Steps

- [x] 1. Plan (this file).
- [x] 2. `createPlanTools` (unit, red first): starts on Select; `choose('polygon')` routes taps to a Sector tool (three taps and a tap on the first corner add a sector, one undo step); `choose('select')` while a polygon is open cancels it (no sector, no history); while offers are open it finishes them (the sector stays); pan and zoom go to the Select controller whatever the tool; `dispose` disposes the active tool.
- [ ] 3. `planToolCommands` (unit): V S X P D N choose their tools; Enter closes, Backspace undoes a point, Escape cancels; each disabled when it would do nothing (Close with no drawing), so the key falls through.
- [ ] 4. `toolPaint` (unit): a polygon with two corners and a pointer paints two placed edges and one dashed pending edge, a dot per corner, the snap point, and a length label per edge at its middle (`2.98 m`); `closing` rings the first corner; a Wall or Vertex target paints a mark at its point in the accent, or in the refusal colour with its reason; a Split cut paints the cut; Merge marks the kept sector.
- [ ] 5. Renderer: `plan-renderer.canvas.test.ts` (Chromium) draws a `ToolPaint` over a plan (a pending edge's pixel is the accent).
- [ ] 6. `ToolRail` and `SectorOptions` (DOM, red first): the rail's buttons are 44 px, pressed for the active tool; the toolbar's Polygon/Rectangle/Split/Merge choose; Close sector is disabled with fewer than three corners and says why (the tool's sentence on a refused close); the offers list Accept, Decline and Accept all.
- [ ] 7. `PlanCanvas` and `DocumentFrame` (DOM with the fake renderer): taps with Sector chosen add a sector through the editor; the labels follow the drawing; keys choose tools; a refusal shows its sentence; ED3-m in the DOM (two corners and Close: refused, "needs three corners", nothing added).
- [ ] 8. Layout (three browsers): the rail and toolbar at `wide`, `medium` and `compact` with 44 px targets, nothing overlapping the status line; review images beside the mockup's `Draw sector · landscape` frame in `docs/evidence/owner-visual/2026-10-31-ed3d-6g-a/` with a README of differences.
- [ ] 9. Gates: biome, `pnpm format`, `TURBO_FORCE=true pnpm check`; editor-3d `test:parity` (three browsers). No published package, so no changeset.

## Execution log
- 2026-10-31, step 2: `plan-tools.test.ts` red first (module missing), then 10 of 10. One test fix on the way: the drag test recomputed its end pixel after the camera moved, which panned twice; it now fixes the pixels before the drag, as a finger's are.
