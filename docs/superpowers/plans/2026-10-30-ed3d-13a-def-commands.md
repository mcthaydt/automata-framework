# ED3D.13a Definition commands and a new `af-sector` level (headless): TDD plan

- **Task:** ED3D.13, first part (row ED3D.13a in `docs/02-master-delivery-plan.md`). [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §4.6 (the `af-sector/1` format), §4.7 (entity definitions: "a definitions editor (ED3D.13) adds, renames and retypes them with a refusal when an instance would no longer validate"; Last Light's set is read-only), §5.4 (Definitions: `def.add`, `def.rename`, `def.setField`, `def.remove`), ED3-r. The model half of the definitions editor and of New level: the edits, the materials-table edits of an AF sector level and the file template. No view, no dialog, no Home button: those are ED3D.13b.
- **Lane:** editor-3d. **Depends on:** ED3D.7a (the thing edits, `ThingAccess`, the pattern this copies) and EDK.7 (the kit's `checkRetype`, `renameField`, `renameFieldValues`, `checkValues`), both merged.
- **Status:** Drafted 2026-10-30. Not reviewed. Steps are ticked only when their checks pass.
- **Progress:** 0 of 4 steps.

## Sources, read at these commits

- **AF (`origin/main` at `cc5185f`):** `model/thing-edits.ts` (the `Edit` style, `fileProblem`, refusal sentences), `profile/thing-access.ts` (`mergeMembers`), `profile/af-sector/af-things.ts`, `entities/thing-def.schema.ts` (`thingDefSchema`, the 3D rules), `entities/things.ts` (`readEntityKit`), `checks/entity-refs.ts` (a `to` must name a definition or `$sector`), `checks/materials.ts` (which members name a material), `profile/af-sector/af-codec.ts` (member orders), the kit's `fields/retype.ts` and `fields/field-values.ts`.
- No code is extracted from The Last Light, FloorFifty or FigureBuilder: Last Light's definitions are fixed and it has no definitions editor.

## Scope

**In:** `profile/definition-access.ts` (`DefinitionAccess`), `profile/af-sector/af-definitions.ts` (its AF sector access), `LevelProfile.definitions` (optional; Last Light leaves it out, which makes its definitions read-only), `model/definition-edits.ts` (`addDefinition`, `renameDefinition`, `setDefinitionField`, `removeDefinition`), `profile/af-sector/af-material-edits.ts` (`addMaterial`, `setMaterial`, `renameMaterial`, `removeMaterial`), `profile/af-sector/af-template.ts` (`newAfSectorLevel`), the package entry.

**Out, with where each goes:**

| What | Where |
|---|---|
| The definitions editor and materials-table editor (kit widgets), New level from Home, ED3-r end to end through the app | ED3D.13b |
| The material picker model, `LevelProfile.materials` and `hints` | ED3D.8a (another agent; nothing here touches them) |
| Changing a definition's own properties after it is added (label, colour, shape, size, sit, single) | Not in §5.4's list; ED3D.13b asks for it if the editor needs it (decision 6) |
| Styles and wall presets | ED3D.8 (spec §5.1: "edits a definition only through an explicit Styles action") |

## Decisions this plan makes (each vetoable by the Owner)

1. **`LevelProfile.definitions?: DefinitionAccess<D>`, written by a profile whose definitions are the file's own.** Absent is "fixed": every definition edit refuses with `this level's entity definitions are fixed by its format`. The Last Light profile leaves it out, so its seven definitions stay read-only with no Last Light name in the edits. Reading stays `profile.entities(doc)`.
2. **"Refused while an instance would stop validating" means an instance that validated before and would not after**, as the kit's `checkRetype` reads it (EDK.7 decision 5). `def.setField` changing an existing field (type, bounds, options, `required`, `list`, `to`, or its id) asks `checkRetype`; adding a field refuses when an instance would miss a new `required` field or holds a stray value under that id that does not fit; removing a field refuses while an instance holds a value for it (it would become `unknownField`). A `ref` field's narrowed `to` that leaves an instance pointing at something it no longer allows is refused too, with the `ids` check's sentence. The sentence lists every instance: `crate: loot would stop validating: entity crate1: loot is not text; entity crate2: ...`.
3. **`def.rename` rewrites what names the definition:** each instance's `def`, and every `ref` field's `to` that names it (in any definition, its own included). Entity ids do not change. The new id follows the kit's `ENTITY_ID` (`^[a-z][a-z0-9-]*$`) and must be unused.
4. **`def.remove` is refused while an instance of the definition stands in the level or another definition's `ref` field may point at it** (its own `to` does not count). A definition the reader could not read can still be removed, so a broken one can be fixed (as ED3D.7a decision 5 for things); it cannot be renamed or have a field set.
5. **`def.add` validates with `thingDefSchema`** (the kit's `entityDefIssues` and the 3D rules), refuses a `to` that names no definition (other than the new one itself or `$sector`), and appends the definition at the end of `entityDefs`. A definition is written in its given member order; the codec's `ENTITY_DEF_ORDER` places a member the editor adds.
6. **No `def.set` for a definition's own properties.** The spec lists four commands; a definition's label, colour, shape, size, sit and single are given at `def.add`. ED3D.13b adds a fifth edit only if its editor needs one.
7. **Materials-table edits are AF sector edits** (`Edit<AfSector>` in `profile/af-sector/`, because the core never names a profile): `material.add` (a new id, `ID_PATTERN`, unused), `material.set` (category, label, wallOnly; category required and non-empty), `material.rename` (rewrites every member that names it: a sector's `floorTexture`, `ceilingTexture`, `wallTexture`; a style's three textures; a wall's `texture` and `trimTexture` pieces, in the outer loop and the holes), `material.remove` (refused while anything names it, with each use listed: `hall: floorTexture tile`, `style warm: wallTexture brick`, `hall: wall 2 texture brick`).
8. **The template is a function, `newAfSectorLevel(name)`, returning the file's text and its model**, hand-formatted as the depot is: `format`, `name`, an empty `materials` table, no sectors, the `spawn` definition (`point`, `single`, a `facing` angle defaulting to 0, as the depot) and no entities. A name is non-empty after trimming; it is written with `JSON.stringify`. The text parses with `afSectorProfile.parse` and is patched by the codec from empty containers (adding a material, a sector, a definition and an entity).
9. **No undo label beyond `Edit.label`; `coalesce` only on `material.set`** (`material:<id>`, a scrubbed label).

## Contract

```
packages/editor-3d/src/profile/definition-access.ts            DefinitionAccess
packages/editor-3d/src/profile/af-sector/af-definitions.ts     afDefinitionAccess
packages/editor-3d/src/profile/level-profile.ts                LevelProfile.definitions?
packages/editor-3d/src/profile/af-sector-profile.ts            definitions: afDefinitionAccess
packages/editor-3d/src/model/definition-edits.ts               addDefinition, renameDefinition, setDefinitionField, removeDefinition
packages/editor-3d/src/profile/af-sector/af-material-edits.ts  addMaterial, setMaterial, renameMaterial, removeMaterial
packages/editor-3d/src/profile/af-sector/af-template.ts        newAfSectorLevel
packages/editor-3d/src/index.ts                                the above
```

```ts
export interface DefinitionAccess<D> {
  /** Every definition id the file holds, readable or not, in file order. */
  ids(doc: D): readonly string[]
  /** The level with `def` at the end of its definitions. */
  add(doc: D, def: ThingDef): D
  /** The definition `id` written as `def` in its own place, its members in their own order; `doc` when nothing differs. */
  replace(doc: D, id: string, def: ThingDef): D
  /** Without the definition `id`. */
  remove(doc: D, id: string): D
  /** Each instance of `def` naming `rename.def` instead, and its member `rename.field.from` called `rename.field.to`, in place. */
  renameInstances(doc: D, def: string, rename: InstanceRename): D
}

export const addDefinition = <D>(args: { definition: ThingDef }): Edit<D>                                  // def.add
export const renameDefinition = <D>(args: { def: string; to: string }): Edit<D>                             // def.rename
export const setDefinitionField = <D>(args: { def: string; field?: string; value: FieldDef | null }): Edit<D> // def.setField; no field adds, null removes
export const removeDefinition = <D>(args: { def: string }): Edit<D>                                        // def.remove

export const addMaterial = (args: { id: string; material: AfMaterial }): Edit<AfSector>                     // material.add
export const setMaterial = (args: { id: string; material: AfMaterial }): Edit<AfSector>                     // material.set
export const renameMaterial = (args: { id: string; to: string }): Edit<AfSector>                            // material.rename
export const removeMaterial = (args: { id: string }): Edit<AfSector>                                        // material.remove

export function newAfSectorLevel(name: string):
  | { ok: true; text: string; level: AfSector }
  | { ok: false; reason: string }
```

## Steps

1. **[ ] `DefinitionAccess` for `af-sector/1`.** Failing test first (`profile/af-sector/af-definitions.test.ts`, over the depot): `ids` lists every raw definition; `add` appends and the codec's `patch` inserts exactly that element; `replace` with the definition as read is the level itself, a changed field patches only that field, member order is kept; `remove` drops it, the rest are the same objects; `renameInstances` changes each instance's `def` and renames a member in place (the codec patches only the key spans); `afSectorProfile.definitions` is the access and `lastLightProfile.definitions` is absent. *Files:* create `profile/definition-access.ts`, `profile/af-sector/af-definitions.ts` and the test; modify `profile/level-profile.ts`, `profile/af-sector-profile.ts`. *Pass:* the new tests, `tsc`, purity.
2. **[ ] The four definition edits.** Failing test first (`model/definition-edits.test.ts`, over the depot, a depot with a switch whose ref field points at a crate, and the toy blockout): each edit refuses on Last Light with the fixed sentence; `def.add` adds `crate2`-style definitions, refuses a bad id, a taken id, a schema rule (a box with no size, a reserved field id) and a `to` naming nothing; `def.rename` rewrites instances and `to` lists, refuses a bad or taken id and an unreadable definition; `def.setField` adds a field, adds a required one (refused while instances lack it), retypes (refused with `checkRetype`'s list; a widening is accepted), renames a field (instances keep their values), narrows a `to` (refused when a ref would point at something no longer allowed), removes a field (refused while a value is held; accepted when none is); `def.remove` removes an unused definition and an unreadable one, refuses while instances stand or a `to` names it; every refusal changes nothing, every accepted edit leaves `entities` and `ids` check results no worse, and undo and redo through `createLevelEditor` bring each back; ED3-r headless: define `crate` (box, one `ref` field), place two with `thing.add`, set the field, patch, re-parse, the definition, instances and value are in the file, checks pass, a second `spawn` is refused by `single`. *Files:* create `model/definition-edits.ts` and its test. *Pass:* as step 1.
3. **[ ] Materials-table edits.** Failing test first (`profile/af-sector/af-material-edits.test.ts`, over the depot and a depot with a style and wall textures): add, set, rename (every use rewritten; the `materials` check passes after), remove (unused accepted; used refused with each use listed); bad id, taken id, unknown id, empty category refused; patches touch only the table and the renamed spans. *Files:* create `profile/af-sector/af-material-edits.ts` and its test. *Pass:* as step 1.
4. **[ ] Template, entry, gates.** Failing test first (`profile/af-sector/af-template.test.ts`): the text is the expected hand-formatted file, parses, checks report no error, an empty name is refused, a name with a quote is escaped; adding a material, a sector, then a spawn instance, patched from the template text, gives text that re-parses to the model; `index.test.ts`: the new edits and the template are exported. Then gates: `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm changeset status --since=origin/main`, `node tooling/release/src/check-changesets.ts`. *Files:* create the template and its test; modify `index.ts`, `index.test.ts`.

## Progress record

- 2026-10-30: plan drafted from `origin/main` `cc5185f`.
