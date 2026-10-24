# ED3D.6a Draw-sector tool: TDD plan

- **Task:** ED3D.6a, the first part of ED3D.6 (sector tools). [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §5.3 flow 2 (draw a sector on the plan: a tap places a corner, each edge shows its length, Close by button or by tapping the first point, refused for fewer than three corners, a self-crossing outline or an overlap, otherwise one transaction adds the sector with inherited heights; a new wall on a neighbour's wall offers a portal, and accepting adds both portals in the same transaction), §10 (the Pencil draws and hover previews the snap target and the edge length; the loupe shows the corner under the tip; the nudge pad moves it by one grid step). The logic of the Plan view's Sector tool as plain TypeScript. No Svelte, DOM, Pixi or clock.
- **Lane:** editor-3d. **Depends on:** ED3D.5a (PR #150: `PlanPointer`, the controller pattern), ED3D.4 (PR #148: `snapPlan`, `planViewport`, `selectionOf`) and ED3D.3 (PR #137: `LevelEditor`, `addSector`, `setWallKind`). Branch `claude/project-thread-ljshus-ed3d-6a` is stacked on ED3D.4b's branch (PR #152).
- **Status:** Drafted 2026-10-23 on the coordinator's and the hub's instruction of 10:05 UTC to keep going on the next ED3D slice while the stack waits in the merge queue. Not reviewed; spec review (ED3D.0) is still open. Steps below are ticked only when their checks pass.
- **Progress:** 5 of 5 steps.

## Why this task exists

Drawing is the one thing only the Plan does (spec §6), and the Pencil, touch and mouse rules for it (§10) would each be re-derived in a Svelte view that can only be tested in a browser. This task builds the meaning once, as a controller the view forwards pointer events to, as ED3D.5a did for Select: the view reads `view`, calls the methods with canvas pixels and the pointer kind, and paints the corners, the rubber edge with its length, the snap target, the loupe and the portal offers. The shell, the tool strip and the loupe and nudge pad as widgets are ED3D.5b and ED3D.11; the vertex, portal, door and window tools are later parts of ED3D.6.

## Sources, read at these commits

- **AF (this stack):** `app/plan-controller.ts` (the pointer type, the geometry cache, the session pattern), `view/plan/plan-snap.ts` (`snapPlan` with `from` for the axis through the last corner, `stepOf`), `view/plan/plan-viewport.ts` (`planViewport`, `toScreen`, `toWorld`, `snapValue`), `model/sector-edits.ts` (`addSector`: ids, outline refusals, inherited heights from `like`, the overlap refusal from the geometry), `model/wall-edits.ts` (`setWallKind` portal: both sides, refused when the other side already leads elsewhere), `model/wall-geometry.ts` (`wallOver`), `model/level-editor.ts` (`begin`, `EditSession`).

## Scope

**In:** `src/model/portal-offers.ts` (pure: which walls of a new sector lie on a neighbour's wall), `src/app/sector-tool-controller.ts` (under the purity test) and their tests; the package entry exports them.

**Out, with where each goes:**

| What | Where |
|---|---|
| Painting the corners, rubber edge, lengths, loupe, nudge pad and offers; the canvas; the tool strip; DOM events | ED3D.5b and ED3D.11 |
| The vertex, portal, door and window tools; `sector.split` and `sector.merge` | later parts of ED3D.6 |
| Switching the `sectors` layer on when the tool is picked, and whether a drawing in a hidden or locked layer is refused | the shell (ED3D.5b): the tool does not read the layers |
| Drawing a hole, and a sector of another profile's own kind (Last Light's zone: the draft is the profile's `create`, which `addSector` calls) | not planned; `addSector` already carries what a profile adds |

## Decisions this plan makes (each vetoable by the Owner through the Orchestrator)

1. **The tool is its own controller with its own `view`,** not a mode of `PlanController`: it holds a drawing in progress, and Select holds a drag. The shell routes the recogniser's events to whichever is active and `fit`, `panBy`, `zoomAt` stay the plan controller's, so the camera is one thing. It takes `PlanPointer`, the pointer type of `plan-controller.ts`.
2. **A corner is the snapped point of a tap.** `snapPlan` with `from` set to the last corner, so a point near the horizontal or vertical through it goes on the axis, and a corner or a wall line of an existing sector is snapped to first (a new wall drawn on a neighbour's wall is on the same segment, which the portal offer needs). Shift is the fine step and Alt no snap, as everywhere. A tap on a point that is a corner already (the first included, until there are three corners to close) is refused with `that point is already a corner` and adds nothing; a nudge onto another corner is refused the same way.
3. **Closing:** with three or more corners a tap within the pointer kind's `PICK_RADIUS` (in pixels) of the first corner closes, as does `close()`. With fewer than three, `close()` says `a sector needs at least three corners` and keeps the corners; a tap on the first corner then is the duplicate refusal above. `view.closing` says a tap at the pointer would close, so the view can show it.
4. **Close runs `addSector` in an `EditSession`,** so adding the sector and the portals the person accepts are one undo step. The id is a function of the ids taken (`sector-N`, the lowest N that is free, unless the options give one); the heights and light come from `like`, the one sector the selection names (a selected sector, or the sector of a selected wall), else the model's own default (the last sector). A refusal (`addSector`'s own sentence: the id, the outline, the overlap) cancels the session, leaves the corners where they are so the person can nudge, take one back or add one, and is in `view.refusal` until the next change.
5. **Portal offers are computed on the sector as added and answered one at a time.** `portalOffers(profile, level, id)` lists, for each wall of the new sector that runs over the same segment as a wall of another sector (either way round, the model's `wallOver`), `{ sector, corner, to, toCorner, length }`, except a wall of the other sector that already leads into a different sector (`setWallKind` would refuse it). With none, the session commits at once. With some, the sector is in the level (live) and the session stays open with `view.offers`; `acceptOffer` runs `setWallKind` portal for that wall (both sides) and a refusal keeps the offer with the sentence; `declineOffer` drops it; when none is left the session commits. `acceptAll` accepts the rest in order and stops at a refusal; `finish` declines the rest and commits. `cancel` while offering cancels the session, and the sector is gone with it.
6. **An undo while offering ends the drawing,** as it does for a drag in Select: the session is closed by the history, the offers go and the view is idle.
7. **The loupe and the nudge are the tool's data, not widgets.** `view.loupe` is the point the loupe magnifies: the snapped point under a Pencil's hover, and the last corner after a `nudge`; it is nothing for a mouse and a finger (a finger's loupe is the shell's choice, ED3D.11). `nudge(dx, dz)` moves the last corner by whole steps of the view's grid (the fine step with Shift is the view's, not asked here), and refuses with `place a corner first` when there is none.
8. **Dispose commits an open offering** (the sector is already in the level on screen, and a tool switch must not take it away), and drops a drawing that was not closed.

## Contract

```
packages/editor-3d/src/model/portal-offers.ts           portalOffers, PortalOffer
packages/editor-3d/src/app/sector-tool-controller.ts    createSectorTool, SectorTool, SectorToolView, DrawEdge, SectorToolOptions
packages/editor-3d/src/index.ts                         the public entry gains them
```

```ts
export interface PortalOffer {
  readonly sector: string     // the new sector
  readonly corner: number     // the corner that starts its wall
  readonly to: string         // the sector it would lead into
  readonly toCorner: number   // the corner that starts the reverse wall there
  readonly length: number     // metres
}
export function portalOffers<D>(profile: LevelProfile<D>, level: D, id: string): PortalOffer[]

export interface DrawEdge { readonly a: Point; readonly b: Point; readonly length: number; readonly pending: boolean }

export interface SectorToolView {
  readonly corners: readonly Point[]
  readonly snap: SnapResult | undefined       // where the next corner would go
  readonly edges: readonly DrawEdge[]         // the placed edges, then the pending one to the snap point
  readonly closing: boolean
  readonly loupe: Point | undefined
  readonly offers: readonly PortalOffer[]
  readonly refusal: string | undefined
}

export interface SectorToolOptions { readonly id?: ((taken: readonly string[]) => string) | undefined }

export interface SectorTool {
  readonly view: SectorToolView
  subscribe(run: () => void): () => void
  hover(at: PlanPointer): void
  leave(): void
  tap(at: PlanPointer): void
  nudge(dx: number, dz: number): void
  undoCorner(): void
  close(): void
  acceptOffer(index: number): void
  declineOffer(index: number): void
  acceptAll(): void
  finish(): void
  cancel(): void
  resize(size: Size): void
  dispose(): void
}
export function createSectorTool<D>(editor: LevelEditor<D>, canvas: Size, options?: SectorToolOptions): SectorTool
```

## Steps

Tests use the depot (two sectors and a portal pair), small levels built beside it for one rule each, and the Last Light clinic for a refusal that is the profile's.

- [x] **1. Portal offers** (`model/portal-offers.test.ts`; `model/portal-offers.ts`).
  - *Red, by case:* a sector added west of the depot's hall, over the hall's west wall, offers one portal (its east wall, into `hall`, the hall's corner 3, 6 m); a sector added south of both rooms with one wall over each offers two, in the order of its corners; a wall that only touches (shares one corner) or lies on part of a neighbour's wall offers none; a neighbour wall that already leads into another sector offers none (and one that already leads into the new sector is offered); a sector with no neighbour offers none; the answer is the same for a loop written either way round; a level of Last Light's blockout gives offers through the same `wallOver` (one case on the clinic).
  - *Expected failure:* the module is missing.
  - *Done 2026-10-23:* red (`portalOffers` not a function), then green (10 tests; `tsc` and biome clean). The offers come from the model's own `wallOver` over every other sector in the level's order, one per wall (the first sector that lies on it), left out when the other side leads into a third sector or when the two sides already lead into each other; a wall of the new sector that already leads into the neighbour but whose reverse does not is offered, which completes the pair. Hand mutation (15 mutants over each condition, the break, the corner indices, the length and the early returns): all killed after two tests were added (the half pair, two neighbours on one wall).
- [x] **2. Drawing the outline** (`app/sector-tool-controller.test.ts`; `app/sector-tool-controller.ts`).
  - *Red, by case:* a tap adds the snapped corner (grid, a vertex or wall of a sector, the axis through the last corner, Shift fine, Alt free) and the snap is in `view`; `edges` has each placed edge with its length and a pending edge from the last corner to the hover snap; a tap on the last point is refused and adds nothing; `closing` is true only with three corners and a pointer within the radius of the first, and tapping there with fewer than three is refused as a duplicate; the loupe is the snap point for a Pencil hover and nothing for a mouse and a finger; `nudge` moves the last corner by grid steps, sets the loupe on it and refuses with no corner; `undoCorner` takes the last corner back; `cancel` clears; `leave` clears the hover; a change of the camera in the view store moves what a hover snaps to; `view` is the same object when nothing changed.
  - *Expected failure:* the module is missing.
  - *Done 2026-10-23:* red (`createSectorTool` not a function, 27 failing), then green (33 tests; `tsc` and biome clean). `view` is the corners, the snap of the pointer for the next corner (so after a tap it is the axis through the corner just placed, and the tests read the snap kind from the hover before the tap), the placed edges and the pending one (none when the pointer is on the last corner), `closing`, `loupe` and `refusal`; it is recomputed after a hover, a tap, a nudge, a canvas resize, a camera change in the view store and a level change in the history, and is the same object when nothing differs. The reach of a snap is the pointer kind's, and a hidden or locked `walls` layer is not snapped to. Deviations from the plan: a tap on any corner already placed is the duplicate refusal (not only the last one), and the selection is not followed (nothing in `view` depends on it; step 3 reads it when it closes). Hand mutation (36 mutants over the snap options, the pending edge, closing's count and reach, the loupe rules, the duplicate rule, the nudge arithmetic and its put-back, undo, cancel, resize and the subscriptions): all killed after four tests were added (a finger's reach, a locked layer, the boundary of the reach, a tap with no hover) but one equivalent survivor (`cancel` not clearing `nudged`: with no corner left the loupe is the last corner, which is nothing, and the next tap or hover clears it).
- [x] **3. Closing** (same files).
  - *Red, by case:* `close()` and a tap on the first corner add the sector as one undo step (one `history` step, labelled `Draw sector sector-N`), select it and clear the drawing; the id is the lowest free `sector-N` and an option's function replaces it; heights and light come from the selected sector (a selected wall's sector too), else the last; fewer than three corners, a self-crossing outline and an overlap of another sector are refused with `addSector`'s sentences, leave the corners and the level as they were, and no history step; after a refusal a `nudge` or `undoCorner` clears the sentence and a second close can succeed; a closed session (another transaction open) refuses with a sentence and keeps the corners; a Last Light level adds a room with its zone default (one case on the clinic).
  - *Expected failure:* `close` does nothing.
  - *Done 2026-10-23:* red (nine failing), then green (43 tests; `tsc` and biome clean). `close` (and a tap within reach of the first corner of an outline of three or more) runs `addSector` in an `EditSession` labelled `Draw sector <id>`: success commits one step, selects the sector and clears the drawing; a refusal cancels the session, keeps the corners and shows the model's sentence (fewer than three corners, `the outline crosses itself`, `the new sector overlaps hall`, and the history's own sentence when another step is open). `SectorToolOptions.id` replaces the lowest-free `sector-N`; `like` is the one sector the selection names (a sector or a wall of it; two sectors or none leave the model's default). A Last Light level takes a room the same way. Hand mutation (19 mutants over the id, the label, the selection rule, the cancel, the commit, the refusal and the reset, the reach rule, the tap that closes, the corner order): all killed after one assertion was added (the sentence clears after a successful second close) but one equivalent survivor (`nudged` not cleared on a close: the drawing is empty, so the loupe is nothing, and the next tap or hover clears it).
- [x] **4. The portal offers** (same files).
  - *Red, by case:* closing against a neighbour's wall leaves the sector in the level, the session open (no history step yet) and `view.offers`; `acceptOffer` makes both sides portals and the offer goes; the last answered offer commits one step that holds the sector and the portals (undo removes all); `declineOffer` leaves the wall solid; `acceptAll` accepts every offer in order and stops at the first refusal with its sentence; `finish` declines the rest and commits; `cancel` while offering removes the sector; an undo while offering closes it and the view is idle; a refused `acceptOffer` (the reverse leads elsewhere, built by a test) keeps the offer with the sentence; a tap, a nudge and a close while offering are ignored with the sentence `answer the portal offers first`; `dispose` while offering commits.
  - *Expected failure:* no offers are made.
  - *Done 2026-10-23:* red (14 failing: `view.offers` and the four methods did not exist), then green (57 tests; `tsc` and biome clean). `close` (and a tap within reach of the first corner) runs `addSector` as before; when `portalOffers` finds walls over a neighbour's, the session stays open with the sector live and `view.offers` set, and the drawing is clear. `acceptOffer` runs `setWallKind` to `portal` in that session (a refusal keeps the offer and shows the sentence; a profile that cannot write it is built by a test), `declineOffer` drops the offer, and the last answer or `finish` commits one step (`Draw sector <id>`) that holds the sector and the portals; `acceptAll` stops at the first offer that did not go. `cancel` takes the sector away with nothing to undo; an undo ends the step (the history subscription sees the session closed) and the view is idle; `dispose` commits. A tap, a nudge, a close and a corner taken back are held with `answer the portal offers first` while offers are open, and a hover still moves the snap. The test's step probe cancels the session it opens, so it leaves nothing behind. Hand mutation (28 mutants over the commit-or-offer rule, the hold and its sentence, accept versus decline, the refusal path, the index removed, the last answer, `finish`, the undo, the four holds, `acceptAll`'s stop, `cancel`, `dispose`, the offers of the view, the sector and the target of the portal): all killed after one test was added (the sentence of a refused offer clears when the next is answered) but one equivalent survivor (the `publish` after `finish`'s commit: the commit notifies the history, which publishes; it stays as a guard against a commit that does not).
- [x] **5. Entry, gates and records.**
  - *Run in order:* `pnpm format`, `pnpm docs:stack` (commit if it changes), `pnpm check`, `pnpm build`, `pnpm api-index`, `pnpm cheatsheet`, `pnpm agent-skills --write` then `pnpm agent-skills`, `pnpm api-report`; hand mutation over each step's logic, listed on its step; the package entry exports the new names (asserted in `index.test.ts`), and `purity.test.ts` still holds for the `app` layer; the viewer artifact gets a Sector tool: tap to place corners with edge lengths, Close, and the portal offers.
  - *Records:* master plan (02), continuation prompt (03) and the spec's task table in the docs follow-up PR once the stack merges; nothing ticked in 02 from this PR.
  - *Done 2026-10-23:* `createSectorTool`, `SectorTool`, `SectorToolView`, `SectorToolOptions`, `DrawEdge`, `portalOffers` and `PortalOffer` are exported from the package entry and asserted in `index.test.ts`; `purity.test.ts` holds. Gates in order on this branch, all clean: `pnpm format`, `pnpm docs:stack`, `pnpm check` (32 of 32 tasks, the kit's 295 unit tests and the package's 1212 included), `pnpm build`, `pnpm api-index`, `pnpm cheatsheet`, `pnpm agent-skills --write` and `pnpm agent-skills`, `pnpm api-report` (no change: `editor-3d` is private). The gates first failed on the kit's typecheck: the earlier merge of the fields work into the gesture work left two `Point` exports in the kit's entry. EDK.3 had already settled it (one `Point`, the field module's, exported once), so the same three-line change went in on ED3D.4 and was merged up through ED3D.5a and ED3D.4b. Selected: unit, typecheck, build, the docs gates; omitted: browser, layout and GPU suites (no DOM or painting here); pending: hosted CI (Actions are stopped), the af-mac run. Viewer (scratchpad build, not in the repo): the views artifact (https://claude.ai/artifact/WwuB75YtLhSMi8fDDSG26X, version 4) has a Select and Sector toggle; on the depot, real pointer taps place five corners south of both rooms (snapping to the hall's corner and the dock's wall line), the closing ring shows on the first corner, Close gives two offers (hall 8 m, dock 6 m), accepting both is one undo step labelled `Draw sector sector-1`, and an undo takes the sector back, with no page errors. Owner acceptance is not ticked.

## Verification

Local, Node 24: the package's tests and `pnpm check`. No browser or GPU suite is selected (no DOM, no painting, no sim code). How the loupe and the nudge pad feel under a Pencil and a finger is judged on the built editor (ED3D.11, ED3D.12).

## Risks

| Risk | Mitigation |
|---|---|
| A new wall drawn near a neighbour's wall but not snapped to the same corners gets no offer | Corners snap to vertices and wall lines first (decision 2); the offer needs the same segment because `setWallKind` does, and a near miss is the `openings` check's to name |
| The live sector while offers are pending reads as done | The view says `offers` is non-empty; the shell must show the offers as a blocking row (ED3D.5b); undo and `cancel` take the sector away |
| A tool controller and `PlanController` both write the camera | Neither does from a tap; only `PlanController` pans and zooms, the tool reads the view store's camera |
