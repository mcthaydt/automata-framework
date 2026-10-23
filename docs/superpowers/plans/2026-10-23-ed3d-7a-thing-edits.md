# ED3D.7a Thing edits: TDD plan

- **Task:** ED3D.7, first part. [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §4.7 and §5.1 (things), §5.2 (the Things layer), §5.4 (commands: `thing.add`, `thing.move`, `thing.remove`, `thing.setField`). The model half of the Things layer: how a thing is written into a level of either format, and the four edits that put a thing in, move it, change a field of it and take it out, each one undo step on the level editor. No view, no tool, no inspector: those are ED3D.7b onward and ED3D.5.
- **Lane:** editor-3d. **Depends on:** ED3D.1b2 (PR #163: `Thing`, `EntityKit`, `LevelProfile.entities`, both formats' kits), ED3D.2b (PRs #164 and #166: the entity checks whose rules an edit must not break) and ED3D.3 (the level editor, `Edit`, `ThingAccess`'s sibling `SectorAccess`). Branch `claude/project-thread-39g5i1-ed3d-7a` is stacked on #166's branch (the tip of the entity line), so the PR stacks on #166 and retargets to `main` once its base merges.
- **Status:** Drafted 2026-10-23 16:20 UTC by the lane's successor thread, on the standing go-ahead to keep building while the stack waits (hub overnight mode, bus 0850). Not reviewed; spec review (ED3D.0) is still open. Steps below are ticked only when their checks pass.
- **Progress:** 4 of 4 steps (steps 1 and 2 done 2026-10-23 16:26 UTC, steps 3 and 4 and the gates 16:46 UTC). Implemented and locally checked; not CI verified, not reviewed, not merged.

## Why this task exists

A level editor that cannot place a prop, a lamp or a spawn is a sector editor. The kit and the checks already say what a thing is and when it is wrong (ED3D.1b2, ED3D.2b), but nothing writes one back: the Last Light fixed definitions note "both change only when a thing is written back, which is also ED3D.7's". The two formats keep things in very different places (AF sector: one `entities` list of `{ def, id, x, z, ... }`; Last Light: a `spawn` object, `boxes`, `hotspots` and `lamps` lists, and `anchors` and `nav.nodes` records keyed by id, with no `def` member), so as for sectors the editor needs one object per format that knows where a thing lives (`ThingAccess`) and one set of edits written once over it.

## Sources, read at these commits

- **The Last Light, `92e6704`:** the shapes of its arrays (`format/blockout.schema.ts` here, ported from `blockout-lib.ts`), `scripts/pipeline/blockout-lib.ts` `ids` (what names a box, a node or a wall: `on`, nav edges, the patrol), and the editor server's `level-edits.ts` (its add and remove of a lamp, hotspot or anchor as text edits; the refusals are the model's here, the text is the codec's).
- **AF (this stack):** `entities/things.ts` (`readEntityKit`, `Thing`), `profile/last-light-entities.ts` and `profile/af-sector/af-entities.ts` (the kits), `checks/entities.ts` (placement and `single`), `checks/entity-refs.ts` (ref fields), `profile/sector-access.ts` and `model/sector-edits.ts` (the pattern this copies), the kit's `./fields` (`valuesWithDefaults`, `checkValues`, `checkFieldValue`).

## Scope

**In:** `profile/thing-access.ts` (`ThingAccess`, `ThingAccessError`, the member-merge both formats use), `profile/af-sector/af-things.ts`, `profile/last-light-things.ts`, `LevelProfile.things`, `model/thing-edits.ts` (`addThing`, `moveThing`, `setThingField`, `removeThing`), the level editor dropping selections of things that are gone, the package entry, docs.

**Out, with where each goes:**

| What | Where |
|---|---|
| The Things layer, palette, tools and inspector (pointer, Pencil, the form for fields) | ED3D.7b onward and ED3D.5 (they call these edits) |
| `thing.rename` (an id change that rewrites every ref and `on` that names it) and Duplicate of a thing; delete and duplicate keys for a selected thing | ED3D.7b with the selection commands; a rename needs the refs found first, which `references` here gives |
| Last Light's zones and nav edges as things, and `nav edge add and remove` | ED3D.7c: a zone is an area and an edge joins two nodes, neither has the point a thing has |
| Definitions (`def.add`, `def.rename`, `def.setField`, `def.remove`) | ED3D.13 |
| The text of the write | the profile's codec: an edit answers a model, `patch` writes the bytes (so a file nobody changes stays byte-identical) |

## Decisions this plan makes (each vetoable by the Owner through the Orchestrator)

1. **`LevelProfile.things` is a `ThingAccess<D>`, written by each profile, like `SectorAccess`.** Reading stays `profile.entities(doc)`. A thing is found by its definition and id; ids do not change in an edit.
2. **A thing is written in the member order its file uses.** A replaced thing keeps its own members in their own order and changes only what the edit changed (`x`, `z`, `y`, field values), so a file that is read and written back unchanged is byte-identical and a changed one patches only the changed members. A new thing is written in the order of the formats' convention: AF `def, id, x, y, z, ...fields`; Last Light `id, x, y, z, ...fields` (no `def`), and for an anchor or a nav node the record entry `x, y, z, ...fields` keyed by the id.
3. **Rules an edit enforces are the rules the checks enforce,** so an editor that only uses these edits never makes a level the checks call broken: the id is an id (`^[A-Za-z][A-Za-z0-9_-]*$`, as sectors) and unused (`takenIds`: AF's entity ids are unique across definitions, Last Light's within a definition); a `single` definition allows one; the place is inside a sector (`sectorAt` of the built geometry; a hole is outside); the values are the definition's defaults completed by what the edit gives and then pass the kit's `checkValues`. A refusal is the kit's own sentence prefixed `entity <id>: ` where the kit has one (the entity check's wording), else a sentence of the editor's.
4. **`y`:** a `floor` thing has none and an edit that gives one is refused (`a crate rests on the floor and has no height`); a `free` thing takes the given `y`, else the floor of its sector on `add`, and keeps its own on `move`.
5. **A thing that cannot be read cannot be changed, but can be removed.** Move and set-field refuse it with the reader's first sentence; remove works on the raw entry, so the way to fix a broken thing is open. A format-owned member the level cannot do without is refused by the access (`ThingAccessError`): Last Light's `spawn` is required, so `remove` of it is refused, and `add` of a second is refused by `single`.
6. **Remove is refused while something names the thing** (`references`, as for sectors): AF, a ref field of another thing that points at it; Last Light, an `on` of the form `box:<id>` and, for a box, an opening's `door` and a nav edge's door; for a node, the nav edges and the patrol that name it. The sentence lists them.
7. **Selection:** `add` selects the new thing; after any change of the level the editor drops `entity:` selections of things the level no longer has, counting an unreadable thing as there (Locate may have selected it), while a selection of an unknown kind is still not judged.
8. **`coalesce`:** `moveThing` and `setThingField` close together on one thing are one undo step (`move:<def>/<id>`, `field:<def>/<id>/<field>`), as a sector's height field is.

## Contract

```
packages/editor-3d/src/profile/thing-access.ts                ThingAccess, ThingAccessError, mergeMembers
packages/editor-3d/src/profile/af-sector/af-things.ts         afThingAccess
packages/editor-3d/src/profile/last-light-things.ts           lastLightThingAccess
packages/editor-3d/src/profile/level-profile.ts               LevelProfile.things
packages/editor-3d/src/model/thing-edits.ts                   addThing, moveThing, setThingField, removeThing
packages/editor-3d/src/model/level-editor.ts                  reconcile drops gone entity selections
packages/editor-3d/src/index.ts                               the access type and the four edits
```

```ts
export interface ThingAccess<D> {
  /** Every id a new thing of `def` may not take. */
  takenIds(doc: D, def: string): readonly string[]
  /** `thing` at the end of its list or record; throws `ThingAccessError` for a definition the format has no place for. */
  add(doc: D, thing: Thing): D
  /** The thing `def`/`id` with the place and values of `thing`, in its own place in the file; `doc` itself when nothing differs. */
  replace(doc: D, def: string, id: string, thing: Thing): D
  /** Without the thing; throws `ThingAccessError` when the format cannot do without it (Last Light's spawn). */
  remove(doc: D, def: string, id: string): D
  /** Sentences for what still names the thing; empty when it can go. */
  references(doc: D, def: string, id: string): readonly string[]
}

export const addThing = <D>(args: {
  def: string; id: string; x: number; z: number; y?: number; values?: FieldValues
}): Edit<D>                                    // thing.add
export const moveThing = <D>(args: { def: string; id: string; x: number; z: number; y?: number }): Edit<D>   // thing.move
export const setThingField = <D>(args: { def: string; id: string; field: string; value: FieldValue | null }): Edit<D> // thing.setField, null clears
export const removeThing = <D>(args: { def: string; id: string }): Edit<D>   // thing.remove
```

## Steps

1. **[x] `ThingAccess` for `af-sector/1`.** Failing test first (`profile/af-sector/af-things.test.ts`, over the toy level and the depot): `add` appends `{ def, id, x, y, z, ...fields }` and the codec's `patch` of the old text to the new model inserts exactly that element; `replace` with the thing as read gives the level itself; a moved thing patches only `x` and `z`, a field change only that member, a cleared field removes only that member; member order of a replaced thing is its own; `remove` takes the element out and the rest are the same objects; `takenIds` is every entity's id whatever the definition; `references` lists the ref fields of other things that point at the id (single and list fields), and nothing for `$sector`; `afSectorProfile.things` is the access. *Files:* create `profile/thing-access.ts`, `profile/af-sector/af-things.ts` and the test; modify `profile/level-profile.ts` (`things`), `profile/af-sector-profile.ts`, and the `LevelProfile` literals in tests. *Pass:* the new tests, `tsc`, purity.
2. **[x] `ThingAccess` for Last Light.** Failing test first (`profile/last-light-things.test.ts`, over the toy blockout and the four shipped files): for each definition (`spawn`, `box`, `hotspot`, `lamp`, `anchor`, `node`) `add` writes the member shape of its array or record (no `def`, `id` for lists and the key for records), `replace` with the thing as read is the level itself for every thing of every shipped file, a moved box patches only `x` and `z`, `remove` takes it out of its list or record (and an emptied `nav.nodes` or `anchors` stays an empty record, as the file has it), the spawn cannot be removed or added (`ThingAccessError`), `takenIds` is the ids of that definition only (an anchor and a lamp may share one), `references` finds `on: box:<id>`, an opening's `door`, a nav edge's door and nodes, the patrol, and a wall reference is not a thing's. *Files:* create `profile/last-light-things.ts` and its test; modify `profile/last-light-profile.ts`. *Pass:* as step 1.

   *Done (steps 1 and 2).* `profile/thing-access.ts` (`ThingAccess`, `ThingAccessError`, `noThing`, `newMembers`, `mergeMembers`), `profile/af-sector/af-things.ts`, `profile/last-light-things.ts`, `entities/thing-refs.ts` (`targetOf` and `refsOf`, moved out of `checks/entity-refs.ts`, which now calls them; its tests unchanged and green) and `LevelProfile.things`, set by both profiles. Tests: `af-things.test.ts` (15), `last-light-things.test.ts` (23, every thing of the four shipped files read back unchanged), `thing-refs.test.ts` (3); the whole package 1231 passing, `tsc` clean. Two changes against the plan: the Last Light `node` definition is now `sit: 'floor'` (a nav node has an `x` and a `z` and no height, so an edit must not give it one; `last-light-entities.test.ts` follows), and `mergeMembers` does not compare key order (it keeps the old order, so it cannot differ). An anchor stays `free` although its `y` is optional in the file: `addThing` will give a new anchor the floor of its sector as a `y` (reversible; the schema allows it). The Last Light reference sentences are `hotspot knob is on box:abDoor`, `opening ab: door abDoor`, `nav edge in–out: door abDoor`, `nav edge in–out: names in`, `nav drop in–spare: names in`, `nav patrol: names in`.
   *Mutations (hand, `mutate.py`).* `last-light-things.ts` 36 mutants (3 survived: two thrown sentences only checked by class, `in` for `Object.hasOwn`; each killed after tightening), `af-things.ts` 12 of 12, `thing-access.ts` 12 (1 survived: the key-order comparison, which cannot matter; removed), `thing-refs.ts` 6 (1 survived: `targetOf` on a target that is no string; `thing-refs.test.ts` added, killed).

3. **[x] The four edits.** Failing test first (`model/thing-edits.test.ts`, over both toy levels and a shipped file through `createLevelEditor`): `addThing` fills defaults, refuses a bad id, a taken id, an unknown definition, a second `single`, a place outside every sector and in a hole, a value the kit refuses and a missing required field, a height on a floor thing, and gives a free thing its sector's floor; selects the thing; `moveThing` moves, refuses outside every sector and an unreadable thing, keeps `y` unless given, is the level itself when the place is unchanged, and two runs close together are one undo step; `setThingField` sets and clears a field (a required one refuses), refuses an unknown field and a value of the wrong type with the kit's sentence, coalesces per field; `removeThing` takes a thing out, refuses while a ref or an `on` names it with the sentences of `references`, removes an unreadable thing, refuses Last Light's spawn; every refusal changes nothing, and undo and redo bring each edit back. *Files:* create `model/thing-edits.ts` and its test. *Pass:* as step 1; the checks (`entities`, `ids`) report nothing new on a level after any accepted edit.
4. **[x] Selection, entry, gates.** Failing test first (`model/level-editor.test.ts`): after a remove, an undo of an add or a redo, the selection holds only `entity:` ids the level has, an unreadable thing's id stays, a stale `sector:` id is dropped as before; `index.test.ts`: the access type's value members and the four edits are exported. Then the gates in order, Node 24: `pnpm format`, `pnpm docs:stack`, `pnpm check`, `pnpm build`, `pnpm api-index`, `pnpm cheatsheet`, `pnpm agent-skills`, `pnpm api-report`; hand mutation over each step's logic with `/mnt/project-files/ed3d/mutate.py`; docs: a 02 row (a new row ED3D.7a under ED3D.7, the evidence row) and the 03 paragraph; this plan's ticks. *Files:* modify `model/level-editor.ts`, its test, `index.ts`, `index.test.ts`. *Pass:* all of the above.

   *Done (steps 3 and 4).* `model/thing-edits.ts` (`addThing`, `moveThing`, `setThingField`, `removeThing`, with `AddThingArgs`, `MoveThingArgs` and `SetThingFieldArgs`), 63 tests in `thing-edits.test.ts` over the depot, a depot with a floating lamp and a switch, a depot with a hole, a depot with a thing no definition covers, the toy blockout and clinic-dawn, and through `createLevelEditor` (undo, redo, coalescing, a refusal records nothing); `level-editor.ts` drops an `entity:` selection whose definition the level has and whose thing it lacks (a thing the reader could not read stays, a kind with no definition, Last Light's zone, is not judged) and `level-editor.test.ts` follows (its old case about `entity:crate/gone` now uses a zone); `index.ts` exports the four edits, their argument types, `ThingAccess` and `ThingAccessError` (`index.test.ts` follows). Decisions made while building, each reversible: the id rule is the sector id rule (`ID_PATTERN` is exported from `sector-edit-support.ts` and both use it); a new thing is given only the defaults its definition declares, never the type's zero (that would write `on: ""` into a Last Light file, which its schema refuses, and a zero into every optional member of an AF thing); an edit also asks the file's schema whether the level is still one it can hold (`the file cannot hold it (hotspots.0.on: ...)`), so an edit never makes a level that cannot be saved, except an edit that changes nothing, which is never blamed; a `definition.sit` that is absent means `floor`, as the definition schema says; a point field is not allowed in a thing definition (the kit's rule is "use two float fields"), so only numbers and lists of numbers are rounded; a removal asks the access first, so a thing that is not there is reported as not there even when something points at it.
   *Gates.* Node 24.21, from the worktree: `pnpm format`, `pnpm docs:stack` (no change), `pnpm check` exit 0 (33 tasks; `editor-3d` 65 files, 1298 tests), `pnpm build`, `pnpm api-index`, `pnpm cheatsheet` (no change), `pnpm agent-skills --write` then plain, `pnpm api-report` exit 0. No changeset: `editor-3d` is private.

## Mutations

Hand mutation with `/mnt/project-files/ed3d/mutate.py`, every mutant run against its tests:

- Steps 1 and 2: `last-light-things.ts` 36 mutants (3 survived: two thrown sentences only checked by class, and `in` for `Object.hasOwn`; each killed after tightening the tests), `af-things.ts` 12 of 12, `thing-access.ts` 12 (1 survived: the key-order comparison in `mergeMembers`, which cannot matter because the merge keeps the old order; removed), `thing-refs.ts` 6 (1 survived: `targetOf` on a target that is no string; `thing-refs.test.ts` added, killed).
- Step 3: `thing-edits.ts` 59 mutants, 11 survived the first time: the rounding of a point (dead code, a thing definition has no point field; removed), `required ||` before a default (equivalent, a definition cannot give a required field one; removed), the order of `values` in `setThingField` (equivalent, the access keeps the file's order; simplified), and seven that tests killed once added (a height that is not a number, a field given as `undefined`, a value rounded at add, the first thing of a `single` definition named when it is not first in the file, an access that refuses at add, the `at` of a refusal on move, a no-op edit on a level that was already faulty). All killed in the second run (53 mutants, one skipped because its code was removed).
- Step 4: `level-editor.ts` 8 mutants; the one that survived (the definitions set) was killed by a test over a level with a second definition. Its first "kill" was false, because the test it relied on was itself failing (the `switch` definition had no `fields`): the all-KILLED trap, caught by running the baseline.

## Progress record

- 2026-10-23 16:20 UTC: plan drafted on the standing go-ahead; branch from #166's head `2e71175`.
- 16:26: steps 1 and 2 done (access for both formats, 41 new tests, the whole package 1231).
- 16:46: steps 3 and 4 done; gates green (package 1298 tests). Opened as a draft stacked on #166.
