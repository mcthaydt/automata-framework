# Ember Hall (base-3d)

The 3D reference game: Wick walks one room under the angled camera, takes embers and rolls over two channels. It has
the same shape as [Emberwick](../emberwick), the 2D one: features by name in `src/features/`, shared numbers, an app
that wires them, and the sim's tests beside it.

```sh
pnpm dev          # play it in the browser
pnpm test         # the sim's tests
pnpm check        # every check before publishing
```

3D needs `@automata/3d` and the Pixi 3D beta, so a build of this game is private. The tour of a 3D game is
[Make a 3D game](../../docs/guides/3d.md); the game's own design, with its flow and controls, is [`DESIGN.md`](DESIGN.md).

## Where things are

| Path | What it holds |
|---|---|
| `content/levels/room.af-sector.json` | The room, in the `af-sector/2` level format |
| `content/figure-*` | Wick: his swatches, gaits, stands, hair, headwear and items |
| `content/tuning.toml` | The numbers the Tuner slides |
| `src/features/` | One folder for each thing in the game |
| `tests/` | Unit tests of the sim and the browser journeys |
