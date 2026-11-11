# The Last Light

The framework's 3D reference game, as Emberwick is the 2D one: a story game in 1979, a night ward, a lamp and something
in the dark. MIT, with its story, art and music. It is built by feature (`src/app`, `src/features/<x>`, `src/shared`),
its content is in `content/` and opens in the suite's editors, and it runs under the framework's shell.

```sh
pnpm --filter @af-games/the-last-light dev          # the page
pnpm --filter @af-games/the-last-light test:unit    # the unit tests
pnpm --filter @af-games/the-last-light check        # types, unit tests and the layer rules
```

`DESIGN.md` holds the design rules, `PROVENANCE.md` where each asset came from.
