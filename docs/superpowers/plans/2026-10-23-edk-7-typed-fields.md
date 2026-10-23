# EDK.7 Typed field and entity definitions: TDD plan

- **Task:** EDK.7 in [02](../../02-master-delivery-plan.md). [Editor kit spec](../specs/2026-10-23-editor-kit-design.md) §4.8; decision EDK-D8; acceptance EK-j.
- **Lane:** editor-kit. **Depends on:** EDK.1 (the package; this PR stacks on #106). **Unblocks:** ED2D.1 (2D project model: `EntityDef2D`, level fields) and ED3D.1b (the 3D editor's generic profile).
- **Status:** Planned 2026-10-23. Nothing implemented yet. The editor-kit spec is drafted, not reviewed.
- **Progress:** 0 of 7 steps.

## Scope

**In:** one pure-TypeScript feature folder, `packages/editor-kit/src/fields/`, no DOM, no Svelte, no clock (EDK-D2), run in the existing `unit` project: the types of spec §4.8, the value rules, definition checks, retype and rename helpers, and the zod schemas both editors use in their file schemas.

**Out, with owner:**

| What | Where |
|---|---|
| Whether a `ref` target resolves (`brokenRef`) | The editor's checks (2D ED2D.3, 3D ED3D.2); the kit treats `target` and `container` as opaque strings |
| `EntityDef2D`, `EntityDef3D` and their extra facts (shape, size, pivot, model) | Each editor, by intersection with `EntityDef` |
| The definitions editor widgets (field list, type picker, option editor, default editor) | The editor that needs them (ED2D.5, ED3D.x), built from the EDK.4 widgets |
| Storing definitions and instances in a file, migrations | Each editor's format (ED2D.1, ED3D.1) |
| Per-instance widgets that show a field (stepper, swatch, point list) | EDK.4 |

## Decisions made here (written into spec §4.8 in this PR)

1. **Number rules.** `int` needs a finite integer (`notInteger` for 1.5), `float` and `angle` a finite number. `NaN` and the infinities are `wrongType`, because they cannot be written to a JSON project file. `min` and `max` apply to `int` and `float` only; `angle` is degrees and wraps, so the editor normalises it for display and the kit does not bound it.
2. **`color` is `#rrggbb`**, either case; no shorthand, no alpha, no token names (an `EntityDef.color` may also be a token name, a field value may not).
3. **`point` coordinates** are finite numbers; whether they sit on a grid is the editor's rule.
4. **A list checks every item** with the field's own rules; the first bad item is reported as `badListItem` with its `index` and a `cause` holding the item's own problem. A non-array is `wrongType`. A required list may be empty; a required field with no value at all is `fieldMissing`.
5. **`checkRetype` lists instances that become invalid, not instances that already were.** An instance whose value failed the old definition is already a `checkValues` problem; the retype refusal exists so a definitions edit never makes a valid instance invalid. The check reads the value by `oldDef.id`, so a rename combined with a retype is the same call.
6. **Three additions to the §4.8 function table**, each needed by an editor that would otherwise write it twice: `checkEntityDef` (bad entity id, duplicate field ids, each field's problems with the field id), `renameField(def, from, to)` and `renameFieldValues(values, from, to)` (the "keeps values by id" half of EK-j). Neither mutates its input.
7. **The zod schemas are structural and delegate the meaning.** `fieldDefSchema` and `entityDefSchema` are strict objects that run `checkFieldDef` and `checkEntityDef` in `superRefine`, so a file that parses has passed the same rules the definitions editor shows, from one source. `fieldValueSchema` and `fieldValuesSchema` accept any well-formed value shape; checking a value against its definition is `checkValues`, because the schema cannot know the definition.
8. **`zod` is added as a dependency** of the package at the workspace pin (4.6.5; `docs/versions.md`), the one schema language (ADR 0003).

## Contract

All in `packages/editor-kit/src/fields/`, re-exported from `src/index.ts`.

### `field-types.ts`

The types of spec §4.8 exactly (`FieldType`, `FieldDef`, `FieldValue`, `Point`, `RefValue`, `EntityDef`, `FieldValues`), plus:

```ts
export const FIELD_TYPES: readonly FieldType[]
export const FIELD_ID: RegExp      // /^[A-Za-z][A-Za-z0-9_]*$/
export const ENTITY_ID: RegExp     // /^[a-z][a-z0-9-]*$/

export interface FieldProblem<Code extends string = string> { readonly code: Code; readonly message: string }
export type FieldValueCode = 'wrongType' | 'notInteger' | 'belowMin' | 'aboveMax' | 'notAnOption' | 'badColor' | 'badRef' | 'badPoint' | 'badListItem'
export interface FieldValueProblem extends FieldProblem<FieldValueCode> { readonly index?: number; readonly cause?: FieldValueProblem }
export type FieldDefCode = 'badId' | 'badBounds' | 'badStep' | 'noOptions' | 'duplicateOption' | 'badDefault' | 'wrongTypeProperty'
export type InstanceCode = FieldValueCode | 'fieldMissing' | 'unknownField'
export interface InstanceProblem extends FieldProblem<InstanceCode> { readonly fieldId: string; readonly index?: number; readonly cause?: FieldValueProblem }
```

`wrongTypeProperty` covers `min`, `max` or `step` on a non-number type, `options` on a non-enum, `to` on a non-ref and `multiline` on a non-text; its message names the property.

### `check-field-value.ts`

`checkFieldValue(def, value): FieldValueProblem | undefined`, rules of decisions 1 to 4 and spec §4.8. `undefined` is "fits".

### `check-field-def.ts`

`checkFieldDef(def): readonly FieldProblem<FieldDefCode>[]`, `defaultFieldValue(def): FieldValue | undefined`, `checkEntityDef(def): readonly EntityDefProblem[]` where `EntityDefProblem` is a `FieldProblem` with an optional `fieldId` and the code `badEntityId`, `badColor`, `duplicateFieldId` or a field code. Problems come in definition order, so the list is stable for the checks panel.

### `field-values.ts`

`checkValues(fields, values): readonly InstanceProblem[]` (fields in definition order, then unknown ids in sorted order), `valuesWithDefaults(fields, values): FieldValues` (the same object when nothing is filled; a required or default-less field stays missing), `renameFieldValues(values, from, to): FieldValues` (same object when `from` is absent or equals `to`).

### `retype.ts`

```ts
export interface FieldInstance { readonly id: string; readonly values: FieldValues }
export interface RetypeBreakage { readonly instanceId: string; readonly problem: FieldValueProblem | InstanceProblem }
export function checkRetype(oldDef: FieldDef, newDef: FieldDef, instances: readonly FieldInstance[]): readonly RetypeBreakage[]
export type RenameResult = { readonly ok: true; readonly def: EntityDef } | { readonly ok: false; readonly code: 'unknownField' | 'badId' | 'duplicateFieldId' }
export function renameField(def: EntityDef, from: string, to: string): RenameResult
```

A value that is absent counts as valid unless `newDef.required` (then `fieldMissing`).

### `field.schema.ts`

```ts
export const fieldValueSchema: z.ZodType<FieldValue>
export const fieldValuesSchema: z.ZodType<FieldValues>
export const fieldDefSchema: z.ZodType<FieldDef>
export const entityDefSchema: z.ZodType<EntityDef>
```

Strict objects: an unknown key is a parse error, so a typo in a project file is found at load.

## Steps (each: failing test first, confirm the reason, minimal change, verify)

| # | Step | Test file and what fails first | Verify |
|---|---|---|---|
| 1 | Types, and `checkFieldValue` for `int`, `float`, `bool`, `text` and `angle` | `fields/check-field-value.test.ts`: "Failed to resolve import"; then one behavior at a time (1.5 is `notInteger`, `'3'` is `wrongType`, `NaN` is `wrongType`, `belowMin` and `aboveMax` are inclusive-bound exact) | unit |
| 2 | `checkFieldValue` for `enum`, `color`, `point`, `ref` and lists | same file: `notAnOption`, `#FFF` is `badColor`, `{x:1}` is `badPoint`, `{target:''}` is `badRef`, a list of ints with a bad item at index 2 is `badListItem` with `index: 2` and `cause`, a non-array is `wrongType`, an empty list of a required field fits | unit |
| 3 | `defaultFieldValue`, `checkFieldDef`, `checkEntityDef` | `fields/check-field-def.test.ts`: zero value per type; `default` wins; required gives `undefined`; list gives `[]`; each problem code; the ids and duplicate field ids; problems in definition order | unit |
| 4 | `checkValues`, `valuesWithDefaults`, `renameFieldValues` | `fields/field-values.test.ts`: `fieldMissing`, `unknownField` (sorted), each field's problem carries its `fieldId`; defaults filled, same object when nothing to fill, ref and required stay missing, no input mutated | unit |
| 5 | `checkRetype`, `renameField` (EK-j) | `fields/retype.test.ts`: the EK-j case end to end (`hp: int 0..9`; 12 is `aboveMax`; retype to text lists exactly the instances holding numbers; widening the bound lists none; rename keeps both values by id); an already-invalid instance is not listed; becoming `required` lists instances with no value; rename refusals | unit |
| 6 | Zod schemas | `fields/field.schema.test.ts`: round trip of every field type through `fieldDefSchema`; an unknown key, a bad id, a `min > max` and an enum without options each fail with the `checkFieldDef` message; `entityDefSchema` rejects duplicate field ids; `fieldValuesSchema` accepts nested points and refs and rejects `null` | unit |
| 7 | Exports and gates | `index.test.ts` gains the new exports. Then `pnpm exec biome check --write`, package typecheck and unit, the layout project (container config), `pnpm lint`, `pnpm style`, `pnpm knip`, `pnpm install --frozen-lockfile`; docs 02 and 03; spec §4.8 edits per decision 6 | unit and gates |

## Acceptance (kit spec)

EK-j passes in `retype.test.ts`: an `hp: int 0..9` definition; an instance at 12 reports `aboveMax`; retyping `hp` to `text` while two instances hold numbers lists exactly those two and a caller can refuse; renaming `hp` keeps both values.

## Risks

- **The type names.** The 3D lane reads §4.8 before this code exists. Names and `FieldValue` shapes follow the spec exactly; any difference found while writing a test is fixed in the spec in this PR and the 3D thread is told on the bus.
- **`checkRetype` semantics.** Listing only newly invalid instances (decision 5) differs from the loosest reading of the spec ("would stop validating" for every instance). It is the reading that keeps the refusal useful; a test pins it, and a later change is one line.
- **`zod` dependency without `deps:new`.** `pnpm deps:new` needs `api.npmjs.org`, which this sandbox cannot reach. `zod` 4.6.5 is already used by six packages in the lockfile, so the lockfile change is one importer entry; the PR body says the check was not run.

## Execution record

(Filled in as steps complete.)
