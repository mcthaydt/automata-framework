# DX.2c: dispose the default screens' sim on runtime shutdown TDD plan

- **Spec:** [M1 runtime spec](../specs/2026-10-12-m1-runtime-design.md) §3.6 (`ScreenContext`, transition order) and §4 (Shutdown); [DX spec](../specs/2026-10-16-dx-small-games-ai-native-design.md) §3.3 and §7 (the default screens share one sim); M5 spec §5 "Restart and dispose" (closing the runtime scope must not lose progress).
- **Task:** `DX.2c — Follow-up (found in DX.2) — Dispose the default screens' sim on runtime shutdown` (02). Lanes runtime and game.
- **Status:** drafted, implemented and locally checked 2026-10-30; review and the Mac's CI pending.
- **Progress:** 5 of 5 steps.

## What is wrong

`packages/game/src/screens/default-screens.ts` disposes the shared sim only when the title is entered (`dropSim`). `RuntimeHandle.shutdown()` (`packages/runtime/src/boot/run-game.ts`) closes the runtime scope, and the flow's finalizer closes the current screen's scope with the same `Exit.void` a transition uses, so no screen can tell shutdown from a transition. A sim alive at shutdown (on play, paused or settings) is left to garbage collection without `Sim.dispose()`, which holds one of Koota's 16 worlds until then (the test file disposes its sims by hand to work around it).

## Decisions

- **A scope for what a game keeps across screens, not a shutdown flag.** Two smaller seams are wrong on order:
  - A flag on `ScreenContext` read in the play screen's finalizer would dispose the sim while the flow closes the screen, which is before the save's own finalizer flushes the kept progress (`saveService` adds `Effect.addFinalizer(() => flushPending)` to the runtime scope at boot, before the flow). `GameSaves.capture` would then read a disposed sim and the shutdown's progress would be lost. It would also need every screen that can be current with a live sim (play, paused and settings) to check the flag.
  - Handing screens the runtime scope itself has the same order problem: a finalizer added there after boot runs first (finalizers run last-in, first-out), before the screen closes and before the save's flush.
- **The seam:** `ScreenContext.runtime: Scope.Scope`, one scope for every screen of a run. It stays open across transitions and closes once, when the runtime scope closes (shutdown, or a failed boot that is retried). Boot forks it from the runtime scope just before it opens the save, so at shutdown it closes after the current screen's scope and the save's last flush, and before the renderer is destroyed and Hosting closes. `MakeFlowOptions.runtime` is how boot hands it to the flow; absent (the flow's own tests, `RuntimeTest`), the flow forks one before its own finalizer, so it still closes after the current screen.
- **The default screens tie the sim to it once per run.** Every default screen (title, play, paused, settings) first adds one finalizer, `dropSim`, to `context.runtime`, guarded so a run adds it only once (a retried boot or a second `runGame` brings a new scope). `dropSim` already clears `sim` after disposing it, so a sim the title dropped is not disposed again at shutdown, and a shutdown on the title disposes nothing.
- **Public API:** `ScreenContext` gains a required readonly field. The runtime builds every `ScreenContext`, so no consumer breaks; `runtime` and `game` are private packages, so no changeset. Recorded in the PR under "Decisions for the Owner's veto" (the field's name and the scope's place in the shutdown order).

## Interfaces

- **Produced (runtime):** `ScreenContext.runtime: Scope.Scope`; `MakeFlowOptions.runtime?: Scope.Scope` (internal, not exported from the package).
- **Consumed (game):** `ScreenContext.runtime` in `defaultScreens`; `Sim.dispose()` (sim, idempotent).
- **Unchanged:** `defaultScreens(game): ScreenDef[]`, `RuntimeHandle`, `GameDefinition`.

## Files

- **Modify:** `packages/runtime/src/flow/screen.ts`, `packages/runtime/src/flow/flow.manager.ts`, `packages/runtime/src/boot/boot-program.ts`, `packages/game/src/screens/default-screens.ts`; `tooling/api-report/reports/runtime.api.md` (by `pnpm api-report --update`); the runtime spec §3.6 and §4 (Shutdown); this plan.
- **Test:** `packages/runtime/src/flow/flow.test.ts`, `packages/runtime/src/boot/run-game.test.ts`, `packages/game/src/screens/default-screens.test.ts`, `packages/game/src/screens/saves-screens.test.ts`.

## Steps

- [x] **1. Runtime red.** `flow.test.ts`: "every screen gets one `runtime` scope: it stays open across transitions and closes once, after the current screen, when the flow's scope closes". `run-game.test.ts`: "shutdown closes `ScreenContext.runtime` once, after the current screen's scope and the save's last flush, and before the renderer is destroyed; a transition does not close it". Run `pnpm --filter @mcthaydt/automata-runtime exec vitest run --project unit src/flow/flow.test.ts src/boot/run-game.test.ts`; expect both new cases to fail because `context.runtime` is undefined (typecheck fails on the field too).
- [x] **2. Runtime green.** Add the field and the option; boot forks the scope before `makeSaves` and passes it. Same command: every case passes.
- [x] **3. Game red.** `default-screens.test.ts`: shutdown during play disposes the sim once; shutdown during paused, and during settings opened from paused, disposes it once; Quit to title disposes it once and a shutdown on the title after does not dispose it again; the file no longer disposes its sims by hand. `saves-screens.test.ts`: a shutdown during play with no host exit before it still writes the live sim's progress, and disposes the sim only after. Run `pnpm --filter @mcthaydt/automata-game exec vitest run --project unit src/screens/default-screens.test.ts src/screens/saves-screens.test.ts`; expect the shutdown cases to fail with zero disposes (the Quit case passes already: it pins the existing behaviour).
- [x] **4. Game green.** The default screens tie `dropSim` to `context.runtime` once per run. Same command: every case passes.
- [x] **5. Gates.** `pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm build`; `pnpm api-report --update` then `pnpm api-report`; `pnpm api-index`; `pnpm agent-skills`; `pnpm changeset status --since=origin/main` and `node tooling/release/src/check-changesets.ts` (no changeset: runtime and game are private); `pnpm --filter @mcthaydt/automata-runtime test:parity` and `pnpm --filter @mcthaydt/automata-game test:parity` (the runtime's and the default screens' browser suites).

## Gates

- Selected: the focused runs above, then every step-5 command.
- Pending: the Mac's CI on the PR head.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-30 | Plan | `0adea864` | |
| 2026-10-30 | 1 | | Red, both new cases, for the expected reason: `context.runtime` is undefined. In `flow.test.ts` the first enter dies adding a finalizer to it, so only one enter is recorded (`expected [ undefined ] to have a length of 3 but got 1`). In `run-game.test.ts` the title's enter dies the same way, the flow is left with no current screen, and `dispatch('play')` is `false` (`expected false to be true`). The other 32 cases passed. |
| 2026-10-30 | 2 | | `ScreenContext.runtime` added; `makeFlow` takes `runtime` or forks one before its own finalizer; boot forks it just before `makeSaves` and passes it. The same command: 2 files, 34 of 34 passed. `svelte-check` on the runtime package: 0 errors, 0 warnings. |
| 2026-10-30 | 3 | | Red for the expected reason. The DX.2c cases alone (`-t "DX.2c"`): 5 failed, 1 passed; play, paused, Settings, the second run and the save case each fail with `expected "dispose" to be called 1 times, but got 0 times`, and the Quit to title case passes (it pins today's behaviour). The whole two files: 54 failed, because `afterEach` now checks that every sim a test made is disposed after its shutdown (`expected function to throw an error, but it didn't`), and the sims left alive then run the file past Koota's 16 worlds. Deviation from the plan's wording: the second-run case was added to pin the once-per-run guard (a new run's scope gets its own finalizer). |
| 2026-10-30 | 4 | | `defaultScreens` wraps each screen's `enter` so it first adds `dropSim` to `context.runtime`, once per run. The same command: 2 files, 73 of 73 passed. The whole game package: 13 files, 189 of 189; `svelte-check` 0 errors, 0 warnings. |
| 2026-10-30 | Spec | `0640dfa5` | The runtime spec's §3.6 `ScreenContext` and §4 Shutdown order name `ScreenContext.runtime`; `pnpm api-report --update` added `readonly runtime: Scope.Scope` to `runtime.api.md`. |
| 2026-10-30 | 5 | | `pnpm format`: no fixes. First `TURBO_FORCE=true pnpm check`, before the report was updated: lint, typecheck (35 of 35), boundaries, style and knip passed, and `test:unit` failed only on api-report's `seams.test.ts` (`expected [ 'runtime.api.md' ] to deeply equal []`), the committed report being stale as expected. `pnpm build` (12 of 12); `pnpm api-report --update`, then `pnpm api-report`: exit 0, "1 API breaks against the base, 0 undeclared: `ScreenContext` changed (private, so no changeset is needed)". `pnpm api-index`: 570 exports, 0 undocumented, cheatsheet not stale. `pnpm agent-skills`: `api.md` current, no layout problems. `pnpm changeset status --since=origin/main`: nothing to bump; `node tooling/release/src/check-changesets.ts`: 2 changesets, 0 problems. Second `TURBO_FORCE=true pnpm check`: exit 0, `test:unit` 33 of 33 tasks (runtime 60 files, 521 tests; game 13 files, 189 tests). `pnpm --filter @mcthaydt/automata-runtime test:parity`: 3 files, 4 passed, 2 skipped (the real Web Audio case runs in Chromium only, by its `runIf`). `pnpm --filter @mcthaydt/automata-game test:parity` (browsers and layout): 9 files, 534 of 534. |
