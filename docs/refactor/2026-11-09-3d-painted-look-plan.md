# 3D at the references' level: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task,
> with superpowers:test-driven-development for every code change and superpowers:verification-before-completion before
> ticking a box. Native, in the session: the Owner allows no subagents (no Task-tool delegation, no workflows). Steps use
> checkbox (`- [ ]`) syntax. Tick a step only when its check has passed, in the same session.

**Goal:** a 3D game drawn at the level of the Owner's references: FigureBuilder's painted figures standing in rooms of
photo textures, stepped lamp light, haze, glow and weather, drawn live by Pixi 3D at a 360 px field, with Levels 3D
able to build such a room and Ember Hall rebuilt in it.

**Architecture:** Pixi 3D draws every frame. The world's pieces take a tile material (the tile's DUEL texel × the baked,
stepped vertex light, hazed), tiles made at load by the photo pipeline at the scales the level's views see them. Figures
are FigureBuilder's painter's cells, painted on the CPU at one density per view, cached, lit as sprites, hazed and
snapped on the CPU, then composited at whole field pixels with a per-texel depth by a scene-stage `Pass3D`. Alpha codes
tell the post chain what each pixel is; the snap is OKLab. The world kit moves into `@automata/3d`, and one core
function draws a level for the game and the editor.

**Tech Stack:** pnpm 10, Node 24 (`/opt/node24/bin`), TypeScript, Zod 4.6.6, PixiJS 8.22.0, `@pixi/3d` 0.1.0-beta.2
(vendored), Svelte 5.57, Vitest 5 (browser mode), Playwright 1.63.

**Spec:** [2026-11-09-3d-painted-look-spec.md](2026-11-09-3d-painted-look-spec.md) (sections cited as "spec N"). **Audit:**
[2026-11-09-3d-painted-look-audit.md](2026-11-09-3d-painted-look-audit.md). **Plan audit:** not yet run.

**Sources** (read from, never imported; each port gets its row in `docs/provenance/sources.md`):
FigureBuilder `025ffb4` (`/home/user/FigureBuilder` or a fresh clone of `mcthaydt/figurebuilder`), EnvironmentBuilder
`6d82a52` (`mcthaydt/environmentbuilder`). Paths below are relative to those repositories' roots.

## Global Constraints

- AF's laws and `AGENTS.md` hold: TDD (failing test first, confirm it fails for the right reason), files at most 600
  lines, feature folders (`app/`, `features/<x>/`, `shared/`, `entries/`, `testing/`), tests in `tests/` importing
  `#src/…`, `pnpm boundaries`, comments that say why and name no plan task.
- `pnpm format` then `pnpm check` before every commit; Conventional Commits ending with the session's attribution lines.
- PixiJS only for rendering (law 6): Pixi 3D draws every frame; a painted cell is a texture it draws. No CPU frame.
- Every colour on a frame is a DUEL colour. The snap is OKLab nearest, the first winning a tie (`nearestDuel`).
- The field's short side is **360** (the Owner, 2026-11-09 07:27). A frame-time miss goes to the Owner; never lower it
  quietly.
- Figure density: `clamp(round(4 × P ÷ 36.9) ÷ 4, 1, 3)`, `P = short ÷ (2 × distance × tan(fovShort ÷ 2))`.
- EnvironmentBuilder's look numbers, verbatim: `light { step 0.1, gain 1.0, max 1.6 }`; `haze { colour #47655a, near 0,
  far 10, amount 0.85, glow 0.5 }`; `dither { strength 0.04 }`; `figureShadow 0.6`; `figureLight { ambient 1.5, threshold
  0.22, ink 40, floor 0.5, rim 0.35, floorCap 0.8 }`; lamp kit as `features/world/library/lamp-kit.json` (`tone 0.06`).
- Alpha codes: `none 0`, `sky 160/255`, `painted 192/255`, `glowing 224/255`, `world 1`.
- The world outline stays off (spec F16). The world kit's things become core's; the character kit stays an extension.
- No committed tiles; the photo pipeline runs at load and in the checks.
- `@automata/3d`, the editors and the games are private: no changeset. `@automata/tools` (the create-game templates)
  gets a `patch` changeset when a template changes. After an exported type of a published package changes:
  `pnpm build`, `pnpm api-report --update`, `pnpm api-index --write`.
- Base-3d's replay hash never moves. A parity image that moves is opened, its expected, actual and diff looked at, and
  the move explained in the commit.
- Copy in `docs/refactor/copy.md` under "3D editors"; 44 px targets, 48 px primary actions; phone first; the drunk
  grandma test. Chromium runs here; WebKit, Firefox, WebGPU and `3d.yml` are the GPU runner's, listed as not run.
- Every audit of this work also makes a small 3D game in the editors, plays it, reloads, closes and reopens, and
  confirms the work is still there (the Owner's standing rule).

## Review Focus

1. **A photo that fails to fetch or decode** (offline, a corrupt PNG, a swatch naming a photo the library lacks): the
   level still draws, that swatch in its flat DUEL colour, with one warning naming the swatch. Test in Task 13:
   `a photo that does not load draws its swatch flat and says which`.
2. **A view change while a figure walks** (a new density): no frame shows the figure without a cell; the old cell shows
   until the new one is painted. Test in Task 9: `a view change never leaves a figure undrawn`.
3. **A lost context and Try again:** the tiles, the cells and the figure layer come back with the rebuilt `View3D`.
   Test in Task 9: `after Try again the figures and the tiles draw again`.
4. **A phone held upright** (390 × 844): the field is 360 × 779, the density is taken from the short side, a figure's
   cell lands on whole pixels. Test in Task 9: `an upright phone draws a figure on whole pixels at density 2`.
5. **Eight figures walking past the cache's cap:** the cache stays under its bytes, evicts the least recently shown,
   and never evicts a cell on screen this frame. Test in Task 7: `a full cache never drops a cell shown this frame`.
6. **Two figures overlapping, and a figure behind a table:** the nearer texel wins per pixel. Test in Task 9:
   `the nearer figure's texels win where two overlap`.
7. **A material changed in Levels 3D, then Undo:** the view draws the old tile again without fetching its photo twice.
   Test in Task 25: `undoing a material change draws the old tile from the cache`.

## Where these tasks go

The build runs on its own branch, stacked on this plan's branch (`claude/project-thread-5izi62`, PR #570), in the order
below; each phase ends at a green `pnpm check` and a push. Six phases, 29 tasks. Session breaks are marked. Progress:
`docs/refactor/progress.md`, section "3D at the builders' level", stage 4 (build), one row per task with its evidence.

---

## Phase A: proofs first

### Task 1: The composite pass and the alpha codes (spec 4.6, 5.4)

The pass everything else draws figures with, and the codes the post chain reads. If either cannot be built on both
backends, stop and record it: the fallback (spec 10) needs a plan change.

**Files:**
- Create: `packages/3d/src/features/look/alpha-codes.ts`, `packages/3d/src/features/figures/layer/cell-composite-pass.ts`,
  `docs/adr/0008-3d-figures-are-painted.md`
- Modify: `docs/adr/0002-pixi-for-2d-and-3d.md` (a consequence line), `docs/adr/0007-3d-look.md` (superseded for figures)
- Test: `packages/3d/tests/browser/parity/look/composite.parity.test.ts`, `packages/3d/tests/unit/look/alpha-codes.test.ts`

**Interfaces:**
- Produces: `ALPHA: { readonly none: 0; readonly sky: number; readonly painted: number; readonly glowing: number;
  readonly world: 1 }` (`160 / 255`, `192 / 255`, `224 / 255`); `alphaCodeGlsl(): string` and `alphaCodeWgsl(): string`
  (constants and `isPainted(a)`, `isGlowing(a)`, `isSky(a)`, `isWorld(a)`, `isDrawn(a)`, each true within half a byte of
  its code); `class CellCompositePass extends Pass3D` with `stage = 'afterTransparent'` and
  `show(cells: readonly PlacedCell[]): void`;
  `interface PlacedCell { readonly colours: Texture; readonly depth: Texture; readonly x: number; readonly y: number;
  readonly width: number; readonly height: number; readonly rootDepth: number }` (`x`, `y` the top-left field pixel,
  whole numbers; `depth` an `r32float` texture of metres toward the camera from the root, FigureBuilder's G-buffer
  convention; a texel's view depth is `rootDepth − depth`).

- [ ] **Step 1: Write the failing tests**

```ts
it('codes sit half a byte apart or more', () => { // alpha-codes.test.ts
  const codes = [ALPHA.none, ALPHA.sky, ALPHA.painted, ALPHA.glowing, ALPHA.world].map((a) => Math.round(a * 255))
  expect(codes).toEqual([0, 160, 192, 224, 255])
})
it('a cell lands on its pixels with its colours unchanged', async () => { // composite.parity.test.ts
  const { pixels } = await drawWith({ cells: [cellAt(10, 20, CHECKER_4x6)] })
  expect(region(pixels, 10, 20, 4, 6)).toEqual(CHECKER_4x6.rgb) // every DUEL colour of the cell, byte for byte
})
it('a box in front hides the texels behind it', async () => {
  const { pixels } = await drawWith({ cells: [cellAt(10, 20, SOLID, { rootDepth: 6 })], box: { nearer: 4, covers: [10, 23, 4, 3] } })
  expect(region(pixels, 10, 23, 4, 3)).toEqual(boxColours(4, 3))
})
it('the snap leaves painted pixels alone and the finish writes alpha 1', async () => {
  const { pixels, alpha } = await drawWith({ cells: [cellAt(0, 0, NEAR_TWO_DUEL)], snap: true, finish: true })
  expect(region(pixels, 0, 0, 4, 6)).toEqual(NEAR_TWO_DUEL.rgb)
  expect(new Set(alpha)).toEqual(new Set([0, 255]))
})
it('the glowing code survives the forward pass to the post chain', async () => {
  expect(await codeSeenByPost({ material: 'glowing' })).toBe(224)
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @automata/3d exec vitest run --project browser tests/browser/parity/look/composite.parity.test.ts`
Expected: FAIL (`cell-composite-pass.ts` does not exist).

- [ ] **Step 3: Implement `alpha-codes.ts` and `CellCompositePass`**

The pass adds one graph pass at `afterTransparent` that draws one quad per placed cell into `graph.sceneColor` with
the depth test on and depth writes on; the fragment reads the cell's texel with `texelFetch` (WGSL `textureLoad`),
discards alpha under the painter's cut (FigureBuilder `OPAQUE`), writes `vec4(rgb, ALPHA.painted)` and the texel's own
depth (`gl_FragDepth` / `@builtin(frag_depth)` from `rootDepth − depth` through the camera's projection). Quad corners
are whole field pixels in NDC. GLSL and WGSL twins. A test-only `FinishEffect` stub (alpha to 1 where drawn) may live in
the test file until Task 12 builds the real one.

- [ ] **Step 4: Run the tests on WebGL2 here; mark WebGPU for the GPU runner**

Run: as Step 2. Expected: PASS on WebGL2 (Chromium). The WebGPU cases are `it.runIf(hasWebGPU)`; list them as pending.

- [ ] **Step 5: Write ADR 0008** ("3D figures are painted": the decision, the composite, the alpha codes, law 6, what it
  supersedes in 0007, the `Sprite3D` fallback not taken and why). One consequence line in 0002.

- [ ] **Step 6: Commit** `feat(3d): a composite pass for painted cells, and the look's alpha codes` (with the ADR).

### Task 2: The oracles (spec 9)

Fixtures from the sources, run once, committed with the source commit they came from. Every later port is held to them.

**Files:**
- Create: `packages/3d/scripts/oracles/figurebuilder-cells.ts`, `packages/3d/scripts/oracles/environmentbuilder-look.ts`,
  `packages/3d/scripts/oracles/README.md` (how to run each in a checkout of its source at its commit),
  `packages/3d/tests/fixtures/oracles/figurebuilder-025ffb4/` (`frames.json`, `soups.bin`, `cells/*.png`),
  `packages/3d/tests/fixtures/oracles/environmentbuilder-6d82a52/` (`vertex-light.json`, `shade.json`,
  `sprite-light.json`, `tiles.json`, `cells/*.png`), `packages/3d/src/testing/oracles.ts`
- Test: `packages/3d/tests/unit/oracles/oracles.test.ts`

**Interfaces:**
- Produces: `figureBuilderFrames(): OracleFrame[]` and `environmentBuilderLook(): EbOracle` (Node only, `testing/`);
  `interface OracleFrame { readonly id: string; readonly member: 'base-m' | 'base-f'; readonly density: number;
  readonly yaw: number; readonly pitch: number; readonly cell: readonly [number, number]; readonly feet: readonly [number,
  number]; readonly soup: Soup; readonly decals: readonly ViewDecal[]; readonly face: FaceStamp | null;
  readonly hands: readonly HandStamp[]; readonly md5: string }` (types from Task 5's port);
  `interface EbOracle { vertexLight: { scene: string; time: string; at: V3; normal: V3; light: V3 }[]; shade: { albedo:
  number; light: V3; share: number; x: number; y: number; out: number }[]; spriteLight: { cell: string; lamps:
  SpriteLamp[]; md5: string }[]; tiles: { swatch: string; texels: [number, number]; md5: string }[] }`.

- [ ] **Step 1: Write the failing test**: `the fixtures name their source commits and parse` (12 frames; each soup's
  triangle count above 0; 200 light points a scene for `base-interior` at `lampLit` and `base-exterior` at `day`; 500
  shade samples; 2 sprite-light cells; 3 swatches × 3 pairs of tiles).
- [ ] **Step 2: Run it**: `pnpm --filter @automata/3d exec vitest run --project unit tests/unit/oracles` → FAIL (no
  fixtures).
- [ ] **Step 3: Write and run `figurebuilder-cells.ts`** in a FigureBuilder checkout at `025ffb4`
  (`npx vite-node <path>/figurebuilder-cells.ts --out <AF>/packages/3d/tests/fixtures/oracles/figurebuilder-025ffb4`).
  The twelve frames: each base pair member at density 1 and 2, in the hero made pose (`figure/frames.ts`), standing at
  yaw 45° and 180°, and walk pose 3 at yaw 90°. Each frame writes the soup `soupOf` made (`verts`, `tris` as
  little-endian bytes into `soups.bin`, offsets in `frames.json`), the decals, the face and hand stamps, and the md5 of
  the painted cell (`painted` bytes); four frames also as PNG.
- [ ] **Step 4: Write and run `environmentbuilder-look.ts`** in an EnvironmentBuilder checkout at `6d82a52`:
  `vertexLight` at 200 points a scene (vertices of the built scene, every 7th, seeded order); `shade`'s `colourOf` on
  500 sampled (albedo, light, haze share, x, y) from the base interior's diorama frame; `lightCell` on the base pair's
  density-2 standing cell under the interior's pendant and the exterior's sun; the tile labels' md5 for `oakFloor`,
  `brickRed` and `asphalt` at (64, 64), (64, 22.6) and (45, 45).
- [ ] **Step 5: Run the test**: PASS. **Commit** `test(3d): oracles from FigureBuilder 025ffb4 and EnvironmentBuilder
  6d82a52` (the message names both commits and the commands).

---

## Phase B: the world kit comes into core (spec 6)

### Task 3: Move the world kit into `@automata/3d` (**session break** after the move map)

A move, not a rewrite, except the PNG decode (async, `DecompressionStream`) and what spec 5.2 deletes. Tests move with
their code and pass unchanged but for their imports.

**Files:**
- Create: `docs/refactor/move-map-world-kit.json` (every file's old and new path, as the other move maps)
- Move (`git mv`), by the map:
  - `extensions/world-kit/src/features/textures/{pipeline,tile,colour,texture-spec,structure,png}.ts` →
    `packages/3d/src/features/photo/`; `photos.ts` → `features/photo/photo-library.ts` (the index and `photoSource` on
    bytes) and `packages/3d/src/testing/photo-files.ts` (reading a photo's bytes from disk, for Node);
    `swatch-tiles.ts`'s `textureOf`, `ladderOf`, `swatchTile` → `features/photo/swatch-tile.ts`;
    `check-reads.ts`, `swatch-issues.ts` → `features/photo/reads.ts`
  - `assets/photos/*` and the photo index → `packages/3d/src/features/photo/library/` (`photos.json`, `photos/*.png`)
  - `src/features/furnish/*` → `features/world/furnish/`; `src/features/maps/*` → `features/world/maps/`;
    `src/features/props/*` → `features/world/props/kit/`; `src/features/reads/*` → `features/world/reads/`;
    `src/shared/lettering/lettering.ts` → `features/world/lettering.ts`; `src/shared/{piece-helpers,turn}.ts` →
    `features/world/props/kit/`
  - `library/{kits,props,swatches,glyphs,words}.json`, `library/maps/` → `packages/3d/src/features/world/library/`
  - `src/features/sky/*` → `packages/3d/src/features/look/passes/`
  - `src/app/dressed-base-scenes.ts` → `features/world/base/dressed-base-scenes.ts`; `src/app/world-kit-library.ts` →
    `features/world/base/core-library.ts`
  - tests: `tests/unit/{furnish,maps,props,lettering,reads}` → `packages/3d/tests/unit/world/…`,
    `tests/unit/textures` → `packages/3d/tests/unit/photo/`, `tests/unit/{dressed-base,library}.test.ts` →
    `tests/unit/world/base/`, `tests/browser/sky` → `packages/3d/tests/browser/parity/look/sky-passes.test.ts`,
    `tests/fixtures/*` → `packages/3d/tests/fixtures/world/`
- Delete: `extensions/world-kit/` (package, README, `textures-cli.ts`, `textures-command.ts`, `library/tiles/`, the
  tile file format, `staleTiles`, `encodeLabels`, `decodeTileFile`, the extension definition), its workspace entry
- Modify: `packages/3d/src/entries/{index,props-kit,base}.ts`, `packages/3d/src/features/world/build.ts` (the
  `needs-extension` note for a kit name goes: core has the kit), `packages/3d/package.json` (`sideEffects` gains
  `./src/features/world/props/kit/register-kit-props.ts`), `examples/3d/package.json` and `examples/3d/worldkit/*.ts`
  (import core), `tooling/examples-runner/src/catalog.ts`, `packages/3d/README.md`, `docs/versions.md`,
  `docs/provenance/sources.md` (paths), `docs/refactor/2026-11-07-3d-scope-trim.md` (one line under section 2: "Reversed
  for the world kit by 2026-11-09-3d-painted-look-spec.md section 6; the rows stay readable")
- Test: the moved tests; `packages/3d/tests/unit/photo/png.test.ts`; `packages/3d/tests/unit/photo/reads.test.ts`

**Interfaces:**
- Produces: `decodePng(bytes: Uint8Array): Promise<Image>` (`features/photo/png.ts`, inflating with
  `new DecompressionStream('deflate')`); `photoSource(bytes: Uint8Array, photo: Photo, facet: number, flatten: number):
  Promise<PhotoSource>` (`photo-library.ts`); `PHOTOS: PhotoLibrary` (the index); `photoUrl(name: string): string`
  (`features/photo/photo-urls.ts`, from `import.meta.glob('./library/photos/*.png', { eager: true, query: '?url',
  import: 'default' })`); `coreLibrary: WorldLibrary` (`{ ...baseLibrary, ...kit }`, from `@automata/3d/base`);
  `DRESSED_BASE_SCENES` (`base-interior-dressed`, `base-exterior-dressed`, from `@automata/3d/base`); `dressLevel`,
  `generateMap`, `MAP_NAMES`, `readsAgainst`, `figureReads` from `@automata/3d/props-kit`; `addSkyPasses` and the three
  effects from `@automata/3d` until Task 17 folds them into the look. In tests only: `photoBytes(name: string):
  Uint8Array` (`#src/testing/photo-files.ts`).

- [ ] **Step 1: Write the move map**, then the failing tests that pin the new places:

```ts
it('decodes a photo with the platform inflater', async () => { // png.test.ts
  const image = await decodePng(photoBytes('asphalt'))
  expect([image.width, image.height]).toEqual(SIZES.asphalt)
})
it('every textured swatch passes its reads, made from its photo', async () => { // reads.test.ts (was the tile check)
  for (const [name, swatch] of texturedSwatches(coreLibrary)) expect(await readsIssues(name, swatch)).toEqual([])
}, 120_000)
it('core has the kit: a preset naming a chair builds', () => { // tests/unit/world/props.test.ts
  expect(buildWorld(levelWith({ use: 'chair.wood' }), coreLibrary).problems).toEqual([])
})
```

- [ ] **Step 2: Run them**: FAIL (old paths).
- [ ] **Step 3: Move by the map**, fix imports, make `decodePng` async with `DecompressionStream` (and every caller
  `await`), register the kit's generators in core (`register-kit-props.ts`, loaded by `features/world/base/core-library.ts`),
  delete what the Files list deletes.
- [ ] **Step 4: Run**: `pnpm --filter @automata/3d exec vitest run --project unit` → PASS (the moved tests' counts equal
  the extension's before the move, minus the deleted tile-file tests, which the log names);
  `pnpm --filter @automata/3d exec vitest run --project browser tests/browser/parity/look/sky-passes.test.ts` → PASS;
  `pnpm boundaries`, `pnpm knip`, `pnpm check` → PASS.
- [ ] **Step 5: Commit** `refactor(3d): the world kit is core: props, kits, the dresser, maps, lettering, photos and sky
  passes` (the message says no tile is committed any more and why).

---

## Phase C: figures painted (spec 4)

### Task 4: The painter's format (spec 4.1; audit F3, F4)

**Files:**
- Modify: `packages/3d/src/features/figures/content/swatch.schema.ts`, `figure/figure.schema.ts`,
  `figure/garment.schema.ts` (a decal's `density` and `print`), `figure/materials.ts`,
  `features/figures/base/base-pair.ts` (the base pair's skin and hair swatches take FigureBuilder's `paint` and `tones`
  from `base/base.ts` and `outfit/library/swatches.json` at `025ffb4`)
- Create: `packages/3d/src/features/figures/paint/painter-material.ts`
- Test: `packages/3d/tests/unit/figures/content/swatch.schema.test.ts`, `tests/unit/figures/figure/materials.test.ts`

**Interfaces:**
- Produces: the swatch's optional painter fields `lift`, `paint` (four `#rrggbb`), `tones` (three numbers), `strands`,
  `sheen`, `streaks`, `mix` (`{ from, to, at }`), `stain` (`{ paint, hem, below }`), `holo` (`boolean | 'mirror'`),
  `see`, `fabric`; the figure's `face: { camera: number; turn: number; blink: boolean; drawn: boolean }` with
  FigureBuilder's defaults; `interface PainterMaterial` (FigureBuilder `body/parts.ts Material`'s fields, `ramp` a DUEL
  row index); `painterMaterials(built: Built): PainterMaterial[]` in the order of `built.materials`.

- [ ] **Step 1: Write the failing tests**: `a swatch with no painter field paints from its DUEL row` (`painterMaterials`
  gives `{ ramp, base: step + shade }` only); `the painter fields parse and reach the material` (each field round-trips);
  `the base pair's skin swatches carry FigureBuilder's paint and tones` (equal to the values at `025ffb4`);
  `a bad paint ramp names the swatch` (three colours → the schema's message names the field).
- [ ] **Step 2: Run** (`--project unit tests/unit/figures/content tests/unit/figures/figure`) → FAIL.
- [ ] **Step 3: Implement** the fields (Zod, optional, strict), `painterMaterials`, the base pair's values.
- [ ] **Step 4: Run** → PASS; every game's and example's figure content still compiles (`pnpm check`).
- [ ] **Step 5: Commit** `feat(3d): the painter's material and face fields come back to the figure format`

### Task 5: The painter's port (spec 4.1; audit section 5's table, F13) (**session break** after `raster.ts`)

**Files:**
- Create in `packages/3d/src/features/figures/paint/`: `raster.ts` (FigureBuilder `paint/raster.ts`: `gbuffer`,
  `rasterize`, `resolve`, `cleanup`, `neckline`, `blendJoins`, `smoothContour`, `stamp`, `stampPrint`, `noise3`),
  `duel-snap.ts` (`oklab`, `duel` over AF's `DUEL_RAMPS`, checked equal to FigureBuilder's table), `tones.ts`
  (`tonesOf`, `familyTones`, `darkOf`, `eyeWhite`), `face-stamp.ts` (`FaceStamp` and `stampFace`), `hand-stamp.ts`
  (`HandStamp`, `Bends`), `folds.ts` (folds, strands, streaks), `surface-materials.ts` (holo, mirror, see-through, stain,
  wash, sheen), `paint.ts` (`paint()`, under 600 lines, calling the others), `cloth.ts` (FigureBuilder `figure/cloth.ts`),
  `paint-cell.ts`
- Test: `packages/3d/tests/unit/figures/paint/{oracle,eyes,materials,neckline,prints,fabric,cloth}.test.ts` (the last
  five port FigureBuilder's `tests/features/paint/*` and `figure/cloth.test.ts` cases that draw with and without a
  feature)

**Interfaces:**
- Consumes: `PainterMaterial` (Task 4); `OracleFrame` (Task 2).
- Produces: `paintCell(input: CellInput): PaintedCell`;
  `interface CellInput { readonly soup: Soup; readonly decals: readonly ViewDecal[]; readonly materials: readonly
  PainterMaterial[]; readonly face: FaceStamp | null; readonly hands: readonly HandStamp[]; readonly bends: Bends;
  readonly cloth?: Cloth | undefined; readonly cell: readonly [number, number]; readonly feet: readonly [number, number];
  readonly neck: ReadonlySet<number> }`;
  `interface PaintedCell { readonly width: number; readonly height: number; readonly feet: readonly [number, number];
  readonly colours: Uint8ClampedArray; readonly normals: Uint8ClampedArray; readonly depth: Float32Array;
  readonly material: Int16Array }` (RGBA colours; RGBA normal map; depth in metres, larger nearer, as the G-buffer;
  the material per texel, which the sprite light reads for ink and eyes). `Soup`, `GBuffer`, `ViewDecal`, `FaceStamp`,
  `HandStamp`, `Bends`, `Cloth` keep FigureBuilder's shapes.

- [ ] **Step 1: Write the failing tests**

```ts
it.each(figureBuilderFrames())('paints $id as FigureBuilder does', (frame) => { // oracle.test.ts
  if (F13_FRAMES.has(frame.id)) return
  expect(md5(paintCell(inputOf(frame)).colours)).toBe(frame.md5)
})
it.each([...F13_FRAMES])('%s draws both eyes, which FigureBuilder dropped', (id) => {
  expect(eyesIn(paintCell(inputOf(frameById(id))))).toBe(2)
})
it('both eyes draw wherever the face template shows both', () => { // eyes.test.ts
  for (const c of everyFrontish(['base-m', 'base-f'], [1, 2, 4], [18, 25, 35])) expect(eyesIn(paintOf(c))).toBe(2)
})
```

`F13_FRAMES` names the oracle frames FigureBuilder painted with one eye (the hero pose: base-f at density 1, base-m at
density 2 at 25°; Task 2's script writes which). `eyesIn` counts the eye-white clusters on the eye row.

- [ ] **Step 2: Run** (`--project unit tests/unit/figures/paint`) → FAIL.
- [ ] **Step 3: Port** file by file in the order listed, each a faithful port rewritten in AF's style (kebab names, no
  `!`, why-comments). The F13 fix in `shaded()`: a texel whose material's ramp row equals the skin's ramp row
  (`skin~ear`) counts as skin, not as something worn. Seed the grain by part index exactly as the source does.
- [ ] **Step 4: Run** → PASS: every oracle frame but `F13_FRAMES` byte for byte; the eye tests; the ported feature
  tests.
- [ ] **Step 5: Open a FigureBuilder pull request** with the same `shaded()` fix and its test (FigureBuilder's own
  goldens re-recorded there in a named commit, as its `CLAUDE.md` asks). Link it in the log.
- [ ] **Step 6: Commit** `feat(3d): FigureBuilder's painter, ported, with both eyes drawn in a turned face` (one commit a
  file group is fine; the last names the oracle).

### Task 6: AF's figure into a soup (spec 4.1)

**Files:**
- Create: `packages/3d/src/features/figures/paint/soup.ts` (FigureBuilder `figure/figure.ts soupOf`, `handShapes`,
  `drawnFace`), `packages/3d/src/features/figures/paint/sprite-cheats.ts` (the head toward the camera by `faceTurn`, the
  three-quarter turn `THREE_Q = 0.2`, the head's lead in 30° steps)
- Modify: `packages/3d/src/features/figures/clips/evaluate.ts` (takes the camera-relative yaw for the cheats)
- Test: `packages/3d/tests/unit/figures/paint/soup.test.ts`

**Interfaces:**
- Consumes: `Built` (`figure/build.ts`), `paintCell` (Task 5).
- Produces: `soupOf(built: Built, world: readonly M[], view: CellView): { soup: Soup; decals: ViewDecal[]; face:
  FaceStamp | null; hands: HandStamp[]; feet: [number, number]; cell: [number, number] }`;
  `interface CellView { readonly yaw: number; readonly pitch: number; readonly density: number }` (yaw relative to the
  camera, pitch the camera's tilt snapped to 2°); `spriteCheats(relativeYaw: number, faceTurn: number): { readonly
  headYaw: number; readonly lead: number }`.

- [ ] **Step 1: Write the failing tests**: `the base pair standing gives FigureBuilder's soup` (for the oracle's
  standing frames: same triangle count, every vertex within 1e-5); `the cell is 64·D by 96·D for 2.6 m`;
  `a head at 45° turns 0.2 further toward the camera, none square on or in profile`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** If AF's soup differs from FigureBuilder's, find whether the build or the pose differs and
  make AF's match FigureBuilder's (the Owner's bar is FigureBuilder's figure); record each fix in the log.
- [ ] **Step 4: Run** → PASS, and AF's own figure tests (`--project unit tests/unit/figures`) still PASS.
- [ ] **Step 5: Commit** `feat(3d): a figure's pose into the painter's soup, with FigureBuilder's sprite cheats`

### Task 7: Cells: density, cache, prewarm, one paint a frame (spec 4.2, 4.3)

**Files:**
- Create in `packages/3d/src/features/figures/cells/`: `density.ts`, `cell-key.ts`, `cell-cache.ts`, `paint-queue.ts`
- Modify: `packages/3d/src/features/look/look.schema.ts` and `library/look.json` (`figures: { min: 1, max: 3,
  cacheBytes: 33554432 }`)
- Test: `packages/3d/tests/unit/figures/cells/{density,cache,queue}.test.ts`

**Interfaces:**
- Produces: `viewDensity(short: number, distance: number, fovShort: number, figures: LookFigures): number`;
  `interface CellKeyParts { readonly pose: string; readonly direction: number; readonly pitch: number; readonly density:
  number; readonly outfit: string; readonly item: string | null; readonly face: string }`; `cellKey(parts: CellKeyParts):
  string`; `class CellCache { constructor(capBytes: number); get(key: string): PaintedCell | undefined; put(key: string,
  cell: PaintedCell): void; hold(keys: Iterable<string>): void; readonly bytes: number }` (`hold` marks this frame's cells,
  which eviction skips); `class PaintQueue { request(key: string, priority: number, paint: () => PaintedCell): void;
  runOne(): string | undefined; readonly pending: number }` (lower priority first; one request a key).

- [ ] **Step 1: Write the failing tests**

```ts
it('takes density from the view', () => { // density.test.ts (fov of the Owner's lens: 2·atan(0.5))
  expect(viewDensity(360, 5, LENS, FIGURES)).toBe(2)
  expect(viewDensity(360, 7, LENS, FIGURES)).toBe(1.5)
  expect(viewDensity(360, 3, LENS, FIGURES)).toBe(3)
  expect(viewDensity(180, 5, LENS, FIGURES)).toBe(1)
})
it('a full cache never drops a cell shown this frame', () => { // cache.test.ts
  const cache = new CellCache(3 * CELL_BYTES)
  ;['a', 'b', 'c'].forEach((k) => cache.put(k, cellOf(k)))
  cache.hold(['a'])
  cache.put('d', cellOf('d'))
  expect(['a', 'b', 'c', 'd'].map((k) => cache.get(k) !== undefined)).toEqual([true, false, true, true])
  expect(cache.bytes).toBeLessThanOrEqual(3 * CELL_BYTES)
})
it('paints at most one cell a run, the most wanted first', () => { // queue.test.ts
  const q = new PaintQueue()
  q.request('walk-0', 2, paint); q.request('idle-0', 1, paint); q.request('walk-0', 2, paint)
  expect([q.runOne(), q.pending]).toEqual(['idle-0', 1])
})
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (the byte size of a cell is its four arrays' `byteLength`).
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(3d): figure cells at one density a view, cached in bytes and
  painted one a frame`

### Task 8: The sprite light, the haze and the snap on a cell (spec 4.4, 4.5)

**Files:**
- Create: `packages/3d/src/features/figures/cells/sprite-light.ts` (EnvironmentBuilder `stage/sprite-light.ts`, whole),
  `cells/sprite-lamps.ts` (EnvironmentBuilder `paint/vertex-light.ts spriteLights`: the lights at the chest, into the
  cell's frame), `cells/finish-cell.ts`, `packages/3d/src/features/look/texel.ts` (EnvironmentBuilder `paint/colour.ts`:
  `litColour`, `hazeShare`, `hazed`, `snap`, with OKLab through `nearestDuel`, memoised by 24-bit colour)
- Modify: `look.schema.ts` and `look.json` (`figureLight`, `figureShadow`, `haze`, `light: { step, gain, max }`, the
  Global Constraints' numbers)
- Test: `packages/3d/tests/unit/figures/cells/{sprite-light,finish}.test.ts`, `tests/unit/look/texel.test.ts`

**Interfaces:**
- Consumes: `PaintedCell` (Task 5), `SceneLight` (`shared/render/light/scene-light.ts`).
- Produces: `lightCell(cell: PaintedCell, lamps: readonly SpriteLamp[], options: SpriteOptions): PaintedCell`;
  `spriteLamps(light: SceneLight, chest: V3, view: CellView): SpriteLamp[]`; `finishCell(cell: PaintedCell, light: V3,
  share: number, place: readonly [number, number], look: Look): Uint8ClampedArray` (each texel hazed by `share` toward the
  veil lit by `light`, then snapped with the Bayer offset at `(place + texel) mod 4`); `litColour(albedo: number, light:
  V3, gain: number): V3`; `hazeShare(behind: number, haze: LookHaze): number`; `hazed(c: V3, light: V3, share: number,
  haze: LookHaze): V3`; `snapTexel(c: V3, x: number, y: number, strength: number): number`.

- [ ] **Step 1: Write the failing tests**: `lights the oracle's cells as EnvironmentBuilder does` (both md5s);
  `matches EnvironmentBuilder's shade for 500 texels` (`snapTexel(hazed(litColour(...)))` equals each `shade.out`);
  `a figure in one light repaints nothing` (the finish cache: same cell, light within a step, share within 1/32, same
  place mod 4 → the same array instance); `the snap is OKLab nearest` (a dark teal that sRGB-nearest moves elsewhere).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(3d): EnvironmentBuilder's sprite light, haze and snap on a painted cell`

### Task 9: The figure layer, the shadows and the view (spec 4.6) (**session break** after the layer)

**Files:**
- Create: `packages/3d/src/features/figures/layer/figure-layer.ts`, `layer/figure-shadow.ts`, `layer/cell-textures.ts`
  (uploads a finished cell's colours and depth, reusing textures by size)
- Modify: `packages/3d/src/features/figures/view/figure-view.ts` (draws through the layer; no meshes),
  `packages/3d/src/shared/render/views/view-3d.ts` (`ViewLayers3d`, the factory's fifth argument),
  `packages/3d/src/app/create-renderer.ts` (makes the layer with the look, passes it to the factories, adds its pass and
  runs its `frame()` in `draw`, rebuilds it on Try again), `packages/3d/src/entries/{index,figures}.ts`
- Test: `packages/3d/tests/unit/figures/view/figure-view.test.ts`, `packages/3d/tests/browser/parity/figures/painted.parity.test.ts`,
  `packages/3d/tests/browser/parity/shared/parity/renderer.test.ts` (Try again)

**Interfaces:**
- Consumes: Tasks 1, 5 to 8.
- Produces: `createFigureLayer(view: View3D, look: Look, light: SceneLight | undefined): FigureLayer`;
  `interface FigureLayer { add(figure: LayerFigure): () => void; setFocus(distance: number): void; frame(): void;
  readonly pass: CellCompositePass; dispose(): void }`; `interface LayerFigure { place(): { readonly at: V3; readonly
  yaw: number }; cell(view: CellView, queue: PaintQueue): PaintedCell | undefined }` (the last painted cell for the view
  while a new one is queued); `interface ViewLayers3d { readonly figures?: FigureLayer | undefined }`;
  `View3dFactory`'s signature `(row, componentId, models, light, layers?) => EntityView3d | undefined`;
  `figureShadow(cell: PaintedCell, root: V3, key: V3, look: Look): Mesh3D` (a floor quad, multiply by
  `look.figureShadow` under the contact ellipse and the silhouette thrown along `key`, drawn before the snap).

- [ ] **Step 1: Write the failing tests**

```ts
it('draws Wick on whole pixels at density 2, his feet where his root projects', async () => { // painted.parity
  const { pixels, feet } = await drawRoomWith([wickAt(0, 0)], { distance: 5 })
  expect(feet).toEqual(projectedRoot(0, 0)) // rounded field pixel
  expect(clusterOf(pixels, feet)).toEqual(finishedCellOf('wick', 2).rgb)
})
it('the nearer figure's texels win where two overlap', async () => { /* base-m in front of base-f */ })
it('a table hides a figure's legs', async () => { /* the kit's table between the camera and base-f */ })
it('a figure's shadow darkens the floor under it by the shadow factor, before the snap', async () => {})
it('an upright phone draws a figure on whole pixels at density 2', async () => { /* 390 × 844 → 360 × 779 */ })
it('a view change never leaves a figure undrawn', () => { // figure-view.test.ts, fake layer
  const frames = walkThroughViewChange(wick, { from: 5, to: 7 })
  expect(frames.every((f) => f.cell !== undefined)).toBe(true)
})
it('after Try again the figures and the tiles draw again', async () => { /* lose the context, retry, Wick is drawn */ })
```

- [ ] **Step 2: Run** (unit and browser) → FAIL.
- [ ] **Step 3: Implement.** Per frame, `frame()` runs one queued paint, then for each figure: its root's view depth and
  field pixel, its lights at the chest, its haze share (the depth past the focus), `finishCell` (cached), its placed
  cell; then `pass.show(cells)`. Prewarm (Task 7's order) on `add` and on `setFocus` when the density changes.
- [ ] **Step 4: Run** → PASS (WebGL2 here; WebGPU on the runner).
- [ ] **Step 5: Commit** `feat(3d): painted figures in the frame: the layer, the composite, the shadows`

### Task 10: The mesh figure goes (spec 4.1; audit section 5, "What is deleted")

**Files:**
- Delete: `packages/3d/src/features/figures/view/{figure-meshes,figure-skin,figure-decals,figure-colour,figure-joints}.ts`,
  `packages/3d/src/features/look/sprite-light.ts` (the part-level one), their tests in `tests/unit/figures/view/` and
  `tests/unit/look/`, the figure's use of `light.tint`
- Modify (every caller; each draws through the layer, Task 9): `games/base-3d/main.ts`,
  `examples/3d-story/src/features/{wick,guard}/*-view.ts`, `examples/3d/{figures,cutscenes,characterkit,world,look}/*.ts`,
  `packages/tools/src/shared/create-game/template-3d-story.ts` (and a `patch` changeset for `@automata/tools`),
  `tooling/frame-budget/stress/3d/stress-3d-game.ts`, `packages/editor-3d/src/features/studio/stage/stage-renderer.ts`
  and `studio-controller.ts` (the Studio makes its own layer), the character kit's and the wardrobe example's parity
  tests (compare built parts and the painted cell, not meshes)
- Test: the parity images that show figures, re-recorded; base-3d's render goldens, re-recorded

**Interfaces:**
- Consumes: Task 9's layer.

- [ ] **Step 1:** Change each caller's test first (a test that counted meshes or materials asserts on the cell: its
  size, its DUEL colours, two eyes); run → FAIL.
- [ ] **Step 2:** Delete the mesh path and move the callers. `pnpm knip` finds nothing left.
- [ ] **Step 3:** Run `pnpm check` and the browser suites that draw figures → PASS, with the figure images re-recorded.
  Open each moved image (expected, actual, diff); the commit lists them and says each moved because the figure is now
  painted. Base-3d's replay hash is unchanged.
- [ ] **Step 4: Commit** `refactor(3d): figures are only painted; the mesh figure and its callers' meshes are gone`

### Task 11: The same cells in every engine (spec 9)

**Files:**
- Create: `packages/3d/tests/browser/parity/figures/cells-engines.test.ts`

- [ ] **Step 1: Write the test**: `every oracle frame paints the same bytes as in Node` (md5 of `paintCell` in the page
  equals the fixture's, F13 frames against Node's own result), in Chromium, WebKit and Firefox.
- [ ] **Step 2: Run** in Chromium here → PASS; WebKit and Firefox in this container where they start, else on the
  runner. A mismatch is investigated (the painter's `Math.cbrt`, `pow`, `sin`, `atan2` first) and fixed in the painter.
- [ ] **Step 3: Commit** `test(3d): painted cells hash alike in Node, Chromium, WebKit and Firefox`

---

## Phase D: the world's look (spec 5)

### Task 12: The OKLab snap, the finish and the moods; the field at 360 (spec 5.4, 5.6, 5.7)

**Files:**
- Modify: `packages/3d/src/features/look/duel-snap-filter.ts` (OKLab; reads the alpha codes: snaps world and glowing,
  passes sky and painted), `look.schema.ts` and `look.json` (`pixel.short: 360`; `mood?: string`; switches `glow`,
  `rain`, `stars`, `reflect`, `shafts`, `particles`, beside `outline`, `grade`, `dither`), `target-size.ts`
  (`SHORT = 360`), `look-pass.ts` (the finish last)
- Create: `packages/3d/src/features/look/finish-effect.ts`, `look/moods.ts`, `look/library/moods.json`
  (EnvironmentBuilder `post.ts`'s registered moods)
- Test: `packages/3d/tests/browser/parity/look/snap.parity.test.ts`, `tests/unit/look/moods.test.ts`,
  `tests/browser/parity/look/look.parity.test.ts` (re-recorded at 360)

**Interfaces:**
- Produces: `class FinishEffect extends PostEffect` (`constructor(remap: Uint8Array | undefined)`; writes alpha 1
  wherever `isDrawn`, 0 elsewhere; applies the 256-entry palette remap); `moodRemap(mood: Mood): Uint8Array` (each DUEL
  index moved in OKLab by the mood and snapped back); `MOODS: Readonly<Record<string, Mood>>`.

- [ ] **Step 1: Write the failing tests**: `the shader picks nearestDuel's colour over a 17³ grid` (a 17 × 289 quad of
  colours drawn with dither 0, read back, each pixel equal to `DUEL[nearestDuel(hex)]`); `a mood maps DUEL to DUEL`
  (every remap entry is an index under 256; `none` is the identity); `the frame's field is 360 on its short side`
  (`targetSize({ width: 844, height: 390 })` is 779 × 360).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS; re-record the look parity images at 360, opened and explained.
- [ ] **Step 5: Commit** `feat(3d): the snap picks in OKLab, a finish pass with the moods, and the field is 360`

### Task 13: Tiles at the view's scale (spec 5.2)

**Files:**
- Create: `packages/3d/src/features/photo/tile-scales.ts`, `photo/tile-store.ts`, `packages/3d/src/features/world/surface-uv.ts`
  (EnvironmentBuilder `paint.ts uv()` and the placement rules of `textures.ts textureAt`)
- Modify: `packages/3d/src/features/world/{build,mesh,plane-mesh,place-props}.ts` (each piece's mesh carries `uvs`, two
  numbers a vertex, metres in the surface's frame), `features/world/props/piece.ts`
- Test: `packages/3d/tests/unit/photo/{tile-scales,tile-store}.test.ts`, `tests/unit/world/surface-uv.test.ts`

**Interfaces:**
- Consumes: `photoSource`, `swatchTile`, `photoUrl` (Task 3).
- Produces: `tileScales(view: { readonly distance: number; readonly tiltDeg: number }, short: number, fovShort: number):
  { readonly floor: readonly [number, number]; readonly wall: readonly [number, number] }` (snapped with `texelScale`);
  `createTileStore(fetch: (url: string) => Promise<Uint8Array>, warn: (message: string) => void): TileStore`;
  `interface TileStore { tile(name: string, swatch: WorldSwatch, pair: readonly [number, number], grime: number):
  Promise<TileImage | undefined>; readonly made: number }` (undefined, and one warning, when the photo cannot be had);
  `interface TileImage { readonly width: number; readonly height: number; readonly rgba: Uint8Array; readonly texels:
  readonly [number, number]; readonly offset: readonly [number, number] }` (texels a metre; the seed's start texel);
  `surfaceUv(position: V3, normal: V3, frame: SurfaceFrame | undefined, placement: TilePlacement): readonly [number, number]`.

- [ ] **Step 1: Write the failing tests**

```ts
it('takes the floor and wall pairs from the view', () => { // tile-scales.test.ts, 360 field, 5 m, 25° down
  expect(tileScales({ distance: 5, tiltDeg: 25 }, 360, LENS)).toEqual({ floor: [64, 32], wall: [64, 64] })
})
it('makes EnvironmentBuilder's tiles', async () => { // tile-store.test.ts, against the oracle's md5s
  for (const t of environmentBuilderLook().tiles) expect(md5(await labelsOf(t.swatch, t.texels))).toBe(t.md5)
})
it('a photo that does not load draws its swatch flat and says which', async () => {
  const warned: string[] = []
  const store = createTileStore(() => Promise.reject(new Error('offline')), (m) => warned.push(m))
  expect(await store.tile('oakFloor', coreLibrary.swatches.oakFloor, [64, 64], 1)).toBeUndefined()
  expect(warned).toEqual(['The material "oakFloor" could not load its photo, so it is drawn plain.'])
})
it('places a wall's tile from its start and a floor's in the world', () => { /* EnvironmentBuilder's uv cases */ })
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (a tile's RGBA from `tileColours` over the swatch's ladder; the
  store caches by name, pair and grime, and fetches a photo once). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(3d): photo tiles made at load, at the scale each view sees them`

### Task 14: The tile material, the stepped light and the haze (spec 5.3; F17) (**session break** after the oracle)

**Files:**
- Create: `packages/3d/src/features/look/tile-material.ts`
- Modify: `packages/3d/src/shared/render/light/{vertex-light,vertex-bake}.ts` (EnvironmentBuilder's steps: `light.step`
  0.1, the ceiling 1.6, as its `vertexLight` cuts them), `packages/3d/src/app/world-view.ts` (with a look, every piece
  takes the tile material; baked pieces keep their vertex colours as its light; the view's fog is off where the haze is)
- Test: `packages/3d/tests/unit/shared/light/vertex-light-oracle.test.ts`, `tests/unit/look/world-texel.test.ts`,
  `tests/browser/parity/look/tile-material.parity.test.ts`

**Interfaces:**
- Consumes: `TileImage` (Task 13), `texel.ts` (Task 8), `ALPHA` (Task 1).
- Produces: `class TileMaterial extends Material3D` (or the Phong subclass pattern `RampMaterial` uses):
  `constructor(options: { colour: number; floor?: TileImage; wall?: TileImage; glowing?: boolean; haze: LookHaze;
  gain: number })`, `setTiles(floor: TileImage | undefined, wall: TileImage | undefined): void`, `focus: number`;
  `worldTexel(albedo: number, light: V3, share: number, x: number, y: number, look: Look): number` (the CPU rule the
  shader matches: `snapTexel(hazed(litColour(albedo, light, gain), light, share, haze), x, y, strength)`).

- [ ] **Step 1: Write the failing tests**: `AF's bake agrees with EnvironmentBuilder's light within one step` (every
  oracle point, each channel within `light.step`); `worldTexel matches EnvironmentBuilder's shade` (the 500 samples);
  `the material draws worldTexel's colour` (a quad grid of known albedo, vertex light and depth, read back after the
  snap, equal to `worldTexel` at each pixel); `a floor-like face takes the floor tile and a wall the wall tile`;
  `an emissive swatch writes the glowing code and takes no light`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** The fragment fetches the tile texel with `texelFetch` at
  `floor(uv × texels) + offset` wrapped by the tile's size, multiplies by the vertex colour and `gain`, clamps to 1,
  hazes by the fragment's view depth past `focus`, writes `ALPHA.world` (or `ALPHA.glowing`). GLSL and WGSL twins.
- [ ] **Step 4: Run** → PASS; the base interior and exterior parity images re-recorded and opened.
- [ ] **Step 5: Commit** `feat(3d): the tile material: photo texels under EnvironmentBuilder's stepped light and haze`

### Task 15: One function draws a level (spec 7)

**Files:**
- Create: `packages/3d/src/app/draw-level.ts`, `packages/3d/src/app/level-tiles.ts`
- Modify: `games/base-3d/src/features/scene/scene.ts` (`buildScene` calls `drawLevel`), `games/base-3d/main.ts`
  (`look: DEFAULT_LOOK` at 360, the renderer waits for the tiles), `packages/3d/src/app/create-renderer.ts` (a `tiles`
  option: the store the scene hook's `drawLevel` uses, awaited before the first frame like the models),
  `packages/3d/src/entries/index.ts`
- Test: `packages/3d/tests/unit/app/draw-level.test.ts`, `games/base-3d/tests/unit/scene/scene.test.ts`

**Interfaces:**
- Consumes: Tasks 9, 13, 14; `buildWorld`, `drawWorld`, `sceneLamps`, `createSceneLight`, `dressLevel`.
- Produces: `drawLevel(view: View3D, input: DrawLevelInput): Promise<LevelView>`; `interface DrawLevelInput { readonly
  level: AfSector2; readonly library: WorldLibrary; readonly look: Look; readonly time: TimeOfDay; readonly tiles:
  TileStore; readonly camera: { readonly distance: number; readonly tiltDeg: number }; readonly occluders?: Occluders |
  undefined; readonly field: { readonly short: number } }`; `interface LevelView { readonly world: WorldView; readonly
  light: SceneLight | undefined; setCamera(camera: { distance: number; tiltDeg: number }): Promise<void>; dispose(): void }`
  (a dressed sector is dressed first; `setCamera` swaps tiles and the haze focus, and is a no-op when the pairs match).

- [ ] **Step 1: Write the failing tests**: `draws the base interior with its tiles, lamps and light` (pieces each with a
  `TileMaterial`; the tiles asked for are the view's pairs only); `a new camera swaps tiles without rebuilding`;
  `Ember Hall draws through drawLevel and its replay hash is unchanged`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS (base-3d with `--configLoader runner
  --project unit`; its sim goldens unchanged).
- [ ] **Step 5: Commit** `feat(3d): drawLevel, one drawing of a level for the game and the editor`

### Task 16: Lamps that glow and pool (spec 5.5)

**Files:**
- Modify: `packages/3d/src/features/world/lamp-kit.ts` (a lamp's colour held within `tone` of its kind's),
  `features/world/props/kit/` (a lamp prop's shade is emissive and dims with its lamp's strength, as
  EnvironmentBuilder's `glow` map), `packages/3d/src/app/world-view.ts`
- Test: `packages/3d/tests/unit/world/lamp-kit.test.ts`, `tests/browser/parity/look/lamps.parity.test.ts`

**Interfaces:**
- Produces: `lampColour(kind: LampKind, wanted?: string): string` (the kind's colour, or `wanted` moved into tone);
  `LAMP_KINDS: readonly LampKind[]` (`pendant`, `bulb`, `desk`, `fluorescent`, `sodium`, `neon`).

- [ ] **Step 1: Write the failing tests**: `a lamp's colour stays within its kind's tone`; `the base interior's pendant
  pools`: the floor under the pendant is at least two DUEL steps lighter than the room's far corner, the shade's pixels
  carry the glowing code, and a lamp switched off draws its shade unlit.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(3d): kit lamps glow and pool as the builders' do`

### Task 17: The sky, stars and rain in the look (spec 5.6)

**Files:**
- Create: `packages/3d/src/features/look/passes/sky-effect.ts` (EnvironmentBuilder `paint/sky.ts panorama`: the time's
  bands, the two-row checker, the level's horizon layers by yaw; writes `ALPHA.sky` where nothing was drawn)
- Modify: `look-pass.ts` (`createLookPasses(look, time, level?)` builds sky, stars and rain from the look's switches; the
  `addLookPass` slot stays for extensions), `look/passes/{stars,rain}-effect.ts` (stars only on `isSky`; rain's
  streaks hidden behind nearer depth), `packages/3d/src/app/create-renderer.ts` (no 2D sky fill when the sky pass is on)
- Delete: `addSkyPasses`, `SKY_PASS_NAMES` (their switches are the look's)
- Test: `packages/3d/tests/browser/parity/look/sky.parity.test.ts`; the moved `sky-passes.test.ts` rewritten for switches

**Interfaces:**
- Produces: `class SkyEffect extends PostEffect` (`constructor(time: TimeOfDay, horizon: LevelSky['horizon'])`;
  `yaw` and `fov` setters each frame); look switches `stars` (default on) and `rain` (default off).

- [ ] **Step 1: Write the failing tests**: `the sky shows the time's bands where nothing is drawn`; `the horizon's city
  silhouette sits on the horizon and turns with the camera`; `stars show only on the sky`; `rain falls in front of the
  room but not through a nearer wall`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(3d): the sky, its horizon, stars and rain are the look's`

### Task 18: The glow and wet reflections (spec 5.6)

**Files:**
- Modify: `packages/3d/src/features/look/passes/glow-effect.ts` (glows on `isGlowing`, not on luma)
- Create: `packages/3d/src/features/look/passes/reflect-effect.ts` (EnvironmentBuilder `post.ts reflect`; the ground
  from the depth and the inverse projection; `wet` from the time of day's rain and the level's puddles)
- Test: `packages/3d/tests/browser/parity/look/{glow,reflect}.parity.test.ts`

**Interfaces:**
- Produces: `class ReflectEffect extends PostEffect` (`constructor(wet: number)`; `camera(view: View3D)` each frame).

- [ ] **Step 1: Write the failing tests**: `a lamp's shade gets a ring a step up and a dithered ring past it`; `nothing
  that does not glow blooms`; `a lit window mirrors on wet ground a step down, rippled by a pixel`; `dry ground
  mirrors nothing`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(3d): the glow reads what glows, and wet ground reflects`

### Task 19: Shafts, motes and particles (spec 5.6)

**Files:**
- Create: `packages/3d/src/features/look/passes/shafts-effect.ts` (EnvironmentBuilder `post.ts shafts`, the spot lamps'
  cones as uniforms), `packages/3d/src/features/figures/layer/particle-layer.ts` (EnvironmentBuilder `post.ts particles`:
  steam, drips, moths round aimed lamps at night, flames, embers; each particle a one- to three-pixel cell through the
  composite pass)
- Modify: `packages/3d/src/shared/level/af-sector-2.schema.ts` (`emitters?: { kind: 'steam' | 'drip' | 'moth' | 'flame'
  | 'ember'; at: [x, y, z]; to?: [x, y, z]; ground?: number }[]`, presentation only), `af-sector-2-parts.schema.ts`
- Test: `packages/3d/tests/browser/parity/look/{shafts,particles}.parity.test.ts`, `tests/unit/level/emitters.test.ts`

**Interfaces:**
- Produces: `createParticleLayer(pass: CellCompositePass, look: Look): ParticleLayer`; `interface ParticleLayer {
  add(emitter: Emitter): () => void; frame(t: number, camera: Camera3D): void; dispose(): void }`.

- [ ] **Step 1: Write the failing tests**: `a spot lamp's cone shows a stepped shaft with motes`; `an ember emitter
  rises a pixel at a time and hides behind a nearer wall`; `a level's emitters parse and the sim never reads them`
  (`pnpm boundaries`: the schema file is a sim entry; the field is data only).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(3d): light shafts, motes and particles`

### Task 20: The budget at 360 (spec 5.7)

**Files:**
- Modify: `tooling/frame-budget/stress/3d/stress-3d-game.ts` (the dressed base interior, four painted figures walking,
  every pass on, a 360 field), its projects (`frame-budget-3d-phone`, `frame-budget-3d-ipad`)
- Create: `docs/refactor/2026-11-09-3d-painted-look-budget.md` (the numbers, from the artifact)

- [ ] **Step 1:** Run the budget pages in Chromium here (software GL: recorded, not judged) and on the GPU runner
  (`3d.yml`, by hand): frame time median and p95, paints a second, cache bytes, tile load time.
- [ ] **Step 2:** Record them, with the Owner's iPad and phone runs listed as the Owner's. If the runner misses 33 ms
  (phone) or 16.7 ms (iPad), stop and bring the numbers to the Owner (Global Constraints): no pass is turned off and
  the field is not lowered without their word.
- [ ] **Step 3: Commit** `test(3d): the frame budget at a 360 field with painted figures and every pass`

### Task 21: The board (spec 9)

**Files:**
- Create: `packages/3d/scripts/board.ts` (Playwright: draws AF's base interior and exterior, bare and dressed, with the
  base pair, at 360, and writes them beside `3d-examples/environmentbuilder-base-scenes.png`, EnvironmentBuilder's
  renders at `6d82a52` and the Owner's frames, as one PNG), `packages/3d/package.json` (`"board": …`)

- [ ] **Step 1:** Run `pnpm --filter @automata/3d board -- out/board`; open the board.
- [ ] **Step 2:** Copy it to `/mnt/project-files/3d-look/board-<date>.png` and name in the log what still differs from
  the references, each with the task that owns it. Every later look change re-runs the board.
- [ ] **Step 3: Commit** `chore(3d): a board of AF's base scenes beside the references`

---

## Phase E: Levels 3D as the environment builder (spec 7)

### Task 22: The editor's views draw the game's look (spec 7) (**session break** after the 3D view)

**Files:**
- Modify: `packages/editor-3d/src/features/levels-3d/dollhouse/game-view.ts` (draws through `drawLevel` with the game's
  look, its own figure layer and tile store), `dollhouse/game-scene.ts` (the level and library, not pieces),
  `dollhouse/stand-ins.ts` (people go: a cast member is its figure, the start is the game's player figure; embers, the
  goal and markers stay), `walk/WalkCanvas.svelte` and `walk/walk-controller.ts` (the same view), `shared/level-session/game-library.ts`
  (the game's library laid over `coreLibrary`; the game's figures and their libraries read for the layer)
- Test: `packages/editor-3d/tests/unit/levels-3d/dollhouse/game-scene.test.ts`,
  `tests/browser/canvas/levels-3d/game-look.canvas.test.ts`

**Interfaces:**
- Consumes: `drawLevel` (Task 15), `createFigureLayer` (Task 9), `createTileStore` (Task 13).
- Produces: `createGameView(size, game: GameLook): GameView` with `interface GameLook { readonly look: Look; readonly
  library: WorldLibrary; readonly figures: GameFigures }`.

- [ ] **Step 1: Write the failing tests**: `the 3D view draws the photo walls the level names` (a pixel of the wall is
  a colour of its tile); `a cast member is drawn as its painted figure`; `the view draws only DUEL colours`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS (unit, canvas; the layout suites at phone
  and iPad unchanged).
- [ ] **Step 5: Commit** `feat(levels-3d): the 3D view and Walk draw the game's look and its painted figures`

### Task 23: Furniture from core's library (spec 7)

**Files:**
- Modify: `packages/editor-3d/src/shared/things/things.ts` and `thing-def.schema.ts` (core's props by group beside the
  game's), `features/levels-3d/plan/ThingsPalette.svelte` (a thumbnail a row, a search on a phone), `docs/refactor/copy.md`
- Create: `packages/editor-3d/src/features/levels-3d/things/thumbnails.ts` (one small offscreen `View3D`, a prop drawn
  once in the game's look at day, cached by name, made as its row scrolls into view)
- Test: `tests/unit/shared/things/things.test.ts`, `tests/browser/layout/levels-3d/things-palette.layout.test.ts`,
  `tests/browser/canvas/levels-3d/thumbnails.canvas.test.ts`

**Interfaces:**
- Produces: `thingGroups(library: GameLibrary): readonly ThingGroup[]` (`Furniture`, `Lights`, `Plants`, `Street`,
  `Signs`, then the game's own groups); `propThumbnail(name: string): Promise<string>` (a data URL).

- [ ] **Step 1: Write the failing tests**: `the palette lists the kit's 86 props by group beside the game's`; `a game's
  prop of a kit name wins`; `each row shows its thumbnail and is 44 px tall at least`; `placing a chair is one Undo`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(levels-3d): every kit prop in Things, with a picture of each`

### Task 24: Lamps from the kit (spec 5.5, 7)

**Files:**
- Modify: `packages/editor-3d/src/shared/edit/thing-edits.ts` (`setLampColour`, `setLampOn`),
  `features/levels-3d/inspector/ThingCard.svelte` (a lamp's kind, its colour as the kind's swatches within tone, On),
  `docs/refactor/copy.md`
- Test: `tests/unit/shared/edit/lamp-edits.test.ts`, `tests/browser/layout/levels-3d/lamp-card.layout.test.ts`

**Interfaces:**
- Produces: `setLampColour<D>(args: { id: string; colour: string }): Edit<D>` (refuses a colour outside the kind's
  tone with "That colour is too far from a <kind> lamp's light."); `setLampOn<D>(args: { id: string; on: boolean }):
  Edit<D>`.

- [ ] **Step 1: Write the failing tests**: `a lamp offers its kind's colours only`; `switching a lamp off is one Undo
  and the 3D view draws its pool gone`; `the card's controls are 44 px and On is 48 px`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(levels-3d): kit lamps: kind, colour and on`

### Task 25: Photo materials (spec 7)

**Files:**
- Modify: `packages/editor-3d/src/features/levels-3d/inspector/material-picker.ts` and `MaterialSheet.svelte` (core's
  photo swatches, each shown by its tile, grouped Floors, Walls, Ceilings, Outside), `shared/edit/material-edits.ts`
  (a floor's and a ceiling's material, which the complete-game journey marks failing today), `docs/refactor/copy.md`
- Test: `tests/unit/levels-3d/inspector/material-picker.test.ts`, `tests/browser/layout/levels-3d/material-sheet.layout.test.ts`,
  `packages/editor/tests/e2e/journeys/complete-game-3d.test.ts` (its floor-material step no longer marked failing)

**Interfaces:**
- Produces: `materialChoices(library: WorldLibrary, part: 'floor' | 'wall' | 'ceiling'): readonly MaterialChoice[]`;
  `interface MaterialChoice { readonly name: string; readonly label: string; readonly tile: Promise<string> }`.

- [ ] **Step 1: Write the failing tests**: `a floor can be given a photo material`; `each choice shows its tile`;
  `undoing a material change draws the old tile from the cache` (the store's `made` count does not rise).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS, and the complete-game journey's floor step
  passes in Chromium at phone and iPad size.
- [ ] **Step 5: Commit** `feat(levels-3d): photo materials for floors, walls and ceilings`

### Task 26: Furnish a room (spec 7)

**Files:**
- Modify: `packages/editor-3d/src/shared/edit/sector-edits.ts` (`setDress`, `removeDressed`, `pinDressed`),
  `features/levels-3d/inspector/SectorCard.svelte` ("Furnish this room as…", "How full", a dressed piece's Remove and
  move), `shared/level-session/af-sector/room-views.ts` (the view of a room's `dress`), `docs/refactor/copy.md`
- Test: `tests/unit/shared/edit/dress-edits.test.ts`, `tests/browser/layout/levels-3d/furnish.layout.test.ts`,
  `tests/browser/canvas/levels-3d/furnish.canvas.test.ts`

**Interfaces:**
- Produces: `setDress<D>(args: { sector: string; as: string | undefined; density?: number; seed?: number }): Edit<D>`;
  `removeDressed<D>(args: { sector: string; piece: string }): Edit<D>`; `pinDressed<D>(args: { sector: string; piece:
  string; at: [number, number]; angle: number }): Edit<D>`. Purposes and their words: `waitingRoom` "a waiting room",
  `office` "an office", `bedroom` "a bedroom", `livingRoom` "a living room", `corridor` "a corridor", `storeroom`
  "a storeroom", `street` "a street", `yard` "a yard"; How full: "A little" 0.5, "Some" 1, "Full" 1.5.

- [ ] **Step 1: Write the failing tests**: `furnishing a room as an office fills it with the kit's office and is one
  Undo`; `taking a piece out writes remove and keeps the rest`; `moving a piece writes pin`; `the file keeps every other
  byte` (the round-trip property of the sector-2 work).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(levels-3d): furnish a room from a kit, then change it`

---

## Phase F: the proofs (spec 8, 9)

### Task 27: Ember Hall's art pass, made in Levels 3D (spec 8)

**Files:**
- Modify: `games/base-3d/content/levels/room.af-sector.json` (written by Levels 3D: photo walls and floor, kit lamps,
  kit props, a time of day, ember emitters), `games/base-3d/content/world-swatches/*` (only what the room still needs
  of its own), `games/base-3d/src/features/embers/ember-view.ts` (a small glowing prop and an ember emitter per ember,
  in place of the orange box)
- Create: `docs/refactor/2026-11-09-ember-hall-art-pass.md` (what was done in the editor, step by step, with the before
  and after frames)
- Test: `games/base-3d/tests/unit/embers/ember-view.test.ts`; base-3d's sim goldens (unchanged)

- [ ] **Step 1:** Write the failing ember-view test (`an ember is a glowing prop with an ember emitter`); run → FAIL;
  implement; run → PASS.
- [ ] **Step 2:** Open Ember Hall in Levels 3D (the suite, Chromium at iPad size) and make the room: walls, floor and
  ceiling photo materials, two to four kit lamps, the kit's crates, barrels, a shelf and a table, a time of day. Save.
  Commit the file the editor wrote, unchanged by hand.
- [ ] **Step 3:** Play it; take the before and after frames; put them on the board (Task 21). Base-3d's replay hash and
  sim goldens are unchanged; its render goldens re-recorded and opened.
- [ ] **Step 4: Commit** `feat(base-3d): Ember Hall's art pass, made in Levels 3D`

### Task 28: The end proof (spec 9)

**Files:**
- Create: `packages/editor/tests/e2e/journeys/a-room-at-the-references-level.test.ts`

- [ ] **Step 1: Write the journey**, on a temporary copy of a new 3D game, at phone and iPad size in Chromium: in
  Levels 3D make a room with photo walls and a photo floor, two kit lamps, the room furnished as a waiting room with one
  piece moved, a time of day and two characters; save; reload the page; close and reopen the editor; the room is as it
  was; play it from the editor; the game's frame has the walls' tile colours where the walls are, the lamps' pools, the
  two figures standing in them (their cells' colours at their projected feet), and the figures read against the room by
  at least 1.1 (`figureReads`).
- [ ] **Step 2: Run** → it fails until every step works; fix what it finds in the task that owns it.
- [ ] **Step 3: Run** → PASS at both sizes. Copy the played frame to the board.
- [ ] **Step 4: Commit** `test(editor): a room built in Levels 3D at the references' level, saved, reopened and played`

### Task 29: The records (spec 1)

**Files:**
- Modify: `docs/refactor/progress.md` (stage 4 done, each task's evidence), `docs/status.md`, `packages/3d/README.md`
  (painted figures, the world kit in core, the look), `docs/refactor/2026-11-07-3d-slice-plan.md` (a pointer line where
  its figure and look tasks are superseded), the memory note for the next stage

- [ ] **Step 1:** Record what ran (unit, Chromium browser, journeys) and what did not (WebKit, Firefox, WebGPU,
  `3d.yml`, the Owner's iPad and phone), with the board and the budget numbers.
- [ ] **Step 2: Commit** `docs(3d): the painted look's build, recorded`

---

## Self-review

1. **Spec coverage:** 2 (the judgment) → Tasks 21, 28; 3 F14 → 12, F15 → 13, F16 → Global Constraints and 12, F17 → 14;
   4.1 → 4, 5, 6, 10; 4.2, 4.3 → 7; 4.4, 4.5 → 8; 4.6 → 1, 9; 4.7 → 1; 5.1 → 1, 12, 14, 9; 5.2 → 13; 5.3 → 14;
   5.4 → 1, 12; 5.5 → 16, 24; 5.6 → 12, 17, 18, 19; 5.7 → 12, 20; 6 → 3; 7 → 15, 22 to 26; 8 → 27; 9 → 2, 5, 11, 21,
   28; 10 → 13 (load), 11 (engines), 1 (alpha).
2. **Step scan:** every code step names its file, its signature and the values the spec pins; bodies are left to the
   implementer except the rules the sources fix, which are named by source file and function.
3. **Type consistency:** `PaintedCell`, `CellView`, `PlacedCell`, `TileImage`, `TileStore`, `FigureLayer`,
   `LayerFigure`, `ViewLayers3d`, `DrawLevelInput`, `LevelView` are each defined once (Tasks 5, 6, 1, 13, 13, 9, 9, 9,
   15, 15) and used with those names after.
4. **Review Focus:** seven lines, each with its test in its task (13, 9, 9, 9, 7, 9, 25).
5. **Proportion:** the plan names files, signatures and tests; no task carries a body the sources do not already fix.
