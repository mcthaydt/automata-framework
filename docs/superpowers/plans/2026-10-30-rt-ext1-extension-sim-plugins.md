# RT.EXT1: extension sim plugins reach the sim (plan)

**Status:** implemented and locally checked 2026-10-30; size S; coordinator lane.

**Why:** `resolveExtensions(defs).simPlugins` is computed (M1 runtime spec §3.2: "in extension order; the game passes them to createSim"), but nothing passes them. `defineGame` copies only `spec.sim.plugins` into `game.sim.plugins`, which the default screens (`default-screens.ts`, `createSim`) and the golden replay read, so an extension's `sim` plugins never run. The 3D lane works around it by listing the extension's plugins in its example's and base-3d's own `sim.plugins`.

**Owner of the contract:** runtime (`ResolvedExtensions`, unchanged). The consumer that was missing is `packages/game`'s `defineGame` (private package: no changeset).

## Interfaces

- Consumed: `resolveExtensions(defs).simPlugins` from `@mcthaydt/automata-runtime/extension` (already imported by `packages/game`).
- Produced: `DefinedGame.sim.plugins` = the game's own `spec.sim.plugins`, then every extension's `sim` plugins in extension order. No new export, no API change.
- Behaviour: views, sounds and scores validation (`problemsOf`) reads the same combined list, so a game may draw an extension's component or play a sound on an extension's event. A plugin listed both by the game and by an extension is a duplicate and fails `createSim` (`duplicate plugin "…"`), the existing sim rule; games drop the workaround when this lands.

## Files

- Modify: `packages/game/src/define-game.ts` (combine the plugin lists once; use them in `problemsOf` and `sim`).
- Test: `packages/game/src/define-game.test.ts`.

## Steps

- [x] 1. Failing tests in `define-game.test.ts`: (a) `game.sim.plugins` is the game's plugins then an extension's `sim` plugins, in extension order (`resolveExtensions` order, not array order); (b) a view for a component only an extension's plugin draws is accepted, and a sound for an extension's event is accepted. Run `pnpm --filter @mcthaydt/automata-game exec vitest run src/define-game.test.ts`: (a) fails with `plugins: [square]`, (b) fails with `views.<id>: no plugin has a drawn component`.
- [x] 2. Minimal change in `define-game.ts`. The same command passes.
- [x] 3. Gates: `pnpm format`, `TURBO_FORCE=true pnpm check`. Parity omitted: no sim, renderer, ui or golden change (the sim already orders plugins; an extension-less game's list is unchanged).

## Execution log

- 2026-10-30, step 1: three tests added. Two failed as expected before the change: `game.sim.plugins` was `[square]` (expected `[square, echo, glow]`), and a view and sound for the extension's `glow`/`ping` threw a BootDefect. The third (an extension with no `sim`) passed before and after, as a guard.
- Step 2: `simPluginsOf` in `define-game.ts`; `problemsOf` and `sim.plugins` read it. `define-game.test.ts`: 32 of 32.
- Step 3: `pnpm format` (no further changes), `TURBO_FORCE=true pnpm check` exit 0 on Node 24.21.0. Parity omitted (no sim, renderer, ui or golden change). No changeset: `packages/game` is private.
