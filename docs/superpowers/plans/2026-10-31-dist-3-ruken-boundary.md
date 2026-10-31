# DIST.3 plan: no `@ruken/*` outside a `ruken/` folder

> Row: DIST.3 in [02](../../02-master-delivery-plan.md). Spec:
> [DIST spec](../specs/2026-10-31-dist-target-neutral-design.md) §4.4 (game config), §5 (the boundary and the moves),
> §5.3 (`--mode`), acceptance DIST-b. Lanes: game, runtime, ui, testing, content, ship, cli. Stacked on DIST.4
> (`claude/dist-4-fake-host`, #323). Strict TDD.

DIST.3 is two pull requests, one push each, because it touches about 55 files in eight packages, three games and four
tools:

- **DIST.3a (packages):** `ui`, `testing`, `runtime`, `game`, `content`, `ship` and `cli` import no `@ruken/*` outside a
  `ruken/` folder; the game config schema in `content` (§4.4).
- **DIST.3b (games, examples, tooling, and the rule):** the same for `games/*`, `examples/` and `tooling/`, the
  `platform-imports` check in `pnpm boundaries` over all four trees, the games' `build:<target>` scripts, and
  host-neutral copy.

## DIST.3a

### Interfaces

- **Produces** (`@mcthaydt/automata-content`): `GameConfig`, `gameConfigSchema` (the keys of `ship.config.ts` every
  target reads, Ruken's snake_case, unchanged), and AF's enums `RENDERERS`, `ORIENTATIONS`, `INPUTS`, `RATINGS`,
  `GAME_ID_PATTERN`.
- **Changes:** `defineExtension`'s `GameConfig` is content's `Pick<GameConfig, 'game' | 'runtime' | 'content'>`;
  `ShipConfig` is content's `GameConfig` plus `itch` and `audience`, with `game.sdk` required only by the Ruken target;
  `defineGame` checks ids with `GAME_ID_PATTERN`; `ui`'s `HostDisplay`, `FullscreenRes` and `ErrorCode` come from
  `@mcthaydt/automata-host`; `testing`'s viewport fixture likewise.
- **Unchanged:** every published name; `ship.config.ts` files type-check with no edit.

### Files

| Package | Change |
|---|---|
| `content` | Create `src/game/game-config.schema.ts` (+ test); `game-facts.ts` uses it; `ruken-check.ts` → `src/game/ruken/ruken-check.ts`; Ruken-using tests → `src/game/ruken/`, `src/preload/ruken/`; conformance test `src/game/ruken/conformance.test.ts` (AF's enums against `@ruken/manifest`'s) |
| `ui` | `geometry.ts`, `landscape-gate.ts`, `boot-failure.ts` import from `@mcthaydt/automata-host` (new dependency); delete `build/ruken-sdk.ts` and `tsdown.dts.config.ts`; `build/finish-dist.ts` without vendored Ruken types |
| `testing` | `fixtures/viewport-window.ts` on host types; `tsdown.config.ts` drops `bundleRuken` |
| `runtime` | `extension/define-extension.ts` on content's `GameConfig`; `testing/runtime-test.ts` → `testing/ruken/runtime-test.ts` (`RuntimeTest` keeps its export path); each test importing `@ruken/sdk-host` → a `ruken/` folder beside its subject; `build/ruken-manifest.ts` deleted, `build/ruken-sdk-host-testing.ts` → `build/ruken/`; `tsdown.config.ts` |
| `game` | `define-game.ts` on `GAME_ID_PATTERN`; `build/ruken-manifest.ts` deleted with its vendor entry; the two screens tests → `src/screens/ruken/` |
| `ship` | `config/ship-config.ts` on content's `GameConfig`; `manifest/*`, `publish/publish-to-ruken*`, `deploy/deploy-dev*` and the Ruken parts of `errors.ts` → `src/targets/ruken/`; the itch files → `src/targets/itch/` |
| `cli` | `check/csp-probe-live.ts` → `check/ruken/csp-probe-live.ts` |

### Steps

1. [ ] **Game config schema.** `game-config.schema.test.ts`: parses Emberwick's and the template's configs; rejects an
   unknown renderer, rating, input or orientation and an id that breaks the pattern. Red: no module. Green: the schema.
2. [ ] **Conformance with Ruken's manifest** (`content/src/game/ruken/conformance.test.ts`): AF's `RENDERERS`,
   `ORIENTATIONS`, `INPUTS`, `RATINGS` equal Ruken's; `GAME_ID_PATTERN` and `SLUG_RE` agree on a fixture list. Red: a
   deliberately wrong enum, then restored.
3. [ ] **Consumers on the AF schema:** `game-facts.ts`, `define-extension.ts`, `define-game.ts`, `ship-config.ts`. Each
   package's suite and `tsc` pass; every `ship.config.ts` type-checks unchanged.
4. [ ] **`ui` and `testing` on host types;** their Ruken type vendoring removed. `ui`'s and `testing`'s suites, `pnpm
   build` and `api-report` show no public type change except the declarations' source.
5. [ ] **Moves into `ruken/`** (the Files table), relative imports fixed; every moved suite passes unchanged.
6. [ ] **Red/green for the moves:** a temporary `rg` check (the same as DIST.3b's rule will enforce) lists no file
   under `packages/*/src` or `packages/*/build` importing `@ruken/*` outside a `ruken/` segment.
7. [ ] Changeset (patch: `content`, `ui`, `testing`, `runtime`, `game`, `ship`); `api-report --update`, `api-index`,
   `agent-skills --write`.
8. [ ] Gates; one push; draft PR stacked on #323.

### Gates

`pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm build`; `api-report`; `api-index`; `agent-skills`; changesets;
consumer smoke from packs (build configs change); `build:examples`, `build:demos`; focused E2E: placeholder, base-2d
(their configs read ship and content), demos. Parity: `ui`'s geometry types only, no behavior or golden change
(omitted, with the reason).

## DIST.3b

Planned in this file once DIST.3a is in review: the `platform-imports` check (`tooling/check-boundaries`, TS AST, so
string fixtures do not count), the games' and tools' moves, `build:<target>` scripts with Vite `--mode`, and
host-neutral copy.

## Execution log

- 2026-10-31: plan written on `claude/dist-4-fake-host` `b112a019`. Measured: 55 files import `@ruken/*` outside a
  `ruken/` folder (packages 41, games 11, tooling 10 before excluding strings in tests).
