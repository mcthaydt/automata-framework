# M2.1b Physics demo: TDD plan

> Steps use checkboxes. Tick each one when its check passes and commit the tick with that step's work.

- **Spec:** [m2-physics-demo](../specs/2026-10-11-m2-physics-demo-design.md) ("spec"); milestone: [M2](../specs/2026-10-11-m2-deterministic-core-design.md).
- **Lane:** sim, on its own branch and worktree from `main` once `base-2d` (#10) is merged. Draft PR titled `M2.1b Physics demo`.
- **Before Task 1:** base-2d's `startGame` options, `./sim` export and typed first-sim failure (spec, "Needs from integration" (1)–(3), §6) are on `main`. Until (3) lands the demo row stays waiting, even if everything else is done. They are integration's work, asked through the coordinator; this plan does not tick them. Tasks 1–3 need neither and can start as soon as #10 merges.
- **Progress:** 0 / 6 tasks.
- **Local CI:** Node 24.21.0; `pnpm vitest run <file>`; `pnpm --filter @af-examples/physics-bodies-2d test`; `pnpm --filter @af-examples/physics-bodies-2d test:parity`; `pnpm check`; before calling the PR green `pnpm ci:local`.

## Interfaces

- **Consumed:** `physics2d`, `Transform2D`, `transform2d`, `body2d`, `collider2d` (`@mcthaydt/automata-physics/2d`); `definePlugin`, `defineSystem`, `defineCommand`, `defineComponent`, `defineResource` (`@mcthaydt/automata-sim`); `createBaseSim`, `ROOM`, `parseRoom`, `startGame` (`@af-examples/base-2d`); `Player` (`@af-examples/base-2d/sim`); `createRenderer`, `RendererLayer` (`@af-examples/base-2d/render`); `replayGolden` (`@mcthaydt/automata-testing/sim`, after M2.3).
- **Produced:** `examples/physics/bodies-2d` (`@af-examples/physics-bodies-2d`, private); `--allow-import` and the physics entries in `tooling/check-boundaries`.

## Files

| Create | Modify |
|---|---|
| `examples/physics/bodies-2d/{package.json, tsconfig.json, tsconfig.node.json, vite.config.ts, vitest.config.ts, index.html, main.ts, ship.config.ts}` | `tooling/check-boundaries/src/check.ts`, `check.test.ts`, `cli.ts` (Task 1) |
| `src/sim/{bodies.plugin.ts, bodies.component.ts, drop-ball.command.ts, bodies.system.ts, balls.resource.ts, room-colliders.ts, room-colliders.test.ts, bodies.test.ts}` | `examples/README.md` (this demo's row only) |
| `src/{layer.ts, golden.ts, golden.test.ts, golden.parity.test.ts, boot.test.ts}`, `src/art/{sprites.ts, art.test.ts, PROVENANCE.md}`, `e2e/bodies.e2e.ts` | root `playwright.config.ts` (one project entry, through the coordinator: ship owns root config) |

## Tasks

### Task 1: boundaries for physics and game sims
- [ ] `check.test.ts`: `import { physics2d } from '@mcthaydt/automata-physics/2d'` in a sim root passes; `@af-examples/base-2d/sim` is reported; with `allowImports: ['@af-examples/base-2d/sim']` it passes. Expected failure: the physics import is reported as not allowed.
- [ ] Add the two physics entries to `IMPORT_ALLOWED` (with the reason comment) and the `--allow-import` option to `cli.ts`; `pnpm --filter @mcthaydt/check-boundaries test` passes.

### Task 2: room colliders
- [ ] `room-colliders.test.ts`: `roomColliders(parseRoom(ROOM))` merges horizontal runs; the count and the first three rectangles match a hand count of base-2d's room. Expected failure: module missing.
- [ ] Implement `src/sim/room-colliders.ts` (a plain function returning rectangles in metres).

### Task 3: plugin, follow and drop
- [ ] `bodies.test.ts` on `createBaseSim({ plugins: [physics2d(...), bodiesPlugin] })` with the colliders and bodies spawned as `main.ts` will: a crate settles on a platform within 120 ticks; walking right into a crate moves it right; `drop-ball` spawns 2 m above Wick; at 64 balls a 65th `drop-ball` changes nothing. Expected failure: `bodiesPlugin` does not exist.
- [ ] Implement the five `src/sim` files (spec §3.2), `follow-wick` with `before: ['physics2d.sync-in']`; the package's `check` script runs `check-boundaries src/sim --allow-import @af-examples/base-2d/sim`; `pnpm boundaries` and `pnpm style` pass.

### Task 4: golden
- [ ] `golden.test.ts`: the scripted 600-tick run against a committed final hash, like base-2d's `golden.test.ts`. Expected failure: no golden recorded. Record in Node, commit the golden alone with the reason; `golden.parity.test.ts` identical in Chromium, WebKit and Firefox.
- [ ] After M2.3 merges (a separate small commit, or this PR if M2.3 is already in): swap to `replayGolden` with `snapshotEvery: 10`. Expected failure: no `.replay` golden until recorded.

### Task 5: page
- [ ] `art.test.ts`: every pixel of the crate and ball sprites is an Endesga 64 index. Expected failure: module missing. Then `sprites.ts` and `PROVENANCE.md`.
- [ ] `boot.test.ts` under the fake host: ready, no console errors, no CSP violations; with Rapier's loader made to reject (`vi.mock` of physics' `./rapier-2d`), the page shows "This device can't run the game." and `data-state="failed"` (needs request (3)). Expected failure: `main.ts` missing. Then `layer.ts` and `main.ts` with its header (spec §3.1), the `B` key and touch button.
- [ ] `e2e/bodies.e2e.ts` and its project in the root `playwright.config.ts` (nightly): walk into a crate, its sprite moves. Expected failure: no project named `physics-bodies-2d`. Run on the GPU runner on request; record the run.

### Task 6: evidence and docs
- [ ] Screenshots into `evidence/` (phone portrait, 780×270, desktop); show the Owner.
- [ ] `examples/README.md` row to built; **Progress** and the execution log; rows for 02 and 03 sent to the integration owner.

## Execution log

- (empty)
