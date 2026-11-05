# ED3D.4c Free heading and the follow camera: TDD plan

- **Task:** ED3D.4c, the camera half of the Owner's 2026-10-23 3D decisions made for the editor: the game's camera turns freely, per pixel, with no 45 degree steps ([M3 3D characters spec](../specs/2026-10-18-m3-3d-characters-design.md) §4.2, M3R-D9, D11, approved and merged with PR #140 at 16:24 UTC). The editor's eight-heading preview (ED3D.4b step 4) shows a snap that no longer exists. This task replaces it with a heading in the game's own units, a sweep of headings, and the game's follow camera (24 mm, 25 degrees down, 5 m back, a heading, a lock) so a designer sees a room as the player will. No UI: the slider, the drag and the inspector are ED3D.5 and the views.
- **Lane:** editor-3d. **Depends on:** ED3D.4 (PR #148: `camera-3d.ts`, the mesh), ED3D.4b (PR #152: `occlude`, `surfaceVisibility`, `headingPreview`). Branch `claude/project-thread-39g5i1-ed3d-4c` is stacked on #161's branch (the tip of the view stack).
- **Status:** Drafted 2026-10-23 17:00 UTC by the lane's successor thread, on the standing go-ahead to keep building while the stacks wait (hub overnight mode, bus 0850). The 3D direction it follows is Owner-approved; the choices of this plan are not and are vetoable below. Not reviewed; spec review (ED3D.0) is still open. Steps are ticked only when their checks pass.
- **Progress:** 3 of 3 steps. Locally checked 2026-10-23 (format, docs:stack, check, build, api-index, cheatsheet, agent-skills, api-report); CI verified, deployed and Owner accepted are open.

## Why this task exists

The spec's camera is `CameraView { yawDeg?, tiltDeg, distance, focusHeight, lag, rotate }` on a 24 mm lens, and the player's heading is an integer in turn units (65,536 to a turn, the sim's own number, §4.2). ED3D.4b previewed "what 45 degree steps would show" while the answer was pending; the answer is free rotation. A designer now needs three things the package does not have: the heading as the game states it (so a `yawDeg` they author is the number the game reads), a look from any heading and from every 15 degrees (the spec's D3-g and D3-h sweep), and the camera as the game places it (so "does this room's near wall go" is answered for the real eye, not the dollhouse's).

## Sources, read at these commits

- **The 3D direction spec, `main` at `8bd81b7`** (PR #140): §4.2 for `CameraView`, the default view (25 degrees, 5 m, focus height 1.0 m, lens 24 mm, 53.13 degrees vertical), "heading is sim state" (an integer in turn units, wrapping at 65,536; 0 looks toward +z), the turn speed (0.25 degrees a pixel by default, so 1,440 px is a full turn), the occluder rule, M3R-D11 (tilt 15 to 60, distance 3 to 12 as authored ranges), D3-g and D3-h (every 15 degrees of heading).
- **AF (this stack):** `view/mesh/camera-3d.ts` (`orbitCamera`, `fitOrbit`, `ORBIT_FOV`), `view/mesh/heading-preview.ts`, `view/mesh/mesh-pick.ts` (`surfaceVisibility`), `view/mesh/sector-mesh.ts`.

## Scope

**In:** `view/mesh/heading.ts` (turn units, conversions to and from the editor's compass bearing and from `yawDeg`, a drag in pixels to units, `headingView`, `headingSweep`; replaces `heading-preview.ts`), `view/mesh/follow-camera.ts` (`CameraViewSpec`, the defaults and the authored ranges, `followCamera`, `roomView`), the package entry and its test.

**Out, with where each goes:**

| What | Where |
|---|---|
| The slider, the drag gesture and a lock toggle on screen | ED3D.5 (the views over these functions); the drag's maths is here |
| A `camera-view` thing (the definition, its fields, a `views` check that `sector.view` names one) | ED3D.4d, once the entity line (#163 to #168) and the view stack are on `main`: it needs both, and neither stack contains the other |
| `bounds`, `lag` easing and lock-on framing | The game's renderer (M3.4); the editor carries `lag` and `bounds` as data only |
| The viewer artifact's heading demo | Published with the views page after the daily publish limit resets (00:00 UTC) |

## Decisions this plan makes (each vetoable by the Owner through the Orchestrator)

1. **A heading is an integer in turn units, 65,536 to a turn, 0 looking toward +z (south on the plan), growing toward +x (east).** The spec fixes the unit and "0 looks toward +z"; the sign is the agent's reading, the usual `atan2(x, z)`: the heading's direction is `(sin h, cos h)` in `(x, z)`, the same pair the spec has the sim compute with `sin` and `cos`. M3.4 confirms or flips it, and the conversion is one function.
2. **The editor's compass bearing stays as it is** (0 looks north, a quarter turn east: the plan's north is up the screen) because the plan, the dollhouse and Walk already use it. A heading `h` is the bearing `180 degrees - h`. Two functions convert and a test checks every unit round-trips.
3. **`yawDeg` is degrees in the same convention**, converted to the nearest unit and back to four decimals, so a unit round-trips through `yawDeg` exactly (a unit is 0.0055 degrees).
4. **The eight-heading preview is removed**, not kept beside the free one: the snap was never the game's, the package is private and nothing but its own tests and the entry use it. `headingSweep` replaces it at 15 degrees (24 headings, the spec's D3-g and D3-h step) and takes any step that divides a turn.
5. **A drag is worth `degPerPixel` degrees a pixel, 0.25 by default**, rounded to whole units; the editor does not clamp it to the sim's 8,192 a tick, because it has no ticks.
6. **The follow camera is the dollhouse's `orbitCamera` with the game's numbers**: the target is the followed position raised by `focusHeight`, the distance is `distance`, the pitch is `tiltDeg`, the lens is 24 mm. At the defaults it stands 2.11 m above the focus and 4.53 m behind it (the spec's numbers, asserted).
7. **A view with no `yawDeg` keeps the player's heading**, so the editor needs a heading to draw it from: it is given, else 0.
8. **A view that locks rotation holds its `yawDeg`**, whatever heading is asked for: the game ignores `camera-turn` there (spec §4.2, D3-i), so `roomView` answers with the entry heading and `rotate: false`. A view that allows rotation enters at `yawDeg` but the heading asked for (where the player has turned to) wins. A locked view with no `yawDeg` keeps the heading given.

## Contract

```
packages/editor-3d/src/view/mesh/heading.ts            TURN_UNITS, DEGREES_PER_PIXEL, wrapHeading, turnHeading, dragTurn, headingToYaw, yawToHeading, headingToDeg, degToHeading, wallsSeenFrom, headingView, headingSweep
packages/editor-3d/src/view/mesh/follow-camera.ts      CameraViewSpec, CAMERA_DEFAULTS, CAMERA_RANGES, cameraViewSpec, followCamera, roomView
packages/editor-3d/src/index.ts                        the public entry loses HEADINGS and headingPreview, gains the above
```

```ts
export const TURN_UNITS = 65_536
export const DEGREES_PER_PIXEL = 0.25
export const wrapHeading = (units: number): number                       // whole units in [0, 65536); a fraction is rounded
export const turnHeading = (units: number, by: number): number
export const dragTurn = (pixels: number, degPerPixel?: number): number    // whole units
export const headingToYaw = (units: number): number                      // radians, the editor's compass bearing, [0, 2π)
export const yawToHeading = (yaw: number): number                        // the nearest unit
export const headingToDeg = (units: number): number                      // yawDeg, four decimals
export const degToHeading = (deg: number): number
export interface WallsSeen { readonly cut: readonly string[]; readonly faded: readonly string[] }
export function wallsSeenFrom(mesh: SectorMesh, eye: Vec3): WallsSeen    // wall selections (or surface#n), floors and ceilings left out
export interface HeadingView { heading: number; orbit: Orbit; camera: Camera3D; wallsCut: number; wallsFaded: number }
export function headingView(mesh, size, units, options?): HeadingView    // the dollhouse framed on the level from that heading
export function headingSweep(mesh, size, stepDeg?, options?): HeadingView[]

export interface CameraViewSpec { id?; yawDeg?; tiltDeg; distance; focusHeight; lag?; rotate }
export const CAMERA_DEFAULTS, CAMERA_RANGES
export function cameraViewSpec(given?: Partial<CameraViewSpec>): CameraViewSpec
export function followCamera(spec, followed: Vec3, heading: number): Camera3D
export interface RoomView { heading: number; camera: Camera3D; walls: WallsSeen; rotate: boolean }
export function roomView(mesh, spec, followed: Vec3, heading?: number): RoomView
```

## Steps

1. **[x] Turn units and the free heading preview.** Failing test first (`view/mesh/heading.test.ts`, replacing `heading-preview.test.ts`): `wrapHeading` wraps negative and large numbers into [0, 65,536) and rounds a fraction; `turnHeading` adds and wraps; `dragTurn(1440)` is one full turn and `dragTurn(-1)` is minus 0.25 degrees in whole units, a different `degPerPixel` scales it; `headingToYaw` maps 0 to the bearing of south (180 degrees), a quarter turn to east (90 degrees), half to north (0), three quarters to west (270 degrees), and `yawToHeading` inverts it for every one of the 65,536 units; `headingToDeg` and `degToHeading` round-trip every unit and take 90 to 16,384 and 360 to 0; `wallsSeenFrom` is what the old preview counted (the room's walls from each side, a door counted once, `never` and `fade`); `headingView` frames the level with `fitOrbit` at that heading's bearing and looks through `orbitCamera`, and its cut walls equal the old eight-heading counts at the headings that correspond; `headingSweep` gives 24 views at the default, steps of 2,731 or 2,730 units, numbered by their units, starts at 0 or a given heading, takes 45 for eight and refuses a step that does not divide a turn (an `Error` with the sentence). *Files:* create `view/mesh/heading.ts` and its test, and `testing/room-mesh.ts` (the one-room mesh the two tests share), delete `heading-preview.ts` and its test. *Pass:* the new tests, `tsc`, the package.
2. **[x] The follow camera.** Failing test first (`view/mesh/follow-camera.test.ts`): `cameraViewSpec()` is 25 degrees, 5 m, 1.0 m, 0.18 s, `rotate` true; a given field wins (a zero lag and a locked rotation included); `followCamera` at the defaults, followed position `[0, 0, 0]` and heading 0 stands 2.113 m above the focus and 4.532 m behind it (the spec's 2.11 and 4.53), 3.1 m high, looks at the focus 25 degrees down, with the 24 mm lens (`ORBIT_FOV`, 53.13 degrees); the eye lies on the side the heading looks away from, at every quarter heading; the focus is the followed position raised by `focusHeight`; `roomView` takes the spec's `yawDeg` as the heading when no heading is given (else 0), holds a locked view at its `yawDeg` (decision 8), says `rotate`, and cuts the room's walls by the real eye: in the one-room mesh with the player in the middle, a heading toward +z (the camera north of the player) cuts the north wall, a quarter turn the west wall, a half turn the south wall and three quarters the east wall; the same room with a door in it counts the door once; a `fade` wall is faded, a `never` wall is shown; `CAMERA_RANGES` hold 15 to 60 and 3 to 12. *Files:* create `view/mesh/follow-camera.ts` and its test. *Pass:* as step 1.
3. **[x] Entry, gates, docs.** Failing test first (`index.test.ts`): the entry exports the new names and no longer `headingPreview` or `HEADINGS`. Then the gates in order, Node 24: `pnpm format`, `pnpm docs:stack`, `pnpm check`, `pnpm build`, `pnpm api-index`, `pnpm cheatsheet`, `pnpm agent-skills`, `pnpm api-report`; hand mutation over each step with `/mnt/project-files/ed3d/mutate.py`; this plan's ticks and records. The delivery plan's rows for this stack stay with the docs follow-up, as for 4b to 6d. *Files:* modify `index.ts`, `index.test.ts`. *Pass:* all of the above.

## Mutations

Hand mutation with `/mnt/project-files/ed3d/mutate.py`, the baseline passing first.

- **Step 1 (`heading.ts`, 40 mutants, 40 killed).** Constants (`TURN_UNITS`, `DEGREES_PER_PIXEL`); the wrap (no second modulo, `floor` for `round`, an off-by-one); `turnHeading` sign; `dragTurn` (`floor`, `*` for `/`, `+` for `*`, a different default); the bearing conversion (`units - HALF_TURN`, `/` for `*`, no wrap, `floor` and `ceil` for `round`, swapped subtraction); `headingToDeg` without rounding or wrap; `degToHeading` `*` for `/` and no wrap; `wallsSeenFrom` (floor or ceiling not skipped, `!== 'cut'`, cut and faded swapped, the `surface#n` name and its index, faded dropped); `headingView` (wrap, yaw, pitch, padding, counts swapped); `headingSweep` (default step, `count > 1`, no `isInteger`, no `>= 1`, start ignored, `floor`, sign, a fixed count). One survivor first, the floor skip: the mesh draws a floor with `never`, so the skip was equivalent on every mesh the builder makes. The test now gives a floor that says `cut`, and the mutant is killed; the removal of a redundant `wrapHeading` on the sweep's first heading was deleted as equivalent code, not killed.
- **Step 2 (`follow-camera.ts`, 30 mutants, 30 killed).** Each default and each range bound; the spread of the given fields; `??` against `||` for a zero lag and a locked rotation; the focus height sign and the followed axes; the distance, the heading sign and the tilt unit; `roomView`'s entry heading, the lock rule (`rotate` negation, dropped `yawDeg` guard), the order of `heading ?? entry`, the fallback 0, the wrap, `rotate`, the eye the walls are cut by.
- **Step 3.** The entry test names every export and the two removed ones; a name left out of the entry fails it.

## Progress record

- **2026-10-23 17:06 UTC, steps 1 to 3.** `heading.test.ts` 34 tests, `follow-camera.test.ts` 17, `index.test.ts` 10; the package passes in full (71 files, 1,663 tests). `pnpm format`, `docs:stack`, `check` (lint, typecheck, boundaries, style, knip, unit tests), `build`, `api-index`, `cheatsheet`, `agent-skills` (`--write`, then plain) and `api-report` all exit 0; `editor-3d` is private, so there is no changeset and no API report. Decisions 1 to 8 are the agent's and vetoable; the heading's sign (decision 1) is the one M3.4 must confirm, and `walkStart` already reads Last Light's facing the same way (0 looks south, growing toward east).
- **What this task did not do:** the viewer's heading demo (published with the views page after the daily publish limit resets), any UI, the `camera-view` thing and its check (ED3D.4d). Owner acceptance, CI on the Owner's devices and the iPad pass are open.
