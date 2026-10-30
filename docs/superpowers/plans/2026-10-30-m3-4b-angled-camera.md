# M3.4b: `render-pixi3d` part 2 (the angled camera, `camera-view` content, the heading and the stick mapper), TDD plan

- **Spec:** [revised M3 spec](../specs/2026-10-18-m3-3d-characters-design.md) §4.2 (the contract, the lens, the default view, the follow, per-pixel turning, the heading as sim state, lock-on framing, "one owner for `camera-view`" amended 2026-10-30), §5 (view change, camera turn), §6 (the `camera-view` range row, the unknown active view row), §13 (D3-a, D3-i, D3-j), §15 (M3R-D11, M3R-D15).
- **Task:** `M3.4b — render-pixi3d part 2` (02). Lane render3d. Stacked on M3.4a (`claude/3d-m3-4a-render3d`, PR #241).
- **Status:** drafted, implemented and locally checked 2026-10-30; not CI verified, not merged, no Owner acceptance.
- **Progress:** 10 of 10 steps.

## Why

Every 3D game needs the Owner's camera (24 mm, 25° down, 5 m back, turned freely) and a stick that moves the character away from the camera at any heading. The heading changes gameplay, so it is sim state, deterministic in four engines; the picture is presentation only. The 3D level editor already carries a copy of the view's numbers and the heading maths (ED3D.4c); this task makes `render-pixi3d` their one owner.

## Sources (recorded)

- The Last Light (`mcthaydt/PixiJS3D_Experiment_001`) at `92e6704`: `fovOf` (`src/direction/shots.ts` line 29, `2 * atan(12 / mm)` in degrees); the `@pixi/3d` camera write (`src/render/stage.ts` lines 672 and 734 to 736: `fov`, `position.set`, `lookAt`). Its camera brain (`src/render/camera-rig.ts`, klipp) is a 2.5D zone camera and is not extracted.
- AF `packages/editor-3d/src/view/mesh/follow-camera.ts` and `heading.ts` (ED3D.4c, #169, on `main` at `30e9606`): the view's defaults and ranges, `wrapHeading`, `turnHeading`, `degToHeading` and the heading convention (0 looks toward +z, a heading grows toward +x, forward is `(sin h, cos h)` in `(x, z)`). They move with their tests.
- M4.12's `turnUnitsFromPixels` (runtime, PR #204) is **not merged**; nothing here copies it. The input layer's drag-to-units stays M4.12's; this task owns what the sim does with the units.

## Decisions (agent defaults, for the Owner's veto)

1. **Two entries besides the main one.** `./camera-view` is the pure entry the spec names (no Pixi, no `@pixi/3d`): the `camera-view` zod schema with its defaults and ranges, `fovOf`, `LENS_MM`, and the heading maths. `./sim` is the sim entry, declared in `package.json` `"automata": { "simEntries": ["./sim"] }` and checked by `pnpm boundaries` (a new root in the root script): the schema and heading maths live there (zod and integers only), and `./camera-view` re-exports them, so there is one definition. `fovOf` needs `atan`, which the sim may not call, so it stays outside the sim folder.
2. **A view's id is its file name.** Content items take their id from the file (`content/camera-views/hall.toml` is `hall`), so `cameraViewSchema` validates the file's fields and `CameraView` is `{ id } & ` its output. Bounds are `{ min = [x, y, z], max = [x, y, z] }`, as the editor's `Box3`; `min` must not pass `max`.
3. **The heading state is one component, `camera-heading`** (`view`, `heading`, `rotate`, `latched`, `latchHeading`, `latchX`, `latchY`), on the player. It is a render component, so the renderer reads `view` and `heading` from the rows. `rotate` is copied from the view on entry, so the `camera-turn` system needs no content lookup.
4. **`camera-turn { units }` takes any integer and the system clamps the tick's total to ±8,192**, then wraps at 65,536. Several commands in one tick add up before the clamp. Every entity with `camera-heading` turns (a game has one player; a split-screen game would need a source field, which nothing asks for yet).
5. **The latch (M3R-D15).** Entering a different view while the stick is held latches the mapping to the heading before the entry and remembers the stick. It lets go when the stick is centred or points more than 90° from where it pointed at the latch (an integer dot product below 0: exactly 90° holds). Entering another view while latched keeps the first heading. **A player's camera turn lets go of a latch** ("they asked for the new heading"); entering a view with the stick centred does not latch.
6. **The mapper's output is Q16.16 integers.** `mapStick({ x, y }, heading)` takes the stick as `Input.stick()` gives it (integers −127..127, y positive down, M4-D2) and returns the world direction `{ x, z }` scaled by the stick's length, each `round(65,536 × value)`: stick up gives `(sin h, cos h)`, stick right gives the camera's right, `(−cos h, sin h)` (`@pixi/3d` is right-handed: a camera looking toward +z has +x on its left). Integers keep the replay and the hash exact.
7. **`angledCamera` takes the camera it writes and the aspect.** The spec's `angledCamera({ views, initial })` gains `camera` (the `View3D`'s `Camera3D`, the only thing it writes), `aspect` (for the middle-third test of `frame`), `reducedMotion` (default: the player's `prefers-reduced-motion`, read each frame, as `camera2d`) and `warn` (default `console.warn`).
8. **Eases.** `activate(id, 'ease')` blends the camera's eye and look point from where they were to the new view's live pose over 400 ms (smoothstep); a cut, or reduced motion, jumps. `heading(yaw, 'ease')` turns the shown heading by the shorter arc over 250 ms (smoothstep; reduced motion jumps); `heading(yaw)` (track) jumps, except that a track to the target an ease is already heading for lets the ease finish (the renderer tracks every frame). The view's own heading arrives through the sim (`heading(yaw, 'ease')` on entry), so D3-a's "moves the camera to the view's heading" lands within 250 ms of the 400 ms blend.
9. **The follow.** The focus (the followed position raised by `focusHeight`) approaches its target with `1 − e^(−t / lag)` a frame (lag 0.18 s), the first `follow` snaps, and the result is clamped inside `bounds`. Reduced motion keeps the follow lag (it is not a camera move the player did not ask for; the eases are).
10. **`frame(lock)`** moves the focus target up to 35% of the way toward the lock target, clamped by bounds; when that would put the player outside the middle third of the frame (either axis, at the rig's aspect) the share is cut by bisection until the player is inside. `frame()` clears it.
11. **The renderer wiring.** `Pixi3dOptions.camera` (optional) is `{ views, initial, follow }`, where `follow` is the component id that holds the followed entity's `x`, `y`, `z`. The renderer finds the row with `camera-heading` and that component, calls `activate(view, 'cut')` on the first row and `'ease'` on a change, `heading(yaw, 'ease')` when the entered view sets `yawDeg`, else `heading(yaw)` every frame (interpolated by the shorter arc between ticks), `follow` with the interpolated position, and `update`. A game that passes no `camera` keeps M3.4a's `scene` camera.
12. **Content and extension.** `cameraViewContent` (`camera-view`, folder `camera-views`, sent to the sim: it decides `rotate` and the entry heading) and `cameraHeadingPlugin` join `render3dExtension`.
13. **Editor-3d consumes the owner.** `CameraViewSpec`, `CAMERA_DEFAULTS`, `CAMERA_RANGES`, `cameraViewSpec`, `TURN_UNITS`, `wrapHeading`, `turnHeading` and `degToHeading` leave editor-3d; `followCamera` and `roomView` take `CameraView`; its tests import the owner's. editor-3d's `dragTurn` stays (an editor tool's drag, unclamped) until M4.12's `turnUnitsFromPixels` merges; its compass conversions (`headingToYaw`, `yawToHeading`, `headingToDeg`) are the editor camera's and stay.

## Files

- **Create (render-pixi3d):** `src/sim/{index,camera-view.schema,heading,stick-mapper,view-latch,camera-heading.component,camera-turn.command,camera-turn.system,camera-heading.plugin}.ts` + tests; `src/camera-view.ts` (pure entry) + test; `src/camera/{fov,camera-pose,angled-camera,camera-driver,camera-view.content}.ts` + tests; `src/testing/stick-sweep.ts`; `src/parity/{stick-mapper,camera-renderer}.parity.test.ts`.
- **Modify:** `packages/render-pixi3d/{package.json,src/index.ts,src/render3d.extension.ts,src/renderer/create-pixi3d-renderer.ts}` (+ tests); `packages/editor-3d/{package.json,src/index.ts,src/index.test.ts,src/view/mesh/{follow-camera,heading}.ts}` and their tests; root `package.json` (`boundaries` gains `packages/render-pixi3d/src/sim`); `knip.jsonc` if the new entries need it; API reports, api-index, agent skills.

## Interfaces

Consumed: `sin`, `cos` (`@mcthaydt/automata-sim/math`); `defineComponent`, `defineCommand`, `defineSystem`, `definePlugin` (sim); `defineContentSchema` (content); `reducedMotion` (ui); `Camera3D`, `View3D` (`@pixi/3d`); `PixiStageHooks` (render-pixi).

Produced:

```ts
// './camera-view' (pure) and './sim' (sim-safe) share these
export const cameraViewSchema: z.ZodType          // tiltDeg 25 (15..60), distance 5 (3..12), focusHeight 1, lag 0.18, rotate true, yawDeg?, bounds?
export type CameraView = { readonly id: string } & z.output<typeof cameraViewSchema>
export function cameraView(id: string, given?: z.input<typeof cameraViewSchema>): CameraView
export const CAMERA_DEFAULTS, CAMERA_RANGES
export const TURN_UNITS = 65_536, MAX_CAMERA_TURN = 8_192
export function wrapHeading(units: number): number
export function turnHeading(units: number, by: number): number
export function degToHeading(deg: number): number
export function headingToDeg(units: number): number
// './camera-view' only
export const LENS_MM = 24
export const fovOf: (lensMm: number) => number
// './sim' only
export function mapStick(stick: { x: number; y: number }, heading: number): { x: number; z: number } // Q16.16
export type HeadingState = FieldValues<typeof CameraHeading.fields>
export function enterView(state, view: CameraView, stick): HeadingState
export function turnCamera(state, units: number): HeadingState
export function moveDirection(state, stick): { state: HeadingState; direction: { x: number; z: number } }
export const CameraHeading: ComponentDef, CameraTurn: CommandDef, cameraTurnSystem: SystemDef, cameraHeadingPlugin: PluginDef
// '.'
export interface CameraRig { lensMm; setViews; activate; heading; follow; frame; update }
export function angledCamera(options: AngledCameraOptions): CameraRig
export const cameraViewContent: ContentSchemaDef<'camera-view'>
export interface Pixi3dCameraOptions { views; initial; follow }   // Pixi3dOptions.camera
```

## Steps

Each step starts with its failing test, run alone, with the failure reason recorded in the log.

- [x] **1. Plan.** This file (first commit).
- [x] **2. Schema (D3-j part 1).** Red: `camera-view.schema.test.ts`: an empty view parses to 25°, 5 m, 1.0 m, 0.18 s, `rotate: true`; 14.9°, 60.1°, 2.9 m and 12.1 m fail naming the field; bounds with `min` past `max` fail; `cameraView('hall')` carries the id. Green.
- [x] **3. Heading maths.** Red: `heading.test.ts` (the editor's cases moved: wrap, turn, degrees round trip, and `clampTurn`). Green.
- [x] **4. Stick mapper (D3-i).** Red: `stick-mapper.test.ts`: at every 1/64 turn and at 0, 1, 16,384 … 65,535, stick up gives `(sin h, cos h)` and right gives `(−cos h, sin h)` within one Q16.16 unit of `Math`'s value (the test may use `Math`; the module may not); centred gives `(0, 0)`; the sweep's hash equals the golden. Green.
- [x] **5. Latch and turn (D3-i).** Red: `view-latch.test.ts`: a turn of N changes the heading by exactly N, wrapping; ±8,192 clamp; `rotate: false` ignores it; entering a view with `yawDeg` sets the heading that tick; a view change with the stick held latches to the old heading, which holds at 90°, and lets go past 90° or when centred; a turn lets go and never latches; entering with the stick centred does not latch. Then the component, command, system and plugin (`camera-turn.system.test.ts` on a real sim: commands summed, clamped, wrapped, ignored under `rotate: false`). Boundaries root added; `pnpm boundaries` clean.
- [x] **6. Pure entry.** Red: `camera-view.test.ts`: `fovOf(24)` is 53.13°; the entry's module graph names no `pixi.js` or `@pixi/3d` (read its imports transitively). Green: `src/camera-view.ts`, `package.json` exports.
- [x] **7. The rig (D3-a, D3-j part 2).** Red: `camera-pose.test.ts` (eye 2.11 m up and 4.53 m back at the defaults; bounds clamp; frame bias at most 35% and inside the middle third; the 1.62 m figure fills ≥ 25% of the height at 16:9, 4:3 and 21:9 through `Camera3D.computeProjection`, the number recorded) and `angled-camera.test.ts` (on a real `Camera3D`: lens 24 mm in every view; activate ease reaches the view at 400 ms and not before, a cut or reduced motion at once; heading track the same frame; heading ease at 250 ms, reduced motion at once; a track to the eased target does not cancel; the follow lags and snaps first; an unknown view keeps the last and warns once). Green.
- [x] **8. Renderer wiring and content.** Red: `camera-driver.test.ts` (rows → activate cut then ease, heading ease on a `yawDeg` view, track otherwise, follow interpolated) and the extension test (content kind and plugin). Green: `Pixi3dOptions.camera`.
- [x] **9. Editor-3d migration.** Red: editor-3d `index.test.ts` asserts the moved names are no longer its exports and its follow camera takes `CameraView`. Green: imports from `@mcthaydt/automata-render-pixi3d/camera-view`; every editor-3d test passes.
- [x] **10. Parity and gates.** `stick-mapper.parity.test.ts` in Chromium, WebKit, Firefox gives the Node golden. `pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm build`; `pnpm api-report --update`, `pnpm api-report`; `pnpm api-index`; `pnpm agent-skills`; changesets (none expected: render-pixi3d and editor-3d are private); `pnpm --filter @mcthaydt/automata-render-pixi3d test:parity`; gitleaks over `origin/main..HEAD`. Push.

## Gates

- Selected: as step 10.
- Not here: Firefox WebGL (headless Firefox has none here; the mapper's parity is maths and runs there), the GPU runner, S7-Q10's legibility numbers (M3.1b), the golden replay with the heading (M3.7a, B-a), the occluders (M3.4c).

## Findings for the Owner

- **The default view frames a 1.62 m figure at 28.6% of the frame's height**, measured through `@pixi/3d`'s own projection (`Camera3D.computeProjection`) at 16:9, 4:3 and 21:9 (the vertical field is fixed, so the share is the same at every aspect). The spec's "about 29%" is the flat estimate (1.62 × cos 25° / 5 = 29.4%); D3-j's floor of 25% holds. S7-Q10 has not reported yet (M3.1b, GPU runner), so its number is still to compare.
- **M4.12's `turnUnitsFromPixels` is not merged** (PR #204), so runtime's `TURN_UNITS_PER_TURN` and `MAX_TURN_UNITS_PER_STEP` there will be a second spelling of 65,536 and 8,192 when it lands. Core may not import an extension, so runtime cannot take them from `render-pixi3d/sim`; the sim's numbers (here) are the contract the replay stores, and runtime's are the input layer's clamp. Worth one line in M4.12's PR pointing at `@mcthaydt/automata-render-pixi3d/sim`'s `TURN_UNITS`/`MAX_CAMERA_TURN` as the owner.
- **editor-3d's `dragTurn` stays** (an editor tool's unclamped drag); when M4.12 merges it can call `turnUnitsFromPixels`.
- **Root `package.json`** gains one path in `boundaries` (`packages/render-pixi3d/src/sim`): the ship lane's file, a one-path additive change.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-30 | 1 | `4bce175` | |
| 2026-10-30 | 2–5 | `1e1eec5` | Each red on "Cannot find module" first. Schema 10 of 10; heading 6 of 6; mapper 6 of 6 (the sweep golden `18d8cbc553b6c30d` recorded from Node on its first run, then checked in the browsers); latch 16 of 16; system on a real sim 5 of 5. `pnpm boundaries` covers the new root: a probe file with `Math.sin` there was reported (`math-member`), then removed. |
| 2026-10-30 | 6–7 | `a7922d8` | Pure entry 3 of 3 (module graph: `zod` only). Pose 9 of 9; rig 16 of 16 on a real `Camera3D`. First run: 4 failed: the ease test's "not yet" check at 0.249 of 0.25 s was within 4e-5 of the end (test fixed to check at 0.225 s), and the figure share measured 28.6%, not the spec's flat 29.4% (recorded, finding above). |
| 2026-10-30 | 8 | `b5c8a08` | Driver 8 of 8 (first run 1 failed: the test drew no frame before the second tick, so the first draw was the cut; test fixed). Extension 3 of 3. Renderer parity red in Chromium and WebKit (`renderer.camera` undefined); green after the wiring. First green attempt failed in both with `RendererUnavailable` after "Vite unexpectedly reloaded a test" (a dependency optimisation on the new `@mcthaydt/automata-content` import); the rerun passed, and every later run did. |
| 2026-10-30 | 9 | `771ac7a` | editor-3d red: 2 failing (`TURN_UNITS`, `CAMERA_DEFAULTS` still exported). Green: 2,373 of 2,373. |
| 2026-10-30 | 10 | `0515b38` | `pnpm format`; `TURBO_FORCE=true pnpm check` first run failed only on the API report (expected), then exit 0 (35 of 35; lint, typecheck, boundaries, style, knip, unit). `pnpm build` 12 of 12; `pnpm api-report --update` (render-pixi3d: `.`, `./camera-view`, `./sim`); `pnpm api-index` (no cheatsheet change); `pnpm agent-skills` current; no changeset (render-pixi3d and editor-3d are private); `changeset status` and `check-changesets` 0 problems. Parity `render-pixi3d`: stick sweep equal in Chromium, WebKit and Firefox; camera renderer in Chromium and WebKit (Firefox has no WebGL here: skipped). `pnpm build:examples` and the focused `render3d-meshes` e2e (`examples`, `examples-webkit`, `CI=1`): 4 passed with the extension's new content kind and plugin. gitleaks over `origin/main..HEAD`: no leaks. |
