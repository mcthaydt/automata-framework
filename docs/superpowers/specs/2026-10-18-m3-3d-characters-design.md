# M3: 3D characters, procedural with an IK rig (milestone spec, revised twice)

- **Status:** Drafted 2026-10-18; **revised 2026-10-23** for the Owner's direction below (no rigged glTF characters, an IK rig with authored poses and clips, an angled 24 mm camera, the action-adventure the characters are for). **Awaiting Owner review.** It replaces the 2.5D scope of the [2026-10-16 M3 spec](./2026-10-16-m3-25d-pipelines-design.md) (approved 2026-10-16), whose amendment at the top says what is dropped and what carries over. Task **M3.0** (revised) in [02 Master delivery plan](../../02-master-delivery-plan.md). Nothing here is implemented before that review (01 Decomposition §5, [04 How we build](../../04-how-we-build.md)), except spike S7 (M3.1), which is exempt from TDD (A0+A1 spec §2). Open decisions M3R-D1 to M3R-D15 (§15) carry recommended defaults; they are in effect only once the Owner approves them, except the ones marked **Owner** in §15, which are the Owner's words.
- **Depends on:** M2 (merged). PRODUCT.5 (the `mcthaydt/automata-plus` workspace) before any M3 package task, because every M3 package is Plus. PRODUCT.1's post-filter slot before `post-retro`. Not on M4 or M5, except that the base game uses M4's input when it lands.

## Owner direction

| When (UTC) | Where | The Owner's words | What it did here |
|---|---|---|---|
| 2026-10-18 | The Desk's relay | "drop 2.5D; M3 becomes procedural-character 3D plus rigged-character 3D." | 2.5D dropped. The "rigged" half is superseded by the next row. |
| 2026-10-23 08:45:45 | Project thread, message `cmsg_01VQPgZzjNxjPkiB5eeQRiaYBZMPTigDhn8zdJ52vrPKZ9` | "Cut the rigged gltf, procedural only for now, make the character action adventure like ocarina of time switch 2 remake, but use an angle like crow country for the 3D" | Rigged glTF characters, skinned-mesh work, clip crossfade and the rigged pipeline path are cut (M3R-D1, D6, D8). The game the characters are for is an Ocarina-style action-adventure (§17). The camera is Crow Country's angled, high three-quarter view, not a free orbit (M3R-D9). |
| 2026-10-23 08:46:27 | Project thread, message `cmsg_01VQPgZzjNxjPkiB5eeQRiaY7dESwAMgKa1wKZ815qSyW1` | "Character editor is glorious, but let's add like IK rig so we can manually pose, I think that's also necessary for animation which we may have missed?" | New: an IK rig, authored poses and keyframed clips for procedural figures (§4.4.2 to §4.4.6, task M3.6, decisions M3R-D6, D12, D13). The Owner's "missed" is right (§2.3). |
| 2026-10-23 08:48:00 | Project thread, message `cmsg_01VQPgZzjNxjPkiB5eeQRiaYDbjPknERexJTta3asGxbSo` | "Go with 24mm focal length for camera" | The camera's lens is 24 mm (§4.2, M3R-D9). |

Earlier direction still in force: 2026-10-11 (2D, then 3D; Ruken first; PixiJS for 2D and 3D); 2026-10-16 PD-1 (every extension is Automata Plus) and PD-3 (`post-retro`'s 2D part runs on the FloorFifty path); 2026-10-17 (the 3D camera uses pmndrs/klipp, evaluated and pinned in M9.0; §16 says how it meets the angled views). **Not answered:** whether 3D belongs in AF 1.0 or stays in Plus (M3R-D10). It keeps its default (1.0 is 2D, 3D is Plus) and is open on the Orchestrator bus.

## 0. Sources

| Source | Revision | Used for |
|---|---|---|
| AF `main` | `5a02ea8` | What exists (§2). |
| The 2026-10-16 M3 spec | as merged | Every section this spec keeps by reference (§2, §4.5, §4.7, §4.8's platform, §11) |
| The Last Light, `mcthaydt/PixiJS3D_Experiment_001` | `92e6704` (shallow clone, read 2026-10-23); the first revision read `bbd7a65` | The procedural figure (`src/render/figure/`: `rig.ts` 144 lines, `motion.ts` 305, `figure.ts` 415, `genes.ts`, `garments.ts`, `parts.ts`, `library/*.json`), its test file `tests/procedural-figure.test.ts`, its proposal (`docs/superpowers/proposals/2026-10-16-procedural-figures/`; PR #114), the Studio editor (`editor/src/client/studio.ts`, `studio-model.ts`), the `fovOf` lens convention (`src/game/cutscenes.ts:17`, `src/direction/shots.ts:29`), and the pipeline's locked `lensMm` and `tiltDeg` (`pipeline.config.json`: 50 and 30 for its 2.5D camera) |
| `@pixi/3d` 0.1.0-beta.2 | the tarball The Last Light vendors | Meshes, lights, fog and the camera, read from the file list, not run. Skins and animation are no longer used (§3, S7-Q5) |

**Not verified here:** `@pixi/3d`'s camera taking a vertical field of view in degrees (S7-Q5 checks it); the angled camera under Ruken's CSP and on phones (S7 measures both); the beta's terms beyond The Last Light's README (unchanged from the 2026-10-16 spec); that the figure's source files at `92e6704` equal `bbd7a65` (each task's plan re-reads them at the commit it extracts and records it).

## 1. Goal and boundaries

**Goal.** A game on AF can put characters in a 3D room, move them, pose them and animate them: **procedural characters** built from data (sliders, a shared skeleton, garments, hair, headwear and held items), a **procedural gait**, and an **IK rig** with authored poses and keyframed clips, all drawn as real 3D meshes by `render-pixi3d` on WebGL2 (WebGPU when opted in), under Ruken's CSP, at 30 FPS or better on the phone profiles, in a private build, seen through an **angled, high three-quarter camera on a 24 mm lens**. A character's look and motion are presentation: the sim says where it is, where it faces, whether it moves, which clip plays, what it aims at, and never reads a joint.

**What this is for.** The characters and the camera are shaped by the game AF builds next, GAME-3D: a third-person action-adventure in the spirit of Ocarina of Time, with lock-on combat, dungeons, items and puzzles (§17). M3 does not build that game. It builds the character, rig and camera pieces that game needs and proves them in one small base game.

**What changed from the first revision (2026-10-18).**

| Was | Now |
|---|---|
| Rigged glTF characters with named clips, crossfade, sockets (`rigged` view, §4.5) | **Cut.** Procedural figures only. No skinned glTF, no glTF animation, no crossfade between clips (M3R-D6) |
| Meshy `model`, `rig`, `animate` stages in the character pipeline | **Cut.** The character pipeline is the free procedural path; paid stages stay only in the props pipeline |
| Motion = the figure's gait plus eleven actions written in code | Gait stays code. Everything else is **data**: an IK rig, authored poses (`figure-pose`) and keyframed clips (`figure-clip`) |
| A follow camera with 45° orbit steps | An **angled camera**: fixed yaw and tilt per authored view, a following focus, **24 mm lens**, no player orbit (M3R-D9, D11) |
| S7-Q8 (skinning on both backends) | Gone with the skins. S7-Q8 now measures the rig solve; S7-Q10 checks the angled view reads on phones |
| One base game with a procedural and a rigged character | `games/base-3d`: procedural figures only, two authored views, a lock-on aim demo |

**Plus (paid, PD-1), in `mcthaydt/automata-plus`:**
1. `render-pixi3d`: the 3D renderer on `@pixi/3d`: static meshes, props, lights, fog, the angled camera and the figure view. Private, unpublished, never in a public build (D-1, unchanged).
2. `figures`: procedural characters, the IK rig, poses and clips. The data model, solvers and motion are renderer-free TypeScript; their 3D view lives in `render-pixi3d`.
3. `post-retro`: unchanged (2026-10-16 spec §4.5), on the FloorFifty path first.
4. `pipelines`: the platform (unchanged), the character pipeline (procedural only) and the props pipeline (unchanged).
5. One base game, `games/base-3d`, and one-file examples per feature.

**Core (free):** only the `pixi.js` 8.22 bump (M3.2), as before. No other core change; a missing public seam becomes a change request to its owning lane.

**Exclusions:**
- Rigged or skinned glTF characters, glTF animation clips, clip crossfade and blend trees, animation retargeting between skeletons, root motion, facial animation and lip sync, cloth simulation: **not built** (M3R-D6). Cut by the Owner on 2026-10-23, not deferred to a milestone; a new Owner decision would reopen them. Static GLB props stay.
- The third-person controller, lock-on targeting, combat, items, ground-contact IK on stairs and slopes, brush-based environments, physics-driven character motion and ragdolls: M9 (from GAME-3D). M3 provides the camera views, the rig's pin and aim API and a small lock-on demo; GAME-3D proves the rest (§17).
- The figure painter (The Last Light's CPU raster to a sprite cell: `raster.ts`, `paint.ts`, `ramp-light.ts`): it is the 2.5D look and is dropped with it (M3R-D2).
- The character editor's interface (the Studio): it is the editor suite's work, not M3's (§4.4.6 says what it needs from `figures`).
- Sector maps, nav, puzzles, narrative, cutscenes and the environment pipeline: M6 (see §16).

## 2. What already exists

### 2.1 In AF

As the 2026-10-16 spec §2, re-checked at `5a02ea8` for the rows M3 still uses: `GameRenderer` and `RendererFactory` (`packages/runtime/src/render/renderer.ts`), `createPixiRenderer` and its `setup(stage)` (`packages/render-pixi/src/renderer.ts`), `RenderDeltaConsumer` and `EntityView` (`packages/render-pixi/src/delta/`), `filterPrograms`, `render-pixi/no-eval`, `defineExtension`, the 3D physics components (`packages/physics/src/physics-3d*.ts`), the `pixi.js` 8.21.0 pin, and the release list refusing `render-pixi3d`. Not in AF anywhere: any 3D rendering, a figure model, an IK solver.

### 2.2 In The Last Light's figure (read at `92e6704`)

- **Skeleton** (`rig.ts`): 25 joints. Twenty body joints (`root`, `pelvis`, `spine`, `chest`, `neck`, `head`, a clavicle, upper arm, forearm and hand per side, a thigh, shin and foot per side), a `socket` per hand, and three hair pivots driven by a spring. The figure faces +z, y is up, its own left is +x.
- **Pose and FK:** `Pose { root, yaw, rot[], shift[] }` (a local rotation and a translation shift per joint) and `fk()`.
- **IK:** one solver, `twoBoneIK(skeleton, pose, world, a, b, c, target, pole, bend, end?)`: analytic law-of-cosines on a two-bone chain, bending toward a pole direction, with an optional end orientation. It drives both legs (foot paths) and the arms (an action's hand target, a held item's grip).
- **Motion** (`motion.ts`): `base()` layers pelvis and torso, head, arms (swing), legs (foot paths into IK) and then **eleven actions as hard-coded branches** (`reach`, `look`, `flinch`, `thrust`, `cup`, `recoil`, `read`, `sit`, `sleep`, `radio`, `push`; the `ActionId` union), then `applyHold()` rewrites only the holding arm. Walk and idle cycles are `Gait` numbers in `library/gaits.json`. Poses step at `poseRate` (12 or 8 a second).
- **Scale:** every authored offset is multiplied by `k = height / 1.62`, so one pose works on any proportions.
- **Studio** (`editor/src/client/studio.ts`): sliders, outfits, a turnaround rendered by the game, a test stage. Its "Poses" tab is the 2.5D atlas pose requests (a paid pipeline request form), not a posing tool.

### 2.3 What was missed (the Owner's question)

The Owner asked whether animation was missed. It was: the first revision of this spec extracted the figure's code as it is. That gives AF **one** solver and **eleven poses that are code**. A third-person action-adventure needs dozens of moves (slashes, a raised shield, a drawn bow, a roll, a push, a pickup) and the person making the game must author them, in the character editor, by dragging hands and feet. Nothing in the source can do that: there is no effector data, no pole control, no spine or head IK (the head turns by an angle, `headYaw`), no keyframes, no clip, no layer mask, no way to aim at a point, no way to pin a foot. §4.4.2 to §4.4.6 add them as data and pure functions, reusing `twoBoneIK` and the layer order the source already proves.

## 3. Spike S7, revised (M3.1)

S7 keeps the 2026-10-16 questions S7-Q2 (WebGL2/WebGPU parity), S7-Q4 (non-black capture), S7-Q6 (`pixi.js` 8.22) and S7-Q7 (bytes). It changes the scene, drops the skinning question and adds three:

| ID | Question | Pass |
|---|---|---|
| S7-Q1 | Does a `View3D` scene (a box room seen through the angled camera, 24 mm, tilt 45°, 9 m; six procedural figures, one of them playing a rig clip and aiming at another; one static GLB prop; linear fog) boot under Ruken's CSP after `render-pixi/no-eval`? | Renders; zero `securitypolicyviolation` events and zero console errors in Chromium, WebKit and Firefox |
| S7-Q3 | Phone profiles: does that scene hold 30 FPS with the six figures walking and two of them playing clips? | p95 frame time ≤ 33.3 ms over 20 s after a 3 s warm-up on both phone profiles (M3-D6, unchanged), measured with PRODUCT.7's probe on the GPU runner; SwiftShader rejected |
| S7-Q5 | Which beta APIs does AF depend on, and do they fit AF's seams? | The written symbol list (meshes, materials, lights, fog, `Camera3D`; never `./extras`, no glTF skin or animation path); `Container3D` accepted where `RenderDeltaConsumer` takes a `Container`; `View3D` mountable in `setup`; the camera's field of view is a vertical angle in degrees that equals `fovOf(24)` = 53.13° |
| S7-Q8 (new meaning) | What does a figure's rig solve cost? | Four limb solves, the spine and head aim and the pins, per figure: ≤ 0.1 ms per solve on the phone profile; reported per pose step and per frame (pins and aim only), with the source's allocating `twoBoneIK` first and typed-array buffers only if it misses |
| S7-Q9 | What does a procedural figure cost per frame as meshes? | Joint update plus mesh transforms per figure per frame, and the one-off build per outfit change, in ms on the phone profile; target ≤ 0.3 ms a frame per figure, ≤ 20 ms a build |
| S7-Q10 (new) | Does the angled 24 mm view read on phones? | At the default view a 1.62 m figure is ≥ 12% of the frame's height (§4.2), which is ≥ 46 px on 844×390 and ≥ 32 px on 780×270; depth precision holds (no z-fighting on the room's floor and walls at near 0.3, far 120); the captures are attached for the Owner's look, which decides whether the compact case is legible enough |

Outputs as before: `spikes/s7-pixi3d/` (removed when the verdict is recorded), `docs/spikes/s7-pixi3d.md` with numbers, browser, runner and commit, and a verdict row. A failed S7-Q1 or S7-Q3 stops M3.4 onward and goes to the Owner with the evidence. A failed S7-Q8 sets a smaller rig scope (fewer solved effectors per figure); it does not stop the milestone.

## 4. Contracts

### 4.1 `render-pixi3d` (`automata-plus/packages/render-pixi3d`, M3.4)

The 2026-10-16 §4.1 contract, with the 2.5D parts removed:

```ts
export interface Pixi3dOptions extends PixiRendererOptions {
  readonly fog?: { readonly near: number; readonly far: number; readonly color: number }
  readonly views: EntityViewResolver3d
  readonly camera: CameraRig                         // §4.2
  readonly lighting?: SceneLighting                  // §4.3
}
export type EntityViewResolver3d = Readonly<Record<string, (row: RenderRow) => EntityView | undefined>>
export interface Pixi3dRenderer extends PixiRenderer {
  readonly view: View3D
  readonly camera: CameraRig
}
export function createPixi3dRenderer(options: Pixi3dOptions): RendererFactory
export const render3dExtension: ExtensionDef<'render-pixi3d'>
```

- Mounting, interpolation, assets (`.glb`, `.bin`; byte progress; 30 s stall), init order and the manifest are as 2026-10-16 §4.1.
- Entity views: `mesh(model)` (a static GLB or a packed `.bin`), `box(size, material)` and `figure(def, options)` (§4.4). `billboard` and `rigged` do not exist.
- `parseGlb` and `parsePack` from The Last Light keep the static path only. A `.glb` with a skin is `ModelInvalid` (§6): AF draws no skinned glTF.

### 4.2 The angled camera (`render-pixi3d` `camera/`, M3.4)

The Owner's reference is Crow Country's angled, high three-quarter view; the lens is 24 mm.

```ts
// content (schema `camera-view`), compiled and hashed like all content
export interface CameraView {
  readonly id: string
  readonly yawDeg: number                // the fixed heading the view looks along (0 looks toward +z)
  readonly tiltDeg: number               // downward angle; 45 by default, authored within 30 to 60 (M3R-D11)
  readonly distance: number              // metres from the focus point back along the view axis; 9 by default, 6 to 12
  readonly focusHeight: number           // metres above the followed position the focus sits; 1.0 by default
  readonly bounds?: Box3                 // the focus point is clamped inside this box, so walls and doorways stay framed
  readonly lag?: number                  // seconds of easing on the follow; 0.18 by default
}
export interface CameraRig {
  readonly lensMm: number                // 24 (Owner, 2026-10-23); the guard holds it (§6)
  setViews(views: readonly CameraView[]): void
  activate(id: string, how: 'cut' | 'ease'): void   // 'ease' is 400 ms, a 'cut' under reduced motion
  follow(x: number, y: number, z: number): void      // the followed view's interpolated position
  frame(lock?: { x: number; y: number; z: number }): void // lock-on: bias the focus toward the target, clamped by bounds
  update(frameSeconds: number): void
}
export const fovOf: (lensMm: number) => number        // 2 * atan(12 / mm), degrees: the vertical field of view
export function angledCamera(options: { readonly views: readonly CameraView[]; readonly initial: string }): CameraRig
```

- **The lens.** `fovOf` is The Last Light's convention (`2 * atan(12 / mm)`: a 24 mm tall film gate). At **24 mm** the vertical field of view is **53.13°** and the visible height at distance *d* is exactly *d*. The horizontal field follows the aspect ratio: 67.4° at 4:3, 83.3° at 16:9, 94.6° at 19.5:9, 98.8° at 21:9. A wide lens close to the action gives the framing the Owner pointed at and makes the room's depth read; it also stretches objects near the frame's edge, which is why an authored view keeps the player near the middle (the focus follows) and S7-Q10 looks at it.
- **The default view.** Tilt 45°, distance 9 m, focus height 1.0 m. A 1.62 m figure then fills 12.7% of the frame's height (its extent across the view is 1.62 × cos 45° = 1.15 m of the 9 m visible). The Last Light's 2.5D camera was 50 mm at 30° and stays in the old spec; AF's `pipeline.toml` `[locked]` holds `lensMm = 24` and `tiltDeg = 45` (the guard of 2026-10-16 §4.8), changed only by a recorded decision. This spec's Owner direction table is the record for the lens.
- **Per-room views, not an orbit.** A view is a fixed yaw and tilt that follows the player's position with eased lag inside its bounds. There is no player-controlled orbit and no `camera-left` or `camera-right` action. A level has several views (a room, a corridor, a boss arena) and a single view is the whole camera for a game that wants one global angle. The 2.5D camera zones, octants and hysteresis stay dropped; a view is a named camera, and **which view is active is sim state** (below).
- **The active view is sim state.** Stick input maps to a world direction through the active view's `yawDeg` (a stick pushed up moves the character away from the camera). That mapping affects gameplay, so the sim owns it: a `view` id on the player (set by the room or sector the player is in, or by a view volume) is a component, the compiled `camera-view` content gives its yaw, and the input mapper reads that, never the eased camera. The renderer reads the id from the render rows and calls `activate`. On a change the mapping **latches** to the old yaw until the stick is released or turns by more than 90° (the classic fixed-camera rule, M3R-D15), so crossing a doorway does not reverse the character mid-stride.
- **Lock-on framing.** `frame(lock)` moves the focus up to 35% of the way toward the lock target, never past the view's bounds and never so far that the player leaves the middle third of the frame. Presentation only.
- **Presentation only** apart from the view id: the rig reads interpolated positions and writes only the `View3D` camera (law 1). The 3D level editor's walk camera (ED3D-D8, 69°) is a different camera and unrelated.

### 4.3 Lighting and fog (M3.4)

- `SceneLighting { lamps: Lamp[]; ambient: number }` from content.
- **Static meshes:** vertex light baked once per mesh at load, with box/plane occlusion (The Last Light `render/indirect-light.ts`, `render/occlusion.ts`), as 2026-10-16 §4.4. A lamp change (a sim event) rebakes the meshes in range.
- **Moving characters** (figures): lit per character, not per vertex bake, because they move and deform. Each frame a character takes ambient plus the N·L of each lamp in range at its position, as a material tint on `@pixi/3d`'s lit material (M3R-D4); S7-Q9 measures it.
- Fog: `View3D`'s linear fog; the particle mist from the 2026-10-16 spec is kept only if S7 measures it within budget, else dropped (it was a 2.5D set piece).

### 4.4 `figures`: procedural characters, the IK rig, poses and clips (`automata-plus/packages/figures`, M3.5 and M3.6)

`figures` is renderer-free: it imports nothing from Pixi, so its unit tests run in Node and a future renderer can draw the same figures. It is The Last Light's procedural figure made game-agnostic, minus its sprite painter, plus the rig layer of §4.4.2 to §4.4.6.

#### 4.4.1 Definition, skeleton and library (M3.5)

```ts
// content (schema `figure`), compiled and hashed like all content
export interface FigureDef {
  readonly id: string
  readonly sliders: Partial<Sliders>                 // frame, height, muscle, fat, shoulders, hips, legs, arms, head, neck,
                                                     // neckLength, hands, feet, posture, age, headTilt, chunk, faceForward, hunch
  readonly genes?: Partial<GeneOverrides>
  readonly skin: string                              // a swatch id
  readonly gait: string                              // a gait id, or inline
  readonly hand: 'L' | 'R'
  readonly outfits: Readonly<Record<string, readonly Garment[]>>
  readonly default: string
  readonly hair?: HairDynamics
  readonly rig?: string                              // a rig-limits id (§4.4.2); the shared default if omitted
}
export function skeleton(def: FigureDef): Skeleton               // 25 joints: 20 body, a socket per hand, 3 hair pivots
export function build(def: FigureDef, skeleton: Skeleton, outfit: string, item: string | null): Built // part meshes
export const figuresExtension: ExtensionDef<'figures'>
```

- Libraries are content too: swatches, gaits, hair styles, headwear, items and rig limits (The Last Light `library/*.json`, plus `rig.json`). **No character in code** (The Last Light iteration 33): a figure names them or writes its own inline.
- **Source:** The Last Light `src/render/figure/`: `genes.ts`, `rig.ts`, `motion.ts` (locomotion and idle only; its eleven action branches are not extracted, §4.4.4), `parts.ts`, `garments.ts`, `cast.ts`, `math.ts`, `outfits.ts` and the library files, with `tests/procedural-figure.test.ts`. **Not extracted:** `raster.ts`, `paint.ts`, `ramp-light.ts` (the sprite look), `stage-figure.ts`, `workshop.ts`, `review-cutscene.ts` (game wiring), and the characters themselves (Ada, the Nurse, the Porter stay in the game; AF's fixture figure is Wick, Emberwick's character, as data).
- **Locomotion stays code.** The gait (foot trajectories into IK, pelvis bob and sway, arm swing, head stabilise), idle (breath, weight shift, twitch), turn on the spot and the hair spring are The Last Light's, with one addition: the gait takes the direction of travel relative to the facing (`moveDir`), so the stride vector is the forward vector rotated by it. A character that strafes or backs away plays the same cycle along its own x axis or backwards (F-h). Poses step at the gait's pose rate (M3R-D3).
- **Holds stay as the source has them:** an item's `hold` (a hand position in chest space in figure units, a turn, a pole) is applied last, and only to an arm no active clip owns (§4.4.5), so an item never changes the rest of the pose (the source's invariance test comes with it).
- **Presentation time.** Motion is a pure function of the definition, the state and presentation time (the frame clock), not of the sim tick. It is deterministic for a given time, so captures are stable, but it never feeds back into the sim (law 1). `Math.random` is not used: the source's `hash` seeds twitches and stain placement.
- **Drawing (in `render-pixi3d`'s `figure` view):** each part is a `Mesh3D` under its joint's `Container3D`. The few skinned parts (skirts, coat tails) are skinned on the **CPU** per pose step (two-bone linear blend, as the source); no GPU skinning, no glTF skin. An outfit or item change rebuilds the part list once.
- **Faces:** the source's point decals become small textured quads on the head, shown only when facing the camera.

#### 4.4.2 The rig: effectors, poles, aim, pins and limits (M3.6)

The skeleton's joints are driven through a small set of handles. A handle is data in a pose; a solver turns the handles into joint rotations.

```ts
export type Vec3 = readonly [number, number, number]
export type EffectorId = 'footL' | 'footR' | 'handL' | 'handR' | 'pelvis' | 'chest' | 'head'
export type PoleId = 'kneeL' | 'kneeR' | 'elbowL' | 'elbowR'
export type Space = 'root' | 'chest'          // root: figure space (+z forward); chest: the chest joint's frame
export interface EffectorTarget {
  readonly pos?: Vec3                          // figure units (below), in `space`; omitted = leave to the lower layers
  readonly rot?: Vec3                          // Euler degrees (pitch, yaw, roll), as the source's `euler`
  readonly space?: Space                       // 'root' by default
  readonly weight?: number                     // 0 to 1; 1 by default
}
export interface PoleTarget { readonly dir: Vec3; readonly space?: Space }   // the direction the knee or elbow points
export interface AimTarget {
  readonly at: Vec3                            // a world position, supplied by the sim through the render row
  readonly part: 'head' | 'chest' | 'handL' | 'handR'
  readonly weight?: number
}
export interface SolveReport {
  readonly reached: Readonly<Partial<Record<EffectorId | 'aim', { ok: boolean; error: number }>>>
  readonly limited: readonly Joint[]           // joints a limit clamped
}
export interface Targets {                     // everything a solve is asked to satisfy, after the layers have merged
  readonly effectors: Readonly<Partial<Record<EffectorId, EffectorTarget>>>
  readonly poles: Readonly<Partial<Record<PoleId, PoleTarget>>>
  readonly aim: readonly AimTarget[]
  readonly pins: Readonly<Partial<Record<'footL' | 'footR' | 'handL' | 'handR', Vec3>>> // world positions, from the view
}
export function solve(skeleton: Skeleton, base: Pose, targets: Targets, limits: RigLimits): { pose: Pose; world: M[]; report: SolveReport }
```

- **Figure units.** Every position is in the figure's own scale: 1 unit is 1 m for a 1.62 m figure, multiplied by `height / 1.62` at solve time (the source's `k`). A slash authored on Wick plays on a taller figure with a longer reach and no retargeting step.
- **Limbs** (`footL`, `footR`, `handL`, `handR`): the source's `twoBoneIK` from the thigh or upper arm, with the pole from `kneeX` or `elbowX` (defaults are the source's: knees forward, elbows back and down and out) and an optional end rotation for the foot or hand. A target past the limb's length extends it fully toward the target and reports `ok: false` with the shortfall; it never stretches the bone.
- **Hips and torso:** `pelvis` moves and turns the hips; the legs re-solve afterwards so the feet stay on their targets. `chest` is a rotation shared by `spine` and `chest` (the source's 0.3/0.7 posture split).
- **Head and aim:** `head` takes a rotation; an `AimTarget` with `part: 'head'` takes a look-at instead. The aim turns toward the point, clamped by the limits, and spreads over `spine`, `chest`, `neck` and `head` by share (starting values: 0.1, 0.2, 0.3, 0.4). An aim with `part: 'handR'` points that arm's end at the point (a drawn bow, an outstretched hookshot). The face decals use the head's final rotation.
- **Pins:** a pin holds an end effector at a world position while the body moves (a planted foot while the pelvis shifts, a hand on a lever). The pin's world position comes from the view's state, not from content, and it is solved every frame, not every pose step (M3R-D13).
- **Limits** (`RigLimits`, content `rig.json`, one shared default): hinge range for the elbows and knees (starting values 0° to 150°), a swing cone per shoulder and hip, twist and swing ranges for the chest, neck and head (starting values: chest twist ±35°, neck yaw ±70°, pitch −40° to +50°). Values are tuned in M3.6 against the Studio's drags. The runtime clamps and lists the clamped joints in `report.limited`; the Studio shows them (a handle that cannot go further turns amber) and may warn instead of clamping while the author drags.
- **Deterministic and pure.** `solve` is a pure function of its arguments; no clock, no `Math.random`, no allocation beyond its result unless S7-Q8 says the allocation matters. The pole-parallel-to-the-limb fallback is the source's.

#### 4.4.3 Poses (`figure-pose`, M3.6)

A pose is a snapshot of the handles, saved as content. It is what the person making a game sets by dragging in the Studio.

```ts
// content (schema `figure-pose`)
export interface PoseDef {
  readonly id: string
  readonly about?: string
  readonly effectors: Readonly<Partial<Record<EffectorId, EffectorTarget>>>
  readonly poles?: Readonly<Partial<Record<PoleId, PoleTarget>>>
  readonly fk?: Readonly<Partial<Record<Joint, Vec3>>>     // extra local rotations in degrees for what no handle covers (clavicles, feet, hands, the root)
  readonly root?: { readonly pos?: Vec3; readonly yaw?: number } // an offset from where the sim put the figure
}
export function mirror(pose: PoseDef): PoseDef            // left and right swapped, x and yaw negated; mirror(mirror(p)) equals p
export function blend(a: PoseDef, b: PoseDef, t: number): PoseDef   // positions lerp, rotations slerp
```

- A pose names only what it sets. A handle left out is left to the layers below it (the gait's legs under an upper-body slash).
- Poses are small and plain: undo in the Studio is a snapshot of the pose. They are checked at content compile (§6): known handles and joints, finite numbers, positions inside twice the figure's reach.
- A **pose library** ships with the fixture figure: `stand`, `guard-high`, `guard-low`, `point`, `carry`, `kneel`, `hands-on-hips` (for tests and examples; none is a game's).

#### 4.4.4 Clips (`figure-clip`, M3.6)

A clip is a time-ordered list of keyed poses. It replaces the source's hard-coded actions with data, and it is the animation the Owner asked about.

```ts
// content (schema `figure-clip`)
export type Ease = 'step' | 'linear' | 'in' | 'out' | 'inOut' | readonly [number, number, number, number] // a cubic Bézier
export type MaskGroup = 'root' | 'pelvis' | 'torso' | 'head' | 'armL' | 'armR' | 'legL' | 'legR'
export interface ClipKey { readonly t: number; readonly pose: string | PoseDef; readonly ease?: Ease } // ease into this key
export interface FigureClipDef {
  readonly id: string
  readonly length: number                            // seconds at authored speed
  readonly loop: 'once' | 'loop' | 'pingpong' | 'hold' // 'hold' stays on the last key until the sim stops it (a raised shield)
  readonly mask: readonly MaskGroup[]                // the body groups this clip owns while it plays
  readonly mode?: 'override' | 'additive'            // override by default; additive adds the keyed rotations to the lower layers
  readonly rate?: number                             // pose steps a second; the figure's gait `poseRate` if omitted
  readonly blend?: { readonly inMs: number; readonly outMs: number }  // a weight ramp for this clip alone; 0 by default
  readonly keys: readonly ClipKey[]                  // sorted by time, first at 0, last at `length`
  readonly markers?: Readonly<Record<string, number>>  // named instants in seconds, e.g. { windup: 0.1, contact: 0.32 }
  readonly cues?: readonly { readonly t: number; readonly id: string }[]  // presentation cues: a sound, a spark
}
export function sample(clip: FigureClipDef, t: number, poses: PoseLibrary): PoseDef  // the keyed pose at clip time t
export function retime(clip: FigureClipDef, length: number): FigureClipDef          // stretch evenly, markers and cues with it
export function markerTime(clip: FigureClipDef, name: string): number
```

- **Keys hold handles, not joint angles.** Sampling interpolates effector targets (positions lerp, rotations slerp) and runs the solver on the result, so a hand keeps its path through a contact and a clip survives a proportions change. `fk` channels interpolate by slerp.
- **Stepped by default.** The clip is sampled at its `rate` (12 a second), so the hand-animated read the Owner approved in The Last Light survives (M3R-D3). `ease: 'step'` holds a key until the next; `rate` per clip can be raised, or the figure can be told to sample every frame.
- **Masks** say what the clip owns. A clip with `mask: ['armR', 'torso']` changes nothing below the pelvis and nothing in the left arm, so a sword slash plays over the walk (I-h). Two clips with overlapping masks resolve by layer order (§4.4.5).
- **Blend** is a weight ramp for **one** clip as it starts and ends (a shield coming up over 120 ms), applied to the clip's channels against the layers below. It is not a crossfade between two animations, and there is no state machine or blend tree (M3R-D6).
- **Markers, cues and the sim.** Combat needs the picture to hit when the sim's hit window opens. The sim declares an action's length in ticks (`FigureState.action.length`, seconds) and names a marker (`contact`); the view retimes the clip evenly to that length, so the marker lands on the sim's tick to within one pose step. The game's content compile checks that every sim action naming a clip and marker finds it, and that the stretch is between 0.5× and 2× (a warning past that). **Cues** are presentation hooks the view emits once as the clip's time crosses them (a footfall, a swing sound); audio and particles listen; the sim does not.
- **Ported from the source** as fixture clips, to prove the data model against known motion: `reach`, `look` and `flinch` (the generic three). Their end poses must match the source's within 1e-3 figure units (F-g). The other eight (`thrust`, `cup`, `recoil`, `read`, `sit`, `sleep`, `radio`, `push`) are The Last Light's story poses and stay in that game; each is a handful of keys and shows what the data model replaces.

#### 4.4.5 Evaluation order and what the sim says (M3.6)

```ts
export interface FigureState {                       // what the view reads each frame, from render rows
  readonly moving: boolean
  readonly speed: number                             // m/s
  readonly facing: number                            // radians, sim field
  readonly moveDir?: number                          // radians of travel relative to facing: 0 forward, ±π/2 strafe, π backing away
  readonly action?: { readonly id: string; readonly startedAt: number; readonly length?: number } // a clip id; length retimes it
  readonly stances?: readonly string[]               // clip ids held while the sim says so (guard up, bow drawn)
  readonly aim?: readonly AimTarget[]                // lock-on: where the head, chest or a hand points
  readonly outfit?: string
  readonly item?: string
}
export function evaluate(skeleton: Skeleton, def: FigureDef, state: FigureState, time: number, library: Library): Evaluated // pose and world matrices
```

Evaluation, in this order, for one figure:

1. **Locomotion** (code): pelvis and torso, head, arm swing, and the feet's paths as foot targets (the source's `base()` without its action branches), at the walk or idle pose rate.
2. **Stance clips** (`stances`), in the order the sim lists them, each with its mask and its blend ramp.
3. **The action clip** (`action`), one at a time: a new action replaces the old one, with its own blend ramp. Its time is `(now − startedAt) / length × clip.length` when `length` is given, else real time.
4. **Aim** (`aim`): the head, chest or a hand turns toward the point, over whatever the clips set, unless a clip declares the part locked.
5. **Solve:** `solve()` turns every handle into joint rotations: limbs, hips, torso, head, then limits.
6. **Holds:** an item's grip is applied to an arm **no active clip owns** (a clip owns an arm through its mask). A slash that owns `armR` carries the sword; a walk with a lantern keeps the lantern's hold.
7. **Secondary:** the hair spring, then the CPU re-skin of skinned garment parts.

- **Stepped channels, per-frame contact.** Steps 1 to 3 sample at the pose rate. Pins (a planted foot, a hand on a lever) and aim (step 4) re-solve every frame, because contact and eye line read wrong when they step (M3R-D13).
- **Same state, same pose.** Given the same definition, state, time and library, `evaluate` returns equal matrices (I-g). Captures and tests rely on it.
- **A missing clip** named by the sim only is a logged warning once per id and the figure keeps its locomotion; one named by content is a compile error (§6).

#### 4.4.6 What the character editor needs (not built in M3)

The editor suite's Studio (its redesign is in docs PR #138; its rows in PR #136) is where a person drags a figure's hands and feet, saves poses, and keys clips. `figures` supplies pure functions the Studio wraps in its undo-able edits (the editor kit's `EditEvent`):

| The Studio does | `figures` provides |
|---|---|
| Drag a hand, foot, hips, chest or head handle; drag a knee or elbow pole | `solve` with `report` (reached, error, limited joints) fast enough to run on every pointer move (S7-Q8: ≤ 0.1 ms per solve) |
| Show what is out of reach or at a limit | `SolveReport` |
| Pin a foot or hand while dragging the hips | `Targets` pins |
| Mirror a pose; copy a pose onto the other arm | `mirror(pose)` |
| Save a pose; set a key at the playhead; ease picker; loop and mask pickers; markers and cues | `PoseDef`, `FigureClipDef`, their zod schemas, canonical spelling (numbers rounded as the editor kit's codec does) |
| Scrub and play | `sample(clip, t)` and `evaluate` (stepped or smooth), `retime`, `markerTime` |
| Preview a held item, a stance on top of the walk, an aim target | `evaluate` with a `FigureState` |
| Check content before write | the compile checks of §6, importable as functions |

The Studio's own screens, input (tablet-first: drag a handle with a finger, pinch the stage), component states and responsive inventory belong to the editor-suite Studio spec, which cites this section. Nothing in M3 depends on that spec; it depends on this one.

### 4.5 Reserved

(The first revision's §4.5, rigged characters, is cut; the number is kept so references to §4.6 to §4.8 stay valid.)

### 4.6 `pipelines` (`automata-plus/tooling/pipelines`, M3.8, M3.9)

**Platform:** unchanged from 2026-10-16 §4.8 (router, stage cache, budgets, gates, audit log, guard, Effect, Python image stages).

**Character pipeline, one path (free, procedural):** `spec` (a `figure` content file: sliders, gait, outfits, plus `figure-pose` and `figure-clip` files) → `sheet` (a review sheet rendered headless from `base-3d`'s default view at 24 mm: every outfit, the walk in four directions of travel, every pose, and every clip as a strip of its keyed poses with its markers; gate G5) → `install` (gate G6). No paid stage, so no budget key. From the proposal's §10.3. The first revision's rigged path (`model`, `rig`, `animate`, `flatten`) and its Meshy gates G1 and G3 are not extracted.

**Props pipeline:** unchanged (2026-10-16 §4.8): image → Meshy → flattened static GLB, with its paid stages and gates.

### 4.7 Base game and examples (M3.7)

- **`games/base-3d`** (in `automata-plus`): one room with a doorway to a second (boxes, three GLB props, fog), two `camera-view`s (one per room, a cut at the doorway, the stick mapping latching across it), the player as a procedural figure (Wick as `figure` content) with the pose library and four clips (a sword slash that plays over the walk, a raised guard held as a stance, a point, a pickup), a second figure standing in for a target, and a minimal lock-on: a held action sets `lockTarget`, the player strafes (`moveDir`), the head and chest aim at the target and the camera frames both. Splash → menu → room → pause → end on core `runtime`, `host`, `ui`, `content`, with the `post-retro` chain. Its sim is a small plugin (position `x`, `z` in fixed-point metres, facing, moving, view id, lock target, wall boxes), with no physics, so its golden replay runs in Node, Chromium, WebKit and Firefox. `runtime.orientation = "landscape"`; portrait shows M4's rotate hint.
- **One-file examples** (EX rules, `Tier: plus`): module `render3d`: `render3d-meshes.ts`, `render3d-angled-camera.ts`, `render3d-lighting-fog.ts`; module `figures`: `figures-walk.ts`, `figures-outfits-items.ts`, `figures-poses.ts`, `figures-clips.ts`, `figures-aim.ts`; module `post`: `post-retro-chain.ts`; module `physics`: `physics-bodies-3d.ts` on `base-3d`'s room. Each 100 code lines or fewer.

### 4.8 Packaging

Unchanged from 2026-10-16 §4.7: `render-pixi3d`, `figures` (because its only renderer is private) and `base-3d` are `private: true`; the tarball is vendored only in private repositories; `ship prepare` refuses a public target whose bundle contains `@pixi/3d` (M3R-D7 says when `figures` could be published).

## 5. Data and lifecycle flows

**Boot:** as 2026-10-16 §5, with figures, poses, clips, camera views, lamps, props and the post chain arriving as compiled content; the renderer builds `View3D`, bakes static vertex light, then builds each figure's parts.

**Per fixed step:** the sim steps; `apply(result)` feeds the consumers. Characters' sim fields (position, facing, moving, speed, move direction, action, stances, aim target, view id) arrive in render rows.

**Per frame:** views interpolate positions; each figure evaluates its motion at the presentation time (§4.4.5): on a pose step it samples locomotion and clips, every frame it re-solves pins and aim, and it updates joint transforms (and re-skins skinned garment parts); characters relight from the lamps in range; the camera follows and eases toward the active view; the post slot runs.

**View change:** the sim sets the player's view id (a room or sector change); the renderer calls `activate(id, how)`; the stick mapping latches (§4.2). A view change is a camera cut or a 400 ms ease (a cut under reduced motion); no remount, no sim effect beyond the id.

**Outfit or item change** (a sim event or a render-row field): the figure rebuilds its part list once.

**Action:** the sim sets `action { id, startedAt, length }`; the view samples the clip from `startedAt` in presentation time, retimed to `length`, and returns to locomotion when it ends. A clip the figure lacks is a content error at compile time when the content names it, and a logged warning (once per id) when only the sim does.

**Stance:** the sim lists clip ids in `stances` while the state holds; each blends in over its ramp, holds on its last key, and blends out when removed.

**Lamp change, lifecycle background, context lost, dispose and restart:** as 2026-10-16 §5.

**Pipeline runs:** as 2026-10-16 §5, for the one character path (§4.6).

## 6. Failure policy

The 2026-10-16 §6 rows for S7-Q1, S7-Q3, WebGPU fallback, malformed `.glb`/`.bin`, filter compile failure, context loss, public bundles, budgets, paid calls, agents calling `approve`, guard edits and Python stand. Removed: atlas and normal-map rows, camera-zone rows, the first revision's skinning and rigged-model rows. Added:

| Case | Result |
|---|---|
| A `.glb` carries a skin | `ModelInvalid { file, reason: 'skinned' }`; boot shows the asset error panel with Try again. AF draws no skinned glTF |
| A figure names a swatch, gait, hair style, headwear, item, rig-limits id, pose or clip that no library has | Content compile error with `file:line:col` and the missing id |
| A figure's sliders give an impossible skeleton (a negative bone length) | Content compile error naming the slider; the generator never runs on it at boot |
| A pose names a handle or joint that does not exist, a non-finite number, or a position more than twice the figure's reach from the root | Content compile error naming the pose, the field and the value |
| A clip's keys are unsorted, do not start at 0 or end at `length`, a `mask` group is unknown, a marker lies outside `[0, length]`, or a key names a missing pose | Content compile error naming the clip and the key |
| The sim plays a clip with a `length` that stretches it beyond 0.5× to 2× | Content compile warning when the content names it; a logged warning once per id at run time; it still plays |
| An effector target is out of reach | The limb extends fully toward it; `report.reached` lists `ok: false` with the shortfall; nothing throws. The Studio shows it |
| A solve would pass a joint limit | The joint clamps; `report.limited` lists it |
| A pole is parallel to its limb's axis, or a target lies on the limb's root | The source's fallback axis; no NaN; a unit test pins it (I-a) |
| An aim target lies behind the figure beyond the neck's range | The head clamps at its limit; the chest takes its share; the face never turns past it |
| A figure build passes S7-Q9's build budget | A logged warning with the figure id and the time; it still renders |
| A `camera-view` has a lens other than the locked `lensMm`, or a tilt outside 30° to 60° | `automata pipe guard check` fails naming the file and value; changed only by a recorded decision |
| The active view id names no view | Content compile error when the content names it; at run time the camera keeps its last view and logs once |

## 7. UI inventory and states

| Component | States | Focus and input | Host-aware |
|---|---|---|---|
| Asset error panel (existing `ErrorPanel`) | `ModelInvalid` (static or skinned), context lost; Try again | Try again focused | — |
| Pipeline review (MCP elicitation, outside the game) | asked, approved, rejected, cancelled, timed out | The person answers in their MCP client | — |

The first revision's camera orbit buttons are gone: the camera has no player input. The in-game controls GAME-3D needs (a lock-on button, an action button, an item button, the stick) are M4's touch overlay and GAME-3D's design (§17), not M3's. The character editor's screens are the editor suite's.

## 8. Responsive behavior

As 2026-10-16 §8, with "the 3D view fills the field" for every size and the zone/billboard rows removed. The lens fixes the **vertical** field of view at 53.13°, so a wider screen shows more to the sides and never more up or down (the runtime is landscape-only). Authored views keep the focus point and the walls they frame inside the frame at **4:3 and 21:9** (D3-g). The default view puts a 1.62 m figure at 12.7% of the frame's height on every size, about 50 px on 844×390 and 34 px on 780×270 (S7-Q10 records the compact case for the Owner's look). Reduced motion makes view eases and lag instant and keeps gait and clips (they are the character's motion, not camera motion). Landscape phone and compact: the logical field is letterboxed by core as before.

## 9. Test allocation

| Layer | Where | What it proves |
|---|---|---|
| Unit (Node) | `figures` (sliders → skeleton, FK, two-bone IK, effectors, poles, aim, pins, limits, mirror, blend, clip sampling, easing, masks, layers, retime, markers, gait incl. `moveDir`, idle, turn, holds, garments, libraries, content schemas); `render-pixi3d` (angled camera, view activation and mapping latch, static `parseGlb`, character light, cue emission); `post-retro`; `pipelines` | Ported: `procedural-figure.test.ts`'s rig, hold and library tests (the raster, painter and cell-cache tests are not ported). New: I-a to I-j, F-g, F-h, D3-a, D3-g |
| Parity (sim) | `games/base-3d` | Golden replay hash identical in Node, Chromium, WebKit and Firefox (includes the view id, lock target and stick mapping) |
| Parity (render) | GPU runner | WebGL2 and WebGPU captures of the S7 scene, each `post-retro` pass and `base-3d`'s rooms within M3-D5's tolerance |
| Fake-host E2E | each example and `base-3d` under `@ruken/sdk-host`, served with `compileHeaders` | Boots, nothing before ready, zero console errors and CSP violations, no `generateSpawnBurst`; `ModelInvalid` shows the panel; context loss recovers; the doorway cut keeps the character moving the same way |
| Frame budget | GPU runner, PRODUCT.7's probe | p95 ≤ 33.3 ms on both phone profiles for `base-3d` and the S7 scene |
| Pipelines integration | fake Meshy and OpenAI servers on recorded fixtures | The procedural run (spec → sheet → install) and the props run: stages, cache skips, gates, install output; no paid call in CI |
| Owner | real phones, the look of the angled view, real paid props runs | §13 |

## 10. Feedback workflow

As 2026-10-16 §10. Focused first: one `figures` Vitest file in Node (a rig test needs no browser), then one example's E2E in Chromium, then the GPU runner for one capture or probe.

## 11. Ruken alignment and requests

As 2026-10-16 §11 (CSP, renderer `webgl2`, build file types: `.glb`, `.bin`), and R-8, R-9 stand. No new request.

## 12. Tasks

| ID | Task | Lane | Depends on | Deliverable and acceptance |
|---|---|---|---|---|
| M3.0 | This revised spec, reviewed | integration | — | Owner review; M3R-D1 to M3R-D15 confirmed or changed |
| M3.1 | Spike S7 (revised) | render3d | M3.0 | §3; `docs/spikes/s7-pixi3d.md` and verdict; S7-a to S7-f |
| M3.2 | `pixi.js` 8.22 in core | ship, runtime | M3.1 verdict | Unchanged; V-a |
| M3.3 | `post-retro` | render3d | PRODUCT.1, PRODUCT.5 | Unchanged (2026-10-16 §4.5); PF-a to PF-c |
| M3.4 | `render-pixi3d`: renderer, meshes and props, the angled camera, lighting, fog | render3d | M3.2, PRODUCT.5 | §4.1–§4.3, §4.8; examples `render3d-*`; D3-a, D3-c, D3-d, D3-f, D3-g |
| M3.5 | `figures`: definition, skeleton, locomotion, holds and the figure view | figures (new) | M3.4 | §4.4.1; examples `figures-walk`, `figures-outfits-items`; F-a to F-e, F-h |
| M3.6 | `figures`: the IK rig, poses and clips | figures | M3.5 | §4.4.2 to §4.4.6; examples `figures-poses`, `figures-clips`, `figures-aim`; I-a to I-j, F-g |
| M3.7 | `games/base-3d` and `physics-bodies-3d` | integration, sim | M3.3, M3.5, M3.6 | §4.7; B-a to B-c |
| M3.8 | `pipelines` platform | pipelines | M3.0, PRODUCT.5 | Unchanged; PL-a to PL-e |
| M3.9 | Character (procedural) and props pipelines | pipelines | M3.8, M3.6 (the sheet draws poses and clips) | §4.6; PL-g, PL-h |
| M3.10 | M3 exit | integration | M3.7, M3.9 | X-a to X-c on the GPU runner; Owner gates (§13) |

**Order:** M3.1 and M3.8 first (neither needs an unmerged package; M3.8 needs PRODUCT.5). M3.3 when PRODUCT.1 and PRODUCT.5 merge. M3.2 after S7's verdict; then M3.4; M3.5 then M3.6; M3.7; M3.9 after M3.8 and M3.6; M3.10 last. The first revision's M3.6 (rigged characters) is replaced, not deleted: the number now means the rig.

**Lanes for 04:** render3d (`automata-plus/packages/{render-pixi3d,post-retro}`, `spikes/s7-pixi3d/`), **figures** (new: `automata-plus/packages/figures`), pipelines. Integration owns the base game.

## 13. Exit criteria and acceptance cases

**Success:**
- **S7-a.** The S7 scene boots under `compileHeaders`' CSP in Chromium, WebKit and Firefox with zero CSP violations and zero console errors.
- **S7-b.** The S7 report lists every `@pixi/3d` symbol AF imports, confirms `Container3D` in `RenderDeltaConsumer`, and confirms the camera's field of view equals `fovOf(24)` = 53.13°.
- **S7-c.** WebGL2 and WebGPU captures on the GPU runner are non-black and within M3-D5's tolerance.
- **S7-d.** Both phone profiles hold p95 ≤ 33.3 ms for the S7 scene (or the report records the miss and the cut budgets).
- **S7-e.** The report gives a rig solve's cost per pose step and per frame (S7-Q8) on the phone profile.
- **S7-f.** The report gives a figure's per-frame and per-build cost on the phone profile (S7-Q9) and the legibility numbers and capture of S7-Q10.
- **V-a.** After the 8.22 bump, every existing golden hash, layout contract and E2E journey is unchanged.
- **PF-a, PF-b.** As 2026-10-16 §13.
- **D3-a.** Activating a view with `ease` moves the camera to the view's yaw, tilt and distance over 400 ms and instantly under reduced motion; the camera's lens is 24 mm (53.13° vertical) in every view.
- **D3-c.** A `.bin` prop and the same prop as `.glb` produce identical vertex buffers.
- **D3-d.** Interpolated character positions at `alpha` 0.5 lie halfway between the last two ticks.
- **D3-e.** A lamp switched off by a sim event darkens the static meshes and the characters in its range, and only those.
- **D3-g.** For each authored view of `base-3d`, the focus point and the room's walls it frames are inside the frame at 4:3 and 21:9.
- **F-a.** Two fixture figures with different sliders build skeletons whose bone lengths follow the sliders, from one generator.
- **F-b.** Holding an item changes only the holding arm's joints: every other joint's world matrix is equal (1e-9) with and without it, across walk, idle and turn.
- **F-c.** The walk repeats exactly after one cycle at the gait's pose rate.
- **F-d.** Swapping an outfit rebuilds the part list once and changes no joint.
- **F-e.** A figure naming a missing library id fails content compile with its location.
- **F-g.** The fixture clips `reach`, `look` and `flinch` end within 1e-3 figure units of the source's end poses at the same state.
- **F-h.** With `moveDir` of 0, π/2 and π, the stride vector is the forward vector rotated by it, and a half-turn plays the same cycle backwards.
- **I-a.** Every limb effector reaches any reachable target (hand or foot within 1e-6 figure units); for an unreachable target the limb is fully extended toward it and the report names the shortfall; a pole parallel to the limb, and a target on the limb's root, give finite joints.
- **I-b.** Turning a pole by 90° swings the knee or elbow's bend plane by 90° and moves the end effector by less than 1e-6.
- **I-c.** After a solve no hinge or cone exceeds its limit, and `report.limited` lists exactly the joints a limit clamped.
- **I-d.** A pinned foot or hand stays within 1e-6 of its world position while the pelvis moves within the limb's reach, at every frame including between pose steps.
- **I-e.** An aim target inside the limits is hit by the head's forward axis within 0.5°; one outside them clamps at the limit and the face never turns past it; spreading the aim changes `spine`, `chest`, `neck` and `head` by their shares.
- **I-f.** `mirror(mirror(p))` equals `p` for every fixture pose; a pose written to content and read back is equal (canonical spelling); `blend(a, b, 0)` equals `a` and `blend(a, b, 1)` equals `b`.
- **I-g.** `evaluate` is deterministic: the same definition, state, time and library give equal matrices, across 1,000 random-but-seeded times; a `loop` clip's value at 0 equals its value at `length`.
- **I-h.** A clip with `mask: ['armR', 'torso']` changes no joint of the legs or the left arm: their world matrices equal the same evaluation without the clip (1e-9); a held item on the left arm still holds.
- **I-i.** `retime(clip, L)` scales key times, markers and cues evenly; a clip played with `action.length = L` reaches its `contact` marker at `startedAt + markerTime × L / length`, within one pose step.
- **B-a.** `base-3d`'s golden replay matches in Node, Chromium, WebKit and Firefox.
- **B-b.** `base-3d` boots under the fake host and under Ruken's local stack, nothing renders before ready, zero CSP violations.
- **B-c.** `physics-bodies-3d` keeps a golden hash identical in four engines.
- **PL-a to PL-c.** As 2026-10-16 §13.
- **PL-g.** As 2026-10-16 §13 (props).
- **PL-h.** A procedural run renders the review sheet (every outfit, the walk in four directions, every pose, every clip as a strip with its markers) and installs the `figure`, `figure-pose` and `figure-clip` entries, with no paid stage and no budget key.
- **X-a.** `base-3d` holds p95 ≤ 33.3 ms on both phone profiles on the GPU runner, WebGL2 and WebGPU, under Ruken's CSP.

**Failure cases that must be shown by tests:**
- **S7-g.** A page importing `@pixi/3d/extras` under the CSP records a violation; the bundle test fails when `generateSpawnBurst` is present.
- **D3-f.** A malformed or skinned `.glb` shows the `ModelInvalid` panel naming the file, and Try again reloads it.
- **I-j.** A pose with an unknown handle, an out-of-reach position or a non-finite number, and a clip with unsorted keys, a missing pose, an unknown mask group or an out-of-range marker, each fail content compile with the location.
- **PF-c, PL-d, PL-e, X-b, X-c.** As 2026-10-16 §13 (X-c's room is `base-3d`'s).

**Gates reported separately:** implemented; locally verified; GPU-runner verified; deployed (Ruken local stack and the private dev host only); Owner accepted.

**Owner acceptance (never ticked by an agent):**
- D-1 confirmed or changed after S7.
- `base-3d` played on a real phone (one Android, one iPhone) under Ruken's local stack, with device, browser, renderer and date recorded; the angled 24 mm view's look (S7-Q10's capture and the played room) and the figures' look and motion approved from evidence.
- The four fixture clips and the pose library judged from the review sheet and played in `base-3d`.
- One procedural character through the pipeline with G5 and G6, on the Owner's keys for any paid props stage, with the audit lines recorded.

## 14. Risks

| Risk | Mitigation |
|---|---|
| Procedural figures look like low-poly mannequins in real 3D, without the sprite painter | Stepped poses, the source's garments and faces, the palette and `post-retro`'s outline pass; the Owner judges the look at M3.10; M3R-D2 records the painter as droppable, not lost (it stays in The Last Light) |
| A 24 mm lens close to the action stretches figures near the frame's edge and makes the room feel deep | The default distance and tilt are tuned in S7-Q10 on captures; authored views keep the focus near the middle; D3-g checks the edges at 4:3 and 21:9; the lens is a locked value the Owner can change by one recorded decision |
| Phone FPS with six figures solving IK | S7-Q3 and S7-Q8 measure it; the rig scope can shrink (fewer solved effectors per figure) without a contract change; cut values become content limits the guard enforces |
| Authored clips fight the gait (a slash sliding the feet) | Masks keep the clip off the legs; pins hold the planted foot every frame; I-d and I-h prove both |
| Stepped poses look jittery where the eye wants contact | Pins and aim solve every frame (M3R-D13); the clip's `rate` and a smooth option are per clip and per figure |
| Joint-limit values are wrong for the art | Starting values only; tuned in M3.6 in the Studio; limits are content in `rig.json`, not code |
| The Studio's needs outgrow `figures`' API | §4.4.6 lists the pure functions the Studio needs and the editor-suite spec cites them; additions are additive |
| Cutting rigged characters drops the Meshy character path | It is cut for now by the Owner's word; the props pipeline keeps Meshy for static props; nothing here prevents a later skinned view |
| The Last Light keeps moving | Each task's plan re-reads its files at the current commit and records it |

## 15. Open decisions (recommended defaults; in effect once approved)

"Owner" in the first column marks the Owner's own words from the direction table; the rest are recommended defaults.

| ID | Question | Recommended default | Why |
|---|---|---|---|
| M3R-D1 (Owner, 2026-10-18 and 2026-10-23) | What does M3 deliver? | **3D characters: procedural figures with an IK rig, authored poses and clips, in a 3D room, one base game.** No 2.5D and no rigged glTF anywhere in AF | "drop 2.5D" and "Cut the rigged gltf, procedural only for now" |
| M3R-D2 | The figure painter (sprite-cell look) | **Not extracted.** It stays in The Last Light; figures render as meshes | It is the 2.5D look; extracting it would keep 2.5D alive in another form |
| M3R-D3 | Pose stepping in 3D | **Authored channels step at the pose rate** (default 12 per second), with an option for every frame, per clip and per figure | The hand-animated read is what the Owner approved in The Last Light; smooth is one flag away |
| M3R-D4 | Lighting moving characters | **Per character per frame (ambient plus lamps in range), as a tint**; static meshes keep the baked vertex light | Baking cannot follow a moving, deforming mesh; per-character is one small sum |
| M3R-D5 | Where `figures` lives | **Its own Plus package, renderer-free**; the 3D view in `render-pixi3d` | The data, rig and motion are testable in Node and outlive any one renderer |
| M3R-D6 (Owner, 2026-10-23) | Animation scope in M3 | **Procedural gait, the IK rig, authored poses and clips with masks, a per-clip weight ramp, markers and cues.** No glTF skins or clips, no crossfade between animations, no blend trees, retargeting, root motion or state machines | "Cut the rigged gltf, procedural only for now"; the rig adds what the Owner asked for |
| M3R-D7 | Publishing `figures` | **Private while D-1 stands**, because its only renderer is private; revisit if D-1 changes | No public package that cannot be drawn |
| M3R-D8 | `base-25d` and the rigged character | **Dropped.** `base-3d` is the only M3 base and shows procedural figures | One base per dimension; 2.5D is not a dimension AF ships; rigged glTF is cut |
| M3R-D9 (Owner, 2026-10-23) | The camera | **An angled, high three-quarter camera on a 24 mm lens** (53.13° vertical), a fixed yaw and tilt per authored view, a following focus, no player orbit. Reading the Owner's Crow Country reference as per-room authored views; one view for the whole level is the same contract | "use an angle like crow country" and "Go with 24mm focal length for camera"; klipp (M9.0) is checked against authored views |
| M3R-D10 | AF 1.0's scope | **2D, with 3D characters as a private Plus extension** (1.0 no longer claims 2.5D). **Open: the Owner has not answered whether 3D belongs in 1.0** (bus question) | Follows from M3R-D1 and D-1 |
| M3R-D11 | The view's tilt, distance and focus | **Tilt 45° (authored 30° to 60°), distance 9 m (6 to 12), focus 1.0 m above the followed position**, locked in `pipeline.toml` `[locked]` for tilt and lens | A 1.62 m figure fills 12.7% of the frame's height; tuned on S7-Q10's captures; the Owner did not give a tilt |
| M3R-D12 | Rig scope | **Four two-bone limbs with poles, hips, chest, head, a look-at/aim that spreads over spine, neck and head, pins, and limits.** No general chain solver (FABRIK/CCD), no physics, no ground-contact IK in M3 | What manual posing and the action-adventure's combat clips need; stairs and slopes come from GAME-3D (M9) |
| M3R-D13 | Stepped channels, per-frame contact | **Poses and clips step; pins and aim re-solve every frame** | Contact and eye line read wrong when stepped; the cost is a few two-bone solves a frame (S7-Q8) |
| M3R-D14 | Sim and clip timing | **Clips declare markers; the sim declares an action's length; the view retimes evenly** and a content check ties the sim's contact tick to the marker | Combat needs the picture to hit when the sim's window opens, without the sim reading a joint |
| M3R-D15 | The stick across a view change | **The mapping latches to the old view until the stick is released or turns by more than 90°** | The classic fixed-camera rule; GAME-3D.0 tunes it |

M3-D3 (`pixi.js` 8.22), M3-D4 (WebGL2 default), M3-D5 (tolerance), M3-D6 (phone profiles), M3-D7 (Python image stages), M3-D8 (`.bin`), M3-D9 (no paid calls in CI) and M3-D12 (the guard hook) carry over unchanged. M3-D10 (which pipelines move) becomes "platform, character (procedural) and props". M3-D11 (`base-3d`'s static mesh character) is replaced by M3R-D6 and M3R-D8.

## 16. Effects elsewhere

- **D-1** (`render-pixi3d` unpublished): unchanged, and now also covers `figures` (M3R-D7). The 3D work it gates is larger (all of M3), so S7's verdict matters more: a D-1 change opens all of M3 to public builds at once.
- **GAME-3D (02, 03):** its two rows now carry the Owner's direction (§17). GAME-3D.0 cites this spec for the camera, the rig and the clip data.
- **M9 (3D merge):** it planned the rigged character and animation pipeline, and the first revision moved them into M3. They are now **cut** by the Owner, not moved. M9's selection becomes: the third-person controller on the angled views (pmndrs/klipp, checked in M9.0 against authored per-room views: if its rails and cuts do not fit, M9.0 records that and keeps M3's `CameraRig`), lock-on targeting, combat and hit/hurt clips on M3's rig, items and inventory, the dungeon pieces (keys, doors, switches, pushable blocks), ground-contact IK for stairs and slopes (a presentation-only probe against the baked static geometry, using M3's pin API), brush-based environments, and whatever else GAME-3D proves. The M9.0 row in 02 is updated to say so.
- **M6:** its 2.5D-dependent parts need a look when M6's tasks are planned: sector-derived occlusion (2026-10-16 §4.4 said "arrives with `sectors` in M6") now feeds M3.4's static vertex light; a sector can carry the `view` id of §4.2; cutscene cameras are free shots (not an orbit around a billboard) and the clip data is the cutscene acting layer. No M6 row changes in this PR; the M6 plans re-read this spec.
- **The 3D level editor (ED3D):** two requests, not edits: a sector (or a view volume) may reference a `camera-view` id, and the editor offers a preview of the authored view at 24 mm and its tilt so authors see the framing. The editor's own walk camera (ED3D-D8, 69°) is unrelated. The ED3D lane decides how; this spec only fixes the content shape (§4.2).
- **The editor suite's Studio:** the character editor edits `figure`, `figure-pose` and `figure-clip` content through §4.4.6. The mockups for that are in progress in the editor-suite thread (docs PR #138).
- **M8:** "AF finished for 2D and 2.5D" becomes "2D, with 3D characters in Plus" (M3R-D10, still open). The Last Light slice (puzzle and sectors on Plus) is sim-side and unaffected.
- **01, 00 and AGENTS.md:** their M3 rows and "2D and 2.5D" wording point to this spec.

## 17. The game the characters are for (direction brief for GAME-3D.0)

**Owner direction, 2026-10-23 08:45:45 UTC** (`cmsg_01VQPgZzjNxjPkiB5eeQRiaYBZMPTigDhn8zdJ52vrPKZ9`): the 3D game is an action-adventure in the spirit of Ocarina of Time (the Owner's words: "like ocarina of time switch 2 remake"), its characters procedural, its camera Crow Country's angle. The coordinator's reading, kept here for GAME-3D.0 to confirm or change: a third-person action-adventure with **lock-on combat, dungeons, items and puzzles**.

GAME-3D.0 designs the game, in its own repo, with its own review. This section records what that direction asks of AF, so M3 does not build the wrong things and M9 knows what to expect.

| The game needs | Where it comes from |
|---|---|
| A character seen from a high three-quarter angle through authored per-room views, with doorway cuts | M3.4 (`angledCamera`, `camera-view`), the view id as sim state (§4.2) |
| A hero, enemies and townsfolk as procedural figures: different builds, garments, held items | M3.5 (`figures`) |
| Hero moves: a sword slash and combo, a raised shield, a roll, a jump or climb, aiming and firing a ranged item, a pickup, a push, a hurt and a fall | Authored as `figure-pose` and `figure-clip` data with the rig (M3.6), in the Studio; markers tie them to sim hit windows (M3R-D14) |
| Lock-on: a target selected in view, the camera framing hero and target, strafing around it, the head and weapon aimed | Sim-side targeting system (GAME-3D, then M9); M3 provides `moveDir`, `aim`, `frame(lock)` and a demo in `base-3d` |
| Dungeons: rooms with keys and doors, switches, pushable blocks, one-way gates, a boss room | Sector levels from the 3D editor (ED3D), sim systems in the game; M6's `sectors` and puzzles where they fit |
| Items: a sword, a shield, a ranged item, a utility item, collectables, an inventory and a map | Sim and UI in the game; held items are `items.json` entries with holds (M3.5) |
| Enemies with simple readable behaviors and clips | Sim AI in the game; clips as above |
| Touch controls for a lock-on action game | M4's touch overlay and gestures; GAME-3D.0 designs the layout |

**Suggested scope for GAME-3D.0 to confirm** (not decided): one hub area, one dungeon of six to eight rooms, a boss, three items, and one save slot; the hub and the dungeon built in the 3D editor.

**Not asked for:** an open overworld, terrain and streaming (TERRAIN.0, after launch), rigged or skinned characters, a free camera, online play.
