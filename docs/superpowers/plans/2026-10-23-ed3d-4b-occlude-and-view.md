# ED3D.4b Wall occlusion and the sector view id: TDD plan

- **Task:** ED3D.4b, a follow-up to ED3D.4. The two content-shape requests the 3D direction spec made of the 3D editor ([M3 3D characters spec](../specs/2026-10-18-m3-3d-characters-design.md) §4.2 "Occluders" and the "3D level editor (ED3D)" paragraph of its follow-ups, draft PR #140): a sector wall may carry `occlude: 'cut' | 'fade' | 'never'` (`'cut'` by default for walls, `'never'` for floors), a sector may carry the `view` id of a `camera-view`, and the editor offers a preview of the view at 24 mm with the cut-away applied, at its eight headings while the rotation answer (M3R-D9) is pending. The spec fixes only the content shape; how the editor shows it is this lane's. [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §4.6 (the `af-sector/1` format), §6 (Dollhouse: near walls cut away) and ED3D-D8.
- **Lane:** editor-3d. **Depends on:** ED3D.1b (PR #129: `af-sector/1`), ED3D.3 (PR #137: the edits and `SectorAccess`), ED3D.4 (PR #148: the mesh, the cutaway, the orbit camera) and ED3D.5a (PR #150, only for the branch stack). Branch `claude/project-thread-ljshus-ed3d-4b` is stacked on #150's branch.
- **Status:** Drafted 2026-10-23 on the coordinator's and the hub's instruction of 10:05 UTC to keep going while the stack waits in the merge queue; the requests were queued with ED3D.1b2, which the kit's `./fields` export blocks, and are independent of it. Not reviewed; spec review (ED3D.0) is still open. Steps below are ticked only when their checks pass.
- **Progress:** 0 of 6 steps.

## Why this task exists

The game's angled follow camera (M3.4) cuts a room's near walls away and fades tagged props so the player is never hidden; which wall does which is authored on the level. The dollhouse already cuts every wall that faces away from the eye, and it cannot say "this wall never goes" (a pillar that holds up the picture) or "this wall fades" (a screen the player walks behind). The sector `view` id is the other half: a room says which authored view the camera takes while the player is in it. Both are small additions to the format, the edits and the mesh, and the preview is the dollhouse the package already has.

## Sources, read at these commits

- **The 3D direction spec, PR #140** (`2026-10-18-m3-3d-characters-design.md`): §4.2 for the content shape, `occlude?: 'cut' | 'fade' | 'never'` on a static mesh or sector wall, `'cut'` by default for walls, `'never'` for floors, `'fade'` by default for props (props are the Things layer, ED3D.7); fade is 25% opacity. "Presentation only; the sim never reads it."
- **AF (this stack):** `format/af-sector.schema.ts`, `format/sector.schema.ts` (`WallDef`), `profile/sector-access.ts`, `profile/af-sector/af-sectors.ts`, `profile/last-light-sectors.ts`, `model/wall-edits.ts`, `model/sector-edits.ts`, `view/mesh/sector-mesh.ts`, `view/mesh/mesh-pick.ts`, `view/mesh/camera-3d.ts`.

## Scope

**In:** `occlude` on `af-sector/1` walls and `view` on `af-sector/1` sectors (format, types, codec round trip); the Last Light profile refusing both (its game reads neither); `Surface.occlude` on the mesh; the cutaway rule with `'never'` and `'fade'`; the eight-heading preview of a mesh; the edits `wall.setOcclude` and `sector.setView`; the package entry.

**Out, with where each goes:**

| What | Where |
|---|---|
| The inspector's controls for the two members | ED3D.5c (over the kit's fields) |
| Fade as an animation, the camera-to-player test, props that fade | The game's renderer (M3.4) and ED3D.7 for things; the editor draws a faded wall at 25% where the rule would cut it |
| A view volume (a box that sets the view id) and the `camera-view` content itself | M3.4 and the content compiler; the editor lists no ids because it cannot know them |
| Camera rotation steps | Pending M3R-D9; the eight headings here are a preview of what 45 degree steps would show |

## Decisions this plan makes (each vetoable by the Owner through the Orchestrator)

1. **`occlude` and `view` are `af-sector/1` members and not Last Light's.** Last Light has its own mechanism (`cut` groups and camera-zone `hideFrom`), and its game reads neither new member. The Last Light profile refuses a room with a `view` and a wall with an `occlude` the way it refuses a sector with no zone (`SectorAccessError`), so an edit cannot write either into a Last Light file. The wall type in the geometry layer gains `occlude` as an addition (like `Edge.notch`), which no Last Light code reads.
2. **A surface cuts by its wall's `occlude`.** `'cut'` (the default): cut away when the eye is on the outer side of the wall, as now. `'never'`: always drawn. `'fade'`: drawn, at 25% where `'cut'` would have cut it. Floors are `'never'`, ceilings `'cut'` (the angled view draws no ceiling, as the spec's rule (2) says). A wall's `occlude` applies to every surface it makes (wall, lower, upper), and to its door panel.
3. **A faded surface is shown and is picked.** The editor's preview has no player, so the question "does it stand between the camera and the player" cannot be asked; a faded wall is drawn where a cut wall would be gone, and it can be selected through.
4. **The eight headings are the home yaw plus `k` times 45 degrees.** A pure function over the mesh returns for each heading its camera, the count of surfaces cut and of faded: what the viewer artifact computed by hand. The orbit's yaw is a compass heading; the home heading is the dollhouse's (45 degrees).
5. **The edits are the inspector's two commands.** `wall.setOcclude` (a value, or `null` to take it off, which is the default) and `sector.setView` (an id, or `null`). Both coalesce, refuse an unknown sector or corner, and write nothing when nothing changes. `view` is any non-empty id without `:` or `/` (the same rule as the ids the selection uses): the editor cannot check it against content it does not have.

## Contract

```
packages/editor-3d/src/format/sector.schema.ts        WallDef.occlude (type only)
packages/editor-3d/src/format/af-sector.schema.ts     afWallSchema.occlude, afSectorEntrySchema.view, OCCLUDES
packages/editor-3d/src/profile/sector-access.ts       EditSector.view
packages/editor-3d/src/profile/last-light-sectors.ts  refuses view and occlude
packages/editor-3d/src/view/mesh/sector-mesh.ts       Surface.occlude
packages/editor-3d/src/view/mesh/mesh-pick.ts         surfaceVisibility, visibleSurfaces, pickMesh by it
packages/editor-3d/src/view/mesh/camera-3d.ts         HEADINGS, headingPreview
packages/editor-3d/src/model/wall-edits.ts            setWallOcclude
packages/editor-3d/src/model/sector-edits.ts          setView
packages/editor-3d/src/index.ts                       the public entry gains them
```

```ts
export type Occlude = 'cut' | 'fade' | 'never'
export const OCCLUDES: readonly Occlude[]

export type Visibility = 'shown' | 'faded' | 'cut'
export function surfaceVisibility(surface: Surface, eye: Vec3): Visibility

export interface HeadingView {
  readonly heading: number          // 0 to 7: the home yaw plus heading x 45 degrees
  readonly camera: Camera3D
  readonly cut: number              // surfaces cut away at this heading
  readonly faded: number            // surfaces drawn at 25%
}
export function headingPreview(mesh: SectorMesh, size: Size, options?: { pitch?: number; yaw?: number }): HeadingView[]

export function setWallOcclude<D>(args: { sector: string; corner: number; occlude: Occlude | null }): Edit<D>
export function setView<D>(args: { id: string; view: string | null }): Edit<D>
```

## Steps

Tests use the package's fixtures: the depot (two rooms and a portal) with `occlude` and `view` added by hand in the test, and the Last Light clinic for the refusals.

- [ ] **1. The format members** (`af-sector.schema.test.ts`, `af-codec.test.ts`, `last-light-codecs.test.ts` or `last-light-sectors.test.ts`; `format/af-sector.schema.ts`, `format/sector.schema.ts`, `profile/sector-access.ts`, `profile/last-light-sectors.ts`).
  - *Red, by case:* a wall with `occlude` of each of the three values parses and is kept; any other value (a number, `"hide"`) is an issue at the wall's path; a sector with `view` as a string parses; a non-string `view` is an issue; both survive a patch round trip byte for byte when unchanged and appear as written when set (the codec's own tests, one wall and one sector); a Last Light room with a `view` and a wall with an `occlude` are refused with a sentence by `withSectors` (and the room without them is accepted as before).
  - *Expected failure:* the schema keeps unknown members, so the valid cases pass and the invalid values parse; the refusals do not throw.
- [ ] **2. The mesh carries it** (`sector-mesh.test.ts`; `view/mesh/sector-mesh.ts`).
  - *Red, by case:* every wall, lower, upper and door surface of a wall with `occlude: 'never'` says so, one with `'fade'` says so, and a wall with none, or an unknown value (a Last Light file), says `'cut'`; floors say `'never'` and ceilings `'cut'`; a portal wall's strips take the occlude of the wall they come from, and the neighbour's reverse wall its own.
  - *Expected failure:* surfaces have no `occlude`.
- [ ] **3. The cutaway rule** (`mesh-pick.test.ts`; `view/mesh/mesh-pick.ts`).
  - *Red, by case:* `surfaceVisibility` for each `occlude` with the eye on the near side and on the far side: `cut` is `shown` then `cut`, `never` is `shown` both, `fade` is `shown` then `faded`; `visibleSurfaces` keeps `shown` and `faded` and drops `cut`; `pickMesh` passes through a cut surface, stops at a never surface from outside, and picks a faded one; the existing cases (Walk sees all of its room's walls, a ray through a cut wall goes on) hold.
  - *Expected failure:* `surfaceVisibility` is missing and `never` is cut.
- [ ] **4. The eight headings** (`camera-3d.test.ts`; `view/mesh/camera-3d.ts`).
  - *Red, by case:* `headingPreview` over the depot returns eight views whose yaws step 45 degrees from the home yaw (the options' `yaw` overrides it), the same pitch and a distance that fits the mesh at every heading; the counts of cut surfaces match `mesh.surfaces` filtered by `surfaceVisibility` at each camera's eye; a wall tagged `never` is cut at no heading and a `fade` wall is counted faded and not cut; a mesh with no surface gives eight views of the empty bounds.
  - *Expected failure:* the function is missing.
- [ ] **5. The two edits** (`wall-edits.test.ts`, `sector-edits.test.ts`; `model/wall-edits.ts`, `model/sector-edits.ts`).
  - *Red, by case:* `setWallOcclude` sets a value on a wall that has none and on a wall that has other members (kept), changes it, takes it off with `null` (the wall with nothing else left loses its third member, as the other wall edits do), refuses a value that is not one of the three, an unknown sector and a corner past the outline, writes nothing when the value is the one it has, is one coalescing step for a run, and is refused on a Last Light level with the profile's sentence; `setView` sets, changes and clears a sector's `view`, refuses an empty id and one with `:` or `/`, an unknown sector, and a Last Light level, and writes nothing when unchanged.
  - *Expected failure:* the edits are missing.
- [ ] **6. Gates and records.**
  - *Run in order:* `pnpm format`, `pnpm docs:stack` (commit if it changes), `pnpm check`, `pnpm build`, `pnpm api-index`, `pnpm cheatsheet`, `pnpm agent-skills --write` then `pnpm agent-skills`, `pnpm api-report`; hand mutation over each step's logic, listed on its step; the package entry exports the new names (asserted in `index.test.ts`); the viewer artifact shows a wall's occlude and the eight headings from `headingPreview`.
  - *Records:* master plan (02), continuation prompt (03) and the spec's task table in the docs follow-up PR once the stack merges; nothing ticked in 02 from this PR.

## Verification

Local, Node 24: the package's tests and `pnpm check`. No browser or GPU suite is selected (no DOM, no painting, no sim code). How a faded wall reads in the dollhouse is judged on the built editor (ED3D.12) and the Owner's look at the 3D direction (M3R-D9 and D17).

**Owner acceptance:** none of its own. The rotation and look decisions (M3R-D9, M3R-D17) stay with the Owner; this task builds nothing that depends on their answers.

## Risks and how the plan answers them

| Risk | Answer |
|---|---|
| The Last Light golden changes because `WallDef` gained a member | The member is type-only and optional; the schema for Last Light walls is unchanged, and the Last Light goldens and fixtures run in the same `pnpm check` |
| A `'fade'` wall in the preview hides what is behind it | It is drawn at 25% by the renderer from `surfaceVisibility`; the mesh and the pick treat it as there, which is what the game does when the player is behind it |
| The sector `view` id names nothing | The editor cannot know the game's `camera-view` ids; the content compiler (M3.4) is the check, and an unknown id is data, not an error here |
| The 45 degree steps are not what the Owner chooses (M3R-D9 pending) | `headingPreview` takes the step as the constant `HEADINGS = 8`; a free rotation answer removes the tiles and keeps `surfaceVisibility` |
