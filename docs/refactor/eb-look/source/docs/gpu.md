# The Pixi/3D harness (`src/features/gpu/`)

Cycle A of phase 1 (spec: `docs/superpowers/specs/2026-11-10-pixi3d-renderer-design.md`; plan:
`docs/superpowers/plans/2026-11-10-pixi3d-harness.md`). The harness draws the base set's **albedo frame** (the palette
index of each texel, unlit) on the GPU, through Pixi/3D in headless Chromium, and measures it against the CPU's. It
changes no CPU frame and no golden. Light, haze, outlines, figures, rain, sky and the post passes are cycles B to D.

## The architecture

```
Node (the CPU path, unchanged)                      the page (headless Chromium, WebGL2)
──────────────────────────────                      ───────────────────────────────────
roomOf: map → build → G-buffer → prepare            ids      @pixi/3d: every triangle as its own id,
   └─ CpuFrame (view/cpu-frame.ts)                           depth-tested, no blending (page/ids.ts)
frameOf: CpuFrame → FrameDesc (plain data)  ───▶   resolve   the supersamples' ids → the cell's G-buffer
tiles: tileOf makes what the page asks for ◀──▶             (FigureBuilder's raster.ts resolve)
renderGpu: calls the stages, reads the answer      cleanup   kill, fill, join (raster.ts cleanup)
diffFrames: the measure, in classes        ◀───    grow      foliage's growth (paint.ts prepare)
                                                   prepare   each texel's palette index
```

Node keeps the numbers: every vertex, normal, place, ladder and level is the CPU's own, computed once and sent; the page
never derives a camera or a colour, it draws. Mesh building, surface placement (`world/surface.ts`) and the tile and its
level (`photo/textures.ts`) are shared with the CPU path. The two stages are the **id pass** (Pixi/3D, `page/ids.ts`)
and the **screen passes** (plain WebGL2 fragment shaders over a fullscreen triangle on a context of the page's own,
`page/passes.ts`, `page/glsl/*`), because the ids come across as exact bytes and everything after them is integer and
table work that Pixi has nothing to add to.

Files (`src/features/gpu/`):

| File | What |
|---|---|
| `desc.ts` | `FrameDesc`: the description's types and sizes. Types and numbers only. |
| `frame.ts` | `frameOf(cpu, id)`: the description from a `CpuFrame`; the diorama's and first person's projections. The only reader of a `CpuFrame` for the GPU. |
| `tiles.ts` | Tile sets, levels, the atlas, `tileTexel` (where a placed texel falls), the scales. |
| `samples.ts` | `SampleIndex`: the CPU's rasteriser at a sample, from the description (the tie and the coverage edge). |
| `browser.ts` | Chromium (`openGpu`, `serveGpu`, `viewServer`): the only module that imports Playwright. |
| `gpu.ts` | `renderGpu(desc, gpu)`: the stages, the tile rounds; `renderMap`. |
| `diff.ts` | The measure: `diffFrames`, `edgeMask`, `LIMITS`, `diffLine`, `diffImage`. |
| `page/` | The browser side, bundled by Vite: `main.ts` (`window.gpu`), `ids.ts`, `snap.ts`, `passes.ts`, `view.ts`, `glsl/{common,resolve,cleanup,grow,foliage,grime,patterns,prepare}.ts`. |

The CPU's own albedo, as the index the measure compares to, is `paint/albedo.ts albedoIndex`; `view/cpu-frame.ts` holds
the frame and `fragileAt`.

## The WebGL rules

- WebGL2 only: Pixi's `preference: 'webgl'`, never WebGPU. `#version 300 es`, `precision highp float; precision highp int;`.
- Texels are read with `texelFetch` at integer coordinates: no `texture()`, no filtering, no mipmaps, no derivatives, no
  blending. Data textures are RGBA32F, `ROW` (4096) texels wide, NEAREST.
- **No undefined integer behaviour.** GLSL ES 3.00 leaves `%` with a negative operand undefined (measured on SwiftShader:
  `a % 7` disagrees with JS's on 1753 of 4096 values in −1000…1000). Never `%` or integer `/` on a value that can be
  negative: wrap with `common.ts wrapi`, parity with `& 1`, a floor division by a power of two on the float, hashes in `uint`.
- Albedo is a palette index (0–255, `PALETTE = RAMPS.flat()`); colours are looked up, never mixed.
- A texel's index is what `shade` paints under white light, with no haze and no dither; the page does not light anything.
- `pixi.js` is `8.22.0` exact; `@pixi/3d` is `vendor/pixi-3d-0.1.0-beta.2.tgz`. Only `src/features/gpu/page/` imports
  either (`tests/architecture.test.ts`); only `browser.ts` imports Playwright.

## The description (`desc.ts`)

`FrameDesc` is plain data (numbers, strings, typed arrays, JSON): no class instances, no closures, no Pixi types, so
phase 2 can retarget it. Its buffers, as floats a record:

| Buffer | Record |
|---|---|
| `verts` (12) | cx, cy, cz, nx \| ny, nz, px, py \| pz, 0, 0, 0. Diorama: the CPU's screen texels × S and its depth (larger nearer). First person: view space (x right, y up, cz = d forward). n the normal, p the world place. |
| `tris` (8) | i0, i1, i2, material \| group, part, 0, 0. Its id in the id pass is its index + 1. |
| `parts` (24) | material, framed, r0, r1 \| pan0, pan1, tileSet, anchored \| o.xyz, grime \| x.xyz, group \| y.xyz \| z.xyz. |
| `mats` (16) | kind (0 plain, 1 texture, 2 pattern), base, ladder, accent ladder \| emit, pattern, axisZ, leafy \| pattern params. |
| `ladders` (9) | 8 palette indices, then the base step. |
| `tiles` (8) | a tile's place in the atlas for (tile set, level u, level v); w = 0: not made yet. |
| `atlas` | the tiles' labels (photo/pipeline.ts: slot · 16 + value), packed, `ROW` wide. |
| `grime` | marks (12), sectors (8), groups, `rainy`. |

Also: the projection (column-major) and `zShift`, the palette, the tile sets (JSON, Node's to make tiles from), the
thresholds and levels, the scale (the diorama's ppm and pitch; first person's eye and f), the key light and the switches.

Sizes: at most `2^24 − 1` triangles, 8192 rows a data texture. `frameOf` refuses a frame past them, and a first-person vertex
in front of the camera beyond 1024 m (the id pass's linear depth clamps there).

## The measure (`diff.ts`)

The albedo is an index, and a texel either equals the CPU's or it is counted. A texel **mismatches** where its part differs
or (same part) its index does. By the first that matches:

| Class | What | Cap |
|---|---|---|
| **edge** | within 1 texel of a part change; of a texel whose samples split between parts or step in depth; of a silhouette inside a part (`JUMP` 0.02 m plus the surface's own slope); or every differing sample of the texel is one the 1/16 px snap explains (`coverageEdge`: the CPU's winner within 1/16 px of its edge and the GPU's triangle none or within 1/16 px of covering, or the GPU's triangle within 1/16 px of its edge and at least as near as the winner; a wrong id beside an edge, or a triangle behind a winner that covers by more, is not) | 2 % of the texels; the texels of it that are **not a seam** (the GPU's part and index equal the CPU's at none of the 8 neighbours: not the boundary moved by a texel) are counted per frame and printed, with no cap (the owner will set one) |
| **tie** | the parts differ and a triangle of the GPU's part covers a sample of the texel within `TIE` (1e-5 m) of the CPU's winning triangle at the same sample: coplanar surfaces, where the CPU's own choice is float noise (a poster's layers, 1 mm apart, are not ties) | 0.05 % of the covered |
| **fragile** | the parts agree, and the CPU's own albedo changes when the texel's place (or normal, or depth) moves by `FRAGILE` (1e-4 m), or by a tenth, a hundredth or a thousandth of it (`fragileAt`: float32 against float64 on a texel boundary) | 0.1 % of the covered |
| **interior** | everything else | **0, never raised** |

Why fragile and tie exist (spec note 1, the owner's rule): the plan stage measured the CPU frames' own albedo changing under a
1e-6 m move at up to 5 texels a frame (346 in `signs/fp`), at 1e-5 m up to 263, at 1e-4 m up to 715 (0.4 %); and coplanar
surfaces up to 29 texels a frame. An exact 0 between float32 and float64 is not guaranteed, so these are counted, capped and
printed per frame, never hidden. `FRAGILE`, `TIE` and the caps are the owner's to move. A tolerance on colour, a filter, a blur
or a post pass is never the way to a match.

The base set at handoff (`npm run gpu:diff -- all`, 22 lines, all `ok`): interior 0 everywhere; fragile at most 9 a frame
(`signs/fp`); tie at most 26 (`streetNight/diorama`); edge at most 1.04 % (`streetNight/diorama`).

## The commands

```sh
npm run gpu:diff -- <map|all> [--view diorama|fp] [out]   # the CPU's, the GPU's and the diff PNGs, a line a frame
npm run gpu:parity -- [<map|all>] [--view diorama|fp] [--headed]
npm run gpu:view -- <map> [--view diorama|fp] [--port 5199]
npm run test:gpu                                           # tests/gpu/: the browser tests (about 3.5 min)
npm run check                                              # gpu-albedo rows: every checked map, both views (about 40 s)
```

`gpu:diff` prints, per frame (the cap on each class applies):

```
base-interior/diorama  coverage 99.998 %  albedo 99.999 %  interior 0  fragile 0  tie 0  edge 5 (0.00 %, 5 not a seam)  ok   [gpu 785 ms, 1 round, atlas 559 rows, frameOf 2264 ms]
```

Its PNGs mark the classes: same dark grey, edge blue, tie yellow, fragile orange, interior red. It exits 1 if a frame breaks a limit.

`gpu:parity` runs two browsers, SwiftShader and the machine's GPU, prints both renderer strings, and where the second is
SwiftShader or llvmpipe says `gpu:parity needs a real GPU: this machine's WebGL is <renderer> (headless; try --headed)` and
exits 2 (it does on the cloud container). Playwright's headless Chromium (its headless shell) may fall back to SwiftShader on a
machine that has a GPU: `npm run gpu:parity -- --headed` launches the full Chromium (a window opens; leave it), and the hint is
left out then. On a machine with a GPU it prints, per frame, `<id>/<view>  same` or `<n> texels differ: <e> on edges, <f>
fragile, <t> tie, <i> inside`, classed as above with SwiftShader's frame in the CPU's place; it exits 1 if any differ inside. GLSL ES 3.00 allows 2.5 ULP in a division and fused
multiply-adds, so two GPUs may disagree on a texel on a tile boundary as float32 and float64 do. Run it by hand on the Mac:

```sh
git submodule update --init                # FigureBuilder at 50235f4
npm install
npx playwright install chromium            # Playwright 1.63's Chromium and its headless shell
npm run gpu:diff -- all out/gpu            # SwiftShader on arm64 first: 22 lines `ok`, exit 0, counts as in this document
npm run gpu:parity                         # the GPU against SwiftShader, 22 frames, about 2 minutes
```

`gpu:parity` prints two renderer strings first; the second should name the Mac's GPU (for example `ANGLE (Apple, ANGLE Metal
Renderer: Apple M…)`). If it exits 2 with "needs a real GPU" and the second string says SwiftShader, run `npm run gpu:parity --
--headed`; if that says SwiftShader too, the two strings are what to send back. Otherwise each frame is `same` or `<n> texels
differ: …`. Pass: every `inside` is 0 and the exit code is 0 (`echo $?`). Any `inside` above 0, or a `gpu:diff` count that differs
from this document's, is a finding: send the whole output and the frame's name.

`gpu:view` prints `gpu:view: http://127.0.0.1:<port>/?view`. Open it in any browser: the page runs the passes on that browser's
own WebGL (the renderer is printed under the picture), Node drives each call and gets the frame back, and the page shows it on a
canvas at the largest whole-number scale that fits, nearest. A first-person frame needs Node's tiles in a second round, which is why
Node drives the page. A reload draws it again, also in the middle of a draw: the page that opens ends the session before it (its
call in flight fails, its held poll is released, what its `render` still does is dropped). The page server answers only a `Host`
of `127.0.0.1:<port>` or `localhost:<port>` (403 otherwise: a web page that resolves its own name to 127.0.0.1 cannot read it)
and refuses a POST body over 256 MB (413); `/reply` and `/out/` answer 405 to a GET, and a malformed `/reply` body 400.

`npm run check` starts one Chromium for all its workers (`EB_GPU_WS`); each worker keeps one page (every page holds two WebGL
contexts, and Chromium drops the oldest past 16). Where the browser cannot start, `gpu-albedo` is one `fail` row naming why.

A call that fails rejects with the page's text. A stage that throws leaves the page usable; a call that the page's own `pageerror` or
`console.error` rejected leaves the page still running it (it would fetch the next call's buffers), so every later call on that page
rejects with `page broken by an earlier error: <message>`; a lost WebGL context (a real browser may drop one) rejects the call that lost
it and every later one with `the WebGL context was lost` (`page/lost.ts`; both contexts, the screen passes' and Pixi's, are watched).
Either way, open a new page.

## What cycle A does not draw

Light, haze, outlines and selout, figures, rain, the sky (the background is one flat value), the post passes, the snap and the
dither, and the live page. A prop the runtime moves is not followed (`GrimeData.propSector` is built once): cycle A draws time 0.
The goldens move in cycle D, not here.

## The pins

- `pixi.js` `8.22.0`; `@pixi/3d` `0.1.0-beta.2` as `vendor/pixi-3d-0.1.0-beta.2.tgz` (sha256 `f515c1b6…`, the file The Last Light
  vendors; its licence is `vendor/LICENSE-pixi-3d.txt`); `playwright` `1.63.0`, whose Chromium 153 (build 1243) is at `/opt/pw-browsers`
  in the cloud container. On a machine without the browser, `npx playwright install chromium`.
- SwiftShader's WebGL (`--use-angle=swiftshader`) is what the commands run on: the same description gives the same bytes on a machine of one architecture (measured on x86-64, determinism test in `tests/gpu/base.test.ts`). Across architectures it is **assumed, not measured**: SwiftShader's JIT emits different code on arm64. `npm run gpu:diff -- all` on an arm64 machine shows it (its counts should equal this document's); cycle D's goldens rest on it.
- Page build: Vite's API, once a process (about 0.3 s); the page is served from memory by an HTTP server on 127.0.0.1, because
  Playwright's `page.route` carried a frame's 5 to 40 MB through the DevTools protocol at about 11 MB/s.

## Traps found

- **`out.elements` only.** A `Camera3D` subclass's `computeProjection` writes `out.elements`; also writing `out.elements64` drew
  nothing (`page/ids.ts`).
- **The scale has two faces.** For a framed part (a prop's own frame) the tile's `u`, `v` and `down` come from the frame-local
  normal and place, but the scale `su`, `sv` from the **world** normal's face: `paint.ts prepare` calls `uv` twice and keeps the
  first call's `mu`, `mv`. The shader and `tiles.ts tileTexel` do the same, so a scale taken from the frame's face instead would differ from the CPU's (`page/glsl/prepare.ts`).
- **A GPU snaps a triangle's corners.** SwiftShader's grid is 1/16 px; it tilts a steep triangle's depth plane by slope/32 m, so two
  surfaces of one part within that order differently from the CPU's float64. The id pass snaps each triangle's corners itself, to the
  coarsest grid, and gives each the CPU's plane depth there (`page/snap.ts`); first person snaps in screen texels with 1/d the
  linear quantity (`snapPerspTriangle`).
- **First person's weights from the edges.** `rasterPerspective`'s weights from the cross products lose four digits in float32 at
  30 m; the shader takes them from the edges (`FP_WEIGHTS`).
- **The id pass's depth in first person is linear** in the distance (`gl_FragDepth = d / 1024`), so near-coplanar surfaces order as
  the CPU's metres do; a surface beyond 1024 m is not drawn.
