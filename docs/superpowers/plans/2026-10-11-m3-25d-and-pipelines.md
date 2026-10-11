# M3 2.5D and the pipeline platform: implementation plan

> Steps use checkboxes. Tick each one when its check passes and commit the tick with that step's work (AGENTS.md).

- **Spec:** [m3-25d-and-pipelines](../specs/2026-10-11-m3-25d-and-pipelines-design.md) ("spec"). Each task below is small enough for one lane thread; the spec's §5 contracts are what lanes build against.
- **Model and effort (Owner, 2026-10-11 22:08Z):** every role runs on the one model the project instructions name; effort is high for routine work (Executor, its subagents, Reviewer, Designer) and max for plans, specs and debugging. No model switch mid-session. (The first wave of P1–P2, M3.2, M1.7a, Q1 and R1–R3 ran under the earlier 21:07Z policy; the Reviewer re-reads it.)
- **Sign-off and review:** the Owner signed off the spec and this plan at 22:04Z (via the hub). The AF framework audit's findings (`audits/af-m3-spec-plan-review-2026-10-11.md`, B1–B5 and S1–S9) are folded into both. No paid stage runs until the coordinator relays the Owner's OK (spec §15 Q3). The `@pixi/3d` tarball stays out of AF git (the Owner's ruling at 22:19Z, spec §15 Q6).
- **Task IDs:** PRs are titled with the spec's IDs: M3.1 (S7a, S7b), M3.2 (pins), M1.7a, M3.3 (Q1–Q4), M3.4 (R1–R5), M3.5 (P1–P6), M3.6 (C1–C3), M3.7 (D1–D2), M3.8 (H0, B1), M3.9a (controller), M3.9 (B2), M3.10 (S1), M3.11 (X1, X2), M3.12 (K1, content lane), M3.13 (A1–A3 and V1, look parity). A lane may put several of its letters in one PR.
- **Branches and runners:** one local branch and worktree per lane, from `main` (`bced229` today; merge `main` again after #19 and #22). A push to a non-`main` branch runs nothing, so lanes push freely. `ci.yml` runs af-linux `checks` on every pull-request event, drafts included, so draft PRs are opened only inside a coordinator claim for their merge wave (spec §9.3; X1).
- **Edits to `examples/base-2d`** go to the base-2d thread as patches after #22 (spec §3); lane branches drop their local base-2d edits before their PR.
- **The look bar (Owner, 23:02–23:13Z, spec §1):** 2.5D and 3D must look as good as base-2d. The reference is "Bubble Bobble x Celeste as an itch indie hit". The Last Light is a source to borrow from, kept private (spec §15 Q7). M3.13 (the art lane below) does this work.
- **Provenance (the hub, 23:22Z):** [`docs/provenance/the-last-light.md`](../../provenance/the-last-light.md) maps every file taken from The Last Light to its source at `741e595`. A PR that brings in, changes or removes Last Light material updates its rows in the same PR. The Owner reviews the list file by file before anything goes public.
- **Progress:** 18 / 36 tasks done locally (P1–P6, C1, C2, Q1, Q2, R1, R2, R3, S7a, K1, M3.9a, M3.2). None is in review yet.
  - **Part done:** M1.7a (its changeset waits for #19); R4 (all but the GPU claim: `f68d726` on `m3-stage`); Q3 (the caret peer is in, `efa312d`, and its package test no longer reaches into `tooling`, `68055a9`; the GPU parity step remains).
  - **In progress:** H0 v2.

## Runner legend

Every task is marked with the gates it needs. Only **R** needs the shared runners; everything else runs in a cloud container or locally.

| Mark | Meaning |
|---|---|
| **L** | Local Node unit tests (`pnpm vitest run <file>`, the package's `test:unit`, `pnpm check`) |
| **LB** | Local Chromium with SwiftShader (a `renderer` Vitest project, or one focused Playwright spec). Pixel content only, never FPS |
| **C** | Cloud-container parity in Chromium, WebKit and Firefox (`docs/cloud-parity.md`) |
| **R** | Runner: af-linux `checks`/`parity` inside a merge-wave claim, or the GPU runner (FPS, WebGPU, journey matrix) in the final claim |
| **O** | Owner gate (decision or look) |
| **$** | Spends money through `pipelines` (estimate, token, budget) |

## Lanes and order

```
render3d:  M3.2 pins ─► M1.7a render-pixi ─► M3.1 S7a ─────────────┐
                        R1 camera ─┐                               │
                        R2 lighting ┼──────────────────────────────┴─► R4 stage ─► (B1) ─► R5 demos
                        R3 assets ──┘
post:                   M1.7a ─► Q1 LUT/config ─► Q2 passes ─► Q3 chain ─► (B1) ─► Q4 demos
pipelines: P1 contracts ─► P2 runner ─┬─► P3 CLI, P4 MCP, P5 guard, P6 providers ─► C1–C3 character ─► D1–D2 props
sim:       M3.9a controller ─────────────────────────────────────────────► (B2) ─► S1 bodies-3d
content:   K1 browser-safe entry ─► post-retro and render-pixi3d switch to it (before W2)
integration: H0 design ─► B1 base-25d (needs R4, Q3) ─► B2 base-3d (needs R4, M3.9a)
art:       H0 v2 ─► A1 kit (base-2d ./art) ─► A2 base-25d art (with B1) ─► A3 base-3d art (with B2); V1 style check (pipelines)
exit:      merge waves W1–W4 (X1) ─► GPU claim ─► X2 evidence and docs
```

R1, R2 and R3 ran in parallel (pure modules). Q1 and Q2 run in parallel with R1–R3. P3–P6 run in parallel after P2.

---

## Lane render3d

### M3.2 Pins (ship lane does the root edits) — L
**Files:** modify `docs/versions.md`, `tooling/versions/src/versions.test.ts`, root `package.json` (`pnpm:devPreinstall`), `.gitignore`; create `vendor/pixi-3d/{README.md, LICENSE-pixi-3d.txt, fetch.mjs}` and `tooling/versions/src/pixi3d-fetch.test.ts`. Source: The Last Light `741e595` `vendor/`.
- [x] Failing test: `versions.test.ts` with a package at `pixi.js` 8.22.0 and the table at 8.21.0; expected failure "8.22.0 unrecorded". Then the row is 8.22.0 (reason: `@pixi/3d` peer `^8.22.0`) and the test passes. *Done on `m3-render3d`. After the rebuild without the tarball, the row lands in `14fedf1` with render-pixi, the first package on 8.22.0, because the test forbids a row nothing uses. The `@modelcontextprotocol/sdk` row went to the pipelines lane (P4) for the same reason.*
- [x] Tarball out of AF git (the Owner's ruling at 22:19Z, spec §15 Q6 and §5.2, audit B1): `vendor/pixi-3d/*.tgz` git-ignored. Failing tests first in `pixi3d-fetch.test.ts`: `fetch.mjs` writes the file from `PIXI3D_TARBALL` when its SHA-256 equals the README's (`f515c1b6…013a`); exits 1 and writes nothing on a mismatch; with no reachable source it prints one notice and exits 0, or exits 1 with `--required`; a present, matching file is left alone. The second source is a shallow `git fetch` of The Last Light at `741e595c`, using the caller's own git access (no token in the repo). In CI the token reaches git outside the URL, and a test checks that a token set in the environment never appears in the script's output (audit re-review R2). The versions test checks the README row, not the file. *`m3-render3d` was rebuilt from `bced229` without the tarball (`97fb843`). The old branch is kept as `m3-render3d-old`. `pixi3d-fetch.test.ts` failed on the missing module, then passed 13/13. It covers:*
  - *the `PIXI3D_TARBALL` source, with a mismatch exiting 1 and writing nothing;*
  - *the no-source notice, and the exit 1 under `--required`;*
  - *the git source, fetched from a local bare repo;*
  - *`GIT_TERMINAL_PROMPT=0`;*
  - *the token reaching git through `GIT_CONFIG_*` as an `http.extraHeader`, added after any entries the caller already has;*
  - *the token never appearing in a git argument or in output, for a fetch that works and one that fails.*

  *`fetch.mjs --required` fetched the real file from The Last Light, and its SHA-256 matched. `git rev-list --objects bced229..m3-render3d` lists no `.tgz`.*
- [x] `@pixi/3d` is an `optionalDependencies` entry (`file:` the vendored path) wherever it is bundled, and the root `pnpm:devPreinstall` runs `fetch.mjs`. Check: with the tarball removed, `pnpm install --frozen-lockfile` passes and the pure render-pixi3d tests pass; with it present, the lockfile's integrity matches. *`97fb843`. In a clean checkout with an empty store and git blocked, the frozen install exits 0 with one notice and skips `@pixi/3d`. With the file present, the integrity matches the old branch's, and a second install leaves the lockfile unchanged.*
- [x] The `pixi.js` 8.22.0 pins in `examples/base-2d` and `examples/physics/bodies-2d` go to the base-2d thread as a patch after #22 (audit S3). *The patch is in the shared folder's `handoff/m3-base-2d/`, with a README, and goes to the base-2d thread through the coordinator. It also carries M1.7a's `no-eval` swap and drops the 8.21.0 row from `docs/versions.md`.* *Checked locally on `m3-render3d`: base-2d `check` (140 tests), its `renderer` project (2/2) and bodies-2d (25 tests) pass on 8.22.0; no pixel comparison exists, so "no pixel change" is not claimed.*

### M3.1 Spike S7a (local half) — L, LB
**Files:** create `spikes/s7-pixi3d/{package.json, index.html, main.ts, vite.config.ts, playwright.config.ts, s7.e2e.ts}`, `docs/spikes/s7-pixi3d.md`. Spikes are TDD-exempt (A0+A1 spec §2).
- [x] A one-room scene with `View3D`, `Sprite3D` (cylindrical), `Mesh3D` from an `LLP1` `.bin`, `ParticleContainer3D` mist and The Last Light's three post passes, served by `vite preview` with `compileHeaders` from `@ruken/manifest` (as base-2d's `vite.config.ts`). *`e96b483` on the rebuilt `m3-render3d` (was `6e6da2c`). The mesh fixture is The Last Light's `wall-sconce.pack`, byte-identical, as `wall-sconce.bin`.*
- [x] `s7.e2e.ts` (Chromium, SwiftShader): no `securitypolicyviolation`, no `EvalError`, canvas not black after 10 frames, the backend recorded. Answer: does `@pixi/3d` need `pixi.js/unsafe-eval`? Which beta APIs does the scene use? *9/9 pass. `@pixi/3d` calls no eval, but its four uniform parsers lack `unsafe-eval` sync functions, so the first 3D draw threw until `pixi3d-no-eval.ts` supplied them; then 16 frames, 92% non-black, no violations. Nine `@pixi/3d` exports used (listed in the doc).*
- [x] Measure and record: gzip bytes of `@pixi/3d` + `pixi.js` in the build; `shadeFrame` time for a 48×72 cell (Node, and Chromium at 4× CPU throttle). (`paletteLut` was measured in Q1: 32 levels about 64 ms, 64 levels about 390 ms in Node.) *Scene page 315.94 kB gzip, 160.14 kB over the 2D baseline; `shadeFrame` median 0.24–0.28 ms in Node, 0.2 ms in Chromium, 0.8 ms at 4× CPU.*
- [x] File types: Ruken refuses `.pack` and accepts `.bin`, `.glb`, `.png` (RukenApp `packages/validation/src/content-types.ts:10-50`, audit S5); confirm from the vendored sources and record. *The vendored `ruken publish` checks run locally with no network: `.bin` and `.png` pass, `.pack` fails `extension_not_allowed`.*
- [x] Verdict in `docs/spikes/s7-pixi3d.md`, with the beta's terms quoted. **Gate:** R4 does not start if S7a fails on CSP. *Verdict: fails as shipped, passes with two shims. The uniform-parser shim moves into `render-pixi3d/no-eval` (R4's first step; spec §5.2 and §7) and the depth-stencil rounding into `initRenderer` (M1.7a). R4 may start on that basis. Rerun on the rebuilt branch: 9/9. The `?depthfix=0` case now expects `initRenderer`'s rounding to keep the scene drawing: 0 incomplete framebuffers, 92% lit. The spike's package needs `@pixi/3d` to typecheck, so its code PR waits for W3 (CI's read token). W2 carries the verdict doc alone.*

### M3.1 Spike S7b (runner half) — R, O
- [ ] In the final GPU claim: the S7 scene's FPS (median and p5 frame time over 600 frames) on the S20 and iPhone 13 profiles, WebGL2 and WebGPU; a non-black capture path there.
- [ ] Owner opens the private build on a real phone and reports smoothness (O). Verdict and D-1 recommendation recorded.

### M1.7a `render-pixi` foundation — L, LB
**Files:** `packages/render-pixi/{package.json, tsconfig.json, vitest.config.ts}` and `src/{index.ts, no-eval.ts, no-eval.test.ts, init-renderer.ts, init-renderer.test.ts, init-renderer.browser.test.ts, filter-programs.ts, filter-programs.test.ts, renderer-unavailable.ts}`. Source: The Last Light `src/render/stage.ts:369-387`, `src/render/filter-programs.ts`; base-2d `src/no-eval.ts`.
- [x] `init-renderer.test.ts` (L) with an injected `Application` factory: preference retry, `RendererUnavailable` with `tried`, framebuffer cap; red on the missing module, then implemented. *`14fedf1` on the rebuilt `m3-render3d` (was `dac0758`); 16 tests.*
- [x] `filter-programs.test.ts` (L), then `filter-programs.ts` ported unchanged (it keeps The Last Light's leading `name` argument; the spec now says so). *4 tests.*
- [x] `init-renderer.browser.test.ts` (LB): real WebGL2 init, the framebuffer cap, five init/destroy cycles with no live context, `destroy()` twice. *6/6; a mutation (no `app.destroy`) turned it red.*
- [x] Backend names follow the M1 shared contracts (audit B2): `Backend = 'webgl2' | 'webgpu'`, Pixi's `renderer.name` `'webgl'` mapped to `'webgl2'` where it is read, `canvas.dataset.renderer` and `tried` use AF's names. Failing test first: `backend === 'webgl2'`. *`f9066ba`. Red: 6 Node and 2 Chromium tests ("expected 'webgl' to be 'webgl2'") and a TS2820 typecheck error. Green: 21/21 and 6/6.*
- [ ] Packaging (audit S2, S4): `pixi.js` as a caret peer `^8.22.0` with an exact dev dependency; after #19, ship's build and publish fields and a changeset. *The caret peer is in (`4abdcd9`). It rests on a new versions rule (`9874029`, test-first: red on "findRangeViolations is not a function", then 32/32): a published package may take a `^x.y.z` peer when an exact dev pin sets the floor. render-pixi dropped `"private": true`, because the rule only lets a published package take a caret peer. Nothing publishes before #19. The fields and the changeset come after #19. #19's fields are `"license": "UNLICENSED"`, `repository`, `files: ["dist"]` and `publishConfig`, and its `release-list.test.ts` checks the licence; the provenance list found the licence missing today.*
- [x] Depth-stencil rounding (S7a, spec §5.1): a browser test (LB) that renders a filtered stage at a fractional resolution under the framebuffer cap (480/839) is black with framebuffer-incomplete warnings, then non-black after rounding the depth-stencil size in `initRenderer` (from `spikes/s7-pixi3d/src/depth-stencil-fix.ts`). *`fd542ec`. The test needs a padded `AlphaFilter` at the renderer's resolution: a plain one runs at resolution 1 and doesn't reproduce the bug. Red: framebuffer status 36057 (FRAMEBUFFER_INCOMPLETE_DIMENSIONS), 0% lit, and a Node case with `pixelWidth` 255.99999999999997. Green: 7/7 in Chromium and 22/22 in Node.*
- [x] base-2d's `no-eval.ts` importing `@mcthaydt/automata-render-pixi/no-eval` goes to the base-2d thread as a patch after #22. *In the same patch as M3.2's pins (`handoff/m3-base-2d/`). Applied on the rebuilt branch, it passes base-2d `check` 140/140, `renderer` 2/2, bodies-2d 25/25 and versions 32/32.* *Done locally on `m3-render3d` (base-2d `check`, `renderer` project and one focused e2e passed); `initRenderer` is not adopted in base-2d, whose fixed 320×192 canvas at resolution 1 differs from `initRenderer`'s host-sized canvas.*

### R1 Camera rigs — L
**Files:** `packages/render-pixi3d/{package.json (private: true), tsconfig.json, vitest.config.ts}`, `src/camera/{lens.ts, zone-shot.ts, camera-rig.ts, camera.test.ts}`. Source: The Last Light `stage.ts:41-59, 424, 443-467`, `src/game/contracts/scene.ts:19-40`, clinic `level.ts:125-129`.
- [x] `camera.test.ts`: lens, `zoneShot`, `enter` hysteresis, orbit steps and easing, reduced-motion snap, narrow-aspect pull-back; red on missing modules. *`37e9179` on `m3-r3d-pure`; 20 tests. `depthFollow` is `{ rate, about }` (the clinic hall needs it; the spec now says so); azimuth eases at `min(1, dt·7)` like position.*
- [x] Implement; no URL reads, no `Date`, no `Math.random`.
- [x] The narrow-screen follow runs along the camera's sideways axis after an orbit, not world x as The Last Light's `stage.ts:454-459` does (M3 thread ruling; found by the concept renders). *`f68d726` on `m3-stage`, with R4. Red: "expected -4 to be close to -5.1" at azimuth 90°; at azimuth 0 the old cases still give the world-x result. A zone with an `x` offset now follows its own sideways axis even at azimuth 0; no fixture uses `x`.*

### R2 Lighting — L
**Files:** `src/lighting/{lamps.ts, vertex-lighting.ts, sprite-light.ts, shade-cache.ts, lighting.test.ts, sprite-light.test.ts}`. Source: The Last Light `indirect-light.ts`, `sprite-light.ts`, `occlusion.ts`, `look.ts:54-96`, `tests/indirect-light.test.ts`, `tests/post-fx.test.ts`.
- [x] Port the `indirect-light` and `shadeFrame` tests as behaviour specs on an injected `OcclusionFn` and content bounce pools; add the shade-cache cases. *`fc94931`; 35 tests. Adds a `BlockedFn` seam so lamp rays and bounce pools do not pass through walls (now in the spec); `figureLights` (lamps to sprite lights) is left to R4.*
- [x] Implement; the outline color is a parameter.

### R3 Assets and content schemas — L
**Files:** `src/assets/{pack.ts, pack-format-error.ts, glb.ts, character-atlas.ts, assets.test.ts, fixtures/{wall-sconce.bin, README.md}}`, `src/content/{characters,props,look3d}.{schema,content}.ts`, `src/content/schemas.test.ts`, `src/testing/{crate.ts, pack-encoder.ts, glb-encoder.ts}`.
- [x] `assets.test.ts`: `parsePack` on a real `LLP1` file (`wall-sconce.bin`, copied from The Last Light `741e595`) and on encoder-built fixtures; `PackFormatError` cases; `describeCharacterAtlas` (pure; textures are R4's `loadCharacter`); `directionRow` integer table equal to the angle form for every heading and step. *`acee7f4`; 24 tests. pymeshlab was missing, so the crate fixtures are built by TS encoders in `src/testing/`.*
- [x] `schemas.test.ts`: the three kinds compile with `sim: false`; bad input reports `file:line:col`; a `.pack` path in `props` is refused with a message naming Ruken. *13 tests.*
- [x] Implement.
- [x] `private: true` pin test (audit S2): a test that fails if `packages/render-pixi3d/package.json` loses `private: true`. *`52bf3b5` on `m3-r3d-pure`; red with the flag removed, 93 tests.*

### R4 Stage — LB, then R
**Files:** `src/no-eval.ts` (the `./no-eval` export), `src/no-eval.test.ts`, `src/stage/{create-stage-3d.ts, kit.ts, lit-sprite.ts, load-character.ts, figure-lights.ts, fog.ts, bindings.ts, stage.browser.test.ts, fog.test.ts}`, `src/index.ts`. Needs R1–R3, M1.7a, S7a pass (with the shim). Source: The Last Light `stage.ts:91-305, 388-401, 537-569`, `fog.ts`, `tests/fog.test.ts`.
- [x] `no-eval.test.ts`: after `render-pixi/no-eval` and `render-pixi3d/no-eval`, `pixi.js/unsafe-eval`'s sync tables hold a function for each of `@pixi/3d`'s four uniform parsers (red before the entry exists); port `spikes/s7-pixi3d/src/pixi3d-no-eval.ts`. The stage browser test runs under both entries. *`f82f0d1` on `m3-stage` (= the clean `m3-render3d` + `m3-r3d-pure`). Pixi keeps its sync tables private, so the test drives the polyfilled generators with a fake GL context. Red: 2 of 4 tests failed on the missing module. Green: 4/4. The WebGL path uploads through `uniformMatrix4fv`, `uniformMatrix3fv` and `uniform3f`, and the std140 and WGSL buffers hold the expected floats, including the mat3's column padding.*
- [x] `fog.test.ts` (L): mist positions from a seed are identical across runs; `hazeFor` matches The Last Light's cases. *`32accd9`. Red on the missing module, then 5/5. `Math.random` is spied and never called. Mist is placed with an integer `Math.imul` hash, not The Last Light's `Math.sin` one, so positions match on every engine. The fog's `near` and `far` are metres from the camera's focus, and may be negative, which the spec now says.*
- [x] Contract gap found in R4 (23:33Z): the stage had no way to receive the lighting. Ruled as spec owner: `Stage3DOptions` takes `look` (the parsed `look3d` entry, which replaces `fog`) and `isBlocked`. `look3d` gains `outline`, and its fog's `near` may be negative. `AssetLoader` and `Object3DHandle` are defined (spec §5.2). The `look3d` schema change is test-first in R3's schema file. *`bdd550e`: red on `keyPath fog.near` and `unknown field: outline`. `f304f4e`: `shadeFrame` draws no outline when the look sets none (red: "Cannot read properties of null").*
- [x] `stage.browser.test.ts` (LB): a stage with a box, a billboard, an `LLP1` prop and a lit sprite draws non-black; `apply` with `resync` rebuilds bound objects; `remove` destroys them; raising a lamp level brightens the box's vertex colors and the sprite; `destroy` leaves no live context. Red on the missing module. *`e2e012d`; 13/13 in Chromium (SwiftShader). Midway the billboard drew 0 lit pixels; an authored-colour case found the colour gap below (red: `[50, 29, 14]` for `0x806040`).*
- [x] Implement, including `loadCharacter` (textures from `describeCharacterAtlas`) and `figureLights`. Export `render3dContent` plainly; no `defineExtension` until M1.5 (audit B3). *`e2e012d`, `547fff4` on `m3-stage`; Node 109/109, `pnpm check` exit 0, no tarball in the history. Shapes in spec §5.2. Findings: `@pixi/3d` decodes numeric colours as sRGB and never re-encodes them, so `displayColor` encodes them first (textures and vertex colours are exact); props stay hidden until their PNG decodes and show untextured on a decode error; one default zone looks at [0, 1, 0] from 9 m until `setZones`; mist seed 1; poses load and are size-checked but play from M6; lights refresh at 30 Hz or at once after `setLampLevel` or `setCarried`. `render-pixi3d` now depends on `@mcthaydt/automata-sim` (directions).*
- [ ] GPU capture and the WebGPU path: in the final GPU claim (R).

### R5 Demos `render-pixi3d/{zone-camera, lit-sprites, glb-props}` — L, LB, then R
**Files:** `examples/render-pixi3d/<demo>/{package.json, index.html, main.ts, vite.config.ts, boot.test.ts, <demo>.e2e.ts, PROVENANCE.md}`; `examples/README.md` rows. Needs B1 (base-25d).
- [ ] Per demo: `boot.test.ts` under the fake host (ready, no console errors, no CSP violations). Red on missing `main.ts`. Then `main.ts` (one file, raylib style).
- [ ] One focused e2e per demo (LB); the matrix in the GPU claim (R). Screenshots to `evidence/` for the Owner (O). Kept out of the public gallery list; captures `beta-only` (spec §11).

## Lane post

### Q1 LUT and config — L
**Files:** `packages/post-retro/{package.json, tsconfig.json, vitest.config.ts}`, `src/{palette-lut.ts, post-config.schema.ts, post.content.ts, default-post.ts, bayer.ts, lcd-pitch.ts, post.test.ts}`.
- [x] `post.test.ts`: `bayer8`, `derivePitch`, `paletteLut` (only palette colors, each maps to itself, identical bytes across runs, 32 and 64 levels), the `post` schema refusing an unknown pass and an out-of-range value with `file:line:col`; red on missing modules. *`43d1085` on `m3-post`; 34 tests. `derivePitch(cellSize, minPitch)` returns `{ cells, cyclesPerPixel, fade }` as The Last Light's does (the spec now says so). The registration is `post.content.ts` (the style checker's role).*
- [x] Implement.

### Q2 Passes — L, LB
**Files:** `src/passes/{retro, bloom, lcd-panel}` filter modules, `src/passes/passes.browser.test.ts`, `LICENSE-lcd-perfect.txt`. Source: The Last Light `retro-filter.ts`, `bloom-filter.ts`, `lcd-panel.ts` (MIT header kept).
- [x] `passes.browser.test.ts` (LB): each pass compiles on WebGL2 and renders a known 64×64 checker to a non-black, deterministic image; with `palette: true` every output pixel is an Endesga 64 color. Red on missing modules. *`df8e62b` on `m3-post`; 10 Chromium tests (SwiftShader). Two renders must match; hashes are recorded, not compared, because a real GPU may round differently. A lookup image of cell coordinates checks the 8-across slice layout at 32 and 64 levels.*
- [x] Port the GLSL and WGSL with values from `PassConfig` and injected `time`; the shader reads the LUT layout frozen in spec §5.4 for 32 and 64 levels. *`df8e62b`. The palette lookup now runs last in the retro pass (grade, grain, then dither into the lookup), so `palette: true` yields only palette colors; The Last Light graded after the palette. Values `PassConfig` lacks keep The Last Light's constants, documented in each file. File names are `{retro,bloom,lcd-panel}-filter.ts` (no `.filter.ts` role). The WGSL has not run yet: first in the GPU claim.*

### Q3 Chain — L, LB
**Files:** `src/{post-chain.ts, post-chain.test.ts, index.ts}`, `content/post.toml`, `src/dependencies.test.ts`.
- [x] `post-chain.test.ts`: order follows the config; `setEnabled` toggles without rebuilding; `destroy` frees the LUT texture. Red on the missing module. Implement. Export `postContent` plainly (no `defineExtension` until M1.5). *`154578a` on `m3-post`; 53 package tests. `createPostChain(passes, { lut, time }, parts?)`: the optional `parts` lets the Node test inject fakes. Exports `postRetroContent = [postContent]`; default `content/post.toml`.*
- [x] Browser import (found in Q2): `@mcthaydt/automata-content`'s root entry imports `node:crypto` and `node:fs`, so importing `post-retro`'s index in a browser fails. After K1, `post-retro` imports from `@mcthaydt/automata-content/schema` and a Chromium test imports its index. The browser tests import the pass modules directly meanwhile. *Done with K1's switch (`3970b7b`).*
- [ ] `dependencies.test.ts` (audit S4): `post-retro` never imports `@pixi/3d` (its `package.json` and every source import); `pixi.js` is a caret peer `^8.22.0`. After #19: ship's build fields and a changeset. *The `@pixi/3d` checks are in (`c36052c`). The caret peer is in on the rebuilt `m3-post` (`efa312d`, on `m3-render3d`'s versions rule `9874029`). Red: "expected undefined to be '^8.22.0'", and with `"private": true` kept, the rule's own violation. Green: 3/3. post-retro is no longer `private`, as render-pixi isn't. `68055a9` then pins its own fields without importing `tooling/versions`. The fields and the changeset come after #19. With #19's `files: ["dist"]`, post-retro also lists `LICENSE-lcd-perfect.txt`, or the MIT notice for the lcd-perfect port would not ship (npm always packs `LICENSE` and `LICENCE`, not that name); a test on the packed file list checks it.*
- [ ] WebGL2 vs WebGPU pixel parity per pass: in the final GPU claim (R).

### Q4 Demos `post-retro/{chain-2d, chain-3d}` — L, LB, then R, O
- [ ] `chain-2d` on base-2d (its needs from base-2d go to the base-2d thread), `chain-3d` on base-25d (needs B1): boot tests, one focused e2e each, screenshots for the Owner (O); `post.toml` tuned with the Owner (spec §15 Q4). `chain-3d` is `beta-only`.

## Lane pipelines (started first)

All P tasks are **L**: Node only, no network, providers faked. Package `packages/pipelines` (`@mcthaydt/automata-pipelines`, `private: true`), bins `automata-pipe`, `automata-pipelines-mcp`, `automata-pipelines-guard`. Source tests ported from The Last Light `tests/{pipeline-runner, mcp-server, guard, character-pipeline, pipeline}.test.ts` at `741e595`.

### P1 Contracts and config — L
**Files:** `src/contracts/{exit-code.ts, records.schema.ts, pipeline-config.schema.ts, contracts.test.ts}`.
- [x] Test: The Last Light's `pipeline.config.json` shape parses with `meshCredits`, `providers` and `paths`; a negative cap and an unknown cost kind fail. Implemented. *`9573e98` on `m3-pipelines`; 13 tests. Each cost kind is optional in `budget` (a kind with no entry cannot be spent), as the spec now says.*

### P2 Runner, gates, path policy, audit — L
**Files:** `src/runner/{define-pipeline.ts, run-stages.ts, gates.ts, path-policy.ts, audit-log.ts, state-files.ts, runner.test.ts}`, `src/testing/{toy.pipeline.ts, fake-files.ts, unused-process-runner.ts}`.
- [x] Runner tests on in-memory `Files`: order and records, gate stop (exit 3) and continue after approve, re-run after reject with the note, `--from/--to/--only`, path policy (exit 1 naming the file), paid refusals (exit 4: no flag, no budget, run cap, project cap from the audit log), one redacted `AuditEntry` per run, approve and reject. Implemented on Effect with `Files`, `ProcessRunner` and `Clock`. *`9573e98`; 34 tests; mutation checks on five rules.*
- [x] Fail closed (audit S6): when stage records show paid outputs but the audit log is missing or records less spend, every paid stage is refused (exit 4). Failing test first. *`9477f11`: red as "expected +0 to be 4" (the paid run went ahead), and "expected 1 to be 4" for an unreadable log; a refusal stays exit 4 when the log can't be written.*
- [x] `private: true` pin test for `packages/pipelines` (audit S2). *`9477f11`; red with the flag set to false.*

### P3 CLI — L
**Files:** `src/cli/{pipe.ts, parse-args.ts, main.ts, index.ts, cli.test.ts}`.
- [x] Test: argument parsing, `--json` prints one `CliResult`, exit codes 0–4 pass through, `approve` without a target finds the single pending gate, `list`. Red on the missing module. Implement. *`45dc8dc` on `m3-pipelines`; 20 tests, one on the real bin. `list --json` prints a `PipelineList` (a `CliResult` has no data field); `status`, `estimate` and `check` are audited too; `request --note` goes to the audit log only, because a gate's `note` is the Owner's. `restore` exits 2 until C2.*

### P4 MCP server — L
**Files:** `src/mcp/{server.ts, tools.ts, estimate-token.ts, index.ts, mcp.test.ts}`; the `@modelcontextprotocol/sdk` 1.32.1 row in `docs/versions.md` (and a check that it brings no second `zod`).
- [x] `InMemoryTransport` tests with an injected clock: eight generic tools and **no approve tool**; `pipeline_run` with `paid` refuses without a token, with a 31-minute-old token, with a token for other inputs, and with a token from another server instance (per-process `randomBytes(32)` secret); the review request records `requestedAt`, uses elicitation only where offered, and never returns the decision text; every call appends `via: 'mcp'`. Red on the missing module. Implement. *`45dc8dc`; 24 tests and a stdio smoke test. Decline in the review form rejects and Cancel leaves the gate pending (the form says so). A run writes the runner's entry (with cost) and the server's (without), so spend is counted once. One `zod` in the lockfile.*
- [x] Follow-ups: one `planRun` in the runner, used by `runPipeline`, the CLI's `estimate` and the estimate token (P3 and P4 each copy the plan rules today); the MCP bin loads the game's registry the way the CLI does; `guard_check` runs P5's validators instead of the stand-in type. *`9477f11`: `src/runner/plan-run.ts` serves the runner, the CLI's `estimate` and `check`, and the MCP token (both copies deleted; an estimate now sees an edited spec). `src/registry/load-registry.ts` loads the game's `pipelines.registry.ts` for both bins: default export the pipelines, optional `validators` export for `guard_check`. The MCP bin now refuses to start without a registry; `guard_check` returns `{ ok, results }`.*

### P5 Guard and validators — L
**Files:** `src/guard/{decide-tool-call.ts, pre-tool-hook.ts, define-validator.ts, validators/*, index.ts, guard.test.ts}`, `templates/{claude-settings.json, approve-gate.yml, README.md}`.
- [x] Guard cases: blocks `automata-pipe … approve`, `--paid` from Bash, a request to a provider host, printing a key, env dumps, and writes, moves and deletes of `gates.json`, `.stage.json`, `pipelines.config.json`, **the audit log** and the `generated` globs; allows ordinary edits. Validators: off-palette pixel, hand-edited generated file, a throwing validator counts as a failure. The workflow's pipeline list equals the registry. Templates are for games only. Red on missing modules. Implement. *`45dc8dc`; 139 tests. The hook keeps its own copy of the key variable names (loading Effect made each tool call about 0.46 s instead of 0.12 s); a test keeps it equal to the runner's.*
- [x] The hand-edited generated file case (an `it.todo` today): an additive `StageRecord.outputHashes` that the runner fills in, then the `generated` validator compares it. *`9477f11`. `Files` reads text only, so the bins pass an optional `RunnerContext.readBytes`; C2's first step replaces it.*

### P6 Providers — L
**Files:** `src/providers/{image-provider.ts, mesh-provider.ts, openai-image.layer.ts, meshy.layer.ts, fake-providers.ts, index.ts, providers.test.ts}`; `StageEnv` in `src/runner/define-pipeline.ts`.
- [x] Fake-`fetch` tests (no network): image model fallback `gpt-image-2.5-sunburst` → `gpt-image-2.5-flare` on model-not-found; Meshy create, poll (`TestClock`), download; 401 and timeout as `ProviderError` with keys redacted; `balance()` is the only call a key check makes; the job id is returned for a free `restore`. Red on missing modules. Implement; keys read from env inside the live layers only. *`45dc8dc`; 23 tests. Files `openai-image-layer.ts` and `meshy-layer.ts` (no `.layer.ts` role). Creates are never retried, so nothing is charged twice; reads retry three times. A missing key fails each call, not the layer, so free stages still run.*
- [x] Additive contract: `StageRecord.jobs` and `StageResult.jobs` (provider job ids, spec §7), so `restore` can re-download without spending. *`9477f11`: a `ProviderJob` schema; a failed stage's `ProviderError.job` is kept under its kind; `MeshJobKind` derives from it.*

### C1 Character pipeline: Python scripts — L
**Files:** `packages/pipelines/python/{requirements.txt, flatten_texture.py, pixelate_sheet.py, polish_sprites.py, normal_maps.py, crop_sheet.py}`, `src/character/python.test.ts`; a Python table in `docs/versions.md` (exact `==` pins).
- [x] Tests on 16×16 fixtures: output size and palette membership (palette as an argument); a missing module names its `requirements.txt` line and the test is skipped with a recorded gap. Red on missing scripts. Port with the DUEL constants replaced by the palette argument. *`ecbe740`; 8 tests, red on each missing script. `palette.py` replaces `duel-quantize.py`; the outline is the palette colour closest to black; `normal_maps.py` and `crop_sheet.py` have no palette check (normals hold directions; crops are Meshy's input). `tooling/versions` checks `python/requirements.txt` against a new Python table.*

### C2 Character pipeline: stages — L
**Files:** `src/character/{character-pipeline.ts, character-spec.schema.ts, render-sprites.ts, character.test.ts}` (no `.pipeline.ts`: the style checker has no `pipeline` role).
- [x] Bytes first: additive `readBytes` and `writeBytes` on `@mcthaydt/automata-node`'s `Files` (the ship lane's package, by agreement; test-first). The runner hashes outputs through it and the optional `RunnerContext.readBytes` goes; stages write provider PNGs through `writeBytes`. *`36d03bd` on `m3-character`. Red: "files.writeBytes is not a function", "files.readBytes is not a function", the binary-hash test, and the byte path-policy test. The path policy covers `writeBytes`, and the in-memory `Files` keeps bytes beside text. node 10 tests, pipelines 275.*
- [x] Port `character-pipeline.test.ts` with fake providers: stages and gates G1, G3, G5, G6; estimate 10 images and 38 mesh credits; `install` writes atlas, normals and a `characters` entry that compiles; `restore` re-downloads without spending; `render` runs headless Chromium (LB) on a tiny committed GLB. Red on the missing module. Implement; px-per-metre and the house prompt come from the spec and content. A stage that hits a missing Python module fails naming its `requirements.txt` line; scripts run as `python3 <dir>/script.py` (not `-I`), so they find `palette.py`. The CLI's `check` runs the registry's validators too (spec §7: the palette validator fails both `check` and `guard_check`). *Done in `73849ab`, and the `render` stage's Chromium test in `35547ef` (after merging the clean `m3-render3d`, `ba4b66a`). That test checks the sheet sizes, opaque pixels in every row, grey-or-white light passes and the missing-clip `StageError`: 3/3 in 5.9 s. It never went red, because the page from `73849ab` needed no fix, so four mutations of `sprite-page.ts` each failed exactly the matching test instead. The fixture `src/testing/walk-box.glb` is two boxes skinned to Hips and Chest with the clip `Armature|walking_man|baselayer`, built from hand-written numbers by the committed `walk-box-glb.ts`; a unit test keeps the file byte-identical to the script's output. `packages/pipelines` now takes `@pixi/3d` as an optional `file:` dependency, as the spike does, so it typechecks only with the tarball and ships in W3. Pipelines 306 tests. The stages stop at G1, G3, G5 and G6, and the audit log sums to 10 images and 38 credits. One test runs the real scripts on real files, views through install, and the atlas passes the palette validator. That test found three bugs, fixed or recorded on the step. Deviations from The Last Light are recorded in the commit:*
  - *the presets became spec fields;*
  - *the house prompt and palette come from content;*
  - *views are cut into equal columns;*
  - *jobs live in stage records;*
  - *the walk clip is checked at `render`, so a mismatch never loses the paid rig;*
  - *`detail_pass.py` is ported, with a `stack` command.*

  *Note: the runner's `estimate` plans only to the next gate, so a new target's estimate shows 1 image. The stage sum, pinned by a test, is the full cost.*
- [x] Money safety before any paid run (found in C2):
  - *Staleness:* today every stage hashes the whole spec, so any spec edit makes paid stages stale again, while a changed house prompt or palette makes nothing stale. A stage's inputs hash will cover only the spec fields and options it declares it reads, plus the stages it depends on.
  - *Failed paid jobs:* a paid stage that failed after the provider accepted its job keeps the job id, and the next run resumes that job instead of paying for a new one.
  
  Test-first, with fake providers.
  - *Staleness, `278ca27`:*
    - *An optional `Stage.reads` names what a stage reads: spec fields (`spec(spec)`), options (`values()`), files no stage writes (`files(spec, target)`; a missing one hashes as "missing") and upstream stages (`stages`, hashed from their records' `outputHashes`).*
    - *A stage without `reads` keeps the whole-spec hash, so old records stay valid. `definePipeline` refuses a `reads.stages` entry that isn't an earlier stage. All twelve character stages declare their reads.*
    - *The runner takes each stage's hash when the stage runs, not at plan time. Otherwise the next run finds the downstream stages stale and pays for them again; a mutation confirmed it.*
    - *Red: editing `stepRate` re-ran `look` instead of only `install`; a changed house prompt, style image or upstream output re-ran nothing.*
  - *Failed paid jobs, `4949f55`:*
    - *`MeshProvider.resume(job)` only polls. The runner hands a failed record's jobs to the stage when its inputs hash is unchanged, and `model` and `rig` resume and download instead of submitting.*
    - *Every failure after Meshy accepts a job names that job. A job that ended FAILED, CANCELED or EXPIRED is dropped, so a re-run starts a new one.*
    - *Red: a timeout after submit, then a re-run, called `imageTo3d` twice. Green: once, and the audit log shows one charge.*
  - *Spend counts when the provider charges, `ce2f3cd`:*
    - *A meter on each stage's provider calls counts an image when it comes back and a Meshy job when Meshy accepts it (its reported credits, else the stage's estimate). A failed call counts unless it surely charged nothing: a 4xx refusal, or `ProviderError.sent: false` when no request left (a missing key). A lost answer, a timeout or a 5xx counts. `resume`, `download` and `balance` are free.*
    - *A failed stage's charge goes into the run's audit entry and its record's `cost`; S6 sums failed records too. A resumed job adds nothing and its record carries the earlier charge forward; a new job after an edited spec counts again.*
    - *Red: a timeout after submit cost `{ images: 1 }` without the model's 30 credits; the project cap and S6 let the next paid run through ("expected +0 to be 4"); a lost answer and a 502 counted nothing. Green: 327 pipelines tests, `pnpm check` exit 0, and four mutations each broke the matching tests.*
  - *Accepted:*
    - *A resumed stage still counts its full estimate and needs `--paid`. That over-counts, the safe direction.*
    - *The plan still cascades: after a free stage re-runs, the paid `detail` below it re-runs even when that stage's output came out byte-identical. The cascade keeps estimates from undercounting.*
    - *When Meshy never reports a job's credits, the meter counts the stage's estimate, which is short if the real charge was higher. A stage that isn't marked paid but calls Meshy would count 0; none does.*

### C3 Skill and live run for Wick — $, O
Needs C2's money-safety step first (done, `ce2f3cd`).
**Files:** `packages/pipelines/skills/make-character-25d/SKILL.md`; in `examples/base-25d`, `pipelines/character/wick/character.json` and the first `pipelines.config.json` (written in a PR the Owner approves before the guard is installed there).
- [ ] Skill text adapted from The Last Light's make-character (no game names).
- [ ] **Waits on spec §15 Q3.** Then: `pipeline_estimate` → the coordinator relays it → `pipeline_run` stops at G1, G3, G5, G6 in turn. Each gate: the thread sends the review files to the coordinator, the hub relays them, and the Owner runs `approve-gate.yml` (an af-linux run in that wave's claim) or `automata-pipe … approve` in their own terminal. Record cost from the audit log. **CAPTURE:** keep `look.png`, the turnaround, the raw render and the polished atlas as before/after media; log asked-at, first commit and each gate time.

### D1 Props pipeline — L
**Files:** `python/{pack_models.py, drop_floaters.py}`, `src/props/{props-pipeline.ts, props-spec.schema.ts, props.test.ts}`.
- [ ] Test: `pack_models.py` on a small GLB writes an `LLP1` `<id>.bin` that R3's `parsePack` reads (pymeshlab; skip with a recorded gap if absent); stages and gates E2–E4; face caps 2 400 and 1 200; `install` writes a `props` entry that compiles. Red on missing modules. Implement.

### D2 Live props run — $, O
- [ ] **Waits on spec §15 Q3.** One Emberwick prop (a lantern post) through E2–E4, gates decided as in C3; loads in base-25d.

## Lane sim

### M3.9a 3D character controller — L, C
**Files:** `packages/physics/src/{character-controller-3d.ts, character-controller-3d.test.ts, character-controller-3d.parity.test.ts}`, its export from `./3d`.
- [x] Test: a capsule driven by `move` commands stops at a fixed wall, slides along it, climbs no higher than its step height, and pushes a dynamic crate; a 600-tick scripted run's `sim.hash()` is identical in Node, Chromium, WebKit and Firefox (C). Red on the missing module. *`0e1d7a0` on `m3-sim`; 16 unit tests and 1 parity test, red on `characterController3d is not a function`. Hash `b567ff95fe697887` (events `246328b278d1c5c8`, 36 events) in Node, Chromium, WebKit and Firefox, straight through and restored at tick 300; 88/88 package tests under the pinned Node 24.21. Checked in a cloud container, not on af-linux.*
- [x] Implement over Rapier's deterministic-compat character controller inside `physics`' own systems (audit S8); moves take a world-space `Direction8` through a constant table (audit S9). *Done differently: the controller takes a per-tick translation (`CharacterController3D` `dx, dy, dz`), and the game maps its `move` direction 0–7 through a constant table, so `physics` has no `Direction8`. Opt-in with `physics3d({ characterControllers: true })`, so the M2.1 3D golden is unchanged. Games set `dy` below 0 only while `grounded` is false (with a constant push down, Rapier's controller stalls and never steps up). A character moves from its second tick, once the broad phase knows its floor.*

### S1 `examples/physics/bodies-3d` — L, C, then R
- [ ] As M2.1b's bodies-2d on base-3d (the controller as M3.9a left it: opt-in, `dy` only while airborne): crates and balls settle, the character pushes them, golden in four engines, boot test, focused e2e; `examples/README.md` row from waiting to built. `beta-only` captures.

## Lane content

### K1 Browser-safe content entry (M3.12) — L, LB
**Files:** `packages/content/{package.json, src/schema.ts}` (the `./schema` export), `src/schema/references.ts` if its `node:` import is in the way, `src/schema-entry.test.ts`, `src/schema-entry.browser.test.ts`. Coordinator, 22:33Z, and audit re-review R1, 22:35Z: a content-lane task in W1, so `post-retro` (published in W2) and `render-pixi3d` switch to it before their W2 PRs.
- [x] Failing test: walking the `./schema` entry's import graph finds no `node:` import (and no import of the compiler, files or CLI modules); a Chromium test imports it and builds a schema with `defineContentSchema`. Red on the missing entry. *`8535c3d` on `m3-content`; content 207 Node tests and 3 Chromium tests. The walker, pointed at the root entry, reports `node:crypto`, `node:fs/promises` and `node:path`; the subpath's only package is `zod`. The `browsers` project passes in Chromium, WebKit and Firefox (9/9).*
- [x] Implement: `./schema` re-exports `defineContentSchema`, `contentRef`, `localized`, `DEFAULT_PALETTE`, `ENDESGA_64`, `ContentSchemaDef`, `ContentSchemaOptions`, `ContentSchemaPlace` and `Palette`; the root entry keeps exporting them too (additive). The content package's own tests stay green. *`ENDESGA_64` is exported from the subpath only (the root never exported it). `references.ts` has no `node:` import and is not in the graph.*
- [x] Switch the consumers: `post-retro` and `render-pixi3d` import from `@mcthaydt/automata-content/schema`; a Chromium test imports `post-retro`'s own index (red before the switch on the externalized `node:crypto`). Fallback if the subpath is refused: each extension's schemas on its own `./content` subpath. *`m3-post`: merge `8f68b9a`, switch `3970b7b`; `src/index.browser.test.ts` was red on the externalized `node:crypto`, now green, and the `provide-palette` workaround is gone. `m3-r3d-pure`: merge `70cd7f0`, switch `10817d0`; no browser project, so a Node test walks `src/index.ts`'s graph into `@mcthaydt/*` sources (red on 7 `node:` imports, now green).*

## Lane integration

### H0 HUD design — O
- [ ] The Designer (effort high) lays out the base-25d and base-3d HUD in Figma at phone portrait, 780×270 and desktop (spec §8), Endesga 64 tokens, `hostReserved` and safe area shown. The Owner looks (O) before B1's HUD code. *Laid out 2026-10-11: [Figma](https://www.figma.com/design/1V9C2V0DfkyI7Q9Ow05HpN), PNGs and README in the shared folder's `designs/m3-hud/`; sent for the Owner's look with six defaults (orbit top-right, 8-cell pad, no action button, light orbit skin, pause flush to the strip, the base-3d drag hint). B1 note: base-2d's pad insets from the safe area only, not from `hostReserved`.* *Owner, 23:01Z via the hub: "Changes". Then:*
  - *23:01:41Z: "3D joystick for 3D games";*
  - *23:02:38Z: "For 2.5D too, use the virtual joystick; and 2.5D and 3D look noticably worse compared to 2D - will we address that?";*
  - *23:12Z, corrected at 23:12:26Z: "Visually in 2.5D and 3D as it is in 2D", with The Last Light free to borrow from;*
  - *23:13Z: "Bubble bobble x Celeste as an itch indie hit is our design reference and quality reference".*

  *Answer sent through the coordinator: most of the gap is the scenes, a wireframe placeholder beside base-2d's finished art, so the bases get M3.13's art pass. The HUD moves to base-2d's skin.*

  *v2, in progress:*
  - *one analog stick on both bases (`move` carries `heading` 0–31 and `speed`, spec §5.3);*
  - *every control in base-2d's skin;*
  - *clean frames beside base-2d's at 412×915, 780×270 and 1280×720;*
  - *concept scenes rendered from base-2d's own tiles with The Last Light's lighting ideas, labelled concept and kept private.*

  *base-2d was captured at those three sizes for this (`bced229`). It scales its room by a fraction on touch screens (1.2875× at 412×915, 1.406× at 780×270, 3× on desktop), although its renderer's comment says whole pixels. This goes to the base-2d thread through the coordinator.*

  *HUD code waits for the Owner's approval of v2.*

### B1 `examples/base-25d` — L, LB, C, then R
**Files:** `examples/base-25d/{package.json, index.html, main.ts, vite.config.ts, vitest.config.ts, ship.config.ts}`, `src/{index.ts (Pixi-free), game.ts, render.ts, sim/{base-25d.plugin.ts, player.component.ts, move.command.ts, walls.system.ts, directions.ts}, content/room25d.{schema,content}.ts, golden.ts, golden.test.ts, golden.parity.test.ts, hud/, boot.test.ts}`, `content/{room.toml, look3d.toml, characters.toml, props.toml, post.toml}`, `e2e/base-25d.e2e.ts`. Needs M1.7a, R4, Q3, H0, and base-2d's `./screens` export (from the base-2d thread).
- [ ] Sim (L): `move` carries a `heading` 0–31 and a `speed` (`walk` or `run`), mapped through a constant table of 32 unit vectors (no `sin`/`cos` in a command; spec §5.3); moving into a wall stops at the wall; facing follows input; orbit never touches sim state. Red on the missing plugin. `src/sim` added to `pnpm boundaries` (root script, ship lane).
- [ ] Golden (L, then C): a scripted route with `replayGolden`; recorded in Node, committed alone; identical in Chromium, WebKit, Firefox in a cloud container.
- [ ] Page (LB): the root is free of `pixi.js` and `@pixi/3d` (game on `./game`, renderer on `./render`); `boot.test.ts` under the fake host; Wick and the room from the art pass (A2), and the atlas C3 installs later replaces Wick's; HUD per H0 v2 (the stick) with layout contracts at every reference size (`ui/testing`, L).
- [ ] One focused e2e (LB): boot, nothing before ready, no CSP violations, walk, orbit, pause. Matrix and FPS in the GPU claim (R). Not in the public gallery list; captures `beta-only`.

### B2 `examples/base-3d` — L, LB, C, then R
**Files:** as B1, with `src/sim/base-3d.plugin.ts` driving M3.9a's controller (`physics3d({ characterControllers: true })`; `move` maps `heading` 0–31 through a constant step table; `dy` below 0 only while not `grounded`), Wick as A3's low-poly mesh built in code (no rig), and a drag-to-orbit camera.
- [ ] Same steps as B1 (sim, golden in four engines, Pixi-free root, page, focused e2e).

## Lane art (M3.13, look parity)

**The bar** (Owner, 23:02–23:13Z; spec §1): 2.5D and 3D look as good as base-2d, with "Bubble Bobble x Celeste as an itch indie hit" as the reference. The art is drawn in code on Endesga 64, as base-2d's was, and no stage is paid. The Last Light's look stack is borrowed and retuned for Emberwick: its stepped lamps with bounce and haze, `sprite-light.ts`'s outline and rim, and the post chain (spec §11). What it borrows is listed in each `PROVENANCE.md` and stays private (spec §15 Q7).

**Who does what:** A2 and A3 run in the integration lane's base folders, A1 goes to the base-2d thread as a patch, and V1 is in the pipelines lane. The concept renders in the shared folder's `designs/m3-hud-v2/inputs/concept/` set the pixel scale and composition each pass starts from.

**Camera and pixel size, from the concept renders.**
- Desktop and compact landscape hold base-2d's on-screen pixel: 3× at 1280×720 and 1.406× at 780×270.
- On a phone portrait, holding base-2d's 1.29× would put the camera about 3× back. That is past §6's 1.75× pull-back, and it leaves a small, flat room.
- So the camera keeps §6's rule: pull back at most 1.75×, follow 0.55. The framebuffer follows the camera, so one texel at the focus stays one pixel: 189×420 at 412×915, about 2.18×. B1 and B2 size it through `initRenderer`'s framebuffer cap.
- Texels and vertex colours reach the screen exactly; a colour given as a number goes through `displayColor` (spec §5.2), so authored palette colours show as drawn.
- The narrow-screen follow should run along the camera's sideways axis. R1's rig follows world x, as The Last Light does, which moves the look point in depth once the camera is orbited or diagonal. It now follows the camera's sideways axis (`f68d726`, R1's last step).

### A1 Emberwick art kit from base-2d — L
**Files:** a patch for the base-2d thread after #22: `examples/base-2d/package.json` (an `./art` export) and `src/art/{index.ts, exports.test.ts}`.
- [ ] Failing test in base-2d: `./art` exports the palette, the palette-indexed maps (stone, moss, grass, vine, mushroom, ember, Wick) and the backdrop's painter, and nothing in it imports the game loop or the screens. Red on the missing export. Then the export, sent as a patch (spec §3).

### A2 base-25d art pass — L, LB, O
**Files:** `examples/base-25d/src/art/{room-textures.ts, room-textures.test.ts, wick-25d.ts, wick-25d.test.ts, PROVENANCE.md}`, `content/{look3d.toml, post.toml}`.
- [ ] **Room.** Build it from the kit (A1):
  - floor and walls with moss caps and vines;
  - the plinth and pillars;
  - mushrooms and the ember as billboards;
  - base-2d's night sky beyond the open roof.

  Failing test (L): every texel is an Endesga 64 colour (the `palette` validator), and the room and Wick share one texel density, base-2d's pixel size.
- [ ] **Wick.** Draw him in code as base-2d's Wick was:
  - five facings drawn and three mirrored;
  - idle ×2 and walk ×4 per facing;
  - pillow normals generated from the silhouette;
  - lit through R3's `shadeFrame`, so he gets the outline and the rim.

  Failing test (L): the frame count, the palette, and an outline on every frame.
- [ ] **Light, in content.** Put the lantern, ember, mushroom and moon lamps on the stepped model, with bounce light, floor pools and haze, tuned toward base-2d's light. `post.toml` is tuned so the frame reads like base-2d; this is done together with Q4.
- [ ] **Review.** Take screenshots beside base-2d's at 412×915, 780×270 and 1280×720 (LB), and run V1's report against the anchor. The Owner's look gate is **A-G1** (O). The captures stay private.

### A3 base-3d art pass — L, LB, O
**Files:** `examples/base-3d/src/art/{wick-mesh.ts, wick-mesh.test.ts, PROVENANCE.md}`; the room and the light come from A2.
- [ ] Build Wick as a low-poly mesh in code: cloak, hood, glowing eyes and lantern, in palette colours, vertex-lit by the same lamps. Failing test (L): the colours fall on the palette after the light steps, and the mesh stays inside its triangle budget. If the mesh misses the bar at the gate, B2 uses A2's lit sprite instead; that's the Owner's call.
- [ ] Take screenshots beside base-2d's (LB) and run V1's report. The Owner's look gate is **A-G2** (O).

### V1 Style check against base-2d — L
**Files:** `packages/pipelines/python/style_metrics.py`, `src/validators/style.ts`, `src/validators/style.test.ts`. Source: The Last Light's `scripts/verify/style-metrics.py` and `look.ts` `CHECK`.
- [ ] Failing test on fixtures. The metrics, for an anchor image set and a scene image:
  - luma p10, p50 and p90;
  - on-palette share;
  - chroma mean and p90;
  - local contrast;
  - edges p95 and hard edges;
  - glow spread.

  A scene outside the anchor's bounds, widened by the margin, fails, naming the metric. Hue is reported, never bounded. Red on the missing script. Port the script with DUEL replaced by the palette argument.
- [ ] The anchor is base-2d's room canvas at the three reference sizes, without the letterbox bands. Its bounds become binding once the Owner passes A-G1.

## Exit

### X1 Runner claims per merge wave — R
Each wave is one claim through the coordinator, covering af-linux `checks` and `parity` for every PR in it (draft PRs are opened inside the claim) and any `approve-gate.yml` runs that fall in it (spec §9.3, audit B5).

Before each claim, check every branch in the wave:
- The tarball check prints nothing: `git rev-list --objects bced229..<branch> | grep -i tgz`.
- Its rows in the provenance list are current. Re-run the list's commands for the branch.
- Every file of the branch under the list's "Copies whose file names no source" has a one-line source comment.

The waves:
- [ ] **W1:** M3.2 (the `pixi.js` bump and the tarball fetch), M1.7a, P1–P6 and C1 (one pipelines PR: P3–P6 were built together on one runner), K1. Needs #19 merged (changesets).
- [ ] **W2:** R1–R3, Q1–Q3, the S7a verdict (the doc; the spike's code needs `@pixi/3d`, so it goes in W3), M3.9a. `post-retro` and `render-pixi3d` already import from the K1 subpath.
- [ ] **W3:** R4, the S7 spike's code, C1–C2, D1, V1, B1 with A2, B2 with A3 (A1 through the base-2d thread). Needs CI read access to The Last Light, so the jobs can run `fetch.mjs --required` first: a fine-grained token, Contents: read on that one repo, an Actions secret never echoed (spec §5.2 and §15 Q6, an Owner follow-up).
- [ ] **W4:** R5, Q4, S1.
- [ ] **GPU claim (end):** S7b FPS (S7 scene and base-25d; WebGL2 and WebGPU; S20 and iPhone 13 profiles); WebGL2 vs WebGPU pixel parity for each post pass and the base-25d frame; journeys for base-25d, base-3d and the `render-pixi3d`, `post-retro` and `bodies-3d` demos (Pixel 7, 780×270, desktop); a deterministic 1920×1080 capture of base-25d for CAPTURE (`beta-only`).

### X2 Evidence and docs — O
- [ ] Spec §12 criteria each with evidence; the Owner looks at screenshots, Wick and the props; real-phone play.
- [ ] Rows for 02 and 03; `examples/README.md`; gallery (public list without `@pixi/3d` builds); CAPTURE for each merged PR (diff link and key lines, real test and CI output with run links, real screenshots and recordings).

## Execution log

- 2026-10-11: spec and plan drafted (docs only); Superpowers skills were not available, so the brainstorm → spec → plan structure was followed by hand.
- 2026-10-11: coordinator answers to spec §15 recorded (Q1, Q2 yes; Q3 held; Q4, Q5 defaults); Owner sign-off 22:04Z via the hub.
- 2026-10-11: first wave, local only, nothing pushed: P1–P2 (`9573e98`, `m3-pipelines`, 47 tests); M3.2 pins and M1.7a (`4bb9a9a`, `dac0758`, `m3-render3d`; render-pixi 21 unit + 6 browser tests, versions 10); R1–R3 (`37e9179`, `fc94931`, `acee7f4`, `m3-r3d-pure`, 92 tests); Q1 (`43d1085`, `m3-post`, 34 tests). Ran under the earlier 21:07Z policy.
- 2026-10-11: AF framework audit folded in (B1–B5, S1–S9 and nits): `'webgl2'` backend names; schemas exported plainly until M1.5; claims per merge wave; the tarball out of git; `.bin` mesh files; the audit log guarded and fail-closed; gate decisions through the hub and `approve-gate.yml`; M3.9a added for base-3d's controller; integer move directions; base-2d edits through the base-2d thread; `private: true` pin tests; one model for every role, effort by task.
- 2026-10-11: the Owner ruled on B1 at 22:19Z (spec §15 Q6, "Keep it out"): the tarball stays out of AF git; `fetch.mjs` checks its SHA-256; `@pixi/3d` is an optional dependency so AF installs without it (checked with pnpm 10: a missing optional tarball is skipped, a missing regular one fails the install). CI read access to The Last Light is needed before W3.
- 2026-10-11: P3–P6 (`45dc8dc`, `m3-pipelines`; 253 tests and 1 todo; typecheck, biome and style clean) and Q2–Q3 (`df8e62b`, `154578a`, `m3-post`; 53 tests, 10 of them in Chromium). Deviations are noted on each step. Found: `@mcthaydt/automata-content`'s root entry is not browser-safe (Q3 step).
- 2026-10-11: audit re-review of `b05755d` (22:35Z): ready to freeze once R1 is in. R1: K1 (M3.12, content lane) added in W1, with ENDESGA_64 and the consumer switch before W2. R2: CI's token is fine-grained (Contents: read on The Last Light only), never echoed, and `fetch.mjs --required` is the gate, not the tarball's absence (a warm pnpm store installs it anyway).
- 2026-10-11: S7a (`6e6da2c`, `m3-render3d`): fails as shipped, passes with two shims. Ruling (M3 thread, spec §7's fix clause): `render-pixi3d/no-eval` carries the uniform-parser shim (R4), `initRenderer` rounds the depth-stencil size (M1.7a); no tarball patch. The WebGPU half waits for S7b.
- 2026-10-11: K1 (`8535c3d`, `m3-content`; content `browsers` 9/9 in Chromium, WebKit and Firefox), R3's pin test (`52bf3b5`), Q3's `@pixi/3d` checks (`c36052c`), and the consumer switch (`m3-post` `8f68b9a`/`3970b7b`, `m3-r3d-pure` `70cd7f0`/`10817d0`). The cloud container needed `apt-get update` before WebKit's libraries would install (`docs/cloud-parity.md` now says so).
- 2026-10-11: C1 (`ecbe740`) and the pipelines follow-ups (`9477f11`: fail-closed, the pin test, one `planRun`, registry loading, `jobs` and `outputHashes`); 275 tests. `m3-pipelines` and `m3-r3d-pure` rebased onto `main` `bced229` without the old docs commits (SHAs above updated); bundles in the shared folder's `handoff/m3-lanes/`.
- 2026-10-11: M3.9a (`0e1d7a0`, `m3-sim`): the opt-in `characterController3d`; four-engine hash `b567ff95fe697887`. Ruling: direction-agnostic API (the game's constant table maps 0–7), recorded on the step.
- 2026-10-11: `m3-render3d` rebuilt from `bced229` without the tarball, as 7 commits (`97fb843`..`e96b483`): the fetch with its tests, the render-pixi foundation, `'webgl2'`, depth-stencil rounding, the caret-peer versions rule and packaging, and the spike. `pnpm check` exits 0. render-pixi passes 24 Node and 7 Chromium tests, and the spike 9/9. The pins and `no-eval` patch for base-2d is in `handoff/m3-base-2d/`. Ruling: render-pixi is no longer `private` (it is published, and the caret-peer rule needs that). `m3-post` is rebuilt on the clean branch.
- 2026-10-11: Owner direction on the HUD and the look (23:01–23:13Z, through the coordinator):
  - the joystick on both bases;
  - 2.5D and 3D as good as base-2d;
  - Bubble Bobble × Celeste as an itch hit, as the reference;
  - The Last Light free to borrow from, privately.

  Spec §1, §3, §5.3, §6, §8, §11, §12 and §15 Q3/Q7 updated. M3.13 added (A1–A3, V1). `move` carries `heading` 0–31 and `speed`. H0 v2 is being drawn in base-2d's skin beside fresh base-2d captures, with concept scenes made from base-2d's tiles.
- 2026-10-11: R4's contract gap ruled (23:33Z, spec §5.2): the stage takes `look` and `isBlocked`.
- 2026-10-11: R4 done locally but for the GPU claim (`bdd550e`..`f68d726` on `m3-stage`): `createStage3D`, the kit, lit sprites, bindings and `loadCharacter`; Chromium 13/13, Node 109/109, `pnpm check` exit 0. Colour finding recorded in spec §5.2; R1's follow fixed to the camera's sideways axis.
- 2026-10-11: C2's `render` Chromium test and money safety, `ba4b66a`..`4949f55` on `m3-character`. `pnpm check` exits 0, with 321 pipelines unit tests and 3/3 in Chromium. Spend now counts when a provider charges (`ce2f3cd`), so C2 is done locally.
- 2026-10-11: provenance list in `docs/provenance/the-last-light.md`. Of the paths the lanes change:
  - 91 hold Last Light material: 4 byte-identical, 29 ported, 39 adapted and 19 modelled on;
  - 16 only mention it;
  - 117 hold none.

  Its gaps are folded into M1.7a and Q3 (the licence fields and the lcd-perfect notice) and into X1 (in-file credits).
- 2026-10-11: H0 v2 concept renders, by a Python ray caster from base-2d's own sprites and palette. Every pixel is Endesga 64. They are in the boards. The phone portraits use §6's camera with a pixel-locked framebuffer (the art lane note). The `m3-post` bundle is refreshed at `68055a9`.
