# ED3D.5a Plan controller: TDD plan

- **Task:** ED3D.5a, the first part of ED3D.5. [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §5.2 (a hidden layer is not drawn and not hit, a locked one is drawn and not hit), §5.3 flow 3 (select, then drag a corner or the whole sector, snapping to the grid, vertices and wall lines; a drag is one transaction; moving a corner of a portal wall moves its reverse), §9 (Split: selection none, sector, wall; layer hidden or locked) and §10 (touch navigates and selects, Pencil draws and never pans, mouse hovers). The logic of the Plan view's Select tool as plain TypeScript: what the pointer does to the selection, the level and the camera. No Svelte, DOM, Pixi or clock.
- **Lane:** editor-3d. **Depends on:** ED3D.4 (PR #148: `pickPlan`, `pickCorner`, `snapPlan`, `planViewport`, `selectionOf`) and ED3D.3 (PR #137: `LevelEditor`, `moveCorner`, `moveSector`, `ViewStore`). Branch `claude/project-thread-ljshus-ed3d-5a` is stacked on #148's branch.
- **Status:** Drafted 2026-10-23 on the coordinator's and the hub's instruction of 10:05 UTC to keep going on the next ED3D slice while the stack waits in the merge queue. Not reviewed; spec review (ED3D.0) is still open. Steps below are ticked only when their checks pass.
- **Progress:** 6 of 6 steps (all local checks run; CI and Owner acceptance pending).

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
4. **A tap selects what a pick touches.** A wall gives its wall id (`wall:<sector>/<corner>`), a sector gives `sector:<id>`, nothing clears the selection. With `additive` the id is added, or removed when it is already there, and a tap on nothing then keeps the selection. A tap on a corner handle is a tap on what is under it (the wall or the sector), not a corner selection.
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
  /** Stops following the editor's history, selection and view store. */
  dispose(): void
}

export function createPlanController<D>(editor: LevelEditor<D>, size: Size): PlanController
```

## Steps (strict TDD: failing test first, then the minimal change; tick a step when its checks pass)

Tests use the depot (hall `0,0` to `8,6`, dock `8,0` to `14,6`, a portal at `x = 8`) and a canvas of 800 by 400 px with the camera at `{ x: 7, z: 3, zoom: 1 }`; pixel positions come from `toScreen(planViewport(camera, size), point)`, so they do not hide a unit.

- [x] **1. Hover and the geometry cache** (`plan-controller.test.ts`; `app/plan-controller.ts`).
  - *Red, by case:* a pointer over the hall's middle hovers `sector:hall`; within the pointer kind's radius of the hall's north wall it hovers `wall:hall/0` (a finger from further away than a mouse); over nothing, nothing; on the line the hall and the dock share, the wall of the room the pointer is in; `leave` clears it; hover notifies once for a change and not for a repeat; a locked `walls` layer leaves the sector under the wall, a hidden `sectors` layer leaves the wall and not the sector; a corner handle shows only for a selected sector's corner (`view.corner`), not for an unselected one and not with `walls` hidden or locked; after an edit that moves a wall the next hover answers the new geometry (the cache follows the level), and after an undo the old one; a level whose geometry throws gives no hover and no crash.
  - *Expected failure:* the module is missing.
  - *Done 2026-10-23:* red for the missing module, then green (`plan-controller` 19 tests; `tsc` and biome clean; `app` joined the purity test's layers). Deviations from the first draft of the contract: `dispose()` is part of it (the controller subscribes to the editor's history, selection and view store so that handles and hover follow a change with no pointer move, and a controller that is replaced must let go); a hover is recomputed on every such change from the last pointer, not only on a pointer event. The handles are `pickCorner` over a `SelectionOf` whose `corners` answers only the selected sectors' corners, so ED3D.4's picker is unchanged. Hand mutation (20 mutants over the cache, the layers, the pointer kind's reach, the selected-sector rule, the subscriptions and the change test): all killed but one equivalent (passing the handles' `SelectionOf` to `pickPlan`, which reads no corners); two survivors of the first round (the handle left standing after `leave`, and `dispose` that kept following) got tests.
- [x] **2. Tap selection** (same files).
  - *Red, by case:* a tap on the hall selects `sector:hall`; on its north wall `wall:hall/0`; on nothing clears; a tap on the other sector replaces; with `additive` it adds, and a second additive tap removes; a tap on a hidden or a locked layer's element selects nothing (it clears, as a tap on nothing); the selection reaches `editor.selection` (the dollhouse and the inspector read it there); a tap on a corner handle selects what is under it.
  - *Expected failure:* the tap method does nothing.
  - *Done 2026-10-23:* red (no `tap`), then green (`plan-controller` 28 tests; `tsc` and biome clean). Refinements to the cases above: an additive tap on nothing keeps the selection (only a plain tap on nothing clears); a tap takes the pointer with it, so the hover and the handles of the new selection are under it with no pointer move; a locked `walls` layer makes a tap near a wall select the sector under it, and a locked or hidden `sectors` layer makes a tap in a room select nothing. Hand mutation (9 mutants over the additive rules, set against add against toggle, the pointer being taken, the final refresh and the pick options): all killed.
- [x] **3. Corner drag** (same files).
  - *Red, by case:* with the hall selected a drag from its corner 2 at `(8, 6)` to `(9, 6)` (the dock's corner 3 is joined to it, so both move, through `moveCorner`) ends as one undo step labelled `Move corner 2 of hall` and the level shows the corner there; the live level moves during the drag and `view.snap` says where; a drag with no handle under the press (the hall unselected) is not a corner drag; the snap kinds: a vertex of another sector (`vertex`), a wall line (`wall`), the grid, Alt giving the pointer's own place, Shift the fine step; the corner does not snap to itself (the targets are the level at the press) and dragging back to the start leaves no step; a move the edit refuses (a corner dragged across its own wall so the outline would cross itself) keeps the last good position and `view.refusal` holds the edit's sentence until the next accepted run or the end; `dragEnd` with `cancelled` and an undo during the drag leave the level as it was and the history without a step; a second drag after the first starts clean.
  - *Expected failure:* the drag methods do nothing.
  - *Done 2026-10-23:* red (no `dragStart`), then green (`plan-controller` 49 tests; `tsc` and biome clean). Refinements to the cases above: `view.snap` is the snap of the latest move even when the edit refused it (the view can draw the target red beside the sentence); a drag that was never ended is cancelled when the next one begins; an undo that cancels the open session ends the drag (the history's own rule) and drops its snap and sentence; `dragStart` does not begin while another edit session is open and tells nobody a drag began; `dragEnd` applies the final position unless the pointer was cancelled; a drag that ends with the level equal to the one it began with (compared as data, because a drag back to the start builds new objects) is cancelled, not committed, so it is no undo step. Hand mutation (33 mutants over the snap options, the targets being the level at the press, the keep-or-cancel decision, the cancelled and undone paths, the label and the argument order): all killed but four equivalent ones: the extra `gesture = undefined` and `endDrag()` in `finish` (the closed-session branch of `refresh` ends the drag the same way), the `!cancelled` test before the final move (the cancel that follows discards it), and the guard before the commit (a closed session ignores both calls, so it was taken out).
- [x] **4. Sector drag** (same files).
  - *Red, by case:* a mouse drag from the hall's middle moves the hall by the pointer's offset rounded to the 0.5 m grid, selects it, and is one undo step labelled `Move sector hall`; a Pencil drag the same; a finger drag on an unselected sector pans and does not move it; on a selected sector it moves it; Alt moves by the unrounded offset and Shift by the fine step; dragging back to the start leaves no step and the sectors as they were; a drag that starts on a wall of the hall moves the hall; a locked `sectors` layer is not moved (a mouse drag there pans); a move the edit refuses keeps the last accepted offset and sets `view.refusal`; `view.gesture` is `sector` during and `idle` after.
  - *Expected failure:* a sector drag does nothing.
  - *Done 2026-10-23:* red (ten of the new cases failing, the rest passing for want of the behaviour), then green (`plan-controller` 67 tests; `tsc` and biome clean). Refinements to the cases above: a press on a sector that is not selected selects it (a wall press keeps a wall selection of that sector), and the session begins before the selection changes, so a refused session (another one is open) changes nothing; the offset is the pointer's distance from the press in metres, rounded to the grid's step (Shift the fine 1 cm step, Alt none, the grid switched off the 5 cm data step, `stepOf` from `plan-snap.ts` being the one place that says so), and each run moves the sector by the step from the offset already applied, so a refused run leaves the last accepted offset and the next accepted run catches up; the sector is held by what is under the press in the layers, so a hidden or locked `sectors` layer holds nothing (the walls of a locked sector are not a way in either) while a hidden `walls` layer still moves the sector. Two step 3 tests changed with it: a press on an unselected sector's corner now moves the sector (it was "not a corner drag"), and the hover-follows-the-drag test uses a Pencil press on nothing, which stays a drag that grabs nothing after step 5. The resets of `snap` and `refusal` when a drag begins were taken out of both variants: `endDrag` leaves them clear and nothing sets them between drags. Hand mutation (31 mutants over the shift, alt and grid steps, the press offset, the applied offset, the refusal, the touch rule, the locked and hidden layers, the selection, the closed session, the label and the gesture): all killed but two equivalent ones (the cleared `refusal` and `snap` at the start of a drag, since removed, and a `handle?.sector ?? hit.sector` that can only be `hit.sector` where the handle is `undefined`); one survivor of the first round (Alt rounding to 5 cm) got a test with an offset that is not a multiple of it.
- [x] **5. Camera** (same files).
  - *Red, by case:* a mouse or a finger drag on nothing pans by the drag's offset (the camera moves the other way round the content: the world follows the pointer), a Pencil drag on nothing does nothing; `panBy`, `zoomAt` (the point under the pointer stays; the zoom is held to the plan's limits) and `fit` (the camera that shows the level's bounds) write the view store's `camera`, are not undo steps and notify subscribers; `resize` keeps the camera's centre; a pan, a zoom and a fit change what the next pick hits (the pick reads the live camera).
  - *Expected failure:* the camera methods do nothing.
  - *Done 2026-10-23:* red (thirteen cases failing; the Pencil case and its like passed for want of the behaviour), then green (`plan-controller` 81 tests; `tsc` and biome clean; the file is 386 lines). Refinements to the cases above: a pan holds the point of the plan that was pressed under the pointer (anchored in metres at the press, not moved by the slop-sized step the drag had already made when `dragStart` ran), so a wheel or a pinch that moves the camera in the middle of a pan, or a canvas that is resized, cannot make it drift; a cancelled pointer does not follow its final position and the camera stays where the last move left it; a pan has no edit session (the camera is the view store's, and no undo step), and a press that grabs nothing after a pan that was never ended is not a pan; `resize` refreshes the hover and the handles under the pointer, because the camera is a centre and a zoom and does not change with the canvas; `fit` reads the live level through the geometry cache and the canvas as it is now, and a level with no sector fits the 10 m box. The step 4 tests for a finger on a sector that is not selected, on another sector while one is selected, and for a locked or hidden `sectors` layer now say that the plan pans. Hand mutation (31 mutants over the sign and the axis of the pan, the anchor point, the pointer kinds that pan, the cancelled path, the refresh after a pan and after a resize, the zoom point and factor, the fit's bounds, canvas and padding, and the size's two members): all killed; five survivors of the first round (the pan left set after it ended, the anchor taken at the drag instead of the press, the missing refresh after a cancelled pan, the vertical `panBy` sign and `fit` reading the first canvas) got tests.
- [x] **6. Gates and records.**
  - *Run in order:* `pnpm format`, `pnpm docs:stack` (commit if it changes), `pnpm check` (the `app` layer is in the purity test), `pnpm build`, `pnpm api-index`, `pnpm agent-skills`, `pnpm api-report`; hand mutation over each step's logic, listed on its step; `index.ts` exports the controller (names asserted in `index.test.ts`).
  - *Records:* master plan (02), continuation prompt (03) and the spec's task table in the docs follow-up PR once the stack merges; nothing ticked in 02 from this PR.
  - *Done 2026-10-23:* `createPlanController` and its three types are exported from `index.ts` (asserted in `index.test.ts`; `stepOf` stays internal and is asserted out). `pnpm format` (no change), `pnpm docs:stack` (no change), `pnpm check` (32 tasks, `editor-3d` 1295 tests in 62 files), `pnpm build`, `pnpm api-index`, `pnpm cheatsheet` (no change), `pnpm agent-skills --write` then `pnpm agent-skills`, `pnpm api-report` (0 API breaks, 0 undeclared): all exit 0 at the commit that carries this note. Hand mutation was run on steps 1 to 5 as listed on them. Not run, by design: browser, GPU and visual suites (none selected); hosted CI (GitHub-hosted Actions are stopped; the af-mac runner result is pending).

## Verification

Local, Node 24: the package's tests and `pnpm check`. No browser or GPU suite is selected (no DOM, no painting, no sim code). The feel of the drag (slop, handle size, snap reach) is judged on the built editor (ED3D.12) and the Owner's iPad pass.

**Owner acceptance:** none of its own. ED3-c (the corner snaps onto the ward's wall line) and the Plan half of ED3-d are judged on the built editor.

## Risks and how the plan answers them

- **Moving a sector or a corner can make geometry the checks reject.** The edits refuse what is not a polygon (`outlineProblem`); what only the checks see (overlap) is the checks pill's to show after the commit, as in Last Light.
- **A live drag runs an edit on every move.** `moveCorner` is absolute and `moveSector` incremental from the applied offset, and both return the same level for no change, so a move with no effect records nothing; the geometry cache rebuilds once for each level change, not for each pick.
- **The recogniser's `dragStart` fires after the slop, not at the press.** The controller picks at the press position (`dragStart` carries both), so the thing grabbed is the thing the finger was on.
- **Stack depth.** This branch sits on #148 (on #137, on #129), so it merges last; when a lower PR gets a merge from `main`, `main` is merged here (no rebase).
