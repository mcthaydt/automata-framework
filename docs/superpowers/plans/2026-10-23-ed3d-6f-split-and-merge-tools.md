# ED3D.6f Split and Merge tools: TDD plan

- **Task:** ED3D.6f, the last part of ED3D.6 (sector tools). [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §5.3 flow 3, §5.4 (`sector.split`, `sector.merge`), §6 and the Sector toolbar of §7 (Polygon, Rectangle, Split, Merge). Two plain-TypeScript controllers for the Plan view: the Split tool turns two taps on one sector's outline into `splitSector`, the Merge tool turns a tap on the sector that stays and a tap on the one taken into it into `mergeSectors`. No Svelte, DOM, Pixi or clock.
- **Lane:** editor-3d. **Depends on:** ED3D.6e (PR #171: `splitSector`, `mergeSectors`, `pinned`), ED3D.6d (PR #161: the Vertex tool's way of turning a pointer on a wall into a corner or a place along it), ED3D.6b (PR #158: the Wall tool's `WallPlace`), ED3D.4 (PR #148: `pickCorner`, `wallNear`, `pickPlan`). Branch `claude/project-thread-39g5i1-ed3d-6f` is stacked on ED3D.6e's branch.
- **Status:** Drafted 2026-10-23 18:05 UTC by the lane's successor thread, on the standing go-ahead to keep building while the stacks wait (hub overnight mode, bus 0850). Implemented and locally checked 2026-10-23 18:30 UTC (steps ticked below); not reviewed, not CI verified, not Owner accepted. The choices below are the agent's and vetoable. Steps are ticked only when their checks pass.
- **Progress:** 5 of 5 steps (locally checked; the hosted gates are the Mac runner's).

## Why this task exists

ED3D.6e wrote the two edits and their sentences. A person still cannot reach them: the toolbar's Split and Merge need a controller that says what the pointer is over, what a tap would do there, and why not. As with the Vertex tool, the target is a dry run of the edit against the live level, so the tool cannot disagree with the model, and the sentence on a refused tap is the model's own.

## Sources, read at these commits

- **AF (this stack):** `app/vertex-tool-controller.ts` (the target is a dry run; the refusal lives while the pointer stays on the target), `app/wall-tool-controller.ts` (`WallPlace`, the same measure of a place along a wall, written a second time), `app/sector-tool-controller.ts` (`lowestFree`, the loupe and nudge it keeps for touch), `view/plan/plan-pick.ts` (`pickCorner`, `wallNear`, `pickPlan`), `model/split-edits.ts` (`splitSector`, its sentences; `tiedProblem`), `model/merge-edits.ts` (`mergeSectors`, its sentences), `model/sector-edit-support.ts` (`pinnedProblem`), `model/level-editor.ts` (`run` selects what the edit says, one undo step).

## Scope

**In:** `src/app/wall-place.ts` (the measure of a place along a wall and the pick of a corner before a wall, taken out of the Wall and Vertex tools), `src/app/sector-id.ts` (`lowestFreeId`, taken out of the Sector tool), `cutProblem` in `src/model/split-edits.ts`, `src/app/split-tool-controller.ts`, `src/app/merge-tool-controller.ts` (under the purity test) and their tests; the package entry exports both tools.

**Out, with where each goes:**

| What | Where |
|---|---|
| Painting the start, the cut line and its length, or the two highlighted rooms; the toolbar button and its keys | ED3D.5b and ED3D.11 |
| A loupe and a nudge for the second end, and a confirm tap for touch | ED3D.5b: a view concern, as the Sector tool's loupe is. Here a wrong cut is one undo step |
| Choosing the new sector's id | `id` is an option and defaults to the lowest free `sector-N`, as the Sector tool's; renaming is the inspector's |
| Merging three or more, or into a hole | not asked for (ED3D.6e refuses with a sentence) |
| Merging by tapping the shared wall | not asked for; the two taps name which room stays, which a wall cannot |

## Decisions this plan makes (each vetoable by the Owner through the Orchestrator)

1. **Two controllers, not two modes of the Sector tool.** The Sector tool (450 lines) holds a drawing and portal offers that neither new tool has; the Wall and Vertex tools are separate controllers too. The Sector toolbar is a row of buttons in the shell (ED3D.5b) that picks which controller the canvas forwards to.
2. **Split is two taps on one outline, then the edit.** The first tap puts the start of the cut at a corner (within the pointer kind's reach) or at a place on a wall (the Vertex tool's measure: 5 cm, 1 cm with Shift, exact with Alt), and fixes which sector is cut; the second tap on the same sector's outline runs `splitSector` as one undo step. The new sector's id is `options.id(taken)` or the lowest free `sector-N`. The selection is what the edit says (the kept and the new sector). A tap off the outline does nothing.
3. **The target is a dry run.** Before the start is placed, `start` says a tap would put it there, or `none` with the sentence for a sector that cannot be cut at all (`cutProblem`: pinned, or a portal into itself); once it is placed, `cut` says a tap would cut, or `none` with `splitSector`'s own sentence (the same point, along a wall, through a hole, outside the sector, a portal split that a door forbids). A tap on a target that says `none` is run all the same and refused with that sentence, which stays while the pointer stays on that target, as the Vertex tool's does.
4. **The start waits for the second tap and dies with the level.** It is dropped by `cancel()`, by `dispose()` and by any change to the level (an edit, an undo, a redo): the level it was placed on is gone. A refused second tap keeps it, and `leave()` keeps it (a finger lifts between taps).
5. **Merge is a tap on the room that stays and a tap on the room taken into it.** The first tap's target says `keep` (or `none` with the sentence for a pinned room); the second's says `merge`, or `none` with `mergeSectors`'s own sentence (itself, different floors, no wall in common, more than one meeting, and the rest). A tap picks the room by `pickPlan`: the wall within reach, which on a line two rooms share is the one the pointer is in, else the room that holds the point. A tap on nothing changes nothing. The selection is what the edit says (the kept sector).
6. **The same rules for the start of a merge:** dropped by `cancel()`, `dispose()` and any change to the level; kept after a refused second tap and after `leave()`.
7. **One edit run is one undo step,** labelled by the edit (`Split hall into hall and sector-1`, `Merge dock into hall`).
8. **A refused tap and a hover share the dry run.** A test hovers a set of places and taps on a fresh editor at each: a tap changes the level exactly when the target said it would.

## Contract

```
packages/editor-3d/src/app/wall-place.ts                  WallPlace, wallPlaceOf, CornerPlace, OutlinePlace, outlinePlaceAt
packages/editor-3d/src/app/sector-id.ts                   lowestFreeId
packages/editor-3d/src/model/split-edits.ts               cutProblem
packages/editor-3d/src/app/split-tool-controller.ts       createSplitTool, SplitTool, SplitToolView, SplitTarget, SplitEffect, SplitToolOptions
packages/editor-3d/src/app/merge-tool-controller.ts       createMergeTool, MergeTool, MergeToolView, MergeTarget, MergeEffect
packages/editor-3d/src/index.ts                           the public entry gains both tools
```

```ts
// wall-place.ts: moved out of wall-tool-controller.ts and vertex-tool-controller.ts, same shapes.
export interface WallPlace { sector; corner; selection; length; along; point }
export function wallPlaceOf<D>(editor, hit: WallHit, keys: { shift?: boolean; alt?: boolean }): { place: WallPlace; wall: string | EditWall | undefined } | undefined
export interface CornerPlace { kind: 'corner'; sector; corner; point }
export type OutlinePlace = CornerPlace | ({ kind: 'wall' } & WallPlace)
/** The corner within reach, else the wall within it and the place along it; nothing in a hidden or locked walls layer. */
export function outlinePlaceAt<D>(editor, geometry: Geometry<D>, viewport, at: PlanPointer): OutlinePlace | undefined

export function cutProblem<D>(profile: LevelProfile<D>, level: D, id: string): string | undefined

export type SplitEffect =
  | { readonly action: 'start' }   // a tap puts the start of the cut here
  | { readonly action: 'cut' }     // a tap cuts the sector from the start to here
  | { readonly action: 'none'; readonly reason: string }
export type SplitTarget = OutlinePlace & SplitEffect
export interface SplitToolView {
  readonly start: { readonly sector: string; readonly point: Point } | undefined
  readonly target: SplitTarget | undefined
  /** The cut a tap would make, from the start to the target, whether or not the model allows it. */
  readonly cut: { readonly a: Point; readonly b: Point; readonly length: number } | undefined
  readonly refusal: string | undefined
}
export interface SplitTool {
  readonly view: SplitToolView
  subscribe(run: () => void): () => void
  hover(at: PlanPointer): void
  leave(): void
  tap(at: PlanPointer): void
  /** Drops the start of the cut. */
  cancel(): void
  resize(size: Size): void
  dispose(): void
}
export interface SplitToolOptions { readonly id?: ((taken: readonly string[]) => string) | undefined }
export function createSplitTool<D>(editor: LevelEditor<D>, canvas: Size, options?: SplitToolOptions): SplitTool

export type MergeEffect =
  | { readonly action: 'keep' }    // a tap picks this room as the one that stays
  | { readonly action: 'merge' }   // a tap takes this room into the one that stays
  | { readonly action: 'none'; readonly reason: string }
export type MergeTarget = { readonly sector: string } & MergeEffect
export interface MergeToolView {
  readonly keep: string | undefined
  readonly target: MergeTarget | undefined
  readonly refusal: string | undefined
}
export interface MergeTool { /* the same members as SplitTool */ }
export function createMergeTool<D>(editor: LevelEditor<D>, canvas: Size): MergeTool
```

## Steps

Tests use the depot (the hall from (0, 0) to (8, 6) with a window on its north wall and a door on its west wall, the dock from (8, 0) to (14, 6), joined by a portal along x = 8), a hall with a third room, the Last Light toy level for what that profile says, and the canvas of the other tool tests (800 by 400 px, camera (7, 3), zoom 1, 32 px to a metre).

- [x] **1. Two helpers taken out.**
  - *Red, by case:* `wallPlaceOf` is the measure the Wall and Vertex tools have inline (a wall hit becomes sector, corner, selection, length, along from the document's start, the point; nothing for a wall that belongs to no corner or a sector that is gone), tested on its own; `outlinePlaceAt` is the Vertex tool's pick (a corner within reach, of the sector that holds the pointer when two have one at a point, else the wall within reach and the place along it; nothing in a hidden or locked walls layer), tested on its own; `lowestFreeId` gives `sector-1` and then the lowest free number. Then the Wall, Vertex and Sector tools use them.
  - *Expected failure:* the modules are missing. The Wall, Vertex and Sector tools' tests stay as they are and stay green (a refactor with the tests as the guard).
  - *Done 2026-10-23:* red (the modules are missing), then green: `app/wall-place.ts` (12 tests) and `app/sector-id.ts` (2 tests); the Wall tool's `targetAt` is `wallPlaceOf` and its effect, the Vertex tool's is `outlinePlaceAt` and its effect, the Sector tool's default id is `lowestFreeId`; `WallPlace` moved to `wall-place.ts` and the entry exports it from there. The Wall, Vertex and Sector tools' own test files are unchanged and green (261 app tests before, the same after, plus the helpers'). Deviation: the plan named `wallPlaceOf` only; the Vertex tool's pick of a corner before a wall was also written twice once the Split tool needed it, so `outlinePlaceAt` joined it.
- [x] **2. `cutProblem`** (`model/split-edits.test.ts`; `model/split-edits.ts`).
  - *Red, by case:* nothing for an ordinary room; a portal into itself, a pinned Last Light room (an opening names it), a sector that is not there says nothing (the edit's own sentence for it is `noSector`).
  - *Expected failure:* `cutProblem` is not exported.
  - *Done 2026-10-23:* red (4 cases, `cutProblem` is not a function), then green (49 tests in the file). `cutProblem(profile, level, id)` is `splitSector`'s first refusal (`tiedProblem`) as a function of a sector id: nothing for a sector that can be cut, for a sector that is not there, and the model's sentence for a portal into itself and for a pinned Last Light room. Deviation: none.
- [x] **3. The Split tool** (`app/split-tool-controller.test.ts`; `app/split-tool-controller.ts`).
  - *Red, by case:* hover on a wall gives a `start` target (sector, corner, `along`, point, length as the Vertex tool's), on a corner a `start` target with the corner and its point; a corner wins over the wall beside it; the reach by pointer kind and nothing in a hidden or locked `walls` layer; a room that cannot be cut at all (pinned) is `none` with the sentence; a tap on a `start` target places the start; the view then has `start` and, for a pointer on the outline, `cut` with the two points and the length and a `cut` target; a target off the outline of the cut room is `none` with `that point is not on the outline of hall`; the same point as the start, along the same wall and through a hole are the model's sentences; a tap on a `cut` target runs the edit once (one undo step, the label, the selection of the kept and the new sector) and clears the start; the sector that was cut is two rooms, the larger one with the id; a refused tap changes nothing, keeps the start and says the sentence while the pointer stays; the start is dropped by `cancel`, by an edit, an undo and a redo, and kept by `leave` and a refused tap; the `id` option; a tap on nothing does nothing; hover then tap on a fresh editor at 12 places agrees (decision 8); the cut across a shared wall splits the neighbour's portal (the `openings` check still passes on the result); `view` is the same object when nothing changed; Last Light.
  - *Expected failure:* the module is missing.
  - *Done 2026-10-23:* red (the module is missing), then green on the first run but for two of my own expectations (the pointer after a cut sits on a corner both halves now have, not a wall; a test that "opened a different level" handed back the level it already had, so its start was rightly kept); 39 tests in the file in the end, `tsc` and biome clean, the purity test holds. `createSplitTool(editor, canvas, options)` reads the place under the pointer with `outlinePlaceAt`, and its effect is the model's: before the start `cutProblem` (`start`, or `none` with the sentence), after it a dry run of `splitSector` from the start to the place (`cut`, or `none` with its sentence); the view carries `start`, `target`, `cut` (the two points and the length, shown whether or not the model allows it) and `refusal`. A tap puts the start (and the pointer is let go, since the cut under it would be of no length) or runs the edit once through `editor.run`: one undo step, labelled by the edit, the selection the edit names. A start is dropped by `cancel` and by any change of the level (checked by identity in `publish`, so an edit, an undo and a redo all drop it) and kept by `leave` and by a refused tap; a refusal lives while the pointer stays on that place of that sector (the sector matters at the first tap: a corner two sectors share is cut-able from one and not the other). Hand mutation (41 runs over the two effects, the stale-start test and the sentence it clears, the id option, the direction of the cut, the length and its rounding, the view's publishing, the first tap's refusal, the start it stores, the refusal's key and its three clearing rules, `leave`, the pointer let go after a start, `cancel`, `resize`, `dispose`): all killed in the end. Survivors answered: no test hovered empty ground with a sentence pending, nothing checked that the view goes on showing a refused tap (first or second), and the sentence's key was not tested for two sectors with a corner at one point (three cases added); two lines turned out to do nothing (the start cleared after a cut that worked, which the changed level already drops, and `fresh()` in `hover` and `tap`, which `publish` runs after every level event) and were taken out; `place === undefined ? undefined : {...}` for `place && {...}` is the same code. Deviation: none.
- [x] **4. The Merge tool** (`app/merge-tool-controller.test.ts`; `app/merge-tool-controller.ts`).
  - *Red, by case:* hover on a room gives a `keep` target; on a wall the room the pointer is in (a line two rooms share); a pinned room is `none` with the sentence; a tap on a `keep` target sets `keep`; the target then says `merge` for the neighbour and `none` with the model's sentence for itself, a room with no wall in common, rooms with different floors, a shared wall into a third room; a tap on a `merge` target runs the edit (one undo step, the label, the selection of the kept room) and clears `keep`; the dock gone and the hall's wall elsewhere following; a refused tap keeps `keep` and says the sentence; `cancel`, an edit, an undo and a redo drop `keep`, `leave` and a refused tap keep it; a tap on nothing does nothing; a hidden or locked `sectors` layer hits nothing; the dry run agrees with the tap at several places; Last Light.
  - *Expected failure:* the module is missing.
  - *Done 2026-10-23:* red (the module is missing), then green (31 tests in the file; one expectation of mine was wrong, a zoom of 2 about the centre leaves the pointer over the same hall; `tsc` and biome clean, the purity test holds). `createMergeTool(editor, canvas)` reads the room under the pointer with `pickPlan` (the wall within reach of the room the pointer is in, else the room that holds the point; nothing in a hidden or locked `sectors` layer, and the walls layer's own switch still decides whether a wall can be hit), and its effect is the model's: before the first tap `pinnedProblem` (`keep`, or `none` with the sentence), after it a dry run of `mergeSectors` into the picked room (`merge`, or `none` with its sentence). A tap picks the room that stays (the pointer is then let go) or runs the edit once through `editor.run`: one undo step labelled `Merge b into a`, the selection the edit names. The picked room is dropped by `cancel` and by any change of the level, kept by `leave` and by a refused tap; a refusal lives while the pointer stays on that room. Tested on the depot (different floors), the pair at one height, a yard whose portal into the dock follows the merge, a room with no wall in common, a profile that will not write, another open step, and the Last Light toy with its opening (pinned) and without it (two rooms made one, one undo back). Hand mutation (33 runs over the two effects, the swapped rooms in both the dry run and the edit, the stale-pick test and the sentence it clears, the layer switches and the reach, the view's publishing, the first tap's refusal, the room it stores, the refusal's key and clearing rules, `leave`, the pointer let go after a pick, `cancel`, `resize`, `dispose` and the two subscriptions): all killed in the end. Survivors answered: `dispose` took the subscriptions off and nothing noticed, because the test moved the camera to where the pointer was still over the same room (the camera now moves away from it); `sectorAt(at) !== refused?.sector` for the guard plus `!==` is the same code. Deviation: none.
- [x] **5. Entry, gates and records.**
  - *Run in order:* the package entry exports both tools and their types (asserted in `index.test.ts`); `pnpm format`, `pnpm docs:stack`, `pnpm check`, `pnpm build`, `pnpm api-index`, `pnpm cheatsheet`, `pnpm agent-skills --write` then `pnpm agent-skills`, `pnpm api-report`; hand mutation over each step's logic, listed on its step; `purity.test.ts` still holds for the `model` and `app` layers.
  - *Records:* master plan (02), continuation prompt (03) and the spec's task table and §5.4 command table in the docs follow-up PR once the stack merges; nothing ticked in 02 from this PR. The viewer (built outside the repository from the package's own source) gets Split and Merge in the next views page, after the ED3D.6d page is published at the daily limit's reset.
  - *Done 2026-10-23:* the package entry exports `createSplitTool`, `createMergeTool`, their views, targets, effects and options and `CornerPlace` and `OutlinePlace` (asserted in `index.test.ts`; the helpers `cutProblem`, `lowestFreeId`, `outlinePlaceAt` and `wallPlaceOf` stay inside, asserted too). Local gates in order, Node 24: `pnpm format` (no fixes to this package), `pnpm docs:stack` (no change), `pnpm check` (32 tasks, 1,837 tests in the package, the purity test and knip included), `pnpm build`, `pnpm api-index`, `pnpm cheatsheet`, `pnpm agent-skills --write` then `pnpm agent-skills` (current), `pnpm api-report` (0 undeclared; the 17 breaks it lists are `cli`, `editor-kit` and others from `main` having moved since the stack was cut, all private); nothing generated changed because `editor-3d` is private. Hosted CI not run (hosted Actions are stopped). Deviation: none.

## Mutations

Hand mutation per step with `mutate.py` (`/mnt/project-files/ed3d/mutate.py`), run from `packages/editor-3d`, the tool's own test file as the filter:

- **Helpers and `cutProblem` (steps 1 and 2):** guarded by the Wall, Vertex and Sector tools' own tests (unchanged) and the helpers' tests; no separate run (the code is moved, not new, and the mutants of the Split tool below exercise `outlinePlaceAt` and `cutProblem` through it).
- **Split tool (step 3):** 41 runs, all killed in the end. Survivors answered with tests: a sentence pending while the pointer moves to empty ground, a refused first tap that must go on showing its target, a refusal key that must include the sector (a corner two sectors share); two lines that did nothing were removed (the start cleared after a cut that worked; `fresh()` in `hover` and `tap`), and `place === undefined ? undefined : {...}` for `place && {...}` is the same code.
- **Merge tool (step 4):** 34 runs, all killed in the end. Survivors answered: `dispose` took the subscriptions off and no test could tell (the test now moves the camera away from the pointer); `sectorAt(at) !== refused?.sector` for the guard and `!==` is the same code.

## Verification

Local, Node 24: the package's tests and `pnpm check`. No browser or GPU suite is selected (no DOM, no painting, no sim code). Whether two taps are enough for a cut on a finger, or the second end wants a loupe and a confirm, is judged on the built editor (ED3D.11, ED3D.12).

## Risks

| Risk | Mitigation |
|---|---|
| The tool disagrees with the model about what a cut or a merge may do | decision 3, 5 and 8: the target is a dry run of the edit, and a test taps at every place it hovered |
| The dry run on every pointer move is slow on a big level | the edit is a list, a replace and a geometry build, the cost of a drag step; the cache is by level identity; measured on the depot and the clinic in step 3 |
| A stale start survives an undo and cuts a sector that is no longer there | decision 4: the level's identity decides, tested for edit, undo and redo |
| Moving the measure out of the Wall and Vertex tools changes what they do | step 1: their tests are untouched and run before and after |
