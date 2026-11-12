# Survey for the 3D and editors ship plan

Measured 2026-11-12 for [`../plans/2026-11-12-ship-3d-and-editors.md`](../plans/2026-11-12-ship-3d-and-editors.md), one
session, no subagents, no product code. Every number below was printed by a command; what was not measured is listed in
the last section.

**The tree measured.** Part A starts from a `main` that has `claude/pixi-3d-public` merged, so the measurements ran in a
scratch worktree outside the repository: `origin/claude/pixi-3d-public` (`be6db992`) merged with `origin/main`
(`d401ec4d`). **That merge does not apply cleanly**: three conflicts (`docs/superpowers/progress.md`,
`extensions/figures/src/features/view/cell-sprite.ts`, `extensions/figures/tests/unit/view/template.test.ts`; `main` is
33 commits ahead of the branch's base). For measuring, the branch's side was taken in all three. The trial build
configuration, the trial manifest edits and the scratch merge were never committed here.

## 1. `@automata/3d`'s entries, and who imports each

`packages/3d/package.json` has 13 entries. Importers are counted from source (`import … from`), outside `packages/3d`,
tests and configs included.

| Entry | Importing packages | Who |
| --- | --- | --- |
| `.` | 11 | editor-3d, tools (template text), character-kit, lcd-panel, retro-crisp, world-kit, base-3d, examples-3d, 3d-story, examples-runner, frame-budget |
| `./no-eval` | 11 | the same eleven |
| `./level` | 11 | editor-3d (146 imports), tools, cutscenes, editors, interact, sectors, world-kit, base-3d, examples-3d, 3d-story, frame-budget |
| `./figures` | 8 | editor-3d, tools, character-kit, base-3d, examples-3d, 3d-story, examples-runner, frame-budget |
| `./sim` | 5 | tools, base-3d, examples-3d, 3d-story, frame-budget |
| `./world-content` | 5 | editor-3d, tools, world-kit, base-3d, 3d-story |
| `./base` | 4 | character-kit, world-kit, examples-3d, 3d-story |
| `./testing-checks` | 4 | character-kit, lcd-panel, retro-crisp, examples-3d |
| `./camera-view` | 2 | editor-3d, character-kit |
| `./figures-kit` | 2 | character-kit, examples-3d |
| `./testing` | 2 | character-kit, examples-3d |
| `./props-kit` | 1 | world-kit (33 imports) |
| `./timeline` | 1 | cutscenes |

Every entry has an importer outside the package; none can be dropped.

## 2. The import graph, and what must publish

Direct `@automata/*` imports from each package's source (not its `package.json`), private ones marked `*`:

| Root | Imports |
| --- | --- |
| the 3D template (`create-game --template 3d`) | framework, content, sim, tools, 3d\* (`.`, `/sim`, `/level`, `/figures`, `/world-content`) |
| `games/base-3d` | content, framework, sim, 3d\* |
| `examples/3d` | framework, content, 3d\*, character-kit\*, cutscenes\*, lcd-panel\*, retro-crisp\*, world-kit\* |
| `examples/3d-story` | framework, debug, puzzle, sim, 3d\*, nav\*, sectors\*, systems\* |
| `examples/2d-story` (in the playground) | framework, content, sim, debug, audio-synth, feel, puzzle, systems\*, cutscenes\*, narrative\*, nav\*, level-2d\* |
| `packages/editor-3d` (a page) | framework, editor\*, 3d\* |
| `extensions/editors` (a page) | framework, content, audio-synth, feel, puzzle, editor\*, 3d\*, systems\*, nav\*, cutscenes\*, narrative\* |

Transitive, private only: character-kit → figures; cutscenes → 3d; nav → sectors, places; sectors → 3d, places
(and the published physics); systems → sectors, nav, places; narrative → sectors, places; level-2d → places;
world-kit, lcd-panel, retro-crisp → 3d.

**Must publish (13):** `3d`; `places`, `sectors`, `nav`, `systems`, `narrative`, `level-2d`, `cutscenes`; `world-kit`,
`lcd-panel`, `retro-crisp`; `figures`, `character-kit`.

**Dependency order:** `3d` → {`places`} → `sectors` → `nav` → {`systems`, `narrative`} → `level-2d`; `cutscenes`,
`world-kit`, `lcd-panel`, `retro-crisp` need only `3d`; `figures` → `character-kit`.

**Stay private, because nothing public imports them:**

- `interact`, `hud`: no template, example, editor or playground source imports either (the spec lists both).
- `pipelines`: imported by nothing. Its source imports the private `editor` and Node tools (`playwright`, `vite`,
  the MCP SDK). Its `package.json` also names `3d`, `nav` and `sectors`, which its source never imports.
- `editor`, `editor-3d`: sources of pages. A page is bundled, so its sources need not publish; the built page does.

`@automata/tools` imports `@automata/3d` and `@automata/editor` only inside template text and the editor build's path.

## 3. Each package to publish, as it is

Lines are `.ts` and `.svelte` under `src/`. "ID errors" is `tsc -p . --noEmit --isolatedDeclarations true` counting
`TS9xxx`: the shared tsdown build writes declarations with isolatedDeclarations, so each is an export that needs a written
type before the package can build. A dash means the flag is already on in that package's `tsconfig.json`.

| Package | Lines | Entries | README | Unit / browser test files | Non-code under `src/` | ID errors | Needs beyond a plain tsdown config |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `3d` | 25,425 | 13 | yes | 145 / 21 | 3 JSON libraries (imported `with { type: 'json' }`, bundled); `testing/model/fixtures` (`.glb`, `.pack`, `.md`) | — | `vitest` as an optional peer; the testing fixtures (below) |
| `figures` | 14,703 | 3 | yes | 54 / 4 | 8 JSON libraries | **174** | the declarations step (`tsconfig.types.json`, `types/`) is replaced by the build |
| `character-kit` | 4,989 | 2 | yes | 29 / 10 | none | 16 | |
| `world-kit` | 7,186 | 3 | yes | 23 / 6 | none (38 recorded PNGs under the package) | 17 | |
| `lcd-panel` | 379 | 2 | yes | 4 / 3 | none | 2 | |
| `retro-crisp` | 718 | 2 | yes | 7 / 4 | none | 4 | |
| `cutscenes` | 1,956 | 8 | yes | 13 / 2 | `.svelte`, `.toml` | — | the Svelte build (`svelte-package`, as `debug` and `net-ui` do) |
| `narrative` | 4,639 | 7 | yes | 25 / 2 | `.svelte`, `.toml`, `.md` | — | the Svelte build |
| `sectors` | 1,168 | 5 | yes | 9 / 1 | JSON | — | |
| `nav` | 661 | 3 | yes | 7 / 1 | `.toml` | — | how the `.toml` is read |
| `systems` | 4,204 | 6 | yes | 23 / 1 | `.toml`, JSON | — | how the `.toml` is read |
| `places` | 91 | 1 | yes | 1 / 0 | none | — | |
| `level-2d` | 626 | 2 | yes | 4 / 1 | none | — | |

**The trial build of `@automata/3d`** (a `tsdown.config.ts` naming the 13 entries through `publishedBuild`,
`platform: 'browser'`):

1. First run fails: `vitest is located in node_modules but is not included in deps.onlyBundle` (also `chai`,
   `tinybench`, `expect-type`, `magic-string`). `src/testing/golden-checks.ts` and `motion-goldens.ts` import `vitest`,
   a devDependency. `@automata/framework` solves the same thing with `vitest` as an optional peer (`^5.0.3`).
2. With that peer added: **builds in 0.9 s**, `dist/` 1.2 MB on disk, **packs to 307,703 bytes**.
3. A defect the build does not report: `src/testing/compile-fixture.ts:15` and `motion-goldens.ts:46` read
   `join(import.meta.dirname, '../../tests/fixtures…')`. From `dist/` that path leaves the package, and `tests/` is not
   packed. `./testing` works only inside the workspace until the fixtures ship in `dist` or the path is fixed.
4. `sideEffects` names three source files; a built package must also name their `dist` outputs, or a bundler may drop
   the no-eval install and the classic garment registration.

Exported names and undocumented exports per package were **not measured**: `pnpm api-index` reads only the packages in
its own entry list, and adding thirteen was not done in a scratch copy. Each task measures it first.

## 4. The 3D stranger's journey with the trial build

`AF_BETA_3D=1 pnpm exec playwright test tests/e2e/stranger-3d.test.ts --trace off` in `tooling/consumer-smoke`, after
`pnpm build` (17 tasks, 29 s), with the trial `@automata/3d` packed.

| Step | Result |
| --- | --- |
| make a 3D game | pass |
| install it (`@pixi/3d` from npmjs.org) | pass |
| check it (the audit's failing step: `test`, `no-eval`, `secrets`, `data-urls`) | pass |
| test it | pass |
| build it (`build:web`) | pass: the game's `dist/` holds `index.html` and `assets/` |
| play it and walk Wick | **fail**, after the 20-minute test limit. The page loaded and reached `data-state="ready"`; the click on Play never landed: `<div role="status" data-testid="rotate-hint" class="af-rotate-hint">… from <div data-layer="overlay"> subtree intercepts pointer events` (2,195 retries). The journey's one project is `sizes.phone` (upright), and the 3D game asks an upright phone to turn. Not a renderer or GPU failure: the walk itself was never reached |

So the audit's one cause is confirmed: with `@automata/3d` built, the journey goes four steps further than it ever has.
The next failure, in order, is the journey's own: at phone size, upright, the rotate hint covers Play. Whether Wick
then walks on SwiftShader is still unknown.

## 5. The painter (`extensions/figures`)

- 44 commits touch the folder. `package.json` says `"license": "MIT"`; there is **no `LICENSE` file in the folder** (the
  root has `LICENSE` and `LICENSE-SCOPE.md`).
- No image, font, sound or model is bundled. Non-code files: 8 JSON libraries under `src/shared/*/library/` (hair,
  times, actions, swatches, items, seats, gaits, poses), `viewer/index.html`, two documents, and the recorded goldens
  under `tests/fixtures/golden/` (12 `.rgba.gz` frames of the base pair and four JSON files), which are not packed.
- A search of `src/`, `docs/` and `viewer/` for "Last Light", "FloorFifty", "Floor Fifty" finds nothing.
- **One third-party item to record:** the painter's palette is named DUEL (`src/shared/paint/duel-ramps.ts` and eleven
  other files). A named palette has an author; its source and terms are not recorded in the folder.
- The door: root `boundaries` runs `--confine @automata/figures:extensions/character-kit/src/shared/figures` over
  `packages extensions games examples tooling`. Only that folder may import the painter. Publishing does not need it
  widened.
- 174 exports lack a written type (section 3): the largest single cost in Part B.

## 6. The editors

| Build | On disk | Gzipped as one archive |
| --- | --- | --- |
| the 2D suite (`packages/editor/dist/suite`) | 1,560 kB | 561,954 bytes |
| the full suite, 2D and 3D (`packages/editor-3d/dist/suite`) | 2,600 kB | 902,933 bytes |
| the content editors (`extensions/editors/dist/suite`) | 1,944 kB | 681,874 bytes |

- `@automata/tools` packs to **2,577,117 bytes** today (2.46 MiB; the spec says 2,513 kB) against 3 MiB.
- An editors package with the full suite and the content editors: about **1.58 MB** packed. With the 2D suite too: about
  **2.15 MB**. `-tools` without the 2D suite: about **2.02 MB**.
- `-tools` with the full suite added: about 3.48 MB, over its budget, as the spec says.

## 7. `@pixi/3d` 0.1.0 against 0.1.0-beta.3

`npm pack` of both from npmjs.org, unpacked into two empty folders, `diff -rq`.

- 60 `.mjs` files and 15 `.d.ts` files differ. 0.1.0 drops the CommonJS builds (`.js`, `.d.cts`).
- The same five `exports` (`.`, `./extras`, `./package.json`, `./webgl`, `./webgpu`); the same peer `pixi.js ^8.23.0`.
  AF's source imports `@pixi/3d` 47 times and `@pixi/3d/extras` once (`packages/3d/src/testing/bundle/extras-entry.ts`,
  the bundle guard's fixture).
- `pixi.js` is already 8.23.0 in `packages/3d` on the merged tree (the beta.3 port moved it).

Changed runtime files outside `math/` and `extras/`, by area, and the AF files that name those parts:

| Area in 0.1.0 | Files | AF depends on it in |
| --- | --- | --- |
| lighting | `core/LightDataList`, `LightTiles`, `gl/LightingSystemGl`, `gpu/LightingSystemGpu`, `shader/createLightingBit` | `packages/3d/src/features/look` (3 files), the fog conversion in `shared/render` |
| materials and uniforms | `gl/shader/MaterialSystemGl`, `globalBitGl`, `gpu/shader/MaterialSystemGpu`, `globalBitGpu`, `GlobalUniformGroup`, `materials/BaseMaterial3D` | `features/renderer/no-eval` (the uniform sync, 1 file); the painter's cell template, a copy of the default material template (`extensions/figures/src/features/view`, 4 files; `template.test.ts` fails in words when the original moves) |
| shadows | `gpu/ShadowRenderPassGpu`, `render-passes/shadow/ShadowRenderPassBase` | `features/look` |
| batching and instances | `batcher/Mesh3DBatch`, `buffers/InstanceDataStoreBuffer`, `gpu/renderForwardBatchesGpu` | `shared/render/views` (2 files) |
| passes and graph | `render-graph/RenderGraph`, `background/BackgroundPass`, `copy-opaque/CopyOpaquePass`, `output/ColorOutputDraw`, `passBitRegistry`, `post-processing/effects/FullscreenPass`, `scene/utils/createDefaultGraph3D` | world-kit's sky and looks, lcd-panel, retro-crisp |
| scene | `scene/Sprite3D`, `View3D`, `ParticleContainer3D`, `CameraData`, `validateCamera` | the painter's `cell-sprite.ts`; `features/camera/occluders` (1 file) |
| glTF | `loadGlb`, `processMaterials`, `processMeshes`, `loadImages`, `decodeDracoPrimitive` | `shared/render/model` |
| textures, image-based light | `textures/DefaultTextures`, `ibl/generateIblSpecialCubemap` | none found by name |

Recorded files that Part D may move: `packages/3d` (12 golden files), `extensions/figures` (21),
`extensions/character-kit` (5), `examples/3d` (3), and world-kit's 38 PNGs.

## 8. What contradicts the spec

1. The spec's Part B list has 15 kits. The import graph needs 12 (plus `3d`): `interact`, `hud` and `pipelines` have no
   public importer.
2. The spec says `-tools` packs to 2,513 kB; it is 2,577 kB now.
3. `pixi.js` 8.23.0 is already in `packages/3d` once `claude/pixi-3d-public` merges; Part D's `pixi.js` move is partly
   done by the beta.3 port.
4. `claude/pixi-3d-public` conflicts with `main` in three files, two of them the painter's. Its step 3 (proof) was "not
   started" in its own record.
5. The shared build needs isolatedDeclarations: five packages (213 errors together) cannot be "built like the
   framework" by adding a config alone.

## 9. Not measured

- Exported names and undocumented exports per package (needs each package in `tooling/api-index`'s entry list).
- Packed sizes of the twelve kits (only `3d` was trial-built).
- The journey after the Play click (blocked by the rotate hint), every browser suite, and anything on WebKit or Firefox.
- `claude/editor-journeys-green` (not fetched).
- The DUEL palette's source and terms (no network search was made).
- The pixels of 0.1.0: only the file lists were compared.
