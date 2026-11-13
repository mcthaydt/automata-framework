# The example set: the world kit's railway things (W1 to W3)

Branch `claude/example-set-world`, from `origin/main` at `28d72fb54`. Plan: tasks W1 to W3 of
`docs/superpowers/plans/2026-11-13-one-example-set.md` (on `claude/example-set-plan-audit`), with that audit's corrections:
the photos are PNG with source `polyhaven:<id>`, CC0, recorded as the kit records them; the generators and the
`lamp.platform` preset live in the world kit for everyone and no name in the kit is a station's. Only
`extensions/world-kit` changed.

Pictures are not recorded anywhere: the sheets below are for the coordinator to open, and no golden, hash or recorded picture
moved (`git status` after each step shows only new files and the files each step names; the 62 tiles that existed are
byte-identical after `pnpm format`).

## W1: two photos and their swatches

| | `ballast` | `sleeper` |
|---|---|---|
| Source | Poly Haven `gravel_stones`, "Gravel Stones" by Amal Kumar, CC0, 2 × 2 m | Poly Haven `rough_wood`, "Rough Wood" by Rob Tuytel, CC0, 0.5 × 0.5 m |
| Photo | `assets/photos/ballast.png`, 256 × 256 PNG (the 1k colour map scaled down with Lanczos) | `assets/photos/sleeper.png`, 128 × 128 PNG |
| Swatch | slate step 3, `scale 2`, `contrast 0.025`, `range [-2, 2]`, `facet 0`, `flatten 0.7`, `cluster 2` | wood step 1, `contrast 0.03` |
| Declared reads | `maxSpots 0.02` | `maxBlotch 0.11`, `maxPatches 0.36` |
| Tile | `library/tiles/ballast.tile.json`, 128 × 128 texels, 44 KB, photo sha-256 `78de41b30e8e…` | `sleeper.tile.json`, 16 × 16, 1 KB, `41e8a7496273…` |

The network allowed the download (`api.polyhaven.com`, `dl.polyhaven.org`), no account or key. `gravel_stones` was chosen
over `rocky_gravel` (brown: the wrong colour for ballast) after looking at both; `rough_wood` over `weathered_planks` as the
darker, plainer timber.

Sheet: [`w1-tiles.png`](w1-tiles.png), the two tiles as the kit draws them, four pixels to a texel (ballast cropped to a
64-texel window, sleeper tiled 4 × 4).

What I see. *Ballast*: a mid-grey ground with darker and lighter flecks of two to four texels: reads as crushed stone seen from
above, the right grain for a railway bed. It is busy: a camouflage pattern more than loose stones, because the palette
steps are few. The declared `maxSpots 0.02` is a little above the kit's default 0.017 for that reason (the measured value was
0.0179 at wear 0). *Sleeper*: dark warm brown with two long cracks running the grain: reads as old timber. It is weak in
two ways: the tile is 16 texels (0.5 m at 32 texels a metre), so the cracks repeat every half metre when tiled and the
repeat shows in the sheet; and the cracks make one long run, hence `maxBlotch 0.11` (measured 0.102) where the default is
0.06. A longer photo crop would cure the repeat; it needs a second Rough Wood scale, not a different photo.

Steps, with evidence:

- Step 1 (failing): rows in `photos.json` and the two swatches with no tile: `textures:check` printed
  `missing-tile  The swatch "ballast" has a texture but no tile` and the same for `sleeper`, exit 1.
- Step 2: photos added, `textures` written; `textures:check` exit 0; `pnpm --filter @automata/world-kit test:unit` first
  failed one test (`albedo-tiles.test.ts` "holds a tile file for every committed tile": `tile-files.ts`, the browser index of
  the tiles, did not list the two), then after listing them: 21 files, 264 tests, all pass.
- Gates: `pnpm format`, then `TURBO_FORCE=true pnpm check` exit 0 (66 tasks, 13 min 7 s).

One thing for the next person: `pnpm textures` under plain Node 24.21 stops on `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` in
`packages/sim/src/shared/world/snapshot.ts` (a constructor parameter property, which strip-only mode refuses), and the
tiles it writes are one line each, which `pnpm format` then lays out as the committed ones are. I ran it with
`NODE_OPTIONS=--experimental-transform-types`, then `pnpm format`. Nothing in the repo changed for that.

## For the tracker

(Rows for `docs/superpowers/progress.md`, for the coordinator to copy. Filled in as the tasks finish.)
