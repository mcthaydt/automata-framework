# ED3D.6b Wall tools (portal, door, window): TDD plan

- **Task:** ED3D.6b, the second part of ED3D.6 (sector tools). [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §5.3 flow 3 (edit a wall: select it, then set it), §5.4 (`wall.setKind`, `wall.setDoor`, `wall.setWindow`: each a single transaction), §6 (the Plan is the only view that adds geometry) and the ED3D.6 row (sector tools: draw, vertex, portal, door, window). The logic of the Plan view's Portal, Door and Window tools as plain TypeScript: a tap on a wall makes it a portal into the sector that lies behind it, or puts a door or a window on it where the tap is, or moves the one that is there. No Svelte, DOM, Pixi or clock.
- **Lane:** editor-3d. **Depends on:** ED3D.6a (PR #155: `portalOffers`, the controller pattern), ED3D.5a (PR #150: `PlanPointer`), ED3D.4 (PR #148: `wallNear`, `planViewport`, `selectionOf`) and ED3D.3 (PR #137, in main: `LevelEditor`, `setWallKind`, `setDoor`, `setWindow`). Branch `claude/project-thread-ljshus-ed3d-6b` is stacked on ED3D.6a's branch.
- **Status:** Drafted 2026-10-23 on the hub's instruction (bus 1242: start ED3D.6, sector tools as plain-TypeScript controllers) to keep going while the stack waits in the merge queue. Not reviewed; spec review (ED3D.0) is still open. Steps below are ticked only when their checks pass.
- **Progress:** 1 of 4 steps.

## Why this task exists

The edits that make a wall a portal, a door or a window exist since ED3D.3, but nothing turns "the pointer is on this wall, here" into one of them: which wall the pointer means (the nearest, or the side of two that lie on one line), where along it a door goes (snapped, and kept inside the wall), and what a tap does when the wall already has the thing or cannot take it. Done in a Svelte view that is only testable in a browser, each of those would be re-derived. This task builds the meaning once, as one controller for the three tools, the way ED3D.5a did for Select and ED3D.6a for Sector. The vertex tool, `sector.split` and `sector.merge` need new model edits (a split wall splits its reverse) and are the next part.

## Sources, read at these commits

- **AF (this stack):** `view/plan/plan-pick.ts` (`wallNear`: the nearest wall within the pointer kind's reach, and the point of it nearest the pointer; `isLayerOff`), `view/plan/plan-viewport.ts` (`snapStep`: 5 cm, 1 cm with Shift, none with Alt; `snapValue`), `model/wall-edits.ts` (`setWallKind` makes a portal on both sides and takes `door` and `window` off the wall it makes a portal; `setDoor` and `setWindow` refuse a feature that does not fit, with a sentence; both measure `at` from the wall's start corner in the document's order), `model/wall-geometry.ts` (`cornerAt`, `wallLength`, `wallOver`), `model/portal-offers.ts` (ED3D.6a: the per-wall rule `portalOffers` applies), `app/sector-tool-controller.ts` and `app/plan-controller.ts` (the geometry cache, the session pattern, `PlanPointer`).

## Scope

**In:** `src/model/portal-offers.ts` gains `wallPortal` (the per-wall answer `portalOffers` is built from) and `src/app/geometry-cache.ts` (the by-identity geometry cache the three plan controllers each wrote), `src/app/wall-tool-controller.ts` (under the purity test) and their tests; the package entry exports them; the three controllers use the cache.

**Out, with where each goes:**

| What | Where |
|---|---|
| Painting the wall under the pointer, the position tick, the tool strip and DOM events | ED3D.5b and ED3D.11 |
| The vertex tool (add and remove a corner), `sector.split`, `sector.merge` | the next part of ED3D.6 (they need new edits) |
| Dragging a door along its wall, resizing it, its height and the window's bottom and top | the inspector (ED3D.5c) calls `setDoor` and `setWindow`; a drag handle is ED3D.11 |
| Taking a portal back to solid with a tap | the inspector's `wall.setKind` (ED3D.5c); the tool never makes the wall less than it is |
| Whether a tool in a hidden or locked `walls` layer is refused | the shell switches the layer on when a tool is picked (spec §5.2); the tool only skips walls it may not hit, as picking does |

## Decisions this plan makes (each vetoable by the Owner through the Orchestrator)

1. **One controller, three kinds:** `createWallTool(editor, canvas, { kind })` with `kind` of `'portal' | 'door' | 'window'`. The three differ in what a tap runs and what `view.target` says, and share which wall the pointer means, so a tool switch is a new controller or a new `kind`, whichever the shell likes; each controller is cheap.
2. **The wall is `wallNear`'s,** within `PICK_RADIUS[kind]` pixels, on the document's own wall ref (`wall:<sector>/<corner>`); a wall that nothing selects (an opening's connector), a hole's wall and a wall in a hidden or locked `walls` layer are not answered. The tool does not take a sector fill: only a wall can take any of the three.
3. **Where along the wall:** metres from the wall's start corner as the document writes it (the measure `setDoor` and `setWindow` use), the point of the wall nearest the pointer, rounded to `snapStep` (5 cm; Shift 1 cm; Alt exact) and kept within `0..length`. `target.point` is the world point at that distance, for the view to paint a tick at.
4. **A tap with the Door or Window tool** runs in one `EditSession`, so it is one undo step: on a wall without the feature it makes the wall that kind (`setWallKind`: the profile's default size, centred), then `setDoor` or `setWindow` with `at` kept so the whole feature lies on the wall (`width / 2 .. length - width / 2`, the width the new feature has); on a wall that has it, only the second. A refusal (the model's sentence: it does not fit) cancels the session and is in `view.refusal`. The wall is selected after a tap that changed it.
5. **A wall that is a portal takes no door or window from the tool.** `setWallKind` would drop the portal on this side and leave the other side leading into nothing, which the `openings` check reports; a tap is too easy a way to do that, so the tool refuses with `that wall is a portal into <sector>: make it solid first` and the inspector's kind switch (ED3D.5c) is where that is done on purpose.
6. **The Portal tool asks the model:** `wallPortal(profile, level, sector, corner)` answers `offer` (another sector has a wall over the same segment, its reverse leads nowhere or here), `done` (both sides already lead into each other), `taken` (the wall over it leads into a third sector) or `none`. A tap on an `offer` makes the portal on both sides (`setWallKind`, one step); the other three answers are sentences in `view.refusal` and change nothing. `portalOffers` (ED3D.6a) is rebuilt on `wallPortal` with its behaviour unchanged, its ten tests as the guard.
7. **`view.target` says what a tap would do,** so the view can paint it before the tap: `{ sector, corner, selection, length, along, point, action, to?, reason? }` with `action` one of `'place'` (no feature yet), `'move'` (a feature is there), `'portal'` (an offer; `to` is the sector it leads into) or `'none'` (with `reason`, the sentence a tap would give). It is nothing when no wall is within reach.
8. **The geometry cache is shared.** ED3D.5a and ED3D.6a each wrote the by-identity cache of `geometry(level)` and the selection ids; a third copy is one too many, so it moves to `app/geometry-cache.ts` and the three controllers use it. Their tests are the guard; nothing observable changes.

## Contract

```
packages/editor-3d/src/model/portal-offers.ts            wallPortal, WallPortal (portalOffers rebuilt on it)
packages/editor-3d/src/app/geometry-cache.ts             createGeometryCache, GeometryCache
packages/editor-3d/src/app/wall-tool-controller.ts       createWallTool, WallTool, WallToolView, WallTarget, WallToolKind, WallToolOptions
packages/editor-3d/src/index.ts                          the public entry gains wallPortal, WallPortal and the wall tool
```

```ts
export type WallPortal =
  | { readonly kind: 'offer'; readonly offer: PortalOffer }
  | { readonly kind: 'done'; readonly to: string }
  | { readonly kind: 'taken'; readonly to: string }
  | { readonly kind: 'none' }
export function wallPortal<D>(profile: LevelProfile<D>, level: D, id: string, corner: number): WallPortal

export type WallToolKind = 'portal' | 'door' | 'window'
export interface WallTarget {
  readonly sector: string
  readonly corner: number
  readonly selection: string
  readonly length: number          // metres
  readonly along: number           // metres from the wall's start, snapped
  readonly point: Point            // the world point at `along`
  readonly action: 'place' | 'move' | 'portal' | 'none'
  readonly to?: string             // action 'portal'
  readonly reason?: string         // action 'none'
}
export interface WallToolView { readonly target: WallTarget | undefined; readonly refusal: string | undefined }
export interface WallToolOptions { readonly kind: WallToolKind }
export interface WallTool {
  readonly view: WallToolView
  subscribe(run: () => void): () => void
  hover(at: PlanPointer): void
  leave(): void
  tap(at: PlanPointer): void
  resize(size: Size): void
  dispose(): void
}
export function createWallTool<D>(editor: LevelEditor<D>, canvas: Size, options: WallToolOptions): WallTool
```

## Steps

Tests use the depot (two sectors and a portal pair, a door and a window on its hall), small levels built beside it for one rule each, and the Last Light clinic for what a profile with no windows says.

- [x] **1. `wallPortal`** (`model/portal-offers.test.ts`; `model/portal-offers.ts`).
  - *Red, by case:* a wall with another sector's wall over it and nothing led anywhere is an `offer` with the same fields `portalOffers` gives; a wall whose two sides already lead into each other is `done` (and `to` is the neighbour); a neighbour wall that leads into a third sector is `taken` (`to` is the third); no wall over it is `none`; of two sectors over one wall the first that can take the portal is the offer, and a `done` or `taken` before it does not hide it; an offer is also given for a wall that leads into the neighbour while its reverse does not (completing the pair); a corner out of range and a sector that is not there are `none`.
  - *Expected failure:* `wallPortal` is not exported. The ten tests of `portalOffers` stay green through the rebuild.
  - *Done 2026-10-23:* red (`wallPortal` not a function, 7 failing), then green (18 tests in the file; `tsc` and biome clean; the ten `portalOffers` tests and the sector tool's 57 unchanged). `wallPortal` is the per-wall rule `portalOffers` had inline, returning the first neighbour over the segment that can take the portal as `offer`, else the reason of the first one that cannot (`taken` with where it leads, or `done`), else `none`; `portalOffers` now asks it for each corner. Hand mutation (16 mutants over the self skip, the early `break`, the taken and done conditions, the first-reason guard, the fields of the offer, the corner of the end point, the length and the early returns): all killed after one test was added (two blocked neighbours, the first one's reason is kept, with a taken then a done). Deviation: none.
- [ ] **2. Which wall, where along it, what a tap would do** (`app/wall-tool-controller.test.ts`; `app/wall-tool-controller.ts`).
  - *Red, by case:* `hover` over a wall gives `target` with the document's sector and corner, `length`, `along` snapped to 5 cm (1 cm with Shift, exact with Alt) and kept within the wall, and `point` at that distance; the hall's west wall read from the south end and from the north end (a loop written either way round measures from its own start); a pointer outside the kind's reach (finger 22, pen 12, mouse 8) gives no target; of two walls on one line the one of the sector the pointer is in; a hidden or locked `walls` layer, a connector wall and a sector fill give no target; `action` is `place` on a wall with no door, `move` on the hall's door wall with the Door tool, `place` for the Window tool on that wall, `move` on the hall's window wall; a portal wall gives `none` with `that wall is a portal into <sector>: make it solid first` for Door and Window; for Portal, `portal` with `to` on a wall that has an offer and `none` with the sentence of `done`, `taken` or `none` otherwise; `leave` clears; `resize` and a camera change in the view store move what a hover means; `view` is the same object when nothing changed; the target follows an edit (the level changes under it).
  - *Expected failure:* the module is missing.
- [ ] **3. Taps** (same files).
  - *Red, by case:* Door tap on a solid wall makes it a door at the snapped place, one history step labelled for the wall, the wall selected; kept inside the wall at both ends (a tap at 5 cm from the start puts the centre half the door's width in); a second tap elsewhere on the same wall moves the door (one step), a tap that leaves it where it is is no step; the Window tool the same with its own width; a wall shorter than the feature's own width refuses with the model's `does not fit` sentence, cancels the session, leaves the level and the history as they were; Door or Window on a portal wall changes nothing and says why; Portal tap on an offer makes both sides portals in one step with the reverse's door removed; on `done`, `taken` and `none` it changes nothing and says the sentence; a tap on no wall changes nothing and clears the sentence; the sentence clears on the next hover over another wall or the next successful tap; a closed session (another transaction open) refuses with the history's sentence and leaves nothing open; Last Light: a door tap works, a window tap shows the profile's sentence, a portal tap on a wall of a clinic room that has an offer works as in the depot.
  - *Expected failure:* `tap` does nothing.
- [ ] **4. Shared cache, entry, gates and records.**
  - *Run in order:* the cache moves to `app/geometry-cache.ts` and `plan-controller.ts`, `sector-tool-controller.ts` and the wall tool use it (every existing test green, then a test of the cache itself: the same object for the same level, a rebuild for a new level, empty layers on a `GeometryError`, other errors thrown); `pnpm format`, `pnpm docs:stack`, `pnpm check`, `pnpm build`, `pnpm api-index`, `pnpm cheatsheet`, `pnpm agent-skills --write` then `pnpm agent-skills`, `pnpm api-report`; hand mutation over each step's logic, listed on its step; the package entry exports the new names (asserted in `index.test.ts`), and `purity.test.ts` still holds for the `app` layer; the viewer artifact gets Portal, Door and Window tools: hover shows the wall, the tick and what a tap does, a tap does it.
  - *Records:* master plan (02), continuation prompt (03) and the spec's task table in the docs follow-up PR once the stack merges; nothing ticked in 02 from this PR.

## Verification

Local, Node 24: the package's tests and `pnpm check`. No browser or GPU suite is selected (no DOM, no painting, no sim code). How a tap finds a wall under a Pencil and a finger, and whether the tick reads well, are judged on the built editor (ED3D.11, ED3D.12).

## Risks

| Risk | Mitigation |
|---|---|
| A door tap near a corner puts the door across it | `at` is kept within `width / 2 .. length - width / 2`, and `setDoor` refuses what still does not fit, with a sentence |
| A tap on a portal wall silently breaks a pair | The tool refuses it (decision 5); the inspector is where a portal is made solid on purpose |
| The distance along a wall is read from the wrong end | It is measured from the document's start corner, the measure `setDoor` uses, and a test reads the same wall written both ways round |
| Moving the cache touches two merged-or-queued controllers | Their tests are the guard and the move is one commit with nothing observable changed |
