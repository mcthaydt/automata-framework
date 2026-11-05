# GL: a game's source grouped by role (EsperRedux's layout)

> **Status:** Draft, review pending (Owner). Drafted 2026-10-30 (task GL.0, docs only) on `main` `30e9606c`. The Owner
> approved the direction and the take/leave split on 2026-10-30; the rule details below (§5, §13) are the agent's and
> open to veto. Not reviewed, not implemented: no plan for GL.1 onward may start before this spec's review. Task rows:
> §14 (the integration owner adds them to [02](../../02-master-delivery-plan.md)). Plan:
> [2026-10-30-gl-0-game-layout-spec.md](../plans/2026-10-30-gl-0-game-layout-spec.md). Agent review of PR #243
> applied 2026-10-30 (GL.5 after every EX.4 row, `resources.ts` before `systems.ts`, GL.4 after DX.3a and with the
> Owner's words for `ci.yml`, E1 restated, citations fixed, red-first per row); the plan's log lists each.
>
> **Why (Owner, 2026-10-30, this session's chat):** "I wanted the projects structured like the esper redux project",
> then, after the coordinator's recommendation, "make the restructure when it makes sense to". The projects are the
> games (`games/*`), the `create-game` template and the one-file examples. AF's packages keep their feature folders.
>
> **Amends:** the [DX spec](./2026-10-16-dx-small-games-ai-native-design.md) §3.5 (the template's `src/sim/`), §3.6 (the
> `boundaries` step on `src/sim/`) and §3.7 (the hook on edits under `src/sim/`); the
> [EX spec](./2026-10-16-examples-one-file-design.md) §2 (the shape of an example); the
> [M1 base-2d spec](./2026-10-11-m1-base-2d-design.md) for Emberwick's file layout; `AGENTS.md`'s "Folders group by
> feature" (§5.5, a proposed sentence for the integration owner).

## 0. Sources

| Source | Revision | Used for |
|---|---|---|
| EsperRedux: `constants.py`, `components.py`, `actions.py`, `state.py`, `redux_toolkit.py`, `processors.py`, `sync.py`, `main.py`, `tests.py`, `README.md` | `mcthaydt/PyrayExperiments_EsperRedux` `c2f4365` (read-only clone) | The layout: one flat file per role (§1.1) |
| `games/emberwick` (all 69 `.ts` files, `package.json`, `index.html`, `tsconfig.json`), `games/placeholder` (all files) | AF `main` `30e9606c` | The mapping tables (§6.2, §6.3) |
| `examples/*/*-*.ts` (17 one-file examples), `tooling/examples-runner/src/catalog.ts`, `header.ts`, `catalog.test.ts` | same | The section order and its check (§5.4, §6.5) |
| `tooling/check-style/src/style.ts` (`ROLES` line 33, `DEFINE_ROLE` line 49, `NAME_RE` line 64, the `role-suffix` finding at line 186), `cli.ts`, `style.test.ts` | same | The style rule (§5.1) |
| `tooling/check-boundaries/src/cli.ts`, `check.ts` (`IMPORT_ALLOWED`, the relative-import rule, inline mode), `files.ts` | same | The sim set (§4.5, §5.2) |
| `packages/cli/src/check/check-steps.ts` (`boundariesStep` at line 91; `src/sim` hard-coded at line 101), `packages/cli/src/create-game.ts`, `agents/automata/scripts/check.mjs` (`isSimFile` at line 41; `src/sim/` hard-coded at line 45), `tooling/agent-skills/src/install.test.ts` | same | What reads `src/sim/` today (§5.3) |
| `packages/sim/src/world/sim.ts` (`describeSchemas` line 152, RNG substreams line 259, `schemaHash` line 269, `hash()` line 563), `schedule/schedule.ts` (`stableTopo`, `orderPlugins`, `orderSystems`), `define/definitions.ts` (`fieldNames = sortedKeys(fields)`, line 49), `world/snapshot.ts` (`encodeSnapshot`, line 212) | same | Why the move keeps the golden hash (§7) |
| `packages/game/src/define-game.ts`, `start-game.ts` | same | `main.ts` (§4.6) |
| Root `package.json` (`boundaries`, `style`), `.github/workflows/ci.yml` (`base-2d` job, `sim-roots: src/sim`), `game-ci.yml`, `packages/ship/src/workflows.test.ts` line 480 | same | References that change with Emberwick (§6.3) |
| GAME-3D.0's design doc §3.1, "Code layout" (PR #229, open) | `claude/3d-game-3d-0-design` `4734d6f9` | base-3d (§6.4) |
| Open PRs #194, #197, #203, #205, #219, #235 (file lists, GitHub REST, 2026-10-30) | — | Migration order (§8) |
| [02](../../02-master-delivery-plan.md) rows EX.4, EX.4cu, EX.4c, EX.4s, EX.4u, EX.4p, EX.4f, EX.4h and DX.3a; [03](../../03-continuation-prompt.md) on merge authority over `.github/workflows` | `main` `30e9606c` | Migration order and prerequisites (§8, §14) |
| Three scratch probes in `games/emberwick/src`, run under Vitest 5.0.3 and deleted (never committed) | `30e9606c` | §7 (what moves the hash) and §4.6 (`import.meta.env.MODE` under Vitest; `main.ts`'s side-effect imports in tests) |
| `node tooling/check-style/src/cli.ts games/emberwick/src games/placeholder/src` | `30e9606c` | "41 files, 0 findings": today's games already pass the style rules that a game root keeps (§8) |

## 1. What EsperRedux does, and what AF has today (measured)

### 1.1 EsperRedux (`c2f4365`): ten flat files, one per role

| File | Lines | Holds |
|---|---|---|
| `constants.py` | 9 | Every size, start position and margin (`WINDOW_WIDTH`, `PLAYER_SIZE`, `COLLECTION_RADIUS`, `STICK_SPAWN_MARGIN`) |
| `components.py` | 30 | Every component, as dataclasses (`Position`, `Velocity`, `PlayerControlled`, `Collectible`, `Score`) |
| `actions.py` | 58 | Every action creator (`movePlayer`, `collectSticks`, `respawnStick` …) |
| `state.py` | 108 | The initial state, the root reducer and the store |
| `redux_toolkit.py` | 29 | A minimal store: `dispatch`, `get_state`, `subscribe` |
| `processors.py` | 39 | The systems (`MovementProcessor`, `CollectionProcessor`, `InputProcessor`) |
| `sync.py` | 27 | `ECSStoreSynchronizer`: copies store state back into ECS components after every dispatch |
| `main.py` | 65 | The window, the entities, the loop and the drawing; `if __name__ == "__main__": main()` |
| `tests.py` | 215 | Reducer tests driven through `store.dispatch` (bounds, diagonal movement, collection at the radius) |

A reader opens the folder and sees the game's whole shape: what is tuned, what exists, what can happen, the rules,
how it is drawn, how it starts, and the tests.

### 1.2 AF today (`30e9606c`)

- **Emberwick** (`games/emberwick`, 69 `.ts` files): the sim is a folder of suffix files
  (`src/sim/*.component.ts`, `*.system.ts`, `*.command.ts`, `*.event.ts`, `*.resource.ts`, `*.plugin.ts`, plus
  `tuning.ts`, `tiles.ts`, `place-wick.ts` and `index.ts`), beside `render/` (12 files), `screens/`, `input/`,
  `content/`, `art/`, and 25 more files flat in `src/` (the game definition, the golden, the demo kit). Its plumbing
  test measures, from `main.ts`: sim 377 lines, art 393, content 96, drawing 860, plumbing 383 (limit 400); 791 lines
  in 15 files are not reached by the game (demo support, the golden replay, package entries).
- **The placeholder** (`games/placeholder`): the ship lane's proof page. No sim and no `defineGame`; `main.ts` at the
  game root, `src/boot.ts` (the Ruken handshake and one line of text), two tests, and the S8 spike's `s8/` folder.
- **The template** (`packages/cli/src/create-game.ts`): `src/main.ts`, `src/boot.ts`, `src/game.ts`,
  `src/sim/sim.ts`, `src/sim/index.ts`; no plugin, no `startGame`, no test (DX.5 has not started).
- **The one-file examples** (17): imports, then components, commands, events, systems, the plugin and
  `export default defineGame({...})`, in roughly that order but with no headings; constants are inline literals.
- **What reads `src/sim/` by name:** `automata check`'s `boundaries` step (`check-steps.ts` line 101, and a game
  without `src/sim/` is a tool error), the plugin hook (`check.mjs` line 45), the root `boundaries` script
  (`games/emberwick/src/sim`, `agents/automata/skills/automata-feature/example/src/sim`), `ci.yml`'s `base-2d` job
  (`sim-roots: src/sim`, pinned by `workflows.test.ts` line 480), Emberwick's own `check` script, its plumbing test's
  classifier, `tooling/agent-skills/src/install.test.ts` (seeds `src/sim/dx7-seeded.system.ts` in Emberwick), and the
  `automata`, `automata-feature` and `automata-verify` skills.
- **`pnpm style` does not check games or examples:** the root script is `check-style packages/*/src`.

## 2. Goal and boundaries

**Goal.** Opening a game's `src/` shows EsperRedux's shape: one flat file per role, in AF's vocabulary, with AF's laws
intact. A role that outgrows a file becomes a folder of the same name. The template generates the layout; Emberwick,
the placeholder and base-3d use it; a one-file example follows the same role order in headed sections, so graduating
it to a game means splitting at the headings.

**In scope:** the layout and its rules (§4); the checker changes that let a game use it (§5); the template (GL.2),
the placeholder (GL.3), Emberwick (GL.4), the examples' section order (GL.5), the agent skills (GL.6) and base-3d
(GL.7).

**Out of scope:**
- AF's packages (`packages/*`): they keep their feature folders and suffix files. The plural role files are accepted
  only in a game's `src/` (§5.1), so a package's `components.ts` still fails `pnpm style` as it does today.
- Folder demos under `examples/` (`content/hot-reload`, `ui/primitives`) and Plus's examples: unchanged.
- Any change to gameplay, the sim, a definition, a screen, the renderer, content or a golden. The move is a move.
- A Redux store, a reducer or a sync step (§4.2).
- New tooling to split examples or move files.

## 3. Ownership

| Lane | Rows | Owns in this spec |
|---|---|---|
| **ship** | GL.1, GL.1b, GL.2 (inside DX.5) | `tooling/check-style` (the game-root rule), `tooling/check-boundaries` (`--game`, published: a patch changeset), `packages/cli`'s `boundaries` step and the `create-game` template, the plugin hook's sim-path test (`agents/automata/scripts/check.mjs`, with the integration owner's review), the root `style` and `boundaries` scripts |
| **game** | GL.3, GL.4 | `games/placeholder`, `games/emberwick`; for GL.4, one value in `ci.yml` (`sim-roots`) and its pin in `workflows.test.ts`, coordinated with ship. The `ci.yml` edit needs the Owner's words, quoted in the PR: 03 records the merge authority over `.github/workflows` as an open question, and earlier workflow changes carried the Owner's own words (as §15 treats `game-ci.yml`) |
| **examples** | GL.5 | Every one-file example's section headings (17 at `30e9606c`; counted again when GL.5 runs), `tooling/examples-runner/src/catalog.ts` and its tests |
| **integration** | GL.6 (with DX.7b), the docs | `agents/automata/skills/*` text and the double-jump example; the GL rows in 02, the `AGENTS.md` sentence, pointers in the DX, EX and M1 base-2d specs (§15) |
| **figures/3D** | GL.7 (in GAME-3D.0 and GAME-3D.1a) | `games/base-3d`'s layout and its design doc's §3.1 |

**State ownership does not move.** The sim still owns every gameplay value; the runtime, the renderer and the screens
still read it. This spec moves files, not authority.

## 4. The layout

### 4.1 The role files

A game's `src/` holds these files directly. A role file exists only when the game has something for that role,
except `main.ts` and `game.test.ts`, which every game has.

| AF file | EsperRedux | Holds | Side |
|---|---|---|---|
| `constants.ts` | `constants.py` | Tuning: every speed, size, limit, timer and start value the code reads, as named `export const`s with units in comments | sim |
| `components.ts` | `components.py` | Every `defineComponent` | sim |
| `commands.ts` | `actions.py` | Every `defineCommand` and its Zod payload. AF's commands are EsperRedux's actions: the only way the player changes the sim | sim |
| `events.ts` | (none) | Every `defineEvent`: what the sim tells the presentation (sounds, particles, screen changes) | sim |
| `resources.ts` | `state.py`'s initial state | Every `defineResource`: the sim's singletons (a score, a progress flag), which systems read and write | sim |
| `systems.ts` | `processors.py` | Every `defineSystem`, and the helpers only systems call | sim |
| `state.ts` | `state.py` | The plugin that lists every definition (`definePlugin`) and `setup`: the starting world. The sim is the store | sim |
| `views.ts` | `sync.py` and `main.py`'s drawing | How the sim is shown and heard: entity views (`rect`, `sprite`), `draw` for the HUD, event sounds. AF's renderer applies each step's render delta itself, so a game has no sync code | presentation |
| `main.ts` | `main.py` | `defineGame` (size, sim, input bindings, views, screens, content, hosting) and `startGame` (§4.6) | presentation |
| `game.test.ts` | `tests.py` | Send commands to the headless sim, step, assert state; plus the golden replay (§4.7) | test |

Imports follow the table's order: a sim file imports only sim files above it (`systems.ts` reads `constants`,
`components`, `commands`, `events` and `resources`; `state.ts` reads all of them), plus types from `content/`.
Resources sit above systems because systems read them: a resource in `state.ts` would make `state.ts` and
`systems.ts` import each other (a cycle, and in a one-file example a use before definition). `views.ts` and
`main.ts` import whatever they compose. This is a reading guide, not a check; the check is the sim boundary (§4.5).

### 4.2 Take and leave (approved by the Owner, 2026-10-30)

**Taken from EsperRedux:**
1. One flat file per role (§4.1), named for what it holds.
2. A role file that grows past the threshold becomes a folder of the same name (§4.3), and each file inside keeps
   the folder's role (`systems/player-move.ts`). Big games such as Emberwick and base-3d fit this way.

**Left behind, and why:**
- **A Redux store or root reducer beside the sim.** That is two sources of truth, which is why EsperRedux needs
  `sync.py` to copy store state into ECS components after every dispatch. It breaks the laws that only the sim
  changes gameplay state and that the sim stays deterministic and replayable: a replay records commands into the
  sim, not dispatches into a store.
- **Reducers that dispatch from inside, and `random.randint`.** `state.py`'s `COLLECT_STICKS` calls
  `store.dispatch(Actions.collectStick(i))` mid-reduction, and `RESPAWN_STICK` reduces `GENERATE_POSITION`, which
  draws from `random.randint`. AF's
  systems run in a fixed order once per tick and draw from the sim's seeded per-system RNG, so a run replays bit for
  bit in Node, Chromium, WebKit and Firefox.
- **Global singletons.** `processors.py` and `sync.py` import the module-level `store` and call `esper`'s global
  world. AF passes the sim context (`ctx`) to every system; nothing gameplay-related is module state.
- **Systems reading the keyboard.** `InputProcessor` calls `pr.is_key_down`. AF turns input into commands outside the
  sim (`keys()` in `main.ts`), once per fixed step, so a system reads only commands and the world, and a replay needs
  no keyboard.

### 4.3 A role grows into a folder

- **Threshold: 300 lines** (counted as the style tool counts, text lines). A role file's change that would take it
  past 300 lines moves the role into a folder of the same name instead: `systems.ts` becomes `systems/`, one file
  per system or per feature (`systems/player-move.ts`, `systems/goal.ts`), with `systems/index.ts` re-exporting
  them. The threshold is a review rule, not a check (GL-D3); the 600-line ceiling stays the enforced limit
  (`file-length`, every non-test source).
- **A role is a file or a folder, never both** (enforced, §5.1 `role-split`). Importers change from `./systems.ts`
  to `./systems/index.ts` in the same commit.
- Files inside a role folder keep the folder's role: `systems/player-move.ts` may hold only `defineSystem` results
  and helpers (§5.1). A suffix inside is allowed but redundant, and must match (`systems/jump.system.ts`).
- `game.test.ts` follows the same threshold: past 300 lines, feature tests split into `<feature>.test.ts` beside it,
  and `game.test.ts` keeps the golden replay.
- `views.ts` grows into `views/` the same way. Emberwick's drawing is already 989 lines, so it starts as `views/`.

### 4.4 What else sits in a game's `src/`

Kept minimal (GL-D8):

| Path | What | Rule |
|---|---|---|
| `screens/` | The game's own screens and their flow (`flow.ts`) | Stays a folder |
| `content/` | Content sources and schemas (`*.content.ts`, TOML), as today | Stays a folder; today's suffix rule |
| `art/` | Pixel maps, palettes, `PROVENANCE.md` | Stays a folder |
| Input bindings | The `keys()` map | In `main.ts`; an `input.ts` beside it only when the bindings pass the threshold or need tests of their own |
| `testing/` | Test-only support (a scripted route, a replay harness) | Exempt from style, as everywhere |
| `index.ts`, `sim.ts`, other entries | Package entries, for a game that is also a library (Emberwick's `@af-examples/base-2d`) | `index.ts` is the package root; `sim.ts` re-exports the sim role files and holds no definitions |
| Anything else a game needs (Emberwick's demo kit) | A named folder for it | Not flat in `src/` |

### 4.5 The sim set

The sim set is what `pnpm boundaries` checks in a game laid out by role: **`constants`, `components`, `commands`,
`events`, `resources`, `systems` and `state`, each as `<role>.ts` or `<role>/`, plus `sim.ts` when it exists.**
Every non-test source file in them follows the sim rules (no DOM, no timers, no `Math.random`, the import allowlist).
A value import from a sim file must resolve to another sim file; type-only imports are free, as today. So
`state.ts` may `import type { Room } from './content/room.ts'` but not import a value from it, and nothing in the sim
can import `views.ts`, `main.ts`, `screens/` or `art/`. The set is closed on purpose: a sim helper lives in the role
file that uses it (Emberwick's room geometry goes into `systems.ts`, §6.3), so the boundary is visible from the file
names alone. The sim files import from `@mcthaydt/automata-sim` (and `/math`, `/hash`), not from the umbrella, which
the checker does not allow.

### 4.6 `main.ts`: define and start

`main.ts` imports `no-eval` first (AGENTS.md), defines the game and starts it:

```ts
import '@mcthaydt/automata/no-eval'
import { defineGame, keys, startGame } from '@mcthaydt/automata'
import { Move } from './commands.ts'
import { WORLD } from './constants.ts'
import { plugin, setup } from './state.ts'
import { views } from './views.ts'

export const game = defineGame({
  id: 'my-game',
  size: WORLD,
  sim: { plugins: [plugin], seed: 1, setup },
  input: keys(Move, { ArrowLeft: { x: -1 }, ArrowRight: { x: 1 }, ArrowUp: { y: -1 }, ArrowDown: { y: 1 } }),
  views,
})

// EsperRedux's main.py ends with `if __name__ == "__main__": main()`. The page (index.html) runs this file and the
// game starts; a test imports `game` without starting it, because Vitest runs with mode 'test'.
if (import.meta.env.MODE !== 'test') startGame(game)
```

- **Why the guard (GL-D4).** Tests need the definition itself: `game.test.ts` builds its headless sim from `game.sim`
  so it runs exactly the sim the page runs (the DX.3 lesson), and Emberwick's DOM screen test boots `emberwick` under
  the fake host. `startGame` throws `BootDefect` without a `#game` root (`start-game.ts`), so an unguarded call would
  fail every test that imports `main.ts`. Measured with Vitest 5.0.3: `import.meta.env.MODE` is `'test'` in the node,
  jsdom and browser projects (Chromium, WebKit, Firefox); a Vite build sets `'production'`, `vite dev`
  `'development'`. The game's `tsconfig.json` needs `"types": ["vite/client"]` (Emberwick has it).
- **A test that imports `main.ts` also runs its side-effect imports.** Measured on `30e9606c` with a scratch test
  (deleted): `@mcthaydt/automata-game/no-eval` and Emberwick's two font CSS imports, followed by `./game.ts`, load
  and pass in Emberwick's node and jsdom projects.
- **Only the page and tests import `main.ts`.** Imported anywhere else under Vite, it starts the game. A library
  entry never points at it (Emberwick's `./game` entry is retired for this reason, §6.3).
- `index.html` loads `./src/main.ts`; there is no second entry file at the game root.

### 4.7 `game.test.ts`

The counterpart of EsperRedux's `tests.py`, through the sim instead of a store:
1. Build the headless sim from `game.sim` (`createSim({ plugins, seed, content })`, then `setup`).
2. Send commands (`{ tick, source, seq, type, payload }`), `step`, and assert components, resources and events,
   EsperRedux style: start position, bounds, diagonal movement, the collection radius.
3. The golden replay: a scripted run whose final `hash()` equals a recorded value, in Node here and in Chromium, WebKit
   and Firefox in `game.parity.test.ts` (the `browsers` Vitest project includes `*.parity.test.ts`). Through
   `@mcthaydt/automata-testing/sim` for a new game; Emberwick keeps its own replay harness (§6.3).

## 5. Contracts (the rule changes)

### 5.1 `check-style` in a game root (GL.1)

**CLI.** `node tooling/check-style/src/cli.ts <package-src>... [--game <game-src>...]`: every root after `--game` is a
game root. The root `style` script becomes `check-style packages/*/src --game games/*/src`. Package roots keep
today's rules unchanged.

**In a game root, a path's role comes from its name** (all paths relative to the game's `src/`):

| Path | Role | May export `define*` results of | Must export at least one |
|---|---|---|---|
| `components.ts` | component | `defineComponent` | yes |
| `commands.ts` | command | `defineCommand` | yes |
| `events.ts` | event | `defineEvent` | yes |
| `systems.ts` | system | `defineSystem` | yes |
| `resources.ts` | resource | `defineResource` | yes |
| `state.ts` | state | `definePlugin` | yes |
| `constants.ts`, `views.ts`, `main.ts` | none | none of `DEFINE_ROLE`'s factories (`defineGame` is not one) | — |
| any file under `components/`, `commands/`, `events/`, `systems/`, `resources/` or `state/` | the folder's | the folder's factories, as above | no (a helper file is allowed) |
| any file under `constants/` or `views/` | none | none | — |
| any other file | its suffix, as today | today's rule | today's rule |

- **`role-mismatch`** when a role path exports another factory's result: "components.ts may only export
  defineComponent results"; "a file in systems/ may only export defineSystem results"; "state.ts may only export
  definePlugin results" (a resource belongs in `resources.ts`, which systems may import without a cycle).
- **`role-missing`** when a flat role file exports none: "systems.ts must export at least one defineSystem result".
- **`role-split`** (new rule) when `<role>.ts` and `<role>/` both exist: "systems.ts and systems/ both exist; move
  systems.ts into systems/". Checked once per game root, on the file.
- **`file-name`** when a suffix inside a role folder names another role: "a *.component.ts file does not belong in
  systems/".
- **`role-suffix`** in a game root, for a file with no role path and no suffix that exports a `define*` result, names
  both forms: "exports a defineSystem result, so it belongs in systems.ts (or systems/), or a file named
  *.system.ts".
- Unchanged everywhere: kebab-case names, `index.ts` exempt from the naming rules, tests and `testing/` exempt, the
  600-line `file-length` ceiling, the Svelte rules. Today's suffix files (`player.component.ts`) still pass in a game,
  so a game moves when it is ready.
- Implementation shape: `checkFile(file, code, { gameRoot?: string })`, plus a `checkGameRoot(dir)` for
  `role-split`; `ROLES` and `DEFINE_ROLE` stay the single list of roles and factories, and the game-root table is
  derived from them for the five sim roles (`component`, `command`, `event`, `resource`, `system`: file name = role
  + `s`), with `state` added. The other roles (`plugin`, `manager`, `schema`, `migration`, `content`, `generator`,
  `extension`) have no plural file; in a game they keep their suffix (`content/rooms.content.ts`).

### 5.2 `check-boundaries --game` (GL.1b)

- **CLI.** `automata-check-boundaries [--inline] [--allow-import <spec>]... <root>... [--game <src>...]`: every root
  after `--game` is a game's `src/`, and the checker checks its sim set (§4.5). Folder and file roots before it
  behave as today, so a game with `src/sim/` keeps working.
- **Relative imports.** In a game root, a value import from a sim file that resolves outside the sim set is an
  `import` finding: "the sim imports ./views.ts, which is outside the sim (constants, components, commands, events,
  resources, systems, state, sim.ts)". Type-only imports stay exempt.
- **An empty sim set is an error, not a pass:** a game root with none of the sim files exits 2, "no sim files in
  games/x/src (constants.ts, components.ts …)".
- **Published package:** `@mcthaydt/automata-check-boundaries` gets a patch changeset, and `CheckOptions` gains
  `simSet?: ReadonlySet<string>` (the resolved paths), so `pnpm api-report --update` runs in GL.1b.

### 5.3 `automata check` and the plugin hook (GL.1b)

- **`boundaries` step** (`packages/cli/src/check/check-steps.ts`): runs `automata-check-boundaries src/sim` when
  `src/sim/` exists (today), `--game src` when any sim role file or folder exists in `src/`, both when both exist,
  and a tool error naming both layouts when neither does. `--sim-only` keeps its steps; only the location changes.
- **The plugin hook** (`agents/automata/scripts/check.mjs`, `isSimFile`): an edit under `src/sim/`, to
  `src/sim.ts`, or to `src/<role>.ts` or anything under `src/<role>/` for the seven sim roles (constants, components,
  commands, events, resources, systems, state) runs `automata check
  --sim-only --json`. An edit to `views.ts`, `main.ts`, `screens/` or `content/` does not (the `Stop` hook still runs
  the full check).
- **`game-ci.yml`:** unchanged. Its `sim-roots` input is split on whitespace and passed straight to the checker, so a
  game repository passes `sim-roots: --game src`. Updating the input's description is a follow-up (§15).

### 5.4 One-file examples: section headings and the catalog check (GL.5)

- An example stays one file, raylib style. After its header, its code falls into sections in the role order of a
  game: **`constants`, `components`, `commands`, `events`, `resources`, `systems`, `state`, `views`, `game`**. A section exists only
  when the example has something for it; `game` always does.
- **Heading:** a line that is exactly `// --- <section> ---`.
- **What goes where:** `constants` (tuning numbers used by the sim and the views); `components`, `commands` (with
  any Zod helper the command uses, such as `step`), `events`, `resources` (`defineResource`), `systems`; `state`
  (`definePlugin`, `setup` when it is more than a line, a save definition); `views` (entity views, view helpers, asset URLs, post
  filters, `draw`, sounds, presentation-only `let`s); `game` (`export default defineGame`, with input bindings).
- **Graduating** an example to a game means splitting at the headings: each section becomes the role file of the
  same name (`game` becomes `main.ts`, and `export default` becomes `export const game` plus the guarded
  `startGame`, §4.6), with `export` added to each definition and imports per file. The sim sections' imports change
  from `@mcthaydt/automata` to `@mcthaydt/automata-sim`, because the checker allows only the sim's own entries
  (follow-up in §15).
- **The catalog enforces the order, lightly (GL-D7).** `readCatalog` adds problems for:
  - a heading whose name is not one of the nine: `section "stuff" is not one of constants, components, …, game`;
  - a heading out of order or repeated: `section "systems" comes after "views"; the order is constants, components,
    commands, events, resources, systems, state, views, game`;
  - a top-level `define*` call outside its section, from the AST the catalog already parses: `defineSystem "move"
    (line 17) is under "components"; it belongs under "systems"` (`defineComponent` → components, `defineCommand` →
    commands, `defineEvent` → events, `defineResource` → resources, `defineSystem` → systems, `definePlugin` → state,
    `defineGame` → game). A call above the first heading counts as outside.
  - It does not check helpers, comments or literals, and headings cost nothing against the 100-line budget (comment
    lines are not counted).
- **Inline boundaries** (`check-boundaries --inline`, EX §4) are unchanged: they check the arguments of
  `defineSystem` and `definePlugin` wherever those calls sit.

### 5.5 `AGENTS.md` (proposed text; the integration owner edits it)

In the **Naming** bullet, replace "Folders group by feature." with:

> Folders group by feature, except a game's `src/` (`games/*` and what `create-game` generates), which groups by role
> like EsperRedux: `constants.ts`, `components.ts`, `commands.ts`, `events.ts`, `resources.ts`, `systems.ts`, `state.ts`, `views.ts`,
> `main.ts` and `game.test.ts`, each becoming a folder of the same name once it passes 300 lines (the game layout
> spec, `docs/superpowers/specs/2026-10-30-game-layout-by-role-design.md`). One-file examples keep the same order in
> `// --- <role> ---` sections.

In the **`pnpm style`** bullet, after "(`*.component.ts` exports `defineComponent` results, and so on)", add:

> ; in a game's `src/`, the role files and folders count too (`components.ts` and `components/` hold
> `defineComponent` results, `resources.ts` holds resources, `state.ts` the plugin), and a role is a file or a folder, never both

And in the **`pnpm boundaries`** bullet, after "(packages/sim)", add: "and each game's sim files (`--game`: the role
files from `constants.ts` to `state.ts`, `resources.ts` included)".

## 6. Per project

### 6.1 The `create-game` template (GL.2, inside DX.5)

DX.5 (§3.5) rewrites the template; GL.2 sets its layout. The generated game:

```text
<game>/
  index.html          loads ./src/main.ts
  package.json        dev, build, test, check (automata check), prepare-ruken; ranges at the CLI's version
  ship.config.ts, vite.config.ts (assetsInlineLimit: 0, DX.5a), tsconfig.json ("types": ["vite/client"]), style.css
  AGENTS.md, CLAUDE.md (@AGENTS.md), .claude/skills/, .agents/skills/
  src/
    constants.ts      SPEED, SIZE, WORLD, START (a moving body's tuning)
    components.ts     Body { x, y }
    commands.ts       Move { x, y in -1..1 }
    systems.ts        move: applies Move at SPEED and keeps the body inside WORLD
    state.ts          plugin (definePlugin over every definition) and setup (spawns the body at START)
    views.ts          views: { [Body.id]: rect(...) }
    main.ts           defineGame and the guarded startGame (§4.6)
    game.test.ts      a move moves the body; the body stays inside WORLD; the golden replay
    game.parity.test.ts  the golden in Chromium, WebKit and Firefox
```

No `events.ts` or `resources.ts` until the game defines an event or a resource; when it does, `resources.ts` sits
before `systems.ts` in the generated `AGENTS.md`'s table, as in §4.1. The generated `AGENTS.md` names the layout in one table (§4.1) and
the threshold (§4.3). The DX spec's `src/sim/` and `src/sim/game.golden.test.ts` become these files.

### 6.2 The placeholder (GL.3)

The placeholder has no sim, so it has no sim role files. The restructure is the page entry:

| Today | After | Note |
|---|---|---|
| `main.ts` | `src/main.ts` | Imports `./boot.ts` instead of `./src/boot.ts`; content otherwise unchanged |
| `index.html` | same | `<script type="module" src="./src/main.ts">` |
| `tsconfig.json` | same | `include: ["src/**/*.ts"]` (drops `"main.ts"`) |
| `src/boot.ts`, `src/boot.test.ts`, `src/ship-config.test.ts` | unchanged | The boot is the placeholder's whole program; tests never import `main.ts` |
| `s8/*`, `e2e/*`, `ship.config.ts`, `vite.config.ts`, `tsconfig.node.json`, `style.css`, `package.json` | unchanged | `s8/no-effect.ts`'s comment "as main.ts" stays true |

### 6.3 Emberwick (GL.4)

**The target `src/`:**

```text
src/
  constants.ts components.ts commands.ts events.ts resources.ts systems.ts state.ts sim.ts   the sim set
  main.ts                                                                         defineGame + startGame
  game.test.ts game.parity.test.ts exports.test.ts plumbing.test.ts ship-config.test.ts
  index.ts assets.d.ts
  views/      the drawing (was render/; 989 lines, so a folder)
  screens/    the screens and flow.ts
  content/    the room
  art/        palette, sprites, PROVENANCE.md
  play/       the demo kit behind ./play and the root entry (playRoom, its loop, devices, boot page)
  testing/    the golden route and its replay harness
```

**DX.3a first.** The table maps the tree at `30e9606c`. DX.3a (02; prerequisites EX.4c and PRODUCT.5g) deletes the
demo support `plumbing.test.ts` reports, its exports in `src/index.ts`, and the `./play`, `./render` and `./room`
subpaths, and it runs before GL.4 (§8). The rows below for the files it deletes then drop out, as does the entry
mapping for those three subpaths; GL.4's plan re-derives the table from the tree at its base commit and records
what DX.3a left.

**Every `.ts` file today (69) and where it goes.** "Merged" means the file's text moves into the target verbatim,
below the target's merged imports; every `define*` call, id, field map, Zod schema and system object moves unchanged.

| Today | After | Note |
|---|---|---|
| `main.ts` (17) | `src/main.ts` | Merged with `src/game.ts`: the no-eval and font imports first |
| `ship.config.ts`, `vite.config.ts`, `vitest.config.ts` | unchanged | The Vitest projects match by suffix, so they find the moved tests |
| `e2e/base-2d.e2e.ts` | unchanged path | Imports `../src/play/base-sim.ts` and `../src/testing/golden.ts` |
| `e2e/host/host.ts` | unchanged path | Imports `../../src/play/boot.ts` |
| `e2e/origins.ts`, `e2e/host/env.d.ts`, `e2e/host/vite.config.ts` | unchanged | |
| `src/sim/tuning.ts` (34) | `src/constants.ts` | |
| `src/sim/player.component.ts` (30) | `src/components.ts` | `Player`, `PlayerControl` |
| `src/sim/move.command.ts` (9) | `src/commands.ts` | `Move`, `MoveInput` |
| `src/sim/player.event.ts` (10) | `src/events.ts` | `Jumped`, `Landed`, `GoalReached` |
| `src/sim/tiles.ts` (62) | `src/systems.ts` | First: `RoomGrid`, `TilePosition`, `isSolid`, `hitboxTouches`, `hitsSolid`, `roomOf`, names and exports unchanged |
| `src/sim/player-input.system.ts` (19) | `src/systems.ts` | `playerInput` |
| `src/sim/player-move.system.ts` (133) | `src/systems.ts` | `playerMove`; `systems.ts` is 242 lines before its imports merge, under the threshold |
| `src/sim/goal.system.ts` (28) | `src/systems.ts` | `goal` |
| `src/sim/progress.resource.ts` (14) | `src/resources.ts` | `Progress`; `goal` reads it, so it sits above `systems.ts` (§4.1), not in `state.ts`, which imports `systems.ts` |
| `src/sim/base-2d.plugin.ts` (18) | `src/state.ts` | `base2dPlugin`, name `base-2d`, its arrays in today's order |
| `src/sim/place-wick.ts` (12) | `src/state.ts` | `placeWick`: `setup` for the game, the demos and the tests |
| `src/sim/index.ts` (8) | `src/sim.ts` | The `./sim` entry; `export * as tuning from './constants.ts'` keeps the `tuning` namespace |
| `src/sim/movement.test.ts` (266) | `src/game.test.ts` | Every test kept, names unchanged |
| `src/golden.test.ts` (25) | `src/game.test.ts` | Every test kept; `game.test.ts` is about 290 lines |
| `src/golden.parity.test.ts` (15) | `src/game.parity.test.ts` | `package.json`'s `test:evidence` names the new path |
| `src/golden.ts` (46) | `src/testing/golden.ts` | `GOLDEN_ROUTE`, `GOLDEN_GOAL_TICK`, `GOLDEN_HASH`: untouched; the only change is `import type { MoveInput } from './sim/index.ts'` becoming `'../sim.ts'` |
| `src/golden-run.ts` (68) | `src/testing/golden-run.ts` | Imports `emberwick` from `../main.ts` |
| `src/game.ts` (53) | `src/main.ts` | `emberwick`, `input`; then `if (import.meta.env.MODE !== 'test') startGame(emberwick)` |
| `src/game-entry.ts` (5) | removed | The `./game` entry is retired (below) |
| `src/index.ts` (18) | `src/index.ts` | Paths updated; the same names exported |
| `src/assets.d.ts` | unchanged | |
| `src/exports.test.ts` | unchanged path | Its `./game` case imports `./main.ts` (under Vitest, so nothing starts) and keeps its assertions |
| `src/plumbing.test.ts` | unchanged path | Walks from `src/main.ts`; classes: the sim set is `sim`, `src/views/` is `drawing` (except `scene-renderer.ts`); the limit stays 400 |
| `src/ship-config.test.ts` | unchanged path | Imports `input` from `./main.ts` and `GAME_ID` from `./play/boot.ts` |
| `src/flow.ts` (39), `src/flow.test.ts` | `src/screens/flow.ts`, `src/screens/flow.test.ts` | Beside the screens, as in base-3d |
| `src/screens/emberwick-screens.ts`, `screens.dom.test.ts` | unchanged | Import `../constants.ts`, `../main.ts`, `../testing/golden.ts` |
| `src/content/room.ts`, `room.test.ts` | unchanged | Imports the room types and `isSolid` from `../systems.ts` |
| `src/art/palette.ts`, `sprites.ts`, `art.test.ts` | unchanged | |
| `src/render/index.ts` | `src/views/index.ts` | The `./render` entry |
| `src/render/backdrop.ts`, `light-levels.ts`, `particles.ts`, `pixels.ts`, `renderer.ts`, `scene.ts`, `scene-renderer.ts`, `tiles.ts` | `src/views/` (same names) | `scene.ts` imports `../constants.ts` |
| `src/render/light-levels.test.ts`, `tiles.test.ts`, `renderer.browser.test.ts` | `src/views/` (same names) | `renderer.browser.test.ts` imports `../play/no-eval.ts` |
| `src/base-sim.ts` (45) | `src/play/base-sim.ts` | `createBaseSim`, `moveCommand`, `readPlayer` |
| `src/play-room.ts` (211), `play-room.test.ts` | `src/play/play-room.ts`, `src/play/play-room.test.ts` | The `./play` entry |
| `src/loop.ts` (62), `loop.test.ts` | `src/play/` | |
| `src/boot.ts` (50), `boot.test.ts` | `src/play/` | `GAME_ID`, `connect`, `BaseBootFailed` |
| `src/boot-failure.ts` (26), `boot-failure.test.ts` | `src/play/` | |
| `src/boot-page.ts` (34), `boot-page.test.ts` | `src/play/` | |
| `src/input/keys.ts` (37), `keys.test.ts` | `src/play/keys.ts`, `src/play/keys.test.ts` | playRoom's input; the game's bindings are the `keys()` map in `main.ts` |
| `src/input/devices.ts` (91) | `src/play/devices.ts` | |
| `src/no-eval.ts` (15) | `src/play/no-eval.ts` | The `./no-eval` entry, for demos (the game imports `@mcthaydt/automata-game/no-eval`) |

**Package entries** (`@af-examples/base-2d`, private): `.` → `./src/index.ts` (unchanged); `./render` →
`./src/views/index.ts`; `./play` → `./src/play/play-room.ts`; `./no-eval` → `./src/play/no-eval.ts`; `./room`
unchanged; `./sim` → `./src/sim.ts`; `./style.css` unchanged; **`./game` retired** (GL-D6): at `30e9606c` its only
importer is Emberwick's own `exports.test.ts`, and an entry that points at `main.ts` would start the game in any
non-test consumer. At `30e9606c` the only other in-repo consumer of these entries after PRODUCT.5g is
`examples/content/hot-reload` (`./play`, `./room`, `./no-eval`, `./style.css`); EX.4c deletes it before DX.3a, and
DX.3a removes `./play`, `./render` and `./room`, so by GL.4 the mappings for those three are moot. If a consumer is
still on `main` when GL.4 starts, its import lines do not change.

**References outside the game that change in GL.4:** root `package.json` `boundaries` (`games/emberwick/src/sim` →
`--game games/emberwick/src`); Emberwick's `check` script (`automata-check-boundaries --game src`) and `test:evidence`
path; `index.html` (`./src/main.ts`); `tsconfig.json` (`include: ["src/**/*.ts"]`); `ci.yml`'s `base-2d` job
(`sim-roots: --game src`) with `workflows.test.ts` line 480; `tooling/agent-skills/src/install.test.ts` (it checks an
edit to `src/systems.ts` is clean, then appends the Effect import to `src/resources.ts` and restores the file in its
`finally`; every sim role file exists in Emberwick after the move, so there is no free sim path for a new file, and
a new role folder beside its file would be a `role-split`).
Historical plans and specs keep their old paths.

### 6.4 base-3d (GL.7)

`games/base-3d` starts in this layout; it has no code yet. GAME-3D.0's design doc (PR #229 at `4734d6f9`, §3.1)
already adopts it, with one difference to reconcile: it lists `systems.ts` ("the system order") beside `systems/`.
Under §4.3 a role is one or the other, and AF's system order comes from phases and `before`/`after`, not from a file,
so base-3d's systems live in `systems/` (with `systems/index.ts`) from GAME-3D.1b, when the first large system lands;
before that, `systems.ts`. Its `state/` folder (the save definition and its fixtures), `content/*.content.ts`,
`screens/` with `flow.ts`, and its sim boundary (§3.1's last bullet) match this spec. Its "Naming until GL.1" bullet
stays true: until GL.1 lands, files in role folders keep suffix names.

### 6.5 The one-file examples (GL.5)

Every one-file example in the catalog when GL.5 runs gets headings (17 at `30e9606c`; EX.4's remaining rows add
more, so GL.5's plan counts them from `readCatalog` at its base commit and records the number); no definition, id
or schema changes, so `examples/__goldens__/*.replay` stay byte-identical.
Today's shape already follows the order except for placement of helpers, so most examples gain three to five heading
lines. Examples with more: `core-camera-2d` (`VIEW`, `WORLD`, `HALF` → constants; the camera tracking → views),
`core-saves` (`Progress`, `START`, `saves` → state), `render-filter` and `render-quality` (`postFilter`s, `stage` →
views; `TIER_KEYS` → game), `audio-sound`, `textures-sprite`, `textures-atlas` (asset URLs → views).

## 7. Why the move keeps the golden hash, and what would change it

Emberwick's golden route must still end on **`31f50888ccb4cf0a`** at goal tick 342, in Node, Chromium, WebKit and
Firefox. The hash is `sim.hash()`, an XXH64 of the snapshot bytes (`sim.ts` line 563), and the snapshot header carries
the **schema hash** (`snapshot.ts` line 2). `createSim` computes the schema hash (`sim.ts` line 269) from canonical
JSON of:

- the plugin names, in dependency order with ties broken by name (`orderPlugins`);
- the components sorted by id, each with its fields and `render` flag (field names are sorted at definition,
  `definitions.ts` line 49);
- the commands, events and resources as `[id, JSON Schema of the Zod schema]`, sorted by id (`describeSchemas`);
- the systems as `phase:name` in run order: phase, then `before`/`after`, ties by name (`orderSystems`,
  `stableTopo`);
- each stateful plugin's name and each plugin's config, when present.

The snapshot body is canonical too: components sorted by id (`encodeSnapshot`), resources sorted, entities by
StableId, and one RNG substream per system seeded from its name (`sim.ts` line 259).

**So the order in which definitions are registered does not move the hash, but the text inside each definition
does.** Measured with a scratch test on `30e9606c` (run, then deleted):

| Variant | `hash()` after the golden route | Schema hash |
|---|---|---|
| Today's `base2dPlugin` | `31f50888ccb4cf0a` | `a032b5126eeba0a8` |
| Same definitions, `components`, `events` and `systems` arrays reversed | `31f50888ccb4cf0a` | `a032b5126eeba0a8` |
| `Move`'s Zod object with its keys swapped (`{ jump, x }` instead of `{ x, jump }`), everything else the same | not run (`playerInput` reads the original `Move`) | `3b0bb21c08e833d0` |

Order matters inside a schema because JSON Schema lists `required` in declaration order and canonical JSON keeps array
order (and by the same rule, a union's member order). A system's name also seeds its RNG and breaks ordering ties, so
renaming one changes the hash even when it draws nothing.

**The rules for GL.4 (and GL.5), therefore:**
- Each `define*` call moves verbatim: ids, field maps, Zod schemas (key order and union order included), system
  names, phases, `before`/`after` and `run` bodies.
- The plugin keeps its name (`base-2d`) and its arrays in today's order. The measurement shows the order is not
  hashed; keeping it costs nothing and keeps the diff a pure move.
- `Progress` moves to `resources.ts` (§6.3) with its `defineResource` call verbatim and stays in the plugin's
  `resources` array at its current place, so the definition order the plugin registers is today's and the golden
  stays `31f50888ccb4cf0a`. Only the file it lives in changes, which nothing hashes.
- `setup` spawns in the same order (StableIds), with the same seed (1) and the same room content.
- `GOLDEN_HASH`, `GOLDEN_GOAL_TICK` and `GOLDEN_ROUTE` are not edited, and no replay file is rewritten.

## 8. Migration order and when each step runs

| Step | Row | Runs when | Why then |
|---|---|---|---|
| 0 | GL.0 | Now | This spec; the Owner reviews it |
| 1 | GL.1, GL.1b | After GL.0's review | Tooling only. Both checkers accept both layouts, so no game breaks; GL.1 adds `games/*/src` to `pnpm style`, which today's games already pass (today's rules: 41 files, 0 findings; game mode differs only for role paths, which they do not have yet). Merge `main` for #219 (CI.PAR edits root `package.json`) |
| 2 | GL.3 | After GL.1, once #194 (DX.5a, which edits `games/placeholder`) merges | Small; proves the page-entry move on the simplest game |
| 3 | GL.4 | After GL.1 and GL.1b; after DX.3a; with the Owner's words for the `ci.yml` change, quoted in the PR; after #203 (CI.N2), #194 (DX.5a) and #197 (PRODUCT.5g) merge, and also #205 (M3.2: Emberwick's `package.json`), #219 (CI.PAR: `ci.yml` and `workflows.test.ts`) and #235 (DX.6c: the script-path check), or after they close; and after the CI backlog clears, so the PR is verified and merged the same day | A 69-file move conflicts with every open PR that touches `games/emberwick`; PRODUCT.5g removes `examples/physics/bodies-2d`, the other consumer of `./sim` and `./render`. DX.3a (02) deletes Emberwick's demo support (about 650 lines in 11 files, per `plumbing.test.ts`), its exports and the `./play`, `./render` and `./room` subpaths; run first, it leaves GL.4 fewer files to move and no demo-kit entries to keep. The `ci.yml` value waits on the Owner's words because merge authority over `.github/workflows` is open in 03 |
| 4 | GL.5 | After GL.0's review and after EX.4 and every EX.4 row in 02 (EX.4cu, EX.4c, EX.4s, EX.4u, EX.4p, EX.4f, EX.4h) close, when no open PR edits a one-file example | The Owner's order (2026-10-30): "the examples' section order after EX.4". EX.4's rows still add or change one-file examples, so heading them first would conflict and miss the new ones. Independent of the games |
| 5 | GL.7 | GAME-3D.0 now (PR #229's §3.1, reconciled with §6.4); code in GAME-3D.1a, after GL.1 and GL.1b | base-3d is born in the layout |
| 6 | GL.2, GL.6 | With DX.5 and DX.7b | DX.5 rewrites the template anyway; GL.4 has shown the layout on a real game first |

Inside GL.4, the move is one commit per role (constants, components, commands, events, systems, state, `sim.ts`,
`main.ts`, the tests, `views/`, `screens/flow.ts`, `play/`, `testing/`), each followed by the Node golden test, so a
failure names its role.

## 9. Failure and recovery

| Failure | What happens | Recovery |
|---|---|---|
| **The golden hash or goal tick changes** at any step of GL.4 or GL.5 | **The move stops.** Nothing is committed past the last green step; no constant, replay or baseline is edited | Find the definition whose text changed (the per-role commits name the role; then diff that role's `define*` calls against `30e9606c`: a reordered Zod key or union, a renamed id or system, a changed phase or field type, a different spawn order). Restore it and rerun. Never rebaseline, in one engine or all |
| A parity engine disagrees with Node | Stop, as above | The same investigation; a cross-engine mismatch is a bug, never "flaky" |
| `pnpm style` or `pnpm boundaries` reports a finding after a move | The PR is red | Put the definition in its role file, or move the helper into the role that uses it; never loosen a rule |
| The plumbing test passes 400 lines | Red | Check the classifier knows every sim file and `views/`; the limit is not raised |
| `main.ts` starts the game under Vitest (a `BootDefect` in a test that imports it) | Red | Fix the guard; never skip the test |
| An open PR on `games/emberwick` merges mid-move | The PR conflicts | Merge `main`, reapply that PR's change at the moved path, rerun the Node golden and the focused specs |
| An e2e journey fails after the move | Red | Rerun focused under load as CI.N2 does; keep the first attempt's evidence; a real failure is a broken import or entry, fixed in the move |
| A screenshot or visual baseline would change | Stop | The move draws nothing new; an image change is a bug in the move |
| The Owner vetoes a rule detail (§13) after GL.1 merges | — | Each row is one PR; reverting GL.4 alone is safe because the checkers accept both layouts |

## 10. UI, responsive behavior and Ruken alignment

No screen, state, focus path, layout or input changes: the screens, the renderer and the host journeys run the same
code from new paths, which the focused e2e specs prove. Nothing touches Ruken's contracts: `ship.config.ts`, the SDK
handshake, `automata-ship prepare` and `ruken publish` read the same files and the same `dist/`. EsperRedux has no
host, so there is nothing to align there.

## 11. Test allocation and feedback

| Layer | Row | What |
|---|---|---|
| Unit | GL.1 | `style.test.ts`: the cases in §12 (A1 to A11), red first |
| Unit | GL.1b | `check.test.ts` and `cli.test.ts` for `--game`; `run-check.test.ts` for the step; `hook.test.ts` for the hook: the cases in §12 (B1 to B7), red first |
| Unit | GL.2 | `create-game.test.ts` and its integration test: the generated tree and `automata check` on it (C1 to C3), red first |
| Node golden | GL.4 | `game.test.ts` after each per-role commit (`pnpm --filter @af-examples/base-2d test:unit`) |
| Parity | GL.4, GL.5 | `pnpm --filter @af-examples/base-2d test:parity` (Chromium, WebKit, Firefox); the examples' parity |
| DOM | GL.4 | `screens.dom.test.ts` |
| Catalog | GL.5 | `catalog.test.ts`: the real examples and new bad fixtures; the G2 fixtures red first, before `readCatalog` checks headings |
| e2e (focused) | GL.3, GL.4 | `games/placeholder/e2e/boot.e2e.ts`; `games/emberwick/e2e/base-2d.e2e.ts` (`base-2d`, `base-2d-compact`); the e2e spec of any remaining consumer of Emberwick's entries (none expected after DX.3a) |
| Full gates | every code row | `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm build:examples`, `pnpm build:demos`; GL.1b also `pnpm build`, `pnpm api-report --update`, the changeset checks |
| GPU, visual, frame budget | none | Nothing drawn changes; not selected |

Every code row starts failing-test-first (AGENTS.md's strict TDD): GL.1 with A1 to A11, GL.1b with B1 to B7, GL.2
with C1 to C3 and GL.5 with G2, each run red and its failure reason confirmed before the change. GL.3 and GL.4 are
moves with no new behavior, so their guards are the existing tests staying green (D1, E1 to E7) and E4's
`Math.random()` shown red.

## 12. Acceptance cases

**Style (GL.1).** In a game root:
- A1. `components.ts` exporting a `defineSystem` result fails `role-mismatch` ("components.ts may only export
  defineComponent results"); `systems.ts` exporting `defineSystem` results and helpers passes.
- A2. `systems.ts` exporting no `defineSystem` result fails `role-missing`.
- A3. `state.ts` exporting a `definePlugin` result passes; adding a `defineSystem` or a `defineResource` result
  fails `role-mismatch`; `resources.ts` exporting `defineResource` results passes.
- A4. `systems/player-move.ts` exporting a `defineSystem` result passes; `systems/tiles.ts` with helpers only passes;
  `systems/player.ts` exporting a `defineComponent` result fails `role-mismatch`; `systems/jump.component.ts` fails
  `file-name`.
- A5. `systems.ts` and `systems/` together fail `role-split`.
- A6. `constants.ts` exporting a `defineComponent` result fails `role-suffix`, naming `components.ts`.
- A7. `main.ts` exporting a `defineGame` result passes.
- A8. `player.component.ts` (today's form) still passes.
- A9. In a package root, `components.ts` exporting a `defineComponent` result still fails `role-suffix`, and
  `packages/editor-kit/src/commands/*.ts` and `packages/render-pixi/src/views/*.ts` are unaffected.
- A10. `pnpm style` checks `games/*/src` and passes on today's games, then on the moved ones.
- A11. A 601-line role file fails `file-length`.

**Boundaries and check (GL.1b).**
- B1. `--game src` with `Math.random()` in `systems.ts` fails `banned-member`.
- B2. `systems.ts` importing a value from `./views.ts` fails `import`, naming the sim set; importing `./components.ts`
  passes.
- B3. `state.ts` with `import type { Room } from './content/room.ts'` passes; a value import from it fails.
- B4. `views.ts` using `document` is not checked and reports nothing.
- B5. A game root with no sim files exits 2.
- B6. `automata check` runs `src/sim` in a game that has it, `--game src` in a role-layout game, and reports a tool
  error naming both layouts in a game with neither.
- B7. The hook runs `automata check --sim-only` for an edit to `src/systems.ts`, `src/systems/x.ts`,
  `src/resources.ts`, `src/state.ts` or `src/sim.ts`, and not for `src/views.ts` or `src/main.ts`.

**Template (GL.2).**
- C1. `create-game` writes the §6.1 tree; the output passes `automata check` (boundaries through `--game`,
  typecheck, test) and `pnpm style`'s game mode, and `automata check --csp` in a clean container (DX.5's exit).
- C2. Importing the generated `main.ts` under Vitest starts nothing; the built page starts and reports ready.
- C3. Removing the `move` system from `state.ts`'s plugin turns `game.test.ts` red (the test is real).

**Placeholder (GL.3).**
- D1. Build, `prepare-ruken`, `boot.e2e.ts` and `budget:size` pass after `main.ts` moves into `src/`.

**Emberwick (GL.4).**
- E1. The golden route ends on `31f50888ccb4cf0a` at tick 342 in Node, Chromium, WebKit and Firefox.
  `GOLDEN_ROUTE`, `GOLDEN_GOAL_TICK` and `GOLDEN_HASH` in `testing/golden.ts` are unchanged from `src/golden.ts` at
  `30e9606c`, and `git diff` between the two files shows one changed line, the import path (`./sim/index.ts` →
  `../sim.ts`).
- E2. The number of tests and their names are the same before and after (the Vitest JSON reports of `test:unit` and
  `test:parity`, compared).
- E3. The plumbing test, walking from `src/main.ts`, stays at or under 400; each class's total before and after is in
  the plan's log (today: sim 377, art 393, content 96, drawing 860, plumbing 383).
- E4. `pnpm boundaries` checks Emberwick through `--game` with no finding; a `Math.random()` put into `systems.ts`
  fails it (shown red, then removed).
- E5. `exports.test.ts` passes on the entries left after DX.3a; any in-repo consumer of them still on `main` builds
  and its e2e spec passes.
- E6. `base-2d.e2e.ts` passes in `base-2d` and `base-2d-compact`; `screens.dom.test.ts` passes.
- E7. `src/` matches §6.3's tree; no file is left in `src/sim/`, `src/render/` or `src/input/`.

**Examples (GL.5).**
- G1. Every one-file example in the catalog when GL.5 runs (counted from `readCatalog` and recorded in the plan's
  log) passes with headings in order.
- G2. A fixture with `// --- views ---` before `// --- systems ---` fails with the order problem; a fixture with a
  `defineSystem` under `// --- components ---` fails with the placement problem; `// --- stuff ---` fails with the
  name problem; each fails for that reason only.
- G3. `examples/__goldens__/*.replay` are unchanged and the examples' parity passes.

**Skills (GL.6).**
- H1. The `automata` skill's layer table names the role files; `automata-feature`'s double-jump example is laid out
  by role with its golden; `automata-verify` names `--game src`; `tooling/agent-skills` stays green.

**base-3d (GL.7).**
- I1. The design doc's §3.1 matches §6.4; GAME-3D.1a's first commit has the role files, passes `pnpm style`'s game
  mode and `pnpm boundaries --game`.

## 13. Decisions for the Owner's veto

The direction and the take/leave split are the Owner's (2026-10-30). These details are the agent's defaults:

- **GL-D1 Scope of the plural rule.** Plural role files and role folders count only in a game's `src/` (roots after
  `--game`); packages keep suffix files and feature folders. Alternative: everywhere (it would reclassify
  `packages/editor-kit/src/commands/`, `packages/render-pixi/src/views/` and `packages/testing/src/sim/commands.ts`).
- **GL-D2 The file-to-factory table** (§5.1): `resources.ts` takes every resource and sits before `systems.ts`,
  because systems read resources (a resource in `state.ts`, which imports the systems for the plugin, would be an
  import cycle); `state.ts` takes the plugin and `setup`; `constants.ts`, `views.ts` and `main.ts` take no `define*`
  result; suffix files stay valid in games.
- **GL-D3 Threshold.** 300 lines, a review rule (not a check); 600 stays enforced; a role is a file or a folder,
  enforced (`role-split`). Alternative: a `--game` finding at 300.
- **GL-D4 `main.ts` defines and starts, guarded by `import.meta.env.MODE !== 'test'`** (§4.6). Alternative: a
  separate `game.ts` holding `defineGame`, with `main.ts` only calling `startGame`.
- **GL-D5 A closed sim set and `--game` in `check-boundaries`** (§4.5, §5.2), with `sim.ts` as the sim entry of a game
  that is also a library. Alternative: keep a `src/sim/` folder (not EsperRedux's shape), or follow imports
  transitively.
- **GL-D6 Emberwick's placements:** `render/` → `views/`, the demo kit → `play/`, test support → `testing/`,
  `flow.ts` → `screens/`, `Progress` into `resources.ts`, the room geometry into `systems.ts`, the tests into `game.test.ts` and
  `game.parity.test.ts`; the `./game` entry retired, every other subpath kept.
- **GL-D7 Example headings** `// --- <role> ---`, in the order constants, components, commands, events, resources,
  systems, state, views, game, with the catalog checking names, order and `define*` placement (§5.4). Events sit before
  systems because systems use them.
- **GL-D8 Non-goal placements** (§4.4): `screens/`, `content/` and `art/` stay folders; input bindings in `main.ts`
  (`input.ts` only when they grow); a role file exists only when used, except `main.ts` and `game.test.ts`.
- **GL-D9 A row the brief did not list, GL.1b**, because the flat layout removes the `src/sim/` folder that
  `check-boundaries`, `automata check` and the plugin hook read; without it a moved game is unchecked.
- **GL-D10 The `AGENTS.md` wording** (§5.5).

## 14. Tasks

For the integration owner to add to 02 (a new GL section). Sizes: S up to a day, M two to three days, L a week.

| Row | Title | Lane | Size | Prerequisites |
|---|---|---|---|---|
| GL.0 | Game layout by role (EsperRedux-style), spec | docs | S | — (drafted 2026-10-30; the Owner approved the direction 2026-10-30) |
| GL.1 | `check-style` accepts role files and folders in a game's `src/` (§5.1); `pnpm style` checks `games/*/src` | ship | S | GL.0 reviewed |
| GL.1b | `check-boundaries --game` and the sim set (§4.5, §5.2); `automata check`'s `boundaries` step and the plugin hook find either layout (§5.3); patch changeset, api-report | ship (cli and hook with the integration owner's review) | M | GL.0 reviewed |
| GL.2 | `create-game` generates the role layout and `game.test.ts` (§6.1) | ship, inside DX.5 | S (DX.5 is L) | GL.1, GL.1b, DX.5's own (DX.2a, DX.5a, DX.7b, DX.11a) |
| GL.3 | Placeholder: the page entry moves to `src/main.ts` (§6.2) | game | S | GL.1; #194 merged |
| GL.4 | Emberwick laid out by role (§6.3), the golden hash unchanged (§7) | game (the `ci.yml` value with ship) | M | GL.1, GL.1b; DX.3a; the Owner's words for the `ci.yml` change, quoted in the PR; #203, #194, #197 merged (and #205, #219, #235 merged or closed); the CI backlog clear |
| GL.5 | One-file examples in role sections, and the catalog's order check (§5.4, §6.5); the examples counted when it runs | examples | S | GL.0 reviewed; EX.4 and every EX.4 row in 02 (EX.4cu, EX.4c, EX.4s, EX.4u, EX.4p, EX.4f, EX.4h) closed (the Owner's order, 2026-10-30: "the examples' section order after EX.4"); no open PR editing a one-file example |
| GL.6 | Agent skills describe the role layout; the double-jump example moves to it (§12 H1) | integration, with DX.7b | S | GL.1, GL.1b; lands with DX.7b and DX.5 |
| GL.7 | base-3d starts in the role layout (§6.4) | figures/3D, in GAME-3D.0 (doc) and GAME-3D.1a (code) | S (inside those rows) | GL.0 reviewed; GL.1 and GL.1b before GAME-3D.1a's first commit |

## 15. Follow-ups and requests to the integration owner

- Add the GL rows (§14) to 02, the `AGENTS.md` text (§5.5), and a one-line pointer to this spec in the DX spec §3.5 to
  §3.7, the EX spec §2 and the M1 base-2d spec.
- An umbrella sim entry (`@mcthaydt/automata/sim`, declared in the umbrella's `automata.simEntries`), so a graduated
  example's sim sections keep one import line (§5.4). For the umbrella's owner (PRODUCT); not part of GL.
- After PRODUCT.5g, Emberwick's root entry still exports demo-kit names that no in-repo consumer imports
  (`createBaseSim`, `bootPage`, the boot failures, `connect`, `createLoop`). Retiring them is a separate task, not
  part of the move.
- `game-ci.yml`'s `sim-roots` description could mention `--game src` (ship; a workflow edit, which waits on the open
  question in 03 about the merge authority over `.github/workflows`).
- GAME-3D.0's §3.1: replace "`systems.ts` the system order" with §6.4's reading, in PR #229 or right after it merges.
