---
name: automata
description: Rules for writing an Automata Framework game (the seven laws, which layer owns what, where each kind of change goes, and the order to verify in). Use before changing code in a game built on the @automata/* packages.
---

# Automata Framework: rules for game code

An Automata game is a deterministic simulation (the sim) with presentation around it. These rules are what keep its
replays and golden tests exact. `automata check` enforces the ones a machine can check; follow the rest by
hand.

## The seven laws

1. **Only the sim changes gameplay state.** Rendering, UI, input and the host read it; they never write it.
2. **The sim's result is the outcome.** A replay, a test and a player all get what the sim decided; nothing outside it
   corrects or second-guesses it.
3. **Each piece of state has exactly one owner.** Gameplay state lives in sim components and resources; screen
   state lives in the UI; nothing keeps a second copy that can drift.
4. **Presentation observes the sim and never controls it indirectly.** The only way in is a command.
5. **The sim has no external I/O and no wall clock.** No `Date`, timers, `fetch`, DOM, `console`, `Math.random` or
   Effect in a sim file. Time is the tick; randomness is the sim's seeded RNG.
6. **The same seed, content and ordered commands give the same result**, bit for bit, in Node, Chromium, WebKit and
   Firefox. That is what a golden test pins.
7. **The host is a port, and no target is the reference.** The web, itch.io, Ruken and the desktop build are peers,
   chosen at build time. Host access (saves, identity, pause, ready) goes through the `Hosting` service. A denied or
   missing capability fails visibly; never fall back to `localStorage`.

## Where code lives

A game made with `automata create-game` keeps each thing in its game in one folder, and its tests beside `src/`:

| Folder | Holds |
|---|---|
| `src/features/<name>/` | One thing in the game: its sim files (`*.component.ts`, `*.command.ts`, `*.system.ts`, `*.event.ts`, `*.resource.ts`, `*.plugin.ts`) and its view (`*.view.ts`) side by side |
| `src/shared/` | What more than one feature uses (`constants.ts`) |
| `src/app/game.ts` | Where the game is put together: the plugins, the controls, the screen size |
| `src/main.ts` | Boots the game on the page |
| `content/` | Levels, tuning and strings; `content/levels/*.af2d.json` opens in the level editor |
| `tests/unit/<name>/` | Each feature's tests |

A sim file is a file with one of the sim suffixes, plus any file a sim file imports by a relative path (a helper a
system uses is sim code too). `automata check` refuses a game that keeps its sim in a folder of its own (`src/sim`).

| Layer | Owns | Talks to the sim by |
|---|---|---|
| Sim (the sim files) | All gameplay state and rules | It is the sim |
| Input (`keys()` in `src/app/game.ts`) | Which keys, buttons and touches mean which command | Sending one command per tick |
| View (`*.view.ts`) | Sprites, cameras, interpolation | Reading each step's render delta and events |
| Screens (the framework's default screens, or the game's) | Title, pause and result screens, focus, layout | Reading sim state; sending commands |
| Content (`content/`) | Levels, tuning, strings, compiled and hashed | Passed to the sim as content |
| Host (`Hosting`, from `@automata/framework`) | Saves, identity, lifecycle | Never directly; the runtime wires it |

A sim file may import only `koota`, `zod`, `@dimforge/rapier2d-deterministic-compat`, `@dimforge/rapier3d-deterministic-compat`, `@automata/sim` (and `/hash`, `/math`), the sim entries an installed extension declares in its `package.json` (`"automata": { "simEntries": […] }`), and relative files.
Use `Math` only for `sqrt`, `fround`, `round`, `floor`, `ceil`, `trunc`, `abs`, `min`, `max`,
`sign` and `imul`; `@automata/sim/math` has the rest. Iterate objects with `sortedKeys`/`sortedEntries`,
never `Object.keys` or `for…in`. Prefer integers (subpixels, ticks) for anything that moves.

## Where a change goes

- **New gameplay** (a move, a rule, a score): a new folder in `src/features/` (or the feature it belongs to): a command
  if the player triggers it, components for its state, a system for the rule, and a golden test in
  `tests/unit/<name>/`. Follow the `automata-feature` skill.
- **How it looks**: the feature's `*.view.ts`, reading components and events. Never compute gameplay there.
- **A screen or menu**: the framework's UI primitives (44 px touch targets, 48 px primary actions, layout from the
  container size).
- **A level or tuning number**: content, not code. Levels are edited in the level editor (`automata editor`; see the
  `automata-editor` skill).
- **Saving, publishing, the host**: `Hosting` and `ship.config.ts`; never browser storage directly.

Before calling any framework function, look it up in the `automata-api` skill: it lists every export of this version,
and an export that is not listed does not exist.

## Verify, in this order

1. The focused test for what you changed (`pnpm test tests/unit/<name>/`).
2. `automata check --sim-only --json` after sim changes: boundaries, typecheck, tests.
3. `automata check --json` before you finish: the same plus a production build scanned for `eval`.
4. `automata check --csp --json` when the change touches boot, assets or third-party code.

The Automata plugin runs step 2 after every edit to a sim file and step 3 when you try to finish. When either reports
findings, the `automata-verify` skill explains each rule and how to fix it. Never weaken a test or re-record a golden
hash to make a check pass: a changed hash means behavior changed, so find out why.
