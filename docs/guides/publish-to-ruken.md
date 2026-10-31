# Publish to Ruken

A game built for `ruken` bundles the Ruken host adapter, which talks to Ruken through its SDK. ship writes the
`ruken.toml` manifest from `ship.config.ts`, checks it with Ruken's own parser, and publishes with Ruken's CLI.

## Set up once

- `ship.config.ts` keeps the fields Ruken reads: `game.sdk` (written by `create-game` when you build for Ruken),
  `runtime`, `network.connect`, `content`, and `loading` or `leaderboards` when the game uses them.
- The game's package depends on `@ruken/sdk`.
- Publishing needs `RUKEN_API` (the Ruken instance) and `RUKEN_TOKEN`.

## Build and package

```sh
pnpm build:ruken && pnpm prepare:ruken
```

`prepare --target ruken` writes `dist/ruken.toml` and fails on anything Ruken would refuse.

## Publish

```sh
RUKEN_API=… RUKEN_TOKEN=… pnpm exec automata-ship publish
```

This prepares the build, then runs `ruken publish`, which packs, validates and uploads it. `--activate` makes the new
version live. In CI, the reusable `game-release.yml` publishes to Ruken on each release.
