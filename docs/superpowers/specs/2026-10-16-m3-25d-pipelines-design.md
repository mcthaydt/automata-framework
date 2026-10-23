# M3: 2.5D and pipelines (milestone spec)

> **Amendment, 2026-10-18 (Owner, via the Desk): 2.5D is dropped.** "Drop 2.5D; M3 becomes procedural-character 3D plus rigged-character 3D." **Amended again 2026-10-23 (Owner, project thread, 08:45 to 08:48 UTC):** "Cut the rigged gltf, procedural only for now", an IK rig for posing and animation, an angled Crow Country-style camera on a 24 mm lens, and the Ocarina-style action-adventure the characters are for. **A third time the same day (14:18 to 14:21 UTC):** the camera is 25° down and 5 m back with free rotation, `games/base-3d` is the base 3D game, 3D ships in AF 1.0 (free, not Plus; M3R-D20), and the look matches the 2D game's. The revised scope is the [M3 spec, revised three times](./2026-10-18-m3-3d-characters-design.md) (Owner-approved 2026-10-23); its "Owner direction" table has the words, message ids and times. This spec stays as the record of the approved 2.5D design and as the reference for the sections the revision keeps.
>
> - **Dropped:** camera zones, hysteresis and octants (§4.2's zone half); eight-direction billboards and CPU-lit sprite atlases (§4.3); `games/base-25d` (§4.6); the character pipeline's atlas stages `render`, `pixelate`, `detail`, `polish`, `normals` (§4.8); the examples `render3d-billboards`, `-camera-zones`, `-lit-sprites`; acceptance D3-a (zones), D3-b (billboard rows), B-a and B-b as written for `base-25d`; M3-D11 (`base-3d`'s static mesh character).
> - **Replaced by:** procedural characters as 3D meshes (a new free package, `figures`, from The Last Light's procedural figure without its sprite painter) with an IK rig, authored poses and keyframed clips; an angled follow camera on a 24 mm lens, 25° down and 5 m back, that the player turns freely, with optional per-room views; one base game, `games/base-3d`, with procedural figures only; the character pipeline's free procedural path. S7 adds rig-cost, figure-cost and angled-view legibility questions. (The 2026-10-18 revision's rigged glTF characters, skinning question and Meshy character stages were deferred on 2026-10-23: "procedural only for now".)
> - **Kept, by reference from the revision:** spike S7's other questions, the `pixi.js` 8.22 bump (M3.2), `render-pixi3d`'s renderer contract and static meshes, baked vertex light for static meshes, fog, `post-retro` (§4.5), packaging (§4.7), the `pipelines` platform and the props pipeline (§4.8), Ruken alignment (§11), and M3-D1 to M3-D10 and M3-D12.
> - **D-1:** unchanged (`render-pixi3d` unpublished, private builds only), and it now covers `figures` too.
> - **M9 (3D merge):** it planned the rigged character and animation pipeline; the Owner has deferred rigged glTF characters ("for now"), so M9 selects the third-person controller on the angled follow camera (klipp, checked against it), lock-on, combat, items, dungeon pieces, ground-contact IK, brush environments and what GAME-3D adds on top of M3's characters and rig.

- **Status:** Owner-approved 2026-10-16, every open decision on its recommended default; **2.5D scope superseded 2026-10-18** (amendment above). Task **M3.0** in [02 Master delivery plan](../../02-master-delivery-plan.md). Nothing here is implemented before that review (01 Decomposition §5, [04 How we build](../../04-how-we-build.md)), except spike S7 (M3.1), which is a spike and is exempt from TDD (A0+A1 spec §2). Review freezes the contracts in §4; after that they change only additively or through a written change request. Open decisions M3-D1 to M3-D12 (§15) run on their recommended defaults until the Owner changes them.
- **Owner direction:** 2026-10-11, "let's do 2D, 2.5D, and 3D"; AF 1.0 covers 2D and 2.5D, and The Last Light is the 2.5D reference (master spec §1, §11). 2026-10-16 ([PRODUCT spec](./2026-10-16-product-core-and-plus-design.md) PD-1, PD-3): every extension is Automata Plus; the free foundation comes first and M3 "continues on its own thread"; `post-retro`'s 2D part moves ahead of M3 onto the FloorFifty path.
- **Depends on:** M2 (merged). PRODUCT.5 (the `mcthaydt/automata-plus` workspace) before any M3 package task, because all three M3 packages are Plus (M3-D2). PRODUCT.1's post-filter slot before `post-retro`. Not on M4 or M5, except that the base games use M4's input and settings when those land (§2.2).

## 0. Sources

| Source | Revision | Used for |
|---|---|---|
| AF `main` | `a125344` | What exists (§2). Every "exists" cell was checked against `packages/*/src` at this commit. |
| The Last Light, `mcthaydt/PixiJS3D_Experiment_001` | `17eb568` (committed 2026-10-14; shallow clone at `/home/user/pixijs3d_experiment_001`, read 2026-10-16) | Every `render-pixi3d`, `post-retro` and `pipelines` extraction row (§4). The extraction map surveyed `948abe9`; paths below were re-checked at `17eb568`. |
| `@pixi/3d` 0.1.0-beta.2 | the tarball The Last Light vendors (`vendor/pixi-3d-0.1.0-beta.2.tgz`, with `vendor/LICENSE-pixi-3d.txt`, MIT) | Its peer (`pixi.js ^8.22.0`), dependency (`meshoptimizer ^1.2.0`), exports (`.`, `./extras`, `./webgl`, `./webgpu`) and its one runtime code-generation path (§3.2) |
| FloorFifty, `SNEKPRTY/FloorFifty` | `ac72660` (local clone at `/home/user/floorfifty`) | `post-retro`'s FloorFifty rows: `apps/client/src/systems/render/filters/*`, `filter-stack-guard.ts` |
| Ruken, vendored | RukenApp `b30d31b` ([`vendor/ruken/`](../../../vendor/ruken/README.md)) | `@ruken/manifest` `RENDERERS` and `compileHeaders` (the game CSP); `@ruken/cli`'s bundled `packages/validation/src/content-types.ts` (which file extensions a build may contain) |
| PRODUCT.1 branch `claude/clever-pasteur-ujmu6e-product1` | `a42c58f` (pending review, not merged) | `PostFilterSlot` (`packages/render-pixi/src/filter/post-filter-slot.ts`) |
| PRODUCT.7 branch `claude/clever-pasteur-ujmu6e-product7` | `b2d32d0` (pending review, not merged) | The frame-budget probe (`tooling/frame-budget`), including its SwiftShader detection |
| [M4 spec](./2026-10-16-m4-input-display-design.md) (draft, branch `claude/clever-pasteur-ujmu6e-m4spec`) | pending review | Quality tiers and `minTier` on slot owners (M4 §4.11), `Input` actions (M4 §4.2), rotate hint (M4 §4.9) |
| [EX spec](./2026-10-16-examples-one-file-design.md) | approved 2026-10-16 | One-file examples; games under `games/` (EX-D1); Plus examples in `automata-plus` |

**Not verified here:** real phones (no device in this environment); the GPU runner (no access from this container); whether Ruken's host frame exposes `navigator.gpu` (R-9); the `@pixi/3d` beta's terms beyond what The Last Light's README records (its "Closed beta" section: keep the source, the tarball and generated builds inside the beta, no public deployment); Meshy and OpenAI API terms and prices. Test counts quoted from The Last Light are top-level `it(`/`test(` calls (appendix A), not run here.

## 1. Goal and boundaries

**Goal.** A game can draw a 2.5D room: real 3D geometry seen through a fixed camera per zone, eight-direction pixel-art characters as upright billboards lit from normal maps, GLB props, fog and baked light, under a retro post chain. It renders on WebGL2 (and WebGPU when opted in) under Ruken's CSP at 30 FPS or better on the phone profiles, in a private build. An artist or agent turns a written character description into that lit sprite atlas, and an image into a packed prop, through pipelines whose paid steps and human gates are enforced by tooling, not by memory.

**Plus (paid, PD-1), in `mcthaydt/automata-plus` (M3-D2):**
1. `render-pixi3d`: the 2.5D renderer on `@pixi/3d`. Private, unpublished, never in a public build (D-1, M3-D1).
2. `post-retro`: the post chain as data, for 2D and 3D. Its tasks run on the FloorFifty path first (PD-3).
3. `pipelines`: dev tooling, never in a game bundle. The platform (router, MCP server, budgets, gates, guard, audit log) and two pipelines (character, props).
4. Two base games: `games/base-25d` and `games/base-3d`, plus one-file examples for each feature.

**Core (free), only where M3 needs it:**
- The `pixi.js` pin moves from 8.21.0 to 8.22.x across the workspace, because `@pixi/3d`'s peer is `^8.22.0` (M3-D3). This is a core change with its own task (M3.2) and every gate.
- No other core change is planned. `render-pixi3d` implements runtime's existing `RendererFactory` and reuses `render-pixi`'s public exports (§4.1). If S7 shows that a public seam is missing, it becomes a change request to the owning lane, never a copy.

**Exclusions:**
- Full 3D: rigged and animated meshes, a third-person camera and controller, brush-based environments. They come from GAME-3D in M9. `base-3d` has a static mesh character (M3-D11).
- Sector maps, nav, puzzles, systems, narrative, cutscenes and the environment (blockout) pipeline: M6.
- The reference, vision, style, UI, FMV and sound pipelines: they stay in The Last Light until a second game needs them (M3-D10).
- Input actions for camera rotation are M4 profile entries; M3 only names them.
- Phone-class auto-detection of quality: M4-D6 keeps the default at `high` until PRODUCT.7 measures phones.

**Prerequisites:** S7 needs nothing unmerged. M3.2 needs S7's verdict. M3.3 (`post-retro`) needs PRODUCT.1 and PRODUCT.5. M3.4 onward need M3.2 and PRODUCT.5.

## 2. What already exists (verified at `a125344`, not rebuilt)

### 2.1 On `main`

| Capability | Where | M3 does |
|---|---|---|
| `GameRenderer` (`apply`, `draw`, `reset`), `RendererFactory`, `RenderTarget` (`host`, `geometry`, `assets`) | `packages/runtime/src/render/renderer.ts` | `render-pixi3d` implements the factory; no runtime change |
| `createPixiRenderer(options)` with `preference`, `?renderer=` override, letterbox, `pixelArt`, `setup(stage)`; `PixiStage { app, world, ui, backdrop, consumer, filters }` | `packages/render-pixi/src/renderer.ts` | Composes it: the 3D view is mounted through `setup` (§4.1) |
| `RenderDeltaConsumer(world: Container, resolver)` with `EntityView { container, update(curr, prev, alpha), destroy }` | `packages/render-pixi/src/delta/render-delta-consumer.ts` | Reused over the 3D scene if S7 confirms `Container3D` is a Pixi `Container` (S7-Q5) |
| `filterPrograms(name, glsl, wgsl)`, `FILTER_VERTEX`, `WGSL_FILTER_HEADER` | `packages/render-pixi/src/filter/filter-programs.ts` | Every `post-retro` filter is built with it |
| `render-pixi/no-eval` (imports `pixi.js/unsafe-eval`, sets Zod jitless) | `packages/render-pixi/src/no-eval.ts` | Imported first, unchanged |
| `defineExtension` with `sim`, `content`, `layers`, `ui.slots`, `manifest` | `packages/runtime/src/extension/define-extension.ts` | Each M3 extension is one `defineExtension` |
| UI slot `debug.panels` | `packages/ui/src/slots/ui-slot.ts` | Not filled in M3 (the debug overlay is M6) |
| `Transform3D`, `RigidBody3D`, `Collider3D` and the Rapier 3D plugin | `packages/physics/src/physics-3d*.ts` | Used by the `physics-bodies-3d` example on `base-3d`; `physics` itself moves to Plus in PRODUCT.5 |
| `pixi.js` 8.21.0 pin | `docs/versions.md` line 31, `packages/render-pixi/package.json` | Bumped in M3.2 (M3-D3) |
| The release list refuses `render-pixi3d` | `tooling/release/src/release-list.test.ts` line 8 | Kept; the Plus release list gets the same guard (§4.7) |

### 2.2 Pending elsewhere (consumed, not redefined)

- **PRODUCT.1** (`a42c58f`): `PostFilterSlot.set(id, filters, order)`. `post-retro` registers its chain as one owner.
- **M4.9** (draft): `set(..., { minTier })` and quality tiers. `post-retro` marks its optional passes (bloom, grain) with `minTier: 'medium'` once M4.9 lands; until then every pass runs.
- **M4.1** (draft): the `Input` service. The bases bind `camera-left` and `camera-right` in their profile. Until M4.1 lands they use DX.2's `keys()` mapping.
- **PRODUCT.5**: the `automata-plus` workspace, its private registry and its release list. Not built yet; the repo exists with one commit (`3000c20`, a README).
- **PRODUCT.7** (`b2d32d0`): the frame-budget probe and its Playwright harness. M3's FPS gate reuses it (§9).

**Not in AF anywhere:** any 3D rendering, `@pixi/3d`, GLB loading, billboards, camera zones, normal-map lighting, fog, post filters beyond the helper, an asset pipeline, an MCP server.

## 3. Spike S7: `@pixi/3d` under AF's rules (M3.1)

### 3.1 Questions and pass criteria

| ID | Question | Pass |
|---|---|---|
| S7-Q1 | Does a View3D scene (a box room, three `Sprite3D` billboards, one `Mesh3D` from a GLB, linear fog) boot under Ruken's CSP (`compileHeaders` from `@ruken/manifest`, `script-src 'self' 'wasm-unsafe-eval'`) after `render-pixi/no-eval`? | Renders; zero `securitypolicyviolation` events; zero console errors, in Chromium, WebKit and Firefox |
| S7-Q2 | Is the post chain at parity between WebGL2 and WebGPU? | Captures of the same frame differ within M3-D5's tolerance on the GPU runner |
| S7-Q3 | Phone profiles: does the S7 scene hold 30 FPS? | p95 frame time ≤ 33.3 ms over 20 s after a 3 s warm-up, on both phone profiles (M3-D6), measured with PRODUCT.7's probe on the GPU runner. A SwiftShader result is rejected, as the probe already does |
| S7-Q4 | Is there a non-black capture path on the GPU runner? (S3's open item) | `renderer.extract` of a rendered frame is non-black (mean luminance above a fixture threshold) on WebGL2 and on WebGPU |
| S7-Q5 | Which beta APIs does AF depend on, and do they fit AF's seams? | A written list of every `@pixi/3d` symbol `render-pixi3d` will import; `Container3D` accepted where `RenderDeltaConsumer` takes a `Container`; `View3D` mountable inside `createPixiRenderer`'s `setup` |
| S7-Q6 | Does `pixi.js` 8.22 change anything AF depends on? | `pnpm check`, `pnpm test:parity` and `pnpm test:e2e` green on a branch with 8.22; FloorFifty's filter-stack resize crash (`filter-stack-guard.ts`, written against 8.21) reproduced or not |
| S7-Q7 | What does `@pixi/3d` cost in bytes? | Gzip bytes of the S7 entry with and without `@pixi/3d`, and with `./webgl` only, recorded against S8's budgets |

### 3.2 What is already known (read from the tarball, not run)

- `@pixi/3d`'s main entry (`dist/index.mjs`) does not reach code generation. Its `./extras` entry does: `extras/particles/utils/generateSpawnBurst.mjs` calls Pixi's `unsafeEvalSupported()` at module load. That probe runs `new Function` inside a `try`, so under Ruken's CSP it falls back to `generateSpawnPolyfill`, but the blocked attempt is still a CSP violation, which AF's E5 budget forbids. **Rule:** `render-pixi3d` never imports `@pixi/3d/extras`; a bundle test fails if the built game contains `generateSpawnBurst`. The Last Light imports only the main entry (12 symbols: `Container3D`, `ContainerTexture`, `CubeGeometry`, `FlatMaterial`, `Fog`, `Geometry3D`, `Mesh3D`, `ParticleContainer3D`, `PlaneGeometry`, `Sprite3D`, `View3D`), so this costs nothing it uses.
- The Last Light prefers WebGPU and retries WebGL (`render/stage.ts` lines 433–439). AF keeps WebGL2 as the default (ADR 0002, M3-D4); `createPixiRenderer` already falls back to WebGL2 when WebGPU was requested and fails.
- Ruken's validation serves `.glb` (`model/gltf-binary`) and `.bin` but has no `.pack` type, so The Last Light's 61 `.pack` props would fail `ruken publish`. AF's packed props use `.bin` (M3-D8).

### 3.3 Outputs

- `spikes/s7-pixi3d/` in AF: the spike page, its Playwright checks and the vendored tarball with its licence. Spike code is removed when the verdict is recorded, as A0 did; the history keeps it.
- `docs/spikes/s7-pixi3d.md`: answers to S7-Q1 to S7-Q7 with numbers, browser and runner names and commit, and a verdict row in `docs/spikes/README.md`.
- The verdict confirms or changes D-1, M3-D3, M3-D5 and M3-D6. A failed S7-Q1 or S7-Q3 stops M3.4 onward and goes back to the Owner as a recorded decision with the evidence (§6).

## 4. Contracts

### 4.1 `render-pixi3d` renderer (`automata-plus/packages/render-pixi3d`, M3.4)

```ts
export interface Pixi3dOptions extends PixiRendererOptions {
  readonly fog?: { readonly near: number; readonly far: number; readonly color: number }
  readonly views: EntityViewResolver3d              // entity views for the 3D scene
  readonly cameras: CameraRig                       // §4.2
  readonly lighting?: BakedLighting                 // §4.4
}
export type EntityViewResolver3d = Readonly<Record<string, (row: RenderRow) => EntityView | undefined>>
export interface Pixi3dRenderer extends PixiRenderer {
  readonly view: View3D                             // the @pixi/3d view (S7-Q5 lists the symbols)
  readonly camera: CameraRig
}
export function createPixi3dRenderer(options: Pixi3dOptions): RendererFactory
export const render3dExtension: ExtensionDef<'render-pixi3d'>
```

- `createPixi3dRenderer` calls `createPixiRenderer` (core) with a `setup` that mounts one `View3D` (autoresize off; sized from the letterbox frame) into `stage.world` and builds a second `RenderDeltaConsumer` over the `View3D` scene. 2D layers (`stage.ui`, `stage.backdrop`) keep working, so HUD sprites and the 2D post slot are the same as in a 2D game.
- Views: `billboard(atlas, options)` (cylindrical `Sprite3D`, feet on the floor, eight-direction rows chosen by §4.3), `mesh(model)` (a parsed GLB or packed `.bin`), `box(size, material)`. Positions come from render rows: a `transform-3d` component (metres) when the game uses physics, or the base games' own `pos` component (§4.6). Interpolation is the existing `prev`/`curr`/`alpha` contract.
- Assets: `.glb`, `.bin` and atlas PNGs load through runtime's `Assets` (byte progress, 30 s stall), listed in the generated preload. `parseGlb` and `parsePack` come from The Last Light `render/glb.ts` (62 lines): a single textured mesh, float positions, UVs and normals.
- Init order inside boot step 6 (master spec §7): Pixi app (core) → `View3D` → views. Nothing renders before `session.ready` (unchanged).
- `render3dExtension.manifest` contributes nothing to `ruken.toml` except preload entries; `runtime.renderer` stays `webgl2` (Ruken's `RENDERERS` has no WebGPU value; R-8).

### 4.2 Cameras (`render-pixi3d` `camera/`, M3.4)

```ts
export interface CameraZone {               // content, compiled by `content` (schema `camera-zone`)
  readonly id: string
  readonly area: readonly [number, number][] // floor-plan polygon, metres (x, z)
  readonly look: readonly [number, number, number]
  readonly distance: number
  readonly hysteresis?: number               // metres past the edge before a cut; default 0.5
  readonly follow?: number                   // 0 fixed … 1 locked on, sideways
  readonly depthFollow?: { readonly rate: number; readonly about: number }
}
export interface CameraRig {
  readonly lens: { readonly mm: number; readonly tiltDeg: number } // game content; The Last Light: 50, 30
  focus(x: number, z: number): void          // from the followed entity's interpolated view position
  orbit(steps: -1 | 1): void                 // 45° per step around the focus
  update(frameSeconds: number): void
  readonly zone: string
  readonly octant: number                    // 0..7, used by billboards
}
```

- From The Last Light `game/contracts/scene.ts` (`CameraZone`, lines 17–40), `render/room-camera.ts` (53: `roomCamera`, `easeRoomCamera`) and `render/stage.ts` (orbit). AF turns `contains(p)` and `enter(p)` functions into a polygon plus hysteresis, so zones are content and hash with the rest.
- **Presentation only.** The rig reads interpolated positions and writes only the `View3D` camera. It never writes sim state (law 1). Zone cuts are instant; orbit eases over 250 ms and is instant under reduced motion.
- Orbit is driven by the `camera-left` and `camera-right` actions (M4 profile entries), and by two CornerControls buttons on touch (44 px).

### 4.3 Billboards and lit sprites (M3.5)

- The sprite row for a figure is `(facing octant − camera octant) mod 8`, where the facing octant is a sim field. The Last Light's atlas layout (8 rows × 4 walk frames, feet aligned in a 48×72 cell) is the default; the cell size is atlas metadata written by the character pipeline (§4.8).
- **Lit sprites** (The Last Light `render/sprite-light.ts`, 65): each frame is lit on the CPU from its normal map by the same lamps the vertex lighting uses, ambient plus N·L, snapped to the room's light steps, with a one-texel outline and a rim on the lit side. Normal encoding: red right, green down, blue toward the camera (`@pixi/3d`'s convention). Relit only when the figure's lamp set or frame changes, never per frame for an idle figure.
- An atlas without its normal map fails the character pipeline's install check (§4.8); at run time a missing normal map is a load error, not an unlit fallback.

### 4.4 Baked lighting, occlusion and fog (M3.5)

- `BakedLighting { lamps: Lamp[]; ambient: number; steps: number }` from content. Vertex light is computed once per mesh at load (The Last Light `render/indirect-light.ts`, 180) with occlusion (`render/occlusion.ts`, 36). A lamp change (a sim event) rebakes only the meshes in its range.
- In M3, occlusion takes boxes and planes from the room content. Sector-derived occlusion arrives with `sectors` in M6.
- Fog: `View3D`'s linear fog; mist with `ParticleContainer3D` (main entry, no code generation; The Last Light `render/fog.ts`, 94). The mist's drift is presentation time, seeded so screenshots are stable.

### 4.5 `post-retro` (`automata-plus/packages/post-retro`, M3.3)

```toml
# content/post.toml (schema `post-chain`, compiled and hashed like all content)
[[pass]]
kind = "palette-lock"     # dither | lcd | palette-lock | duotone | outline | bloom | grade | grain | vignette
palette = "endesga-64"    # a palette content id
[[pass]]
kind = "bloom"
min_tier = "medium"       # used once M4.9 lands
```

- One owner on PRODUCT.1's `PostFilterSlot`: `post-retro` builds the passes in file order and calls `slot.set('post-retro', filters, 100)`. A content hot reload rebuilds the chain; the old filters are destroyed first (FloorFifty `quality-rebuild.ts` rule).
- Every pass is a GLSL + WGSL pair through `filterPrograms`, taking pixel position from the vertex stage (S4).

| Pass | Source | Work |
|---|---|---|
| `dither` (Bayer 8×8), `lcd` (snap and panel), `grade`, `grain`, `vignette` | The Last Light `render/retro-filter.ts` (345), `lcd-panel.ts` (241, an MIT port of lcd-perfect; its notice is kept) | Already GLSL + WGSL. Parameters move from `LOOK` (`render/look.ts`) to content |
| `bloom` | The Last Light `render/bloom-filter.ts` (107); FloorFifty `scene-bloom.ts` (349) | One bloom; FloorFifty's ordering rule (bloom after the palette lock, so the glow is not posterized) becomes the default order |
| `palette-lock` | FloorFifty `palette-lock.ts` (233) with `palette-cells.ts` (106) | GLSL only today: a WGSL counterpart is written and held to parity (S7-Q2's tolerance). The palette comes from content, never a constant |
| `duotone`, `outline` | FloorFifty `duotone-dither.ts` (234), `outline.ts` (136) | GLSL only today: WGSL added |
| Shared vertex stage | FloorFifty `default-vert.ts` (35) | Replaced by core's `FILTER_VERTEX` |
| Resize guard | FloorFifty `filter-stack-guard.ts` (33), a workaround for a Pixi 8.21 filter-stack bug | Kept only if S7-Q6 reproduces the crash on 8.22; otherwise not extracted |

- Not extracted (game-specific set pieces keyed to FloorFifty's scene): `city-atmosphere.ts`, `dawn-refraction.ts`, `sun-shimmer.ts`, `dither-sky.ts`. Count at `ac72660`: nine filter modules plus the shared vertex file. The extraction map said "eight GLSL filters" and the PRODUCT spec "ten"; both are superseded by this table.
- The Last Light's DUEL LUT (`render/duel-ramps.ts`, `palette.ts`) stays in the game; AF's default palette is Endesga 64 (art direction).

### 4.6 Base games and examples (M3.6, M3.7)

- **`games/base-25d`** (in `automata-plus`): Emberwick's character as an eight-direction lit billboard in one fixed-camera room with two zones, three GLB props, fog and the `post-retro` chain. Splash → menu → room → pause → end, on core `runtime`, `host`, `ui`, `content`. Its sim is a small plugin of its own (position `x`, `z` in fixed-point metres, facing octant, wall boxes), with no physics, so its golden replay runs in Node, Chromium, WebKit and Firefox like Emberwick's. It declares `runtime.orientation = "landscape"`; portrait shows M4's rotate hint once M4.7 lands.
- **`games/base-3d`**: the same room with the character as a static GLB mesh and a follow camera (M3-D11). It is the starting point for GAME-3D.
- **One-file examples** (EX spec rules, module `render3d`, `Tier: plus`): `render3d-billboards.ts`, `render3d-camera-zones.ts`, `render3d-glb-props.ts`, `render3d-lit-sprites.ts`, `render3d-fog.ts`; module `post`: `post-retro-chain.ts` (2D, on the FloorFifty path); module `physics`: `physics-bodies-3d.ts` on `base-3d`'s room. Each is 100 code lines or fewer.

### 4.7 Packaging and the beta's terms

- `render-pixi3d` and both base games are `private: true`. They are never published, not even to the Plus registry, while D-1 stands. The Plus release-list test refuses them, as AF's does today.
- The `@pixi/3d` tarball and its licence are vendored only in private repositories (`automata-plus/vendor/`; `spikes/s7-pixi3d/vendor/` in AF until the spike closes). No published package depends on a `file:` tarball.
- Builds that include `render-pixi3d` deploy only to Ruken's local stack and to the private dev host (behind its access control, D-4). A check in `ship prepare` refuses to prepare a build for a public target when its bundle contains `@pixi/3d` (by a marker string from the tarball), with the D-1 reason in the message.

### 4.8 `pipelines` (`automata-plus/tooling/pipelines`, M3.8, M3.9)

**Platform** (The Last Light `scripts/pipe.mjs` 147, `scripts/pipeline/runner.ts` 518, `contracts.ts` 114, `scripts/mcp/{server,tools,contracts}.ts` 11 + 452 + 95, `scripts/guard/{check.ts,validators.ts,pre-tool.mjs}` 29 + 334 + 184, `pipeline.config.json`, `docs/pipeline-audit.jsonl`):

```ts
export type PipelineExit = 0 | 1 | 2 | 3 | 4    // done · failed · not implemented · at a gate · refused (The Last Light's codes)
export interface PipelineDef {
  readonly name: string                          // 'character' | 'props' in M3
  readonly spec: ZodType                         // the spec file each target folder holds
  readonly stages: readonly StageDef[]           // ordered; each declares inputs, outputs, cost and gate
}
export interface StageDef {
  readonly id: string
  readonly cost?: { readonly budget: BudgetKey; readonly units: number } // paid stages only
  readonly gate?: string                          // stops the run until a person approves
  run(ctx: StageContext): Effect.Effect<StageResult, StageError, Files | ProcessRunner>
}
export function definePipeline(def: PipelineDef): PipelineDef
```

- **Router:** `automata pipe <pipeline> <command> <target> [gate] [--json]` with The Last Light's common commands (`status`, `estimate`, `run`, `approve`, `reject`, `restore`, `check`, `adopt`, `request`). It never prompts. `--json` prints exactly one JSON object.
- **Stage cache:** a stage is skipped when the hash of its inputs is unchanged and its outputs exist (The Last Light `common.run_stages`), so a run can stop after any paid step and resume. Hashes use `@mcthaydt/automata-sim/hash` XXH64, not `node:crypto`.
- **Budgets:** per project and per run, by key (`images`, `meshyCredits`, `visionCalls` in M3), in the game's `pipeline.toml` content. `estimate` prints the cost; `run` refuses (exit 4) a stage whose cost would pass either budget, before calling the API.
- **Gates:** a gate stops the run (exit 3). `approve` and `reject` are for people only: the MCP server exposes `pipeline_request_review`, which asks the person through MCP elicitation and records their answer; an agent cannot call `approve`. "People decide, checks record facts" (master spec §9).
- **Audit log:** every MCP tool call appends one JSON line (`at`, `tool`, `args`, `ok`, `summary`, `ms`, `head`) to the game's `docs/pipeline-audit.jsonl` (The Last Light's format, 696 lines at `17eb568`).
- **Guard:** generated paths (from `pipeline.toml`'s `generated` list) are never hand-edited, and locked values (The Last Light: `lensMm`, `tiltDeg`, `lcd`, `dither`, `maxFaces`, `artifactMB`) can only change through a recorded decision. It runs as `automata pipe guard check` and as a Claude Code `PreToolUse` hook (M3-D12).
- **Effect:** the router, runner, MCP server and guard are build-time code on `@mcthaydt/automata-node`'s `Files` and `ProcessRunner`, with typed errors (master spec §6). Image stages stay Python (M3-D7).

**Character pipeline** (The Last Light `scripts/pipeline/character.py` 669, with `scripts/{flatten-texture.py, render-sprites.mjs, pixelate-sheet.py, detail-pass.py, polish-sprites.py, normal-maps.py}`): stages `look` (gate G1) → `turnaround` → `views` → `model` (Meshy multi-image to 3D; gate G3) → `rig` → `flatten` → `render` (eight directions through the game's camera, plus five light renders) → `pixelate` → `detail` (gate G5) → `polish` → `normals` → `install` (gate G6, the figure in game). Install writes the atlas, its normal map and an entry in the game's `characters` content (cell size, frames, rate, ground line).

**Props pipeline** (`scripts/pipeline/props.py` 347, `scripts/meshy-image-to-3d.py` 51, `pack-models.py` 226, `flatten-texture.py` 139): image → Meshy image-to-3D (face limit from `maxFaces`) → texture flattened to the palette → packed `.bin` (M3-D8) → install into the game's `props` content with its fitted bounds (`render/props.ts` `fitProp`).

Both make the game-specific parts content: the look bible, prompts and style references are files in the game's `art/` folder, and the palette gate checks every installed pixel against the game's palette content (Endesga 64 by default).

## 5. Data and lifecycle flows

**Boot with 3D** (master spec §7, unchanged order):
1. `render-pixi/no-eval` first.
2. Host, settings, content: camera zones, lamps, props, characters and the post chain arrive as compiled content.
3. Assets: atlases, normal maps, `.glb` and `.bin` files load with byte progress; the preload list comes from content.
4. Renderer: `createPixi3dRenderer` → Pixi app on WebGL2 (WebGPU only when opted in, falling back once) → `View3D` → bake vertex lighting → views.
5. Ready: the splash shows; the room renders only after `session.ready`.

**Per fixed step:** the sim steps; `apply(result)` feeds both consumers (2D and 3D).

**Per frame:** `draw(frame)` interpolates views; the camera rig reads the followed view's position, picks the zone (with hysteresis), eases follow; billboards pick their row from the octant difference; lit sprites relight only on change; the post slot runs.

**Zone change:** instant cut, no remount, no sim effect. **Orbit:** 45° ease (instant under reduced motion); billboard rows update on the same frame.

**Lamp change** (a sim event on the presentation bus): rebake the affected meshes and relight the affected figures.

**Lifecycle background:** the app loop pauses (M1.5); mist and the orbit ease stop with it.

**WebGL context lost:** the renderer reports `render.context.lost` and the runtime shows the error panel with Try again, which closes the renderer scope and builds it again from the current sim state (a resync delta). Gameplay state is untouched.

**Dispose and restart:** closing the renderer scope destroys `View3D`, meshes, textures and filters; a restart rebuilds from content.

**Pipeline run:** `estimate` → `run` → stages in order, skipping cached ones → a paid stage checks the budget, calls the API through `ProcessRunner`, records task ids → a gate stops with exit 3 → the person approves through MCP → the next `run` continues → `install` writes content and assets → `check` re-validates.

## 6. Failure policy

| Case | Result |
|---|---|
| S7-Q1 fails (a CSP violation or `EvalError` from `@pixi/3d`'s main entry) | M3.4 onward stop. The S7 report names the call site; options (a fix upstream in the beta, a local patch, or dropping 3D from AF 1.0) go to the Owner as a recorded decision. `allow_eval` (Ruken's manifest exception) is never used: AF requires no-eval |
| S7-Q3 fails (below 30 FPS on a phone profile) | The report gives the frame breakdown; the base scene's budgets (draw calls, faces, lights, post passes) are cut until it passes, and the cut values become content limits checked by the pipelines guard |
| WebGPU requested and unavailable or failing | One WebGL2 retry (existing core behavior), `render.fellBack` fact, game continues |
| A `.glb` or `.bin` file is malformed | `parseGlb`/`parsePack` throw a named `ModelInvalid { file, reason }`; boot shows the asset error panel with Try again; nothing partially renders |
| An atlas has no normal map, or its cell metadata is missing | Load error naming the file; the character pipeline's `check` would have refused it first |
| A camera zone polygon is self-intersecting or zones overlap without hysteresis | Content compile error with `file:line:col` |
| No zone contains the focus | The rig keeps the last zone; a warning is logged once per entry |
| A filter fails to compile on one backend | It drops out with `render.filter.dropped` (M4 rule); parity tests fail in CI, so this is never shipped silently |
| WebGL context lost | Error panel with Try again; rebuild from a resync delta (§5) |
| A bundle intended for a public target contains `@pixi/3d` | `ship prepare` refuses with the D-1 reason |
| A pipeline stage would pass its budget | Exit 4 before any API call; the estimate is printed |
| A paid API call fails or times out | The stage fails (exit 1) with the provider's error; task ids already recorded are kept, so `restore` re-downloads without paying again |
| An agent calls `approve` | Refused (exit 4); only `pipeline_request_review` can record a decision, and only from a person's MCP answer |
| A hand edit to a generated file or a locked value | The guard refuses the edit (hook) or fails `guard check` (CI), naming the rule |
| `python3`, Pillow or numpy missing or at another version | `automata pipe doctor` and every Python stage fail first with the install command; no stage half-runs |

## 7. UI inventory and states

M3 adds little UI: it renders a game, and the debug overlay is M6.

| Component | States | Focus and input | Host-aware |
|---|---|---|---|
| Camera orbit buttons (two CornerControls) | shown on touch, hidden otherwise; pressed; disabled during a cut-scene-like pause | 44 px targets; keyboard and pad use `camera-left`/`camera-right` | Never under `hostReserved` |
| Asset error panel (existing `ErrorPanel`) | `ModelInvalid`, atlas missing, context lost; Try again | Try again focused | — |
| Pipeline review (MCP elicitation, outside the game) | asked, approved, rejected, cancelled, timed out (recorded as "the owner did not decide") | The person answers in their MCP client | — |

## 8. Responsive behavior

| Situation | Policy |
|---|---|
| Landscape phone and compact (844×390, 780×270) | The logical field is letterboxed by core; the 3D view fills the field; orbit buttons in the lower corners |
| Portrait phone | `base-25d` is `landscape`: M4's rotate hint over a paused game (when M4.7 lands; until then the letterboxed field shows small) |
| `hostReserved` strip | Letterbox and corner controls already avoid it (core) |
| Resize or rotation | The `View3D` is resized from the letterbox frame on the same frame; no remount; the camera aspect updates; filters re-target (and the resize guard runs only if S7-Q6 keeps it) |
| `scale` 1.333 | HUD and corner controls scale (core); the 3D field does not |
| Reduced motion | Orbit ease and mist drift off; zone cuts unchanged |

## 9. Test allocation

| Layer | Where | What it proves |
|---|---|---|
| Unit (Node) | `render-pixi3d` (`camera/`, `views/`, `glb/`, `light/`), `post-retro` (chain schema, pass order), `pipelines` (router, runner cache, budgets, gates, audit log, guard validators, MCP tools) | Zone choice with hysteresis; octant row selection; follow and depth follow; `parseGlb`/`parsePack` on fixtures and on malformed files; vertex light and occlusion values on a fixture room; sprite relight only on change; chain built in file order; budget refusal before a call; gate exit 3; `approve` refused for agents; audit line shape; guard rules. Ported behavior specs from The Last Light: `look`, `fog`, `indirect-light`, `props`, `post-fx`, `character-pipeline`, `pipeline`, `pipeline-runner`, `guard`, `mcp-server` (about 130 top-level tests together, appendix A) |
| Parity (sim) | `games/base-25d`, `games/base-3d` | Golden replay hash identical in Node, Chromium, WebKit and Firefox |
| Parity (render) | GPU runner, Chromium | WebGL2 and WebGPU captures of each `post-retro` pass and of `base-25d`'s room within M3-D5's tolerance |
| Fake-host E2E | each example and base, Playwright under `@ruken/sdk-host`'s fake host, served with `compileHeaders` | Boots, nothing before ready, zero console errors, zero CSP violations, no `generateSpawnBurst` in the bundle; `ModelInvalid` shows the panel; context loss recovers |
| Frame budget | GPU runner, PRODUCT.7's probe | p95 ≤ 33.3 ms on both phone profiles (M3-D6) for `base-25d` and the S7 scene; SwiftShader results rejected |
| Pipelines integration | `pipelines`, with fake Meshy and OpenAI HTTP servers on recorded fixtures | A full character and a full props run with `--adopt`/`--restore` and with faked paid stages: stages, cache skips, gates, install output, palette gate. No paid call in CI |
| Owner | real phones, real paid runs | §13 |

Heavy GPU, visual and frame-budget suites run on the GPU runner only (AGENTS.md). Locally, the fake-host E2E runs in Chromium with SwiftShader for smoke only; it proves no FPS or parity.

## 10. Feedback workflow

- Focused first: one Vitest file (`pnpm --filter <pkg> exec vitest run src/camera/<file>`), then one example's E2E (`CI=1 pnpm exec playwright test <spec> --project=examples`), then the GPU runner for one capture or one probe (`pnpm test:remote <spec> --project=<profile>`).
- Browser checks wait on `session.ready`, `document.fonts.ready`, the asset loader's done state and two animation frames after a resize or orbit; never a sleep.
- Every capture and probe result names its build ID, commit, renderer (`canvas.dataset.renderer`), GPU adapter string and browser. First-attempt failures are kept.
- Pipelines: `automata pipe <p> status --json` is the readiness signal; paid stages are never part of a feedback loop.
- Full gates before each PR, under the heavy-gates lock: `pnpm check`, `pnpm test:parity`, and `pnpm test:e2e` when the change touches a renderer, a base or an example.

## 11. Ruken alignment and requests

| Behavior | Ruken contract (vendored, `b30d31b`) |
|---|---|
| Game CSP | `@ruken/manifest` `compileHeaders`: `script-src 'self' 'wasm-unsafe-eval'`, `img-src 'self' data: blob:`, `worker-src 'self' blob:`, `connect-src 'self'` plus `[network].connect` |
| Declared renderer | `@ruken/manifest` `RENDERERS`: `webgl2`, `webgl`, `canvas2d`, `wasm-webgl2`. A 2.5D game declares `webgl2` |
| Build file types | `@ruken/cli`'s bundled `content-types.ts`: `.glb`, `.gltf`, `.bin`, `.ktx2`, `.png`, `.webp` allowed; `.pack` not (M3-D8) |
| Publish | `ruken publish` packs and validates (unchanged) |

**Requests to Ruken** (numbered after M5's R-5 to R-7; the Owner files them):
- **R-8.** `runtime.renderer` has no WebGPU value. Either add one (or a list such as `["webgpu", "webgl2"]`) or document that `webgl2` is right for a game that opts into WebGPU and falls back to WebGL2.
- **R-9.** Question: does Ruken's game frame (its `allow` attribute or Permissions Policy) expose `navigator.gpu` to the game on desktop, iOS and Android shells? Not verifiable here (no RukenApp checkout or device).

## 12. Tasks

| ID | Task | Lane | Depends on | Deliverable and acceptance |
|---|---|---|---|---|
| M3.0 | This spec, reviewed | integration | — | Owner review; M3-D1 to M3-D12 confirmed or changed |
| M3.1 | Spike S7 | render3d (new) | M3.0 | §3; `docs/spikes/s7-pixi3d.md` and verdict; S7-a to S7-d |
| M3.2 | `pixi.js` 8.22 in core | ship, runtime | M3.1 verdict | `docs/versions.md`, every `pixi.js` pin, the filter-stack check (S7-Q6); every gate green; no golden changes; V-a |
| M3.3 | `post-retro` | render3d | PRODUCT.1, PRODUCT.5 | §4.5 in 2D on the FloorFifty path; example `post/post-retro-chain.ts`; PF-a to PF-c |
| M3.4 | `render-pixi3d` renderer, cameras, billboards, GLB and packed props | render3d | M3.2, PRODUCT.5 | §4.1, §4.2, §4.7; examples `render3d-billboards`, `-camera-zones`, `-glb-props`; D3-a to D3-d |
| M3.5 | Lit sprites, baked lighting, occlusion, fog | render3d | M3.4 | §4.3, §4.4; examples `render3d-lit-sprites`, `-fog`; D3-e, D3-f |
| M3.6 | `games/base-25d` | integration | M3.3, M3.5 | §4.6; B-a, B-b |
| M3.7 | `games/base-3d` and `physics-bodies-3d` | integration, sim | M3.4, PRODUCT.5 (physics in Plus) | §4.6; B-c |
| M3.8 | `pipelines` platform | pipelines (new) | M3.0, PRODUCT.5 | §4.8 platform; PL-a to PL-e |
| M3.9 | Character and props pipelines | pipelines | M3.8 | §4.8 pipelines; PL-f, PL-g |
| M3.10 | M3 exit | integration | M3.6, M3.7, M3.9 | X-a to X-c on the GPU runner; Owner gates (§13) |

Order: M3.1 and M3.8 start first (neither needs an unmerged package). M3.3 starts when PRODUCT.1 and PRODUCT.5 merge, independent of S7 (PD-3). M3.2 after the S7 verdict; then M3.4, M3.5, M3.6, M3.7; M3.9 after M3.8; M3.10 last.

New lanes for 04: **render3d** (`automata-plus/packages/{render-pixi3d,post-retro}`, `spikes/s7-pixi3d/` in AF) and **pipelines** (`automata-plus/tooling/pipelines`). The integration lane owns the base games.

## 13. Exit criteria and acceptance cases

**Success:**
- **S7-a.** The S7 scene boots under `compileHeaders`' CSP in Chromium, WebKit and Firefox with zero CSP violations and zero console errors.
- **S7-b.** The S7 report lists every `@pixi/3d` symbol AF imports and confirms `Container3D` in `RenderDeltaConsumer`.
- **S7-c.** WebGL2 and WebGPU captures on the GPU runner are non-black and within M3-D5's tolerance.
- **S7-d.** Both phone profiles hold p95 ≤ 33.3 ms for the S7 scene (or the report records the miss and the cut budgets).
- **V-a.** After the 8.22 bump, every existing golden hash, layout contract and E2E journey is unchanged.
- **PF-a.** Each pass's WebGL2 and WebGPU outputs on a fixture image are within tolerance.
- **PF-b.** With `palette-lock` last before bloom, every non-bloom pixel of a fixture frame is a palette colour.
- **D3-a.** Walking across a zone edge cuts the camera only after the hysteresis distance; walking back inside it does not cut.
- **D3-b.** Orbiting one step changes every billboard's row by one octant on the same frame.
- **D3-c.** A `.bin` prop and the same prop as `.glb` produce identical vertex buffers.
- **D3-d.** Interpolated billboard positions at `alpha` 0.5 lie halfway between the last two ticks.
- **D3-e.** A lamp switched off by a sim event darkens the meshes and figures in its range, and only those.
- **B-a.** `base-25d`'s golden replay matches in Node, Chromium, WebKit and Firefox.
- **B-b.** `base-25d` boots under the fake host and under Ruken's local stack, nothing renders before ready, zero CSP violations.
- **B-c.** `physics-bodies-3d` keeps a golden hash identical in four engines.
- **PL-a.** `estimate` on a character spec prints the stage costs; `run` with a budget one unit short exits 4 before any HTTP call (asserted on the fake server).
- **PL-b.** A run stopped at G3 resumes past every cached stage without calling the API again.
- **PL-c.** Every MCP tool call adds one audit line with the current `head`.
- **PL-f.** A faked character run installs an atlas, a normal map and a `characters` content entry that `base-25d` loads.
- **PL-g.** A faked props run installs a `.bin` within `maxFaces` whose colours are all in the palette.
- **X-a.** `base-25d` holds p95 ≤ 33.3 ms on both phone profiles on the GPU runner, WebGL2 and WebGPU, under Ruken's CSP.

**Failure cases that must be shown by tests:**
- **S7-e.** A page importing `@pixi/3d/extras` under the CSP records a violation (the reason for the rule in §3.2); the bundle test fails when `generateSpawnBurst` is present.
- **D3-f.** A malformed `.glb` shows the `ModelInvalid` panel naming the file, and Try again reloads it.
- **PF-c.** A pass whose WGSL fails to compile drops out with `render.filter.dropped` and the frame still draws.
- **PL-d.** An agent's `approve` is refused with exit 4 and logged.
- **PL-e.** A hand edit to a generated path fails `guard check` naming the rule.
- **X-b.** `ship prepare` for a public target refuses a bundle containing `@pixi/3d`.
- **X-c.** A lost WebGL context shows the error panel and Try again restores the room with the same sim hash.

**Gates reported separately:** implemented; locally verified (`pnpm check`, `pnpm test:parity`, fake-host E2E in Chromium); GPU-runner verified (render parity, frame budget, captures); deployed (Ruken local stack and the private dev host only); Owner accepted.

**Owner acceptance (never ticked by an agent):**
- D-1 confirmed or changed after S7.
- `base-25d` played on a real phone (one Android, one iPhone) under Ruken's local stack, with device, browser, renderer and date recorded, and its look approved from evidence screenshots.
- One character through the character pipeline with the Owner's own approvals at G1, G3, G5 and G6, on the Owner's API keys and budget, with the audit log lines recorded.

## 14. Risks

| Risk | Mitigation |
|---|---|
| The beta changes, stalls, or never allows public deployment | One private extension behind `GameRenderer` and the renderer-agnostic `RenderDelta`; S7 lists every symbol AF uses; 2D core is unaffected; X-b stops an accidental public build |
| The 8.22 bump changes 2D behavior | Its own task with every gate (V-a), before any 3D code depends on it |
| Phone FPS misses | S7 measures first; budgets become content limits the guard enforces |
| GLSL-only FloorFifty filters behave differently in WGSL | Each new WGSL pass is held to the GLSL output by PF-a on the GPU runner |
| Paid API calls in tests or loops | No paid call in CI; budgets refuse before calling; recorded task ids make `restore` free |
| Python in an otherwise TypeScript toolchain | Kept to image stages with pinned Pillow and numpy and a `doctor` check (M3-D7); everything with state is TypeScript |
| The Last Light keeps moving (36 files changed between `948abe9` and `0f43f1f`; now at `17eb568`) | Each task's plan re-reads its files at the current commit and records it |

## 15. Open decisions (recommended defaults in effect until the Owner reviews)

| ID | Question | Recommended default | Why |
|---|---|---|---|
| M3-D1 | D-1: may AF use the `@pixi/3d` beta? | **Yes, private only:** `render-pixi3d` and the 3D bases stay unpublished and out of public builds until the beta's terms allow public deployment | The Last Light's README keeps builds inside the beta; a published package cannot depend on a `file:` tarball |
| M3-D2 | Where M3 code lives | **`mcthaydt/automata-plus`** for `render-pixi3d`, `post-retro`, `pipelines`, the base games and Plus examples; S7 in AF's `spikes/` | PD-1 makes every extension Plus; both repos are private today (checked 2026-10-16) |
| M3-D3 | `pixi.js` version | **8.22.x across the workspace**, in its own task after S7 | `@pixi/3d`'s peer is `^8.22.0`; two Pixi versions in one game is not an option |
| M3-D4 | Default renderer for 2.5D | **WebGL2**, WebGPU opt-in | ADR 0002; Ruken declares only WebGL renderers; The Last Light's WebGPU-first is not kept |
| M3-D5 | WebGL2 versus WebGPU tolerance | **Per channel at most 2 on 99.5% of pixels, and no pixel above 16**, to be confirmed by S7's measurements | Ordered dither and palette snap are integer-stable; bloom and fog are not bit-exact across APIs |
| M3-D6 | Phone profiles | **Galaxy S20 (360×800, DPR 3) and iPhone 13 (390×844, DPR 3)** in Chromium with 4× CPU throttling (S8's factor) on the GPU runner; WebKit at the iPhone size without throttling; pass at p95 ≤ 33.3 ms | The profiles ADR 0002 names; real phones remain an Owner gate |
| M3-D7 | Python stages | **Keep Python** for image work (flatten, pixelate, detail fit, polish, normals, pack), with Pillow and numpy pinned in a `requirements.txt` and a `doctor` check; port the router, runner, MCP, budgets, guard and audit to TypeScript on Effect | The image code is proven and has tests; the stateful parts need AF's typed errors |
| M3-D8 | Packed prop file type | **`.bin`** (and `.glb` for unpacked) | Ruken's validation has no `.pack` type at `b30d31b` |
| M3-D9 | Paid APIs | **Never in CI.** Tests use recorded fixtures and fake servers; paid stages run only with the game owner's keys, within the budgets in content | No silent spend; reproducible tests |
| M3-D10 | Which pipelines move in M3 | **The platform, character and props.** Blockout moves with `sectors` (M6); reference, vision, style, UI, FMV and sound stay in The Last Light until a second game needs them | 01's M3 scope; no speculative extraction |
| M3-D11 | `base-3d`'s character | **A static GLB mesh** with a follow camera; no skeletal animation | Rigged animation is M9, from GAME-3D |
| M3-D12 | The pipelines guard hook | **One `PreToolUse` hook script shipped by `pipelines`**, registered by DX.7's plugin when a game installs `pipelines`; `automata pipe guard check` runs the same rules in CI | One rule set, two entry points; DX.7 owns hook registration |

## Appendix A. How the counts were produced

On the clone of The Last Light at `17eb568`:

```sh
wc -l src/render/*.ts scripts/pipe.mjs scripts/mcp/*.ts scripts/guard/* scripts/pipeline/*.py scripts/pipeline/runner.ts
for f in look fog indirect-light props post-fx character-pipeline pipeline pipeline-runner guard mcp-server; do
  printf '%s %s\n' "$f" "$(grep -cE '^\s*(it|test)(\.each)?\(' tests/$f.test.ts)"
done
grep -rhn "from '@pixi/3d'" src | sed 's/.*import //' | tr -d '{}' | tr ',' '\n' | sed 's/type //;s/from.*//' | sort -u
```

On FloorFifty at `ac72660`: `wc -l apps/client/src/systems/render/filters/*.ts apps/client/src/systems/render/filter-stack-guard.ts`; `grep -c GlProgram` and `grep -il wgsl` over the same files (no WGSL found). On the `@pixi/3d` tarball: `grep -rln generateSpawnBurst dist --include=*.mjs`. On `@ruken/cli` at `b30d31b`: the `CONTENT_TYPES` table in `dist/run-*.js`.
