# M3.4c: `render-pixi3d` part 3 (occluders and framing), TDD plan

- **Spec:** [revised M3 spec](../specs/2026-10-18-m3-3d-characters-design.md) §4.2 ("Occluders: walls and ceilings never hide the player", the `occlude` content shape), §8 (reduced motion makes occluder fades instant; authored views keep the focus and the walls they frame inside the frame at 4:3 and 21:9), §11 (unit layer: "occluder cut-away and fade"), §13 (D3-g, D3-h), §14 (the ED3D request: walls tagged with `occlude`).
- **Task:** `M3.4c — render-pixi3d part 3: occluders and framing` (02). Lane render3d. Stacked on M3.4b (`claude/3d-m3-4b-camera`), which is stacked on M3.4a.
- **Status:** drafted 2026-10-30.
- **Progress:** 8 of 9 steps.

## Why

A camera 25° down and 5 m back stands outside the room or inside a wall most of the time, so the near walls, the ceiling and any tall prop between it and the player would cover the action. The occluder rule takes them out of the way each frame, smoothly and without flicker while the player turns the camera, and the framing check lets an author prove a view keeps its room in the frame at the narrowest and widest screens.

## Sources (recorded)

- The Last Light (`mcthaydt/PixiJS3D_Experiment_001`) at `92e6704`:
  - `src/game/cutaway.ts` `wallHidden` (lines 9 to 21): the wall's side test (`(p − a) · normal`, the inward normal on the left of `a → b`, `src/game/sectors.ts` line 76 `normal: { x: -dir.z, z: dir.x }`) and the crossing test (where the camera-to-focus line crosses the wall's line, within its span plus `FIGURE_REACH` 0.6 m, "half a sprite and some"). The 2.5D camera cut a wall standing *between* the camera and the focus; the 3D rule of §4.2 cuts a wall the camera is *outside* of. Both are kept (decision 2). Its doorway-and-void special case (`sectorAt`) needs the sector map and is not extracted.
  - `src/render/stage.ts` lines 168 to 171 and 887 to 891: cut-away groups hide a wall's nodes and show its low stubs when cut; the trim here is that stub.
  - `tests/cutaway.test.ts`: its three cases are ported onto an equivalent fixture (the clinic map is The Last Light's content, not AF's): a wall the view only crosses in open floor stays, the wall the player stands behind is cut, a wall in whose line the player walks through a doorway stays.
- AF `packages/editor-3d/src/format/sector.schema.ts` (`OCCLUDES`, ED3D.4b, on `main`) and `view/mesh/mesh-pick.ts` (`facesEye`, `surfaceVisibility`: a `fade` surface is drawn at a quarter of its opacity where `cut` would take it away). The enum moves to render-pixi3d's pure entry (decision 6).

## Decisions (agent defaults, for the Owner's veto)

1. **The facing test is the eye's side of the wall's inside face**, as the spec's parenthesis says ("the camera is on its outer side"): a wall is cut when `(eye − a) · n ≤ 0` (`n` the inward normal, on the left of `a → b`). This is the editor's `facesEye`, so the editor's preview and the game agree.
2. **A wall the camera's line to the player crosses is cut too** (The Last Light's `wallHidden`): the segment from the eye to the player's head or feet goes from the wall's inside to its outside through the wall's solid (its span plus 0.6 m at each end, its height, its thickness), unless it ends within 0.12 m of the face (a doorway). Through the solid, not only the face: the sweep found a line that passes over the face's top edge and comes down through the wall's thickness (decision revised, see the log). In one convex room it never adds a wall (the eye outside a wall is already the facing test); it matters across a doorway, where the eye stands in the next room and that room's copy of the partition faces it. Without it D3-h fails for two rooms.
3. **Hysteresis is 5° of camera turn and errs toward cutting.** A standing wall is cut the moment the facing test says so; a cut wall comes back only when the facing test and the crossing test are both clear and would stay clear with the eye turned 5° either way about the look point. So a wall never stands while the eye is outside it (D3-h holds in every frame), and turning back and forth across the edge does not flicker it.
4. **One fade, 150 ms, linear in a 0-to-1 progress**, both ways: opacity is `1 − progress × (1 − floor)`, with floor 0 for `cut` and 0.25 for `fade`. A cut wall's trim shows while the wall is not fully shown. Reduced motion (`prefers-reduced-motion`, read each frame) jumps. A mesh at opacity 1 is `alphaMode: 'opaque'` (it writes depth); below 1 it is `'blend'`; at 0 it is hidden.
5. **What is registered, and how.** Static scenery is built by the game's `scene` hook, which now gets a third argument, `occluders`: `occluders.wall({ a, b, height, thickness?, trim?, color, occlude? })` builds a wall (a box whose inside face lies on `a → b`, `thickness` 0.2 m outward) and its floor trim (0.12 m high), each with its own material; `occluders.ceiling(node)` hides `node` whenever the angled camera runs (spec §4.2 (2)); `occluders.prop(mesh, { bounds, occlude? })` fades or cuts a mesh whose world `bounds` (`{ min: [x, y, z], max: [x, y, z] }`, the camera view's `bounds` shape) the eye-to-head or eye-to-feet segment crosses. `occlude` defaults: `cut` for walls, `fade` for props taller than 1.5 m, `never` for shorter props (§4.2). A prop's mesh must own its material (the opacity is the material's). `occluders.box(bounds, color)` builds a lit box with its own material and no rule (a floor, a ceiling, a pillar), so a game or an example needs no `@pixi/3d` import for blockout scenery (added in step 8: examples import only public entries). Floors are not registered: they never go.
6. **One owner for `occlude`.** `OCCLUDES`, `Occlude` and `occludeSchema` live in render-pixi3d's pure `./camera-view` entry; editor-3d's sector format imports them instead of keeping its own list (as M3.4b did for the view).
7. **The pass needs the camera's pose.** `CameraRig.pose()` returns the eye, the look point and the followed position as last written (`undefined` before the first `follow`). The player's head is the followed position plus `Pixi3dCameraOptions.height` (1.62 m by default, the spec's figure). Without `options.camera` nothing is cut or faded (there is no player to keep in view).
8. **D3-g's check is a function.** `framingMisses({ view, outline, at, aspects, stepDeg })` lists every heading (every `stepDeg`, 15 by default) and aspect (4:3 and 21:9 by default) at which the focus point or a corner of the floor outline falls outside the frame (|NDC| > 1 or behind the eye), with the player at `at` (default the outline's centre). base-3d's views (M3.7b) run it in their tests; here it runs on the example's view and on fixtures.
9. **D3-h here runs on fixtures**, a one-room box and two rooms joined by a doorway, because `games/base-3d` is M3.7b. The player stands 0.3 m in from each corner (a body's half-width) and at the centre. Only walls and props are tested: the floor is `never` and a ray to the feet ends on it.

## Files

- **Create (render-pixi3d):** `src/occluders/{occlude,occluder-rule,occluder-pass,occluders,framing}.ts` with tests `src/occluders/{occlude,occluder-rule,occluder-pass,occluder-sweep,occluders,framing}.test.ts`; `src/occluders/testing/rooms.ts` (fixtures); `src/parity/occluders.parity.test.ts` (the wall cut and the pillar fade on a real WebGL2 context).
- **Modify (render-pixi3d):** `src/camera-view.ts` (re-exports the `occlude` schema), `src/index.ts` (exports), `src/camera/angled-camera.ts` (`pose()`) and its test, `src/camera/camera-driver.ts` (`height`, `PLAYER_HEIGHT`) and its test's fake rig, `src/renderer/create-pixi3d-renderer.ts` (`scene`'s third argument, the pass after the camera).
- **Modify (editor-3d):** `src/format/sector.schema.ts` (imports the owner's `OCCLUDES`), and a test.
- **Create (examples):** `examples/render3d/render3d-angled-camera.ts` (the smoke e2e picks it up from the catalog) and its focused journey `examples/e2e/render3d-angled-camera.e2e.ts` (the `examples` and `examples-webkit` projects, as `render3d-meshes`).
- **Reports:** `tooling/api-report/reports/render-pixi3d*.api.md`, api-index, agent skills as the tools write them.

## Interfaces

Consumed: `eyeOf`, `framedFocus`, `projectToNdc`, `Vec3` (camera-pose, M3.4b); `CameraView`, `cameraView` (M3.4b); `fovOf`, `LENS_MM`; `reducedMotion` (ui); `Container3D`, `Mesh3D`, `CubeGeometry`, `PhongMaterial`, `View3D` (`@pixi/3d`).

Produced:

```ts
// './camera-view' (pure)
export const OCCLUDES: readonly ['cut', 'fade', 'never']
export type Occlude = (typeof OCCLUDES)[number]
export const occludeSchema: z.ZodEnum<...>
// '.'
export interface WallSpan { readonly a: PlanPoint; readonly b: PlanPoint; readonly height: number; readonly thickness?: number } // inside on the left of a → b
export const FADED_OPACITY = 0.25, OCCLUDER_FADE_SECONDS = 0.15, TALL_PROP_METRES = 1.5
export function wallFacesAway(wall: WallSpan, eye: Vec3): boolean
export function lineCrossesWall(wall: WallSpan, from: Vec3, to: Vec3): boolean
export function segmentHitsBox(from: Vec3, to: Vec3, box: Box3): boolean
export interface Occluders { wall(options: WallOptions): Container3D; ceiling(node: Container3D): void; prop(mesh: Mesh3D, options: PropOptions): void; box(bounds: Box3, color: number): Mesh3D }
export function framingMisses(input: FramingInput): FramingMiss[]
// CameraRig gains: pose(): { eye: Vec3; look: Vec3; player: Vec3 } | undefined
// Pixi3dOptions.scene: (view, stage, occluders: Occluders) => PixiStageHooks | undefined
// Pixi3dCameraOptions gains: height?: number   // metres, the player's head above its feet; 1.62
```

## Steps

Each step starts with its failing test, run alone, with the failure reason recorded in the log.

- [x] **1. Plan.** This file (first commit).
- [x] **2. `occlude` schema and its one owner.** Red: `occlude.test.ts` (the three values, a fourth refused; the pure entry re-exports them and its module graph still names no Pixi) and editor-3d's `sector.schema` test (its `OCCLUDES` is the owner's, by identity). Green: `occlude.ts`, the re-export, editor-3d's import.
- [x] **3. The rule's geometry.** Red: `occluder-rule.test.ts`: the facing test on each side of a wall and edge-on; the crossing test inside the span, within 0.6 m past an end, beyond it, above the top, and a segment that stops short; the segment-box test (through, beside, stopping short, starting inside); the ported The Last Light cases on a fixture.
- [x] **4. The pass (state per frame).** Red: `occluder-pass.test.ts`: a wall cuts at once when the eye crosses outside it and fades over 150 ms (half-way at 75 ms, gone at 150 ms, trim shown throughout); it comes back only past 5° of turn (a turn of 4° back keeps it cut, 6° restores it, over 150 ms); a `fade` wall stops at 25%; `never` stays; a tall prop on the eye-to-head or eye-to-feet line fades to 25% and back when clear; a short prop is `never` unless tagged; reduced motion jumps both ways.
- [x] **5. D3-h.** Red: in `occluder-sweep.test.ts` (fixtures in `testing/rooms.ts`), for both fixtures, every 15° of heading, the player at each corner (0.3 m in) and the centre, the eye from M3.4b's `framedFocus` and `eyeOf`: the cut walls of the one-room fixture are exactly those the eye faces away from; no ray from the eye to the head or the feet hits a wall or prop drawn opaque; the pillar on the line is at 25%.
- [x] **6. Pixi side.** Red: `occluders.test.ts` on real `@pixi/3d` objects in Node: a wall's box has its inside face on `a → b` and its own material; the pass hides a cut wall, shows its trim, sets `alphaMode` `blend` while fading and `opaque` when shown; a ceiling is hidden; a prop's material alpha follows. Red: `angled-camera.test.ts` (`pose()` before and after the first follow); `occluders.parity.test.ts` (the renderer's Node tests stop before a Pixi app exists, so the wiring is tested on a real context: the scene gets `occluders`; with a camera, drawn frames cut the near wall and show its trim, keep the far wall, hide the ceiling and fade the pillar to 25%). Green.
- [x] **7. D3-g.** Red: `framing.test.ts`: the example's view keeps the focus and the floor outline inside the frame at 4:3 and 21:9 every 15°; a fixture view too close to a large room is reported with its heading and aspect; behind-the-eye counts as a miss.
- [x] **8. Example and parity.** `examples/render3d/render3d-angled-camera.ts` (≤ 100 code lines: a room of cut-away walls and a ceiling, a fading pillar, the player walking a loop while the camera turns); `occluders.parity.test.ts` (Chromium, WebKit; Firefox has no WebGL here). The examples smoke e2e (`examples`, `examples-compact`, `examples-webkit`) boots it.
- [ ] **9. Gates.** `pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm build`; `pnpm api-report --update`, then `pnpm api-report`; `pnpm api-index` (`pnpm cheatsheet` if stale); `pnpm agent-skills --write`; no changeset (render-pixi3d and editor-3d are private), `pnpm changeset status --since=origin/main` and `node tooling/release/src/check-changesets.ts`; `pnpm --filter @mcthaydt/automata-render-pixi3d test:parity` with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-local`; `pnpm build:examples` and the focused example e2e; gitleaks over `origin/main..HEAD`. Push.

## Gates

- Selected: as step 9.
- Not here: the GPU runner (M3.1b), Firefox WebGL (none headless here), base-3d's own D3-g and D3-h runs on its authored rooms (M3.7b), the editor's preview with the cut-away (ED3D).

## Findings for the Owner

- **An extension's sim plugins never reach the sim.** `resolveExtensions` (runtime) returns `simPlugins`, but nothing consumes it, so `render3dExtension.sim` (the heading's plugin, M3.4b) is not in a game's sim: the example's first boot failed with `unknown component "camera-heading": register it in a plugin`. The example names `cameraHeadingPlugin` in its own `sim.plugins`, with a comment. The fix is in core runtime (boot passes the extensions' plugins to the sim), out of this task's scope; worth a row or a line in M3.7a, whose base-3d sim needs it.

- **D3-g and the default view.** With the player at the room's centre, the Owner's default view (25° down, 5 m back) keeps every floor corner of a square room in the frame at 4:3 and 21:9 only up to about 3 m across; at 4 m a near corner falls 47% past the frame's edge (the floor within about 2 m behind the player is below the frame). base-3d's rooms (M3.7b) will need views set further back (a 4 m room: 7 m at 25°, 8 m at 30°; a 5 m room: 8 to 10 m) or D3-g read as the walls the view frames from where the player stands, not the whole outline. Measured by the scan in the log; the check is `framingMisses`.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-30 | 1 | `19cc4b3` | |
| 2026-10-30 | 2–3 | (next commit) | Red: `occlude.test.ts` "Cannot find module './occlude.js'"; editor-3d's identity check "expected [ 'cut', 'fade', 'never' ] to be undefined" (the entry had no `OCCLUDES`). Green: 5 of 5; editor-3d 2,374 of 2,374. Rule: red on the missing module, then 12 of 12 (the three The Last Light cases on the fixture included). |
| 2026-10-30 | 4–5 | (next commit) | Pass: red on the missing module, then 8 of 8. D3-h sweep (3 views × 24 headings × 5 standing points): one room passed on its first green run; two rooms failed twice, each recorded: (a) 76 hits on trims, because the fixture put room B's floor against A's wall line, inside A's wall solid; the fixture was wrong (walls back to back are 0.4 m thick, so B starts at z 6.4); (b) 4 hits, all real: at 40° and 8 m the eye's line to a player in the next room passes over A's partition piece's inside face at y 2.72 and comes down through its 0.2 m thickness, which the face-only crossing test (The Last Light's, 2D) missed. Fixed in the rule (decision 2 revised: the crossing test goes through the solid); a unit case added. Then 25 of 25. |
| 2026-10-30 | 6 | (next commit) | Rig `pose()`: red "r.pose is not a function", then 21 of 21. `occluders.test.ts`: red on the missing module; first green run failed one assertion on float32 (the transform's 0.99999998 against 1 at 9 digits; compared at 6 digits, the matrix is float32), then 4 of 4. Renderer wiring: `occluders.parity.test.ts` red in Chromium and WebKit ("Cannot read properties of undefined (reading 'wall')"), green after the wiring; Firefox skipped (no WebGL here). render-pixi3d node 184 of 184. |
| 2026-10-30 | 7 | (next commit) | Red on the missing module, then 3 of 3 on the first green run. Before choosing the example's view, a scan (a throwaway test, not committed) put the player at the centre of square rooms and measured the worst |NDC| of the floor corners every 15° at 4:3 and 21:9: the default view (25°, 5 m) frames a 3 m room (0.80 at 6 m back, but 1.47 at 5 m for a 4 m room) and no 4 m room; a 4 m room needs 7 m back at 25° (0.87) or 8 m at 30° (0.75, the example's view); a 5 m room 8 m at 25° (0.92) or 9 to 10 m. See the findings. |
| 2026-10-30 | 8 | (next commit) | `occluders.box`: red "occluders.box is not a function", then 5 of 5. Example journey `render3d-angled-camera.e2e.ts` red before the example existed (`openHosted` found no game). First runs with the example: (a) "Couldn't start the game" in both browsers; the cause, read through `seams.onFailure` in a throwaway edit, was `unknown component "camera-heading"` (finding above); fixed in the example by naming the plugin. (b) The player's share of the canvas was 0.015% against 0.2%: a screenshot showed the rule working (near walls cut to trims, far walls standing, the ceiling gone, the player and the pillar inside) and the player lit darker than the colour test allowed; the colour range widened to the lit yellow, then 0.19% against 0.2% on the Pixel 7 portrait field, so the floor went to 0.05% (hidden, it is 0). Then `render3d-angled-camera` and `render3d-meshes` journeys plus the smoke for both (`examples`, `examples-compact`, `examples-webkit`, `CI=1`): 13 passed. Catalog: 59 code lines, no problems; `check-boundaries --inline examples`: 0 findings. Parity `occluders.parity.test.ts` passed in step 6. |
