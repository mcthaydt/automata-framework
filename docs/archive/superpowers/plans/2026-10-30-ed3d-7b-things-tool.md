# ED3D.7b Things tool controller (headless): TDD plan

- **Task:** ED3D.7b, the second part of ED3D.7 (Things). [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §4.7 (things are instances of entity definitions; the palette lists the definitions), §5.2 (the Things layer has one sub-layer per definition the profile lists; a hidden layer is not drawn and not hit, a locked layer is drawn and not hit; a tool switches its layer on when picked), §5.4 (`thing.add`, `thing.move`, `thing.remove`, `thing.setField`, each one undo step), §6 (the Plan draws entities by their definition's colour and shape). The logic of the Plan view's Things tool as plain TypeScript. No Svelte, DOM, Pixi or clock.
- **Lane:** editor-3d. **Depends on:** ED3D.7a (#168: `addThing`, `moveThing`, `setThingField`, `removeThing`, `ThingAccess.takenIds`), ED3D.5a (#150: `PlanPointer`, the controller pattern), ED3D.4 (`planViewport`, `toScreen`, `toWorld`, `snapValue`, `stepOf`, `PICK_RADIUS`). All merged.
- **Status:** Drafted 2026-10-30. Steps are ticked only when their checks pass.
- **Progress:** 5 of 5 steps.

## Why this task exists

7a gave the model the four thing edits; nothing yet turns a pointer on the plan into them. As ED3D.5a did for Select and ED3D.6a for drawing, this task builds the meaning once, as a controller the view forwards pointer events to: the palette over the profile's definitions with each sub-layer's show and lock, what a pointer is over, where a tap would place the picked definition and whether the model would take it, a drag that moves a thing as one undo step, delete and set a field. The painting, the layers panel, the palette widget and the inspector form are ED3D.7d.

## Sources, read at these commits

- **AF (`main` at `5539433`):** `app/plan-controller.ts` (the pointer, the sector drag's grid-snapped offset and its session), `app/vertex-tool-controller.ts` (a dry run of the edit says what a tap would do), `app/sector-id.ts` (the lowest free id), `model/thing-edits.ts`, `model/view-store.ts` (`layer`, `hidden`, `locked`, the `things:<definition>` layer name), `view/plan/plan-pick.ts` (`PICK_RADIUS`), `entities/thing-def.schema.ts` (a box has a `size`, or float fields `w`, `h`, `d`), `checks/last-light/doors.ts` and `geometry/nav.ts` (a box stands centred on its `x` and `z`, `w` across x and `d` across z).

## Scope

**In:** `src/view/plan/thing-pick.ts` (pure: the thing under a pointer, over the sub-layers that are on), `src/things/things-tool-controller.ts` (the controller), `thingLayer` in `src/model/view-store.ts`, their tests, the purity test gains the `things` layer, and the package entry exports them.

**Out, with where each goes:**

| What | Where |
|---|---|
| Painting things, the palette and the layers panel, the inspector form from `FieldDef`s, DOM events | ED3D.7d |
| Camera zones and nav edges as things | ED3D.7c |
| `thing.rename`, Duplicate, the delete key and long-press menu | the selection commands with ED3D.7d and ED3D.11 |
| Panning on a drag over nothing | `PlanController` (the shell routes a drag the tool did not take to it) |

## Decisions this plan makes (each vetoable by the Owner)

1. **The controller lives in `src/things/`, not `src/app/`.** ED3D.5b is being built in `src/app/` at the same time; a new folder keeps the two from conflicting. It imports `PlanPointer` and follows the `app` controllers' shape; it can move into `app/` in a later tidy-up with no change to the entry. `src/things` is added to the pure layers of `purity.test.ts`.
2. **The palette is the definitions of the live level, in the profile's order,** one entry per definition: `{ def, label, shape, color, layer, hidden, locked }`, where `layer` is `thingLayer(def)` (`things:<def>`, the name the view store already documents) and `label` is the definition's label, else its id. It is recomputed when the level or the view changes (an `af-sector` file's `entityDefs` are part of the level).
3. **A sub-layer is off when it, or the whole `things` layer, is hidden or locked.** A thing on an off sub-layer is not hit, not hovered and not dragged. Placing on a hidden sub-layer is refused with `the <def> layer is hidden`, on a locked one with `the <def> layer is locked`; deleting or setting a field of a selected thing on an off sub-layer is refused the same way.
4. **`pick(def, values)` makes `def` the definition a tap places,** with the values a new one starts with (a required field has no default and the kit gives it no stand-in, so Last Light's hotspot, box and lamp place only with their required values given; without them the preview shows the values check's sentence), sets the view's `layer` to its sub-layer and takes the sub-layer (and `things`) off `hidden`, so the tool switches its layer on as spec §5.2 says; a locked layer stays locked. `pick(undefined)` places nothing. A definition that is not in the palette is refused with `no definition <def>`, and the active one is dropped when its definition leaves the level.
5. **What is hit:** of the things on sub-layers that are on, a point within the pointer kind's `PICK_RADIUS` of the pointer, nearest first, then a box whose footprint (centred on `x`, `z`; the definition's `size` or the thing's `w` and `d`) is within that reach, nearest first. Points come first so a lamp or a hotspot inside a big box can still be picked. Of two at the same distance, the one later in the level's order (drawn on top).
6. **A tap on a thing selects it** (`additive` adds or takes off), whatever is picked in the palette; **a tap on nothing places** the picked definition, or clears the selection when nothing is picked (`additive` leaves it).
7. **The place of a new thing is the pointer rounded to the grid** (the fine data step with Shift, none with Alt, as the sector drag), not snapped to walls or corners: a thing on a wall line would be on the edge of its sector. `view.place` is that point with what a tap would do, from a dry run of `addThing` against the live level, so the preview and the model cannot disagree: `{ x, z, id, action: 'add' }` or `{ x, z, id, action: 'none', reason }` with the model's own sentence (`spawn allows one: …`, `entity crate2 is outside every sector`).
8. **The id of a new thing is `<def>N`, the lowest N from 1 that `takenIds` does not hold** (`crate2` beside the depot's `crate1`); `ThingsToolOptions.id` replaces it, as the Sector tool's option does. A placed thing is selected (the edit's own `select`). A floating thing takes the floor of its sector as its height (the edit's rule).
9. **A drag moves the thing under the press as one undo step,** labelled `Move <def> <id>`: an `EditSession`, the thing selected at the start, each move a `moveThing` to its starting place plus the pointer's offset from the press rounded to the grid (so a thing off the grid keeps its offset, as a sector does). A refused run keeps the last accepted place and shows the sentence until the next run is accepted. The drag commits at its end unless it was cancelled or ended where it began. A drag that starts on nothing is not taken (`view.gesture` stays `idle`), so the shell pans. An undo during the drag ends it.
10. **`remove()` takes the selected things out as one undo step** (`Remove <def> <id>` for one, `Remove N things` for more), all or nothing: the first refusal (`crate1 is still referenced: …`, a locked layer) cancels the step and is the answer and `view.refusal`. With no thing selected it answers `select a thing first`. Non-thing ids in the selection are left alone.
11. **`setField(field, value)` sets a field of the one selected thing** through `setThingField` (`null` clears it) and answers its sentence, or nothing when it went in; with no thing or more than one selected it answers `select one thing first`. Scrubbing coalesces through the edit's own key.

## Contract

```
packages/editor-3d/src/model/view-store.ts               thingLayer
packages/editor-3d/src/view/plan/thing-pick.ts           pickThing, ThingHit, isThingLayerOff
packages/editor-3d/src/things/things-tool-controller.ts  createThingsTool, ThingsTool, ThingsToolView, ThingsToolOptions,
                                                         PaletteEntry, ThingPlace
packages/editor-3d/src/index.ts                          the public entry gains them
```

```ts
export const thingLayer = (def: string): string => `things:${def}`

export interface ThingHit {
  readonly def: string
  readonly id: string
  readonly selection: string   // entity:<def>/<id>
  readonly at: Point           // the thing's place
  readonly distance: number    // pixels from the pointer to the point or the box's footprint
}
export function isThingLayerOff(options: Pick<PickOptions, 'hidden' | 'locked'>, def: string): boolean
export function pickThing(kit: EntityKit, viewport: Viewport2D, at: ScreenPoint, options: PickOptions): ThingHit | undefined

export interface PaletteEntry {
  readonly def: string; readonly label: string; readonly shape: ThingShape; readonly color: string | undefined
  readonly layer: string; readonly hidden: boolean; readonly locked: boolean
}
export type ThingPlace = Point & { readonly id: string } &
  ({ readonly action: 'add' } | { readonly action: 'none'; readonly reason: string })
export interface ThingsToolView {
  readonly palette: readonly PaletteEntry[]
  readonly active: string | undefined
  readonly hover: ThingHit | undefined
  readonly place: ThingPlace | undefined      // only with a definition picked and no thing under the pointer
  readonly gesture: 'idle' | 'move'
  readonly refusal: string | undefined
}
export interface ThingsToolOptions { readonly id?: ((def: string, taken: readonly string[]) => string) | undefined }
export interface ThingsTool {
  readonly view: ThingsToolView
  subscribe(run: () => void): () => void
  pick(def: string | undefined, values?: FieldValues): string | undefined
  hover(at: PlanPointer): void
  leave(): void
  tap(at: PlanPointer): void
  dragStart(press: PlanPointer, at: PlanPointer): void
  drag(at: PlanPointer): void
  dragEnd(at: PlanPointer, cancelled: boolean): void
  remove(): string | undefined
  setField(field: string, value: FieldValue | null): string | undefined
  resize(size: Size): void
  dispose(): void
}
export function createThingsTool<D>(editor: LevelEditor<D>, canvas: Size, options?: ThingsToolOptions): ThingsTool
```

## Steps

Tests use the depot (`af-sector/1`: the hall from (0, 0) to (8, 6), the dock from (8, 0) to (14, 6); a spawn at (1, 1) and a 1 m crate `crate1` at (11, 2)) on an 800 by 400 px canvas with the camera at (7, 3), zoom 1 (32 px to a metre), and the Last Light toy blockout and clinic for the fixed definitions (boxes sized by their own `w` and `d`, floating hotspots and lamps, a floor nav node).

- [x] **1. The sub-layer name and the thing pick** (`model/view-store.test.ts`, `view/plan/thing-pick.test.ts`; `model/view-store.ts`, `view/plan/thing-pick.ts`).
  - *Red, by case:* `thingLayer('crate')` is `things:crate`; a point is hit within the reach of each pointer kind and not past it (the boundary is in); a box is hit inside its footprint and within the reach of its edge, sized by the definition's `size` or by the thing's `w` and `d` (a Last Light box); a point wins over a box that holds the pointer; of two the nearest, and of two at one distance the later; a thing whose sub-layer or `things` is hidden or locked is not hit, and the others still are; the hit names its selection id.
  - *Expected failure:* `thingLayer` and the module are missing.
  - *Done 2026-10-30:* red (`thingLayer` not a function; the module missing), then green (20 tests over the two files; `tsc` clean). A box with no size to measure (no `w` and `d`) is hit as a point at its centre.
- [x] **2. Palette, hover and placing** (`things/things-tool-controller.test.ts`; `things/things-tool-controller.ts`).
  - *Red, by case:* the palette lists the depot's `spawn` and `crate` with their sub-layers and follows `hidden` and `locked` in the view store, and a Last Light level lists its fixed six; `pick` sets `active` and the view's `layer`, takes the sub-layer off `hidden` and keeps a lock, and refuses an unknown definition; a hover over a thing is `hover` and no `place`; a hover on nothing with a definition picked is a `place` at the grid point (Shift fine, Alt free) with the id and `add`, and `none` with the model's sentence where `addThing` refuses (a second spawn, outside every sector); a tap there adds the thing as one undo step and selects it, the next id is `crate3`; the option's id function replaces it; a tap on a hidden or locked sub-layer is refused with its sentence and adds nothing; a tap with nothing picked on nothing clears the selection (not with `additive`); a tap on a thing selects it and with `additive` toggles it; a Last Light hotspot placed floats at its sector's floor; `view` is the same object when nothing changed; `leave` clears the hover and the place; a camera change moves what a hover is over; dropping the active definition when the level loses it.
  - *Expected failure:* the module is missing.
  - *Done 2026-10-30:* red (the module missing, no tests ran), then green (32 tests; `tsc` clean). The place preview also says a hidden or locked sub-layer's sentence; `pick` takes the starting values (decision 4), and a Last Light hotspot without its required values is refused in the values check's sentence.
- [x] **3. Moving by drag** (same files).
  - *Red, by case:* a drag from a thing moves it by the grid-rounded offset as one step labelled `Move crate crate1`, selected from the start, `gesture` is `move` during it; a thing off the grid keeps its offset; a run out of every sector is refused, the thing stays at the last accepted place and the sentence shows, and clears on the next accepted run; a cancelled drag and a drag back to the start leave no step; a drag from nothing is not taken; a drag on a locked sub-layer is not taken; an undo during the drag ends it; a floating thing keeps its height.
  - *Expected failure:* `dragStart` does nothing.
  - *Done 2026-10-30:* red (`tool.dragStart is not a function`, 9 failing), then green (41 tests; `tsc` clean). Ending a drag clears its sentence, as the plan controller's does; a drag does not start while another step is open.
- [x] **4. Delete and set a field** (same files).
  - *Red, by case:* `remove` takes the selected thing out as one step and the selection drops it; two selected are one step `Remove 2 things`; a referenced thing is refused with the edit's sentence and nothing goes (with two selected, neither goes); nothing selected answers `select a thing first`; a thing on a locked sub-layer is refused; `setField` sets the one selected thing's field as one step, clears it with `null`, answers the edit's sentence for a value that does not fit, and `select one thing first` for none or two; scrubbing a field coalesces into one step through the edit's key.
  - *Expected failure:* `remove` and `setField` do nothing.
  - *Done 2026-10-30:* red (`remove` and `setField` not functions, 12 failing), then green (53 tests; `tsc` clean). One thing is removed in a session labelled with the edit's own label, more in one labelled `Remove N things`; a second session open makes `remove` answer the history's sentence. Hand mutation over both steps and step 1 (13 mutants: the unhide of `things`, the commit rule, the refusal of a drag run, a point over a box, the later of a tie, the cancel of a refused removal, the additive clear, the undo during a drag, the layer sentence of the preview, dropping a lost definition, the one-thing rule, the layer rule of a field, the selection at a drag's start): all killed after one test was added (a box before a point in the level's order).
- [x] **5. Entry, gates and records.**
  - *Done 2026-10-30:* the entry exports `createThingsTool`, `PaletteEntry`, `ThingPlace`, `ThingsTool`, `ThingsToolOptions`, `ThingsToolView`, `pickThing`, `isThingLayerOff`, `ThingHit` and `thingLayer` (asserted in `index.test.ts`); `purity.test.ts` covers `src/things`. Gates on the head merged with `origin/main` (`30e9606`): `pnpm format`, then lint, typecheck (36 of 36), boundaries, style, knip and unit tests (34 of 34; `editor-3d` 2446 tests) with `TURBO_FORCE=true`, `TURBO_CONCURRENCY=2`, `VITEST_MAX_WORKERS=2`, all exit 0; `changeset status` and `check-changesets` clean; no changeset (private package). First attempts under shared-machine load failed only in untouched packages, kept as evidence: `automata-game` `default-screens.test.ts` hook timeout and `editor-kit` vitest workers that did not start (each passed alone), then `automata-runtime` typecheck killed (exit 137, memory). Selected: unit, typecheck, lint, boundaries, style, knip; omitted: browser, layout and GPU suites (no DOM or painting); pending: hosted CI.
  - *Run in order:* `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm api-report` (no change: `editor-3d` is private), `pnpm changeset status --since=origin/main`, `node tooling/release/src/check-changesets.ts`; the entry exports the new names (asserted in `index.test.ts`) and `purity.test.ts` covers `src/things`.

## Verification

Local, Node 24: the package's focused tests while iterating, then `pnpm check`. No browser or GPU suite is selected (no DOM, no painting, no sim code). How placing and dragging feel under a Pencil and a finger is judged on the built editor (ED3D.7d, ED3D.11).

## Risks

| Risk | Mitigation |
|---|---|
| The tool and `PlanController` both answer a drag | The tool takes a drag only from a thing; `gesture` says whether it did, and the shell gives the rest to the plan controller |
| A preview that says `add` and a tap that is refused | The preview is the dry run of the very edit the tap runs, against the same live level |
| Moving the controller into `src/app/` later breaks importers | The package entry is the only importer outside the package; its names do not change |

## Execution log

- 2026-10-30, `023caea` to the head: the plan; steps 1 and 2 (`9bbcebf`); steps 3 to 5 (`5ab45d6`); a merge of `origin/main`. Deviations: `ThingPickOptions` was dropped for the plan pick's own `PickOptions`; `pick` takes the starting values (decision 4).
- 2026-10-30, review of #231 (coordinator), test-first: `pick` with the whole Things layer hidden shows only the picked sub-layer and hides the others' one by one (it used to show them all); every refusal reaches `view.refusal` (an unknown definition in `pick`, a drag that cannot start while another step is open, and a stale drag sentence is cleared when an undo ends the drag); a drag ends and keeps nothing when its sub-layer is hidden or locked during it, with the layer's sentence; `lowestFreeId` takes a prefix and names new things, `isThingLayerOff` backs the palette and the layer sentences, and `gridRounded` (`view/plan/plan-snap.ts`) is the one rounding of the plan controller's sector drag and the Things tool. New tests also pin Shift placing at the centimetre off the grid and a tap over a thing on a locked sub-layer placing a new thing.
