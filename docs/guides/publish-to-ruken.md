# Publish to Ruken

A game built for `ruken` bundles the Ruken host adapter, which talks to Ruken through its SDK. ship writes the
`ruken.toml` manifest from `ship.config.ts`, checks it with Ruken's own parser, and publishes with Ruken's CLI.
A link in the game (the credits panel's, for one) is asked of Ruken, which asks the player before it opens; add `'links'`
to `hosting.wants` in `defineGame` for the game to be allowed to ask.

## Set up once

- `ship.config.ts` keeps the fields Ruken reads: `game.sdk` (written by `create-game` when you build for Ruken),
  `runtime`, `network.connect`, `content`, and `loading` or `leaderboards` when the game uses them.
- Make the game with `--targets web,itch,ruken` (a new game builds for web and itch.io unless you ask). Ruken's SDK
  comes with `@automata/framework`, so there is nothing else to install.
- Publishing needs `RUKEN_API` (the Ruken instance) and `RUKEN_TOKEN`.

## Achievements

Declare achievements in `ship.config.ts`, beside the leaderboards. A declaration is the framework's own idea, not
Ruken's: an id, a title, a description and one goal on one of your boards, either `reach` a score or stand in the
`top_percent` of players.

```ts
leaderboards: { best: { order: 'desc', min: 0, max: 999, title: 'Best score' } },
achievements: {
  'score-20': { title: 'Twenty', description: 'Score 20.', board: 'best', goal: { reach: 20 } },
  'top-ten': { title: 'Top 10%', description: 'Stand in the top tenth.', board: 'best', goal: { top_percent: 10 } },
},
```

`automata check` reports an achievement whose board is not one of yours or whose goal is not exactly one of the two.
`prepare --target ruken` writes each into `ruken.toml` and checks the result with Ruken's own parser; Ruken awards a
top share of 1, 5, 10 or 25 percent, so any other share is refused with that list, and Ruken's own limits (a title of
48 characters, a description of 120, 50 achievements, no id starting `ruken-`) are said in plain words. The web, itch.io
and desktop builds have no achievements: the declaration is accepted and nothing is drawn or stored. Titles and
descriptions are words like the rest: `automata words` writes `messages/achievements/en.json` from the declaration and
translates it into every language the game ships. Ruken's manifest carries one language today, so it gets the source text.

## Build and package

```sh
pnpm build:ruken && pnpm prepare:ruken
```

`prepare --target ruken` writes `dist/ruken.toml` and fails on anything Ruken would refuse.

## Publish

```sh
RUKEN_API=… RUKEN_TOKEN=… pnpm exec automata ship publish --target ruken
```

This prepares the build, then runs `ruken publish`, which packs, validates and uploads it. `--activate` makes the new
version live. The release workflow `create-game` writes publishes to itch.io only; to publish to Ruken from GitHub, add a job
like its itch.io job that runs this command with `RUKEN_API` and `RUKEN_TOKEN` from the repository's secrets.
