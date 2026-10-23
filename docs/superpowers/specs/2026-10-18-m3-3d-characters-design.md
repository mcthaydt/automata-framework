# M3: 3D characters, procedural and rigged (milestone spec, revised)

- **Status:** Drafted 2026-10-18, **awaiting Owner review**. It replaces the 2.5D scope of the [2026-10-16 M3 spec](./2026-10-16-m3-25d-pipelines-design.md) (approved 2026-10-16), whose amendment at the top says what is dropped and what carries over. Task **M3.0** (revised) in [02 Master delivery plan](../../02-master-delivery-plan.md). Nothing here is implemented before that review (01 Decomposition §5, [04 How we build](../../04-how-we-build.md)), except spike S7 (M3.1), which is exempt from TDD (A0+A1 spec §2). Open decisions M3R-D1 to M3R-D10 (§15) carry recommended defaults; they are in effect only once the Owner approves them.
- **Owner direction, 2026-10-18 (via the Desk):** "drop 2.5D; M3 becomes procedural-character 3D plus rigged-character 3D." Earlier direction still in force: 2026-10-11 (2D, then 3D; Ruken first; PixiJS for 2D and 3D); 2026-10-16 PD-1 (every extension is Automata Plus) and PD-3 (`post-retro`'s 2D part runs on the FloorFifty path); 2026-10-17 (the 3D camera uses pmndrs/klipp, evaluated and pinned in M9.0).
- **Depends on:** M2 (merged). PRODUCT.5 (the `mcthaydt/automata-plus` workspace) before any M3 package task, because every M3 package is Plus. PRODUCT.1's post-filter slot before `post-retro`. Not on M4 or M5, except that the base game uses M4's input when it lands.

## 0. Sources

| Source | Revision | Used for |
|---|---|---|
| AF `main` | `7143416` | What exists (§2). |
| The 2026-10-16 M3 spec | as merged | Every section this spec keeps by reference (§2, §4.5, §4.7, §4.8's platform, §11) |
| The Last Light, `mcthaydt/PixiJS3D_Experiment_001` | `bbd7a65` (shallow clone at `/home/user/pixijs3d_experiment_001`, read 2026-10-18) | The procedural figure (`src/render/figure/`, 15 files, 2,421 lines; `tests/procedural-figure.test.ts`, 31 top-level tests), its proposal (`docs/superpowers/proposals/2026-10-16-procedural-figures/` spec, plan, result; PR #114), the character pipeline's `model` and `rig` stages, `render/glb.ts` |
| `@pixi/3d` 0.1.0-beta.2 | the tarball The Last Light vendors | glTF skins and animation (`dist/assets/loaders/gltf/process/processSkins.js`, `processAnimations.js`, `dist/animation/AnimationPlayer`, `core/{gl,gpu}/bits/skinningBit*`), read from the file list, not run |

**Not verified here:** skinned meshes under Ruken's CSP and on phones (S7 measures both); the beta's terms beyond The Last Light's README (unchanged from the 2026-10-16 spec); Meshy's rig and animation API terms and prices.

## 1. Goal and boundaries

**Goal.** A game on AF can put characters in a 3D room and move them: **procedural characters** built from data (sliders, a shared skeleton, garments, hair, headwear and held items, procedural gait and actions), and **rigged characters** from a skinned glTF with named animation clips. Both are drawn as real 3D meshes by `render-pixi3d` on WebGL2 (WebGPU when opted in), under Ruken's CSP, at 30 FPS or better on the phone profiles, in a private build. A character's look and motion are presentation: the sim says where it is, where it faces, whether it moves and which action it plays, and never reads a joint.

**What changed from the 2026-10-16 spec.** 2.5D is dropped: fixed camera zones, eight-direction billboards, CPU-lit sprite atlases, `games/base-25d`, and the character pipeline's atlas stages. In their place: the procedural figure as 3D meshes, rigged characters, and one 3D base game showing both. The amendment in the 2026-10-16 spec lists every row.

**Plus (paid, PD-1), in `mcthaydt/automata-plus`:**
1. `render-pixi3d`: the 3D renderer on `@pixi/3d`, now including skinned meshes and the figure view. Private, unpublished, never in a public build (D-1, unchanged).
2. `figures`: procedural characters. The data model and the motion are renderer-free TypeScript; their 3D view lives in `render-pixi3d`.
3. `post-retro`: unchanged (2026-10-16 spec §4.5), on the FloorFifty path first.
4. `pipelines`: the platform (unchanged) and two pipelines, character (now: rigged and procedural paths) and props (unchanged).
5. One base game, `games/base-3d`, and one-file examples per feature.

**Core (free):** only the `pixi.js` 8.22 bump (M3.2), as before. No other core change; a missing public seam becomes a change request to its owning lane.

**Exclusions:**
- A third-person camera and controller, brush-based environments, physics-driven character motion and ragdolls: M9 (from GAME-3D). M3's camera is a plain follow camera (§4.2); klipp is M9's.
- Animation retargeting between skeletons, blend trees, root motion, facial animation and lip sync, cloth simulation: not in M3 (M3R-D6).
- The figure painter (The Last Light's CPU raster to a sprite cell: `raster.ts`, `paint.ts`, `ramp-light.ts`): it is the 2.5D look and is dropped with it (M3R-D2).
- Sector maps, nav, puzzles, narrative, cutscenes and the environment pipeline: M6 (see §16 for what this revision means for M6).

## 2. What already exists

As the 2026-10-16 spec §2, re-checked at `7143416` for the rows M3 still uses: `GameRenderer` and `RendererFactory` (`packages/runtime/src/render/renderer.ts`), `createPixiRenderer` and its `setup(stage)` (`packages/render-pixi/src/renderer.ts`), `RenderDeltaConsumer` and `EntityView` (`packages/render-pixi/src/delta/`), `filterPrograms`, `render-pixi/no-eval`, `defineExtension`, the 3D physics components (`packages/physics/src/physics-3d*.ts`), the `pixi.js` 8.21.0 pin, and the release list refusing `render-pixi3d`. Not in AF anywhere: any 3D rendering, glTF, skinning, a figure model.

## 3. Spike S7, revised (M3.1)

S7 keeps the 2026-10-16 questions S7-Q2 (WebGL2/WebGPU parity), S7-Q4 (non-black capture), S7-Q6 (`pixi.js` 8.22) and S7-Q7 (bytes). It changes the scene and adds two questions:

| ID | Question | Pass |
|---|---|---|
| S7-Q1 | Does a `View3D` scene (a box room, one procedural figure as part meshes, one skinned glTF playing a walk clip, one static GLB prop, linear fog) boot under Ruken's CSP after `render-pixi/no-eval`? | Renders; zero `securitypolicyviolation` events and zero console errors in Chromium, WebKit and Firefox |
| S7-Q3 | Phone profiles: does that scene hold 30 FPS with two figures and two skinned characters walking? | p95 frame time ≤ 33.3 ms over 20 s after a 3 s warm-up on both phone profiles (M3-D6, unchanged), measured with PRODUCT.7's probe on the GPU runner; SwiftShader rejected |
| S7-Q5 | Which beta APIs does AF depend on, and do they fit AF's seams? | The written symbol list (now including the glTF loader's skin and animation path and `AnimationPlayer`, never `./extras`); `Container3D` accepted where `RenderDeltaConsumer` takes a `Container`; `View3D` mountable in `setup` |
| S7-Q8 (new) | Does skinning work on both backends? | The skinned character's joint matrices match a CPU reference within 1e-4 at five clip times; WebGL2 and WebGPU captures within M3-D5's tolerance |
| S7-Q9 (new) | What does a procedural figure cost per frame as meshes? | Joint update plus mesh transforms per figure per frame, and the one-off build per outfit change, in ms on the phone profile; target ≤ 0.3 ms a frame per figure, ≤ 20 ms a build |

Outputs as before: `spikes/s7-pixi3d/` (removed when the verdict is recorded), `docs/spikes/s7-pixi3d.md` with numbers, browser, runner and commit, and a verdict row. A failed S7-Q1, S7-Q3 or S7-Q8 stops M3.4 onward and goes to the Owner with the evidence.

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
- Views: `mesh(model)` (static GLB or packed `.bin`), `box(size, material)`, `figure(def, options)` (§4.4), `rigged(model, clips)` (§4.5). `billboard` is gone.
- `parseGlb` now reads skinned meshes too (joints, weights, inverse bind matrices, the skeleton's node tree) through `@pixi/3d`'s glTF loader; AF's own `parseGlb`/`parsePack` from The Last Light keep the static path for `.bin` props.

### 4.2 Camera (`render-pixi3d` `camera/`, M3.4)

```ts
export interface CameraRig {
  readonly lens: { readonly mm: number; readonly tiltDeg: number } // content
  follow(x: number, y: number, z: number): void                     // the followed view's interpolated position
  orbit(steps: -1 | 1): void                                        // 45° per step around the target
  update(frameSeconds: number): void
}
export function followCamera(options: { readonly distance: number; readonly height: number; readonly lag?: number }): CameraRig
```

- One follow camera with an eased lag and 45° orbit steps (eased over 250 ms, instant under reduced motion). Presentation only: it reads interpolated positions and writes only the `View3D` camera (law 1).
- Camera zones, octants and hysteresis are gone with 2.5D. A third-person camera with collision is M9 (klipp).

### 4.3 Lighting and fog (M3.4)

- `SceneLighting { lamps: Lamp[]; ambient: number }` from content.
- **Static meshes:** vertex light baked once per mesh at load, with box/plane occlusion (The Last Light `render/indirect-light.ts`, `render/occlusion.ts`), as 2026-10-16 §4.4. A lamp change (a sim event) rebakes the meshes in range.
- **Moving characters** (figures and rigged): lit per character, not per vertex bake, because they move and deform. Each frame a character takes ambient plus the N·L of each lamp in range at its position, as a material tint on `@pixi/3d`'s lit material; this is S7-Q9's budget question for figures (M3R-D4).
- Fog: `View3D`'s linear fog; the particle mist from the 2026-10-16 spec is kept only if S7 measures it within budget, else dropped (it was a 2.5D set piece).

### 4.4 `figures`: procedural characters (`automata-plus/packages/figures`, M3.5)

The Last Light's procedural figure, made game-agnostic, minus its sprite painter:

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
}
// libraries, content too: swatches, gaits, hair styles, headwear, items (The Last Light `library/*.json`)
export interface FigureState {                       // what the view reads each frame, from render rows
  readonly moving: boolean
  readonly speed: number                             // m/s
  readonly facing: number                            // radians, sim field
  readonly action?: { readonly id: ActionId; readonly startedAt: number }
  readonly outfit?: string
  readonly item?: string
}
export function skeleton(def: FigureDef): Skeleton               // 20 joints plus a socket per hand
export function evaluate(skeleton: Skeleton, gait: Gait, state: MotionState): Evaluated // pose and world matrices
export function build(def: FigureDef, skeleton: Skeleton, outfit: string, item: string | null): Built // part meshes
export const figuresExtension: ExtensionDef<'figures'>
```

- **Source:** The Last Light `src/render/figure/` at `bbd7a65`: `genes.ts`, `rig.ts`, `motion.ts`, `parts.ts`, `garments.ts`, `cast.ts`, `math.ts`, `outfits.ts` and the five library files, with `tests/procedural-figure.test.ts`. **Not extracted:** `raster.ts`, `paint.ts`, `ramp-light.ts` (the sprite look), `stage-figure.ts`, `workshop.ts`, `review-cutscene.ts` (game wiring), and the characters themselves (Ada, the Nurse, the Porter stay in the game; AF's fixture figure is Wick, Emberwick's character, as data).
- **No character in code** (The Last Light iteration 33): hair styles, headwear, swatches, gaits and items are content; a figure names them or writes its own inline.
- **Motion** is The Last Light's layered motion: gait (foot trajectories, two-bone leg IK, pelvis bob and sway, arm swing, head stabilise), idle, turn, actions (`reach`, `look`, `flinch`) and holds. A hold rewrites only its arm's joints after every other layer, so an item never changes the rest of the pose (the source's invariance test comes with it).
- **Presentation time.** Motion is a pure function of the definition, the state and presentation time (the frame clock), not of the sim tick. It is deterministic for a given time, so captures are stable, but it never feeds back into the sim (law 1). `Math.random` is not used: the source's `hash` seeds twitches and stain placement.
- **Drawing (in `render-pixi3d`'s `figure` view):** each part is a `Mesh3D` under its joint's `Container3D`; skinned parts (skirts, coat tails) are skinned on the CPU per pose step (two-bone linear blend, as the source). Poses step at the gait's pose rate (The Last Light: 12 or 8 per second), not every frame, so the stepped, hand-animated feel survives in 3D (M3R-D3). An outfit or item change rebuilds the part list once.
- **Faces:** the source's point decals become small textured quads on the head, shown only when facing the camera.
- `figures` is renderer-free: it imports nothing from Pixi, so its unit tests run in Node, and a future renderer can draw the same figures.

### 4.5 Rigged characters (`render-pixi3d` `rigged/`, M3.6)

```ts
// content (schema `rigged-character`)
export interface RiggedCharacterDef {
  readonly id: string
  readonly model: string                             // a .glb with one skin
  readonly clips: Readonly<Record<'idle' | 'walk' | string, string>> // AF name → clip name in the file
  readonly speeds?: Readonly<Record<string, number>> // m/s at which a locomotion clip plays at rate 1
  readonly sockets?: Readonly<Record<'handL' | 'handR' | string, string>> // AF socket → joint name
  readonly crossfadeMs?: number                      // default 150
}
export interface RiggedState {
  readonly moving: boolean
  readonly speed: number
  readonly facing: number
  readonly action?: { readonly id: string; readonly startedAt: number }
  readonly item?: string
}
```

- The `rigged` view loads the model through `parseGlb`, plays `idle` or `walk` from `RiggedState` with the clip rate scaled by `speed / speeds.walk`, crossfades over `crossfadeMs`, and plays a named one-shot action then returns to locomotion. Held items ride a socket joint.
- Clip time is presentation time; the sim never reads it.
- A model with more than one skin, a missing named clip, or a missing socket joint is a load error naming the file and the name (§6).
- M3's rigged characters come from the character pipeline's rigged path (§4.6) or any glTF with one skin and named clips.

### 4.6 `pipelines` (`automata-plus/tooling/pipelines`, M3.8, M3.9)

**Platform:** unchanged from 2026-10-16 §4.8 (router, stage cache, budgets, gates, audit log, guard, Effect, Python image stages).

**Character pipeline, two paths:**
- **Rigged** (paid): `look` (gate G1) → `turnaround` → `views` → `model` (Meshy multi-image to 3D; gate G3) → `rig` (Meshy rig) → `animate` (Meshy animation clips: idle, walk, and the actions the spec names) → `flatten` (texture to the game's palette) → `install` (gate G6: the character in game). Install writes the `.glb` and a `rigged-character` content entry (clip and socket names). From The Last Light `scripts/pipeline/character.py`; the stages after `rig` that made atlases (`render`, `pixelate`, `detail`, `polish`, `normals`) are not extracted.
- **Procedural** (free): `spec` (a `figure` content file: sliders, gait, outfits) → `sheet` (a review sheet rendered headless from `base-3d`'s camera: every outfit, the walk in eight views, every action; gate G5) → `install` (gate G6). No paid stage, so no budget key. From the proposal's §10.3.

**Props pipeline:** unchanged (2026-10-16 §4.8).

### 4.7 Base game and examples (M3.7)

- **`games/base-3d`** (in `automata-plus`): one room (boxes, three GLB props, fog), the player as a procedural figure (Wick as `figure` content) and one rigged character (a fixture glTF with idle and walk clips, recorded with its licence), a follow camera with orbit, the `post-retro` chain. Splash → menu → room → pause → end on core `runtime`, `host`, `ui`, `content`. Its sim is a small plugin (position `x`, `z` in fixed-point metres, facing, moving, wall boxes; the rigged character walks a fixed patrol), with no physics, so its golden replay runs in Node, Chromium, WebKit and Firefox. `runtime.orientation = "landscape"`; portrait shows M4's rotate hint.
- **One-file examples** (EX rules, `Tier: plus`): module `render3d`: `render3d-meshes.ts`, `render3d-follow-camera.ts`, `render3d-lighting-fog.ts`; module `figures`: `figures-walk.ts`, `figures-outfits-items.ts`, `figures-actions.ts`; module `rigged`: `rigged-clips.ts`; module `post`: `post-retro-chain.ts`; module `physics`: `physics-bodies-3d.ts` on `base-3d`'s room. Each 100 code lines or fewer.

### 4.8 Packaging

Unchanged from 2026-10-16 §4.7: `render-pixi3d`, `figures` (because its only renderer is private) and `base-3d` are `private: true`; the tarball is vendored only in private repositories; `ship prepare` refuses a public target whose bundle contains `@pixi/3d` (M3R-D7 says when `figures` could be published).

## 5. Data and lifecycle flows

**Boot:** as 2026-10-16 §5, with figures, rigged characters, lamps, props and the post chain arriving as compiled content; the renderer builds `View3D`, bakes static vertex light, then builds each figure's parts and loads each rigged model.

**Per fixed step:** the sim steps; `apply(result)` feeds the consumers. Characters' sim fields (position, facing, moving, speed, action) arrive in render rows.

**Per frame:** views interpolate positions; each figure evaluates its motion at the presentation time and, on a pose step, updates joint transforms (and re-skins skinned parts); each rigged character advances its clips; characters relight from the lamps in range; the camera follows and eases; the post slot runs.

**Outfit or item change** (a sim event or a render-row field): the figure rebuilds its part list once; the rigged character attaches or detaches the item at its socket.

**Action:** the sim sets `action { id, startedAt }`; the view plays it from `startedAt` in presentation time and returns to locomotion when it ends. An action the character lacks is a content error at compile time when the content names it, and a logged warning (once per id) when only the sim does.

**Lamp change, lifecycle background, context lost, dispose and restart:** as 2026-10-16 §5.

**Pipeline runs:** as 2026-10-16 §5, per path (§4.6).

## 6. Failure policy

The 2026-10-16 §6 rows for S7-Q1, S7-Q3, WebGPU fallback, malformed `.glb`/`.bin`, filter compile failure, context loss, public bundles, budgets, paid calls, agents calling `approve`, guard edits and Python stand. Removed: atlas and normal-map rows, camera-zone rows. Added:

| Case | Result |
|---|---|
| S7-Q8 fails (skinning wrong or missing on a backend) | M3.6 stops; figures (which skin on the CPU) continue; the report names the backend and the clip time |
| A rigged model has no skin, more than one skin, or no clip named in its content | `ModelInvalid { file, reason }`; boot shows the asset error panel with Try again |
| A socket names a joint the skeleton lacks | `ModelInvalid` naming the socket and the joint |
| A figure names a swatch, gait, hair style, headwear or item that no library has | Content compile error with `file:line:col` and the missing id |
| A figure's sliders give an impossible skeleton (a negative bone length) | Content compile error naming the slider; the generator never runs on it at boot |
| A figure build passes S7-Q9's build budget | A logged warning with the figure id and the time; it still renders |

## 7. UI inventory and states

| Component | States | Focus and input | Host-aware |
|---|---|---|---|
| Camera orbit buttons (two CornerControls) | shown on touch, hidden otherwise; pressed; disabled while paused | 44 px; keyboard and pad use `camera-left`/`camera-right` | Never under `hostReserved` |
| Asset error panel (existing `ErrorPanel`) | `ModelInvalid` (static, skinned, socket), context lost; Try again | Try again focused | — |
| Pipeline review (MCP elicitation, outside the game) | asked, approved, rejected, cancelled, timed out | The person answers in their MCP client | — |

## 8. Responsive behavior

As 2026-10-16 §8, with "the 3D view fills the field" for every size and the zone/billboard rows removed. Orbit updates on the same frame; reduced motion makes orbit instant and keeps gait and clips (they are the character's motion, not camera motion).

## 9. Test allocation

| Layer | Where | What it proves |
|---|---|---|
| Unit (Node) | `figures` (sliders → skeleton, FK, IK, gait, idle, turn, actions, holds, garments, libraries, content schema); `render-pixi3d` (camera, `parseGlb` static and skinned, clip selection and crossfade, socket attach, character light); `post-retro`; `pipelines` | Ported: `procedural-figure.test.ts` (31), and the 2026-10-16 list minus `look` and the atlas parts of `character-pipeline`. New: hold invariance for every fixture figure × item (exact world matrices); walk phase repeats; clip rate scales with speed; a missing clip, skin or socket throws `ModelInvalid` |
| Parity (sim) | `games/base-3d` | Golden replay hash identical in Node, Chromium, WebKit and Firefox |
| Parity (render) | GPU runner | WebGL2 and WebGPU captures of the S7 scene, each `post-retro` pass and `base-3d`'s room within M3-D5's tolerance; skinned joint matrices against the CPU reference (S7-Q8) |
| Fake-host E2E | each example and `base-3d` under `@ruken/sdk-host`, served with `compileHeaders` | Boots, nothing before ready, zero console errors and CSP violations, no `generateSpawnBurst`; `ModelInvalid` shows the panel; context loss recovers |
| Frame budget | GPU runner, PRODUCT.7's probe | p95 ≤ 33.3 ms on both phone profiles for `base-3d` and the S7 scene |
| Pipelines integration | fake Meshy and OpenAI servers on recorded fixtures | A full rigged run and a full procedural run: stages, cache skips, gates, install output; no paid call in CI |
| Owner | real phones, real paid runs | §13 |

## 10. Feedback workflow

As 2026-10-16 §10. Focused first: one `figures` Vitest file in Node, then one example's E2E in Chromium, then the GPU runner for one capture or probe.

## 11. Ruken alignment and requests

As 2026-10-16 §11 (CSP, renderer `webgl2`, build file types: `.glb`, `.bin`), and R-8, R-9 stand. No new request.

## 12. Tasks

| ID | Task | Lane | Depends on | Deliverable and acceptance |
|---|---|---|---|---|
| M3.0 | This revised spec, reviewed | integration | — | Owner review; M3R-D1 to M3R-D10 confirmed or changed |
| M3.1 | Spike S7 (revised) | render3d | M3.0 | §3; `docs/spikes/s7-pixi3d.md` and verdict; S7-a to S7-f |
| M3.2 | `pixi.js` 8.22 in core | ship, runtime | M3.1 verdict | Unchanged; V-a |
| M3.3 | `post-retro` | render3d | PRODUCT.1, PRODUCT.5 | Unchanged (2026-10-16 §4.5); PF-a to PF-c |
| M3.4 | `render-pixi3d`: renderer, meshes and props, follow camera, lighting, fog | render3d | M3.2, PRODUCT.5 | §4.1–§4.3, §4.8; examples `render3d-*`; D3-a, D3-c, D3-d, D3-f |
| M3.5 | `figures` and the figure view | figures (new) | M3.4 | §4.4; examples `figures-*`; F-a to F-e |
| M3.6 | Rigged characters | render3d | M3.4, M3.1's S7-Q8 | §4.5; example `rigged-clips`; R-a to R-d |
| M3.7 | `games/base-3d` and `physics-bodies-3d` | integration, sim | M3.3, M3.5, M3.6 | §4.7; B-a to B-c |
| M3.8 | `pipelines` platform | pipelines | M3.0, PRODUCT.5 | Unchanged; PL-a to PL-e |
| M3.9 | Character (rigged and procedural paths) and props pipelines | pipelines | M3.8, M3.5 (procedural sheet), M3.6 (rigged install) | §4.6; PL-f, PL-g, PL-h |
| M3.10 | M3 exit | integration | M3.7, M3.9 | X-a to X-c on the GPU runner; Owner gates (§13) |

**Order:** M3.1 and M3.8 first (neither needs an unmerged package; M3.8 needs PRODUCT.5). M3.3 when PRODUCT.1 and PRODUCT.5 merge. M3.2 after S7's verdict; then M3.4; M3.5 and M3.6 in parallel; M3.7; M3.9 after M3.8 and the views it installs into; M3.10 last.

**Lanes for 04:** render3d (`automata-plus/packages/{render-pixi3d,post-retro}`, `spikes/s7-pixi3d/`), **figures** (new: `automata-plus/packages/figures`), pipelines. Integration owns the base game.

## 13. Exit criteria and acceptance cases

**Success:**
- **S7-a.** The S7 scene boots under `compileHeaders`' CSP in Chromium, WebKit and Firefox with zero CSP violations and zero console errors.
- **S7-b.** The S7 report lists every `@pixi/3d` symbol AF imports and confirms `Container3D` in `RenderDeltaConsumer`.
- **S7-c.** WebGL2 and WebGPU captures on the GPU runner are non-black and within M3-D5's tolerance.
- **S7-d.** Both phone profiles hold p95 ≤ 33.3 ms for the S7 scene (or the report records the miss and the cut budgets).
- **S7-e.** Skinned joint matrices match the CPU reference within 1e-4 at five clip times on both backends.
- **S7-f.** The report gives a figure's per-frame and per-build cost on the phone profile.
- **V-a.** After the 8.22 bump, every existing golden hash, layout contract and E2E journey is unchanged.
- **PF-a, PF-b.** As 2026-10-16 §13.
- **D3-a.** Orbiting one step turns the camera 45° around the target, eased over 250 ms and instantly under reduced motion.
- **D3-c.** A `.bin` prop and the same prop as `.glb` produce identical vertex buffers.
- **D3-d.** Interpolated character positions at `alpha` 0.5 lie halfway between the last two ticks.
- **D3-e.** A lamp switched off by a sim event darkens the static meshes and the characters in its range, and only those.
- **F-a.** Two fixture figures with different sliders build skeletons whose bone lengths follow the sliders, from one generator.
- **F-b.** Holding an item changes only the holding arm's joints: every other joint's world matrix is equal (1e-9) with and without it, across walk, idle, turn and an action.
- **F-c.** The walk repeats exactly after one cycle at the gait's pose rate.
- **F-d.** Swapping an outfit rebuilds the part list once and changes no joint.
- **F-e.** A figure naming a missing library id fails content compile with its location.
- **R-a.** `walk` plays at rate 1 at `speeds.walk` and scales with speed; stopping crossfades to `idle` over `crossfadeMs`.
- **R-b.** A one-shot action plays from `startedAt` and returns to locomotion.
- **R-c.** An item at `handR` follows the hand joint through the walk.
- **B-a.** `base-3d`'s golden replay matches in Node, Chromium, WebKit and Firefox.
- **B-b.** `base-3d` boots under the fake host and under Ruken's local stack, nothing renders before ready, zero CSP violations.
- **B-c.** `physics-bodies-3d` keeps a golden hash identical in four engines.
- **PL-a to PL-c.** As 2026-10-16 §13.
- **PL-f.** A faked rigged run installs a `.glb` with one skin, the named clips and a `rigged-character` entry that `base-3d` loads.
- **PL-g.** As 2026-10-16 §13 (props).
- **PL-h.** A procedural run renders the review sheet and installs the `figure` entry, with no paid stage and no budget key.
- **X-a.** `base-3d` holds p95 ≤ 33.3 ms on both phone profiles on the GPU runner, WebGL2 and WebGPU, under Ruken's CSP.

**Failure cases that must be shown by tests:**
- **S7-g.** A page importing `@pixi/3d/extras` under the CSP records a violation; the bundle test fails when `generateSpawnBurst` is present.
- **D3-f.** A malformed `.glb` shows the `ModelInvalid` panel naming the file, and Try again reloads it.
- **R-d.** A rigged model missing a named clip, or with two skins, shows `ModelInvalid` naming the file and the clip or skin.
- **PF-c, PL-d, PL-e, X-b, X-c.** As 2026-10-16 §13 (X-c's room is `base-3d`'s).

**Gates reported separately:** implemented; locally verified; GPU-runner verified; deployed (Ruken local stack and the private dev host only); Owner accepted.

**Owner acceptance (never ticked by an agent):**
- D-1 confirmed or changed after S7.
- `base-3d` played on a real phone (one Android, one iPhone) under Ruken's local stack, with device, browser, renderer and date recorded; the procedural and rigged characters' look and motion approved from evidence.
- One rigged character through the pipeline with the Owner's approvals at G1, G3 and G6, on the Owner's keys and budget, with the audit lines recorded; one procedural character with G5 and G6.

## 14. Risks

| Risk | Mitigation |
|---|---|
| The beta's skinning is incomplete or differs between backends | S7-Q8 tests it first; figures skin on the CPU and do not depend on it; rigged characters stop alone |
| Procedural figures look like low-poly mannequins in real 3D, without the sprite painter | Stepped poses, the source's garments and faces, the palette and `post-retro`'s outline pass; the Owner judges the look at M3.10; M3R-D2 records the painter as droppable, not lost (it stays in The Last Light) |
| Phone FPS with skinning plus several figures | S7 measures two of each; cut values become content limits the guard enforces |
| Meshy's animation output varies by model | The rigged path's `install` checks clip names and a single skin; G6 is the Owner's |
| The Last Light keeps moving | Each task's plan re-reads its files at the current commit and records it |

## 15. Open decisions (recommended defaults; in effect once approved)

| ID | Question | Recommended default | Why |
|---|---|---|---|
| M3R-D1 | What does M3 deliver now? | **3D characters: procedural figures and rigged glTF characters in a 3D room, one base game.** No 2.5D anywhere in AF | The Owner's 2026-10-18 direction |
| M3R-D2 | The figure painter (sprite-cell look) | **Not extracted.** It stays in The Last Light; figures render as meshes | It is the 2.5D look; extracting it would keep 2.5D alive in another form |
| M3R-D3 | Pose stepping in 3D | **Stepped at the gait's pose rate** (default 12 per second), with an option for every frame | The hand-animated read is what the Owner approved in The Last Light; smooth is one flag away |
| M3R-D4 | Lighting moving characters | **Per character per frame (ambient plus lamps in range), as a tint**; static meshes keep the baked vertex light | Baking cannot follow a moving, deforming mesh; per-character is one small sum |
| M3R-D5 | Where `figures` lives | **Its own Plus package, renderer-free**; the 3D view in `render-pixi3d` | The data and motion are testable in Node and outlive any one renderer |
| M3R-D6 | Rigged scope in M3 | **Idle, walk (rate by speed), one-shot actions, crossfade, sockets.** No retargeting, blend trees, root motion or IK on rigged characters | What the base game needs; the rest comes from GAME-3D in M9 |
| M3R-D7 | Publishing `figures` | **Private while D-1 stands**, because its only renderer is private; revisit if D-1 changes | No public package that cannot be drawn |
| M3R-D8 | `base-25d` | **Dropped.** `base-3d` is the only M3 base and shows both character kinds | One base per dimension, and 2.5D is no longer a dimension AF ships |
| M3R-D9 | The camera | **A follow camera with 45° orbit steps** in M3; klipp and a third-person camera in M9 | M3 needs to see characters, not a full controller |
| M3R-D10 | AF 1.0's scope | **2D, with 3D characters as a private Plus extension** (1.0 no longer claims 2.5D) | Follows from M3R-D1 and D-1 |

M3-D3 (`pixi.js` 8.22), M3-D4 (WebGL2 default), M3-D5 (tolerance), M3-D6 (phone profiles), M3-D7 (Python image stages), M3-D8 (`.bin`), M3-D9 (no paid calls in CI) and M3-D12 (the guard hook) carry over unchanged. M3-D10 (which pipelines move) becomes "platform, character (rigged and procedural) and props". M3-D11 (`base-3d`'s static mesh character) is replaced by M3R-D6 and M3R-D8.

## 16. Effects elsewhere

- **D-1** (`render-pixi3d` unpublished): unchanged, and now also covers `figures` (M3R-D7). The 3D work it gates is larger (all of M3), so S7's verdict matters more: a D-1 change opens all of M3 to public builds at once.
- **M9 (3D merge):** it planned the rigged character and animation pipeline. M3 now delivers rigged characters and the rigged pipeline path, so M9's selection becomes: a full third-person camera and controller (klipp), brush-based environments, and whatever GAME-3D proves on top of M3's characters (retargeting, blend trees, root motion, physics-driven motion). The M9.0 row in 02 is updated to say so.
- **M6:** its 2.5D-dependent parts need a look when M6's tasks are planned: sector-derived occlusion (2026-10-16 §4.4 said "arrives with `sectors` in M6") now feeds M3.4's static vertex light; cutscene cameras orbit a 3D figure instead of choosing a billboard row. No M6 row changes in this PR; the M6 plans re-read this spec.
- **M8:** "AF finished for 2D and 2.5D" becomes "2D, with 3D characters in Plus" (M3R-D10). The Last Light slice (puzzle and sectors on Plus) is sim-side and unaffected.
- **01, 00 and AGENTS.md:** their M3 rows and "2D and 2.5D" wording point to this spec.
