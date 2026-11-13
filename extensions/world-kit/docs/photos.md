# Photos: how a surface gets its texture

Every material in a room is a photo: brick, plaster, planks, cobbles, a roof, a rug. Nothing is drawn by hand, and no
procedural pattern imitates a material. A pattern (stripes, a checker) is a design, not a material, and is not a photo.
The process is a pixel artist's, run as code:

> photograph the surface in grey weather → cut it out → scale down → facet → scale down → index the colours → clean up

The first two steps happen once, when a photo joins the library. The rest is `photoToTile`
(`src/features/textures/tile.ts`), and runs at the texel scale a surface is seen at, so a far wall is its own small clean
tile and never a blur of the near one. The same bytes and knobs give the same tile on every machine.

## Taking a photo

- **Grey weather, flat light.** On an overcast day or in even shade there is no sun, no hard shadow and no highlight. The
  photo then carries the surface's own colours, and the room's lamps and the time of day light it.
- **Square on.** Fill the frame with the surface. Shoot a wall straight, not at an angle.
- **Know its size.** Measure, or count bricks (a course is about 0.075 m). The record needs the metres the crop spans.
- **Cut it out, and scale it down.** Crop to the surface, and make it seamless if it will repeat. The library's 38 photos
  are each at most 256 pixels on a side.
- **Your own photos, or ones whose licence allows it.** The library's are CC0 photos from Poly Haven.

The kit ships the photos and the pipeline, not a tool that cuts a photo out: crop and scale it with any image tool, put
the PNG in `assets/photos/`, and write its record.

## The record each photo needs

An entry in `assets/photos/photos.json`, named for the photo, with five fields:

| Field | What it holds |
|---|---|
| `file` | the PNG's name in `assets/photos/` |
| `size` | `[width, height]` in metres: how much of the world the photo spans |
| `source` | where it came from (`polyhaven:<asset>` for a Poly Haven map, or a plain description of your own) |
| `licence` | its licence (`CC0` for the library's) |
| `credit` | who made it, and where to find it |

`tests/unit/textures/swatch-tiles.test.ts` fails when a photo lacks its source, licence or credit, or when the PNG is not
there ("names every photo's source, licence and credit, and its file is there"), and when a textured swatch names a
photo the library does not have ("has every photo a kit swatch is cut from").

## Using it: a swatch's `texture`

A swatch in `library/swatches.json` gets its texture from a photo and a few knobs:

```json
"brickRed": {"ramp":"rust","step":3,"texture":{"photo":"brick","colour":"photo","wear":0.35,"seed":3},"accent":"soot"}
```

| Knob | Default | What it does |
|---|---|---|
| `photo` | (required) | the library photo |
| `colour` | `'tone'` | `'tone'`: the photo's light as whole steps on the swatch's DUEL ladder, and on its `accent`'s where the hue parts (mortar, moss); one photo of planks makes a red door and a teal one. `'photo'`: the photo's own main colours, each snapped to DUEL |
| `scale` | 1 | scales the photo's size in the world |
| `turn` | false | turns the photo a quarter |
| `flatten` | 0.85 | how much of the photo's slow light changes (a cloud's shade, a damp patch, lens falloff) is taken out before indexing |
| `facet` | 1 | the Kuwahara radius, in texels of the photo: flattens it into patches of one colour, keeping edges |
| `contrast` | 0.07 | tone mode: the OKLab lightness a tone step spans |
| `range` | [−2, 1] | tone mode: the offsets kept |
| `accent` | 0.06 | tone mode: how far a texel's hue must part from the surface's to take the accent |
| `colours` | 8 | photo mode: the colours k-means keeps before they snap to DUEL |
| `cluster` | 4 | the clean-up: a cluster under this many texels joins the neighbour it borders most |
| `wear` | 0.3 | patches a step darker (0 new to 1 derelict) |
| `seed` | 0 | shifts where the tile wears, so two walls of one photo differ |

The defaults are written once, in `TEXTURE_DEFAULTS` (`src/features/textures/texture-spec.ts`).

## The pipeline

1. **flatten**: lightness minus `flatten` times a wide blur of it, plus the mean.
2. **facet**: Kuwahara. Each pixel takes the mean of the least varied of the four squares it is a corner of.
3. **resample**: an area average to the tile's size in texels (the photo's metres times the texels a metre), wrapping.
4. **index**: in tone mode, offsets from the median lightness in steps of `contrast`; in photo mode, k-means in OKLab, then
   each centre snapped to DUEL.
5. **wear**: value noise on a lattice with a whole number of cells across the tile, so it wraps with it, steps whole
   patches down one step.
6. **clean**: an orphan or a spur takes the most common label round it, and a cluster under `cluster` texels joins the
   neighbour it borders most, in up to four passes, wrapping.

A texel's label is `slot·16 + value`: slot 0 is the swatch's ladder and slot 1 its accent's, with the value an offset + 8;
slot 2 + r is DUEL ramp r, with the value its step.

## Tiles are committed, and checked

Each textured swatch has a tile in `library/tiles/<swatch>.tile.json`, stamped with its photo's sha-256 and the texture
it was cut with. Make them, or check them, with the kit's command:

```sh
pnpm --filter @automata/world-kit textures          # write a tile for every textured swatch (--out <folder> for elsewhere)
pnpm --filter @automata/world-kit textures:check    # write nothing; list tiles missing, stray or stale
```

The command exits 0 when all is well, 1 when a tile is wrong, 2 for a mistake in the command
(`tests/unit/textures/textures-command.test.ts`). A tile older than its photo or its swatch's knobs is `stale-tile`, and
`tests/unit/textures/swatch-tiles.test.ts` checks the committed tiles against what the pipeline makes now, byte for byte.

`tests/unit/textures/builder-tiles.test.ts` is the one check that the pipeline still makes the tiles it was ported from:
112 recorded md5s (`tests/fixtures/builder-tiles.json`), one for every photo in tone, photo and swatch form. Two photos may
share a frame only where it is flat: a flat photo indexes to one label in tone mode at the default `contrast`, so that frame
pins wear and not the photo. That is why every photo a swatch names also has a `<photo>/swatch` frame, cut at the knobs the
swatch gives it.

## Checking a tile: `reads`

`tileStructure` (`src/features/textures/structure.ts`) measures a tile's labels, before a room is drawn, for five things:

- **blotch**: the largest run (4-connected, wrapping as the tile repeats) of any label but the ground, as a share of the
  tile. Over **0.06** is camouflage: a patch, not a texture.
- **dominant**: the ground's share (the commonest label). Over **0.85** is flat: no structure to read.
- **span**: the tone labels' steps of shade, highest minus lowest. A painted finish holds to **1** (`oneStep`).
- **spots**: the share of the tile in small runs of 2 to 12 texels, of any label but the ground (labels mixed: a 7 beside a
  9 is one run). Many small stains read as worm-like specks under lamplight. Over **0.017** fails.
- **patches**: the same runs, counted when they are 13 to 120 texels. Many mid-size stains read as a worm-eaten wall. Over
  **0.12** fails.

Spots and patches are judged on the unworn tile (wear 0) only, because wear's own dark patches are the same size and would
fail a clean tile at an unlucky seed. `READS` holds every default in one place:
`{ at: 32, oneStep: false, maxBlotch: 0.06, maxDominant: 0.85, maxSpots: 0.017, maxPatches: 0.12 }`. `at` is the texels a
metre the surface is seen at: 32 for a room's surfaces, 64 for a prop's.

A swatch declares what it must read as, as data, `reads` in `library/swatches.json`, and **states only what differs**
from `READS`; `"reads": {}` holds the defaults:

```json
"oakFloor": {"ramp":"wood","step":3,"texture":{"photo":"planks","wear":0.25,"seed":7},"reads":{"maxSpots":0.055}}
```

A limit a swatch raises is a record of what the photo measures, not a goal: a tile that is mid-size runs by nature
declares its own. The textures command's output ends with a line for each swatch that declares `reads`: `ok`, or `fails`
and what failed (with `wear 0:` before the bare tile's numbers). `checkReads(level, library, photos)` reports the same as
a `swatch-reads` problem for a level (`tests/unit/reads/reads.test.ts`).

## Tuning a swatch that fails

Fix it in this order: **declare** what it must read as (`reads`), **change a knob** until it passes, then try another
photo. Never by drawing. `contrast` sets how much of the photo's light becomes steps (lower: fewer, a flatter tile);
`range` says which steps are kept (one-sided, `[-1, 0]`, for a finish that only has stains); `flatten` takes out the
photo's slow light; `facet` its fine grain; `cluster` the smallest patch kept; `scale` how big the photo is in the world (a
larger scale grows stains past 120 texels into a few soft mottles, which is neither a spot nor a patch). Write the value in
by hand and run `textures:check`. The kit has no command that searches a knob's range: that is the judge's missing half
(`checkReads` is the judge).
