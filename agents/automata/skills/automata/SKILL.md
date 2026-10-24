---
name: automata
description: Rules for writing an Automata Framework game (the seven laws, which layer owns what, where each kind of change goes, and the order to verify in). Use before changing code in a game built on the @mcthaydt/automata-* packages.
---

# Automata Framework: rules for game code

An Automata game is a deterministic simulation (the sim) with presentation around it. These rules are what keep its
replays, goldens and multiplayer exact. `automata check` enforces the ones a machine can check; follow the rest by
hand.

## The seven laws

1. **Only the sim changes gameplay state.** Rendering, UI, input and the host read it; they never write it.
2. **Only the authoritative side decides networked truth.** A client predicts; the authority's sim result wins.
3. **Each piece of state has exactly one owner.** Gameplay state lives in sim components and resources; screen
   state lives in the UI; nothing keeps a second copy that can drift.
4. **Presentation observes the sim and never controls it indirectly.** The only way in is a command.
5. **The sim has no external I/O and no wall clock.** No `Date`, timers, `fetch`, DOM, `console`, `Math.random` or
   Effect inside `src/sim/`. Time is the tick; randomness is the sim's seeded RNG.
6. **The same seed, content and ordered commands give the same result**, bit for bit, in Node, Chromium, WebKit and
   Firefox. That is what a golden test pins.
7. **The host is a port, and Ruken is the reference host.** Host access (saves, identity, pause, ready) goes through
   the `Hosting` service. A denied or missing capability fails visibly; never fall back to `localStorage`.

## Who owns what

| Layer | Lives in | Owns | Talks to the sim by |
|---|---|---|---|
| Sim | `src/sim/` (`*.component.ts`, `*.command.ts`, `*.system.ts`, `*.event.ts`, `*.resource.ts`, `*.plugin.ts`) | All gameplay state and rules | It is the sim |
| Input | `src/input/` | Which keys, buttons and touches mean which command | Sending one command per tick |
| Render | `src/render/` | Sprites, cameras, particles, interpolation | Reading each step's render delta and events |
| UI | `src/screens/` | Title, pause and result screens, focus, layout | Reading sim state; sending commands |
| Content | content files and `src/content/` | Levels, tuning, strings, compiled and hashed | Passed to `createSim` as content |
| Host | `Hosting` (`@mcthaydt/automata-host`) | Saves, identity, lifecycle | Never directly; the runtime wires it |

Inside the sim, use only `@mcthaydt/automata-sim` (and `/math`, `/hash`), `zod`, `koota` through the sim's API, and
relative imports. Use `Math` only for `sqrt`, `fround`, `round`, `floor`, `ceil`, `trunc`, `abs`, `min`, `max`,
`sign` and `imul`; `@mcthaydt/automata-sim/math` has the rest. Iterate objects with `sortedKeys`/`sortedEntries`,
never `Object.keys` or `for…in`. Prefer integers (subpixels, ticks) for anything that moves.

## Where a change goes

- **New gameplay** (a move, a rule, a score): a command if the player triggers it, components for its state, a system
  for the rule, a golden test. Follow the `automata-feature` skill.
- **How it looks**: `src/render/`, reading components and events. Never compute gameplay there.
- **A screen or menu**: `src/screens/` with the framework's UI primitives (44 px touch targets, 48 px primary
  actions, layout from the container size).
- **A level or tuning number**: content, not code, when the game has a content file for it.
- **Saving, publishing, the host**: `Hosting` and `ship.config.ts`; never browser storage directly.

Before calling any framework function, look it up in the `automata-api` skill: it lists every export of this version,
and an export that is not listed does not exist.

## Verify, in this order

1. The focused test for what you changed (`vitest run src/sim/<feature>.test.ts`).
2. `automata check --sim-only --json` after sim changes: boundaries, typecheck, tests.
3. `automata check --json` before you finish: the same plus a production build scanned for `eval`.
4. `automata check --csp --json` when the change touches boot, assets or third-party code.

The Automata plugin runs step 2 after every edit under `src/sim/` and step 3 when you try to finish. When either
reports findings, the `automata-verify` skill explains each rule and how to fix it. Never weaken a test or re-record
a golden hash to make a check pass: a changed hash means behavior changed, so find out why.
