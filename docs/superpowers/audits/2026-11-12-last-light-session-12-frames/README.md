# The Last Light, session 12: frames and tables

Chromium on software GL (SwiftShader, `AF_WEBGPU=software`), 1024 by 768 for frames. WebKit, Firefox and a real GPU did not run. The old game's frames are session 8's real-play capture of `92e6704` (no `?debug`, Begin clicked).

## Item 1: setup, the check, the second night

- **Setup.** The container's local `claude/last-light-prologue` was an older divergent copy (the early sessions' commits under other hashes); it was moved to `origin/claude/last-light-prologue` (`7c3f95778`, the brief's base). Node 24.21.0 exactly (the container has 24.22.1 and 22.23.4; 24.21.0 was fetched from nodejs.org into a scratch folder), pnpm 10.34.6. `vendor/FigureBuilder` is a private repository: attached with `add_repo`, cloned to `/home/user/figurebuilder`, checked out in the submodule at its pin `23f889c8a` (a local `submodule.vendor/FigureBuilder.url` override in `.git/config`; `.gitmodules` is unchanged), then `pnpm install --frozen-lockfile` and `node vendor/figure-builder/types.mjs` (exit 0).
- **No merge.** `origin/main` (`924a26ef7`) is already an ancestor of the branch; it has `.gitmodules` with `vendor/FigureBuilder` and no `extensions/figures`, so the builders fold is not in it and there was nothing to merge.
- **The whole `pnpm check`**, alone, on `7c3f95778`: PASSED (lint, typecheck, boundaries, style, source-names, knip, `test:unit`, `check:changesets` 83 changesets, 0 problems), real 13 min 9 s.
- **The second-night journey**, alone (`pnpm --filter @af-games/the-last-light test:e2e --workers=1 --trace off --grep "second night"`, the test's own 30-minute limit, the run's limit 2 h): PASSED, 19.2 min. Session 11's run had been cut by its time limit; this is the first full run of it. The first night's and the second night's facts and items agree.

## Item 2: the floor's colour (the joint colour, then `ward-floor`)

**Cause (why the floor was grey-violet and mottled, with no grid).** Session 11 found that making the floor's tiles warm made the grout vanish: in tone mode (`pipeline.ts` `indexTone`) a texel whose hue parts from the surface's mean takes the accent's ladder, and the photo's joint is another hue, so the joint went to the accent (`ward-floor-warm`, sand step 0) along with the warm tiles and was lost among them. The body was slate (violet in this light), and the photo's own tone changes inside each tile (range -2 to 1, cluster 5) were the mottle.

**What was built (small, generic, opt-in, in the world kit).** A texture may name a `joint` swatch (and a `jointDepth`, in tone steps, default 2). With it, `indexTone` first takes out the texels that are at least `jointDepth` steps under the median light, labels them in a new slot (`JOINT_SLOT` 40, above the 32 photo ramps' slots 2 to 33, so no existing tile holds one) as one flat tone, and measures the surface's mean hue, its accent share and its medians without them: the accent can no longer take the joint. `ladderOf` reads the joint swatch's ramp and step (a missing swatch falls back to the swatch's own, as the accent does), `tileColours` reads the new slot against it, and wear leaves it alone. Without `joint` nothing changes: **no other tile moved** (all 25 of the game's tile files regenerate to the same data but `ward-floor`'s; the kit's 38 committed tiles still match byte for byte, `tests/unit/textures/swatch-tiles.test.ts`), so no other game's recorded picture, hash or golden moves. `@automata/world-kit` is private: no changeset. Test first: `extensions/world-kit/tests/unit/textures/joint.test.ts` (7 tests; 6 failed first for want of the slot, the knob and the ladder, then passed; the premise test shows the joint texels land on the accent's ladder without the knob).

**What `ward-floor` is now.** Sage step 2 (#5b7b69), warm accent sand step 0 (the old tile's own #625d54), joint `ward-floor-joint` (grey step 1, #222323, the old grout), `scale` 1.0417 (a tile of ten texels, 31.25 cm; at 1.2 the one-texel joint fell across two texels and a third of the grid was missing; the old tile is 30 cm), `jointDepth` 0.45, `range` [-1, 0], `cluster` 8, `accent` 0.007. The tile (50 by 50 texels): body #5b7b69 56.1 %, joint #222323 22.6 %, warm #625d54 21.3 %.

**Measured on the lit frame** (1024 by 768, floor boxes x 300 to 540 and 620 to 760, y 560 to 700, Ada's column left out; `old-real-play` is session 8's real-play capture, "before" is session 11's `ours-play-item6`, "after" is `ours-play-item2`; script: mean RGB to HSV hue, a chroma-weighted circular hue, warm and cool share of the pixels with chroma over 0.02, the standard deviation of a 9-row-detrended row profile over its mean):

| | old | before | after |
|---|---|---|---|
| hue of the mean colour | 146.3 | 216.6 | **149.7** |
| hue, chroma-weighted | 144.2 | 217.8 | 149.5 |
| mean RGB | 42.5, 47.6, 44.7 | 40.3, 42.0, 44.7 | 36.6, 44.4, 40.4 |
| value | 0.187 | 0.175 | 0.174 |
| saturation | 0.108 | 0.097 | 0.175 |
| warm share of chromatic pixels | 0.211 | 0.146 | 0.180 |
| row-profile grid contrast | 0.216 | 0.150 | 0.163 |
| column-profile grid contrast | 0.104 | 0.104 | 0.116 |

The hue is the old's (it was 70 degrees off); the warm tiles are a share nearer the old's; the grid is crisper than before but not yet the old's (the old tile has a lit top edge on every tile, a second line a row profile counts; ours has no edge highlight), and **the floor is more saturated than the old's** (0.175 against 0.108: the old's greens are greyer; sage step 2 is the nearest grey-green the palette has that makes the hue). Frames: [`strip-item2-old-before-after.png`](strip-item2-old-before-after.png) (old, session 11's, this commit's), [`zoom-item2-floor-old-before-after.png`](zoom-item2-floor-old-before-after.png), [`ours-play-item2-1024x768.png`](ours-play-item2-1024x768.png). The warm tiles are the photograph's patches of another hue, so some are ragged where the old's are whole tiles; the grout is also wider in places where the photo has a dark stain. WebKit, Firefox and a real GPU did not run.
