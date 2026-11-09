# The oracles

Two scripts record what the looks' sources produced, once, so the ports in this package are held to it
(`tests/fixtures/oracles`, read by `src/testing/oracles.ts`). The tests never run the sources. The scripts run inside a
checkout of the source repository, at the commit named here, with that repository's own toolchain; they edit none of its files.

## FigureBuilder, `025ffb4`

Twelve posed frames of the base pair: each member at density 1 and 2 (hero at both, stand at 45° at both, stand at
180° at density 1, walk pose 3 at 90° at density 2). For each: the triangle soup the rasteriser drew (`soups.bin.gz`,
little-endian floats and ints), the decals, face and hand stamps, the materials, the motion state its pose came from, and the md5 of
the painted cell. `f13` marks a frame that loses an eye in FigureBuilder at this commit (the base-m hero at density 1).
Sixteen frames would be 21 MiB of soups, so the density-1 walk and the density-2 back view are left out.

```sh
cd <FigureBuilder at 025ffb4>
npm install
npx vite-node <AF>/packages/3d/scripts/oracles/figurebuilder-cells.ts -- --out <AF>/packages/3d/tests/fixtures/oracles/figurebuilder-025ffb4
```

The script reads a copy of `src/features/figure/figure.ts` with one export and two taps added (written beside it, removed
afterwards).

## EnvironmentBuilder, `6d82a52`

The vertex light at 200 vertices of each base scene (`base-interior` at `lampLit`, `base-exterior` at `day`, every
seventh vertex in a seeded order), 500 texels through the colour pipeline (lit, hazed, snapped; the light and haze from the
interior's diorama frame, the albedo from the DUEL ramps), the two scenes' first figure lit as a sprite (inputs, lights and the lit
cell in `cells.bin.gz`; PNGs beside for looking at), and the labels of three photo tiles (`oakFloor`, `brickRed`, `asphalt`) at three
texel scales. Its FigureBuilder submodule is the commit EnvironmentBuilder pins (`50235f4`).

```sh
cd <EnvironmentBuilder at 6d82a52>   # with vendor/FigureBuilder checked out at 50235f4
npm install
DENSITY=2 npx vite-node <AF>/packages/3d/scripts/oracles/environmentbuilder-look.ts -- --out <AF>/packages/3d/tests/fixtures/oracles/environmentbuilder-6d82a52
```

Both scripts are deterministic: a second run writes the same files.
