# ED3D.2b-1 Entity checks: TDD plan

- **Task:** ED3D.2b, first part. [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §7 (Checks): the generic `entities` check (an instance names an undefined definition, misses a required field, has a value outside its field's range or options, is outside every sector, or breaks a `single` definition) and the entity half of `ids` ("an entity `ref` field … does not resolve"). Pure functions over the entity kit that ED3D.1b2 returns, each problem with a locator, run by both profiles' check runners. The other ED3D.2b checks (`materials`, `lamps`, `policy`) are the second part and have their own plan.
- **Lane:** editor-3d. **Depends on:** ED3D.1b2 (PR #163: `EntityKit`, `Thing`, `LevelProfile.entities`, `lastLightDefinitions`), ED3D.2 (merged: `CheckResult`, `Problem`, `place`, `genericChecks`, the two runners) and ED3D.1b (merged: `afSectorChecks`, `afIdProblems`). Branch `claude/project-thread-ljshus-ed3d-2b1` is stacked on ED3D.1b2's branch (#163).
- **Status:** Drafted 2026-10-23 on the hub's instruction (bus 1242: keep going while the stack waits). Not implemented. Not reviewed; spec review (ED3D.0) is still open. Steps below are ticked only when their checks pass.
- **Progress:** 1 of 3 steps.

## Why this task exists

ED3D.1b2 says what a level holds and why a piece of it could not be read; it does not say whether what was read is right. A crate with a value its field does not allow, a second spawn, a lamp standing in the street outside every room are all problems the problems list must show and Locate must frame, for an `af-sector/1` level and for a Last Light blockout alike. The spec puts the rules in the generic set, so they are written once over the kit and neither runner names a Last Light concept.

## Sources, read at these commits

- **AF (this stack):** `entities/things.ts` (`readEntityKit`, `EntityReadProblem`), the kit's `checkValues` (`@mcthaydt/automata-editor-kit/fields`: `fieldMissing`, `unknownField` and the value codes, each with a sentence that names the field), `checks/check.ts` (`checkResult`, `Problem`, `Locator`, `place`, `entitySelection`, `locators`), `geometry/sectors.ts` (`sectorAt`, `insideSector`: a point on a wall counts as inside, a point in a hole as outside), `profile/af-sector/af-checks.ts` (`afIdProblems`, `afSectorChecks` and its early-outs), `checks/last-light/last-light-checks.ts` (the order and early-outs held to Last Light's own `validate`; the golden compares the seven shared results by id) and `checks/last-light/ids.ts` (the selection ids it writes: `entity:box|hotspot|lamp|anchor|node/<id>`).
- **Data, measured before the rules were written:** every thing of the four shipped blockouts (80, 94, 79 and 79) stands inside a sector, and every value passes `checkValues` under the fixed definitions, so neither rule flags a file Last Light accepts.

## Scope

**In:** `src/checks/entities.ts` (`entityProblems`) and its test; the reader's problems carry the entity they are about (`entities/things.ts`); the `entities` result in `afSectorChecks` and `lastLightChecks`; entity refs in the AF `ids`; the package entry; docs rows.

**Out, with where each goes:**

| What | Where |
|---|---|
| `materials` (a texture named that the profile's table lacks), `lamps` (colour and range outside the game's allowed set) and `policy` (room visibility) | ED3D.2b second part: they need a material table and the game's own limits and policy, which the first part does not |
| A Last Light `ids` rule for things: its own (`box`, `hotspot`, `lamp`, `node`, `zone` references) stays as ported | no change |
| A ref field's `container` | unused: a level is one file, so a ref names a thing or a sector of it |
| Painting problem markers, the problems panel | ED3D.5 and ED3D.11 |

## Decisions this plan makes (each vetoable by the Owner through the Orchestrator)

1. **One check, `entities`, error severity, appended to each runner's results** (AF: after `heights`; Last Light: after `nav`). The spec's table lists the check, not an order; the runners keep the order their results already have, and Last Light's golden compares only the results it recorded, so the one new id is added to that test's list of new checks. It runs only where the level built and resolved: a level that answers `build` or `ids` and `rooms` alone still does.
2. **Problems come in a fixed order:** what the reader could not read (definitions first, then instances, in file order), then for each thing in file order its value problems and then `outside every sector`, then the `single` problems in definition order. Each names the entity and has a locator at it.
3. **Sentences:** a value problem is `entity <id>: <the kit's sentence>` (`entity c1: contents has no option "x"`, `entity c1: loot is required`, `entity c1: tint is not a field of this entity`); the placement is `entity <id> is outside every sector`; a `single` definition with a second thing is `<definition> allows one: entity <id> is another` at the later thing, with the first beside it; the reader's sentences are kept as they are.
4. **A read problem is located when it is about a thing:** `EntityReadProblem` gains `entity?: { def, id, at? }` for an instance whose `def` and `id` are strings (`at` when `x` and `z` are numbers), so an unknown definition and a bad value select the thing. A definition's problem has no locator (a definition is not selectable), as `ids`' duplicate-definition sentence has none.
5. **Refs resolve in `ids`,** where the spec puts them. A `ref` field's value (or each item of a list) names a target; the field's `to` lists what it may be: a definition id (the target is a thing of that definition) or `$sector` (a sector id); absent or empty means any thing or any sector. An unresolved target is `entity <id>: <field> points at <target>, which is no <crate or sector>`, located at the thing; a `to` entry that is neither a definition of the file nor `$sector` is `entity definition <id>: <field> points at <name>, which is not a definition or $sector`, without a locator. Only things the reader accepted are looked at: a thing it could not read is its own problem.
6. **Nothing Last Light's own checks said changes.** Last Light has no `ref` fields (its `on` is text and its own `ids` resolves it), so the ref rule is AF's alone; the entity check runs on Last Light's fixed set, and the four shipped blockouts pass it.

## Contract

```
packages/editor-3d/src/checks/entities.ts                  entityProblems
packages/editor-3d/src/checks/entity-refs.ts               entityRefProblems
packages/editor-3d/src/entities/things.ts                  EntityReadProblem gains entity?
packages/editor-3d/src/profile/af-sector/af-checks.ts      afSectorChecks and afIdProblems run them
packages/editor-3d/src/checks/last-light/last-light-checks.ts   lastLightChecks runs entities
packages/editor-3d/src/index.ts                            the public entry gains both functions
```

```ts
/** What is wrong with the things of a level: the read problems, the values, the places, the `single` definitions. */
export function entityProblems(kit: EntityKit, map: ResolvedMap): Problem[]
/** The ref fields that point at nothing, and the `to` lists that name nothing. */
export function entityRefProblems(kit: EntityKit, sectorIds: readonly string[]): Problem[]
```

## Steps

1. **[x] Read problems know their entity.** Failing test first: for an instance with a string `def` and `id`, every read problem it causes (unknown definition, a member that is not a field value, a bad `x`) carries `entity: { def, id }` and `at: { x, z }` when `x` and `z` are numbers (not when either is not); a problem of a definition, and of an entity that is not an object or has no string `def` or `id`, has none. *Files:* modify `entities/things.ts`, `entities/things.test.ts`. *Pass:* the test file, `tsc -p .`, the profile tests unchanged.
   - *Done 2026-10-23:* `EntityRef` and `EntityReadProblem.entity` in `entities/things.ts`, two new tests; the first run failed on the missing `entity` (the second test, that a definition's problem and an unnameable instance's have none, passed from the start and is the guard for the mutants below). Three older expectations (`things.test.ts`, `af-entities.test.ts`, `last-light-entities.test.ts`) listed problems as `{ path, message }` and now carry the entity too. Deviation: none.
2. **[ ] The `entities` check and its runners.** Failing test first (`checks/entities.test.ts`, seeded violations over the toy AF level and the toy blockout): a value outside a field's range, a value not among the options, a required field missing, a member that is not a field, an instance of an undefined definition, a thing outside every sector (and one in a hole), a second `single` thing, each with the sentence and the locator of decisions 2 to 4, in that order; the depot and the four shipped blockouts answer `ok`; `afSectorChecks` and `lastLightChecks` end with an `entities` result, absent when the level did not build or resolve; Last Light's golden test still holds for the results it recorded. *Files:* create `checks/entities.ts`, `checks/entities.test.ts`; modify `profile/af-sector/af-checks.ts` and its test, `checks/last-light/last-light-checks.ts` and its test. *Consumes:* `EntityKit`, `checkValues`, `sectorAt`. *Produces:* `entityProblems`, the `entities` result. *Pass:* the new and changed tests, `tsc`, purity.
3. **[ ] Refs resolve in `ids`.** Failing test first (`checks/entity-refs.test.ts` and the `afIdProblems` cases): a `ref` to a thing that exists passes, to one that does not fails, a list of refs fails at the first bad item's target, `to: ['crate']` takes a crate and not a lamp, `to: ['$sector']` takes a sector id, an absent `to` takes either, a `to` that names nothing is a definition problem; a Last Light blockout is unchanged. Then the gates in order: `pnpm format`, `pnpm docs:stack`, `pnpm check`, `pnpm build`, `pnpm api-index`, `pnpm cheatsheet`, `pnpm agent-skills --write` then `pnpm agent-skills`, `pnpm api-report`; hand mutation over each step's logic. *Files:* create `checks/entity-refs.ts`, `checks/entity-refs.test.ts`; modify `profile/af-sector/af-checks.ts` and its test, `index.ts`, `index.test.ts`; docs: the 02 row and the continuation paragraph. *Pass:* all of the above.

## Mutations

- **Step 1** (`things.ts`, 10 runs from a green baseline): all killed (the `def` and `id` guards, the place needing both numbers, the swap of `x` and `z`, the optional key, the entity passed in each branch).

## Progress record

To be recorded as each step passes.
