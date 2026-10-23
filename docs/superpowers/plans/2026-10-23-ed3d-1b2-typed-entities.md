# ED3D.1b2 Typed entity definitions: TDD plan

- **Task:** ED3D.1b2. [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §4.7 (entity definitions, LDtk style), §4.1 (`LevelProfile.entities`) and the ED3D.1b2 row: the entity model both profiles share, read through the kit's `./fields` module. No views, no edits, no checks: those are ED3D.7 (Things), ED3D.2b (checks that need definitions).
- **Lane:** editor-3d. **Depends on:** ED3D.1b (merged: `AfSector`, the profile shape), ED3D.1 (merged: the Last Light schema) and the kit's `./fields` entry (EDK.7 and ED2D.1, #116 and #128, both in main). Branch `claude/project-thread-ljshus-ed3d-1b2` starts from `main` and is not stacked on the ED3D.4 to ED3D.6 branches: nothing here touches them.
- **Status:** Drafted 2026-10-23 on the hub's answer (bus 1242: wait for #128; #128 reached main). Implemented and checked locally 2026-10-23 (Node 24); not CI verified (hosted Actions are stopped), not Owner accepted. Not reviewed; spec review (ED3D.0) is still open. Steps below are ticked only when their checks pass.
- **Progress:** 4 of 4 steps.

## Why this task exists

A level holds things: a crate, a lamp, a spawn point. In an `af-sector/1` file the author says what a thing is (`entityDefs`) and where the instances are (`entities`); in a Last Light blockout the same ideas are fixed arrays (`boxes`, `hotspots`, `lamps`, `anchors`, `nav.nodes`, `spawn`). Today `AfEntityDef` is `{ id, ...anything }`, so nothing can say what a field is or whether a value fits it, and nothing reads the Last Light arrays as things at all. The Things layer, the palette, the inspector and the entity checks all need one typed answer to "what are this level's definitions and things", the same for both formats and never naming a Last Light concept. This task builds that answer and nothing that draws or edits it.

## Sources, read at these commits

- **Kit, in main (`b2847c13`):** `packages/editor-kit/src/fields/` (`field-types.ts`: `FieldDef`, `EntityDef`, `FieldValue`, `FieldValues`, `FIELD_ID`, `ENTITY_ID`; `field.schema.ts`: `entityDefShape` (the keys an editor extends), `entityDefIssues`, `fieldValueSchema`; `field-values.ts`: `checkValues`; `check-field-def.ts`: `checkEntityDef`). Imported only through `@mcthaydt/automata-editor-kit/fields` (no Svelte in that graph).
- **AF (main):** `format/af-sector.schema.ts` (`AfEntityDef`, `AfEntity`, `afSectorSchema`: unknown members are kept), `profile/af-sector/af-checks.ts` (`afIdProblems`: definition ids and entity ids are unique), `profile/level-profile.ts` (the profile shape its header says `entities` joins), `checks/check.ts` (`entitySelection(definition, id)` → `entity:<def>/<id>`), `model/selection-ref.ts` (`parseSelection` already reads `entity:`).
- **Last Light data:** `format/blockout.schema.ts` (`BlockoutBox`, `BlockoutHotspot`, `BlockoutLamp`, `Anchor`, `Nav.nodes`, `Spawn`) and the four shipped blockouts in `src/testing/fixtures` (22 boxes, 27 hotspots, 23 lamps, 2 anchors and 3 or more nav nodes in clinic-dawn, for example).

## Scope

**In:** `src/entities/thing-def.schema.ts`, `src/entities/things.ts` (the `Thing`, `EntityKit` and problem shapes, and the reader both profiles use), `src/profile/af-sector/af-entities.ts`, `src/profile/last-light-entities.ts`, `LevelProfile.entities`, the `entities` layer in the purity test, the package entry; tests beside each.

**Out, with where each goes:**

| What | Where |
|---|---|
| Thing edits (`thing.add`, `thing.move`, `thing.setField`, `thing.remove`) and writing Last Light's records back to their arrays | ED3D.7 |
| The Things layer on the plan and in 3D, the palette, the inspector form | ED3D.7 and ED3D.5b |
| The checks: definition problems as results with locators, field values and ranges, `single`, a thing outside every sector, a `ref` that does not resolve, `materials`, `lamps`, `policy` | ED3D.2b, over the `EntityKit` this task returns |
| The definitions editor and retyping | ED3D.13 |
| Last Light zones, nav edges, the patrol list and `bounce`: they have no place of their own (a zone is an area, an edge joins two nodes) | ED3D.7 decides how they are drawn; the fixed set here is the placed things |
| Converting a Last Light colour (`[r, g, b]`) to a colour field | ED3D.7's widget; here it stays three floats as stored |

## Decisions this plan makes (each vetoable by the Owner through the Orchestrator)

1. **The 3D definition is the kit's `EntityDef` plus three members:** `shape` (`point` or `box`), `size` (`[w, h, d]` in metres, boxes only) and `sit` (`floor`, the default: the thing rests on its sector's floor; or `free`: it floats at its own `y`). The schema extends the kit's `entityDefShape`, so the kit's keys are never copied, and the definition stays loose (an unknown member of it is kept, like the rest of the format). Its fields are the kit's `fieldDefSchema`, which is strict: an unknown member of a field is a read problem, the kit's rule ("a typo in a project file is a parse error at load"). Open point for the spec review: a newer minor that adds a member to fields would make those definitions unreadable until the kit loosens it; the kit's owner (the 2D lane) decides, not this task. The spec writes `sit` as "`floor` or floats at `y`": the second value is spelled `free` here so it names the behaviour and not a member.
2. **Three rules are the 3D editor's own,** on top of the kit's `checkEntityDef`: a field id may not be `def`, `id`, `x`, `y` or `z` (an instance stores its values beside its place, so they would collide); a `point` field is refused for now, because the kit's point is `{x, y}` and the plan's axes are x and z, so a value would have to say which it means (two float fields do the job until a plan-axis point exists); and a box has a `size`, else float fields `w`, `h` and `d` that give each instance's size (Last Light's boxes are sized per box). Each has a sentence that names the definition and the field.
3. **An instance is `{ def, id, x, z, y?, ...values }`** (spec §4.7). `values` is every member that is not one of the five, so the file stays as the author wrote it; a member that is not a field value shape (the kit's `fieldValueSchema`) is a read problem at its path. Whether a value fits its field is ED3D.2b's check (`checkValues`), not the reader's: the reader says what is there.
4. **`EntityKit` is what a profile answers:** `{ definitions, things, problems }`. `definitions` are the typed definitions that parsed (the first of two with one id wins; `ids` already reports the second), `things` the instances whose definition is among them, `problems` everything that could not be read, each with a JSON path and a sentence, so ED3D.2b turns them into results without a second parse. A thing of an unknown definition is a problem, not a thing, and is never lost: the file keeps it.
5. **Last Light's fixed set, read-only, in the same shape.** `spawn` (point, `single`, free: `facing` angle), `box` (box, free: `w` `h` `d` floats above zero, `kind` and `role` enums with the schema's options), `hotspot` (point, free: `name`, `reach`, `hide`, `on`), `lamp` (point, free: `range`, `radius`, `color` as a list of floats from 0 to 1, `kind`, `on`), `anchor` (point, free: `radius`, `on`; the record key is its id) and `nav-node` (point, free: `on`; the record key is its id). `on` stays text as stored (`box:bed`, `wall:hall/2`): turning it into a `ref` is a write-side change and belongs with the edits. The spawn has no id of its own, so its id is `spawn` (`entity:spawn/spawn`, as the spec's example has it).
6. **Zones and nav edges are not in the fixed set** (see Out): the spec's list names a zone, but a zone has no place to be a thing at, and giving it one here would invent how it is drawn. Reversible: ED3D.7 adds a definition and a reader beside these when it decides.
7. **The reader never throws for a level the schema accepted,** like `checks`: a definition that does not parse, an instance that is not one and a member that is not a field value are problems with sentences and paths; a second definition with an id already taken is not a read problem, because the `ids` check reports it (the first is the one things are read by).
8. **`entities` is a profile member next to `geometry` and `checks`:** `LevelProfile<D>.entities(doc): EntityKit`. Selection ids stay `entity:<def>/<id>` through the existing `entitySelection`.

## Contract

```
packages/editor-3d/src/entities/thing-def.schema.ts        ThingDef, thingDefSchema, THING_SHAPES, RESERVED_FIELD_IDS
packages/editor-3d/src/entities/things.ts                  Thing, EntityKit, EntityReadProblem, readEntityKit
packages/editor-3d/src/profile/af-sector/af-entities.ts    afEntityKit
packages/editor-3d/src/profile/last-light-entities.ts      lastLightDefinitions, lastLightEntityKit
packages/editor-3d/src/profile/level-profile.ts            LevelProfile gains entities
packages/editor-3d/src/index.ts                            the public entry gains the above
```

```ts
export type ThingShape = 'point' | 'box'
export type ThingSit = 'floor' | 'free'
export interface ThingDef extends EntityDef {
  readonly shape: ThingShape
  readonly size?: readonly [number, number, number] | undefined
  readonly sit?: ThingSit | undefined
}
export const thingDefSchema: z.ZodType<ThingDef>

export interface Thing {
  readonly def: string
  readonly id: string
  readonly x: number
  readonly z: number
  readonly y?: number | undefined
  readonly values: FieldValues
}
export interface EntityReadProblem {
  /** Where in the file (`['entityDefs', 1, 'fields', 0, 'id']`, `['entities', 3]`) or, for Last Light, in the model. */
  readonly path: readonly (string | number)[]
  readonly message: string
}
export interface EntityKit {
  readonly definitions: readonly ThingDef[]
  readonly things: readonly Thing[]
  readonly problems: readonly EntityReadProblem[]
}
/** The shared reader: raw definitions and raw instances (each with the path it came from) to a kit. */
export function readEntityKit(input: {
  definitions: readonly { readonly path: readonly (string | number)[]; readonly value: unknown }[]
  instances: readonly { readonly path: readonly (string | number)[]; readonly value: unknown }[]
}): EntityKit
export function afEntityKit(level: AfSector): EntityKit
export const lastLightDefinitions: readonly ThingDef[]
export function lastLightEntityKit(blockout: Blockout): EntityKit
```

## Steps

1. **[x] The 3D definition.** Failing test first: `thingDefSchema` accepts the depot's `spawn` and `crate` definitions and keeps an unknown member; refuses each of: a missing or unknown `shape`; a `size` on a point, a `size` that is not three numbers above zero; a box with neither `size` nor `w`/`h`/`d` float fields; a field called `x`; a `point` field; a `sit` that is not `floor` or `free`; and the kit's own rules still surface (a bad definition id, a duplicate field id, a default outside its bounds) at the field's path. Each refusal's sentence names the definition and the field. *Files:* create `entities/thing-def.schema.ts`, `entities/thing-def.schema.test.ts`. *Consumes:* `entityDefShape`, `entityDefIssues`, `FIELD_ID` from the kit's `./fields`. *Produces:* `ThingDef`, `thingDefSchema`. *Pass:* the new test file, `tsc -p .`, the purity test with `entities` added to its layers.
   - *Done 2026-10-23:* `thing-def.schema.ts` and its 14 tests; the first run failed on the missing module, then one expectation of mine was wrong (a field's unknown member is refused because the kit's field schema is strict; the test and decision 1 now say so). `purity.test.ts` lists `entities`. `tsc -p .` and biome clean. Deviation: none beyond that correction.
2. **[x] The reader and the AF kit.** Failing test first: `readEntityKit` over raw definitions and instances returns the typed definitions, the things with `values` as the members beside the place, and a problem with its path for a definition that does not parse, an instance that is not an object with `def`, `id`, `x`, `z`, a value that is not a field value shape, and an instance of an unknown definition; a second definition with one id is ignored without a problem (the first wins; `ids` reports it); the order is file order; nothing throws. `afEntityKit(depot)` returns the depot's two definitions and two things (`crate1` with `contents: 'tools'`, the spawn with `facing: 0`) and no problems; seeded: a level whose `entityDefs` entry has an unknown `shape`, one whose instance names a definition that is not there, one with a value that is an object of the wrong shape. *Files:* create `entities/things.ts`, `entities/things.test.ts`, `profile/af-sector/af-entities.ts`, `profile/af-sector/af-entities.test.ts`. *Pass:* both test files, `tsc`, purity.
   - *Done 2026-10-23:* `entities/things.ts` (`readEntityKit`, `Thing`, `EntityKit`, `EntityReadProblem`, `RawEntry`) with 15 tests, `profile/af-sector/af-entities.ts` with 6. The first run failed on the missing modules and the whole step then passed. Findings while writing it: zod's loose object drops a member called `__proto__` before the reader sees it, so the test asserts that the values keep `Object.prototype` and the reader builds them with `fromEntries`; an instance's value members that no field can hold make it a problem, not a thing (decision 3 said so; the sentence is `entity c1: contents is not a value a field can hold`). Deviation: the duplicate definition is silent, as decision 4 had it (decision 7 and the step text said otherwise and are corrected).
3. **[x] Last Light's fixed set.** Failing test first: every definition in `lastLightDefinitions` parses with `thingDefSchema` (the same rules as an author's); for each of the four shipped blockouts `lastLightEntityKit` returns one thing per box, hotspot, lamp, anchor and nav node plus the spawn, in the arrays' order, with the right definition and id, `x`, `z` and `y` taken from the record, and `checkValues(def.fields, thing.values)` is empty for every one (the strongest evidence that the fixed definitions fit the real data); the spawn is `entity:spawn/spawn`; a record's key is the id of an anchor and a nav node; a blockout with no `anchors` and a nav with no `nodes` has none; a member the fixed definitions do not know (a loose extra) is in `values` and not an error here. *Files:* create `profile/last-light-entities.ts`, `profile/last-light-entities.test.ts`. *Consumes:* `Blockout`, the kit's `checkValues`. *Pass:* the new test file, `tsc`, purity.
   - *Done 2026-10-23:* `profile/last-light-entities.ts` and 21 tests. The first run failed on the missing module; the four shipped blockouts then read with no problem and `checkValues` finds nothing wrong with any of their things under the fixed definitions (the box side is above 1 cm, the lamp colour three floats from 0 to 1, a hotspot's `hide` a bool). The tests also pin the definitions as a table (type, required, bounds), that a record's key beats an `id` in the record, and the model paths of problems for a list, a record and the nav nodes. `angle` is a number as stored (the spawn's facing is in radians in the files); its unit is the widget's concern. Deviation: none.
4. **[x] The profile member and the entry.** Failing test first: `LevelProfile` has `entities`; `afSectorProfile.entities(depot)` and `lastLightProfile.entities(clinicDawn)` equal what steps 2 and 3 return; every `Thing` has a selection id `entitySelection(def, id)` that `parseSelection` reads back to the same definition and id; the package entry exports the new names (asserted in `index.test.ts`, the types by the compiler). Then the gates in order: `pnpm format`, `pnpm docs:stack`, `pnpm check`, `pnpm build`, `pnpm api-index`, `pnpm cheatsheet`, `pnpm agent-skills --write` then `pnpm agent-skills`, `pnpm api-report`; hand mutation over each step's logic. *Files:* modify `profile/level-profile.ts`, `profile/af-sector-profile.ts`, `profile/last-light-profile.ts`, `index.ts`, `index.test.ts`, `purity.test.ts` (adds `entities`), `profile/level-profile.test.ts` or the profile tests beside; docs: the 02 row and the continuation paragraph for ED3D.1b2. *Pass:* all of the above.
   - *Done 2026-10-23:* `LevelProfile.entities` is on both profiles; `index.ts` exports `thingDefSchema`, `THING_SHAPES`, `THING_SITS`, `RESERVED_FIELD_IDS`, `ThingDef`, `readEntityKit`, `Thing`, `EntityKit`, `EntityReadProblem`, `RawEntry`, `afEntityKit`, `lastLightDefinitions` and `lastLightEntityKit`, asserted in `index.test.ts` (the types by the compiler); the profile tests check that each profile answers its kit and that every thing's `entitySelection` id parses back to its definition and id. Gates in order, Node 24: `pnpm format` (no fixes), `docs:stack` (no change), `pnpm check` (33 of 33 tasks, 1023 tests in the package), `pnpm build`, `pnpm api-index`, `pnpm cheatsheet`, `pnpm agent-skills --write` then `pnpm agent-skills` (current), `pnpm api-report` (0 breaks, 0 undeclared); nothing generated changed because `editor-3d` is private. Hosted CI not run. Deviation: none.

## Mutations

- **Step 1** (`thing-def.schema.ts`, 25 runs): all killed but the ones recorded as equivalent. Two survived at first and got tests (a point with a bad size says only that a point has no size; the kit's issues come before the 3D rules'); the strict-object mutant was killed by the unknown-member test.
- **Step 2** (`things.ts`, 20 runs from a green baseline): all killed. Two rewrites of the `fromEntries` line survive and are equivalent, because zod never lets a `__proto__` member through to be told apart.
- **Step 3** (`last-light-entities.ts`, 20 runs): all killed (definitions' sit, single, bounds, required, options and fields; the order of the arrays; the key beating an own `id`; the paths of problems).
- **Step 4** (the two profile wirings, 3 runs): all killed (an empty kit, and the other format's kit, in place of the right one).

## Progress record

To be recorded as each step passes.
