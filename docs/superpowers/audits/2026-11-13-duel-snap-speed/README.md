# The DUEL snap, made cheap with the same output (2026-11-13)

Branch `claude/duel-snap-speed`, from `origin/main` `ec7506d6`. No pull request, no workflow change, no publish, no recorded
picture, golden or hash touched.

## What was found, and what was done

`packages/3d/src/features/look/duel-snap-filter.ts` is the look's one palette snap. It lives only in `@automata/3d`
(exported from `entries/index.ts`) and is built by `createLookPasses` (`look-pass.ts`) in every look. Nothing else imports it:
the games, kits and examples get it by naming a `look`. For every pixel it looped the 256 DUEL colours twice: once for the
nearest colour to `colour + t`, and once for the nearest colour to the colour itself, which keeps a colour that is already a
palette colour from being tipped onto a neighbour by the dither. `t` is the 4 × 4 Bayer offset, `(Bayer / 16 - 0.5) * strength`
(strength 0.04 by default), **added to all three channels**.

- **The snap's input is 8-bit.** The chain's transients take the view's target format (`bgra8unorm`); nothing in `packages/3d`,
  the extensions, games or examples asks for a float scene colour. So the input is one of 16,777,216 colours.
- **A plain 256³ lookup cannot be exact.** The answer depends on the colour *and* on one of 16 float offsets, and the offsets
  are not multiples of 1/255. Sixteen 16.7 M entry tables would be 268 MB.
- **Design: exact by construction.** For each cell of a 16 × 16 × 16 grid over the colour cube, a CPU table
  (`duel-snap-table.ts`, plain TypeScript, built once per dither strength) lists the palette colours that can be nearest to
  *any* point the cell, swept by the whole dither range, can reach. A colour is dropped only when another colour is nearer than
  it to every point of the swept cell by more than 1e-5 squared distance (a linear test, checked at the sweep's corners; float32
  error on a sum is about 5e-7). The cell is widened by 1/8192 so a colour on or across a cell edge still finds its own.
  The shader then runs **the same loop body, the same two distance sums, the same strict `<`, over that short list in palette
  order**, so the first-index tie-break and the "a palette colour stays itself" rule are the old loop's, not a re-derivation of
  them. The list always contains the colour nearest the undithered colour too (a zero offset is inside the sweep), so the
  second distance is unchanged.
- The table is an RGBA8 texture, 256 × 80 texels (81,920 bytes) at the default strength: texel 0 of a cell holds its count less
  one, then the candidate indices, four to a texel. It is made once when the effect first draws, is nearest-sampled with no
  mips and no premultiply on upload, and is destroyed with the effect (`destroy()`; the renderer's teardown already calls it).
  Changing `dither` builds (or reuses) the table for the new strength and replaces the texture.
- **The palette constants stay the shader's own** (`toFixed(4)` values in a constant array), indexed by the candidate, so the
  values compared are the old ones.

### One thing about `@pixi/3d` the next person needs to know

`FullscreenPass` reads *graph transients* only: a read of an imported texture throws in `RenderGraph._inputClamp` ("imported,
not a transient"), in beta.2 and in the vendored beta.3. A table made once on the CPU has no way in through it. The snap
therefore has its own small pass, `snap-table-pass.ts`: a `RenderPass` that does what `FullscreenPass` does (same header, same
read bits, same draw) and binds the table's source itself. It reads colour and the table, never the scene's depth
(`present-pass.ts`). It uses `pass.pipe`, `session.view3d._graph._inputClamp` / `._texture` and the exported shader bits, like the
engine's own `OutputPass` and `FullscreenPass` do; **the beta.3 upgrade must re-check it** (the browser comparison tests below
fail loudly if it breaks). The one existing test that named the snap's reads, `present-pass.test.ts`, now says "colour and its
table, and no depth" (it still asserts no depth read).

## What was kept for the comparison

`src/testing/duel-snap-reference.ts` is the old shader text, unchanged, as `DuelSnapReferenceEffect` (not exported from any
entry, not in any look). `src/testing/duel-snap-compare.ts` draws a gradient through the table's snap and through the reference
and reads back the pictures.

## Measured

Everything below is one Chromium (headless, software GL, this container) with the probe in `probes/zz-snap-probe.test.ts.txt`:
a default look (haze, grade, snap, present), one box, `renderer.draw` then a 1-pixel `gl.readPixels` so each frame is
GPU-synchronised; 3 runs of 8 frames after 3 warm-up frames (raw numbers in `probes/before-main-ec7506d6.json` and
`probes/after-duel-snap-speed.json`). "Snap off" removes the `DuelSnapEffect` from `view.passes`. The snap runs at canvas
resolution (it is the present pass), so the look's `pixel.short` does not move it (rows 2 and 4 repeat rows 1 and 3).

| Stage (canvas) | Frame before, snap on (ms) | Frame after, snap on (ms) | Snap off (ms) | The snap's share before → after (ms) |
|---|---|---|---|---|
| 844 × 390 (`short` 180) | 488.9 (480.8 to 492.3) | **65.3** (65.0 to 68.7) | 40.3 | about 446 → about 25 |
| 844 × 390 (`short` 292) | 467.5 (453.6 to 481.2) | **71.8** (68.2 to 74.9) | 39.6 | about 425 → about 32 |
| 1024 × 768 (`short` 180) | 1151.9 (1122.2 to 1152.9) | **165.2** (149.3 to 166.5) | 94.2 | about 1054 → about 71 |
| 1024 × 768 (`short` 380) | 1102.3 (1093.7 to 1131.3) | **155.5** (144.4 to 158.6) | 93.2 | about 1001 → about 62 |

(Medians of three runs; the range is in brackets. The "before" share subtracts the before run's own snap-off median
(42.8, 42.4, 98.2, 100.9), the "after" share the after run's (the column shown).) A pass-through `PresentEffect` in the snap's place costs about 3 ms more than no pass at all at
844 × 390, so the floor for a third full-screen pass is small; what is left of the snap is the loop over the candidates.

| Number | Value | How taken |
|---|---|---|
| Lookup texture, memory | **81,920 bytes** (256 × 80 RGBA8; `texture.data.byteLength`) at the default strength 0.04; 65,536 at strength 0, 114,688 at 0.13, 311,296 at 0.5, 491,520 at 1 | `candidateTable(s)` |
| Build time at start-up, on the CPU | **about 46 ms** at 0.04 (43, 46, 50, 49, 49 ms in five fresh Node 22 processes, so V8 cold); 36 ms at 0, 51 ms at 0.13, 483 ms at 0.5, 1.4 s at 1 (one warm process) | `performance.now()` around `candidateTable(s)`; the table is shared per strength and built once |
| Candidates a cell | 4.35 on average and 16 at most at 0.04 (3.10 and 13 at 0, 7.57 and 27 at 0.13, 24.2 and 73 at 0.5, 47.7 and 119 at 1) | same |
| Sim ticks a second | **not measured here**: The Last Light is on another branch. The loop takes 6 ticks a frame at most and keeps 60 a second, so a frame under about 100 ms (the finding's own relation, `MAX_FRAME_MS`) lets the sim keep real time; the frame went from about 490 ms to about 65 ms at 844 × 390 | arithmetic on the probe's frames, not a game run |

Strengths above about 0.5 make the table slow to build (the dither then reaches most of the palette from every cell); the shipped
look is 0.04 and the schema allows up to 1. The result is still exact, only the start-up and the list length grow.

## The proof

1. **CPU, exhaustive** (`tests/slow/duel-snap-exhaustive.test.ts`, `pnpm --filter @automata/3d test:slow`, run here): for all
   16,777,216 8-bit colours in all 16 Bayer cells, the table's CPU model returns the same palette index as the model of the old
   loop (same distance rule, tie-break, 4-decimal palette values as the shader, and the same palette-colour-stays rule), at
   dither 0.04, 0 and 0.13: **268,435,456 comparisons each, 0 mismatches** (64.7 s, 62.7 s and 88.7 s on 4 cores).
2. **CPU, in the suite** (`tests/unit/look/duel-snap-table.test.ts`, 8 tests): a lattice, every palette colour and its 26
   neighbours, and 4,000 to 20,000 seeded random colours, at 0, 0.04, 0.13 and 0.5, in all 16 cells; every palette colour is itself in
   every cell at 0, 0.04 and 1; the candidate lists are in palette order and within the palette; the table is small and shared.
   (A mutation that built the table as if the dither were zero fails it, with `210 not 209`.)
3. **Real browser** (`tests/browser/parity/look/duel-snap-table.test.ts` on WebGL2, `tests/browser/webgpu/duel-snap-table.test.ts`
   on WebGPU through SwiftShader): a pass draws `colour = (5 · pixel + frame · 1048573) mod 2^24`, so 16 frames of a 512 × 512
   view are 3,768,320 distinct 8-bit colours (the view's 460 rows; the rest keep the stage background, which no pass draws) in
   all 16 Bayer cells. The same frames go through `DuelSnapReferenceEffect` and through `DuelSnapEffect`. **The two pictures are
   byte-for-byte the same, 0 differing pixels in every run**, at dither 0.04, 0 and 0.13, on WebGL2 and on WebGPU, and again
   after a live `dither = 0.2` on an effect made at 0.04 (the rebuilt table). Every output pixel is a palette colour.
   The test reads the gradient back unsnapped, so it knows the exact 8-bit input it gave the snap.
4. **Against the CPU double model**: the WebGL run also compared the GPU's answer with the CPU model: 0 pixels differ at 0.04,
   4 at 0 and 1 at 0.13, out of 3.77 M. These are exact ties in double that 32-bit arithmetic breaks the other way; the old and
   the new shader agree on all of them (the comparison above is old shader against new shader).
5. The ties and the second distance come out the same by construction (item "Design") and by items 1 and 3.

## Gates

| Gate | Result |
|---|---|
| `pnpm format` | clean |
| `TURBO_FORCE=true pnpm check` | **exit 0** on the third run (uncached: lint, typecheck, boundaries, style, source-names, knip, `test:unit` over 66 tasks, changeset status, check-changesets, 80 changesets, 0 problems). The first run failed `boundaries` (a `#src` import inside `src/testing`), the second the committed `3d.api.md`; both fixed |
| `pnpm build` | ok (16 tasks) |
| `pnpm api-report --update`, `pnpm api-index --write` | run; only `tooling/api-report/reports/3d.api.md` changed: `DuelSnapEffect` lists `destroy()` and a private field. Committed. `api-index`'s `dist` is not tracked |
| `@automata/3d` browser, Chromium (`browser (chromium)` and `webgpu` with `AF_WEBGPU=software`) | 18 files, **62 passed, 2 skipped**, 0 failed; no golden or hash moved, nothing re-recorded |
| `world-kit` browser, Chromium | 5 files, 30 tests passed |
| `character-kit` browser + webgpu, Chromium | 7 files passed, 3 skipped; 58 tests passed, 3 skipped |
| `base-3d` e2e (`base-3d` and `base-3d-dev` projects, Chromium) | 14 passed (1.8 min) |
| `3d-story` e2e (`story-3d-phone`, `story-3d-ipad`, Chromium) | 14 passed (2.1 min) |
| `examples-3d` e2e (`examples-3d`, Chromium; its WebKit project not run) | 22 passed (1.8 min) |
| Changeset | none: `@automata/3d` is `private: true` (and nothing published changed) |

## Not run, and why

- **WebKit and Firefox**: not installed in this container. The three-engine parity there is the Owner's runners', and it is what
  finally proves "identical" across engines. The browser comparison reads the same bytes in Chromium's WebGL2 and WebGPU only.
- **A real GPU**: only Chromium's software GL and SwiftShader WebGPU ran here. 32-bit arithmetic contraction (FMA) on a real GPU
  can in principle round the two sums differently *within* a candidate; the slack (1e-5 against about 5e-7 of float error)
  covers which candidates are kept, not the loop's own rounding, which is the old loop's. The Owner's GPU runner should see the
  same pictures; a byte that moved there is the thing to investigate, not to re-record.
- The Last Light game itself (another branch): its tick rate was not re-measured.
- `figures` and the remaining examples' e2e beyond the three named ones; the unit suites cover them in `pnpm check`.

## For the tracker

| Row | Status |
|---|---|
| DUEL snap, per-pixel palette loop (the finding, 282 ms of a 521 ms frame in Last Light) | **Fixed** on `claude/duel-snap-speed`: per-cell candidate table; the snap's share 446 → 25 ms at 844 × 390, 1054 → 71 ms at 1024 × 768 (software GL) |
| Output identical | **Proven** on the CPU for all 16,777,216 colours × 16 cells at 3 strengths, and byte-for-byte on 3.77 M gradient colours on Chromium WebGL2 and WebGPU. WebKit, Firefox and real-GPU parity: Owner's runners |
| `@pixi/3d` read limit | **Open for the beta.3 upgrade**: `FullscreenPass` takes transients only; `snap-table-pass.ts` uses `pipe` and `_graph._texture/_inputClamp` and must be re-checked then (its browser tests fail loudly) |
| The snap runs at canvas resolution, not at the look's field size | **Noted, unchanged**: `look.pixel.short` does not move its cost; a different design question |
| Dither strength above about 0.5 | **Noted**: the table is still exact but slower to build (0.5 s at 0.5, 1.4 s at 1) and its lists longer |
| 3D journey duration in CI | **To re-measure on the runners**: the frame cost that made them slow is cut by about 6 times in software GL |
