# M3 2.5D and the pipeline platform: milestone spec

- **Status:** drafted 2026-10-11 by the M3 specs thread. Owner sign-off 2026-10-11 22:04Z (relayed by the coordinator from the hub). AI review by the AF framework audit thread the same day (`audits/af-m3-spec-plan-review-2026-10-11.md` in the project's shared files): five blocking items (B1–B5) and nine should-fix items (S1–S9), all folded in below; the Owner ruled on B1 at 22:19Z: the `@pixi/3d` tarball stays out of AF git (§15 Q6). This is task **M3.0** in [02 Master delivery plan](../../02-master-delivery-plan.md). Review freezes the contracts in §5; after that they change only additively or through a written change request.
- **Process note:** written in the Superpowers shape (brainstorm in §0, spec in §1–§15, plan in [the M3 plan](../plans/2026-10-11-m3-25d-and-pipelines.md)). The Superpowers skills were not available in this session, so the structure was followed by hand.
- **Builds on:** `main` at `bced229` (M1 lanes #4–#8, M2.1 #9, M2.1b #17, M2.2 #18, M2.3 #20, the demos #14, base-2d #10 and #15, CI #16 and #21 merged). M2.4 (#19) is open and merges first: after it, every PR that changes a published package carries a changeset (one `fixed` group, patch bumps before 1.0, #19's `.changeset/README.md`), and `private: true` is the only thing that keeps a package out of a release. #22 then changes base-2d's sim content and golden, so this spec names "base-2d's golden at the time", never a hash.
- **Sources re-surveyed for this spec (2026-10-11):** The Last Light (`mcthaydt/PixiJS3D_Experiment_001`) at `741e595`; RukenApp at `b30d31b` (as vendored; the audit re-checked `511e699`); AF `main` `933902f`, re-checked at `bced229`. The extraction map surveyed The Last Light at `948abe9`; every Last Light path below was re-read at `741e595`.
- **Milestone picked:** M3 is the next milestone after M2 in [01 Decomposition §3](../../01-decomposition.md#3-milestone-map-and-dependencies) (M2 → M3 → M6) and the only one whose next step is the 2.5D/3D work. M4 (input and display) also follows M1, but the Owner's roadmap puts 2.5D next and M3 needs no runner time to start.

---

## 0. Brainstorm: the choices that shape M3

| Question | Options considered | Chosen | Why |
|---|---|---|---|
| `render-pixi` (M1.7) and the runtime (M1.5) are not built; `render-pixi3d` needs the shared init, no-eval entry and filter helpers (ADR 0002) | (a) wait for the runtime lane; (b) copy the pieces into `render-pixi3d`; (c) build the shared subset of M1.7 first, in `packages/render-pixi`, as its own task | **(c), as task M1.7a** | (a) blocks M3 on a lane that has not started. (b) breaks ADR 0002 ("core `render-pixi` covers … the shared pieces") and leaves two copies. The subset (no-eval entry, renderer init with one WebGL2 retry, pixel framebuffer, GLSL + WGSL filter programs) is small, has no runtime dependency, and is exactly what base-2d's stand-in renderer already does (`examples/base-2d/src/render/renderer.ts:104-120`). The runtime lane later adds `RenderDelta` interpolation, letterbox and the rest of M1.7 on top. |
| How much of The Last Light's stage to take | (a) the whole `createStage` (601 lines); (b) the generic pieces behind a small stage API, with the game's roles (Ada, the Nurse, flames, torch states) left behind | **(b)** | `stage.ts` `load()` (lines 409–585) hard-codes the game's figures and items. The extraction map already lists what stays behind. |
| Lit sprites are shaded on the CPU every render frame (`stage.ts:567-569`, `sprite-light.ts:19`) | (a) port as is; (b) rewrite as a GPU material; (c) port the pure function and cache its output per frame index and quantized light set | **(c)**, GPU material to the backlog | The function is pure and unit-testable; light levels are already stepped (`stepLight`), so the cache hits whenever the lights hold still. S7 measures it on the phone profiles; a GPU material is built only if (c) misses 30 FPS. |
| Camera zone hysteresis | (a) keep the `hysteresis` field; (b) keep the `enter` predicate only | **(b)** | `CameraZone.hysteresis` (`src/game/contracts/scene.ts:30`) is declared but never read; the working rule is each scene's `enter(pose)` (clinic `level.ts:125-129`). AF keeps the field that works. |
| The 50 mm lens and 30° tilt | (a) lock them in AF; (b) defaults per game, locked by the game's own guard | **(b)** | They are The Last Light's locked decisions (its `AGENTS.md`, `pipeline.config.json` `locked`), not Ruken's or AF's. AF's defaults are 50 mm and 30° so The Last Light adopts with no change. The `?tilt=` URL override (`stage.ts:44`) is not ported. |
| Shadows | Keep `castShadow` and the View3D shadow settings, or not | **Not ported** | No light object exists in The Last Light (no `Light` is created under `src/`; its guard bans real-time lights), so the shadow flags are inert. |
| Post chain configuration | (a) code constants (`look.ts`); (b) content (`post` kind, compiled and hashed) | **(b)** | Master spec §9: the palette is content and the `post-retro` LUT comes from it. Content gets `file:line:col` errors and hot reload for free. |
| Palette LUT | (a) a committed PNG per game; (b) computed at load from the palette; (c) generated by a content generator | **(b)**, measured in S7 | Generators emit text only (`packages/content/src/generate/content-generator.ts`), and a 512×512 RGBA LUT as text is ~1.4 MB. Computing a 32-level LUT (32 768 cells × 64 colors) at load is small; S7 measures it, and the plan falls back to (c) with a palette-index encoding only if it misses the boot budget. |
| Pipeline runner language | (a) keep The Last Light's two runners (TS `runner.ts` and the Python mirror in `common.py`); (b) one TS runner on Effect that runs Python steps as processes | **(b)** | One place for budgets, gates, path policy and the audit log. Python stays for image and mesh work (numpy, Pillow, pymeshlab), called through `@mcthaydt/automata-node`'s `ProcessRunner`. |
| Audit log and estimate token | Only the MCP path writes the log and checks the token today (survey) | **The runner writes the audit log for every run; `--paid` from the CLI needs the owner's terminal (guard blocks it for agents) and the MCP path needs the token** | Closes the gap the survey found: the CLI path spent money without a log line. |
| Gate approval | CLI, the `approve-gate.yml` workflow, MCP elicitation | **All three kept; still no approve tool for agents** | The Last Light's rule (G-1: "no approve tool") stands; people decide, checks record facts. |
| Which character goes through the pipeline for the exit | A new figure, or Wick | **Wick**, base-2d's hooded lantern wanderer, as a 2.5D lit sprite | One look across 2D and 2.5D (art direction); Wick's lantern is the carried lamp the lighting already supports. Paid, so it waits for the Owner's budget (§15 Q3). |
| `base-3d` scope while AF 1.0 is 2D and 2.5D | (a) a placeholder; (b) the same room with a mesh character on `physics3d` and an orbit camera, no rig | **(b)** | It is the starting point for GAME-3D and the base for `physics/bodies-3d`; rigged characters and a third-person controller stay with M9. |
| How base-3d's character stops at walls and pushes bodies (audit S8) | (a) a kinematic capsule in the example's own sim code; (b) a grid or AABB clamp like base-2d, with only the crates in Rapier; (c) a small additive `physics` API, a deterministic 3D character controller | **(c)**, task M3.9a in the sim lane | A Rapier kinematic body passes through fixed colliders, so (a) needs shape casts against a world that `physics` owns, from outside it. (b) cannot push bodies, which `bodies-3d` needs. (c) keeps the world's one owner and gets a four-engine determinism test like the rest of `physics`. |
| Backend names (audit B2) | Pixi's `'webgl' | 'webgpu'`, or AF's `'webgl2' | 'webgpu'` | **AF's** | The M1 shared contracts already froze `RendererUnavailable { tried: ('webgl2' \| 'webgpu')[] }`, and `ruken.toml` says `webgl2`. Pixi's `renderer.name` is mapped once, where it is read. |
| Where the `@pixi/3d` beta tarball lives (audit B1) | (a) committed under `vendor/pixi-3d/`; (b) out of AF git: a git-ignored `vendor/pixi-3d/` filled from The Last Light's private repo and checked by SHA-256 at install | **(b)**, the Owner's ruling at 22:19Z (§15 Q6) | The beta's terms keep "the source, beta tarball and generated builds inside the beta" (The Last Light `README.md:239`); AF's history would carry the file into a public repo later. `@pixi/3d` is an optional dependency, so AF still installs where the beta is not available (§5.2). |
| `defineExtension` (audit B3) | (a) build the bare `defineExtension` in M1.7a; (b) export each extension's schemas and services plainly and wrap them when M1.5 builds `defineExtension` | **(b)** | Smaller, and it leaves `defineExtension`'s one owner (the runtime lane, M1 shared contracts §2) in place. |
| Camera-relative movement and replays (audit S9) | Send the camera azimuth to the sim, or send a world-space direction | **World-space integer heading 0–31** (eight directions at first; 32 since the Owner put an analog stick on both bases, 23:02Z, §5.3) | The azimuth is presentation state. The game rounds input plus the camera's azimuth to one of 32 world headings before sending `move`, and the sim maps the integer through a table of constants, so no engine-computed `sin` or `cos` enters a command and goldens stay engine-independent. Sprite facings stay eight (`Direction8`, `directionRow`). |

## 1. Goal and boundaries

At the end of M3:

- a **2.5D example scene** (`examples/base-25d`: a fixed-camera room, Wick as a billboarded lit sprite carrying his lantern, a few GLB props, fog) renders on WebGL2, and on WebGPU when opted in, under Ruken's CSP, at ≥ 30 FPS on the phone profiles, in a private build (D-1);
- `examples/base-3d` (the same room in 3D: a mesh character on `physics3d`, an orbit camera) exists as GAME-3D's starting point, and `physics/bodies-3d` runs on it;
- `post-retro` turns any Pixi container (2D or 3D) into the retro look from content: dither, LCD snap, Endesga 64 palette LUT, grade, bloom, LCD panel;
- the `pipelines` dev extension runs game-agnostic pipelines with budgets, estimates, gates, a guard hook and an audit log, from a CLI and an MCP server;
- **one character (Wick) goes through the 2.5D character pipeline with its gates**, and its output loads in `base-25d` with no hand edits; the props pipeline produces `.bin` props (the `LLP1` mesh format) that load the same way.

**The look bar (Owner, 2026-10-11, 23:02–23:13Z via the hub).** The Owner saw the first HUD boards and said 2.5D and 3D "look noticeably worse compared to 2D", then set the bar: "Visually in 2.5D and 3D as it is in 2D". The design and quality reference for every base and the HUD is "Bubble Bobble x Celeste as an itch indie hit": Bubble Bobble's readable single-screen arcade design and Celeste's feel and pixel-art polish, finished like an itch.io hit. Both are influences, not motifs to copy (base-2d's `PROVENANCE.md`). base-2d's room is the anchor. M3.13 gives base-25d and base-3d the art pass base-2d got and checks them against that anchor (§11). The Last Light is a source to borrow from freely, not the target (§15 Q7).

**Exclusions.** Full 3D (rigged characters, animation sets, third-person controller, brush environments) is M9. Sectors, cutaways, nav, puzzles, systems, narrative and cutscenes are M6 (`sectors`, `nav`, … extensions); M3's room is a box room, not a sector map. The reference, scene/blockout, vision, art (Aseprite), audio, FMV and sound pipelines stay in The Last Light until the M6 or later spec that needs them. Graphics settings and quality tiers are M4. Publishing `render-pixi3d` is out (D-1). FloorFifty's eight GLSL filters and `filter-stack-guard.ts` (extraction map, `post-retro` row) are deferred until a game asks for them (FloorFifty's adoption, M8): neither base needs them.

**Prerequisite artifacts:** M2.2 compiled content and `defineContentSchema` (merged, #18); M2.3 `replayGolden` (merged, #20); M2.1 `physics3d` (merged, #9); `base-2d` (merged) for the 2D `post-retro` demo; the `@pixi/3d` 0.1.0-beta.2 tarball from The Last Light's `vendor/`. Its licence file is MIT, but the closed beta's terms are wider: "Keep the source, beta tarball and generated builds inside the beta. This project is private, with no public deployment." (The Last Light `README.md:239`). Both apply, until the beta allows public use: the tarball stays out of AF git (the Owner's ruling, §15 Q6), no build that bundles it deploys to the dev host or appears in a public gallery list, and captures of it are `beta-only`.

## 2. What already exists (verified 2026-10-11, not rebuilt)

| Piece | Where | State |
|---|---|---|
| Pixi init with WebGL preference, nearest scaling, a RenderTexture light map, demo layers | `examples/base-2d/src/render/renderer.ts:104-120, 196-199, 405-414` | Stand-in for M1.7; M1.7a lifts the init and no-eval parts into `render-pixi` and base-2d moves onto them |
| No-eval entry (`pixi.js/unsafe-eval`, Zod jitless) | `examples/base-2d/src/no-eval.ts:12-15` | Same; moves to `render-pixi/no-eval` |
| `RenderDelta` (`resync`, `added`, `changed`, `removed`, rows of `sid` and render-flagged components) | `packages/sim/src/world/entity-store.ts:7-25`; `StepResult.render` at `world/sim.ts:58-65` | Built; `render-pixi3d` consumes it |
| `physics3d`, `Transform3D` (x, y, z, qx, qy, qz, qw; rendered), `body3d`, `collider3d` (ball, cuboid, `capsule` at `spawn-3d.ts:35`), body kinds including `kinematicPosition` (`kinds.ts:7`) | `packages/physics/src/3d.ts`, `physics-3d.component.ts:6-51` | Built (#9). No character controller or shape cast yet: M3.9a adds one |
| Endesga 64 palette as content, `DEFAULT_PALETTE`, `checkPalette` | `packages/content/src/palette/` | Built (M1.3) |
| Content generators, `defineContentSchema`, sim partition | `packages/content/src/{generate,schema,compile}/` | Built (M1.3, M2.2) |
| `replayGolden`, cross-engine runner | `packages/testing/src/sim/` | Built (M2.3) |
| `Files` and `ProcessRunner` Effect services | `packages/node` | Built (M1.1) |
| Fake Ruken host for demos | `examples/demo-host` | Built (#14) |
| Playwright projects `base-2d` (Pixel 7) and `base-2d-compact` (780×270), and `demos` | root `playwright.config.ts` | Built; M3 adds projects through ship |

Nothing of `render-pixi`, `render-pixi3d`, `post-retro`, `pipelines`, `base-25d`, `base-3d` or spike S7 exists. `pixi.js` is pinned at 8.21.0 (`docs/versions.md`); `@pixi/3d` 0.1.0-beta.2 requires `pixi.js ^8.22.0`.

## 3. Tasks and lanes

| Task | Lane | Owns (folders) | Depends on | Runner needs |
|---|---|---|---|---|
| M3.1 Spike S7: `@pixi/3d` under Ruken's CSP | render3d | `spikes/s7-pixi3d/`, `docs/spikes/s7-pixi3d.md` | M1.7a | **S7a local** (CSP, API surface, bundle bytes, SwiftShader capture, LUT cost); **S7b runner** (FPS on the phone profiles on the GPU runner, WebGPU path); Owner on a real phone |
| M3.2 Pins: `pixi.js` 8.22.0, the `@pixi/3d` fetch | ship (the `vendor/pixi-3d/` fetch script by agreement with integration, which owns `vendor/`) | `docs/versions.md`, `tooling/versions/`, root config, `vendor/pixi-3d/` (git-ignored tarball, committed README and fetch-and-verify script, §5.2), the root `pnpm:devPreinstall` hook. The base-2d and bodies-2d `pixi.js` pins go through the base-2d thread after #22 | — | Local only. The tarball is fetched, never committed (§15 Q6); CI needs read access to The Last Light from W3 (§9.3) |
| M1.7a `render-pixi` foundation | render3d (by agreement with the runtime lane, which has not started) | `packages/render-pixi/` (only the files in §5.1) | M3.2 | Local unit; one Chromium renderer test (SwiftShader, local) |
| M3.3 `post-retro` | post | `packages/post-retro/`, `examples/post-retro/` | M1.7a | Local unit and Chromium renderer tests; **runner**: WebGL2 vs WebGPU pixel parity on the GPU runner |
| M3.4 `render-pixi3d` | render3d | `packages/render-pixi3d/`, `examples/render-pixi3d/` | M1.7a, M3.1 S7a | Local unit (camera, lighting, assets are pure); Chromium renderer tests (SwiftShader, local); **runner**: GPU capture and FPS |
| M3.5 `pipelines` platform | pipelines | `packages/pipelines/` (TypeScript), `examples/pipelines/` | — | Local only (Node; no network, fake providers) |
| M3.6 2.5D character pipeline | pipelines | `packages/pipelines/src/character/`, `packages/pipelines/python/` | M3.5; the `characters` schema (§5.3) | Local unit with fake providers (needs Python 3, numpy, Pillow, Chromium); the **live run for Wick** is paid and Owner-gated, not a runner job |
| M3.7 Props pipeline | pipelines | `packages/pipelines/src/props/`, `packages/pipelines/python/` | M3.5; `LLP1`/`.bin` contract (§5.2) | Local unit (adds `pymeshlab`); live props run is paid and Owner-gated |
| M3.8 `base-25d` | integration | `examples/base-25d/` | M1.7a, M3.3, M3.4, Figma design (§8) | Local unit and the sim golden; **cloud parity** (Chromium, WebKit, Firefox in a container, `docs/cloud-parity.md`); **runner**: e2e journeys and FPS |
| M3.9a 3D character controller | sim | `packages/physics/src/` (an additive `characterController3d` API and its tests) | — | Local unit; **cloud parity** (four engines, like the rest of `physics`) |
| M3.9 `base-3d` | integration | `examples/base-3d/` | M1.7a, M3.4, M3.9a | As M3.8 |
| M3.10 `physics/bodies-3d` | sim | `examples/physics/bodies-3d/` | M3.9 | Local unit, cloud parity golden; **runner** e2e |
| M3.12 Browser-safe content entry | content | `packages/content/`: a `./schema` export (`defineContentSchema`, `contentRef`, `localized`, `DEFAULT_PALETTE`, `ENDESGA_64` and their types) whose module graph has no `node:` import; `post-retro` and `render-pixi3d` switch to it before their W2 PRs (fallback: each extension's schemas on its own `./content` subpath, base-2d's pattern) | — | Local unit; one Chromium import test (LB). Found in Q2: the root entry imports `node:crypto` and `node:fs`, so a browser import of `post-retro`, published in W2, fails (audit re-review R1) |
| M3.13 Look parity (Owner, 23:02–23:13Z; §1, §11) | integration (the art in each base), pipelines (the `style` validator) | `examples/base-25d/src/art/`, `examples/base-3d/src/art/`, `packages/pipelines/src/validators/style.ts` and `python/style_metrics.py`. base-2d's art reaches the bases through an `./art` export made by the base-2d thread, as `./screens` is | M3.3, M3.4 R4, H0 v2 approved | Local unit and Chromium renders (LB); Owner look gates A-G1 (base-25d) and A-G2 (base-3d) on screenshots beside base-2d's |
| M3.11 M3 exit | integration | numbered docs, `examples/README.md`, gallery | all | The last merge wave and the GPU claim (§9.3); Owner gates |

Lanes run in parallel: **render3d** (S7, M1.7a, M3.4), **post** (M3.3), **pipelines** (M3.5–M3.7), **sim** (M3.9a, then M3.10), **content** (M3.12, in W1) and, once their packages exist, **integration** (M3.8, M3.9). The pipelines lane depends on nothing else in M3 and starts first. The new lanes and the M1.7a carve-out from the runtime lane's `packages/render-pixi/` go into [04 How we build](../../04-how-we-build.md#lanes-2026-10-11)'s lane table.

**Edits to `examples/base-2d`** (the M3.2 pin, M1.7a's `no-eval` swap, B1's `./screens` and touch-button exports, M3.13's `./art` export, the `chain-2d` demo's needs) belong to the base-2d thread, which is changing base-2d through #22 and the `startGame` options PR. M3 lanes send that thread the change as a patch, applied after #22; they do not commit to `examples/base-2d` on their own branches.

## 4. Ownership

| State or artifact | Owner | Writers |
|---|---|---|
| Renderer init, the canvas, the framebuffer scale, the active backend name | `render-pixi` (`initRenderer`) | only `initRenderer`; games read `renderer.backend` |
| The 3D scene graph (`View3D`, camera, meshes, billboards) | `render-pixi3d` (`createStage3D`) | the stage, from `RenderDelta` and from the game's dressing calls at load |
| Gameplay positions of the player and bodies | the sim (`automata-sim`, `physics3d`) | sim systems only; the renderer reads `RenderDelta` and never writes back (law 4) |
| Camera zone selection and orbit step | `render-pixi3d` camera rig (presentation state) | the rig, from the player's rendered position and input commands `orbit-left`/`orbit-right` routed by the game; never the sim |
| Lamp levels at runtime (flicker, carried lamp) | the game's presentation code, through `stage.setLampLevel(id, level)` | the game; content declares the lamps |
| Post chain settings | content kind `post` (`post-retro`); a game's settings screen may override `enabled` per pass at runtime | content compile; settings (M4 decides the UI) |
| Palette | content (`palette`, M1.3) | content compile |
| Character atlases and their manifest | content kind `characters` (`render-pixi3d` defines the schema); files under the game's `public/art/` | only the character pipeline's `install` stage (generated files, guard-protected) |
| Props (`.pack`) and their manifest | content kind `props` (`render-pixi3d` schema); files under `public/models/` | only the props pipeline's `install` stage |
| Pipeline specs (`character.json`, `props.json`) | the game, under `pipelines/<pipeline>/<target>/` | people and agents (not generated) |
| Stage records (`.stage.json`), gate records (`gates.json`) | `pipelines` runner | runner only; gates decided by the Owner (CLI, workflow or MCP elicitation) |
| Audit log (`pipelines/audit.jsonl`) | `pipelines` runner | runner only, append-only; the guard blocks every agent write, move and delete, because the project spend cap is summed from it |
| `pipelines.config.json` (budgets, generated globs, locked values, providers) | the game's Owner | the Owner; the guard blocks agent edits. The first copy (for `examples/base-25d`) is written in a PR the Owner approves before the guard is installed there |
| `examples/base-2d` | the base-2d thread (integration) | that thread; M3 lanes send it patches (§3) |
| The 3D character controller and the world it moves in | `physics` (M3.9a) | `physics` systems only; base-3d sends commands |

## 5. Contracts this milestone freezes

### 5.1 `@mcthaydt/automata-render-pixi` foundation (M1.7a), core

```ts
// ./no-eval: imported first by every game (side effects only)
import 'pixi.js/unsafe-eval'; config({ jitless: true }) // from zod

export type Backend = 'webgl2' | 'webgpu'   // M1 shared contracts §3; Pixi's renderer.name 'webgl' maps to 'webgl2' where it is read
export interface InitRendererOptions {
  host: HTMLElement
  /** Default 'webgl' (WebGL2). 'webgpu' tries WebGPU once, then falls back to WebGL2 once. */
  prefer?: Backend
  /** Pixel framebuffer cap in device pixels, e.g. { width: 640, height: 480 }; omitted = full resolution. */
  framebuffer?: { width: number; height: number }
  background?: number
}
export interface RendererHandle {
  readonly app: Application
  readonly backend: Backend          // also written to canvas.dataset.renderer ('webgl2' or 'webgpu')
  resize(): void                      // re-applies the framebuffer cap
  destroy(): void
}
export function initRenderer(options: InitRendererOptions): Promise<RendererHandle> // throws RendererUnavailable
export class RendererUnavailable extends Error { readonly tried: readonly Backend[] }

// filters
export const FILTER_VERTEX: string; export const WGSL_FILTER_HEADER: string
export function filterPrograms(name: string, glsl: string, wgsl: string): { glProgram: GlProgram; gpuProgram: GpuProgram }
```

- Behaviour from The Last Light `stage.ts:369-387` (try the preference, destroy and retry WebGL once, `dataset.renderer`, `resolution = min(devicePixelRatio, 2)`, `antialias: false`, the framebuffer cap via `renderer.resize(w, h, min(1, capW/w, capH/h))`) with three changes: the default preference is WebGL2 (ADR 0002); `?renderer=` is read by the game, not by the package (no URL reads in library code); and the depth-stencil texture's pixel size is rounded like the colour texture's. S7a found that Pixi 8.22 leaves it fractional at a fractional resolution (the framebuffer cap gives 480/839 on a Pixel 7), WebGL truncates it, the framebuffer is incomplete and every frame with a filter draws black (`docs/spikes/s7-pixi3d.md`).
- `filterPrograms` and the two shared strings are The Last Light `filter-programs.ts` (42 lines) unchanged, including its leading `name` argument (the `GlProgram` name), with S4's rule (pixel position from the vertex stage).
- **Packaging:** `render-pixi` is published, so after #19 its PRs carry changesets and ship's build and publish fields. `pixi.js` is a caret peer with the floor at the dev pin (`^8.22.0`) and an exact dev dependency (the standing rule for published packages).
- Not in M1.7a: `RenderDelta` interpolation, letterbox, canvas resolution policy, 2D sprite layers. They stay M1.7.
- Failure: `RendererUnavailable` maps to the boot program's renderer failure (`BootError`, M1 shared contracts) and to base-2d's existing "This device can't run the game." state.

### 5.2 `@mcthaydt/automata-render-pixi3d` (extension, unpublished, D-1)

`private: true`, pinned by a test that fails if the flag is ever dropped (after #19 it is the only thing keeping the package out of a release).

**`./no-eval` (S7a).** Every game that bundles `@pixi/3d` imports `@mcthaydt/automata-render-pixi3d/no-eval` right after `render-pixi/no-eval`. `@pixi/3d` calls no `eval` itself, but it adds four uniform parsers at import (Matrix4, Matrix3, and vec3 from xyz or rgb) that exist only as generated-code source; `pixi.js/unsafe-eval` has no sync function for them, so the first 3D draw throws `functionMap[i] is not a function`. The entry registers those four functions (ported from `spikes/s7-pixi3d/src/pixi3d-no-eval.ts`, no tarball patch). Its uniform-buffer half (the WebGPU path) is unproven until S7b. The gap goes to the beta through the Owner.

**Getting `@pixi/3d` (§15 Q6).** The beta tarball is never committed to AF. `vendor/pixi-3d/` holds a README (version, source commit, SHA-256) and `fetch.mjs`; the tarball itself is git-ignored. `fetch.mjs` takes the file from `PIXI3D_TARBALL` (a path) or from The Last Light's private repo at the pinned commit with the caller's own git access, and writes it only when its SHA-256 equals the README's; a mismatch always exits 1. `@pixi/3d` is an *optional* dependency of the packages that bundle it (`render-pixi3d`, the S7 spike, base-25d, base-3d), so `pnpm install --frozen-lockfile` still works without the file: pnpm skips a missing optional tarball, while a missing regular one fails the whole install (checked with pnpm 10, 2026-10-11). That keeps AF installable where the beta is not available, such as a game's CI installing AF into `.af` (`game-ci.yml`). The root `pnpm:devPreinstall` hook runs `fetch.mjs` and carries on with one notice when no source is reachable. AF's CI jobs run `fetch.mjs --required` first from W3, when the first code that imports `@pixi/3d` merges; that step is the real gate, never the tarball's absence (a machine whose pnpm store already holds the package installs it without the file, which is harmless because the lockfile's integrity pins the same bytes). CI reads The Last Light with a fine-grained read-only token (Contents: read on that one repo), stored as an Actions secret and never echoed; `fetch.mjs` passes credentials outside the URL and never logs a URL that carries them. Code that imports `@pixi/3d` fails to typecheck and to load without the file; the pure modules (camera, lighting, assets) never import it.

Until M1.5 builds `defineExtension`, the package exports its content schemas (`render3dContent: ContentSchemaDef[]`) and its functions plainly; the wrapping lands with M1.5 (audit B3).

R4 found that the first draft of `Stage3DOptions` had no way to pass in the lighting: lamps, ambient, key, fill, bounce, or which walls block light. So `kit.box` could not be lit, and `setLampLevel` had no lamps. The options now take the scene's whole `look3d` entry, which already carries the fog, so the separate `fog` option is gone. They also take `isBlocked`. The M3 thread ruled this as spec owner at 23:33Z. It is additive to everything built so far. `CharacterArt` (the colour and normal textures with R3's `AtlasLayout`) and `LitSprite` take their exact shape in R4 and are recorded there.

```ts
export interface Stage3DOptions {
  renderer: RendererHandle            // from render-pixi
  camera?: { lensMm?: number /* 50 */; tiltDeg?: number /* 30 */; near?: number /* 0.2 */; far?: number /* 90 */ }
  look?: Look3d                       // the scene's parsed 'look3d' entry (§5.3): lamps, ambient, key, fill, bounce, fog, outline; omitted = ambient 1, no lamps, no fog
  isBlocked?: BlockedFn               // walls between a lamp or bounce pool and a point; default none
  post?: readonly Filter[]            // from post-retro; set on the View3D
}
export type AssetLoader = (path: string) => Promise<Uint8Array>   // a path inside the build; the bases fetch from their own origin
export type Object3DHandle = Container3D
export interface Stage3D {
  readonly view: View3D
  readonly kit: Kit                   // primitives added at load
  readonly camera: CameraRig
  readonly lighting: VertexLighting
  apply(delta: RenderDelta, bindings: RenderBindings): void   // after each sim step
  frame(dt: number): void             // per render frame: camera ease, lit sprites, fog drift
  setPost(filters: readonly Filter[]): void
  destroy(): void
}
export function createStage3D(options: Stage3DOptions): Stage3D

/** How rendered components become scene objects; the game supplies one per component it renders. */
export interface RenderBinding { readonly component: string; create(row: RenderRow): Object3DHandle; update(handle: Object3DHandle, row: RenderRow): void; remove(handle: Object3DHandle): void }
export type RenderBindings = readonly RenderBinding[]

export interface Kit {
  box(spec: BoxSpec): Mesh3D                    // lit by vertex lighting
  flat(spec: FlatSpec): Mesh3D                  // floors, walls, decals
  billboard(spec: BillboardSpec): Sprite3D      // 'cylindrical' | 'spherical' | 'none'
  litSprite(art: CharacterArt): LitSprite       // 8 directions × walk frames, normal-mapped
  prop(pack: PackMesh, place: PropPlacement): Mesh3D
  pick(target: Container3D, onTap: (point: Vec3) => void): void
}

// Camera
export interface CameraZone {
  readonly id: string
  readonly look: Vec3
  readonly distance: number
  readonly x?: number
  contains(p: Vec3): boolean
  /** Hysteresis: may the camera switch into this zone from `from`? Default true. */
  enter?(p: Vec3, from: string): boolean
  readonly follow?: number            // 0..1 sideways follow
  readonly depthFollow?: { rate: number; about: number }   // follow along z, as the clinic hall zone needs (a 0..1 number cannot reproduce it)
}
export interface CameraRig { setZones(zones: readonly CameraZone[]): void; orbit(step: -1 | 1): void; target(p: Vec3): void; readonly zone: string; readonly reducedMotion: boolean }
export function zoneShot(zone: CameraZone, tiltDeg: number, azimuth: number): { position: Vec3; look: Vec3 }  // pure
export function lensFov(lensMm: number): number   // degrees, 2·atan(12/lens)

// Lighting (no real-time lights)
export interface Lamp { id: string; at: Vec3; color: number; range: number; peak: number }
export interface VertexLighting { bake(mesh: Mesh3D, occlusion?: OcclusionFn): void; setLampLevel(id: string, level: number): void; setCarried(light: CarriedLight | null): void; update(): void /* 30 Hz */ ; lightAt(p: Vec3): Rgb }
export type OcclusionFn = (p: Vec3, n: Vec3) => number   // 0..1 ambient occlusion; supplied by the game (sectors in M6); default none
export type BlockedFn = (from: Vec3, to: Vec3) => boolean // walls between a lamp or bounce pool and a point; default none
export function stepLight(v: number): number; export const LIGHT_STEP: number
export function shadeFrame(/* as The Last Light sprite-light.ts:19, plus */ outline: Rgb): void  // pure, CPU
export function createShadeCache(maxEntries: number): ShadeCache   // keyed by frame index and quantized lights

// Fog and mist
export interface FogSettings { color: number; near: number; far: number; mist?: { count: number; size: number } }  // near and far in metres from the camera's focus; negative is in front of it (The Last Light's haze starts at −5)
export function createFogVolume(view: View3D, settings: FogSettings, seed: number): FogVolume  // mist positions are seeded, never Math.random

// Assets
export function parsePack(bytes: Uint8Array): PackMesh        // "LLP1" format in a `.bin` file, below
export function parseGlb(bytes: Uint8Array): GlbMesh
export function describeCharacterAtlas(entry: CharacterManifestEntry, size: { color: Size; normal: Size }): AtlasLayout  // pure: frame rectangles, anchorY, metres per pixel; throws AtlasError (R3)
export function loadCharacter(entry: CharacterManifestEntry, load: AssetLoader): Promise<CharacterArt>          // textures from the layout (R4)
export function directionRow(direction: Direction8, azimuthStep: number): number                              // integer table, no sin/cos
export type Direction8 = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
```

- **Mesh format "LLP1", in a file named `<id>.bin`** (frozen; producer: props pipeline; reader: `parsePack`). The Last Light names these `.pack`, but Ruken's build validation refuses that extension (RukenApp `packages/validation/src/content-types.ts:10-50` lists `glb` and `bin`, at `b30d31b` and `511e699`), so AF freezes `.bin` now (audit S5). The bytes are from The Last Light `scripts/pack-models.py:24-26` and `src/render/glb.ts:44-62`: magic `LLP1`; `uint32` vertex count, index count, PNG length; bounds min and max (6 × `float32`); UV bounds (4 × `float32`); positions `uint16` × 3 quantized across the bounds; normals `int8` × 3; UVs `uint16` × 2; indices `uint16`; then the PNG texture. Little-endian. At most 65 535 vertices. Any change is a new magic (`LLP2`), never an edit.
- **Character atlas** (frozen; producer: character pipeline; reader: `loadCharacter`), from The Last Light `src/game/contracts/character.ts:8-50`: 8 rows (directions) × 4 columns (walk frames) of `cell` pixels; the normal atlas has the identical layout and encodes red = right, green = down, blue = toward camera; anchor `1 − feet / cell[1]`; `metres / cell[1]` metres per pixel; optional `actions` with up to 4 frames each, their own `cell` and `feet`. Direction from facing and camera azimuth: The Last Light `src/game/directions.ts:11-13`.
- Loading: assets load through an injected `AssetLoader` (the runtime's loader in M1.5; `fetch` from the build's own origin in the bases), not through `import.meta.glob` inlining. The Last Light inlines packs because its private host blocks `fetch()`; Ruken's game CSP has `connect-src 'self'` (RukenApp `packages/manifest` `headers.ts:88`), so `fetch` from the build's origin works.
- **Pixi-free roots:** `base-25d` and `base-3d` follow base-2d's rule (`examples/base-2d/src/index.ts:1-2`): the package root is free of `pixi.js` and `@pixi/3d`, the game is on `./game` and the renderer on `./render`.
- Left behind in The Last Light (extraction map §3): the figures and roles in `stage.ts` `load()`, `look.ts` values, `grey.ts`, `showcase.ts` (clinic text), `dressing.ts` (door switches and vents are its rules), `sector-mesh.ts` (M6 `sectors`), `assets.ts`'s named textures and signs, the pursuit hooks, cutaways (M6).
- `indirectTint` and `occlusion` read the game's sectors and boxes (`indirect-light.ts:3`, `occlusion.ts`); AF takes the math and replaces the world reads with the injected `OcclusionFn` and a list of authored bounce pools in content.

### 5.3 Content kinds added in M3

| Kind | Schema owner | Shape (Zod, abridged) | Sim partition |
|---|---|---|---|
| `characters` | `render-pixi3d` | `{ atlas, normals, cell: [w, h], metres, feet, stepRate, height, actions? }` per id (above) | out (presentation) |
| `props` | `render-pixi3d` | `{ pack: '<id>.bin', scale, yaw (degrees), footprint: [w, d] }` per id (the field keeps the format's name; a `.pack` path is a compile error that says Ruken refuses it) | out |
| `look3d` | `render-pixi3d` | `{ lamps: { id, at, color: 0xRRGGBB, range, peak }[], ambient: { level, tint }, key: { strength }, fill?: { level, tint }, bounce: { at, radius, color }[] (each adds color · exp(−(d/radius)²)), fog?: FogSettings, outline?: 0xRRGGBB }` per scene; a parsed entry is the stage's `look` as is. `outline` is the lit sprites' one-texel outline (base-2d draws coloured outlines); omitted, none is drawn | out |
| `post` | `post-retro` | `{ passes: PassConfig[] }` (§5.4) | out |
| `room25d` | `base-25d` (example only) | `{ size: [w, d], height, walls, props: { id, at, yaw }[], zones, spawn }` | **in** (walls gate movement) |

The bases' `move` command carries a world-space `heading` (an integer 0–31, steps of 11.25°) and a `speed` (`walk` or `run`), never a float angle. The sim turns it into a step through a constant table of 32 unit vectors (audit S9). The input layer rounds the stick's angle plus the camera's azimuth to the nearest heading; keys give the 8 headings that are multiples of 4, and Shift runs. Why 32: both bases use an analog stick (Owner, 23:02Z), and 32 steps are finer than a thumb can aim on the stick's 40 px travel (neighbouring headings are about 8 px apart at the rim), while replays stay integers.

All are registered with `defineContentSchema` (M2.2) in `*.content.ts` files (the style checker's role for `defineContentSchema` results). `characters` and `props` entries are written only by the pipelines' `install` stages and listed as generated in the game's `pipelines.config.json`.

### 5.4 `@mcthaydt/automata-post-retro` (extension)

```ts
export type PassConfig =
  | { pass: 'retro'; enabled?: boolean; lcdSnap: boolean; cell: number; dither: boolean; ditherStrength: number; palette: boolean; levels: 32 | 64; grade: GradeConfig }
  | { pass: 'bloom'; enabled?: boolean; intensity: number; threshold: number; warmThreshold: number; radius: number }
  | { pass: 'lcd-panel'; enabled?: boolean; pitch: number; scanlines: number; aberration: number; glow: number; brightness: number; vignette: number }
export interface GradeConfig { desaturate: number; tint: number; crush: number; vignette: number; lift: number; grain: number; grainFps: number }

export function paletteLut(colors: readonly string[], levels: 32 | 64): LutImage   // pure; nearest color in OKLab
export function createPostChain(passes: readonly PassConfig[], context: { lut: LutImage; time: () => number }): PostChain
export interface PostChain { readonly filters: readonly Filter[]; setEnabled(pass: PassConfig['pass'], on: boolean): void; destroy(): void }
export function bayer8(x: number, y: number): number
export function derivePitch(cellSize: number, minPitch: number): { cells: number; cyclesPerPixel: number; fade: number }  // The Last Light lcd-panel.ts:63, unchanged
export const postContent: ContentSchemaDef   // the `post` kind, exported plainly until M1.5's defineExtension
```

- Passes and order from The Last Light `stage.ts:393-401`: retro (`retro-filter.ts`, 172 lines: LCD cell snap, Bayer 8×8, palette LUT stored as 8×8 blue slices, grade, grain), bloom (`bloom-filter.ts`, 107), LCD panel (`lcd-panel.ts`, 233, the MIT "lcd-perfect" port, licence header kept). The "dread" blur is game code and stays behind.
- **LUT layout** (frozen for both sizes): blue picks one of `levels` slices of `levels × levels` cells (red across, green down), 8 slices across; 64 levels is 512×512 (The Last Light `palette.ts:3`), 32 levels is 256×128. A 0–1 color reads cell `round(c · (levels − 1))` per channel; ties go to the earlier palette color. Measured in Node with 64 colors: 32 levels about 64 ms, 64 levels about 390 ms (Q1).
- **Published, and free of `@pixi/3d`:** `post-retro` filters any Pixi `Container`, and `View3D` is one, so it never imports `@pixi/3d`, not even for types; a dependency test pins that. After #19 its PRs carry changesets; `pixi.js` is a caret peer (`^8.22.0`).
- Every pass is a GLSL + WGSL pair through `filterPrograms`, uses `resolution: 'inherit'` and `antialias: 'off'` (point sampling), and runs the same on a 2D `Container` and on a `View3D`.
- `time` is injected (no wall clock in library code); grain advances at `grainFps`.
- Grade numbers come from content; AF's default `post.toml` uses Endesga 64 and The Last Light's grade values only as a starting point, re-tuned for the Emberwick look with the Owner (art direction).

### 5.5 `@mcthaydt/automata-pipelines` (dev extension, never in a game bundle)

```ts
export interface PipelineConfig {          // pipelines.config.json, Zod-validated; Owner-only file
  budget: Partial<Record<CostKind, { project: number; run: number }>>   // CostKind: 'images' | 'meshCredits' | 'visionCalls'; a kind with no entry cannot be spent ('visionCalls' is reserved for the vision pipeline, which stays in The Last Light until a later spec)
  generated: string[]                      // globs the guard protects
  locked: Record<string, string | number | boolean>   // values the game's validators read
  providers: { image: { model: string; fallback?: string }; mesh: { kind: 'meshy' } }
  paths: { specs: string; audit: string; art: string; models: string }
}
export interface Stage<Spec> {
  id: string
  gate?: string                            // e.g. 'G1'; a gated stage stops the run with exit 3
  paid?: { kind: CostKind; estimate(spec: Spec): number }
  outputs(spec: Spec, target: string): readonly string[]   // path policy: writing anything else fails the stage
  run(ctx: StageContext<Spec>): Effect.Effect<StageResult, StageError, Files | ProcessRunner | ImageProvider | MeshProvider>
}
export function definePipeline<Spec>(def: { id: string; spec: z.ZodType<Spec>; stages: readonly Stage<Spec>[]; check?: (target: string) => Effect.Effect<CheckResult> }): PipelineDef<Spec>

export type ExitCode = 0 /* done */ | 1 /* failed */ | 2 /* not implemented */ | 3 /* at a gate */ | 4 /* refused */
export interface CliResult { pipeline: string; target: string; exit: ExitCode; stages: StageRecord[]; gate?: GateRecord; cost?: Cost; message: string }
export interface StageRecord { id: string; status: 'done' | 'skipped' | 'failed'; outputs: string[]; inputsHash: string; cost?: Cost; at: string }
export interface GateRecord { id: string; stage: string; decision: 'pending' | 'approved' | 'rejected'; files: string[]; requestedAt?: string; decidedAt?: string; by?: 'owner'; note?: string }
export interface AuditEntry { at: string; via: 'cli' | 'mcp' | 'workflow'; tool: string; args: Record<string, unknown>; ok: boolean; summary: string; ms: number; head: string; cost?: Cost }

// Providers (Effect services; live layers read keys from env; test layers are fakes)
export class ImageProvider extends Context.Tag('ImageProvider')<ImageProvider, { generate(req: ImageRequest): Effect.Effect<Uint8Array, ProviderError>; edit(req: ImageEditRequest): Effect.Effect<Uint8Array, ProviderError> }>() {}
export class MeshProvider extends Context.Tag('MeshProvider')<MeshProvider, { imageTo3d(req: MeshRequest): Effect.Effect<MeshJob, ProviderError>; rig(job: MeshJob): Effect.Effect<MeshJob, ProviderError>; download(job: MeshJob): Effect.Effect<Uint8Array, ProviderError>; balance(): Effect.Effect<number, ProviderError> }>() {}

// Guard
export function defineValidator(def: { id: string; check(ctx: ValidatorContext): Effect.Effect<readonly Finding[]> }): Validator
export function decideToolCall(call: ToolCall, config: PipelineConfig, rules: GuardRules): { allow: boolean; reason?: string }  // pure; the hook is a thin stdin/exit-code wrapper
```

- **CLI** `automata-pipe <pipeline> <command> [target] [gate] [--paid] [--budget n] [--from|--to|--only stage] [--force] [--note text] [--json]`, commands `status`, `estimate`, `run`, `approve`, `reject`, `restore`, `check`, `request`, `list`. Exit codes and `--json` as The Last Light `scripts/pipe.mjs:8, 108-147`.
- **MCP server** `automata-pipelines-mcp` (stdio; `@modelcontextprotocol/sdk`): the generic tools `pipeline_list`, `pipeline_status`, `pipeline_estimate`, `pipeline_run`, `pipeline_check`, `pipeline_request_review`, `pipeline_review_status`, `guard_check`, from `scripts/mcp/tools.ts` (452 lines). A game adds tools through `definePipeline` only. **There is no approve tool.** `pipeline_estimate` returns an HMAC token over pipeline, target, stages and input hashes, valid 30 minutes, signed with a per-process secret (`randomBytes(32)` at server start, as The Last Light `scripts/mcp/tools.ts:5, 91`), so only the running server can mint one; `pipeline_run` with `--paid` refuses without a matching token, refuses a paid kind with no budget, and checks the run and project caps against the audit log. `pipeline_request_review` records the request; where the Owner attends the session it also uses MCP elicitation, so the Owner answers in a form the model never sees.
- **Guard hook** `automata-pipelines-guard` (a Claude Code PreToolUse hook; exit 2 blocks): blocks paid-API hosts and key variable names in shell commands, env dumps, `approve`/`reject`, `--paid` outside MCP, and writes, moves and deletes of `gates.json`, `.stage.json`, `pipelines.config.json`, the audit log and the `generated` globs. Rules from The Last Light `scripts/guard/pre-tool.mjs:20, 35, 42-53`, with hosts and key names from the providers, not hard-coded.
- **Validators** shipped by AF: `palette` (every opaque pixel of an installed atlas or texture is a palette color; the palette from content), `generated` (generated files match their stage record's hash), `keys` (no key-shaped strings in the repo), `size` (build artifact under the game's `locked.artifactMB`), `atlas-alpha`. The Last Light's camera, picture, lighting, props and look validators read its own files and stay in the game, registered through `defineValidator` when it adopts AF (M8).
- **Workflow template** `templates/approve-gate.yml`: `workflow_dispatch` for the repository owner only; runs `automata-pipe <pipeline> approve|reject` and commits only `gates.json` (The Last Light `.github/workflows/approve-gate.yml`). The pipeline choice list is generated from the registered pipelines, so it cannot drift (it omits six of The Last Light's pipelines today).
- **Audit log:** the runner appends one `AuditEntry` per CLI run, MCP call and workflow decision (`via`), with cost when money was spent. Keys and key-shaped strings are redacted from every record and every returned message (`tools.ts:52`). **Fail closed:** when stage records show paid outputs but the log is missing or records less spend than they do, every paid stage is refused (exit 4) until the Owner restores the log.
- **How the Owner decides a gate in this project** (audit S7): the Owner does not watch the cloud sessions that run the MCP server, so elicitation is the secondary path. The primary path: the thread sends the review files to the coordinator, the hub relays them, and the Owner runs `approve-gate.yml` (an af-linux run, counted in the merge-wave claims, §9.3) or `automata-pipe … approve` in their own terminal.
- **Templates are for games only:** `templates/claude-settings.json` is never installed in AF itself, where its provider-host rules would block the Designer role's image calls.
- `pipelines` stays `private: true` until a later decision, pinned by the same kind of test as `render-pixi3d`.

### 5.6 Pipelines in M3

**2.5D character** (`character`), from The Last Light `scripts/pipeline/character.py` (669 lines) and `.claude/skills/make-character`:

| Stage | Does | Paid | Gate |
|---|---|---|---|
| `look` | Image from the spec's look text and the game's house prompt (content), Endesga 64 named in the prompt | 1 image | **G1** |
| `turnaround` | Image edit to a three-view turnaround | 1 image | — |
| `views` | Cuts the turnaround into front, side, back | — | — |
| `model` | Meshy image-to-3D | ~30 credits | **G3** |
| `rig` | Meshy auto-rig and walk | ~8 credits | — |
| `flatten` | `flatten-texture.py` | — | — |
| `render` | `render-sprites.mjs`: headless Chromium (SwiftShader) renders 8 directions × 4 walk frames plus normal passes | — | — |
| `pixelate` | `pixelate-sheet.py` | — | — |
| `detail` | Image edit per row (8) for the pixel detail pass | 8 images | **G5** |
| `polish` | `polish-sprites.py`, quantized to the game's palette (not DUEL) | — | — |
| `normals` | `normal-maps.py` | — | — |
| `install` | Copies atlas and normals to the game's art folder and writes the `characters` content entry | — | **G6** |

The `actions`/`pose` stages and G7 (cutscene poses) wait for `cutscenes` (M6). Hard-coded values in `character.py` (36.9 px per metre at lines 92–97, the `HAND_MADE` figures at line 105, the horror-game prompt at lines 505–513) become spec and content fields. Estimated cost for one new figure: about 10 images and 38 Meshy credits (The Last Light make-character skill).

**Props** (`props`), from `scripts/pipeline/props.py` (347 lines): `list` (free, **E2**) → `sheet` (image per sheet, **E3**) → `crop` → `model` (Meshy, ~30 credits per item, **E4**) → `flatten` (`--colours 12 --size 256`) → `floaters` → `pack` (`pack-models.py`, pymeshlab, face caps 2 400 large and 1 200 small, writing `<id>.bin`) → `install` (copies the `.bin` and writes the `props` content entry). The E1/E1a reference stage is the reference pipeline's and stays behind; `props.json` names its source image instead.

The Python scripts move to `packages/pipelines/python/` with their behaviour unchanged except: palette from an argument (no DUEL constants), no game paths, and `requirements.txt` pinning numpy, Pillow and pymeshlab exactly (`==`), with a Python table in `docs/versions.md` (none exists today). Stage files are named `character-pipeline.ts` and `props-pipeline.ts`: the style checker has no `pipeline` role.

## 6. Data and lifecycle flow

**2.5D boot (base-25d)** follows master spec §7: no-eval imports (`render-pixi/no-eval`, then `render-pixi3d/no-eval`) → `Hosting` (until M1.5, base-2d's `Ruken.init` stand-in) → content (room, look3d, characters, props, post) → assets (atlas, normals, packs, through the loader with byte progress) → `initRenderer` (WebGL2) → `createStage3D` → bake vertex lighting once per static mesh → splash; gameplay renders only after `session.ready`.

**Input:** the game reads the camera rig's orbit step (presentation) and the player's stick or keys, and sends `move` with a world-space `heading` and `speed` (§5.3); the sim never sees the azimuth.

**Frame order:**
1. The app loop steps the sim at 60 Hz (fixed); each step's `RenderDelta` goes to `stage.apply` (create, update, remove objects through the game's bindings; `resync` rebuilds all bound objects).
2. Every render frame, `stage.frame(dt)`: the camera rig picks the zone containing the player's rendered position, honouring `enter`, eases position and azimuth (`min(1, dt·7)`, or snaps under reduced motion), and pulls back on narrow aspect (`scale = min(1.75, 0.85/aspect)`, follow 0.55; The Last Light `stage.ts:454-459`); lit sprites pick their frame from direction and walk phase and shade through the cache; fog drifts.
3. At 30 Hz, `lighting.update()` recombines lamp levels, carried light and baked bounce into vertex colors and sprite light lists.
4. Pixi renders the view through the post chain.

**Shutdown:** `stage.destroy()` destroys geometry, textures and filters; `RendererHandle.destroy()` the app. A game restart (Ruken: back to the launcher without a reload) runs both and leaves no WebGL context (checked by a renderer test).

**Pipeline run:**
1. An agent calls `pipeline_estimate` (or a person runs `automata-pipe character estimate wick`): stages to run, cost per kind, budget left, token.
2. `pipeline_run` with the token: the runner checks the budget, runs stages in order, records each in `.stage.json` (inputs hash, outputs, cost), refuses any write outside a stage's declared outputs, and stops at a gated stage with exit 3, writing a pending `GateRecord` with its review files.
3. `pipeline_request_review` (or the CLI `request`): the Owner sees the review files and decides through elicitation, `automata-pipe … approve G1`, or the workflow. The decision lands in `gates.json` with `by: 'owner'`.
4. The next `run` continues after the gate; a rejected gate re-runs its stage with the note.
5. `install` writes the art and the content entry; the guard then protects them; `automata-pipe character check wick` re-verifies outputs against the stage record.
6. Every step appends an `AuditEntry`.

## 7. Failure policy

| Case | Behaviour | Where |
|---|---|---|
| WebGPU preferred but unavailable | One WebGL2 retry; `backend` says which ran; a second failure throws `RendererUnavailable` → the boot failure state | M1.7a |
| WebGL2 unavailable | `RendererUnavailable`; the page shows the device message (base-2d's existing state) | M1.7a, bases |
| `@pixi/3d` needs `eval` under Ruken's CSP | S7a fails; M3.4 does not start until the cause is fixed (Pixi's unsafe-eval shim covers it, or the beta is patched in the vendored tarball with the patch recorded). **S7a, 2026-10-11:** neither fit; `render-pixi3d/no-eval` supplies the four missing uniform sync functions (§5.2), so the scene renders under the CSP without patching the tarball | M3.1 |
| An `LLP1` `.bin` with the wrong magic, a short buffer, or > 65 535 vertices | `PackFormatError` naming the field; the prop is skipped and the load reports it (never a silent empty mesh) | M3.4 |
| A character atlas whose size is not 8 × 4 cells, or whose normal atlas differs in size | Content error at compile (`file:line:col` on the manifest) when sizes are known; at load, `AtlasError` | M3.4 |
| A content `post` pass with an unknown name or out-of-range value | Compile error | M3.3 |
| Lit-sprite shading over budget | The cache keeps the last shaded frame for an unchanged frame index and light set; measured in S7 and M3.11 | M3.4 |
| No WebGL context after restart (leak) | Renderer test fails | M1.7a |
| Paid stage without `--paid`, without a token (MCP), with no budget for its kind, or over the run or project cap | Exit 4 (refused), nothing spent, audit entry with the reason | M3.5 |
| Provider error, timeout or out of credits | Stage fails (exit 1) with the provider's message redacted; the stage record keeps any provider job id so `restore` re-downloads for free (Meshy) | M3.5–M3.7 |
| A stage writes outside its declared outputs | Stage fails, the extra file is reported (path policy G-9) | M3.5 |
| An agent tries to approve, edit `gates.json`, the audit log or a generated file, or print a key | Guard blocks with exit 2 and the reason | M3.5 |
| Audit log missing, or recording less spend than the stage records show | Every paid stage refused (exit 4) until the Owner restores it | M3.5 |
| A build that bundles `@pixi/3d` or `pipelines` is prepared for the dev host or a public gallery list | `ship prepare` fails naming the package | M3.5, M3.11 (through ship) |
| `render-pixi3d` or `pipelines` loses `private: true` | Its pin test fails | M3.4, M3.5 |
| Python or a Python package missing | The stage fails naming the missing module and the `requirements.txt` line; tests that need it are skipped with that reason, and the skip is reported as a gap, never as a pass | M3.6, M3.7 |
| An installed atlas has an off-palette pixel | `palette` validator fails `check` and `guard_check` | M3.6 |

## 8. UI inventory and responsive behaviour

M3 adds no new screens: `base-25d` and `base-3d` reuse base-2d's splash, menu, pause and end screens and its touch buttons (DOM, `examples/base-2d/src/screens/screens.ts`; the buttons are `touchButtons` on `Screens`) through a new `./screens` export from base-2d, made by the base-2d thread after #22 (§3). New UI is the in-game HUD only:

| Element | base-25d | base-3d | States |
|---|---|---|---|
| Move | Analog thumbstick, fixed bottom-left, in base-2d's button skin (Owner, 23:01–23:02Z: the joystick on both bases); keys; gamepad left stick | Same | Idle, active (walk), full tilt (run), dead zone, disabled, reduced motion |
| Orbit left and right | Two corner buttons (`CornerControls` from `ui`) in base-2d's key-cap skin, Q and E keys, gamepad shoulders | Drag outside the stick's zone, Q and E keys, gamepad right stick | Disabled while a zone has orbit locked (content) |
| Drag hint | — | A chip in base-2d's panel style until the first drag | Shown, fading, gone (at once under reduced motion) |
| Pause | Base-2d's HUD pause | Same | — |

- **Design first:** before M3.8 and M3.9 write HUD code, the Designer step lays out the HUD in Figma (a Figma connector is available to this project) at phone portrait, 780×270 and desktop, on Endesga 64 tokens, with `hostReserved` and the safe area shown; the Owner looks before code. Generated images, if any, are design input only.
- **H0 v2:** the Owner answered the first boards with "Changes" (23:01Z): the joystick on both bases, and every control held to base-2d's quality (§1). v2 draws each control in base-2d's own skin (its chunky key caps, Pixelify Sans, solid glyphs) and shows each frame beside base-2d's at the same size. HUD code waits for the Owner's approval of v2.
- Touch targets 44 px (orbit buttons are secondary), primary 48 px. The stick's knob is 60 px, base-2d's touch button, with 40 px of travel; under 20 % tilt is the dead zone, and from 80 % it runs. A touch that starts within 100 px of the stick's centre belongs to the stick; in base-3d a drag that starts anywhere else outside the controls orbits. The orbit buttons sit in the corners, outside the stick's reach; nothing overlaps `hostReserved`.
- Narrow aspect (portrait phones) is handled by the camera pull-back (§6), not by shrinking the HUD.
- Reduced motion snaps the camera instead of easing.
- Layout contracts run at every reference size through `@mcthaydt/automata-ui/testing` (renderer-free fixtures of the HUD over a fixed-size placeholder canvas), so they stay local.

## 9. Test allocation and runner needs

### 9.1 Layers

| Layer | What | Where it runs |
|---|---|---|
| Unit (Node) | `zoneShot`, `lensFov`, zone hysteresis, `stepLight`, vertex lighting math, `shadeFrame` and the cache, `parsePack`/`parseGlb` (fixtures generated by `pack-models.py` and committed), atlas manifest schema, `bayer8`, `derivePitch`, `paletteLut`, post config schema; pipelines runner, gates, budgets, token, path policy, audit, CLI, MCP (in-memory transport), guard decisions, validators, providers through fakes | **Local**, and the af-linux `checks` job later |
| Python stage tests | Each script on a tiny fixture (numpy, Pillow; pymeshlab for `pack`); `describe.skipIf` with a reported gap when absent | **Local** (Python 3 with numpy and Pillow exists in the cloud container; pymeshlab installs with pip) |
| Renderer (Chromium, SwiftShader) | `initRenderer` WebGL2 path and fallback, no context left after destroy; each post pass compiles and renders a non-black known image; `createStage3D` draws a box, a billboard and a prop; lit sprite changes with a lamp level | **Local** (Chromium SwiftShader, as base-2d's `renderer` project and The Last Light's `shoot.mjs` do) |
| Sim parity (Chromium, WebKit, Firefox) | `base-25d` and `base-3d` sim goldens and `bodies-3d` golden identical in Node and three engines (`replayGolden`) | **Cloud container** (`docs/cloud-parity.md`); af-linux `parity` when the PR leaves draft |
| GPU pixel parity | Each post pass and the base-25d frame: WebGL2 versus WebGPU within a stated tolerance on real GPU hardware | **GPU runner** |
| Browser journeys | base-25d and base-3d boot under the fake host, nothing renders before ready, no CSP violations, walk, orbit, pause; demos smoke | **Local Chromium for one focused spec**; the full matrix (Pixel 7, 780×270, desktop) on the **GPU runner**, nightly and on request |
| FPS | base-25d at ≥ 30 FPS on the S20 and iPhone 13 profiles (WebGL2; WebGPU when opted in) | **GPU runner** (S7b, M3.11); SwiftShader timings are never FPS evidence |
| Owner gates | M3 spec review; HUD design; Wick's G1, G3, G5, G6; props E2–E4; base-25d look; real-phone play | Owner |

### 9.2 Feedback workflow

`pnpm vitest run <file>` in the package first; then the package's `test` script; then `pnpm check`. Renderer tests run locally on Chromium with SwiftShader (`PLAYWRIGHT_BROWSERS_PATH` as in `docs/cloud-parity.md`). Parity runs in a cloud container. `ci.yml` runs af-linux `checks` on every pull-request event, drafts included (`ci.yml:15-20, 42-45`; only `parity` skips drafts), while a push to a non-`main` branch runs nothing. So lanes push their branches freely and open draft PRs only inside a coordinator claim (Owner, 2026-10-11, via the hub: make progress without the shared PC runners). First-attempt failures are kept in the PR. Golden updates are their own commit.

### 9.3 Runner claims: one per merge wave, then one GPU claim

af-linux work is claimed per merge wave, so lanes do not stack on unmerged branches for the whole milestone (audit B5). Each wave is one claim covering `checks` and `parity` for all of its PRs, plus any `approve-gate.yml` runs that fall in it.

| Wave | PRs | Needs before the claim |
|---|---|---|
| W1 | M3.2 (the `pixi.js` bump and the tarball fetch), M1.7a, P1–P6 and C1 (one pipelines PR), M3.12 | #19 merged (changesets); green locally |
| W2 | R1–R3, Q1–Q3, the S7a verdict, M3.9a | W1 merged; `post-retro` and `render-pixi3d` import from `@mcthaydt/automata-content/schema` |
| W3 | R4, C1–C2, D1, B1, B2 | W2 merged; H0 design approved; CI can fetch `@pixi/3d` (read access to The Last Light, §15 Q6) |
| W4 | R5, Q4, S1 | W3 merged |

The GPU work is one claim at the end (M3.11):
1. S7b FPS (base-25d and the S7 scene; WebGL2 and WebGPU; S20 and iPhone 13 profiles).
2. post-retro and base-25d WebGL2 versus WebGPU pixel parity.
3. Browser journeys for `base-25d`, `base-3d`, `render-pixi3d/*`, `post-retro/*`, `physics/bodies-3d` (Pixel 7, 780×270, desktop).
4. Evidence screenshots and a deterministic capture of base-25d for CAPTURE (`beta-only` while it bundles `@pixi/3d`).

## 10. Ruken alignment

- Ruken's game CSP has no `'unsafe-eval'` (`script-src 'self' 'wasm-unsafe-eval'`, via `@ruken/manifest` `compileHeaders`); every M3 page runs under those headers in preview and e2e, as base-2d does (`examples/base-2d/vite.config.ts:11-15, 22`). S7a showed `@pixi/3d` works there with `render-pixi3d/no-eval` on WebGL2; the WebGPU half waits for S7b.
- `ruken.toml` declares `renderer = "webgl2"` (Ruken's values: `webgl2`, `webgl`, `canvas2d`, `wasm-webgl2`); a game that opts into WebGPU still declares `webgl2`, because WebGL2 is the path every device takes.
- Size and file-type limits are Ruken's (`packages/validation`, checked by `ruken publish`); M3 quotes none. Ruken's file-type list has `glb`, `bin` and `png` and not `pack` (`content-types.ts:10-50`), so the mesh file is `.bin` (§5.2). Ruken's CSP allows `connect-src 'self'` (`headers.ts:88`).
- `pipelines` never ships in a game bundle, and no build that bundles `@pixi/3d` goes to the dev host or a public gallery list; `ship prepare` fails either (a check added by M3.5 through the ship lane).
- Requests to Ruken: none.

## 11. Demos (raylib style)

| Demo | Base | Shows | Lane |
|---|---|---|---|
| `render-pixi3d/zone-camera` | base-25d | Three zones with `enter` hysteresis, orbit steps, reduced-motion snap | render3d |
| `render-pixi3d/lit-sprites` | base-25d | Wick under two lamps and his lantern; lamp sliders; normal map on/off | render3d |
| `render-pixi3d/glb-props` | base-25d | Packs loaded through the loader, fitted and vertex-lit | render3d |
| `post-retro/chain-2d` | base-2d | The chain on base-2d's room, each pass toggled | post |
| `post-retro/chain-3d` | base-25d | The same chain on the 2.5D room | post |
| `pipelines/character-wick` | base-25d | Wick's installed atlas from the pipeline, with its gate history and audit lines | pipelines; **waits on §15 Q3** (the paid run) |
| `physics/bodies-3d` | base-3d | Rapier bodies in 3D pushed by the character | sim |

Every demo on base-25d or base-3d bundles `@pixi/3d`, so it stays out of the public gallery list and its captures are `beta-only` until the Owner clears them (§1).

Art: Endesga 64 only, Emberwick (mossy night ruins, lantern light), held to the look bar (§1). Both 3D bases get the free art pass base-2d got (M3.13):
- base-2d's stone, moss, grass, vine, mushroom and ember art as pixel textures and billboards, at base-2d's pixel size;
- its night backdrop as the sky beyond the room's open roof;
- Wick for 2.5D as an outlined, rim-lit sprite with eight facings, drawn in code as base-2d's Wick was; for 3D, a low-poly mesh built in code;
- pixel lighting on The Last Light's stepped lamp model (lantern, ember, mushrooms, moon), with bounce light and haze, retuned brighter for Emberwick;
- `post-retro` tuned so the frame reads like base-2d (Q4).

The props pipeline and the paid Wick run (§15 Q3) are upgrades on top, not the route to the bar. Provenance is in each demo's `PROVENANCE.md`; anything taken from The Last Light is listed there and stays private (§15 Q7).

## 12. Exit criteria

| # | Criterion | Evidence |
|---|---|---|
| 1 | S7 verdict recorded; D-1 confirmed or overridden by the Owner | `docs/spikes/s7-pixi3d.md`, Owner word via the coordinator |
| 2 | `base-25d` renders under Ruken's CSP on WebGL2, and on WebGPU when opted in, with no CSP violations, nothing rendered before ready | e2e log (local Chromium plus the GPU runner run) |
| 3 | `base-25d` holds ≥ 30 FPS on the S20 and iPhone 13 profiles | GPU runner FPS run (median and p5 frame time) |
| 4 | `base-25d`, `base-3d` and `bodies-3d` sim goldens identical in Node, Chromium, WebKit, Firefox | parity output (cloud container, then af-linux) |
| 5 | Wick goes through the character pipeline with G1, G3, G5 and G6 recorded by the Owner, and loads in base-25d with no hand edits; the palette validator passes | `gates.json`, audit log lines with cost, the installed content entry, a screenshot |
| 6 | One prop goes through the props pipeline with E2–E4 and loads as an `LLP1` `.bin` | same kind of evidence |
| 7 | Each post pass renders the same in WebGL2 and WebGPU within tolerance | GPU runner pixel parity |
| 8 | `pipelines` refuses: paid without token, over budget, write outside outputs, agent approve; and redacts keys | unit tests (named in the plan) |
| 9 | Every demo in §11 merged with its smoke test (`pipelines/character-wick` after §15 Q3); screenshots shown to the Owner | PRs, evidence |
| 10 | `render-pixi3d` and `pipelines` are private, pinned by tests; no build that bundles `@pixi/3d` deploys to the dev host or appears in a public gallery list | the pin tests; `ship prepare` check and its failing-case test |
| 11 | base-3d's character stops at walls and pushes bodies through `physics`' controller, identical in four engines | M3.9a parity output |
| 12 | base-25d and base-3d meet the look bar (§1): within the `style` check's bounds against base-2d's anchor, and the Owner's look gates A-G1 and A-G2 recorded | the style report, screenshots beside base-2d's at the three sizes, Owner word via the coordinator |

**Failure cases proven by tests:** WebGPU init failure falls back once; WebGL2 failure shows the device message; bad `LLP1` magic and truncation; a `.pack` path in `props` content; atlas size mismatch; unknown post pass; paid stage refused four ways; path-policy violation; guard blocks approve, key print, a generated-file edit and an audit-log edit; a short audit log refuses paid stages; a dropped `private: true` fails its pin test; missing Python module reported as a gap.

## 13. Risks

| Risk | Mitigation |
|---|---|
| `@pixi/3d` beta needs `eval`, breaks on Pixi 8.22.x, or is withdrawn | S7a first; the tarball is pinned by SHA-256; everything behind `render-pixi3d`; 2D core unaffected |
| The beta's terms ("keep the source, beta tarball and generated builds inside the beta") leak through AF's history or a deploy | Tarball out of AF git (§15 Q6); `ship prepare` refuses dev-host and public-gallery builds that bundle it; captures `beta-only` |
| CPU lit-sprite shading misses 30 FPS on phones | Shade cache; S7b measures before M3.4's lit sprites are built; GPU material as the planned fallback |
| Paid pipeline runs cost money and credits are low | Estimates and caps; one character and one prop only; the Owner approves the budget first (§15 Q3); everything else tested with fakes |
| pymeshlab is heavy and may not install on the runner image | Used only in the `pack` stage; tests skip with a reported gap; the props live run happens in a container where it installs |
| GPU runner time is scarce and shared | Everything except FPS, GPU parity and the journey matrix runs locally or in a cloud container; one claim per merge wave and one GPU claim at the end (§9.3) |
| Moving base-2d to `pixi.js` 8.22.0 changes its pixels | The base-2d thread applies the bump after #22 and re-runs base-2d's renderer test and e2e; its sim golden is unaffected |
| Extracting from a game that keeps changing (The Last Light is mid act two) | Copy from `741e595`, recorded; port its tests (`post-fx`, `fog`, `indirect-light`, `props`, `pipeline-runner`, `mcp-server`, `guard`, `character-pipeline`) as behaviour specs |

## 14. Change requests to earlier contracts

- **M1 shared contracts / M1.7:** `render-pixi` gains its foundation in M1.7a (§5.1); M1.7 keeps the rest. The runtime lane agrees through the coordinator.
- **`docs/versions.md`:** `pixi.js` 8.21.0 → 8.22.0 (one package per PR, ship lane), a Vendored table with `@pixi/3d` 0.1.0-beta.2 and its SHA-256, `@modelcontextprotocol/sdk` 1.32.1 (The Last Light's version; checked to bring no second `zod` into the lockfile), and a Python table with exact pins.
- **Root config (ship):** new packages in `pnpm test:parity` where they have browser projects; `examples/base-25d/src/sim` and `examples/base-3d/src/sim` in `pnpm boundaries`; Playwright projects `base-25d`, `base-25d-compact`, `base-3d`.
- **base-2d (the base-2d thread, after #22):** the `pixi.js` pin; `./no-eval` imports `render-pixi/no-eval`; a `./screens` export with the touch buttons.
- **04 How we build:** lane rows for render3d, post and pipelines, the sim lane's M3.9a and M3.10, and the M1.7a carve-out from runtime's `packages/render-pixi/`.
- **Extraction map:** `plaque` is dropped from `createKit` and FloorFifty's eight filters are deferred (§1), so those rows say so.
- **Changesets (after #19):** `render-pixi` and `post-retro` PRs carry one; `render-pixi3d` and `pipelines` stay private and carry none.

## 15. Open questions and Owner inputs

Answered by the coordinator on 2026-10-11 (22:03Z); the Owner's sign-off on this spec goes through the hub and is pending.

- **Q1 (D-1), decided:** `render-pixi3d` stays unpublished and out of public builds until the beta's terms allow public deployment (matches the standing `@pixi/3d` decision).
- **Q2, decided:** the render3d lane builds M1.7a in `packages/render-pixi` now.
- **Q3, held:** no paid image or Meshy spend until the coordinator relays the Owner's OK (credits are low). Until then the pipelines are built and tested with fake providers only, and the live runs (plan C3, D2) stay unchecked. The bases' look no longer waits on Q3: the art pass (M3.13) draws Wick and the room in code, as base-2d's art was, replacing the placeholder atlas and box props this answer first named (Owner, 23:02Z: 2.5D and 3D must look as good as 2D). Exit criteria 5 and 6 wait on this. Expected cost when approved: Wick about 10 images and 38 Meshy credits; one prop about 1 image and 30 credits.
- **Q4, default:** `post.toml` starts from The Last Light's pass values (`look.ts:39-44`, `lcd-panel.ts:24`) with the palette pass on Endesga 64; the Owner tunes the look at the Q4 demo screenshots (plan Q4).
- **Q5, default:** the demo names in §11 as written.
- **Q6, answered by the Owner 2026-10-11 22:19Z through the hub (audit B1): "Keep it out."** The `@pixi/3d` beta tarball stays out of AF's git history. AF fetches it from The Last Light's private repo and checks its SHA-256 (§5.2). Builds that bundle `@pixi/3d` and their captures stay private (no dev host, no gallery; captures `beta-only`) until the beta allows public use. Follow-up for the Owner, needed before W3: AF's CI needs read access to The Last Light to fetch the file: a fine-grained token with Contents: read on that one repo only, saved as an Actions secret and never echoed (audit re-review R2).
- **Q7, the Owner through the hub, 2026-10-11 23:12Z:** "the pixi project looks amazing so feel free to steal from there", corrected at 23:12:26Z: the bar is base-2d (§1); The Last Light is a source, not the target. Borrowed and retuned for Emberwick:
  - its stepped lamp lighting, with bounce light and haze;
  - its outlined, rim-lit sprites;
  - the post chain;
  - the fixed 50 mm camera;
  - the style check against an anchor, as M3.13's `style` validator.

  The hub's guardrails:
  1. Anything copied from The Last Light, and every 2.5D and 3D build or capture, stays private, like the beta tarball. It stays out of public AF git and releases until the Owner says otherwise.
  2. Its paid Meshy models may appear privately in concept frames. Reusing them in a shipped AF template needs an Owner card first.

  Settled point: guardrail 1 as worded also covers the extractions this spec already planned from The Last Light. `render-pixi3d` and `pipelines` are private packages, but `post-retro` is published to the repo's GitHub Packages after #19. Read here as: those extractions go ahead as specified, everything else from The Last Light stays private, and before AF's repo or packages go public, the Owner rules on each file that came from The Last Light. The hub confirmed this reading at 23:22Z and asked for a running provenance list in the repo: [`docs/provenance/the-last-light.md`](../../provenance/the-last-light.md) maps each file to its Last Light source at `741e595`, each PR that brings in Last Light material updates its rows, and the Owner reviews it file by file before anything goes public.
