# ED3D.5a Plan controller: TDD plan

- **Task:** ED3D.5a, the first part of ED3D.5. [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §5.2 (a hidden layer is not drawn and not hit, a locked one is drawn and not hit), §5.3 flow 3 (select, then drag a corner or the whole sector, snapping to the grid, vertices and wall lines; a drag is one transaction; moving a corner of a portal wall moves its reverse), §9 (Split: selection none, sector, wall; layer hidden or locked) and §10 (touch navigates and selects, Pencil draws and never pans, mouse hovers). The logic of the Plan view's Select tool as plain TypeScript: what the pointer does to the selection, the level and the camera. No Svelte, DOM, Pixi or clock.
- **Lane:** editor-3d. **Depends on:** ED3D.4 (PR #148: `pickPlan`, `pickCorner`, `snapPlan`, `planViewport`, `selectionOf`) and ED3D.3 (PR #137: `LevelEditor`, `moveCorner`, `moveSector`, `ViewStore`). Branch `claude/project-thread-ljshus-ed3d-5a` is stacked on #148's branch.
- **Status:** Drafted 2026-10-23 on the coordinator's and the hub's instruction of 10:05 UTC to keep going on the next ED3D slice while the stack waits in the merge queue. Not reviewed; spec review (ED3D.0) is still open. Steps below are ticked only when their checks pass.
- **Progress:** 0 of 6 steps.

## Why this task exists

ED3D.5 is the first UI PR: the shell, Plan and Split, layers and the inspector. A Svelte view that decides what a tap or a drag means can only be tested in a browser, and the Pencil, touch and mouse rules (§10) would each be re-derived there. This task builds the meaning once, as a controller the view forwards pointer events to, in the way the 2D lane's Level view controller (ED2D.4b) does for its tools: the view reads `view`, calls the methods with canvas pixels and the pointer kind, and paints what the controller says (hover, snap target, refusal). The inspector cards wait for the kit's `./fields` export (EDK.7) and are ED3D.5c; the shell, canvas and widgets are ED3D.5b.

## Sources, read at these commits

- **AF (this stack):** `view/plan/plan-pick.ts`, `plan-snap.ts`, `plan-viewport.ts`, `view/selection-of.ts` (ED3D.4); `model/level-editor.ts` (`run`, `begin`, `EditSession`), `model/corner-edits.ts` (`moveCorner`, `moveSector`), `model/view-store.ts`, `model/selection-ref.ts` (ED3D.3); the kit's `Selection`, `History` and `Viewport2D`.
- **The 2D lane, PR #146:** `packages/editor-2d/src/app/level-editor.ts` for the shape of a pointer controller (`view`, `subscribe`, pointer methods, a transaction for each gesture); this one differs in taking the pointer kind and modifier keys, because the Pencil and touch rules differ.

## Scope

**In:** `src/app/plan-controller.ts` in `editor-3d` (under the purity test: the `app` layer joins it) and its tests; the package entry exports it.

**Out, with where each goes:**

| What | Where |
|---|---|
| Painting hover, selection, snap target, corner handles; the canvas; DOM events and the kit's gesture recogniser wiring | ED3D.5b |
| Inspector cards (sector, wall, things) and their edits | ED3D.5c, over the kit's `FieldDef` (ED3D.1b2 and EDK.7) |
| Sector, vertex, portal, door and window tools; the loupe and nudge pad; marquee selection | ED3D.6 |
| Things on the plan | ED3D.7 |
| The dollhouse and Walk selection | ED3D.5b and ED3D.8 (they select by the same ids through `LevelEditor.selection`) |

## Decisions this plan makes (each vetoable by the Owner through the Orchestrator)

1. **The controller takes the kit recogniser's events, not raw pointer events.** `hover`, `tap`, `dragStart`, `drag`, `dragEnd`, `panBy`, `zoomAt` and `fit` are the Plan's meaning of the recogniser's `hover`, `tap`, `dragStart`, `drag`, `dragEnd`, `pan`/`wheel`, `pinch` and a Fit button, so two fingers, a pinch and the wheel never reach it as drags. A `PlanPointer` is canvas pixels, the pointer kind, and the modifier flags the controller reads: `shift` (the fine snap step), `alt` (no snap) and `additive` (Ctrl or Meta: add to or remove from the selection).
2. **Geometry is read once for each level.** The controller keeps the geometry and the selection ids of the level it last saw (by identity) and rebuilds them when the level changes, so a hover costs picks and not a rebuild. A level that cannot be resolved (a `GeometryError`) has no layers: nothing is hit, and the view still works.
3. **Hover, tap and drag respect the layers.** The picks get the view store's hidden and locked layers. The sector fill is the `sectors` layer and walls and corners the `walls` layer, so a locked `walls` layer leaves only the sector to pick, and a hidden `sectors` layer leaves the walls.
4. **A tap selects what a pick touches.** A wall gives its wall id (`wall:<sector>/<corner>`), a sector gives `sector:<id>`, nothing clears the selection. With `additive` the id is added, or removed when it is already there. A tap on a corner handle is a tap on what is under it (the wall or the sector), not a corner selection.
5. **A corner drag moves one corner of a selected sector.** The corners that can be dragged are those of the sectors the selection names (a `sector:` or a `wall:` id), and they need the `walls` layer unlocked and shown. The drag is one `EditSession` (one undo step, labelled by the edit, none when the corner ends where it began) running `moveCorner` at the snapped point of every move. **The snap targets are the level as the drag found it, not the live level,** so the corner being dragged does not snap to itself and a drag back to the start snaps to the start. A run that is refused keeps the last accepted position and puts the edit's sentence in `view.refusal` until the next run is accepted or the drag ends; a cancelled drag (`dragEnd` with `cancelled`, or an undo) leaves the level as it was.
6. **A sector drag moves the whole sector by the pointer's offset.** The offset is rounded to the view's grid step when the grid snaps (Shift: the fine step; Alt: not at all), and applied to the live level by the difference from what has been applied (`moveSector` takes an offset), so the drag back to where it began is no step. Who may be dragged: a mouse or a Pencil that presses on a sector or a wall selects its sector and moves it; a finger moves only a sector that is already selected, and any other finger drag pans (a finger is for navigating, §10). A locked or hidden `sectors` layer is not hit, so it is not moved.
7. **A drag that starts on nothing pans, for a finger and a mouse but not for the Pencil** (§10: "Pencil draws, never pans"). A pan is `viewport.panBy`, written back with `cameraOf` to the view store's `camera`; the camera is never an undo step.

## Contract

```
packages/editor-3d/src/app/plan-controller.ts   PlanPointer, PlanView, PlanController, createPlanController
packages/editor-3d/src/index.ts                 the public entry gains them
packages/editor-3d/src/purity.test.ts           the pure layers gain `app`
```

```ts
export interface PlanPointer {
  readonly x: number            // canvas pixels
  readonly y: number
  readonly kind: PointerKind
  readonly shift?: boolean | undefined
  readonly alt?: boolean | undefined
  readonly additive?: boolean | undefined
}

export interface PlanView {
  /** What the pointer is over (a wall, else a sector). */
  readonly hover: PlanHit | undefined
  /** A corner handle of a selected sector under the pointer. */
  readonly corner: CornerHit | undefined
  /** The snap target of a corner drag: where the corner is now, and what it snapped to. */
  readonly snap: SnapResult | undefined
  readonly gesture: 'idle' | 'corner' | 'sector' | 'pan'
  /** The sentence a refused run gave, while the drag is on. */
  readonly refusal: string | undefined
}

export interface PlanController {
  readonly view: PlanView
  subscribe(run: () => void): () => void
  /** The canvas's size in pixels (the camera's centre stays the centre). */
  resize(size: Size): void
  hover(at: PlanPointer): void
  leave(): void
  tap(at: PlanPointer): void
  dragStart(press: PlanPointer, at: PlanPointer): void
  drag(at: PlanPointer): void
  dragEnd(at: PlanPointer, cancelled: boolean): void
  panBy(dx: number, dy: number): void
  zoomAt(at: Point, factor: number): void
  /** The camera that shows the whole level. */
  fit(): void
}

export function createPlanController<D>(editor: LevelEditor<D>, size: Size): PlanController
```

## Steps (strict TDD: failing test first, then the minimal change; tick a step when its checks pass)

Tests use the depot (hall `0,0` to `8,6`, dock `8,0` to `14,6`, a portal at `x = 8`) and a canvas of 800 by 400 px with the camera at `{ x: 7, z: 3, zoom: 1 }`; pixel positions come from `toScreen(planViewport(camera, size), point)`, so they do not hide a unit.

- [ ] **1. Hover and the geometry cache** (`plan-controller.test.ts`; `app/plan-controller.ts`).
  - *Red, by case:* a pointer over the hall's middle hovers `sector:hall`; within the pointer kind's radius of the hall's north wall it hovers `wall:hall/0` (a finger from further away than a mouse); over nothing, nothing; on the line the hall and the dock share, the wall of the room the pointer is in; `leave` clears it; hover notifies once for a change and not for a repeat; a locked `walls` layer leaves the sector under the wall, a hidden `sectors` layer leaves the wall and not the sector; a corner handle shows only for a selected sector's corner (`view.corner`), not for an unselected one and not with `walls` hidden or locked; after an edit that moves a wall the next hover answers the new geometry (the cache follows the level), and after an undo the old one; a level whose geometry throws gives no hover and no crash.
  - *Expected failure:* the module is missing.
- [ ] **2. Tap selection** (same files).
  - *Red, by case:* a tap on the hall selects `sector:hall`; on its north wall `wall:hall/0`; on nothing clears; a tap on the other sector replaces; with `additive` it adds, and a second additive tap removes; a tap on a hidden or a locked layer's element selects nothing (it clears, as a tap on nothing); the selection reaches `editor.selection` (the dollhouse and the inspector read it there); a tap on a corner handle selects what is under it.
  - *Expected failure:* the tap method does nothing.
- [ ] **3. Corner drag** (same files).
  - *Red, by case:* with the hall selected a drag from its corner 2 at `(8, 6)` to `(9, 6)` (the dock's corner 3 is joined to it, so both move, through `moveCorner`) ends as one undo step labelled `Move corner 2 of hall` and the level shows the corner there; the live level moves during the drag and `view.snap` says where; a drag with no handle under the press (the hall unselected) is not a corner drag; the snap kinds: a vertex of another sector (`vertex`), a wall line (`wall`), the grid, Alt giving the pointer's own place, Shift the fine step; the corner does not snap to itself (the targets are the level at the press) and dragging back to the start leaves no step; a move the edit refuses (a corner dragged across its own wall so the outline would cross itself) keeps the last good position and `view.refusal` holds the edit's sentence until the next accepted run or the end; `dragEnd` with `cancelled` and an undo during the drag leave the level as it was and the history without a step; a second drag after the first starts clean.
  - *Expected failure:* the drag methods do nothing.
- [ ] **4. Sector drag** (same files).
  - *Red, by case:* a mouse drag from the hall's middle moves the hall by the pointer's offset rounded to the 0.5 m grid, selects it, and is one undo step labelled `Move sector hall`; a Pencil drag the same; a finger drag on an unselected sector pans and does not move it; on a selected sector it moves it; Alt moves by the unrounded offset and Shift by the fine step; dragging back to the start leaves no step and the sectors as they were; a drag that starts on a wall of the hall moves the hall; a locked `sectors` layer is not moved (a mouse drag there pans); a move the edit refuses keeps the last accepted offset and sets `view.refusal`; `view.gesture` is `sector` during and `idle` after.
  - *Expected failure:* a sector drag does nothing.
- [ ] **5. Camera** (same files).
  - *Red, by case:* a mouse or a finger drag on nothing pans by the drag's offset (the camera moves the other way round the content: the world follows the pointer), a Pencil drag on nothing does nothing; `panBy`, `zoomAt` (the point under the pointer stays; the zoom is held to the plan's limits) and `fit` (the camera that shows the level's bounds) write the view store's `camera`, are not undo steps and notify subscribers; `resize` keeps the camera's centre; a pan, a zoom and a fit change what the next pick hits (the pick reads the live camera).
  - *Expected failure:* the camera methods do nothing.
- [ ] **6. Gates and records.**
  - *Run in order:* `pnpm format`, `pnpm docs:stack` (commit if it changes), `pnpm check` (the `app` layer is in the purity test), `pnpm build`, `pnpm api-index`, `pnpm agent-skills`, `pnpm api-report`; hand mutation over each step's logic, listed on its step; `index.ts` exports the controller (names asserted in `index.test.ts`).
  - *Records:* master plan (02), continuation prompt (03) and the spec's task table in the docs follow-up PR once the stack merges; nothing ticked in 02 from this PR.

## Verification

Local, Node 24: the package's tests and `pnpm check`. No browser or GPU suite is selected (no DOM, no painting, no sim code). The feel of the drag (slop, handle size, snap reach) is judged on the built editor (ED3D.12) and the Owner's iPad pass.

**Owner acceptance:** none of its own. ED3-c (the corner snaps onto the ward's wall line) and the Plan half of ED3-d are judged on the built editor.

## Risks and how the plan answers them

- **Moving a sector or a corner can make geometry the checks reject.** The edits refuse what is not a polygon (`outlineProblem`); what only the checks see (overlap) is the checks pill's to show after the commit, as in Last Light.
- **A live drag runs an edit on every move.** `moveCorner` is absolute and `moveSector` incremental from the applied offset, and both return the same level for no change, so a move with no effect records nothing; the geometry cache rebuilds once for each level change, not for each pick.
- **The recogniser's `dragStart` fires after the slop, not at the press.** The controller picks at the press position (`dragStart` carries both), so the thing grabbed is the thing the finger was on.
- **Stack depth.** This branch sits on #148 (on #137, on #129), so it merges last; when a lower PR gets a merge from `main`, `main` is merged here (no rebase).
