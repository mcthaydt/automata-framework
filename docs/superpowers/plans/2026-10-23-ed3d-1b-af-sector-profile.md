# ED3D.1b AF sector profile: TDD plan

- **Task:** ED3D.1b. [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §4.1 (the level profile), §4.3 (geometry owner), §4.6 (`af-sector/1`), §4.7 (the entity data it carries), acceptance case ED3-q (the depot, byte for byte, in the same build as a Last Light level) and the profile-and-geometry half of ED3-s. This plan builds everything of the row that does not need the kit's field and entity definition shapes; the typed entity model is **ED3D.1b2**, after EDK.7 merges (below).
- **Lane:** editor-3d. **Depends on:** ED3D.1 (PR #107), ED3D.1c (PR #113) and ED3D.2 (PR #127); branch `claude/project-thread-ljshus-ed3d-1b` is stacked on #127's. No editor-kit code, no Svelte, no DOM.
- **Status:** Drafted 2026-10-23. Not reviewed. Written and built on the Orchestrator's go-ahead of 02:20 UTC (bus), like ED3D.1; spec review (ED3D.0) is still open.
- **Progress:** 2 of 6 steps.

## Why this task exists

Until now the package holds one profile's worth of code: the Last Light format, its codec, its geometry and its checks, none of them behind a common shape. The editor core must never name a Last Light concept (spec §4.1), and the Owner's decision of 2026-10-23 makes the editor genre-general, with a second, native format: `af-sector/1`, a sector level with no Last Light idea in it (no camera zones, nav graph, openings-as-connectors or exports). This task adds that format (schema, build to the same engine data the views already read, the codec rules), the shipped depot sample that proves it, the `LevelProfile` shape the editor core will import, the two profiles behind it and the registry that picks one from a file.

## Sources, read at these commits

- **The Last Light, `mcthaydt/PixiJS3D_Experiment_001` at `92e6704`:** `src/game/sector-format.ts` (the sector vocabulary the schema already carries, `sector.schema.ts`) and `scripts/pipeline/blockout-format.ts` `roomSector` (a room becomes a `SectorDef`; the part `build` reuses is its field handling and style layering, without presets, zones or openings).
- **AF:** `sector.schema.ts`, `expand.ts` (`SectorDef`), `geometry/sectors.ts` (`resolveMap`) and `checks/` (ED3D.1, ED3D.1c, ED3D.2), `profile/file-codec.ts` and `last-light-codecs.ts`, the codec rules (`PatchRules`) and `roundtrip.test.ts`.
- **Kit spec §4.8** (`FieldDef`, `EntityDef`; owned by the 2D thread, EDK.7 in PR #116): read for the shape this task leaves room for; **not imported** here.

## Scope

**In:** `src/format/af-sector.schema.ts`; `src/profile/af-sector/` (`build`, the checks, the codec rules); the depot fixture and its recorded provenance; `src/profile/level-profile.ts`, `last-light-profile.ts`, `af-sector-profile.ts` and `registry.ts`; the wall locator made generic (it moves from `checks/last-light/` to `checks/`); the public exports.

**Out:**

| What | Where |
|---|---|
| Typed entity definitions and instances (`FieldDef`/`EntityDef` from the kit, instance validation, `entities(doc)`, the Last Light fixed set read through the same mechanism) | **ED3D.1b2**, after EDK.7 (#116) and the kit package it needs (EDK.1, #106) are on `main`. Until then `entityDefs` and `entities` are carried as loose objects with an `id` (and `def`), so the file round-trips and its ids can be checked |
| `materials` and `hints` on the profile, the material picker | ED3D.8 |
| AF `materials`, `entities`, Last Light `materials`, `lamps`, `policy` checks | ED3D.2b, after ED3D.1b2 |
| Authoring a new `af-sector/1` file, editing definitions | ED3D.13 |
| Terrain and open worlds | post-launch (`TERRAIN.0`); `geometry` returns a list of layers so a second kind can be added |
| Whether the 3D framework adopts `af-sector/1` | M9 (spec §15 question 5) |

## Decisions this plan makes (each vetoable by the Owner through the Orchestrator)

1. **The plan is the exact schema** (spec §4.6 says so). The spec's sketch uses `"style": "brick"` against a `materials` table; the format has the Last Light shape instead, a `styles` table (`floorTexture`, `ceilingTexture`, `wallTexture`, `trim`) that a sector names with `style`, and `materials` is the picker's list of texture ids (`{ category, label?, wallOnly? }`). A texture id that is not in `materials` is the `materials` check's to report (ED3D.2b); the schema does not look.
2. **Entity instance ids are unique across the file, not per definition.** The codec matches id arrays by `id`, and a composite key would change the diff for every profile. The selection id stays `entity:<definition>/<id>`, and the editor generates `crate1`, `crate2`.
3. **A corner's wall is an inline object**; there are no wall presets in v1 (`walls` is Last Light's). An AF wall is Last Light's `WallDef` without `hideFrom` and `cut` (camera-zone concepts); a file that carries them keeps them as unknown members.
4. **Versioning:** `format` is `af-sector/<major>` or `af-sector/<major>.<minor>`. Major 1 opens; a minor above 0 opens with a warning; any other major is refused with an issue at `["format"]`. The warning rides on the parse result (`warnings`, empty for Last Light).
5. **A level that cannot be built is an error to the profile and a result to the checks.** `geometry(doc)` throws a `GeometryError` with the engine's own sentence (`unknown style x`, `a: unknown portal target b`); `checks(doc)` never throws and returns it as the early-out result (`build`, `rooms`), as Last Light's `expand` and `rooms` do.
6. **The sector's `zone` is empty in the built engine data**: AF has no camera zones, and nothing the views or checks read uses it.

## Contract

```
src/format/af-sector.schema.ts            AF_SECTOR_FORMAT, afFormatVersion, AfSector, AfSectorEntry, AfWall, AfCorner,
                                          AfMaterial, AfEntityDef, AfEntity, afSectorSchema
src/profile/af-sector/build.ts            AfBuildError, buildSectors
src/profile/af-sector/af-checks.ts        afIdProblems, afSectorChecks
src/profile/af-sector/af-codec.ts         afSectorCodec (rules + member orders)
src/checks/wall-locator.ts                wallLocator (moved; takes the sectors' ids and corners)
src/profile/level-profile.ts              GeometryLayer, Geometry, GeometryError, LevelProfile, ProfileContext
src/profile/last-light-profile.ts         lastLightProfile
src/profile/af-sector-profile.ts          afSectorProfile
src/profile/registry.ts                   profiles, detectProfile
src/testing/fixtures/depot.af-sector.json the sample (authored here; SOURCE.json says so)
```

```ts
export interface AfEntityDef { readonly id: string; readonly [member: string]: unknown }            // loose until ED3D.1b2
export interface AfEntity { readonly def: string; readonly id: string; readonly x: number; readonly z: number; readonly [member: string]: unknown }
export interface AfSectorEntry { id; floor; ceiling; light; open?; style?; floorTexture?; ceilingTexture?; wallTexture?; trim?; corners: AfCorner[]; holes?: AfCorner[][] }
export type AfCorner = readonly [number, number, (AfWall | undefined)?]
export interface AfSector { format: string; name: string; materials?: Record<string, AfMaterial>; styles?: Record<string, Style>; sectors: AfSectorEntry[]; entityDefs?: AfEntityDef[]; entities?: AfEntity[] }

export type GeometryLayer = { readonly kind: 'sectors'; readonly map: ResolvedMap; readonly nav?: NavWorld }
export interface Geometry { readonly layers: readonly GeometryLayer[] }
export interface ProfileContext { readonly puzzleHotspots?: readonly string[] | null }
export interface LevelProfile<D> extends FileCodec<D> {
  geometry(doc: D): Geometry                                  // throws GeometryError
  checks(doc: D, context?: ProfileContext): CheckResult[]     // never throws
}
export function detectProfile(text: string): { readonly profile: LevelProfile<unknown> } | { readonly reason: string }
```

`ParseResult` gains `warnings?: readonly ParseIssue[]` on the success side (absent for Last Light).

## Steps (strict TDD: failing test first, then the minimal change; tick a step when its checks pass)

- [x] **1. The `af-sector/1` schema and its version rule** (`af-sector.schema.test.ts`; `af-sector.schema.ts`).
  - *Red, by case:* a minimal level (one sector with four corners) parses and keeps what it was given; `format: "af-sector/1"`, `"af-sector/1.2"` parse; `"af-sector/2"`, `"last-light/1"`, `"af-sector/"` and a missing `format` fail with the issue at `["format"]`; `afFormatVersion` reads `{ major, minor }` and `undefined` for a malformed one; a sector missing `id`, `floor`, `ceiling`, `light` or `corners` fails at that member; corners need at least three points and a corner's third member is a wall object; a wall carries `next`, `door`, `window`, `mask`, `pilaster` and the rest of `WallDef` and keeps an unknown member; unknown members at every level (root, sector, corner wall, entity) are kept; `entities` instances need `def`, `id`, `x`, `z`; `entityDefs` need `id`; `styles` and `materials` parse as tables.
  - *Expected failure:* the module is missing.
  - *Done 2026-10-23:* red for the missing module, then green (64 schema tests; the four earlier format suites unchanged). The schema is `af-sector.schema.ts`: a looseObject per level, sector, wall, material, definition and instance, so every unknown member is kept, and the parse of every accepted level is the input itself. `TRIM_PIECES` is now exported from `sector.schema.ts` so the AF wall uses the same trim piece names.
  - *Deviations:* none. (The wall schema is written out, not derived, because `wallSchema` is typed as a `ZodType` and cannot be narrowed.)
  - *Mutations (21 by hand on the schema):* 17 killed at once; four survivors killed by tests added (a version whose minor has a leading zero, `hideFrom` and `cut` staying unvalidated members, an instance's `z` being required, a pilaster keeping an unknown member).
- [x] **2. Build and geometry** (`build.test.ts`; `build.ts`).
  - *Red, by case:* a one-room level builds one `SectorDef` with its fields, `zone: ""` and corners as written; a sector's `style` layers under the sector's own fields exactly as Last Light's `styled` does (the sector's own `floorTexture` wins); an unknown style throws `AfBuildError("unknown style x")`; holes build as loops; two sectors joined by portals (a step down of 0.5 m, as the depot) resolve through `resolveMap` with the portal pair matched and the wall pieces and colliders as Last Light's `expand` gives for the same rooms written as a blockout (the cross-check: rooms and sectors with the same corners compare equal through `resolveMap`, bar `zone`); a portal to a sector that is not there fails in `resolveMap` with its sentence.
  - *Expected failure:* the module is missing.
  - *Done 2026-10-23:* red for the missing module, then green (10 tests). `buildSectors(level)` returns the `SectorDef`s; `resolveMap` resolves them as it resolves Last Light's: the two cross-check cases (the toy hall and dock, and a level with a hole, a window, a door and a pilaster in its walls) equal `expand` of the same rooms written as a blockout in every resolved sector and every piece, collider and sight wall, bar `zone`. The toy level (`src/testing/toy-af-sector.ts`) is the one the later steps' tests use.
  - *Deviations:* (1) Only the members the engine reads reach the `SectorDef` (an unknown member of a sector or a style stays in the file), where Last Light's `roomSector` spreads a room's own fields; the cross-check shows no difference in what resolves. (2) A style is looked up with `Object.hasOwn`, so a style called `toString` is unknown, not inherited. (3) Absent optional members are absent keys, not `undefined` ones.
  - *Mutations (12 by hand):* all killed at once (style lookup and its error, the layering order, a trim replacing the style's whole, the empty zone, holes, wall corners, order, the copied fields).
- [ ] **3. The depot and the codec** (`af-codec.test.ts`, `depot.test.ts`; `af-codec.ts`, `depot.af-sector.json`, `fixtures.ts`, `SOURCE.json`; the seeded round trips gain the depot).
  - *Red, by case:* the shipped depot (two rooms, a loading dock one step down joined by a portal pair, a door and a window, `entityDefs` for `spawn` and `crate`, two instances; no Last Light concept in the file) parses; `patch(text, v, v)` returns the text byte for byte (ED3-q); setting the hall's ceiling changes exactly that number's span and the previous model patched back restores the bytes; a new sector is inserted in the file's layout and lands after `sectors`' last element, a new top-level member (`styles`) lands where the member order puts it (`format`, `name`, `materials`, `styles`, `sectors`, `entityDefs`, `entities`), a new instance is inserted by its `id`, a removed instance is removed; reordering nothing; the seeded run of random edits over the depot reads back, touches only its bytes and reverts, as it does on the five Last Light files; the codec's `parse` of a newer-major file refuses and of a newer-minor file returns `warnings`; a Last Light file given to the AF codec fails at `["format"]`.
  - *Expected failure:* the modules and the fixture are missing; the round-trip suite has no depot.
- [ ] **4. AF checks and the generic wall locator** (`af-checks.test.ts`, `wall-locator.test.ts` moved; `af-checks.ts`, `checks/wall-locator.ts`).
  - *Red, by case:* `afIdProblems`: a sector id twice (`sector hall twice`, located at the second with the first in `related`), an entity id twice (`entity crate1 twice`, located by `entity:<def>/<id>`), an `entityDefs` id twice (no locator: definitions are not selectable). `afSectorChecks` returns, in order, `ids`, `shared-walls`, `openings`, `overlap`, `heights` on a level that builds and resolves; a style that does not exist answers `build` alone (`unknown style x`); a portal to nowhere answers `ids` and `rooms` (as Last Light does) and no more; the depot passes everything, and breaking one side of its portal makes `openings` fail with the wall located by corner; an overlap and a ceiling below a floor fail as in the generic checks. The Last Light wall-locator tests keep passing from `checks/wall-locator.ts` with the same expectations, now given `blockout.rooms`.
  - *Expected failure:* the modules are missing and the locator is not at its new path.
- [ ] **5. The level profile and the registry** (`level-profile.test.ts`, `registry.test.ts`; `level-profile.ts`, `last-light-profile.ts`, `af-sector-profile.ts`, `registry.ts`).
  - *Red, by case:* each profile is its codec plus `geometry` and `checks`. `lastLightProfile.geometry(blockout)` is one `sectors` layer holding the resolved map of `expand`'s output and a `NavWorld` for it (the four shipped blockouts equal the geometry golden's map), and throws `GeometryError("opening ab: unknown room nowhere")` for a blockout that does not expand; `checks` is `lastLightChecks` with the context's `puzzleHotspots`. `afSectorProfile.geometry(depot)` is one layer and no nav; `checks` is `afSectorChecks`. `detectProfile` returns the AF profile for the depot (a string `format` starting `af-sector/`), the Last Light blockout profile for each shipped blockout (an array `rooms` and a string `scene`), and a reason for `facility.json` (it has a codec and no profile), for JSON that is neither, and for text that is not JSON; the same call opens the depot and a Last Light level (ED3-q's second half) and `profiles()` lists both with their ids.
  - *Expected failure:* the modules are missing.
- [ ] **6. Gates and records.**
  - *Run in order:* `pnpm format`, `pnpm docs:stack` (commit if it changes), `pnpm check`, and the CI steps `pnpm check` skips (`pnpm build`, `pnpm api-index`, `pnpm agent-skills`, `pnpm api-report`); the public entry exports the format, the profiles and the registry (and keeps the test helpers out); `src/profile` is already a purity layer, and `src/format` too.
  - *Records:* master plan (02), continuation prompt (03) and the spec's task table (ED3D.1b, and the new ED3D.1b2 row) in the docs follow-up PR; nothing ticked in 02 from this PR.

## Verification

Local, Node 24: `pnpm check` and the package's tests. The package has no browser or GPU suite, so parity and e2e are not selected. No goldens of the sim change: this package touches no sim code.

**Owner acceptance:** none of its own; ED3-q is judged on the built editor (ED3D.12) and the Owner's iPad pass.

## Risks and how the plan answers them

- **The AF format drifts from what the kit's definition model needs.** The entity members are loose and carried untouched here, so ED3D.1b2 can tighten them without a format change; the file keeps unknown members.
- **A profile shape that has to change when the model and views land.** `LevelProfile` here has only what rows have delivered (codec, geometry, checks); `entities`, `materials` and `hints` join when their rows land, as spec §4.1 says. No view code imports it yet.
- **The generic wall locator changes behaviour for Last Light.** It is a move with the same tests; the ED3D.2 golden comparison over the corpus keeps running against it.
- **Stack depth.** The branch is on #127, #113 and #107; each merges bottom-up, and the docs follow-up carries the records. If a lower PR gets a merge from `main`, `main` is merged into this branch (no rebase).
