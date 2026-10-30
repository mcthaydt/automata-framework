# M3: 3D characters, procedural with an IK rig (milestone spec, revised three times)

- **Status:** Drafted 2026-10-18; **revised 2026-10-23** for the Owner's direction below (rigged glTF characters deferred "for now", an IK rig with authored poses and clips, an angled 24 mm camera, the action-adventure the characters are for), and **a third time** the same day (14:18 to 14:21 UTC) for the camera's 25° tilt, 5 m distance and free rotation, the action-adventure as the base 3D game, 3D in AF 1.0 and the look. **Owner-approved 2026-10-23:** "spec is fine" (15:45:48 UTC) and "Spec #140 is approved" (16:05:51 UTC), the last two rows of the table below; the agent defaults stand as accepted. It replaces the 2.5D scope of the [2026-10-16 M3 spec](./2026-10-16-m3-25d-pipelines-design.md) (approved 2026-10-16), whose amendment at the top says what is dropped and what carries over. Task **M3.0** (revised) in [02 Master delivery plan](../../02-master-delivery-plan.md). Nothing here was implemented before that review (01 Decomposition §5, [04 How we build](../../04-how-we-build.md)), except spike S7 (M3.1), which is exempt from TDD (A0+A1 spec §2). Decisions M3R-D1 to M3R-D20 (§15) carry recommended defaults; the Owner approved the agent defaults with the spec. In §15 a row's **Owner's words** part restates what the Owner said and is in effect; its **agent default** part is a reading of those words and waits for review like any other default. The Owner answered the camera (M3R-D9, D11), the look (M3R-D17), AF 1.0's scope (M3R-D10) and, at 14:49 UTC, the `@pixi/3d` beta (M3R-D18: "we launch when pixi 3D goes public"). No question is open.
  > **Amendment, 2026-10-30 (the Owner, in the session's chat; 02 row M3.0A edited the sections the same day: §0, §1's exclusions, §2.2, §4.2, §4.4.1, §4.4.4, §4.6, §12 and §13's F-g):** FigureBuilder (`mcthaydt/FigureBuilder` `a1f7246`, 2026-10-28), the Owner's enhanced procedural character builder ("we also enhanced our proc characters, and created a new repo for that"), is the figure source: M3.5, M3.6's reference clips (F-g) and the Studio (EDS.9) extract from it, and The Last Light (`92e6704`) keeps the rig, hold and library tests and every render, camera, light and fog source. The look stays this spec's reading: figures are 3D meshes on Endesga 64 built from FigureBuilder's body generator, garments, hair and motion, and its painter and DUEL swatches stay in FigureBuilder. The same day: `games/base-3d` uses core only, like Emberwick, so it does not install `post-retro` (02 row M3.7c), and `@pixi/3d` 0.1.0-beta.2 is vendored in `vendor/pixi-3d` (PR #188).
  > **Owner decision, 2026-10-30 (about 05:45 UTC, in the session chat, relayed by the coordinator): S7-Q1, "AF-owned shim".** Spike S7 part 1 (PR #200) found that `@pixi/3d` 0.1.0-beta.2 does not draw under `pixi.js/unsafe-eval`: its four uniform parsers have no counterpart in pixi's no-eval polyfills. `render-pixi3d` therefore ships an AF-owned `render-pixi3d/no-eval` entry with a shim that adds the four functions; a test pins pixi's uniform-parser count and order so a pixi or beta update that moves them fails loudly; the bug goes to the Pixi 3D beta, and the shim is removed when a fixed release lands (re-checked at M9.10). `allow_eval` is never used. M3.4 onward proceeds.
- **Depends on:** M2 (merged). The 3D runtime packages are free and live in this repository (M3R-D20), so M3.4 to M3.6 do not wait on PRODUCT.5 (amended 2026-10-30, M3.0A); `post-retro` and `pipelines` stay Plus and wait on PRODUCT.5 (the core and Plus split), so each lands where it stays. PRODUCT.1's post-filter slot before `post-retro`. Not on M4 or M5, except that the base game uses M4's input when it lands.

## Owner direction

| When (UTC) | Where | The Owner's words | What it did here |
|---|---|---|---|
| 2026-10-18 | The Desk's relay | "drop 2.5D; M3 becomes procedural-character 3D plus rigged-character 3D." | 2.5D dropped. The "rigged" half is superseded by the next row. |
| 2026-10-23 08:45:45 | Project thread, message `cmsg_01VQPgZzjNxjPkiB5eeQRiaYBZMPTigDhn8zdJ52vrPKZ9` | "Cut the rigged gltf, procedural only for now, make the character action adventure like ocarina of time switch 2 remake, but use an angle like crow country for the 3D" | Rigged glTF characters are out "for now" (the Owner's words): deferred, not removed from AF for good (M3R-D1). Agent readings, approved with the spec (last two rows): the skinned-mesh work and the rigged pipeline path leave M3 with them (M3R-D6, D8); the game is an Ocarina-style action-adventure with lock-on, dungeons, items and puzzles (§17); the camera follows the player at Crow Country's angle (M3R-D9; the 14:18 answer below set 25°, 5 m and free rotation); "switch 2 remake" is read as game design (the 14:21 answer below set the look, M3R-D17). |
| 2026-10-23 08:46:27 | Project chat, passed on by the coordinator, message `cmsg_01VQPgZzjNxjPkiB5eeQRiaY7dESwAMgKa1wKZ815qSyW1` | "Character editor is glorious, but let's add like IK rig so we can manually pose, I think that's also necessary for animation which we may have missed?" | New: an IK rig, authored poses and keyframed clips for procedural figures (§4.4.2 to §4.4.6, task M3.6; the rig's scope, M3R-D6, D12, D13 and D16, is the agent's reading). The Owner's "missed" is right (§2.3). |
| 2026-10-23 08:48:00 | Project thread, message `cmsg_01VQPgZzjNxjPkiB5eeQRiaYDbjPknERexJTta3asGxbSo` | "Go with 24mm focal length for camera" | The camera's lens is 24 mm (§4.2, M3R-D9). |
| 2026-10-23 14:18:10 | Project thread, message `cmsg_01VQPgZzjNxjPkiB5eeQRiaY1PhQtT3Lotbmj65W9qBGAE` | "25deg tilt, 5m distance is great, we can cut the 45 degree snap for rotation, I think per pixel rotation works well since it's fully 3D now; when I said Zelda, I meant that's our base 3D game like our 2D platformer game - I want to do everything we did for 2D but for 3D with procedural character" | The camera is 25° down and 5 m back; the 45° snap is cut and the player turns it freely, per pixel (§4.2, M3R-D9, D11). The Ocarina-style action-adventure is the base 3D game, the counterpart of the 2D platformer `games/emberwick` (§17, M3R-D8). Everything done for 2D is done for 3D with procedural characters; the agent's reading of "everything" is §18 (M3R-D19). |
| 2026-10-23 14:18:50 | Project thread, message `cmsg_01VQPgZzjNxjPkiB5eeQRiaYCNocwJDWptR12JgNWvEw7r` | "3D ships 1.0" | AF 1.0 includes 3D, in the free release and not in Plus (M3R-D10; the project coordinator, who asked "1.0 or Plus?", read the answer this way at 14:37 UTC): the AF 1.0 launch (the core release, M8.9) waits for the base 3D game. The 14:49 row below says when. |
| 2026-10-23 14:21:02 | Project thread, message `cmsg_01VQPgZzjNxjPkiB5eeQRiaYHxLGHofnm63UnPZxYztK4h` | "Visually it should match the 2D game too in terms of quality, use the editors" | The look is AF's one look ([art direction](../../art/README.md): Endesga 64, `post-retro`) held to Emberwick's quality, not a modern remake look; the game's content is authored in the editor suite (M3R-D17, §17). |
| 2026-10-23 14:49:20 | Project thread, message `cmsg_01VQPgZzjNxjPkiB5eeQRiaYSzMSKQqyAtghxb8W3oGgvp` | "I forgot, we launch when pixi 3D goes public" | `@pixi/3d` (Pixi 3D) is a closed beta that forbids public deployment. We build on the beta now, builds stay private, and the AF 1.0 launch waits for Pixi 3D's public release (M3R-D18 answered; D-1 lifts then). |
| 2026-10-23 15:45:48 | Orchestrator project, the Owner's own message, relayed by the hub's answer `automata/inbox/2026-10-23-1547-hub-owner-approves-140-and-web10.md` in `mcthaydt/orchestrator-bus` | "Website #10 is fine, spec is fine" (the spec half is this one) | The Owner reviewed this spec (M3.0R). The 16:05:51 row confirms it in this project. |
| 2026-10-23 16:05:51 | Project thread, passed on by the coordinator, message `cmsg_01VQPgZzjNxjPkiB5eeQRiaYKgmDAB5qamn8UTuwxn9VAn` | "Spec #140 is approved (my 15:45 words in Orchestrator: spec is fine). Record it in the spec and merge it when green; website #10 is approved too." | The spec is approved as written: the Owner's words, and the agent defaults M3R-D19 (the 3D parity table, §18), M3R-D20 (the free 3D runtime packages and their home), the camera ranges (tilt 15° to 60°, distance 3 m to 12 m) and the turn speed (0.25° a pixel). No decision changed. The approval is recorded here; the merge thread merges #140 when green. M3 tasks still wait on PRODUCT.5, as before. |

Earlier direction still in force: 2026-10-11 (2D, then 3D; Ruken first; PixiJS for 2D and 3D); 2026-10-16 PD-1 (every extension is Automata Plus; amended for the 3D runtime packages by M3R-D20) and PD-3 (`post-retro`'s 2D part runs on the FloorFifty path); 2026-10-17 (the 3D camera uses pmndrs/klipp, evaluated and pinned in M9.0; §16 says how it meets the angled follow camera). **Answered 2026-10-23, 14:18 to 14:21 UTC:** AF 1.0 includes 3D (M3R-D10); the camera's tilt, distance and rotation (M3R-D9, D11); the look (M3R-D17). **Answered 14:49 UTC:** how 3D ships publicly while `@pixi/3d` is a closed beta: the AF 1.0 launch waits for Pixi 3D's public release (M3R-D18). **Approved 15:45:48 and 16:05:51 UTC:** the spec as a whole, agent defaults included (last two rows).

## 0. Sources

| Source | Revision | Used for |
|---|---|---|
| AF `main` | `5a02ea8` | What exists (§2). |
| The 2026-10-16 M3 spec | as merged | Every section this spec keeps by reference (§2, §4.5, §4.7, §4.8's platform, §11) |
| FigureBuilder, `mcthaydt/FigureBuilder` | `a1f7246` (2026-10-28; shallow clone, read 2026-10-30) | **The figure source** (amended 2026-10-30, M3.0A): `src/render/figure/` (`math.ts` 87 lines, `rig.ts` 151, `genes.ts` 109, `parts.ts` 330, `garments.ts` 567, `hair.ts` 632, `streetwear.ts` 1,476, `motion.ts` 600, `cast.ts` 401, `figure.ts` 494, `library/*.json`), its tests `tests/form.test.ts` and `tests/random.test.ts`, and the reference end poses of `reach`, `look` and `flinch` (`motion.ts`, F-g). Not extracted: §4.4.1 |
| The Last Light, `mcthaydt/PixiJS3D_Experiment_001` | `92e6704` (shallow clone, read 2026-10-23); the first revision read `bbd7a65` | The rig, hold and library tests of `tests/procedural-figure.test.ts` (ported onto FigureBuilder's code, M3.5a and M3.5c); every render, camera, light, fog and GLB source; the procedural figure (`src/render/figure/`) as FigureBuilder's ancestor, no longer extracted (amended 2026-10-30); its proposal (`docs/superpowers/proposals/2026-10-16-procedural-figures/`; PR #114), the Studio editor (`editor/src/client/studio.ts`, `studio-model.ts`), the `fovOf` lens convention (`src/game/cutscenes.ts:17`, `src/direction/shots.ts:29`), and the pipeline's locked `lensMm` and `tiltDeg` (`pipeline.config.json`: 50 and 30 for its 2.5D camera) |
| `@pixi/3d` 0.1.0-beta.2 | the tarball The Last Light vendors | Meshes, lights, fog and the camera, read from the file list, not run. Skins and animation are no longer used (§3, S7-Q5) |

**Not verified here:** `@pixi/3d`'s camera taking a vertical field of view in degrees (S7-Q5 checks it); the angled camera under Ruken's CSP and on phones (S7 measures both); the beta's terms beyond The Last Light's README (unchanged from the 2026-10-16 spec); that the figure's source files at `a1f7246` stay put (each task's plan re-reads them at the commit it extracts and records it).

## 1. Goal and boundaries

**Goal.** A game on AF can put characters in a 3D room, move them, pose them and animate them: **procedural characters** built from data (sliders, a shared skeleton, garments, hair, headwear and held items), a **procedural gait**, and an **IK rig** with authored poses and keyframed clips, all drawn as real 3D meshes by `render-pixi3d` on WebGL2 (WebGPU when opted in), under Ruken's CSP, at 30 FPS or better on the phone profiles, in a private build while D-1 stands, seen through an **angled three-quarter follow camera on a 24 mm lens, 25° down and 5 m back, that the player turns freely**. A character's look and motion are presentation: the sim says where it is, where it faces, whether it moves, which clip plays, what it aims at, and never reads a joint.

**What this is for.** The characters and the camera are shaped by the base 3D game, `games/base-3d`, the counterpart of the 2D platformer `games/emberwick`: a third-person action-adventure in the spirit of Ocarina of Time, with lock-on combat, dungeons, items and puzzles (§17). It ships in AF 1.0 (M3R-D10). M3 does not build the whole game. It builds the character, rig and camera pieces that game needs and proves them in the game's first slice (M3.7); GAME-3D then grows that slice (02, §18).

**What changed from the first revision (2026-10-18).**

| Was | Now |
|---|---|
| Rigged glTF characters with named clips, crossfade, sockets (`rigged` view, §4.5) | **Deferred** (Owner: "procedural only for now"). Procedural figures only in M3 and GAME-3D. No skinned glTF and no glTF animation until the Owner reopens it (M3R-D1, D6) |
| Meshy `model`, `rig`, `animate` stages in the character pipeline | **Not in M3** (they serve the deferred rigged path). The character pipeline is the free procedural path; paid stages stay only in the props pipeline |
| Motion = the figure's gait plus eleven actions written in code | Gait stays code. Everything else is **data**: an IK rig, authored poses (`figure-pose`) and keyframed clips (`figure-clip`) |
| A follow camera with 45° orbit steps | An **angled follow camera on a 24 mm lens**, 25° down and 5 m back (Owner); the player turns it freely, per pixel, with no steps; views may set bounds, lag and a heading (M3R-D9, D11, §4.2) |
| S7-Q8 (skinning on both backends) | Gone with the skins. S7-Q8 now measures the rig solve; S7-Q10 checks the angled view reads on phones |
| One base game with a procedural and a rigged character | `games/base-3d`: procedural figures only. M3.7 builds its first slice (two rooms with their own views, free camera rotation, a lock-on aim demo); GAME-3D grows it into the action-adventure, the 3D counterpart of Emberwick (M3R-D8) |

**Free, in AF 1.0 and in this repository (M3R-D10, M3R-D20; PD-1 is amended for these packages only):**
1. `render-pixi3d`: the 3D renderer on `@pixi/3d`: static meshes, props, lights, fog, the angled camera and the figure view. Built on the `@pixi/3d` beta and unpublished while D-1 stands; the AF 1.0 launch waits for Pixi 3D's public release, which lifts D-1 (M3R-D18).
2. `figures`: procedural characters, the IK rig, poses and clips. The data model, solvers and motion are renderer-free TypeScript; their 3D view lives in `render-pixi3d`.
3. **Stays Plus:** `post-retro`, unchanged (2026-10-16 spec §4.5), on the FloorFifty path first.
4. **Stays Plus:** `pipelines`, the platform (unchanged), the character pipeline (procedural only) and the props pipeline (unchanged); `physics-bodies-3d` too (PD-2).
5. The base 3D game, `games/base-3d` (§17), and one-file examples per feature.

**Core (free):** only the `pixi.js` 8.22 bump (M3.2), as before. No other core change; a missing public seam becomes a change request to its owning lane.

**Exclusions:**
- Rigged or skinned glTF characters and glTF animation clips: **deferred by the Owner** on 2026-10-23 ("procedural only for now"). They are out of M3 and GAME-3D until the Owner reopens them; §14 keeps the seam a later skinned view would use. Static GLB props stay.
- Blend trees, animation state machines, retargeting between skeletons, root motion, facial animation and lip sync, cloth simulation: **not in M3**. This is the agent's scope call (M3R-D6), approved with the spec, not the Owner's cut. A short pose-space transition between action clips is in (M3R-D16, §4.4.5).
- The third-person controller, lock-on targeting, combat, items, ground-contact IK on stairs and slopes and brush-based environments: built by GAME-3D in `games/base-3d` and promoted into packages by M9, both before 1.0 (physics-driven character motion and ragdolls are not planned). M3 provides the camera views, the rig's pin and aim API and a small lock-on demo; GAME-3D proves the rest (§17).
- The figure painter (FigureBuilder's and The Last Light's CPU raster to a sprite cell: `raster.ts`, `paint.ts`, `ramp-light.ts`, the DUEL ramps, sprite light and light step): it is the 2.5D look and is dropped with it (M3R-D2; amended 2026-10-30).
- The character editor's interface (the Studio): it is the editor suite's work, not M3's (§4.4.6 says what it needs from `figures`).
- Sector maps, nav, puzzles, narrative, cutscenes and the environment pipeline: M6 (see §16).

## 2. What already exists

### 2.1 In AF

As the 2026-10-16 spec §2, re-checked at `5a02ea8` for the rows M3 still uses: `GameRenderer` and `RendererFactory` (`packages/runtime/src/render/renderer.ts`), `createPixiRenderer` and its `setup(stage)` (`packages/render-pixi/src/renderer.ts`), `RenderDeltaConsumer` and `EntityView` (`packages/render-pixi/src/delta/`), `filterPrograms`, `render-pixi/no-eval`, `defineExtension`, the 3D physics components (`packages/physics/src/physics-3d*.ts`), the `pixi.js` 8.21.0 pin, and the release list refusing `render-pixi3d`. Not in AF anywhere: any 3D rendering, a figure model, an IK solver.

### 2.2 In FigureBuilder's figure (read at `a1f7246`; amended 2026-10-30)

FigureBuilder is The Last Light's figure, extracted for Brawl Studio and grown on its own (its README). What follows was first read in The Last Light at `92e6704` and re-read in FigureBuilder at `a1f7246`, where it differs as noted.

- **Skeleton** (`rig.ts`): **27 joints**. Twenty body joints (`root`, `pelvis`, `spine`, `chest`, `neck`, `head`, a clavicle, upper arm, forearm and hand per side, a thigh, shin and foot per side), a `socket` per hand, three hair pivots driven by a spring, and **two hem pivots**, `hemL` and `hemR` (parented to the shins; `placeHems` puts each between its ankle and the plumb under its hip, so a wide trouser leg's hem hangs from it). The hems are secondary pivots, never effectors or pole targets (§4.4.2). The figure faces +z, y is up, its own left is +x.
- **Pose and FK:** `Pose { root, yaw, rot[], shift[] }` (a local rotation and a translation shift per joint) and `fk()`.
- **IK:** one solver, `twoBoneIK(skeleton, pose, world, a, b, c, target, pole, bend, end?)`: analytic law-of-cosines on a two-bone chain, bending toward a pole direction, with an optional end orientation. It drives both legs (foot paths) and the arms (an action's hand target, a held item's grip).
- **Motion** (`motion.ts`): `base()` layers pelvis and torso, head, arms (swing), legs (foot paths into IK) and then **actions as hard-coded branches**: The Last Light has eleven (`reach`, `look`, `flinch`, `thrust`, `cup`, `recoil`, `read`, `sit`, `sleep`, `radio`, `push`), FigureBuilder keeps three (`ActionId = 'reach' | 'look' | 'flinch'`). Then `applyHold()` rewrites only the holding arm. FigureBuilder adds **stands** (`Stand` in `motion.ts`, the library `library/poses.json`: `handOnHip`, `thumbsInPockets` and others, with hand places on the outfit's openings and fallbacks), `placeHems`, and the head's structure (`HeadShape`, `sliders.face`). Walk and idle cycles are `Gait` numbers in `library/gaits.json`. Poses step at `poseRate` (12 or 8 a second).
- **Scale:** every authored offset is multiplied by `k = height / 1.62`, so one pose works on any proportions.
- **Studio** (`editor/src/client/studio.ts`): sliders, outfits, a turnaround rendered by the game, a test stage. Its "Poses" tab is the 2.5D atlas pose requests (a paid pipeline request form), not a posing tool.

### 2.3 What was missed (the Owner's question)

The Owner asked whether animation was missed. It was: the first revision of this spec extracted the figure's code as it is. That gives AF **one** solver and **eleven poses that are code**. A third-person action-adventure needs dozens of moves (slashes, a raised shield, a drawn bow, a roll, a push, a pickup) and the person making the game must author them, in the character editor, by dragging hands and feet. Nothing in the source can do that: there is no effector data, no pole control, no spine or head IK (the head turns by an angle, `headYaw`), no keyframes, no clip, no layer mask, no way to aim at a point, no way to pin a foot. §4.4.2 to §4.4.6 add them as data and pure functions, reusing `twoBoneIK` and the layer order the source already proves.

## 3. Spike S7, revised (M3.1)

S7 keeps the 2026-10-16 questions S7-Q2 (WebGL2/WebGPU parity), S7-Q4 (non-black capture), S7-Q6 (`pixi.js` 8.22) and S7-Q7 (bytes). It changes the scene, drops the skinning question and adds four:

| ID | Question | Pass |
|---|---|---|
| S7-Q1 | Does a `View3D` scene (a box room seen through the angled camera, 24 mm, tilt 25°, 5 m; six procedural figures, one of them playing a rig clip and aiming at another; one static GLB prop; linear fog) boot under Ruken's CSP after `render-pixi/no-eval`? | Renders; zero `securitypolicyviolation` events and zero console errors in Chromium, WebKit and Firefox |
| S7-Q3 | Phone profiles: does that scene hold 30 FPS with the six figures walking and two of them playing clips? | p95 frame time ≤ 33.3 ms over 20 s after a 3 s warm-up on both phone profiles (M3-D6, unchanged), measured with PRODUCT.7's probe on the GPU runner; SwiftShader rejected |
| S7-Q5 | Which beta APIs does AF depend on, and do they fit AF's seams? | The written symbol list (meshes, materials, lights, fog, `Camera3D`; never `./extras`, no glTF skin or animation path); `Container3D` accepted where `RenderDeltaConsumer` takes a `Container`; `View3D` mountable in `setup`; the camera's field of view is a vertical angle in degrees that equals `fovOf(24)` = 53.13° |
| S7-Q8 (new meaning) | What does a figure's rig solve cost? | Four limb solves, the spine and head aim and the pins, per figure: ≤ 0.1 ms per solve on the phone profile; reported per pose step and per frame (pins and aim only), with the source's allocating `twoBoneIK` first and typed-array buffers only if it misses |
| S7-Q9 | What does a procedural figure cost per frame as meshes? | Joint update plus mesh transforms per figure per frame, and the one-off build per outfit change, in ms on the phone profile; target ≤ 0.3 ms a frame per figure, ≤ 20 ms a build |
| S7-Q10 (new) | Does the angled 24 mm view read on phones at the default view (25°, 5 m)? | A 1.62 m figure is ≥ 25% of the frame's height (§4.2 expects about 29%), which is ≥ 97 px on 844×390 and ≥ 67 px on 780×270; the horizon sits 1.6° inside the top edge, so fog or a wall closes every view's far side and no authored view shows the void; depth precision holds (no z-fighting on the room's floor and walls at near 0.3, far 120); the edge stretch at 21:9 is recorded; the captures are attached for the Owner's look, which decides whether the compact case is legible enough |
| S7-Q11 (new) | What are the beta's version and terms, as the baseline for the launch gate? (M3R-D18) | The vendored licence, the version pinned and The Last Light's README, as written. It records facts only: the Owner has decided that we build on the beta and the launch waits for Pixi 3D's public release. The S7-Q5 symbol list stays as the §4.1 seam |

Outputs as before: `spikes/s7-pixi3d/` (removed when the verdict is recorded), `docs/spikes/s7-pixi3d.md` with numbers, browser, runner and commit, and a verdict row. A failed S7-Q1 or S7-Q3 stops M3.4 onward and goes to the Owner with the evidence. M3.4 builds on `@pixi/3d` (M3R-D18); S7-Q11 only records the beta's terms. A failed S7-Q8 sets a smaller rig scope (fewer solved effectors per figure); it does not stop the milestone.

## 4. Contracts

### 4.1 `render-pixi3d` (`packages/render-pixi3d`, M3.4)

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
- `parseGlb` and `parsePack` from The Last Light keep the static path only. A `.glb` with a skin is `ModelInvalid` (§6): skinned glTF is not supported yet (deferred, M3R-D1).
- **The package seam (M3R-D18).** The contract names `View3D` and `Container3D` from `@pixi/3d`. If Pixi 3D's public release never comes, or its terms still forbid public deployment, the Owner decides again, and a replacement layer would be a new task: those two names would become AF's own types with the same shape, S7-Q5's symbol list is the surface, and nothing else in the spec changes.

### 4.2 The angled camera (`render-pixi3d` `camera/`, M3.4)

The Owner's words: "use an angle like crow country"; "Go with 24mm focal length for camera"; "25deg tilt, 5m distance is great, we can cut the 45 degree snap for rotation, I think per pixel rotation works well since it's fully 3D now" (the direction table). So the camera follows the player on a **24 mm lens, 25° down and 5 m back**, and the player **turns it freely, per pixel**. Crow Country's camera follows the player and "can be rotated at will" (Nintendo Life's review). The contract below is the agent's design of those words; nothing in it is pending.

```ts
// content (schema `camera-view`), compiled and hashed like all content
export interface CameraView {
  readonly id: string
  readonly yawDeg?: number               // the heading the camera eases to when the view is entered (0 looks toward +z); omitted keeps the player's heading
  readonly tiltDeg: number               // downward angle; 25 by default (Owner), authored within 15 to 60 (M3R-D11)
  readonly distance: number              // metres from the focus point back along the view axis; 5 by default (Owner), 3 to 12
  readonly focusHeight: number           // metres above the followed position the focus sits; 1.0 by default
  readonly bounds?: Box3                 // the focus point is clamped inside this box, so walls and doorways stay framed
  readonly lag?: number                  // seconds of easing on the follow; 0.18 by default
  readonly rotate?: boolean              // whether the player may turn the camera in this view; true by default (false: an arena framed one way)
}
export interface CameraRig {
  readonly lensMm: number                // 24 (Owner, 2026-10-23); the guard holds it (§6)
  setViews(views: readonly CameraView[]): void
  activate(id: string, how: 'cut' | 'ease'): void    // 'ease' is 400 ms, a 'cut' under reduced motion
  heading(yawDeg: number, how?: 'track' | 'ease'): void // the sim's heading; 'track' (the default) follows it exactly, 'ease' takes 250 ms (a view entry that sets a yaw)
  follow(x: number, y: number, z: number): void       // the followed view's interpolated position
  frame(lock?: { x: number; y: number; z: number }): void // lock-on: bias the focus toward the target, clamped by bounds
  update(frameSeconds: number): void
}
export const fovOf: (lensMm: number) => number        // 2 * atan(12 / mm), degrees: the vertical field of view
export function angledCamera(options: { readonly views: readonly CameraView[]; readonly initial: string }): CameraRig
```

- **One owner for `camera-view` (amended 2026-10-30, M3.0A).** The `camera-view` zod schema (with its defaults, 25° and 5 m, and its range errors), `fovOf` and the heading math live in `render-pixi3d`'s pure entry, which imports no Pixi and no `@pixi/3d`. The 3D level editor's copy (`packages/editor-3d/src/view/mesh/follow-camera.ts` and `heading.ts`, ED3D.4c) moves to consuming that entry in M3.4b, so there is one definition.

- **The lens.** `fovOf` is The Last Light's convention (`2 * atan(12 / mm)`: a 24 mm tall film gate). At **24 mm** the vertical field of view is **53.13°** and the visible height at distance *d* is exactly *d*. The horizontal field follows the aspect ratio: 67.4° at 4:3, 83.3° at 16:9, 94.6° at 19.5:9, 98.8° at 21:9. A wide lens close to the action gives the framing the Owner pointed at and makes the room's depth read; it also stretches objects near the frame's edge, which is why the focus follows the player and keeps them near the middle, and S7-Q10 looks at it.
- **The default view** (the Owner's tilt and distance). Tilt 25°, distance 5 m, focus height 1.0 m. The camera then sits 2.11 m above the focus and 4.53 m behind it, 3.1 m above the floor. A 1.62 m figure at the focus fills about 29% of the frame's height (1.62 × cos 25° = 1.47 m of the 5 m visible; S7-Q10 measures it and the reference board reads it live), and the frame shows 8.9 m across at 16:9 (6.7 m at 4:3, 10.8 m at 19.5:9). At 25° the horizon sits 1.6° inside the frame's top edge, so every authored room closes its far side with a wall or fog and no view shows the void. The Last Light's 2.5D camera was 50 mm at 30° and stays in the old spec. AF's `pipeline.toml` `[locked]` holds **only the lens**, `lensMm = 24` (the guard of 2026-10-16 §4.8), changed only by a recorded decision; this spec's direction table is the record. Tilt and distance are authored per view and the guard checks them by range (15° to 60°, 3 to 12 m), not by a locked value (M3R-D11).
- **A follow camera, views for the rooms.** The camera always follows the player's position with eased lag inside the active view's bounds. A view is a tilt, a distance, a focus height, bounds, a lag and, optionally, a heading. A game that wants one global angle has one view; a level can give a room, a corridor or a boss arena its own. The 2.5D camera zones, octants and hysteresis stay dropped.
- **The player turns the camera freely, per pixel.** There are no steps and no rotate buttons. The input layer (outside the sim) turns a gesture into **turn units**, 65 536 to a full turn. Touch: a one-finger horizontal drag that starts outside the stick and the buttons (an M4 gesture entry, `camera-drag`, as data). Mouse: a drag with the secondary button. Gamepad: the right stick, up to 180° a second. Keyboard: `camera-left` and `camera-right` held, 120° a second. A drag is worth `degPerPixel` per pixel, 0.25° by default (a 1,440 px sweep is one full turn), set by a player setting, "Camera turn speed", with an "Invert camera" toggle; GAME-3D adds both through core's settings schema (PRODUCT.1), no core change. The layer sends a command `camera-turn { units }` with an **integer** (at most ±8,192 a tick, 45°), so the replay stores integers only. While the player drags, the picture tracks the heading one to one: nothing eases between the finger and the camera. A view with `rotate: false` ignores the command.
- **The heading is sim state.** Stick input maps to a world direction through the heading (a stick pushed up moves the character away from the camera). That mapping affects gameplay, so the sim owns it: the player carries a `view` id (set by the room or sector the player is in, or by a view volume) and a `heading` (an integer in turn units, wrapping at 65 536). The mapper reads those, never the eased camera, and turns the heading into a direction with `sin` and `cos` from `@mcthaydt/automata-sim/math` (the parity-tested `dmath`; the sim may not call `Math.sin` or `Math.cos`, `pnpm boundaries`). Entering a view that sets `yawDeg` sets `heading` to it in the same tick, and the renderer eases to it over 250 ms (`heading(yaw, 'ease')`). The renderer reads `view` and `heading` from the render rows and calls `activate` and `heading`. On a **view** change the mapping **latches** to the old heading until the stick is released or turns by more than 90° (the classic fixed-camera rule, M3R-D15), so crossing a doorway does not reverse the character mid-stride. The player's own turn does not latch: they asked for the new heading. The heading is in the golden replay, so B-a covers it in four engines; D3-i pins the mapper.
- **Occluders: walls and ceilings never hide the player.** A camera 25° down and 5 m back sits 3.1 m high and 4.5 m behind the player, usually outside the room or inside a wall, so the near walls and the ceiling would cover the action. Each frame, for the current heading: (1) a room wall whose inside face points away from the camera (the camera is on its outer side) is cut away, drawn only as a floor-level trim so the room's outline still reads, as the reference board's camera lab does; the change between wall and trim is a 150 ms fade with 5° of hysteresis on the facing test, so a wall does not flicker while the player turns the camera; (2) ceilings and overhead beams are not drawn in an angled view; (3) any other static mesh tagged `occlude: 'fade'` whose bounds cross the segment from the camera to the player's head or feet fades to 25% opacity over 150 ms (instant under reduced motion) and back when clear. The content shape is an `occlude?: 'cut' | 'fade' | 'never'` field on a static mesh or sector wall (`'cut'` by default for walls, `'never'` for floors, `'fade'` by default for props taller than 1.5 m). Presentation only; the sim never reads it. D3-h proves it.
- **Lock-on framing.** `frame(lock)` moves the focus up to 35% of the way toward the lock target, never past the view's bounds and never so far that the player leaves the middle third of the frame. Presentation only.
- **Presentation only** apart from the view id and the heading: the rig reads interpolated positions and the sim's heading and writes only the `View3D` camera (law 1). The 3D level editor's walk camera (ED3D-D8, 69°) is a different camera and unrelated.

### 4.3 Lighting and fog (M3.4)

- `SceneLighting { lamps: Lamp[]; ambient: number }` from content.
- **Static meshes:** vertex light baked once per mesh at load, with box/plane occlusion (The Last Light `render/indirect-light.ts`, `render/occlusion.ts`), as 2026-10-16 §4.4. A lamp change (a sim event) rebakes the meshes in range.
- **Moving characters** (figures): lit per character, not per vertex bake, because they move and deform. Each frame a character takes ambient plus the N·L of each lamp in range at its position, as a material tint on `@pixi/3d`'s lit material (M3R-D4); S7-Q9 measures it.
- Fog: `View3D`'s linear fog; the particle mist from the 2026-10-16 spec is kept only if S7 measures it within budget, else dropped (it was a 2.5D set piece).

### 4.4 `figures`: procedural characters, the IK rig, poses and clips (`packages/figures`, M3.5 and M3.6)

`figures` is renderer-free: it imports nothing from Pixi, so its unit tests run in Node and a future renderer can draw the same figures. It is The Last Light's procedural figure made game-agnostic, minus its sprite painter, plus the rig layer of §4.4.2 to §4.4.6.

#### 4.4.1 Definition, skeleton and library (M3.5)

```ts
// content (schema `figure`), compiled and hashed like all content
export interface FigureDef {
  readonly id: string
  readonly sliders: Partial<Sliders>                 // frame, height, muscle, fat, shoulders, hips, legs, arms, head, neck,
                                                     // neckLength, hands, feet, posture, age, headTilt, chunk, faceForward, hunch,
                                                     // and face: Partial<HeadShape> (FigureBuilder's head structure; amended 2026-10-30)
  readonly genes?: Partial<GeneOverrides>
  readonly skin: string                              // a swatch id; swatches name colours of the game's palette (Endesga 64 by default)
  readonly gait: string                              // a gait id, or inline
  readonly hand: 'L' | 'R'
  readonly outfits: Readonly<Record<string, readonly Garment[]>>
  readonly default: string
  readonly hair?: HairDynamics
  readonly hairPieces?: readonly string[]            // hair style ids from the hair library (FigureBuilder's hair pieces; amended 2026-10-30)
  readonly stand?: string                            // a stands-library id for idle (FigureBuilder's stands); `relaxed` if omitted
  readonly rig?: string                              // a rig-limits id (§4.4.2); the shared default if omitted
}
export function skeleton(def: FigureDef): Skeleton               // 27 joints: 20 body, a socket per hand, 3 hair pivots, 2 hem pivots
export function build(def: FigureDef, skeleton: Skeleton, outfit: string, item: string | null): Built // part meshes
export const figuresExtension: ExtensionDef<'figures'>
```

- Libraries are content too: swatches, gaits, hair styles, headwear, items, **stands** and rig limits (FigureBuilder `library/*.json`, its stands from `poses.json`, plus `rig.json`). **No character in code** (The Last Light iteration 33): a figure names them or writes its own inline.
- **Materials name palette colours** (amended 2026-10-30, the Owner's decision 6). A swatch is a colour of the game's palette content (Endesga 64 by default) plus the few material fields a mesh needs; FigureBuilder's DUEL ramps and its painter-only fields (ramp indices, paint overrides, shading bands) stay in FigureBuilder.
- **Source (amended 2026-10-30):** FigureBuilder `src/render/figure/` at `a1f7246`: `math.ts`, `rig.ts`, `genes.ts`, `parts.ts`, `garments.ts`, `hair.ts`, `streetwear.ts`, `motion.ts` (locomotion, idle, stands, turn, holds and hems; its three action branches become fixture clips, §4.4.4), the generic parts of `cast.ts` (the character definition and the libraries) and the library files, with FigureBuilder's `tests/form.test.ts` (pocket holds, the walk) and The Last Light's rig, hold and library tests (`tests/procedural-figure.test.ts` at `92e6704`) ported onto fixture figures. Every file is split under the 600-line ceiling by responsibility. `texels()` snapping, which rounds small features to whole sprite texels, uses a **fixed ppm** (a constant in figure units) instead of a sprite cell's. **Not extracted:** `raster.ts`, `paint.ts`, `ramp-light.ts`, `src/render/duel-ramps.ts`, `sprite-light.ts`, `light-step.ts` (the sprite look), the `Figure` raster runtime in `figure.ts`, the sprite cheats (`lookUp`, `faceCamera`, `faceTurn`, the 8-direction snap, the texel bob floor), the SNEKPRTY crew (`crew/`), sets, graphics, marks, plates, font and colourway, and the characters themselves (DEZ, KASE, RONI and JULES stay in FigureBuilder; Ada, the Nurse and the Porter in The Last Light; AF's fixture figure is Wick, Emberwick's character, as data).
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
- **Paths are straight between keys.** A position lerps in a straight line, so a hand going from a wind-up behind the head to a low slash in front passes close to the head. An arc takes extra keys along it (the Studio's onion skin shows the path); M3 has no arc or spline option, and adding one later is an additive `ClipKey` field. 
- **Keys in different spaces.** When a channel's `space` differs between two keys (`root` at one, `chest` at the next), both targets are converted to `root` space using the chest frame of the pose evaluated so far (§4.4.5 steps 1 and 2, before this clip), interpolated there, and solved in `root` space. The content compile warns on such a pair, because the result depends on what the torso does underneath.
- **Stepped by default.** The clip is sampled at its `rate` (12 a second), so the hand-animated read the Owner approved in The Last Light survives (M3R-D3). `ease: 'step'` holds a key until the next; `rate` per clip can be raised, or the figure can be told to sample every frame.
- **Masks** say what the clip owns. A clip with `mask: ['armR', 'torso']` changes nothing below the pelvis and nothing in the left arm, so a sword slash plays over the walk (I-h). Two clips with overlapping masks resolve by layer order (§4.4.5).
- **Blend** is a weight ramp for **one** clip as it starts and ends (a shield coming up over 120 ms), applied to the clip's channels against the layers below. When one action clip replaces another mid-play, a short **pose-space transition** carries the outgoing clip into the new one (§4.4.5 step 3, M3R-D16). There is no state machine or blend tree (M3R-D6, agent default).
- **Markers, cues and the sim.** Combat needs the picture to hit when the sim's hit window opens. The sim declares an action's length in ticks (`FigureState.action.length`, seconds) and names a marker (`contact`); the view retimes the clip evenly to that length. **Stepped sampling snaps to markers:** the pose step that contains a marker is sampled at the marker's time exactly, so the `contact` frame shows on the first render frame at or after the sim's hit tick (within one render frame, about 17 ms at 60 FPS, not one pose step of 83 ms). The game's content compile checks that every sim action naming a clip and marker finds it, and that the stretch is between 0.5× and 2× (a warning past that). **Cues** are presentation hooks the view emits once as the clip's time crosses them (a footfall, a swing sound); audio and particles listen; the sim does not.
- **Ported from the source** as fixture clips, to prove the data model against known motion: `reach`, `look` and `flinch`, FigureBuilder's three actions. Their end poses must match **FigureBuilder's `motion.ts` at `a1f7246`** within 1e-3 figure units (F-g; amended 2026-10-30). The Last Light's other eight (`thrust`, `cup`, `recoil`, `read`, `sit`, `sleep`, `radio`, `push`) are its story poses and stay in that game; each is a handful of keys and shows what the data model replaces.

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
3. **The action clip** (`action`), one at a time. Its time is `(now − startedAt) / length × clip.length` when `length` is given, else real time. **A new action replacing a running one** (a slash into a second slash, a roll into guard, a hurt during a swing) does not pop: the view keeps the outgoing clip's last sampled handles for the channels it owned and blends them into the new clip with `blend(outgoing, incoming, u)` over the new clip's `blend.inMs` (80 ms when the clip gives none; 0 makes it a cut). A channel only one of the two clips owns blends against the layers below, as a lone ramp does. This is one pose blend per figure per transition, not a crossfade of two playing animations (M3R-D16, agent default).
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

(The first revision's §4.5, rigged characters, is deferred with them (M3R-D1); the number is kept so references to §4.6 to §4.8 stay valid.)

### 4.6 `pipelines` (`automata-plus/tooling/pipelines`, M3.8, M3.9)

**Platform:** unchanged from 2026-10-16 §4.8 (router, stage cache, budgets, gates, audit log, guard, Effect, Python image stages).

**Character pipeline, one path (procedural, in Plus):** FigureBuilder supplies only the review sheet's layout; its sheets are 2D paintings and its painter is not extracted (amended 2026-10-30). `spec` (a `figure` content file: sliders, gait, outfits, plus `figure-pose` and `figure-clip` files) → `sheet` (a review sheet rendered headless from `base-3d`'s default view at 24 mm: every outfit, the walk in four directions of travel, every pose, and every clip as a strip of its keyed poses with its markers; gate G5) → `install` (gate G6). No paid stage, so no budget key. From the proposal's §10.3. The first revision's rigged path (`model`, `rig`, `animate`, `flatten`) and its Meshy gates G1 and G3 are not extracted.

**Props pipeline:** unchanged (2026-10-16 §4.8): image → Meshy → flattened static GLB, with its paid stages and gates.

### 4.7 Base game and examples (M3.7)

- **`games/base-3d`**: the first slice of the base 3D game (§17), Emberwick's 3D counterpart, a small complete game as Emberwick is. One room with a doorway to a second (boxes, three GLB props, fog), two `camera-view`s (one per room, a cut at the doorway, the stick mapping latching across it), free camera rotation (drag, stick, keys; §4.2), cut-away walls and one fading pillar, the player as a procedural figure (Wick as `figure` content) with the pose library and four clips (a sword slash that plays over the walk, a raised guard held as a stance, a point, a pickup), a second figure standing in for a target, and a minimal lock-on: a held action sets `lockTarget`, the player strafes (`moveDir`), the head and chest aim at the target and the camera frames both. Splash → menu → room → pause → end on core `runtime`, `host`, `ui`, `content`, with the `post-retro` chain. Its sim is a small plugin (position `x`, `z` in fixed-point metres, facing, moving, view id, heading, lock target, wall boxes), with no physics, so its golden replay runs in Node, Chromium, WebKit and Firefox. `runtime.orientation = "landscape"`; portrait shows M4's rotate hint. GAME-3D grows this slice (02).
- **One-file examples** (EX rules; `Tier: core` when an example needs only free packages, which holds for `render3d` and `figures` (M3R-D20), `plus` when it needs `post-retro`): module `render3d`: `render3d-meshes.ts`, `render3d-angled-camera.ts`, `render3d-lighting-fog.ts`; module `figures`: `figures-walk.ts`, `figures-outfits-items.ts`, `figures-poses.ts`, `figures-clips.ts`, `figures-aim.ts`; module `post`: `post-retro-chain.ts`; module `physics`: `physics-bodies-3d.ts` on `base-3d`'s room. Each 100 code lines or fewer.

### 4.8 Packaging

Unchanged from 2026-10-16 §4.7: `render-pixi3d`, `figures` (because its only renderer is private) and `base-3d` are `private: true`; the tarball is vendored only in private repositories; `ship prepare` refuses a public target whose bundle contains `@pixi/3d` (M3R-D7 says when `figures` could be published).

## 5. Data and lifecycle flows

**Boot:** as 2026-10-16 §5, with figures, poses, clips, camera views, lamps, props and the post chain arriving as compiled content; the renderer builds `View3D`, bakes static vertex light, then builds each figure's parts.

**Per fixed step:** the sim steps; `apply(result)` feeds the consumers. Characters' sim fields (position, facing, moving, speed, move direction, action, stances, aim target, view id, heading) arrive in render rows.

**Per frame:** views interpolate positions; each figure evaluates its motion at the presentation time (§4.4.5): on a pose step it samples locomotion and clips, every frame it re-solves pins and aim, and it updates joint transforms (and re-skins skinned garment parts); characters relight from the lamps in range; the camera follows and eases toward the active view and heading; the occluder rule cuts and fades (§4.2); the post slot runs.

**View change:** the sim sets the player's view id (a room or sector change); the renderer calls `activate(id, how)`; the stick mapping latches (§4.2). A view change is a camera cut or a 400 ms ease (a cut under reduced motion); no remount, no sim effect beyond the id.

**Camera turn** (§4.2): a drag, the right stick or a held key becomes `camera-turn { units }`; the sim adds it to the player's `heading`; the stick mapping uses the new heading from the next tick (no latch); the renderer calls `heading(yaw)` every frame and tracks it one to one.

**Outfit or item change** (a sim event or a render-row field): the figure rebuilds its part list once.

**Action:** the sim sets `action { id, startedAt, length }`; the view samples the clip from `startedAt` in presentation time, retimed to `length`, and returns to locomotion when it ends. A clip the figure lacks is a content error at compile time when the content names it, and a logged warning (once per id) when only the sim does.

**Stance:** the sim lists clip ids in `stances` while the state holds; each blends in over its ramp, holds on its last key, and blends out when removed.

**Lamp change, lifecycle background, context lost, dispose and restart:** as 2026-10-16 §5.

**Pipeline runs:** as 2026-10-16 §5, for the one character path (§4.6).

## 6. Failure policy

The 2026-10-16 §6 rows for S7-Q1, S7-Q3, WebGPU fallback, malformed `.glb`/`.bin`, filter compile failure, context loss, public bundles, budgets, paid calls, agents calling `approve`, guard edits and Python stand. Removed: atlas and normal-map rows, camera-zone rows, the first revision's skinning and rigged-model rows. Added:

| Case | Result |
|---|---|
| A `.glb` carries a skin | `ModelInvalid { file, reason: 'skinned' }`; boot shows the asset error panel with Try again. Skinned glTF is not supported yet (deferred, M3R-D1) |
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
| `pipeline.toml` `[locked]` `lensMm` is not 24, or a `camera-view` has a tilt outside 15° to 60° or a distance outside 3 to 12 m | `automata pipe guard check` fails naming the file and value; the lens changes only by a recorded decision, the ranges by a spec change |
| The active view id names no view | Content compile error when the content names it; at run time the camera keeps its last view and logs once |

## 7. UI inventory and states

| Component | States | Focus and input | Host-aware |
|---|---|---|---|
| Asset error panel (existing `ErrorPanel`) | `ModelInvalid` (static or skinned), context lost; Try again | Try again focused | — |
| Pipeline review (MCP elicitation, outside the game) | asked, approved, rejected, cancelled, timed out | The person answers in their MCP client | — |
| Camera turn (touch: a one-finger drag outside the stick and buttons; mouse: a secondary-button drag; pad: the right stick; keyboard: held `camera-left` and `camera-right`) | idle, turning, ignored in a view with `rotate: false` | The drag region is everything outside the controls; one-to-one tracking; keyboard and pad as listed | Never starts inside `hostReserved` |

Camera turn is a gesture, so it adds no on-screen control; two settings entries set its speed and direction (§4.2). The in-game controls GAME-3D needs (a lock-on button, an action button, an item button, the stick) are M4's touch overlay and GAME-3D's design (§17), not M3's. The character editor's screens are the editor suite's.

## 8. Responsive behavior

As 2026-10-16 §8, with "the 3D view fills the field" for every size and the zone/billboard rows removed. The lens fixes the **vertical** field of view at 53.13°, so a wider screen shows more to the sides and never more up or down (the runtime is landscape-only). Authored views keep the focus point and the walls they frame inside the frame at **4:3 and 21:9** (D3-g). The default view puts a 1.62 m figure at about 29% of the frame's height on every size, about 115 px on 844×390 and 79 px on 780×270 (S7-Q10 records the compact case for the Owner's look). Reduced motion makes view eases, the heading ease on view entry, occluder fades and lag instant and keeps gait and clips (they are the character's motion, not camera motion); a camera drag still tracks one to one, because it is the player's own input. Landscape phone and compact: the logical field is letterboxed by core as before.

## 9. Test allocation

| Layer | Where | What it proves |
|---|---|---|
| Unit (Node) | `figures` (sliders → skeleton, FK, two-bone IK, effectors, poles, aim, pins, limits, mirror, blend, clip sampling, easing, masks, layers, retime, markers, gait incl. `moveDir`, idle, turn, holds, garments, libraries, content schemas); `render-pixi3d` (angled camera, view activation, the heading and the stick mapping, mapping latch, occluder cut-away and fade, static `parseGlb`, character light, cue emission); `post-retro`; `pipelines` | Ported: `procedural-figure.test.ts`'s rig, hold and library tests (the raster, painter and cell-cache tests are not ported). New: I-a to I-k, F-g, F-h, D3-a, D3-g, D3-h, D3-i |
| Parity (sim) | `games/base-3d` | Golden replay hash identical in Node, Chromium, WebKit and Firefox (includes the view id, the heading, the lock target and the stick mapping) |
| Parity (render) | GPU runner | WebGL2 and WebGPU captures of the S7 scene, each `post-retro` pass and `base-3d`'s rooms within M3-D5's tolerance |
| Fake-host E2E | each example and `base-3d` under `@ruken/sdk-host`, served with `compileHeaders` | Boots, nothing before ready, zero console errors and CSP violations, no `generateSpawnBurst`; `ModelInvalid` shows the panel; context loss recovers; the doorway cut keeps the character moving the same way; a camera turn re-maps the stick |
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
| M3.0 | This revised spec, reviewed | integration | — | Owner review; M3R-D1 to M3R-D20 confirmed or changed; M3R-D18 is answered (the launch waits for Pixi 3D's public release). **Done 2026-10-23:** the Owner approved the spec (last two rows of the table); every decision stands as written |
| M3.1 | Spike S7 (revised) | render3d | M3.0 | §3; `docs/spikes/s7-pixi3d.md` and verdict; S7-a to S7-f; S7-Q11 records the beta's terms (M3R-D18, answered) |
| M3.2 | `pixi.js` 8.22 in core | ship, runtime | S7-Q6 (M3.1a; amended 2026-10-30) | Unchanged; V-a |
| M3.3 | `post-retro` | render3d | PRODUCT.1, PRODUCT.5 | Unchanged (2026-10-16 §4.5); PF-a to PF-c |
| M3.4 | `render-pixi3d`: renderer, meshes and props, the angled camera, lighting, fog | render3d | M3.2, M3.1b (not PRODUCT.5: M3R-D20; amended 2026-10-30) | §4.1–§4.3, §4.8; examples `render3d-*`; D3-a, D3-c to D3-j |
| M3.5 | `figures`: definition, skeleton, locomotion, holds and the figure view | figures (new) | M3.0A; the figure view (M3.5d) also M3.4a and M3.4d (amended 2026-10-30) | §4.4.1; examples `figures-walk`, `figures-outfits-items`; F-a to F-e, F-h |
| M3.6 | `figures`: the IK rig, poses and clips | figures | M3.5 | §4.4.2 to §4.4.6; examples `figures-poses`, `figures-clips`, `figures-aim`; I-a to I-k, F-g |
| M3.7 | `games/base-3d` (first slice) and `physics-bodies-3d` | integration, sim | M3.3, M3.5, M3.6 | §4.7; B-a to B-c |
| M3.8 | `pipelines` platform | pipelines | M3.0, PRODUCT.5 | Unchanged; PL-a to PL-e |
| M3.9 | Character (procedural) and props pipelines | pipelines | M3.8, M3.6 (the sheet draws poses and clips) | §4.6; PL-g, PL-h |
| M3.10 | M3 exit | integration | M3.7, M3.9 | X-a to X-c on the GPU runner; Owner gates (§13) |

**Order:** M3.1 and M3.8 first (neither needs an unmerged package; M3.8 needs PRODUCT.5). M3.3 when PRODUCT.1 and PRODUCT.5 merge. M3.2 after S7's verdict; then M3.4; M3.5 then M3.6; M3.7; M3.9 after M3.8 and M3.6; M3.10 last. The first revision's M3.6 (rigged characters) is replaced, not deleted: the number now means the rig. **After M3, inside AF 1.0:** GAME-3D.0 and GAME-3D.1 grow `games/base-3d` into the action-adventure, and M9.0 promotes its proven 3D systems into packages; the AF 1.0 launch waits for both and for Pixi 3D's public release (M3R-D18; 02, §18).

**Lanes for 04:** render3d (`packages/render-pixi3d`, `automata-plus/packages/post-retro`, `spikes/s7-pixi3d/`), **figures** (new: `packages/figures`), pipelines (`automata-plus/tooling/pipelines`). Integration owns the base game.

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
- **D3-a.** Activating a view with `ease` moves the camera to the view's heading, tilt and distance over 400 ms and instantly under reduced motion; a `camera-turn` of N units changes the heading by exactly N/65,536 of a turn, shown in the same frame with no ease; a view entry that sets `yawDeg` eases to it over 250 ms (instantly under reduced motion); the camera's lens is 24 mm (53.13° vertical) in every view.
- **D3-c.** A `.bin` prop and the same prop as `.glb` produce identical vertex buffers.
- **D3-d.** Interpolated character positions at `alpha` 0.5 lie halfway between the last two ticks.
- **D3-e.** A lamp switched off by a sim event darkens the static meshes and the characters in its range, and only those.
- **D3-g.** For each authored view of `base-3d`, at every 15° of heading, the focus point and the room's floor outline are inside the frame at 4:3 and 21:9.
- **D3-h.** For each view of `base-3d`, at every 15° of heading, with the player at each of the room's corners and its centre, a ray from the camera to the player's head and to its feet hits no drawn opaque mesh after the occluder rule; the cut-away walls are exactly those whose inside face points away from the camera, and a `fade` prop on the line is at 25% opacity.
- **D3-i.** The sim's mapper maps "stick up" to the direction away from the camera at every heading, using `sin` and `cos` from `@mcthaydt/automata-sim/math` and no `Math` trig (checked by `pnpm boundaries`), within one Q16.16 unit of the exact value; a `camera-turn` of N units changes the heading by exactly N (wrapping at 65,536) and a view with `rotate: false` ignores it; a view change latches the mapping and a player's turn does not.
- **D3-j.** A `camera-view` that omits tilt and distance compiles to 25° and 5 m; at those defaults a 1.62 m figure fills at least 25% of the frame's height at 16:9, 4:3 and 21:9 (the render test records the number S7-Q10 reported).
- **F-a.** Two fixture figures with different sliders build skeletons whose bone lengths follow the sliders, from one generator.
- **F-b.** Holding an item changes only the holding arm's joints: every other joint's world matrix is equal (1e-9) with and without it, across walk, idle and turn.
- **F-c.** The walk repeats exactly after one cycle at the gait's pose rate.
- **F-d.** Swapping an outfit rebuilds the part list once and changes no joint.
- **F-e.** A figure naming a missing library id fails content compile with its location.
- **F-g.** The fixture clips `reach`, `look` and `flinch` end within 1e-3 figure units of FigureBuilder's end poses (`motion.ts` at `a1f7246`) at the same state.
- **F-h.** With `moveDir` of 0, π/2 and π, the stride vector is the forward vector rotated by it, and a half-turn plays the same cycle backwards.
- **I-a.** Every limb effector reaches any reachable target (hand or foot within 1e-6 figure units); for an unreachable target the limb is fully extended toward it and the report names the shortfall; a pole parallel to the limb, and a target on the limb's root, give finite joints.
- **I-b.** Turning a pole by 90° swings the knee or elbow's bend plane by 90° and moves the end effector by less than 1e-6.
- **I-c.** After a solve no hinge or cone exceeds its limit, and `report.limited` lists exactly the joints a limit clamped.
- **I-d.** A pinned foot or hand stays within 1e-6 of its world position while the pelvis moves within the limb's reach, at every frame including between pose steps.
- **I-e.** An aim target inside the limits is hit by the head's forward axis within 0.5°; one outside them clamps at the limit and the face never turns past it; spreading the aim changes `spine`, `chest`, `neck` and `head` by their shares.
- **I-f.** `mirror(mirror(p))` equals `p` for every fixture pose; a pose written to content and read back is equal (canonical spelling); `blend(a, b, 0)` equals `a` and `blend(a, b, 1)` equals `b`.
- **I-g.** `evaluate` is deterministic: the same definition, state, time and library give equal matrices, across 1,000 random-but-seeded times; a `loop` clip's value at 0 equals its value at `length`.
- **I-h.** A clip with `mask: ['armR', 'torso']` changes no joint of the legs or the left arm: their world matrices equal the same evaluation without the clip (1e-9); a held item on the left arm still holds.
- **I-i.** `retime(clip, L)` scales key times, markers and cues evenly; a clip played with `action.length = L` shows its `contact` pose on the first render frame at or after `startedAt + markerTime × L / length`, in stepped and smooth sampling alike.
- **I-k.** A slash replaced by a second slash at mid-swing (and a roll replaced by a guard): at the replacement the evaluated hand position equals the outgoing pose (1e-6), after `blend.inMs` it equals the new clip's sample (1e-6), and in between no effector moves more than the larger of the two clips' own largest per-step move.
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
- D-1 stays until Pixi 3D goes public (M3R-D18, answered); S7-Q11 records the beta's terms.
- `base-3d` played on a real phone (one Android, one iPhone) under Ruken's local stack, with device, browser, renderer and date recorded; the angled 24 mm view's look (S7-Q10's capture and the played room) and the figures' look and motion approved from evidence, held to Emberwick's quality (M3R-D17).
- The four fixture clips and the pose library judged from the review sheet and played in `base-3d`.
- One procedural character through the pipeline with G5 and G6, on the Owner's keys for any paid props stage, with the audit lines recorded.

## 14. Risks

| Risk | Mitigation |
|---|---|
| Procedural figures look like low-poly mannequins in real 3D, without the sprite painter | Stepped poses, the source's garments and faces, the palette and `post-retro`'s outline pass; the Owner judges the look at M3.10; M3R-D2 records the painter as droppable, not lost (it stays in The Last Light) |
| A 24 mm lens close to the action stretches figures near the frame's edge and makes the room feel deep | The Owner's 25° and 5 m are the defaults; S7-Q10 records the edge stretch on captures; authored views keep the focus near the middle; D3-g checks the edges at 4:3 and 21:9; the lens is a locked value the Owner can change by one recorded decision |
| A 25° tilt shows the horizon, so an open room edge shows the void | Every authored room closes its far side with a wall or fog (S7-Q10); the 3D editor's openings check already reports open sectors |
| `@pixi/3d` is a closed beta (no public deployment) and the AF 1.0 launch now waits for its public release | We build on the beta; builds stay private and `ship prepare` refuses a public bundle until Pixi 3D is public (M3R-D18). The launch date follows a release we do not control; the §4.1 seam keeps the package swappable if the Owner ever says it will not come |
| Phone FPS with six figures solving IK | S7-Q3 and S7-Q8 measure it; the rig scope can shrink (fewer solved effectors per figure) without a contract change; cut values become content limits the guard enforces |
| Authored clips fight the gait (a slash sliding the feet) | Masks keep the clip off the legs; pins hold the planted foot every frame; I-d and I-h prove both |
| Stepped poses look jittery where the eye wants contact | Pins and aim solve every frame (M3R-D13); the clip's `rate` and a smooth option are per clip and per figure |
| Joint-limit values are wrong for the art | Starting values only; tuned in M3.6 in the Studio; limits are content in `rig.json`, not code |
| The Studio's needs outgrow `figures`' API | §4.4.6 lists the pure functions the Studio needs and the editor-suite spec cites them; additions are additive |
| Deferring rigged characters drops the Meshy character path | Deferred "for now" by the Owner; the props pipeline keeps Meshy for static props; nothing here prevents a later skinned view (a second view type beside `figure`, and the `ModelInvalid` skinned row becomes a supported path) |
| The Last Light keeps moving | Each task's plan re-reads its files at the current commit and records it |

## 15. Decisions (recommended defaults; approved by the Owner 2026-10-23)

A row may have two parts. **Owner's words** restates the Owner's own words from the direction table and is in effect. **Agent default** is a reading of them, or a call the Owner never made, and was approved with the spec like every other default. **Pending** marks a reading whose question is on the Orchestrator bus; it keeps the default shown until the Owner answers.

| ID | Question | Recommended default | Why |
|---|---|---|---|
| M3R-D1 | What does M3 deliver? | **Owner's words:** "drop 2.5D" (2026-10-18); "Cut the rigged gltf, procedural only for now" (2026-10-23). **Agent default:** 3D characters as procedural figures with an IK rig, authored poses and clips, in a 3D room, one base game. Rigged glTF is **deferred**: out of M3 and GAME-3D until the Owner reopens it, not removed from AF for good | "for now" makes it a deferral; §14 keeps the seam |
| M3R-D2 | The figure painter (sprite-cell look) | **Not extracted.** It stays in The Last Light; figures render as meshes | It is the 2.5D look; extracting it would keep 2.5D alive in another form |
| M3R-D3 | Pose stepping in 3D | **Authored channels step at the pose rate** (default 12 per second), with an option for every frame, per clip and per figure | The hand-animated read is what the Owner approved in The Last Light; smooth is one flag away |
| M3R-D4 | Lighting moving characters | **Per character per frame (ambient plus lamps in range), as a tint**; static meshes keep the baked vertex light | Baking cannot follow a moving, deforming mesh; per-character is one small sum |
| M3R-D5 | Where `figures` lives | **Its own free package, renderer-free**; the 3D view in `render-pixi3d` | The data, rig and motion are testable in Node and outlive any one renderer |
| M3R-D6 | Animation scope in M3 | **Owner's words:** "procedural only for now"; "add like IK rig so we can manually pose, I think that's also necessary for animation". **Agent default:** procedural gait, the IK rig, authored poses and clips with masks, a per-clip weight ramp, a pose-space transition between action clips (D16), markers and cues. No glTF skins or clips (they go with the deferred rigged path). No blend trees, retargeting, root motion or state machines in M3: the agent's scope call, not the Owner's | The rig adds what the Owner asked for; the rest is left out to keep M3 small, and can be added without breaking the clip data |
| M3R-D7 | Publishing `figures` | **Private while D-1 stands**, because its only renderer is private; revisit if D-1 changes | No public package that cannot be drawn |
| M3R-D8 | `base-25d`, the rigged character and the base game | **Owner's words:** "that's our base 3D game like our 2D platformer game" (14:18:10). **Agent default:** `base-25d` and the rigged character are dropped. `games/base-3d` is the base 3D game, the counterpart of `games/emberwick`: M3.7 builds its first slice and GAME-3D grows it (§17), in this repository, unpublished while its renderer is private | One base per dimension; 2.5D is not a dimension AF ships; rigged glTF is deferred (M3R-D1) |
| M3R-D9 | The camera | **Owner's words, in effect:** "use an angle like crow country"; "Go with 24mm focal length for camera"; "we can cut the 45 degree snap for rotation, I think per pixel rotation works well since it's fully 3D now". **Agent default:** a follow camera the player turns freely by drag, right stick or held keys, 0.25° a pixel (a player setting); the heading is an integer in turn units in the sim and the stick mapping uses `dmath`'s `sin` and `cos`; a view may set a heading, bounds and lag, and `rotate: false` locks an arena; no steps and no rotate buttons (§4.2) | The Owner chose free rotation; it needs only an integer heading and `dmath` in the sim; klipp (M9.0) is checked against it |
| M3R-D10 | AF 1.0's scope | **Owner's words, in effect:** "3D ships 1.0" (14:18:50). **Settled (the coordinator's reading of the answer to "1.0 or Plus?", 14:37 UTC):** AF 1.0 includes 3D, free, not as a Plus extension: the 1.0 launch (the core release, M8.9) ships `render-pixi3d`, `figures`, the base 3D game, the examples and the docs, and waits for GAME-3D.1 and M9.0. Which package keeps which tier is M3R-D20. The launch also waits for Pixi 3D's public release (M3R-D18) | The Owner answered "1.0 or Plus?" with "3D ships 1.0" |
| M3R-D11 | The view's tilt, distance and focus | **Owner's words, in effect:** "25deg tilt, 5m distance is great". **Agent default:** the authored ranges are 15° to 60° and 3 to 12 m, and the focus is 1.0 m above the followed position. `pipeline.toml` `[locked]` holds the lens only; the guard checks tilt and distance by range | A 1.62 m figure fills about 29% of the frame's height (S7-Q10 measures it); views need different tilts |
| M3R-D12 | Rig scope | **Four two-bone limbs with poles, hips, chest, head, a look-at/aim that spreads over spine, neck and head, pins, and limits.** No general chain solver (FABRIK/CCD), no physics, no ground-contact IK in M3 | What manual posing and the action-adventure's combat clips need; stairs and slopes come from GAME-3D (M9) |
| M3R-D13 | Stepped channels, per-frame contact | **Poses and clips step; pins and aim re-solve every frame** | Contact and eye line read wrong when stepped; the cost is a few two-bone solves a frame (S7-Q8) |
| M3R-D14 | Sim and clip timing | **Clips declare markers; the sim declares an action's length; the view retimes evenly** and a content check ties the sim's contact tick to the marker | Combat needs the picture to hit when the sim's window opens, without the sim reading a joint |
| M3R-D15 | The stick across a view change | **The mapping latches to the old heading until the stick is released or turns by more than 90°**; the player's own camera turn does not latch | The classic fixed-camera rule; GAME-3D.0 tunes it |
| M3R-D16 | One action clip replacing another | **A pose-space transition:** the outgoing clip's last handles blend into the new clip over its `blend.inMs` (80 ms by default) | A combo, a roll into guard or a hurt mid-swing must not pop in a lock-on action game; it costs one `blend` per transition |
| M3R-D17 | The visual target ("like ocarina of time switch 2 remake") | **Owner's words, in effect:** "Visually it should match the 2D game too in terms of quality, use the editors" (14:21:02). **Agent default:** the look is AF's one look ([art direction](../../art/README.md): Endesga 64, `post-retro`'s low internal resolution and palette quantization, sprite-like silhouettes) held to Emberwick's quality bar, with the same Owner visual acceptance (real-device captures, explained baselines, no auto-promoted goldens). All of the game's content is authored in the editor suite (the 3D level editor, the Studio, Sequence and the rest as they land); an edit an editor cannot make is made by hand and logged as a gap for that editor's lane, never worked around silently. A modern remake-style look is not planned | The Owner asked for the 2D game's quality and the editors; the one look is already AF's art direction |
| M3R-D18 | How 3D ships publicly while `@pixi/3d` is a closed beta | **Owner's words, in effect:** "I forgot, we launch when pixi 3D goes public" (14:49:20). **Agent default for the details:** we build on the `@pixi/3d` beta now; builds stay private while D-1 stands (`ship prepare` keeps refusing a public bundle containing `@pixi/3d`); the AF 1.0 launch (M8.9) waits for Pixi 3D's public release, and D-1 lifts then (the `render-pixi3d` and `figures` publish, S7 re-run against the release). The own-layer task (the old M3.4b) is dropped; if the release never comes or its terms still forbid public deployment, the Owner decides again | "3D ships 1.0" and "no public deployment" cannot both hold until the library is public, so the launch date follows it; the §4.1 contract keeps the package swappable |
| M3R-D19 | What "everything we did for 2D" covers | **Owner's words, in effect:** "I want to do everything we did for 2D but for 3D with procedural character" (14:18:10). **Agent default:** capability parity, one row per thing in §18 with the task that does it for 3D, not a copy of the 2D game's features; GAME-3D.0 confirms the list before GAME-3D.1 starts | "Everything" is long; the table makes it checkable and shows what is deliberately not asked (online play, terrain) |
| M3R-D20 | Tier and home of the 3D packages | **Follows from M3R-D10 (free, not Plus).** **Agent default:** the 3D runtime is free and lives in this repository: `packages/render-pixi3d`, `packages/figures`, `games/base-3d` and the one-file `examples/render3d-*`, as extensions (`defineExtension`; core never imports them), released with the core 1.0 (M8-D8's separate Plus line does not apply to them). PD-1 is amended for these packages only. `post-retro`, `pipelines` and `physics` (so `physics-bodies-3d`) keep their PRODUCT.0 tier, Plus; the base 3D game consumes them the way Emberwick does (PRODUCT.5 settles how a free game consumes a Plus package, not this spec). If the Owner wants those free too, the paths in §4 and the tier labels in 02 change, nothing else | "Free 3D" needs the renderer, the figure and the game to be free; the tooling and the 2D-era extensions already have a tier, and moving them is a larger product call |

M3-D3 (`pixi.js` 8.22), M3-D4 (WebGL2 default), M3-D5 (tolerance), M3-D6 (phone profiles), M3-D7 (Python image stages), M3-D8 (`.bin`), M3-D9 (no paid calls in CI) and M3-D12 (the guard hook) carry over unchanged. M3-D10 (which pipelines move) becomes "platform, character (procedural) and props". M3-D11 (`base-3d`'s static mesh character) is replaced by M3R-D6 and M3R-D8.

## 16. Effects elsewhere

- **D-1** (`render-pixi3d` unpublished): unchanged, and now also covers `figures` (M3R-D7). With 3D in AF 1.0 (M3R-D10), a D-1 that stands means 3D cannot ship publicly, so the launch waits for Pixi 3D's public release (M3R-D18), which lifts D-1 for all of M3 at once.
- **GAME-3D (02, 03):** it is the base 3D game, built inside AF 1.0 (not after it, and not in its own repo): `games/base-3d`, the counterpart of `games/emberwick`, grown from M3.7's slice (§17, §18). GAME-3D.0 cites this spec for the camera, the rig and the clip data.
- **M9 (3D merge):** because the game is built in AF's own workspace, there is nothing to merge back. M9 moves before the 1.0 launch and becomes **3D systems into packages**: it promotes the systems the game proves into packages. It does not plan the rigged character and animation pipeline, which are **deferred** by the Owner ("procedural only for now"); only an Owner decision brings them back. The selection: the third-person controller on the angled follow camera (pmndrs/klipp, checked in M9.0 against M3's `CameraRig` and its free rotation: if it does not fit, M9.0 records that and keeps M3's `CameraRig`), lock-on targeting, combat and hit/hurt clips on M3's rig, items and inventory, the dungeon pieces (keys, doors, switches, pushable blocks), ground-contact IK for stairs and slopes (a presentation-only probe against the baked static geometry, using M3's pin API), brush-based environments, and whatever else the game proves. The M9.0 row in 02 is updated to say so.
- **M6:** its 2.5D-dependent parts need a look when M6's tasks are planned: sector-derived occlusion (2026-10-16 §4.4 said "arrives with `sectors` in M6") now feeds M3.4's static vertex light; a sector can carry the `view` id of §4.2, and sector walls the `occlude` field; cutscene cameras are free shots (not an orbit around a billboard) and the clip data is the cutscene acting layer. No M6 row changes in this PR; the M6 plans re-read this spec.
- **The 3D level editor (ED3D):** two requests, not edits: a sector (or a view volume) may reference a `camera-view` id and tag walls with `occlude`, and the editor offers a preview of the view at 24 mm, its tilt and a heading slider, with the cut-away applied, so authors see the framing. The editor's own walk camera (ED3D-D8, 69°) is unrelated. The ED3D lane decides how; this spec only fixes the content shape (§4.2).
- **The editor suite's Studio:** the character editor edits `figure`, `figure-pose` and `figure-clip` content through §4.4.6. The mockups for that are in progress in the editor-suite thread (docs PR #138).
- **M8:** "AF finished for 2D and 2.5D" becomes "2D and 3D" (M3R-D10, answered): the AF 1.0 launch (the core release, M8.9, which now includes the free 3D runtime packages) waits for the base 3D game and M9.0. The M8 spec's "No 3D in 1.0" exclusion and M8-D10 are amended in the same PR. The Last Light slice (puzzle and sectors on Plus) is sim-side and unaffected.
- **01, 00 and AGENTS.md:** their M3 rows and "2D and 2.5D" wording point to this spec.

## 17. The base 3D game (direction brief for GAME-3D.0)

**Owner direction, 2026-10-23.** 08:45:45 UTC (`cmsg_01VQPgZzjNxjPkiB5eeQRiaYBZMPTigDhn8zdJ52vrPKZ9`): "make the character action adventure like ocarina of time switch 2 remake, but use an angle like crow country for the 3D", with characters "procedural only for now". 14:18:10 (`cmsg_01VQPgZzjNxjPkiB5eeQRiaY1PhQtT3Lotbmj65W9qBGAE`): "when I said Zelda, I meant that's our base 3D game like our 2D platformer game - I want to do everything we did for 2D but for 3D with procedural character". 14:21:02 (`cmsg_01VQPgZzjNxjPkiB5eeQRiaYHxLGHofnm63UnPZxYztK4h`): "Visually it should match the 2D game too in terms of quality, use the editors". So the Ocarina-style action-adventure **is the base 3D game**: `games/base-3d`, the 3D counterpart of Emberwick (`games/emberwick`), built on AF, authored in our editors, shipping in AF 1.0 (M3R-D10). Everything else here is the agent's reading, for GAME-3D.0 to confirm or change: a third-person action-adventure with **lock-on combat, dungeons, items and puzzles**.

GAME-3D.0 designs the game's content and scope (`games/base-3d`, grown from M3.7's first slice), with its own review before GAME-3D.1 builds it. This section records what that direction asks of AF, so M3 does not build the wrong things and M9 knows what to expect.

| The game needs | Where it comes from |
|---|---|
| A character seen from a three-quarter follow camera at 25° and 5 m that the player turns freely, with per-room views and doorway cuts, never hidden by walls | M3.4 (`angledCamera`, `camera-view`, the occluder rule), the view id and heading as sim state (§4.2) |
| A hero, enemies and townsfolk as procedural figures: different builds, garments, held items | M3.5 (`figures`) |
| Hero moves: a sword slash and combo, a raised shield, a roll, a jump or climb, aiming and firing a ranged item, a pickup, a push, a hurt and a fall | Authored as `figure-pose` and `figure-clip` data with the rig (M3.6), in the Studio; markers tie them to sim hit windows (M3R-D14) |
| Lock-on: a target selected in view, the camera framing hero and target, strafing around it, the head and weapon aimed | Sim-side targeting system (GAME-3D, then M9); M3 provides `moveDir`, `aim`, `frame(lock)` and a demo in `base-3d` |
| Dungeons: rooms with keys and doors, switches, pushable blocks, one-way gates, a boss room | Sector levels from the 3D editor (ED3D), sim systems in the game; M6's `sectors` and puzzles where they fit |
| Items: a sword, a shield, a ranged item, a utility item, collectables, an inventory and a map | Sim and UI in the game; held items are `items.json` entries with holds (M3.5) |
| Enemies with simple readable behaviors and clips | Sim AI in the game; clips as above |
| Rooms, characters, poses, clips, cutscenes, text, tuning, sounds and feel authored in the editors (Owner: "use the editors") | The editor suite: the 3D level editor, the Studio, Sequence, Writer, Tuner, Audio and Feel, as each lands; an edit an editor cannot make is made by hand and logged as a gap for that editor's lane (M3R-D17) |
| Touch controls for a lock-on action game, and the camera drag | M4's touch overlay and gestures (`camera-drag`, §4.2); GAME-3D.0 designs the layout |
| Aiming a ranged item | **Open for GAME-3D.0.** Ocarina aims in first person; under a 25° three-quarter camera the choices are a first-person aim view (a second camera, outside `CameraRig`'s angled views), an over-the-shoulder aim, or aiming on the ground plane with lock-on assist. M3 supplies the hand aim (`AimTarget` with `part: 'handR'`) for any of them |
| Everything Emberwick has that applies to 3D (splash, menu, rooms, pause, end, settings, saves, localization, touch, journeys, golden replay, frame budget) | §18 |

**Suggested scope for GAME-3D.0 to confirm** (not decided): one hub area, one dungeon of six to eight rooms, a boss, three items, and one save slot; the hub and the dungeon built in the 3D editor.

**Not asked for:** an open overworld, terrain and streaming (TERRAIN.0, after launch), online play. Rigged or skinned characters are deferred by the Owner ("for now"), not part of GAME-3D unless reopened.

## 18. 3D parity with 2D (Owner, 14:18 UTC)

The Owner's words: "I want to do everything we did for 2D but for 3D with procedural character". The agent's reading (M3R-D19): **capability parity**, one row per thing AF did for 2D with the task that does it for 3D, not a copy of the 2D game's features. GAME-3D.0 confirms this list before GAME-3D.1 starts, and the AF 1.0 launch waits for every row that builds something.

| Done for 2D | The 3D counterpart | Task |
|---|---|---|
| The reference game `games/emberwick`: splash → menu → room → pause → end, touch, Ruken | `games/base-3d`: a first slice (M3.7), then the action-adventure (§17) | M3.7, GAME-3D.1 |
| `render-pixi`: WebGL2 by default, WebGPU opt-in, `no-eval`, letterbox, filters | `render-pixi3d` under the same init and CSP rules, with the angled camera, lighting and fog | M3.4 (M3R-D18) |
| The look: Endesga 64, pixel lighting | `post-retro` over the 3D view: a low internal resolution, palette quantization, outline | M3.3 |
| Deterministic sim, goldens and replays in Node, Chromium, WebKit and Firefox | `base-3d`'s golden replay (heading, view and lock target included) and `physics-bodies-3d`, in four engines | B-a, B-c, GAME-3D.1 |
| The content compiler and hashed content | `figure`, `figure-pose`, `figure-clip`, `camera-view` and 3D levels as content, with compile errors at `file:line:col` | M3.4 to M3.6 |
| Input and display (M4): touch overlay, gamepad, rebinding, rotate gate, safe area, 44 px targets | Lock-on, action and item buttons, the camera drag and right stick, landscape rotate gate | GAME-3D.0 and GAME-3D.1 on M4 |
| Saves, audio and localization (M5) | Ruken saves with migrations (inventory, doors, switches), audio buses, every string localized. Positional audio from the camera's listener is not in core today: GAME-3D.0 specifies it | GAME-3D.1 |
| Gameplay extensions (M6): `sectors`, `nav`, `puzzle`, `systems`, `narrative`, `cutscenes`, `feel`, `debug` | Rooms on `sectors` and `nav`, keys and switches on `puzzle`, hit-stop and shake on `feel`, cutscenes with free cameras, `debug` overlays | M6 with GAME-3D.1 |
| The editors (ED2D and the suite) | The 3D level editor for rooms, the Studio for figures, poses and clips, Sequence, Writer, Tuner, Audio and Feel as they land | the editor suite (02 ED) |
| The asset pipelines | The procedural character pipeline and the props pipeline, with their gates | M3.8, M3.9 |
| One-file examples, the catalog and the demo gallery | `render3d-*` and `figures-*` examples on `base-3d` | M3.4 to M3.6 |
| DX: the project template, agent skills, `automata check` | A 3D template and skills, and the guard's `camera-view` range check. GAME-3D.0 places the template and skills in M8's CLI tasks | GAME-3D.0 |
| Publishing to Ruken or itch.io, size budgets, the CSP scan | The same `ship` path. `ship prepare` refuses a public bundle containing `@pixi/3d` until Pixi 3D is public (M3R-D18) | M3.7, M3R-D18 |
| Quality gates: frame budget, visual baselines and Owner acceptance, responsive checks, reduced motion | X-a, GPU-runner captures, D3-g, the reduced-motion rules, Owner acceptance against Emberwick's quality (M3R-D17) | M3.10, GAME-3D.1 |
| Online play (`net`), the store, the Party Racer starter (PRODUCT.8) | **Not asked for.** `net` stays dimension-agnostic and the base 3D game is single-player. The Last Light's adoption slice (M8.12) is the 3D adoption | — |
