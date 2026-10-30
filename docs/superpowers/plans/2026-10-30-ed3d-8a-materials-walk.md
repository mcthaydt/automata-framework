# ED3D.8a Materials, hints and the Walk controller (headless): TDD plan

- **Task:** ED3D.8a, the first part of ED3D.8. [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §4.1 (`materials` and `hints` on `LevelProfile`), D8 (Walk: virtual sticks first, eye 1.6 m, fov 69°; Fly and Orbit are modes of the same camera), D10 (the material set comes from the profile), §5.3 flows 4 (Walk) and 5 (Retexture: the material sheet applies to this wall, the room, or matching walls, in one transaction), §9 (Walk: Walk, Fly, Orbit; wall picked or not; no spawn. Material picker: searching, empty search, selected, apply scope), §10 (WASD and Q E in Walk) and ED3-n (a level with no spawn: the camera starts at the first sector's centre with a warning). The logic only, as plain TypeScript: no Svelte, DOM, Pixi or clock.
- **Lane:** editor-3d. **Depends on:** ED3D.4 (merged: `walkStart`, `walkCamera`, `rayThrough`, `orbitCamera`, `orbitBy`, `buildSectorMesh`, `pickMesh`, `selectionOf`) and ED3D.3 (merged: `LevelEditor`, `setWallMaterial`, `setMaterials`, `withWall`). Branch `claude/editors-ed3d-8a-ed3d-8a-materials-walk` from `main`.
- **Status:** Drafted 2026-10-30. Not reviewed; the spec review (ED3D.0) is still open. Steps are ticked only when their checks pass.
- **Progress:** 5 of 5 steps (local checks run; CI, review and Owner acceptance pending).

## Sources, read at these commits

- **The Last Light `92e6704`:** `editor/src/server/level-options.ts` (`readLevelOptions`: the material keys are the members of the renderer's `sectorMats` and `unlitMats`, in `src/render/stage.ts`; a list that cannot be read is `null`, "and edits that need it are refused rather than guessed"); `editor/src/server/level-edits.ts` lines 519 to 575 (the style and material edit, whose refusal sentence for a missing list is reused word for word: `the material keys could not be read from the renderer (src/render/stage.ts)`); `editor/src/client/levels.ts` `structureFields` (the inspector's material selects: a room's floor, ceiling and walls, and one wall's texture); `src/input.ts` (WASD, and Q and E as actions). Last Light has no 3D view in its editor and no picker with categories: the sheet, the scopes and Walk are new here, on the mockups (`docs/design/editor-3d/screens.mjs`, `walk` and `materials`). Nothing is copied from it but the sentence and the list rule.
- **AF:** `profile/level-profile.ts` (`ProfileContext`, whose `materials` the ED3D.2b2 `materials` check already reads), `format/af-sector.schema.ts` (`AfMaterial`: `category`, `label`, `wallOnly`), `model/wall-edits.ts`, `model/sector-edits.ts`, `view/mesh/camera-3d.ts`, `view/mesh/mesh-pick.ts`, `view/mesh/sector-mesh.ts`, `geometry/sectors.ts` (`colliders`, `crossing`, `sectorAt`), `app/geometry-cache.ts`.

## Scope

**In:**

| What | File |
|---|---|
| `Material`, `MaterialList`, `LevelHints`; each profile's list and hints | `src/profile/materials.ts` (new); `level-profile.ts`, `af-sector-profile.ts`, `last-light-profile.ts` (members added) |
| Apply a material to a wall, a room or the matching walls (or a floor or ceiling) as one edit | `src/model/material-edits.ts` (new) |
| The material picker model | `src/view/materials/material-picker.ts` (new) |
| The Walk controller | `src/view/walk/walk-controller.ts` (new) |
| Public entry | `src/index.ts` (additive) |

**Out, with where each goes:** the Walk viewport, sticks, crosshair, minimap, selection chip and wall card, and the material sheet: ED3D.8b. ED3-f and ED3-s in the UI: ED3D.8b. Editing the AF materials table: ED3D.13a. Props and lamps in the 3D mesh (Walk picks sectors and walls only until the mesh draws things): ED3D.8b with 5e. `src/app` is not touched (ED3D.5b and ED3D.7b are working there): the two controllers live in `src/view/`, the spec §3 layout's home for the walk view's tools.

## Decisions this plan makes (each vetoable by the Owner)

1. **`materials(doc, context?)` answers a list or a refusal.** `MaterialList` is `{ ok: true, materials }` or `{ ok: false, reason }`. AF: the file's `materials` table in file order (`category`, `label` and `wallOnly` as written); a file with no table refuses (`the level has no materials table`). Last Light: the context's `materials` (the host reads it from `sectorMats` and `unlitMats`, as ED3D.2b2's check does), each with the category `lit`, or `unlit` when the context's new `unlitMaterials` lists it; an absent or `null` list refuses with Last Light's own sentence. The spec's `materials(doc)` gains the context because Last Light's list is not in the file. The spec's `preview` is left out: the tiles are procedural placeholders until the art folder defines a set (spec open question 4), so the view draws one from the id.
2. **Hints.** `{ unit: 'm', eyeHeight: 1.6, fov: 69° in radians, snap: 0.05 }` for both profiles (D8; 0.05 m is the Last Light editor's snap and the plan's data step). `fov` is in radians, as `Camera3D.fov` is.
3. **Apply, one transaction.** `applyMaterial({ target, scope, material })` is one `Edit` (one undo step). The target is a wall (`{ wall: WallRef }`) or a sector's floor, ceiling or walls (`{ sector, surface }`). **This wall** sets the wall's `texture` (or the sector's `floorTexture` / `ceilingTexture`). **Room** sets the sector's `wallTexture` and takes each wall's own `texture` off, outline and holes (for a floor or a ceiling, Room is the same as This wall). **Matching** finds what the target is made of now (the wall's own texture, its preset's, else its sector's, as the geometry resolves it) and gives the material to every wall and sector made of that: a sector whose walls take it from the sector gets a new `wallTexture`, a wall that names it itself gets a new `texture`; for a floor or ceiling, every sector whose floor (ceiling) is made of it. A wall preset's or a style's texture is a shared definition and is not rewritten (spec §5.1: definitions change only through an explicit Styles action): a wall whose preset names another material, and a sector whose style does, get a member of their own, which wins over it. A wall of a hole is read as written (its own texture, else its sector's): the resolved geometry maps only outline walls back to the file. A `wallOnly` material on a floor or ceiling is refused (`brick is for walls only`); an edit that changes nothing is no step.
4. **The picker refuses without a list.** `apply()` answers the profile's refusal when the list is a refusal, so a Last Light level whose host could not read the renderer's materials changes nothing. The picker offers only listed ids, so a picked material is always in the list.
5. **Scale and brightness are preview settings.** Neither format has a per-surface texture scale or brightness (Last Light's scale is the material's own `uv`; light is the sector's `light`, edited by the sector card). The picker holds them for the preview tile: scale from 0.25× to 4× (default 1×), brightness from 0 to 1.5 (default the target sector's `light`). They are not written to the level.
6. **The picker's state.** Categories in the order the list first names them, each with a count; the open category is the one the target's current material is in, else the first. A search (trimmed, case-insensitive, on id and label) lists matches from every category; a search with no matches is the empty state. "Used in this level" is the listed materials the resolved level names, in list order.
7. **Walk input.** Two sticks, each `{ x, y }` in -1 to 1 (`y` up is forward and look up); keys by `KeyboardEvent.code`: W, A, S, D move and strafe; Q and E turn left and right in Walk and Orbit, and go down and up in Fly. A stick and the keys add, each axis held to -1 to 1 and the move to length 1. `lift(-1 to 1)` is the Fly mode's up and down buttons. Time is `tick(seconds)` from the view's frame loop, held to 0.1 s a tick; the controller reads no clock.
8. **Walk mode.** 3 m/s, a look of 120°/s at full tilt, pitch held to ±85°. The eye stays `eyeHeight` above the floor of the sector it is in. A step is refused when it would leave every sector, or cross a collider of the geometry (solid walls, steps too tall to climb, blocking masks) on its way out of the collider's room, or come nearer than 0.25 m to one (a step away from a wall the eye already stands too near is allowed, so Walk is never stuck); a refused step slides along x, then along z. A collider stops only what leaves its own room, so a step down through a portal is crossed and the same step back up is not. A portal is no collider, so Walk crosses at a portal (ED3-s).
9. **Fly and Orbit.** Fly moves along the look (pitch included) at 6 m/s with no collision. Orbit looks at a target from 8 m at 30° (the dollhouse's pitch); the look stick turns and tips it (`orbitBy`), the move stick slides the target over the plan. Leaving Fly or Orbit for Walk drops onto the floor under the eye (Orbit: under the target), or back to the last place Walk stood when that is outside every sector. Walk and Fly use the profile's fov, Orbit the 24 mm lens.
10. **Start (ED3-n).** The camera starts by `walkStart`: at the level's `spawn` thing (the first thing of the definition `spawn`, facing its `facing` field, 0 when it has none), else in the middle of the first sector with the warning in `view.warning`, which stays until `restart()` finds a spawn.
11. **The crosshair pick.** `view.aim` is what the ray through the canvas's centre hits, kept up to date as the camera or the level changes. A hidden layer is not hit (the ray goes through it), a locked one stops the ray and selects nothing; floors and ceilings are the `sectors` layer, the rest the `walls` layer. `pick()` (a tap) selects the aim's id, or clears the selection when there is none.

## Contract

```ts
// src/profile/materials.ts
export interface Material { readonly id: string; readonly category: string; readonly label?: string | undefined; readonly wallOnly?: boolean | undefined }
export type MaterialList = { readonly ok: true; readonly materials: readonly Material[] } | { readonly ok: false; readonly reason: string }
export interface LevelHints { readonly unit: 'm'; readonly eyeHeight: number; readonly fov: number; readonly snap: number }
// LevelProfile<D> gains: materials(doc: D, context?: ProfileContext): MaterialList; readonly hints: LevelHints
// ProfileContext gains: unlitMaterials?: readonly string[] | null | undefined

// src/model/material-edits.ts
export type MaterialTarget = { readonly wall: WallRef } | { readonly sector: string; readonly surface: 'floor' | 'ceiling' | 'walls' }
export type MaterialScope = 'wall' | 'room' | 'matching'
export function applyMaterial<D>(args: { target: MaterialTarget; scope: MaterialScope; material: Material }): Edit<D>
export function materialOf<D>(profile, level, target): string | undefined   // what the target is made of now

// src/view/materials/material-picker.ts
export function createMaterialPicker<D>(editor: LevelEditor<D>, options: { target: MaterialTarget; context?: ProfileContext }): MaterialPicker

// src/view/walk/walk-controller.ts
export function createWalkController<D>(editor: LevelEditor<D>, canvas: Size): WalkController
```

## Steps

### Step 1: materials and hints on both profiles
- [x] Failing tests `src/profile/materials.test.ts`: the depot's table in file order with category, label and wallOnly; a level with no table refuses; Last Light with the golden's list (`game-facts.golden.json` `options.materials`) gives every id, `unlit` for `glass` and `moonGlass` when the context says so and `lit` otherwise; absent and `null` refuse with Last Light's sentence; both profiles' hints are 1.6 m, 69° and 0.05 m.
- [x] Minimal code; `pnpm --filter @mcthaydt/automata-editor-3d exec vitest run src/profile` passes.

### Step 2: `applyMaterial`
- [x] Failing tests `src/model/material-edits.test.ts` over the toy level and the depot: This wall sets one wall; Room sets `wallTexture` and takes the walls' own textures off (holes too); Matching changes every wall and sector made of the target's material and nothing else (a wall that says something else keeps it; a sector that inherits from a style gets its own member); floor and ceiling in each scope; `wallOnly` on a floor refused; no sector, no wall refused; the same material again is the level itself; through `LevelEditor.run` it is one undo step.
- [x] Minimal code; the file's tests pass.

### Step 3: the material picker
- [x] Failing tests `src/view/materials/material-picker.test.ts`: categories and counts, the open category, search (match on id and label, across categories, empty state, clearing), select, scale and brightness held to their ranges and defaulting from the sector, scope, used in this level, `apply` is one undo step that writes the scope, and a refusing list refuses `apply` and changes nothing (Last Light without a list).
- [x] Minimal code; the file's tests pass.

### Step 4: the Walk controller
- [x] Failing tests `src/view/walk/walk-controller.test.ts`: starts at the spawn; no spawn starts in the first sector with the warning (ED3-n); WASD and the move stick walk at 3 m/s on an injected tick; the look stick and Q and E turn; pitch held to 85°; a solid wall stops the walk and the walk slides along it; a portal is crossed and the eye follows the floor down (ED3-s's half); Fly rises with E and `lift` and moves along the look; Orbit turns with the look stick; back to Walk lands on the floor; the aim is the wall in front, `pick` selects it and a tap at nothing clears; a hidden walls layer is seen through and a locked one selects nothing; an edit that changes the level moves the aim; the tick is held to 0.1 s.
- [x] Minimal code; the file's tests pass.

### Step 5: entry and gates
- [x] `index.ts` exports the new public names; `index.test.ts` lists them.
- [x] `pnpm format`; `TURBO_FORCE=true pnpm check` exit 0 (its unit stage rerun serially, below); `pnpm changeset status --since=origin/main`; `node tooling/release/src/check-changesets.ts` (the package is private: no changeset).

## Execution log

- Step 1 (2026-10-30): `materials.test.ts` failed first on the missing module; with `profile/materials.ts` and the two members on each profile, 7 tests pass and `tsc -p .` is clean.
- Step 2 (2026-10-30): `material-edits.test.ts` written first (module missing); 14 tests pass on `material-edits.ts`. Two mutations (matching never rewriting a wall's own texture; Room never giving a preset wall its own member) each fail a test, so both branches are held. A first Room rule (clear every own texture, or keep one on a preset wall) missed a preset that names a material; Room now resolves the level again after clearing and gives such a wall its own member.
- Step 3 (2026-10-30): `material-picker.test.ts` failed first on the missing module; 13 tests pass on `view/materials/material-picker.ts`. One expectation was wrong in the test (a search for `r` cannot match `plank` or `Oak planks`) and was corrected to a search for `a`. The level's facts (the target's material and the materials in use) are kept for each level and target, so scrubbing scale or brightness rebuilds no geometry.
- Step 4 (2026-10-30): `walk-controller.test.ts` failed first on the missing module; on the first run of `view/walk/walk-controller.ts` 15 of 17 passed. The wall test failed for a real reason: reaching 0.25 m past the step along its own direction let a diagonal push come to 0.18 m of the wall, so the rule became a distance (a step may not come nearer than 0.25 m to a collider). The Fly landing test was fragile (ten ticks ended within 2e-15 of the portal line, on the hall side) and now flies eleven. 17 pass; dropping the inward-side test of a collider fails the portal test.
- Step 5 (2026-10-30): the entry exports `applyMaterial`, `materialOf`, `createMaterialPicker`, `createWalkController`, `LAST_LIGHT_NO_LIST` and their types (18 entry tests pass). `TURBO_FORCE=true pnpm check`: lint, typecheck (35 packages), boundaries, style and knip passed; the unit stage was killed twice (exit 137, `Killed` in `@af-examples/base-2d`, a package this task does not touch) by memory pressure on the shared machine, first-attempt evidence kept. Changeset status: none needed (private package); `check-changesets`: 0 problems.
- Step 5, unit stage rerun: `TURBO_FORCE=true VITEST_MAX_WORKERS=1 turbo run test:unit --concurrency=1` exit 0, 33 of 33 tasks; editor-3d 105 files, 2431 tests.
