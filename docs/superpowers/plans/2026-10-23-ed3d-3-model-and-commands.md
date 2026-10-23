# ED3D.3 Model and commands: TDD plan

- **Task:** ED3D.3. [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §4.2 (document and selection), §5.3 flows 2, 3 and 5 (draw a sector, edit a sector or wall, retexture), §5.4 (commands), §12 (the unit layer) and the model half of acceptance cases ED3-b, ED3-c, ED3-d, ED3-e, ED3-m. The level model, the selection ids, the view state and the sector, corner and wall edits, each one undo step on the kit's `History` and `Selection`, with no DOM and no Svelte.
- **Lane:** editor-3d. **Depends on:** ED3D.1 (merged), ED3D.1b (PR #129: `LevelProfile`, both profiles, the registry) and EDK.2 (PR #109: `History`, `Selection`, the command registry and the keymap). Branch `claude/project-thread-ljshus-ed3d-3` is stacked on #129's branch with the kit's EDK.2 branch merged in (`main` merged through #127's head). Nothing here needs EDK.3 (gestures) or EDK.4 (widgets); the views and tools that call these edits are ED3D.4 to ED3D.6.
- **Status:** Drafted 2026-10-23, built on the Orchestrator's go-ahead of 02:20 UTC (bus) and the coordinator's instruction of 07:47 UTC to keep going while #127 and #129 wait in the merge queue. Not reviewed; spec review (ED3D.0) is still open. Steps below are ticked only when their checks pass.
- **Progress:** 2 of 9 steps.

## Why this task exists

The views (ED3D.4), the app (ED3D.5) and the sector tools (ED3D.6) all do the same three things: ask the profile what the level is, change it, and keep what is selected honest. Until there is one place that does the changing, each tool would write its own sector arithmetic, its own refusals and its own undo, and the Last Light and `af-sector/1` levels would need a copy each. This task builds that place once, headless: a level editor object (the kit's `History` over the level, a `Selection`, a view store), and the edits the spec's §5.4 lists for sectors and walls as pure functions of the level that either answer with the new level or refuse with a sentence.

## Sources, read at these commits

- **The Last Light, `mcthaydt/PixiJS3D_Experiment_001` at `92e6704`:** `editor/src/server/level-edits.ts` (`addRoom`, `removeRoom`, `roomReferences`: the refusals and their sentences) and `editor/tests/level-edits.test.ts` (their cases). Its edits are text edits that talk to the policy layer and a visibility file; here they are model edits and the codec writes the text.
- **AF:** `profile/level-profile.ts` and both profiles, `format/sector.schema.ts`, `checks/check.ts` (selection id helpers), `checks/overlap.ts`, `geometry/sectors.ts`; the kit's `history/history.ts`, `selection/selection.ts`, `commands/command.ts` and `keymap/keymap.ts` on EDK.2.

## Scope

**In:** `packages/editor-kit` gets a shell-free `./core` entry (a change request the spec's §4 allows, the same move the 2D lane made with `./fields`); `src/model/` in `editor-3d` (selection references, level state, view store, the level editor, the edit protocol, sector, corner and wall edits, the key-bound commands); `SectorAccess` on `LevelProfile`, implemented for both profiles.

**Out, with where each goes:**

| What | Where |
|---|---|
| `sector.split`, `sector.merge`, inserting a corner into a wall (the neighbour's wall that a new room only partly touches must be split before the portal pair can match) and the portal-accept flow of §5.3 flow 2 | **ED3D.6**, with the Split, Merge and portal tools whose rules they are (which loop is cut, which side keeps the id). For Last Light the corner insert also renumbers `wall:<room>/<i>` references, which belong to the things model |
| `thing.*` and the entity half of `sector.remove`'s references, Last Light's lamp, hotspot, anchor, zone and nav edits (spec §12 lists their `level-edits` cases here) | **ED3D.7** (and ED3D.1b2 for the typed definitions they read). They are edits of things, not of sectors, and need the entity model |
| `def.*` | ED3D.13 |
| `wing.move`, `join.set`, `join.remove`, `lock.set` | ED3D.9 |
| A camera zone and a visibility group for a new Last Light room (`addRoom` makes both) | ED3D.7: zones are things; here a new room joins the zone of the sector it is drawn like, or the first zone |
| Checking texture ids against `materials`, entity validity | ED3D.2b; the edits here only refuse what would not build or what is plainly malformed |
| The views, tools, gestures, autosave, storage | ED3D.4 to ED3D.6, EDK.3 to EDK.5 |

## Decisions this plan makes (each vetoable by the Owner through the Orchestrator)

1. **The `History` state is `{ level }`, and the view is a store beside it.** Spec §4.2 puts `view` in the state too, but the kit's `History` records every change of state as an undo step, and §4.2 also says view changes are not undo steps. `facility` joins the state with ED3D.9. The view store has the spec's content (mode, active layer, hidden and locked layers, camera, grid).
2. **An edit is a value, not a kit `Command`.** The kit's `Command` has no arguments (`run(): void`, closing over the editor), while `sector.moveCorner` needs a sector, a corner and a point. So §5.4's ids name *edits*: `{ id: 'sector.moveCorner', label, run(profile, level) }`, run by `editor.run(edit)` as one step, or inside an `editor.begin(label)` session for a drag (live while open, one step on commit, nothing on cancel). The kit `Command`s are the ones bound to a key or a button with no arguments: undo, redo, delete the selection, duplicate the selection, the view modes.
3. **An edit answers `{ ok: true, level, select? }` or `{ ok: false, reason, at? }`.** A refusal changes nothing and records nothing; `reason` is a sentence for the toast (Last Light's own where it has one: `the new room overlaps yard`), and `at` is the selection id it concerns so the view can frame it (the sector that was overlapped).
4. **`LevelProfile` gains `sectors: SectorAccess<D>`:** `list` the sectors in file order, `withSectors` the level with other sectors in their place (nothing else in the file changes), `takenIds` (a Last Light room may not reuse an opening's id), `create` a sector for a drawn outline with the members the format requires, and `references` (what still names or stands in a sector). The edits are written once over `EditSector`, the members both formats share (`id`, `floor`, `ceiling`, `light`, `open`, `style`, the three textures, `corners`, `holes`); a member the edit does not know is carried through by spreading. Nothing in `model/` names a Last Light concept: Last Light's `zone` is read and written inside its own access object.
5. **A wall is an object while an edit changes it.** A corner's third member is a wall object, a name (Last Light's spelling of a cutaway group, `"west"` for `{ cut: "west" }`), or absent. Wall edits read it as an object and write it back the way the corner was spelled (a name stays a name while only the group is left; an empty wall leaves the corner as `[x, z]`). `af-sector` cannot hold a name and refuses to write one.
6. **Numbers are rounded to four decimals** in every edit, as the codec prints them (spec §4.5), so the model an edit makes is the model a save reads back.
7. **Selection follows the document.** After every change of the level (an edit, an undo, a redo, a commit) the selection drops the sector and wall ids that no longer exist; `select` on an edit result replaces the selection (a new sector is selected). Entity ids are left alone until the entity model exists (ED3D.7).
8. **`wall.setHeight` is folded into the wall features it meant:** a door's `height` (`wall.setDoor`), a window's `y0` and `y1` (`wall.setWindow`), a portal mask's `maskTop` and a handrail's height (`wall.setFlags`). The spec names no member called height on a wall.
9. **Moving a corner moves what shares it through a portal.** A corner of a portal wall moves the matching corner of the wall that runs back over it in the sector on the other side (§5.3 flow 3), one hop; a corner that joins other sectors only by lying on the same point is not moved (the checks report a gap). Moving a whole sector moves only that sector; its portals are then unmatched, and `openings` says so.

## Contract

```
packages/editor-kit/package.json            "./core": "./src/core/index.ts"
packages/editor-kit/src/core/index.ts       the shell-free exports: createHistory, createSelection, createCommandRegistry,
                                            defineCommand, createKeymap, shortcut helpers and their types
packages/editor-3d/src/model/selection-ref.ts   SelectionRef, parseSelection (the writers stay in checks/check.ts)
packages/editor-3d/src/model/level-state.ts     LevelState
packages/editor-3d/src/model/view-store.ts      ViewMode, ViewState, ViewStore, createViewStore, initialView
packages/editor-3d/src/model/sector-access.ts   EditCorner, EditSector, SectorAccess, SectorDraft
packages/editor-3d/src/profile/af-sector/af-sectors.ts   afSectorAccess
packages/editor-3d/src/profile/last-light-sectors.ts     lastLightSectorAccess
packages/editor-3d/src/model/edit.ts            Edit, EditResult, refuse, ok
packages/editor-3d/src/model/level-editor.ts    LevelEditor, EditSession, createLevelEditor
packages/editor-3d/src/model/polygon.ts         simple-polygon test, signed area
packages/editor-3d/src/model/sector-edits.ts    addSector, removeSector, duplicateSector, setHeights, setLight, setMaterials
packages/editor-3d/src/model/corner-edits.ts    moveCorner, moveSector
packages/editor-3d/src/model/wall-edits.ts      setWallKind, setDoor, setWindow, setWallMaterial, setWallFlags
packages/editor-3d/src/model/edit-commands.ts   registerEditCommands (kit Commands bound to the editor)
```

```ts
export type SelectionRef =
  | { kind: 'sector'; sector: string }
  | { kind: 'wall'; sector: string; corner: number }
  | { kind: 'entity'; definition: string; id: string }
export function parseSelection(id: string): SelectionRef | undefined       // the inverse of sectorSelection, wallSelection, entitySelection

export interface LevelState<D> { readonly level: D }

export type ViewMode = 'plan' | 'split' | 'dollhouse' | 'walk' | 'world'
export interface ViewState {
  readonly mode: ViewMode
  readonly layer: string                          // 'sectors' | 'walls' | 'things:<definition>'
  readonly hidden: readonly string[]
  readonly locked: readonly string[]
  readonly camera: { readonly x: number; readonly z: number; readonly zoom: number }
  readonly grid: { readonly step: number; readonly snap: boolean }
}
export interface ViewStore { readonly state: ViewState; set(change: Partial<ViewState>): void; toggle(list: 'hidden' | 'locked', layer: string): void; subscribe(listener: (state: ViewState) => void): () => void }

export type EditCorner = readonly [number, number, (string | EditWall | undefined)?]    // EditWall: WallDef plus an optional preset
export interface EditSector { readonly id: string; readonly floor: number; readonly ceiling: number; readonly light: number; readonly open?: boolean | undefined; readonly style?: string | undefined; readonly floorTexture?: string | undefined; readonly ceilingTexture?: string | undefined; readonly wallTexture?: string | undefined; readonly trim?: PartialTrim | undefined; readonly corners: readonly EditCorner[]; readonly holes?: readonly (readonly EditCorner[])[] | undefined }
export interface SectorDraft { readonly id: string; readonly corners: readonly (readonly [number, number])[]; readonly floor: number; readonly ceiling: number; readonly light: number; readonly like?: EditSector | undefined }
export interface SectorAccess<D> {
  list(doc: D): readonly EditSector[]
  withSectors(doc: D, sectors: readonly EditSector[]): D        // throws SectorAccessError for a wall the format cannot hold
  takenIds(doc: D): readonly string[]
  create(doc: D, draft: SectorDraft): EditSector
  references(doc: D, id: string): readonly string[]
}

export type EditResult<D> = { readonly ok: true; readonly level: D; readonly select?: readonly string[] | undefined } | { readonly ok: false; readonly reason: string; readonly at?: string | undefined }
export interface Edit<D> { readonly id: string; readonly label: string; readonly coalesce?: string | undefined; run(profile: LevelProfile<D>, level: D): EditResult<D> }

export interface EditSession<D> { readonly open: boolean; run(edit: Edit<D>): EditResult<D>; commit(): void; cancel(): void }
export interface LevelEditor<D> {
  readonly profile: LevelProfile<D>
  readonly history: History<LevelState<D>>
  readonly selection: Selection<string>
  readonly view: ViewStore
  readonly level: D
  run(edit: Edit<D>): EditResult<D>
  begin(label: string): EditSession<D>
}
export function createLevelEditor<D>(options: { profile: LevelProfile<D>; level: D; now?: () => number }): LevelEditor<D>
```

The edits (each `(args) => Edit<D>`): `addSector({ id, corners, like?, floor?, ceiling?, light? })`, `removeSector({ id })`, `duplicateSector({ id, offset: { x, z }, newId? })`, `setHeights({ id, floor?, ceiling? })`, `setLight({ id, light })`, `setMaterials({ id, style?, floorTexture?, ceilingTexture?, wallTexture? })` (a `null` clears one), `moveCorner({ sector, corner, x, z })`, `moveSector({ id, dx, dz })`, `setWallKind({ sector, corner, kind, to? })`, `setDoor`, `setWindow`, `setWallMaterial`, `setWallFlags`.

## Steps (strict TDD: failing test first, then the minimal change; tick a step when its checks pass)

- [x] **1. The kit's shell-free `./core` entry, and the package's dependency on it** (`packages/editor-kit/src/core/core.test.ts`, `packages/editor-3d/src/model/kit-entry.test.ts`; `src/core/index.ts`, both `package.json` files).
  - *Red, by case:* `import * as core from './index'` exposes exactly `createHistory`, `HistoryError`, `createSelection`, `createCommandRegistry`, `defineCommand`, `createKeymap`, `normalizeShortcut`, `parseShortcut` and no `EditorShell`; every file the entry reaches through relative imports is a `.ts` file with no `svelte` import; editor-3d loads `@mcthaydt/automata-editor-kit/core` under Node and a history and a selection from it do their job.
  - *Expected failure:* the entry and the dependency are missing.
  - *Done 2026-10-23:* red for the missing entry (the kit test could not load `./index`), then green (kit: 5 tests in the touched files; editor-3d: 2 tests, `tsc` and biome clean). `src/core/index.ts` re-exports the same modules the root entry does, so nothing is duplicated; the root entry is unchanged. The kit's `package.json` gains `"./core"`, editor-3d gains the workspace dependency (one lockfile entry).
  - *Deviations:* the `src/model` purity layer is added with the first model source file (step 2), because the purity test refuses an empty layer.
- [x] **2. Selection references, level state, view store** (`selection-ref.test.ts`, `view-store.test.ts`; `selection-ref.ts`, `level-state.ts`, `view-store.ts`).
  - *Red, by case:* `parseSelection` reads `sector:hall`, `wall:hall/4`, `entity:crate/crate1` back into references, and `undefined` for `wall:hall`, `wall:hall/x`, `wall:hall/-1`, `wall:hall/1.5`, `entity:crate`, `sector:`, a kind it does not know, text with extra parts; for each of the three writers in `checks/check.ts`, `parseSelection(writer(...))` returns what was written; the initial view is Plan, layer `sectors`, nothing hidden or locked, grid 0.5 m with snap; `set` changes the members it names and tells the subscribers once, a `set` that changes nothing tells nobody; `toggle('hidden', 'walls')` adds, then removes; hiding and locking are separate lists; an unsubscribed listener hears nothing.
  - *Expected failure:* the modules are missing.
  - *Done 2026-10-23:* red for the missing modules, then green (`selection-ref` 24 cases, `view-store` 7; 721 tests in the package, `tsc` and biome clean). `parseSelection` is the strict inverse of the three writers (a part holds no `/` or `:`, a corner is a canonical whole number); the view store compares members as data and notifies once per real change. `src/model` is now a purity layer.
  - *Deviations:* `LevelState` has no test of its own (it is one interface; the editor's tests in step 4 use it). The view store compares members with `JSON.stringify` rather than a generic deep equal, so a member rewritten with its keys in another order counts as a change (one needless notification, never a missed one).
  - *Mutations (12 by hand over both modules):* all killed; the first run left two survivors in a hand-written deep equal (a length check and a key count that no typed input can reach), so the equal became the data comparison above and a test for a list that shrinks was added.
- [ ] **3. Sector access on both profiles** (`af-sectors.test.ts`, `last-light-sectors.test.ts`, `level-profile.test.ts` gains the member; `af-sectors.ts`, `last-light-sectors.ts`, `sector-access.ts`, `level-profile.ts`, both profiles).
  - *Red, by case:* for the depot and each of the four Last Light blockouts, `list` returns the sectors (rooms) in file order and `withSectors(doc, list(doc))` is the same document, member for member; `withSectors` with one sector changed leaves every other member of the level (`spawn`, `openings`, `entities`, `styles`, an unknown member) as it was, and patching the result through the codec changes only that sector's bytes; `takenIds` is the sector ids (Last Light: and the opening ids); `create` gives a sector with the members the format requires (AF: `id`, `floor`, `ceiling`, `light`, `corners`; Last Light: also the `zone` of `like`, else the first room's) and none it does not (no `style` unless `like` has one); AF `withSectors` refuses a corner whose wall is a name; `references`: AF reports the portals into a sector (`sector dock corner 3: a portal into hall`) and the entities standing in it (`entity crate1 stands in it`), none for an unreferenced sector; Last Light reports openings (`opening exitWay (corridor → yard)`), portals into the room, wall presets whose `next` names it, things standing in it (boxes, hotspots, lamps, anchors, nav nodes, bounce points, the spawn) and `on` references to its corners, with Last Light's own sentences (`room hall corner 12: a portal into ward`, `box filing stands in it`, `wall preset COUNTER: next counter`). `LevelProfile<AfSector>` is still assignable to `LevelProfile<unknown>`.
  - *Expected failure:* the modules are missing and the profiles have no `sectors`.
- [ ] **4. The level editor** (`level-editor.test.ts`; `edit.ts`, `level-state.ts`, `level-editor.ts`).
  - *Red, by case* (with small fake edits, so the protocol is tested apart from the sector rules): `run` applies an edit as one undo step labelled with the edit's label and answers its result; a refusal records nothing, changes nothing and tells no subscriber; an edit that returns the same level records nothing; `select` replaces the selection; undo and redo restore the level and the selection drops ids that are gone; a `begin` session shows each run live (`editor.level` changes, `history.revision` does not), `commit` records one step with the session's label, `cancel` restores the level at `begin`, a refusal inside a session leaves the live level as it was and the session open; a second `begin`, or `run`, while one is open answers a refusal with the reason (the kit throws `HistoryError`; the editor names it) and an undo while one is open cancels it; `coalesce` joins two runs inside the window (injected clock); `markClean` and dirty follow the kit; the view store is independent of undo.
  - *Expected failure:* the modules are missing.
- [ ] **5. Sector edits** (`sector-edits.test.ts`, `polygon.test.ts`; `polygon.ts`, `sector-edits.ts`).
  - *Red, by case:* **add** a rectangle to the depot: one new sector with the heights of `like` (else of the last sector, else 0 and 4 and 1), appended, selected; the refusals with their sentences: an id that is not `[A-Za-z][A-Za-z0-9_-]*` (`must be an id: …`), a taken id (`there is already a sector hall`; Last Light: `a room or opening`), fewer than three corners (ED3-m: `a sector needs at least three corners`), a repeated point, zero area, a crossing outline (`the outline crosses itself`), an overlap (ED3-d: `the new sector overlaps hall`, `at` is `sector:hall`; Last Light: the same cases as `addRoom`'s test on `clinic-dawn`: `overlaps yard`, `overlaps hall`), a ceiling less than 0.5 m over the floor; a clockwise outline is accepted as drawn; coordinates are rounded to four decimals. **remove**: a sector nothing references goes and is gone from the selection; one that is referenced is refused with `sector ward is still referenced: …` and the list, as Last Light's (`removeRoom` on `clinic-dawn`); adding then removing gives the original document. **duplicate**: copies at an offset with a fresh id (`hall2`), without its portals (`next` dropped, a door's `id` dropped), refused when it overlaps. **setHeights**: ED3-b (the hall's ceiling from 4.9 to 5.1 patches to exactly that number's span, undo restores the text), refusals for a ceiling under the floor + 0.5 and for non-finite numbers, coalesces on `heights:<id>`. **setLight**: positive only. **setMaterials**: sets and clears (`null`) the style and the three textures; an unknown style is refused with the engine's `unknown style x`.
  - *Expected failure:* the modules are missing.
- [ ] **6. Corner edits** (`corner-edits.test.ts`; `corner-edits.ts`).
  - *Red, by case:* `moveCorner` moves one corner of the outline, rounds, and leaves everything else; the corner of a portal wall also moves the matching corner of the reverse wall on the other side (the depot's hall corner 1 at (8, 0) moves the dock's corner 0 with it), both walls of the corner are looked at, and one hop only; a corner whose wall is a portal with no reverse moves alone; refusals: an unknown sector, a corner that is not an index of the outline, a non-finite point; a drag inside a session is one step; `moveSector` shifts the outline and the holes by an offset and nothing else, leaves the neighbour's portal in place (so `openings` fails and the locator names the wall: ED3-e's data), a zero offset records nothing.
  - *Expected failure:* the module is missing.
- [ ] **7. Wall edits** (`wall-edits.test.ts`; `wall-edits.ts`).
  - *Red, by case:* `setWallKind` to `door` and to `window` gives the wall a feature with sensible defaults for its length and the sector's height and removes `next` and the other feature (a name wall keeps its cutaway: `{ cut, door }`), to `solid` removes all three and keeps the texture and every other member, to `portal` needs `to` and sets both sides (`next` on the wall and on the reverse wall of that sector) in one step; refusals: a portal to the sector itself, to one that is not there, to one with no wall running back over the same segment; `setDoor` and `setWindow` merge their members and refuse a feature that does not fit the wall's length, a non-positive size, a window with `y0` not under `y1`, a feature on a wall that has none; `setWallMaterial` sets and clears `texture`; `setWallFlags` sets `handrail`, `frame`, `mask`, `block` and `maskTop`, with `frame`, `mask`, `block` and `maskTop` only on a portal wall; a corner written `[x, z]` gets a third member only when needed and loses it when the wall ends up empty; a wall that was a name stays a name when only its group is left (the Last Light file's spelling is kept); ED3-e: changing one side of a portal to solid fails `openings` and undo clears it.
  - *Expected failure:* the module is missing.
- [ ] **8. Key-bound commands and the public entry** (`edit-commands.test.ts`, `index.test.ts`; `edit-commands.ts`, `index.ts`).
  - *Red, by case:* `registerEditCommands(editor, registry)` registers `edit.undo` (`Mod+Z`), `edit.redo` (`Mod+Shift+Z`), `edit.delete` (`Delete`), `edit.duplicate` (`Mod+D`), `view.plan` (`1`), `view.split` (`2`), `view.dollhouse` (`3`) and `view.toggle` (`Tab`, plan and the 3D view), and returns the way to remove them all; each is disabled when it has nothing to do (undo with no history, delete with no sector selected) so its key falls through; through the kit keymap, `Mod+Z` undoes and `Mod+Shift+Z` redoes; `edit.delete` removes the selected sectors as one step (all or none: a refused one refuses the step, with the reason in the result of the underlying edit and the registry's command a no-op) and `edit.duplicate` copies the selected sectors beside themselves; view commands change the view and nothing in the history. The entry exports the editor, the edits, the model types and the access types, and keeps the test helpers out.
  - *Expected failure:* the modules are missing.
- [ ] **9. Gates and records.**
  - *Run in order:* `pnpm format`, `pnpm docs:stack` (commit if it changes), `pnpm check`, and the CI steps `pnpm check` skips (`pnpm build`, `pnpm api-index`, `pnpm agent-skills`, `pnpm api-report`; the kit's report gains the `./core` entry); hand mutation over the edits' refusals and the portal-reverse rule, listed here.
  - *Records:* master plan (02), continuation prompt (03) and the spec's task table in the docs follow-up PR once this merges; nothing ticked in 02 from this PR.

## Verification

Local, Node 24: the package's tests, the kit's unit project for `./core`, and `pnpm check`. The package has no browser or GPU suite, so parity and e2e are not selected. No sim code is touched, so no sim golden changes.

**Owner acceptance:** none of its own; ED3-b, ED3-c, ED3-d, ED3-e and ED3-m are judged on the built editor (ED3D.12) and the Owner's iPad pass.

## Risks and how the plan answers them

- **The kit's `package.json` and API report are the 2D lane's files.** The `./core` entry is one export line and one new report section; the 2D thread is told in one message, and a conflict in the generated report is cleared by regenerating it.
- **A profile shape that grows again.** `sectors` is the minimum the edits need; `entities`, `materials` and `hints` still join with their rows (ED3D.1b2, ED3D.8).
- **Stack depth.** This branch sits on #129 (itself on #127) and carries the kit's EDK.2 branch; each merges bottom-up. If a lower PR gets a merge from `main`, `main` is merged into this branch (no rebase). The PR's diff shows the kit's commits until the kit PRs merge.
