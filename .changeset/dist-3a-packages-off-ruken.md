---
"@mcthaydt/automata-content": patch
"@mcthaydt/automata-ui": patch
"@mcthaydt/automata-testing": patch
"@mcthaydt/automata-runtime": patch
"@mcthaydt/automata-game": patch
"@mcthaydt/automata-ship": patch
---

The packages import nothing of Ruken's outside a `ruken/` folder (DIST.3a, ADR 0006).

- `@mcthaydt/automata-content` owns the game config (`GameConfig`, `gameConfigSchema`, `RENDERERS`, `ORIENTATIONS`,
  `INPUTS`, `RATINGS`, `LEADERBOARD_ORDERS`, `GAME_ID_PATTERN`), also from the browser-safe
  `@mcthaydt/automata-content/game-config` entry. The keys are Ruken's manifest names, unchanged, and a test holds
  AF's lists to Ruken's.
- `ShipConfig` extends that `GameConfig`. `game.sdk` is optional; `prepare --target ruken` refuses a config without
  it, through Ruken's own parser. Every existing `ship.config.ts` type-checks unchanged.
- `defineExtension`'s `GameConfig` and `defineGame`'s id check use the game config.
- `ui` and `testing` take their host types (`DisplayMetricsPayload`, `FullscreenRes`, `ErrorCode`) from
  `@mcthaydt/automata-host`, and no longer vendor Ruken's declarations. `game` no longer vendors Ruken's `SLUG_RE`.
- `RuntimeTest` (Ruken's fake host) and the Ruken-backed tests move under `ruken/` folders, as do ship's Ruken
  target (`targets/ruken/`) and its itch target (`targets/itch/`). The public entry points are unchanged.

BREAKING: `ShipConfig` is now `GameConfig & { itch?, audience? }` from `@mcthaydt/automata-content/game-config`, with the
same keys; `game.sdk` is optional, so code that reads `config.game.sdk` must handle `undefined`. `defineExtension`'s
`GameConfig` is `Pick<GameConfig, 'game' | 'runtime' | 'content'>` from the same entry. `ui`'s `ErrorCode` is
`@mcthaydt/automata-host`'s `ErrorCode`, the same ten codes. The published `ui`, `game` and `testing` packages no
longer ship `dist/vendor/` copies of Ruken's declarations or `SLUG_RE`.
