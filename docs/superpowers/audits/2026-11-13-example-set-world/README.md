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

## W2: track and platform props

New: `src/features/props/railway.ts` (`rails`, `platformEdge`, `canopy`, `signal`; registered in `register-props.ts`),
`tests/unit/props/railway.test.ts`, four presets of the same names in `library/props.json`, a README section "A railway's
things". No existing file's behaviour changed.

Steps, with evidence:

- Step 1 (failing): the test written first; `pnpm --filter @automata/world-kit test:unit -- railway` failed 39 tests,
  each `rails is not registered: unknown-generator` (and the same for the other three).
- Step 2: generators, registration, presets. The first run failed three tests, each for a real reason: the lamp kit refuses a
  coloured `bulb` (`lamp-off-tone`: a red light must be a `neon`), and the signal measured 1.35 m wide, not 1.2 (the arm's
  tail stuck out 0.1 m beyond the arm and the footing is 0.25 m either side; the arm now starts at the footing's edge). After
  the fixes: 22 files, 304 tests, all pass.

Choices the plan left open: the sleepers are 2.6 m long (so the track is 2.6 m deep, as the plan's bounds say), laid every
0.6 m with a 2.4 m ballast bed under them; `clear: true` raises the arm 40° (the plan: "far end higher"); a lit signal's
glass is `neonRed` and its light a `neon` of `#ff3b2f` (the lamp kit's only kind that takes any colour); the canopy's roof
is pitched 6° up toward the back and has a knee brace for each post (its own piece, `braces`).

Sheet: [`w2-railway.png`](w2-railway.png): each prop from two yaws, then the signal with `clear: true`. It is flat-shaded
in the swatches' DUEL colours by a small scratch renderer, not the kit's look, no texture and no light: it shows shape,
not the picture the game draws.

What I see. *Rails*: track as a child would draw it, two rails on evenly spaced sleepers on a pale bed: reads at once.
*Platform edge*: a plain wall with a coping and the pale line: correct, and dull on its own; the swatch's texture will
carry it. *Canopy*: weakest: a green slab on two thin dark posts. The pitch and the fascia read, but the braces hide
behind the fascia at the sheet's angles and it looks like a table; a real station canopy has a back wall and more posts
(`posts: 3` or `4` for a longer one), which the level supplies. *Signal*: post, level red arm, small lantern with a red
glass; raised, the arm reads clearly as "clear". The lamp is small, so at the game's scale it will be a few pixels: the
light it carries is what will say "lit".

## W3: indoor props and the platform lamp

New in `railway.ts`: `ticketWindow`, `leverFrame`, `trunk`; in `library/props.json` three presets of the same names and
`lamp.platform` (core's `streetLamp`, `height 3.4`, pole `ironDark`, head `lampHead`, glass `bulbWarm`, a `sodium` light
as core's own street lamp has); the tests are in `railway.test.ts`; the README's section lists the seven kinds, their
bounds and the preset.

Steps, with evidence:

- Step 1 (failing): the new kinds' tests and the preset's, written first: 30 failures (`unknown-generator`, and no preset
  `lamp.platform`).
- Step 2: generators and presets. One test failed on the first run for a real reason: a pulled lever leaned the wrong way
  (the sign of the turn about x was the other way round from the comment); after fixing the two constants, 22 files, 333
  tests, all pass.

Choices the plan left open: the window's glass sash is a piece in front of the partition, so "open: false is no deeper
than its counter" holds with the counter as deep as the whole; a lever at rest leans 10° toward +z and a pulled one lies
back 35° toward −z, each lever a piece of its own (`lever0` …) so only a pulled lever's piece changes (it is red); the
frame is `0.25 × levers + 0.2` m wide, so four levers give the plan's 1.2 m.

Sheet: [`w3-indoor.png`](w3-indoor.png): the window open and shut, the lever frame at rest and with levers 1 and 2 pulled,
the trunk and `lamp.platform`, each from two yaws, by the same scratch renderer as W2 (flat DUEL colours, no texture, no
light).

What I see. *Ticket window*: a wooden counter with a painted partition and a pane above: shut, the pane covers the opening;
open, it stands over the header and the opening shows. Reads as a booth. It is stiff: no grille, no shelf, no little
details a stationmaster would have; the dark green partition is a big plain slab. *Lever frame*: the best of the set:
four slim levers with knobs on a frame with a back plate, and the pulled ones, red, lie back clearly. A pulled lever
swings behind the back plate, so from the front only its tip shows: right for a signal box, hard to read at small scale.
*Trunk*: a leather-and-wood trunk with an arched lid, two straps and a brass clasp; the straps' ends poke up past the
lid's rounded back edge as small tabs: a flaw, harmless at the game's scale. *`lamp.platform`*: a thin dark pole with a
lamp head on a short arm: reads as a platform lamp; the head is small.

## Gates

Run on the three commits, in this session, on Node 24.21 in a cloud container with Chromium only:

| Gate | Result |
|---|---|
| `pnpm format` | run before every commit; no file left unformatted |
| `TURBO_FORCE=true pnpm check` | exit 0 on W1 (`96d8df4ce`, 66 tasks, 13 min 7 s), on W2 (`2bdd7056b`, run in a separate worktree while W3 was written) and on W3 (`02ffb292c`): lint, typecheck, boundaries, style, knip, every unit test, `changeset status`, `check-changesets` |
| `pnpm build` | exit 0 (16 tasks) on the W3 head |
| the kit's unit suite | 22 files, 333 tests, pass (264 before W2) |
| the kit's browser suite | Chromium only: 5 files, 30 tests, pass. `pnpm test:browser` as written stops at once: this container has no Firefox or WebKit (`browserType.launch: Executable doesn't exist at /opt/pw-browsers/firefox-1543/firefox/firefox`). WebKit and Firefox are pending for the GPU runner. None of the new props is in a browser test: the plan asks for unit tests only |
| `pnpm api-report`, `pnpm api-index` | not run: no published package changed (the kit is private; no changeset) |
| 3D journeys (`pnpm test:journeys:3d`) | not run: nothing outside `extensions/world-kit` and this folder changed |

No existing tile, swatch, prop or golden moved: `git diff --stat origin/main` shows the 62 existing tile files, the
existing props and every existing test untouched; the files changed that existed are `photos.json`, `swatches.json`
(rows added at the end), `props.json` (presets added at the end), `register-props.ts` (one table added), `tile-files.ts`
(two tiles listed, which a test demands) and the kit's `README.md`.

The W2 and W3 sessions' order: W3 was started while W2's gate was still running in a worktree; W2's gate then passed
before W3 was pushed as done, and W3 was gated on its own.

## For the tracker

Rows for `docs/superpowers/progress.md`, for the coordinator to copy:

> **Workstream: one example set (3D), world kit (W1 to W3).** Done 2026-11-13 on `claude/example-set-world`
> (`02ffb292c`, from `main` `28d72fb54`; no pull request): audit folder `audits/2026-11-13-example-set-world/README.md`.
> W1 two CC0 Poly Haven photos (`gravel_stones` as `ballast`, `rough_wood` as `sleeper`), PNG, recorded in
> `photos.json`, with swatches and tiles; W2 `rails`, `platformEdge`, `canopy`, `signal`; W3 `ticketWindow`,
> `leverFrame`, `trunk` and the preset `lamp.platform`; all in `@automata/world-kit`, none with a station's name. Each has a
> test written first and seen to fail. Gates: `pnpm check` uncached exit 0 on all three commits, `pnpm build` exit 0, kit
> unit 333 tests, kit browser suite Chromium only (30 tests; WebKit and Firefox pending). Sheets
> (`w1-tiles.png`, `w2-railway.png`, `w3-indoor.png`) are flat scratch renders for the coordinator to open; weak: the
> canopy (two posts and a slab), the 16-texel sleeper tile that repeats every half metre, the trunk's strap tabs, the ticket
> window's plain slab. No picture recorded; no existing golden, tile or hash moved. Unblocks L1 to L4 (the place).
