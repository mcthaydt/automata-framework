# ED3D.6c Rectangle shape for the Sector tool: TDD plan

- **Task:** ED3D.6c, the third part of ED3D.6 (sector tools). [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §5.3 flow 2 (draw a sector), §6 (the Sector toolbar: Polygon, Rectangle, Split, Merge) and acceptance cases ED3-c and ED3-s (draw a rectangle against a wall, accept the portal). The Rectangle shape of the Sector tool as plain TypeScript: two taps span an axis-aligned room, and the rest (heights, portal offers, one undo step) is the Polygon shape's path. No Svelte, DOM, Pixi or clock.
- **Lane:** editor-3d. **Depends on:** ED3D.6a (PR #155: `createSectorTool` and its offers flow). Branch `claude/project-thread-ljshus-ed3d-6c` is stacked on ED3D.6b's branch (PR #158), only because the viewer carries both; the code touches ED3D.6a's file alone.
- **Status:** Drafted 2026-10-23 on the hub's instruction (bus 1242: ED3D.6 sector tools as plain-TypeScript controllers, keep going while the stack waits). Not reviewed; spec review (ED3D.0) is still open. Steps below are ticked only when their checks pass.
- **Progress:** 2 of 4 steps.

## Why this task exists

Most rooms in a Build-style level are rectangles, and four taps with the right snaps are a slow way to draw one, above all with a finger. The spec's Sector toolbar has a Rectangle shape and two of its acceptance cases (ED3-c, ED3-s) draw one against a wall and accept the portal. The shape is two decisions (the first corner, the opposite corner) and one rule (the outline is written the same way whichever diagonal was drawn); everything after it is already the Polygon shape's. The vertex tool, `sector.split` and `sector.merge` need new model edits and are the next part.

## Sources, read at these commits

- **AF (this stack):** `app/sector-tool-controller.ts` (ED3D.6a: `closeOutline`, `place`, `nudge`, `reachesFirst`, the `held` rule while portal offers are open), `view/plan/plan-snap.ts` (`snapPlan`: `from` turns on the axis through a point), `geometry/loops.ts` (`outlineProblem`: either way round is fine, a loop with no area is refused), `model/sector-edits.ts` (`addSector` rounds to 4 places and takes the heights of `like`).

## Scope

**In:** `src/app/sector-tool-controller.ts` gains the shape (`view.shape`, `setShape`, `options.shape`) and its tests in a new `src/app/sector-tool-rectangle.test.ts`; the package entry exports `SectorShape`.

**Out, with where each goes:**

| What | Where |
|---|---|
| Painting the rectangle, the Polygon and Rectangle buttons and DOM events | ED3D.5b and ED3D.11 |
| A rectangle by dragging from one corner to the other | the shell's gesture layer maps a drag onto press, hover and tap (ED3D.11); the controller keeps taps |
| A rotated rectangle, a rectangle from its centre, a typed width and depth | not planned; the inspector's steppers move a corner afterwards |
| The vertex tool, `sector.split`, `sector.merge` | the next part of ED3D.6 |

## Decisions this plan makes (each vetoable by the Owner through the Orchestrator)

1. **A shape of the one tool,** not a second controller: `SectorShape = 'polygon' | 'rectangle'`, `view.shape`, `setShape(shape)` and `options.shape` (default `'polygon'`). A tool that switches shape keeps its subscribers, its viewport and its portal-offers flow.
2. **Switching shape does not lose a drawing.** `setShape` with corners placed and a different shape is refused with `finish or cancel the outline before changing the shape` and nothing changes; with portal offers open it is held with `answer the portal offers first`; the same shape again is no change. With nothing placed it switches.
3. **Two corners span the room.** The first tap places a corner A, the second the opposite corner C, snapped as any corner is (vertex, wall, grid or data step; Alt free). The axis snap through the last corner is off in this shape: it only ever gives a room of no width.
4. **A tap on C closes; a tap elsewhere moves C.** With C placed, a tap within the pointer kind's reach of C (and `closing` true in the view) adds the sector; any other tap moves C there, so a finger can correct its second corner before it commits, the way a polygon's last corner takes a nudge. The Close button and Enter close too.
5. **No width or no depth is refused where it is made:** a C on the vertical or horizontal line through A (this includes C = A) is refused with `a rectangle needs a width and a height` and A, and C if it was placed, stay. `close` with less than two corners says `tap the opposite corner of the rectangle`.
6. **The outline is written north-west first, east, south, west** (`(x0, z0)`, `(x1, z0)`, `(x1, z1)`, `(x0, z1)` with `x0 < x1` and `z0 < z1`), the order of the depot's hall, whichever diagonal was drawn: the same room gives the same file, and `addSector` gets a loop that cannot cross itself.
7. **`view.edges` is the rectangle's four edges** with their lengths, pending while C is not placed (from A to where the pointer would put C) and placed when it is; none while the pointer's point has no width or no depth against A. `view.corners` stays what was placed (A, then C). Nudge moves the last placed corner by a grid step and a nudge that would leave no width or depth puts it back; undo-corner takes C back, then A.
8. **After the outline it is the Polygon shape's path:** the id, `like` (the selected sector's heights), the refusals `addSector` gives, the portal offers (accepted into the same session) and the one step labelled `Draw sector <id>`.

## Contract

```
packages/editor-3d/src/app/sector-tool-controller.ts     SectorShape; SectorToolView.shape; SectorTool.setShape; SectorToolOptions.shape
packages/editor-3d/src/index.ts                          the public entry gains SectorShape
```

```ts
export type SectorShape = 'polygon' | 'rectangle'
// SectorToolView gains:   readonly shape: SectorShape
// SectorTool gains:       /** Switches the shape of the next outline; refused while corners are placed or portals are offered. */
//                         setShape(shape: SectorShape): void
// SectorToolOptions gains: readonly shape?: SectorShape | undefined
```

## Steps

Tests use the depot (the hall from (0, 0) to (8, 6), the dock from (8, 0) to (14, 6)) and the Last Light toy level, on the 800 by 400 px canvas the other tool tests use; pixel positions are made with `toScreen`.

- [x] **1. The shape.** (`app/sector-tool-rectangle.test.ts`; `app/sector-tool-controller.ts`).
  - *Red, by case:* `view.shape` is `polygon` by default and `rectangle` when the option says so; `setShape('rectangle')` with nothing placed switches and notifies; with corners placed it is refused with the sentence and the shape and corners stay; after `cancel` it switches; while portal offers are open it is held with `answer the portal offers first`; the same shape again does not notify; a polygon is still drawn as before after switching back (three taps and a tap on the first corner add a sector).
  - *Expected failure:* `view.shape` is undefined and `setShape` is not a function.
  - *Done 2026-10-23:* red (all 8 failing: `view.shape` undefined, `setShape` not a function), then green (9 tests in the new file with the sentence-clearing case; the Sector tool's 57 unchanged; `tsc` and biome clean). `setShape` is nothing for the shape it has, held while offers are open, refused with the sentence while corners are placed, else switches and clears the last sentence. Hand mutation (9 mutants over the same-shape and held guards, the corner-count guard, the refusal, the switch, the default, the initial view and the view field): all killed. Deviation: none.
- [x] **2. Two corners and what the view says.** (same files).
  - *Red, by case:* the first tap places A and the view has one corner and no edges; a hover with a point that has a width and a depth gives four pending edges whose lengths are the sides, from A; a hover on A's own vertical or horizontal line (and on A) gives none; the second tap places C (corners `[A, C]`) and the four edges are placed, not pending; `closing` is false before C and true with the pointer within reach of C (a finger 22 px, a mouse 8, not a hair past it); a tap away from C moves it (corners `[A, C']`, still not a sector); a tap on A's line is refused with the sentence, C stays and no sector is added; the axis snap is off (a pointer 1.6 px off the horizontal through A snaps to the grid, not the axis); nudge moves C by a grid step, a nudge onto A's line puts it back; undo-corner takes C and then A; `close` with no or one corner says `tap the opposite corner of the rectangle`.
  - *Expected failure:* a second tap places a third corner and no rectangle edges are given.
  - *Done 2026-10-23:* red (14 of the 19 new cases failing: a second tap placed a third corner, no rectangle sides), then green (27 tests in the file, the Sector tool's 57 unchanged; `tsc` and biome clean). `rectangleOf(a, b)` is the room two corners span, north-west first (nothing for a shared line); the view's sides come from it (pending from the first corner to the pointer's snap, placed with two corners); `closing` is `reachesCloser`, the polygon's first corner once it has three or the rectangle's second; `place` refuses a rectangle's second corner on the first's lines; `moveLast` is the nudge's put-it-back pattern, now shared with the tap that moves the second corner; the axis snap is off in this shape; `close` with fewer than two corners says where the second goes. Hand mutation (25 mutants over the shared-line test, the min and max, the corner order, the pending flag, the loop's wrap, the axis snap, the closer's count and index, the outline guard and its sentence, the width and depth guard, the shape guard, the put-it-back and the tap and nudge branches): all killed. One test expectation was wrong first (after an undo the pointer is still where the tap was, so the sides to it are pending again). Deviation: none.
- [ ] **3. Closing.** (same files).
  - *Red, by case:* the four diagonals of one room (A at each of its four corners) give the same sector with corners `[x0, z0], [x1, z0], [x1, z1], [x0, z1]`; a tap on C, the Close button and Enter-by-`close` each add it as one step labelled `Draw sector sector-1`, the drawing is empty and the shape stays a rectangle; the selected sector's heights are taken; a rectangle under the hall's south wall offers one portal into the hall, accepting it makes both sides portals in the same step, one undo takes room and portal; a rectangle between the hall and the dock's south walls offers two; `declineOffer` and `finish` keep the room solid; a rectangle that overlaps the hall is refused with the model's sentence, the corners stay and no step is made; Last Light: a rectangle beside a room is added as `Draw sector sector-1`.
  - *Expected failure:* a closed outline is the two corners, which the model refuses (`a sector needs at least three corners`).
- [ ] **4. Entry, gates, viewer and records.**
  - *Run in order:* the package entry exports `SectorShape` (asserted in `index.test.ts`); `pnpm format`, `pnpm docs:stack`, `pnpm check`, `pnpm build`, `pnpm api-index`, `pnpm cheatsheet`, `pnpm agent-skills --write` then `pnpm agent-skills`, `pnpm api-report`; hand mutation over each step's logic, listed on its step; `purity.test.ts` still holds for the `app` layer; the viewer artifact gets a Polygon and Rectangle choice on the Sector card, with the rectangle painted from `view.edges`.
  - *Records:* master plan (02), continuation prompt (03) and the spec's task table in the docs follow-up PR once the stack merges; nothing ticked in 02 from this PR.

## Verification

Local, Node 24: the package's tests and `pnpm check`. No browser or GPU suite is selected (no DOM, no painting, no sim code). Whether two taps are enough for a finger, and whether the nudge pad belongs under the opposite corner, are judged on the built editor (ED3D.11, ED3D.12).

## Risks

| Risk | Mitigation |
|---|---|
| A rectangle written in the drawing's own order gives a different file for the same room | decision 6: the order is fixed by the room's extent, and a test draws the room from all four diagonals |
| The second tap closes before a finger can correct it | decision 4: the second tap places C and only a tap on C (or Close) commits |
| Changing shape drops a half-drawn polygon | decision 2: refused, with a sentence, while corners are placed |
| The axis snap makes a rectangle of no width | decision 3: off in this shape, and decision 5 refuses what still gets there |
