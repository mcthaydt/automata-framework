# Provenance: files from The Last Light

This list exists because of the Owner's ruling of 2026-10-11, relayed by the hub: everything AutomataFramework (AF) takes from The Last Light (`mcthaydt/PixiJS3D_Experiment_001`, private) stays private, and before AF's repo or any AF package goes public, the Owner reviews this list file by file. Every file below was compared with The Last Light at commit `741e595` (`741e595c2100908dc9a49dd61d1371f95532bac6`), the source commit the M3 work names. Every pull request that brings in a file taken from The Last Light adds its row here in the same pull request.

## What was compared

The M3 lane branches, each against `bced229` (`origin/main`). Branches ending in `-old` were left out. Branches were still moving during the check (m3-character moved from `73849ab` and then `35547ef`, m3-stage from `9e5f23b` and then `32accd9`), so every result is for these heads:

| Branch | Head checked | Files added or changed since `bced229` |
|---|---|---|
| m3-pipelines | `9477f113e47859d33adcabf4ca7090ebd3b993b5` | 76 |
| m3-character | `278ca271dd69dcff68cca2ebf25054300e05a3fa` (now also holds m3-r3d-pure, m3-content and m3-render3d through merges) | 187 |
| m3-render3d | `e96b4836d56c7f93c5c96ec6a0bb35cf353f15cf` | 61 |
| m3-r3d-pure | `10817d0bd1e767091c3a5b61b4834d9384013cb0` | 40 |
| m3-post | `68055a9e03d497ec56b98f6199b67d1114263ba9` | 88 |
| m3-content | `8535c3d894c6113b19c8f9aedd33b9c2ddbc8c7e` | 5 |
| m3-sim | `0e1d7a021b4da4776e5b568c7e25ef0924f2fbcb` | 11 |
| m3-stage | `f304f4e659326c46555a7b104205e9706b9fc524` | 104 |

Together they add or change 224 distinct paths (no deletions). 91 of them hold material from The Last Light (the tables below), 16 only mention it (Checked, not copied), and 117 have nothing from it.

**Kinds.** *Byte-identical*: the same bytes (same git blob). *Ported*: largely the same code or text, with small changes. *Adapted*: the same algorithm or structure, substantially rewritten. *Modelled on*: follows The Last Light's approach or numbers only. Where the kind is a judgement call, the row says so.

**Tokens AF / source** is a rough measure, not a verdict: comments are stripped, both files are split into identifiers, numbers and symbols, and the longest in-order match is counted (Python `difflib`). The first figure is the share of the AF file found in the source (or the cited lines), the second the share of the source covered. Unrelated TypeScript pairs score about 9-15 % and 2-4 %; Python ported to TypeScript scores low whatever the likeness, so those rows show n/a. Where a path has more than one version, the figure is for the newest (m3-stage, then m3-character).

## Summary

| Package, folder or spike | byte-identical | ported | adapted | modelled on | Total |
|---|---|---|---|---|---|
| vendor/pixi-3d | 1 | 0 | 0 | 0 | 1 |
| spikes/s7-pixi3d | 2 | 7 | 0 | 1 | 10 |
| packages/render-pixi | 0 | 1 | 1 | 0 | 2 |
| packages/post-retro | 0 | 5 | 2 | 2 | 9 |
| packages/render-pixi3d | 1 | 3 | 10 | 5 | 19 |
| packages/pipelines | 0 | 13 | 26 | 11 | 50 |
| **All** | **4** | **29** | **39** | **19** | **91** |

Two published packages carry Last Light code: `render-pixi` (1 ported, 1 adapted) and `post-retro` (5 ported, 2 adapted, 2 modelled on). At the heads above, neither `package.json` has `"private": true` or a `license` field (every package on `bced229` is `"private": true`), so the UNLICENSED status is not written in the manifests. Both take #19's release fields when they merge `main` after #19, `"license": "UNLICENSED"` included, which #19's `release-list.test.ts` checks (M3 plan, M1.7a and Q3).

**Not in git, but taken from The Last Light.** `@pixi/3d` 0.1.0-beta.2 (third-party, MIT, PixiJS) is not committed: `vendor/pixi-3d/fetch.mjs` fetches The Last Light's `vendor/pixi-3d-0.1.0-beta.2.tgz` at `741e595` (SHA-256 `f515c1b603da64e2d546ffc74a71d14a0218f9819b09d250310b55b9ff04013a`, 5 861 687 bytes; it matches the README line) and git ignores it. On m3-character it is also an optional dependency of `packages/pipelines`.

## Files from The Last Light

### vendor/pixi-3d (repository folder, not a package)

| AF path | Last Light source (741e595, lines) | Kind | Lives on (branch@SHA) | Publish status | Tokens AF / source | Evidence and notes |
|---|---|---|---|---|---|---|
| `vendor/pixi-3d/LICENSE-pixi-3d.txt` | `vendor/LICENSE-pixi-3d.txt` | byte-identical | m3-character@278ca27, m3-render3d@e96b483, m3-post@68055a9, m3-stage@f304f4e | not a package: a repository file, public if the repo is | 100% / 100% | Git blob 7bd20dd; SHA-256 961b0367…ac63. PixiJS's MIT licence for `@pixi/3d` (third-party text, "Copyright (c) 2026 PixiJS"), as The Last Light keeps it beside the tarball. |

### spikes/s7-pixi3d

| AF path | Last Light source (741e595, lines) | Kind | Lives on (branch@SHA) | Publish status | Tokens AF / source | Evidence and notes |
|---|---|---|---|---|---|---|
| `spikes/s7-pixi3d/public/wall-sconce.bin` | `src/render/models/wall-sconce.pack` | byte-identical | m3-character@278ca27, m3-render3d@e96b483, m3-post@68055a9, m3-stage@f304f4e | private (spike, `"private": true`) | n/a (binary) | Git blob 1a4475a; SHA-256 87ca6f8c…bb94; 47 264 bytes. Renamed `.pack` → `.bin`. A Last Light game asset (Meshy model, packed by `scripts/pack-models.py`). |
| `spikes/s7-pixi3d/public/duel-lut.png` | `public/art/duel-lut.png` | byte-identical | m3-character@278ca27, m3-render3d@e96b483, m3-post@68055a9, m3-stage@f304f4e | private (spike, `"private": true`) | n/a (binary) | Git blob 9a4dc5d; SHA-256 77d69a0c…770b; 47 466 bytes. The DUEL palette lookup baked by `scripts/duel-lut.py`. |
| `spikes/s7-pixi3d/src/lcd-panel.ts` | `src/render/lcd-panel.ts` | ported | m3-character@278ca27, m3-render3d@e96b483, m3-post@68055a9, m3-stage@f304f4e | private (spike, `"private": true`) | 99% / 99% | File says "Copied … only the imports … and Biome's formatting differ". Keeps the abridged lcd-perfect MIT header (see Licence notes). |
| `spikes/s7-pixi3d/src/retro-filter.ts` | `src/render/retro-filter.ts` | ported | m3-character@278ca27, m3-render3d@e96b483, m3-post@68055a9, m3-stage@f304f4e | private (spike, `"private": true`) | 98% / 99% | File says "Copied … only the imports … and Biome's formatting differ". GLSL and WGSL shaders included. |
| `spikes/s7-pixi3d/src/bloom-filter.ts` | `src/render/bloom-filter.ts` | ported | m3-character@278ca27, m3-render3d@e96b483, m3-post@68055a9, m3-stage@f304f4e | private (spike, `"private": true`) | 97% / 98% | File says "Copied … only the imports … and Biome's formatting differ". GLSL and WGSL shaders included. |
| `spikes/s7-pixi3d/src/sprite-light.ts` | `src/render/sprite-light.ts`<br>`src/render/indirect-light.ts` 96-103 | ported | m3-character@278ca27, m3-render3d@e96b483, m3-post@68055a9, m3-stage@f304f4e | private (spike, `"private": true`) | 90% / 98% | File says "unchanged apart from Biome's formatting"; `LIGHT_STEP` and `stepLight` inlined from indirect-light.ts:96-103. |
| `spikes/s7-pixi3d/src/pack.ts` | `src/render/glb.ts` 44-62 | ported | m3-character@278ca27, m3-render3d@e96b483, m3-post@68055a9, m3-stage@f304f4e | private (spike, `"private": true`) | 90% / 99% | File cites glb.ts:44-62: `parsePack`, "unchanged except for formatting and the return type". |
| `spikes/s7-pixi3d/src/fog.ts` | `src/render/fog.ts` | ported | m3-character@278ca27, m3-render3d@e96b483, m3-post@68055a9, m3-stage@f304f4e | private (spike, `"private": true`) | 88% / 72% | `puffAt` and `fogTexture` kept; a seed folded into the hash; `relight` left out. Part of the file only. |
| `spikes/s7-pixi3d/src/look.ts` | `src/render/look.ts` 15-45 | ported | m3-character@278ca27, m3-render3d@e96b483, m3-post@68055a9, m3-stage@f304f4e | private (spike, `"private": true`) | 80% / 85% | File cites look.ts lines 15-31 (HAZE), 36-45 (POST) and 87 (LIGHT.step): values copied unchanged. (The source figure covers lines 15-45 only.) |
| `spikes/s7-pixi3d/src/scene.ts` | `src/render/stage.ts` | modelled on | m3-character@278ca27, m3-render3d@e96b483, m3-post@68055a9, m3-stage@f304f4e | private (spike, `"private": true`) | 30% / 3% | Builds one room "the way The Last Light builds its clinic"; post chain order from stage.ts:399-408 (the file's range; the chain is at 395-402 at 741e595). Little shared text. |

### packages/render-pixi

| AF path | Last Light source (741e595, lines) | Kind | Lives on (branch@SHA) | Publish status | Tokens AF / source | Evidence and notes |
|---|---|---|---|---|---|---|
| `packages/render-pixi/src/filter-programs.ts` | `src/render/filter-programs.ts` | ported | m3-character@278ca27, m3-render3d@e96b483, m3-post@68055a9, m3-stage@f304f4e | published (private, UNLICENSED GitHub Packages) | 97% / 100% | File says "unchanged except for formatting". The shared filter vertex shader (GLSL) and WGSL header. |
| `packages/render-pixi/src/init-renderer.ts` | `src/render/stage.ts` 369-387 | adapted | m3-character@278ca27, m3-render3d@e96b483, m3-post@68055a9, m3-stage@f304f4e | published (private, UNLICENSED GitHub Packages) | 21% / 49% | File cites stage.ts:369-387. Same start-up and fallback (WebGPU then WebGL, framebuffer cap 640 × 480, `dataset.renderer`), rewritten with a WebGL2 default and injectable factories. |

### packages/post-retro

| AF path | Last Light source (741e595, lines) | Kind | Lives on (branch@SHA) | Publish status | Tokens AF / source | Evidence and notes |
|---|---|---|---|---|---|---|
| `packages/post-retro/src/passes/lcd-panel-filter.ts` | `src/render/lcd-panel.ts` | ported | m3-post@68055a9 | published (private, UNLICENSED GitHub Packages) | 95% / 87% | Header names the source. Tunables moved to the pass config; panel shape kept as `PANEL_SHAPE`. GLSL + WGSL. Keeps the abridged lcd-perfect MIT header and points to LICENSE-lcd-perfect.txt. |
| `packages/post-retro/src/passes/bloom-filter.ts` | `src/render/bloom-filter.ts` | ported | m3-post@68055a9 | published (private, UNLICENSED GitHub Packages) | 91% / 85% | Header names the source ("itself from Floor Fifty's scene bloom"). Numbers come from the pass config. GLSL + WGSL. |
| `packages/post-retro/src/passes/retro-filter.ts` | `src/render/retro-filter.ts` | adapted | m3-post@68055a9 | published (private, UNLICENSED GitHub Packages) | 61% / 64% | Header names the source. Unsure between ported and adapted: shader structure kept, but the palette step moved last and the LUT read changed for 32/64 levels. GLSL + WGSL. |
| `packages/post-retro/src/bayer.ts` | `src/render/retro-filter.ts` 4-19 | ported | m3-post@68055a9 | published (private, UNLICENSED GitHub Packages) | 85% / 91% | `BAYER_8X8`, `bayer8` and their doc comment. Header says "Ported from The Last Light (src/render/retro-filter.ts at the M3 spec's source commit)". |
| `packages/post-retro/src/lcd-pitch.ts` | `src/render/lcd-panel.ts` 53-67 | ported | m3-post@68055a9 | published (private, UNLICENSED GitHub Packages) | 83% / 100% | `derivePitch` and `smoothstep`, with their comments. Header names the source. |
| `packages/post-retro/src/palette-lut.ts` | `scripts/duel-lut.py`<br>`src/render/palette.ts`<br>`scripts/duel-quantize.py` 24-33 | adapted | m3-post@68055a9 | published (private, UNLICENSED GitHub Packages) | n/a (Python → TS) | Header names duel-lut.py and palette.ts. The same slice layout and OKLab nearest colour, rewritten in TypeScript and computed at load. The OKLab matrices are the published OKLab constants, also in duel-quantize.py:24-33. |
| `packages/post-retro/src/post.test.ts` | `tests/post-fx.test.ts` 5-14 | ported | m3-post@68055a9 | published (private, UNLICENSED GitHub Packages) | 6% / 95% | Only the `bayer8` and `derivePitch` cases (post-fx.test.ts:5-14); the rest is AF's. **The file names no source for them**; it mentions The Last Light only in a test title. |
| `packages/post-retro/src/default-post.ts` | `src/render/look.ts` 36-45<br>`src/render/lcd-panel.ts`<br>`src/render/retro-filter.ts` | modelled on | m3-post@68055a9 | published (private, UNLICENSED GitHub Packages) | 16% / 43% | Values: "The Last Light's values as the starting point (look.ts POST, lcd-panel.ts LCD_PANEL, … retro-filter.ts)"; pass order from stage.ts. |
| `packages/post-retro/content/post.toml` | `src/render/look.ts` 36-45<br>`src/render/lcd-panel.ts` | modelled on | m3-post@68055a9 | published (private, UNLICENSED GitHub Packages) | 9% / 18% | The same values as default-post.ts, as content. |

### packages/render-pixi3d

| AF path | Last Light source (741e595, lines) | Kind | Lives on (branch@SHA) | Publish status | Tokens AF / source | Evidence and notes |
|---|---|---|---|---|---|---|
| `packages/render-pixi3d/src/assets/fixtures/wall-sconce.bin` | `src/render/models/wall-sconce.pack` | byte-identical | m3-character@278ca27, m3-r3d-pure@10817d0, m3-stage@f304f4e | private (`"private": true`, unpublished, D-1) | n/a (binary) | Git blob 1a4475a; SHA-256 87ca6f8c…bb94. Renamed `.pack` → `.bin`. Credited in fixtures/README.md. |
| `packages/render-pixi3d/src/lighting/sprite-light.ts` | `src/render/sprite-light.ts` | ported | m3-character@278ca27, m3-r3d-pure@10817d0 (blob 0b949fb); m3-stage@f304f4e (blob 8e7dab3) | private (`"private": true`, unpublished, D-1) | 81% / 87% | Header: "Ported from The Last Light (sprite-light.ts)". The outline colour became a parameter. |
| `packages/render-pixi3d/src/lighting/lamps.ts` | `src/render/indirect-light.ts` 84-103<br>`src/render/look.ts` 52 | ported | m3-character@278ca27, m3-r3d-pure@10817d0, m3-stage@f304f4e | private (`"private": true`, unpublished, D-1) | 30% / 33% | Lamp falloff `(1 − d/range)²`, `LIGHT_STEP` and its comment, `stepLight` (split into `stepLight`/`stepColor`). **The file names no source**; commit fc94931 says "ported from The Last Light". |
| `packages/render-pixi3d/src/lighting/vertex-lighting.ts` | `src/render/indirect-light.ts` | adapted | m3-character@278ca27, m3-r3d-pure@10817d0, m3-stage@f304f4e | private (`"private": true`, unpublished, D-1) | 21% / 17% | Header: "ported from The Last Light (indirect-light.ts)". Sector map and boxes replaced by injected `OcclusionFn`/`BlockedFn`; substantially rewritten. |
| `packages/render-pixi3d/src/camera/camera-rig.ts` | `src/render/stage.ts` 443-467 | adapted | m3-character@278ca27, m3-r3d-pure@10817d0, m3-stage@f304f4e | private (`"private": true`, unpublished, D-1) | 22% / 30% | File cites stage.ts:443-467: zone hysteresis, orbit in eighths, easing `min(1, dt·7)`, portrait pull-back `min(1.75, 0.85/aspect)` and follow 0.55, rewritten as a pure module. |
| `packages/render-pixi3d/src/camera/zone-shot.ts` | `src/game/contracts/scene.ts` 18-40<br>`src/render/stage.ts` 53 | adapted | m3-character@278ca27, m3-r3d-pure@10817d0, m3-stage@f304f4e | private (`"private": true`, unpublished, D-1) | 11% / 55% | `CameraZone` follows The Last Light's frozen scene contract (fields `look`, `distance`, `x`, `follow`, `depthFollow`, `enter`, and their doc comments); the shot is stage.ts:53 plus the orbit at 455-456. **The file names neither source**; it mentions The Last Light only for the clinic's 0.25 m. |
| `packages/render-pixi3d/src/camera/lens.ts` | `src/render/stage.ts` 45 | modelled on | m3-character@278ca27, m3-r3d-pure@10817d0, m3-stage@f304f4e | private (`"private": true`, unpublished, D-1) | 51% / 55% | One formula, `2·atan(12 / lens)` in degrees, as in stage.ts:45 and src/game/cutscenes.ts:17. Unsure whether to count it: it is the standard field of view of a 24 mm-tall frame. No source named. |
| `packages/render-pixi3d/src/assets/glb.ts` | `src/render/glb.ts` 1-38 | adapted | m3-character@278ca27, m3-r3d-pure@10817d0, m3-stage@f304f4e | private (`"private": true`, unpublished, D-1) | 45% / 74% | `GlbMesh` (same fields), accessor reading and base-colour image lookup follow `parseGlb`, rewritten with validation and `GlbFormatError`. **No source named in the file or in commit acee7f4.** |
| `packages/render-pixi3d/src/assets/pack.ts` | `src/render/glb.ts` 39-62<br>`scripts/pack-models.py` 24-26 | adapted | m3-character@278ca27, m3-r3d-pure@10817d0, m3-stage@f304f4e | private (`"private": true`, unpublished, D-1) | 34% / 62% | The LLP1 reader follows `parsePack` (glb.ts:39-62), rewritten with bounds checks and `PackFormatError`. The header names pack-models.py as the producer but **not glb.ts as the reader it follows**. |
| `packages/render-pixi3d/src/assets/character-atlas.ts` | `src/game/contracts/character.ts` 7-29<br>`src/game/directions.ts` 1-16 | adapted | m3-character@278ca27, m3-r3d-pure@10817d0, m3-stage@f304f4e | private (`"private": true`, unpublished, D-1) | 3% / 59% | Header names contracts/character.ts. The manifest entry and anchor rule `1 − feet / cell[1]` come from it; `spriteDirection`, `directionFrame` and the octant table are ported from directions.ts (not named in this file; assets.test.ts names it). |
| `packages/render-pixi3d/src/content/characters.schema.ts` | `src/game/contracts/character.ts` 7-29 | adapted | m3-character@278ca27, m3-r3d-pure@10817d0, m3-stage@f304f4e | private (`"private": true`, unpublished, D-1) | 3% / 32% | The `characters` schema is The Last Light's `CharacterManifestEntry` (atlas, normals, cell, metres, feet, stepRate, height, actions with cell and feet) as Zod. **No source named.** |
| `packages/render-pixi3d/src/content/look3d.schema.ts` | `src/render/look.ts` 83-96<br>`src/render/indirect-light.ts` | modelled on | m3-character@278ca27, m3-r3d-pure@10817d0 (blob 42b2eeb); m3-stage@f304f4e (blob 9c639dc) | private (`"private": true`, unpublished, D-1) | 3% / 44% | Fields are the inputs of The Last Light's light model (ambient and tint, wall fill and tint, strength, lamps with colour, range and peak, haze near and far). On m3-stage a comment names The Last Light's haze start (-5 m); **no source file is named.** Unsure whether "modelled on" or "adapted". |
| `packages/render-pixi3d/src/testing/pack-encoder.ts` | `scripts/pack-models.py` 137-148 | adapted | m3-character@278ca27, m3-r3d-pure@10817d0, m3-stage@f304f4e | private (`"private": true`, unpublished, D-1) | n/a (Python → TS) | Writes LLP1 "the way scripts/pack-models.py does": the same quantisation and layout, in TypeScript. |
| `packages/render-pixi3d/src/lighting/sprite-light.test.ts` | `tests/post-fx.test.ts` 15-30 | ported | m3-character@278ca27, m3-r3d-pure@10817d0 (blob a8137db); m3-stage@f304f4e (blob a297dc1) | private (`"private": true`, unpublished, D-1) | 15% / 88% | The first case (outline and rim light on a 3 × 3 block) is post-fx.test.ts:15-30 with its comments; the other cases are AF's. **The file names no source.** |
| `packages/render-pixi3d/src/lighting/lighting.test.ts` | `tests/indirect-light.test.ts`<br>`src/render/look.ts` 83-96 | modelled on | m3-character@278ca27, m3-r3d-pure@10817d0, m3-stage@f304f4e | private (`"private": true`, unpublished, D-1) | 8% / 18% | Its `LOOK` fixture is The Last Light's light numbers (ambient 0.15, tints, fill 0.08, strength 2.6); some cases follow indirect-light.test.ts. **No source named.** |
| `packages/render-pixi3d/src/camera/camera.test.ts` | `src/scenes/clinic/level.ts` 125-128 | modelled on | m3-character@278ca27, m3-r3d-pure@10817d0, m3-stage@f304f4e | private (`"private": true`, unpublished, D-1) | 4% / 56% | Fixture: the clinic's hall zone values (look, distance 16.6, follow, depthFollow, the 0.25 m probe), credited in a comment. Test code is AF's. |
| `packages/render-pixi3d/src/assets/assets.test.ts` | `tests/directions.test.ts` | modelled on | m3-character@278ca27, m3-r3d-pure@10817d0, m3-stage@f304f4e | private (`"private": true`, unpublished, D-1) | 5% / 61% | Direction cases follow directions.test.ts (credited in a describe title); reads the byte-identical `wall-sconce.bin`. |
| `packages/render-pixi3d/src/stage/fog.ts` | `src/render/fog.ts` 13-38<br>`src/render/look.ts` 15-31 | adapted | m3-stage@f304f4e | private (`"private": true`, unpublished, D-1) | 44% / 67% | Only on m3-stage. Header: "ported from The Last Light (src/render/fog.ts, 741e595)". `hazeFor` and `puffAt` keep the algorithm and the mist numbers; the hash is now an integer hash and the settings come from content. |
| `packages/render-pixi3d/src/stage/fog.test.ts` | `tests/fog.test.ts` | adapted | m3-stage@f304f4e | private (`"private": true`, unpublished, D-1) | 46% / 78% | Only on m3-stage. Header: "ported from The Last Light (tests/fog.test.ts, 741e595) as behaviour specs", with the clinic's haze values. |

### packages/pipelines

| AF path | Last Light source (741e595, lines) | Kind | Lives on (branch@SHA) | Publish status | Tokens AF / source | Evidence and notes |
|---|---|---|---|---|---|---|
| `packages/pipelines/python/crop_sheet.py` | `scripts/crop-sheet.py` | ported | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 100% / 100% | Header: "unchanged but for script names and this header". |
| `packages/pipelines/python/normal_maps.py` | `scripts/normal-maps.py` | ported | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 100% / 100% | Header: "unchanged but for script names and this header". |
| `packages/pipelines/python/flatten_texture.py` | `scripts/flatten-texture.py` | ported | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 97% / 95% | Header names the source; colours snapped to `--palette`. |
| `packages/pipelines/python/pixelate_sheet.py` | `scripts/pixelate-sheet.py` | ported | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 95% / 98% | Header names the source; palette snap and outline colour changed. |
| `packages/pipelines/python/polish_sprites.py` | `scripts/polish-sprites.py` | ported | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 96% / 95% | Header names the source; palette snap, outline and patch check changed. |
| `packages/pipelines/python/detail_pass.py` | `scripts/detail-pass.py` | ported | m3-character@278ca27 | private (`"private": true`; a test pins it) | 89% / 99% | Only on m3-character. Header names the source; `merge` takes `--palette`, new `stack` command. |
| `packages/pipelines/python/palette.py` | `scripts/duel-quantize.py` 24-43 | ported | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 42% / 99% | Part of the file: `oklab` is identical and `snap` is `quantize` with a rounding line added (duel-quantize.py:24-43). `load_palette` and `outline_colour` are AF's. Header names the source. |
| `packages/pipelines/src/character/character-pipeline.ts` | `scripts/pipeline/character.py` | adapted | m3-character@278ca27 | private (`"private": true`; a test pins it) | n/a (Python → TS) | Header names character.py. Python → Effect TypeScript: the same stages, gates, Meshy charges and render lights. The image prompts (character.py:274-288, 506-514, cited) are kept nearly word for word, with the game's art direction removed. |
| `packages/pipelines/src/character/character-spec.schema.ts` | `scripts/pipeline/character.py` 92-113 | adapted | m3-character@278ca27 | private (`"private": true`; a test pins it) | n/a (Python → TS) | Header: from The Last Light's `character.json` read by character.py; presets (48 × 72, 64 × 96, 36.9 px/m, feet 13.5) become fields. Unsure between "adapted" and "modelled on". |
| `packages/pipelines/src/character/render-sprites.ts` | `scripts/render-sprites.mjs` | adapted | m3-character@278ca27 | private (`"private": true`; a test pins it) | 14% / 56% | Header names render-sprites.mjs and tools/render-sprites.{html,ts}: the same headless-Chromium (SwiftShader) driver and `window.sheet` handshake, rewritten. |
| `packages/pipelines/src/character/sprite-page/sprite-page.ts` | `tools/render-sprites.ts` | ported | m3-character@278ca27 | private (`"private": true`; a test pins it) | 77% / 89% | Header names the source; camera distance became a query value and errors are reported as `window.sheetError`. |
| `packages/pipelines/src/character/sprite-page/index.html` | `tools/render-sprites.html` | ported | m3-character@278ca27 | private (`"private": true`; a test pins it) | 96% / 97% | The same one-line page (title "Sprite renderer", background #3a3a36), reformatted. Credited in render-sprites.ts, not in the file. |
| `packages/pipelines/src/character/character.test.ts` | `tests/character-pipeline.test.ts`<br>`scripts/pipeline/character.py` | modelled on | m3-character@278ca27 | private (`"private": true`; a test pins it) | 9% / 13% | Header: "ported from … character.py and tests/character-pipeline.test.ts". Little shared text: the cases are rewritten for the Effect runner. |
| `packages/pipelines/src/cli/pipe.ts` | `scripts/pipe.mjs`<br>`scripts/pipeline/runner.ts` 298-470 | modelled on | m3-pipelines@9477f11 (blob ecb22ff); m3-character@278ca27 (blob b306b5f) | private (`"private": true`; a test pins it) | 5% / 8% | Header says "ported from … scripts/pipe.mjs", but little text is shared: the command set, exit codes and help behaviour follow pipe.mjs and the runner's commands. Unsure between "adapted" and "modelled on". |
| `packages/pipelines/src/cli/parse-args.ts` | `scripts/pipeline/runner.ts` 68-98 | modelled on | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 14% / 28% | The same options (`--from`, `--to`, `--only`, `--force`, `--paid`, `--budget`, `--note`, `--json`), rewritten. **No source named.** |
| `packages/pipelines/src/cli/cli.test.ts` | `scripts/pipe.mjs`<br>`tests/pipeline-runner.test.ts` | modelled on | m3-pipelines@9477f11 (blob 6a7db41); m3-character@278ca27 (blob 435d89c) | private (`"private": true`; a test pins it) | 4% / 8% | Header: "The CLI's behaviour from … scripts/pipe.mjs and the CLI cases of tests/pipeline-runner.test.ts". |
| `packages/pipelines/src/contracts/exit-code.ts` | `scripts/pipeline/contracts.ts` 10-12 | ported | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 94% / 100% | `EXIT` is identical. **No source named in the file**; commit 9573e98 credits contracts.ts. |
| `packages/pipelines/src/contracts/records.schema.ts` | `scripts/pipeline/contracts.ts` 14-111 | adapted | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 12% / 25% | StageRecord, GateRecord, AuditEntry, CliResult and Cost as Zod, renamed and trimmed. **No source named in the file**; commit 9573e98 credits contracts.ts. |
| `packages/pipelines/src/contracts/pipeline-config.schema.ts` | `scripts/pipeline/contracts.ts` 83-97 | adapted | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 12% / 39% | `PipelineConfig` (budget, generated, locked) as Zod, with `providers` and `paths` added. **No source named in the file**; commit 9573e98 credits contracts.ts. |
| `packages/pipelines/src/contracts/contracts.test.ts` | `pipeline.config.json` | adapted | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | n/a (data) | Fixture: The Last Light's pipeline.config.json values (budgets, generated globs, locked values), credited. |
| `packages/pipelines/src/guard/decide-tool-call.ts` | `scripts/guard/pre-tool.mjs` | ported | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 42% / 45% | Header names the source. The rules, their reasons and the shell-word parser are kept; the fixed lists became data. Unsure between "ported" and "adapted". |
| `packages/pipelines/src/guard/glob.ts` | `scripts/guard/pre-tool.mjs` 22-32 | ported | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 62% / 90% | `globToRegExp`; header names the source. |
| `packages/pipelines/src/guard/pre-tool-hook.ts` | `scripts/guard/pre-tool.mjs` 171-184 | adapted | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 17% / 51% | The hook's stdin entry and lenient config read follow pre-tool.mjs. **No source named in this file** (decide-tool-call.ts names it). |
| `packages/pipelines/src/guard/define-validator.ts` | `scripts/guard/validators.ts` 19-60 | adapted | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 10% / 21% | Header names the source. Validator shape and fail-closed running (validators.ts:327-334), rewritten. |
| `packages/pipelines/src/guard/validators/atlas-alpha.ts` | `scripts/guard/validators.ts` 216-238 | adapted | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 23% / 43% | Header names The Last Light's `atlas-alpha` and art-lib `binaryAlpha`. Same pairing and alpha comparison, extended. |
| `packages/pipelines/src/guard/validators/keys.ts` | `scripts/guard/validators.ts` 28, 307-319 | adapted | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 36% / 3% | Same key regexes as `KEY_PATTERN` (credited); `git grep` replaced by a file walk. |
| `packages/pipelines/src/guard/validators/size.ts` | `scripts/guard/validators.ts` 204-214 | adapted | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 25% / 29% | Credited ("The Last Light's size validator, over a folder"). |
| `packages/pipelines/src/guard/png.ts` | `scripts/pipeline/art-lib.ts` 18-92 | adapted | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 24% / 28% | **Uncredited; unsure.** The decoder's shape matches `decodePng` (chunk loop, sub-byte sample expression, 16-bit high byte, tRNS handling, the error "interlaced PNGs are not supported"). Some likeness is forced by the PNG format. |
| `packages/pipelines/src/guard/guard.test.ts` | `tests/guard.test.ts` | adapted | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 41% / 9% | Header: "The Last Light's PreToolUse hook cases (tests/guard.test.ts at 741e595), ported". Cases kept, harness rewritten; fixtures use Last Light paths (`public/art`, `src/render/models`). |
| `packages/pipelines/src/guard/validators.test.ts` | `tests/guard.test.ts` | modelled on | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 12% / 6% | Header: "The Last Light's validator cases … for the generic validators AF ships". |
| `packages/pipelines/templates/approve-gate.yml` | `.github/workflows/approve-gate.yml` | ported | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 95% / 86% | Header names the source. The pipeline list became a placeholder. |
| `packages/pipelines/templates/claude-settings.json` | `.claude/settings.json` | adapted | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 64% / 63% | The guard hook registration and deny rules follow The Last Light's settings, with AF names. **JSON, no source named** (templates/README.md does not name one either). |
| `packages/pipelines/src/mcp/tools.ts` | `scripts/mcp/tools.ts` | adapted | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 28% / 14% | Header names the source. The same tool names, descriptions and guardrails (estimate tokens, no approve tool, review by elicitation, redaction, audit), calling the runner in process. |
| `packages/pipelines/src/mcp/estimate-token.ts` | `scripts/mcp/tools.ts` 62-79 | adapted | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 27% / 67% | File cites tools.ts:63-79: the HMAC `<body>.<mac>` token in base64url with a 30-minute limit, rewritten. |
| `packages/pipelines/src/mcp/mcp.test.ts` | `tests/mcp-server.test.ts` | adapted | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 29% / 50% | Header: "The behaviour of … tests/mcp-server.test.ts (at 741e595), ported to the in-process server". |
| `packages/pipelines/src/providers/openai-image-layer.ts` | `scripts/pipeline/common.py` 31-35, 76-113 | adapted | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | n/a (Python → TS) | Header names common.py `gpt_image`: edit vs generation, model fallback, defaults (1536x1024, high). |
| `packages/pipelines/src/providers/meshy-layer.ts` | `scripts/pipeline/common.py` 116-150 | adapted | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | n/a (Python → TS) | Header names common.py `meshy_call`/`meshy_wait`, props.py and character.py: create, poll every 15 s, download. |
| `packages/pipelines/src/providers/http.ts` | `scripts/pipeline/common.py` 116-128 | modelled on | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | n/a (Python → TS) | **Uncredited; unsure.** Retry rule "5xx or 429 may succeed later" as in `meshy_call`. |
| `packages/pipelines/src/providers/mesh-provider.ts` | `scripts/pipeline/common.py` 50-62 | modelled on | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | n/a (Python → TS) | **Uncredited; unsure.** `checkKeys` proves the Meshy key with the free balance call, as `check_keys` does. |
| `packages/pipelines/src/providers/fake-providers.ts` | `scripts/pipeline/character.py` | modelled on | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | n/a (Python → TS) | Numbers only: "The Last Light's charges when Meshy reports none: 30 credits for a model, 8 for a rig" (credited). |
| `packages/pipelines/src/runner/run-stages.ts` | `scripts/pipeline/runner.ts` 320-395 | adapted | m3-pipelines@9477f11 (blob ad74e99); m3-character@278ca27 (blob b18dc2c) | private (`"private": true`; a test pins it) | 10% / 23% | Run, budget refusals, gates and records follow `Runner.run`. **No source named in the file**; commit 9573e98 credits runner.ts. |
| `packages/pipelines/src/runner/plan-run.ts` | `scripts/pipeline/runner.ts` 157-174, 183-216, 309-318 | adapted | m3-pipelines@9477f11 (blob 4db8402); m3-character@278ca27 (blob bc6f3ff) | private (`"private": true`; a test pins it) | 27% / 7% | The plan rules (blocking gate, rerun on force, rejection or stale input, cascade, stop at a gate) are `selected`/`blockingGate`/`plan`. On m3-character (278ca27) `inputsHash` also hashes declared files by their bytes, with a `missing` marker, plus declared values, as `inputHash` (runner.ts:157-174) does; commit 278ca27 credits runner.ts and common.py. **No source named in the file.** |
| `packages/pipelines/src/runner/gates.ts` | `scripts/pipeline/runner.ts` 259-266, 397-421 | adapted | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 24% / 2% | Open, approve, reject and record `by: 'owner'`. **No source named in the file.** |
| `packages/pipelines/src/runner/state-files.ts` | `scripts/pipeline/runner.ts` 124-145 | adapted | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 6% / 19% | `.stage.json` and `gates.json` read and write. **No source named in the file.** |
| `packages/pipelines/src/runner/define-pipeline.ts` | `scripts/pipeline/runner.ts` 25-47 | adapted | m3-pipelines@9477f11 (blob 708e387); m3-character@278ca27 (blob 24d13e8) | private (`"private": true`; a test pins it) | 6% / 43% | The `Stage` shape (id, run, outputs, paid, gate, estimate). On m3-character (278ca27) a comment on `reads` says The Last Light's runner hashes declared input files and parameters the same way; it names no path. Otherwise **no source named in the file**. |
| `packages/pipelines/src/runner/audit-log.ts` | `scripts/mcp/tools.ts` 48-61, 130-133 | adapted | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 45% / 5% | `redact`, `redactDeep` and the four key-shape regexes are The Last Light's; the audit append follows tools.ts:130-133. **No source named in the file.** |
| `packages/pipelines/src/runner/path-policy.ts` | `scripts/pipeline/runner.ts` 267-297 | modelled on | m3-pipelines@9477f11 (blob 0206b6f); m3-character@278ca27 (blob 2ca658f) | private (`"private": true`; a test pins it) | 18% / 14% | Same rule (a stage may write only its outputs, and fails if it strays), enforced by wrapping `Files` instead of snapshots. **No source named.** |
| `packages/pipelines/src/runner/restore-outputs.ts` | `scripts/pipeline/runner.ts` 438-447 | modelled on | m3-character@278ca27 | private (`"private": true`; a test pins it) | 3% / 37% | **Unsure.** The `restore` command's purpose; the job-record mechanism is AF's. No source named. |
| `packages/pipelines/src/runner/runner.test.ts` | `tests/pipeline-runner.test.ts` | modelled on | m3-pipelines@9477f11 (blob 0b84e5b); m3-character@278ca27 (blob 7cc22db) | private (`"private": true`; a test pins it) | 9% / 24% | Header: "The behaviour of The Last Light's pipeline-runner tests …, ported to the Effect runner". |
| `packages/pipelines/src/testing/toy.pipeline.ts` | `scripts/pipeline/_toy.ts` | adapted | m3-pipelines@9477f11, m3-character@278ca27 | private (`"private": true`; a test pins it) | 23% / 23% | The same test pipeline idea (param hashed, gate T1, one paid image stage, `stray`, `fail`), rewritten. **No source named.** Unsure between "adapted" and "modelled on". |

## Copies whose file names no source

These rows hold Last Light material but the file itself does not say so (some are credited in a commit message or a sibling file, as noted). Each gets a one-line source comment in the pull request that ships it (M3 plan, X1):

- `packages/pipelines/src/guard/png.ts`: PNG decoder shaped like `scripts/pipeline/art-lib.ts:18-92` (`decodePng`); credited nowhere. Unsure: the PNG format forces some likeness.
- `packages/pipelines/src/runner/audit-log.ts`: the redaction, including The Last Light's four key-shape regexes, from `scripts/mcp/tools.ts:48-61`.
- `packages/pipelines/src/contracts/exit-code.ts`, `records.schema.ts`, `pipeline-config.schema.ts`, and `src/runner/run-stages.ts`, `plan-run.ts`, `gates.ts`, `state-files.ts`, `define-pipeline.ts`: credited only in commit 9573e98 ("Ported from The Last Light scripts/pipeline/{contracts,runner}.ts at 741e595"); on m3-character `define-pipeline.ts` adds a comment saying The Last Light's runner hashes inputs "the same way", without a path.
- `packages/pipelines/src/cli/parse-args.ts`, `src/guard/pre-tool-hook.ts`, `src/runner/path-policy.ts`, `src/runner/restore-outputs.ts`, `src/testing/toy.pipeline.ts`, `src/providers/http.ts`, `src/providers/mesh-provider.ts`, `templates/claude-settings.json`, `src/character/sprite-page/index.html` (credited in `render-sprites.ts`).
- `packages/render-pixi3d/src/assets/glb.ts`: follows `src/render/glb.ts:1-38`; credited nowhere, not even in commit acee7f4.
- `packages/render-pixi3d/src/assets/pack.ts`: names `pack-models.py` as the producer, not `glb.ts:39-62` as the reader it follows.
- `packages/render-pixi3d/src/lighting/lamps.ts`: ported from `indirect-light.ts`; credited only in commit fc94931.
- `packages/render-pixi3d/src/camera/zone-shot.ts`, `src/content/characters.schema.ts`, `src/content/look3d.schema.ts`, `src/camera/lens.ts`: follow Last Light contracts or formulas without naming them.
- `packages/render-pixi3d/src/lighting/sprite-light.test.ts`, `lighting.test.ts`, and `packages/post-retro/src/post.test.ts`: test cases or fixture values from Last Light tests (`tests/post-fx.test.ts`) or `look.ts`, not credited.

## Licence notes

What the files carry, as found:

- **lcd-perfect (MIT, "Copyright (c) 2026 sinedied").** The Last Light's `src/render/lcd-panel.ts` carries an abridged MIT notice in its header (the grant sentence, then "THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND."). `spikes/s7-pixi3d/src/lcd-panel.ts` keeps that header unchanged; the spike has no full licence file. `packages/post-retro/src/passes/lcd-panel-filter.ts` keeps the same header and points to `packages/post-retro/LICENSE-lcd-perfect.txt`, which holds the full standard MIT text with that copyright line. That file was written for AF: The Last Light has no lcd-perfect licence file, and its body is the standard MIT text (the same body as `LICENSE-pixi-3d.txt`). Neither repo holds lcd-perfect's own LICENSE, so whether the text matches it word for word was not checked. The `post-retro` `package.json` does not list the licence file (it has no `files` or `license` field). When it takes #19's `files: ["dist"]`, it must list `LICENSE-lcd-perfect.txt` too, or the MIT notice would not ship: npm always packs `LICENSE` and `LICENCE`, but not that name (M3 plan, Q3).
- **`@pixi/3d` (MIT, "Copyright (c) 2026 PixiJS").** `vendor/pixi-3d/LICENSE-pixi-3d.txt` is byte-identical to The Last Light's `vendor/LICENSE-pixi-3d.txt`. `vendor/pixi-3d/README.md` and `docs/spikes/s7-pixi3d.md` quote The Last Light's beta terms (`README.md:239`): "Keep the source, beta tarball and generated builds inside the beta".
- **Bloom.** The Last Light's `bloom-filter.ts` says it comes from Floor Fifty's scene bloom; it carries no licence header, and neither do the two AF copies.
- **The Last Light itself.** No licence file; `package.json` is `"private": true`; its README calls it a closed beta: "This project is private, with no public deployment". No AF file carries a Last Light copyright or licence notice.
- **Python scripts.** Neither The Last Light's scripts nor the AF ports carry a licence header.
- **Third-party constants.** The OKLab matrices (`palette.py`, `palette-lut.ts`) are Björn Ottosson's published OKLab constants, and the 8 × 8 Bayer matrix (`bayer.ts`) is the standard ordered-dither matrix; The Last Light credits the Bayer table to "Automata Engine's dither pass". `spikes/s7-pixi3d/public/duel-lut.png` bakes the Lospec DUEL palette (The Last Light's `docs/art/duel-palette.txt`); no licence for the palette was found in either repo.

## Checked, not copied

These files name The Last Light or one of its paths, but hold none of its code, text or data beyond what is noted:

| AF path | Lives on (branch@SHA) | What it says |
|---|---|---|
| `docs/spikes/s7-pixi3d.md` | m3-character@278ca27, m3-render3d@e96b483, m3-post@68055a9, m3-stage@f304f4e | The S7 spike report. Describes the copies above and records their SHA-256s. Quotes one sentence of The Last Light `README.md:239` (the beta terms). |
| `docs/versions.md` | m3-pipelines@9477f11 (blob 92dbcc9); m3-character@278ca27 (blob bf24e4e); m3-render3d@e96b483, m3-stage@f304f4e (blob 94f41f0); m3-post@68055a9 (blob 5bc2db8) | Version table rows: Rapier and `@modelcontextprotocol/sdk` "as The Last Light"; the Python note; the `@pixi/3d` row (tarball fetched from The Last Light, never committed). |
| `vendor/pixi-3d/README.md` | m3-character@278ca27, m3-render3d@e96b483, m3-post@68055a9, m3-stage@f304f4e | Says where the `@pixi/3d` tarball comes from (The Last Light at 741e595, a private repo) and quotes README.md:239. |
| `vendor/pixi-3d/fetch.mjs` | m3-character@278ca27, m3-render3d@e96b483, m3-post@68055a9, m3-stage@f304f4e | Fetches the tarball from The Last Light's private repo at the pinned commit; holds the repo URL and commit, no Last Light content. |
| `tooling/versions/src/pixi3d-fetch.test.ts` | m3-character@278ca27, m3-render3d@e96b483, m3-post@68055a9, m3-stage@f304f4e | Tests fetch.mjs against a fake bare repo "like The Last Light's"; holds the commit SHA as data. |
| `spikes/s7-pixi3d/tsconfig.json` | m3-character@278ca27, m3-render3d@e96b483, m3-post@68055a9, m3-stage@f304f4e | Comment: the spike is "partly copied as-is from The Last Light". |
| `spikes/s7-pixi3d/src/shade-bench.ts` | m3-character@278ca27, m3-render3d@e96b483, m3-post@68055a9, m3-stage@f304f4e | Uses The Last Light's figure cell size (48 × 72) for a synthetic benchmark figure. |
| `packages/render-pixi/src/init-renderer.browser.test.ts` | m3-character@278ca27, m3-render3d@e96b483, m3-post@68055a9, m3-stage@f304f4e | A comment comparing the filter padding with The Last Light's post passes. |
| `packages/post-retro/LICENSE-lcd-perfect.txt` | m3-post@68055a9 | Written for AF: names Floor Fifty and The Last Light as the route of the lcd-perfect port, then the full MIT text. The Last Light has no such file (see Licence notes). |
| `packages/post-retro/src/post-config.schema.ts` | m3-post@68055a9 | A doc comment: tint strength 1 "is The Last Light's (red x1.02, blue x0.95)". |
| `packages/post-retro/src/passes/passes.browser.test.ts` | m3-post@68055a9 | A comment: a neutral grade keeps The Last Light's fixed contrast and white point. |
| `packages/render-pixi3d/src/assets/fixtures/README.md` | m3-character@278ca27, m3-r3d-pure@10817d0, m3-stage@f304f4e | Credits the byte-identical `wall-sconce.bin` (path, commit, blob). |
| `packages/pipelines/src/guard/approve-gate-workflow.ts` | m3-pipelines@9477f11, m3-character@278ca27 | A comparison: The Last Light's hand-written pipeline list misses six pipelines. |
| `packages/pipelines/src/registry/load-registry.ts` | m3-pipelines@9477f11 (blob 57ff261); m3-character@278ca27 (blob f9f0830) | An example in a comment uses `public/art`, a Last Light path. |
| `packages/render-pixi3d/src/content/schemas.test.ts` | m3-character@278ca27, m3-r3d-pure@10817d0 (blob f73c877); m3-stage@f304f4e (blob 306f120) | On m3-stage only: a comment gives The Last Light's haze range (5 m before the focus to 7 m past it) as test values. |
| `packages/pipelines/src/testing/walk-box-glb.ts` | m3-character@278ca27 | States the test model is hand-written, "not from The Last Light, Meshy or the web". Its `walk-box.glb` matches no Last Light file. |

## No Last Light material found

The other 117 changed paths were checked the same way and hold nothing from The Last Light: no matching blob, no named source, no Last Light counterpart found by the overlap scans.

- Root: `.gitignore`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`; `docs/spikes/README.md`.
- `packages/content/` (5), `packages/node/` (2), `packages/physics/` (11, the m3-sim branch; it uses Rapier's character controller as The Last Light's `src/game/simulation.ts` does, but shares no code), `tooling/versions/src/` (`pins.ts`, `pins.test.ts`, `versions.test.ts`), `vendor/pixi-3d/fetch.d.mts`.
- `packages/pipelines/` (32): manifests and configs, `python/.gitignore`, `python/requirements.txt`, the bins and indexes, `src/character/python.test.ts`, `src/character/render-sprites.browser.test.ts`, `src/guard/validators/generated.ts`, `src/guard/validators/palette.ts` (The Last Light's `palette` validator checks something else), `src/guard/testing/*` (a generic PNG encoder), `src/mcp/server.ts` (MCP SDK stdio set-up, as in any server), `src/providers/image-provider.ts`, `live-providers.ts`, `no-providers.ts`, `provider-error.ts`, `providers.test.ts`, `src/registry/registry.test.ts`, `src/runner/output-hashes.ts`, `src/testing/fake-files.ts`, `fake-python.ts`, `unused-process-runner.ts`, `walk-box-glb.test.ts`, `walk-box.glb`, `templates/README.md`, `private-package.test.ts`.
- `packages/post-retro/` (10): manifests and configs, `src/index.ts`, `src/post.content.ts`, `src/post-chain.ts` and its tests, `src/dependencies.test.ts`, `src/index.browser.test.ts`.
- `packages/render-pixi/` (11): manifests and configs, `src/no-eval.ts` (from AF's base-2d example), `src/depth-stencil-rounding.ts` (from the S7 spike), `src/renderer-unavailable.ts`, `src/index.ts` and the tests other than `init-renderer.browser.test.ts`.
- `packages/render-pixi3d/` (18): manifests and configs, `src/no-eval.ts` and its test (from the S7 spike), `src/lighting/shade-cache.ts` (new: The Last Light shades every frame), `src/content/props.schema.ts`, the `*.content.ts` files, `src/content/schemas.test.ts` on m3-character and m3-r3d-pure (the m3-stage version is listed above), `src/assets/pack-format-error.ts`, `src/browser-safe.test.ts`, `src/package-json.test.ts`, `src/testing/crate.ts`, `src/testing/glb-encoder.ts`, `src/vectors.ts`, `src/index.ts`.
- `spikes/s7-pixi3d/` (20): the HTML pages and entry scripts (boilerplate), `measure/*`, `s7.e2e.ts`, the configs, `src/boot.ts`, `src/depth-stencil-fix.ts`, `src/pixi3d-no-eval.ts`.

## How it was produced

Read-only git commands on both repositories; the comparison files were written to a scratch folder outside both repos. Run from any folder; `AF` and `TLL` are the two checkouts.

```sh
AF=/path/to/automata-framework TLL=/path/to/PixiJS3D_Experiment_001
BRANCHES="m3-pipelines m3-character m3-render3d m3-r3d-pure m3-post m3-content m3-sim m3-stage"

# 0. Pin the heads (branches move); list every changed path and its blob.
for b in $BRANCHES; do echo "$b $(git -C $AF rev-parse $b)"; done > pins.txt
git -C $TLL ls-tree -r 741e595 > tll-tree.txt
while read b sha; do
  git -C $AF diff --name-only --diff-filter=AMR bced229 $sha | while read f; do
    printf '%s\t%s\t%s\n' "$b" "$f" "$(git -C $AF rev-parse "$sha:$f")"; done
done < pins.txt > af-files.tsv
while read b sha; do git -C $AF diff --name-only --diff-filter=D bced229 $sha; done < pins.txt   # deletions: none

# 1. Byte-identical: an AF blob equal to any Last Light blob (equal blob ids mean equal bytes).
awk -F'\t' 'NR==FNR { split($1, a, " "); src[a[3]] = $2; next } ($3 in src) { print $1, $2, src[$3] }' \
  tll-tree.txt af-files.tsv
git -C $TLL cat-file blob 741e595:src/render/models/wall-sconce.pack | sha256sum   # and so on for each match

# 2. Named sources: every changed file's text, and the commit messages, searched for Last Light names and paths.
PAT='Last Light|PixiJS3D|741e595|Experiment_001|src/render|src/game|src/scenes|scripts/(pipeline|mcp|guard|verify)|scripts/[a-z-]+\.py|tests/[a-z0-9-]+\.test\.ts|tools/[a-z-]+\.ts|public/art'
while read b sha; do git -C $AF diff --name-only --diff-filter=AMR bced229 $sha | while read f; do
  git -C $AF show "$sha:$f" | grep -nE "$PAT" | sed "s#^#$b $f:#"; done; done < pins.txt
while read b sha; do git -C $AF log --format='%h %s%n%b' bced229..$sha; done < pins.txt | grep -nE "$PAT"
# Each named source was then opened at 741e595 (git -C $TLL show 741e595:<path>) and compared by reading.

# 3. Uncredited copies: every changed text file against every Last Light text file, whatever it names.
#    a) whole lines: lines of 20+ characters (whitespace collapsed) shared with any Last Light file;
#    b) 8-token shingles: comments stripped, code split into identifiers, numbers and symbols (tok.py below),
#       share of the AF file's 8-token runs found in each Last Light file. Every Python script and every
#       shader (GLSL/WGSL live inside the filter .ts files) was in both scans. Top matches were read by hand.
#    The "Tokens AF / source" column is tok.py's in-order match: python3 -I tok.py <af file> <tll file>[:a-b]
```

`tok.py`:

```python
import sys, re, difflib

def toks(path, rng=None):
    t = open(path, encoding='utf-8', errors='replace').read()
    if rng:
        t = '\n'.join(t.splitlines()[rng[0] - 1:rng[1]])
    t = re.sub(r'/\*.*?\*/', '', t, flags=re.S)
    t = re.sub(r'(?m)(^|[^:])//.*$', r'\1', t)
    if path.endswith(('.py', '.yml', '.toml')):
        t = re.sub(r'(?m)#.*$', '', t)
        t = re.sub(r'""".*?"""', '', t, flags=re.S)
    return re.findall(r'[A-Za-z_$][A-Za-z0-9_$]*|\d+\.?\d*(?:e-?\d+)?|[^\sA-Za-z0-9_$;,\'"`]', t)

def sim(a, b, ra=None, rb=None):
    A, B = toks(a, ra), toks(b, rb)
    m = sum(x.size for x in difflib.SequenceMatcher(None, A, B, autojunk=False).get_matching_blocks())
    return len(A), len(B), m   # AF share = m/len(A), source share = m/len(B)

if __name__ == '__main__':
    a, b = sys.argv[1], sys.argv[2]
    rb = None
    if ':' in b.rsplit('/', 1)[-1]:
        b, r = b.rsplit(':', 1)
        rb = tuple(int(x) for x in r.split('-'))
    la, lb, m = sim(a, b, None, rb)
    print(f'{100 * m // la}% / {100 * m // lb}%')
```

For a re-run, also check that `git -C $AF branch` lists no new M3 lane branch (a branch named `m3-stage` was included; `-old` branches and `claude/project-thread-z6q9rx`, which changes only docs, were not).
