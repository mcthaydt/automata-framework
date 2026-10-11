# M2.1b Physics demo: TDD plan

> Steps use checkboxes. Tick each one when its check passes and commit the tick with that step's work.

- **Spec:** [m2-physics-demo](../specs/2026-10-11-m2-physics-demo-design.md) ("spec"); milestone: [M2](../specs/2026-10-11-m2-deterministic-core-design.md).
- **Lane:** sim, on its own branch and worktree from `main` once #9 and #10 are merged. Draft PR titled `M2.1b Physics demo`.
- **Progress:** 0 / 6 tasks.
- **Local CI:** Node 24.21.0; `pnpm vitest run <file>`; `pnpm --filter <demo> test`; `pnpm --filter <demo> test:parity`; `pnpm check`; before calling the PR green `pnpm ci:local`.

## Interfaces

- **Consumed:** `physics2d`, `Transform2D`, `RigidBody2D`, `Collider2D`, `BodyKind`, `transform2d`, `body2d`, `collider2d`, `CollisionStarted2D` (`@mcthaydt/automata-physics/2d`); `definePlugin`, `defineSystem`, `defineCommand`, `defineComponent`, `defineResource` (`@mcthaydt/automata-sim`); `createBaseSim`, `moveCommand`, `Player`, `ROOM`, `parseRoom`, the renderer, input and screens (`@af-examples/base-2d`); `replayGolden` (`@mcthaydt/automata-testing/sim`, after M2.3).
- **Produced:** `examples/physics/bodies-2d` (package `@af-examples/physics-bodies-2d`).

## Tasks

### Task 1: the renderer hook
- [ ] Ask the integration owner (through the coordinator) for `Renderer.addLayer` (spec, "Needs from integration"). Tick when it is on `main`; until then Tasks 2–4 proceed headless.

### Task 2: room colliders
- [ ] `bodies.test.ts`: `roomColliders(parseRoom(ROOM))` merges horizontal runs; the count and the first three rectangles match a hand count of base-2d's room. Expected failure: module missing.
- [ ] Implement `src/sim/room-colliders.ts` (plain function returning spawn parts).

### Task 3: plugin, follow and drop
- [ ] `bodies.test.ts`: a crate settles on a platform within 120 ticks; walking right into a crate moves it right; `drop-ball` spawns 2 m above Wick; the 65th is refused. Expected failure: the plugin does not exist.
- [ ] Implement `bodies-demo.plugin.ts`, `follow-wick.system.ts`, `drop-ball.command.ts`, `drop-ball.system.ts`, `balls.resource.ts`; add `src/sim` to the demo's `check-boundaries` script; `pnpm boundaries` and `pnpm style` pass.

### Task 4: golden
- [ ] `bodies.golden.test.ts`: the scripted 600-tick run. Before M2.3 merges: a final-hash golden like base-2d's `golden.test.ts`; after: `replayGolden` with `snapshotEvery: 10`. Record in Node, commit alone with the reason; `test:parity` identical in Chromium, WebKit, Firefox.

### Task 5: page
- [ ] Sprites (`src/art/sprites.ts`, Endesga 64 indices only; a test that every pixel is a palette index), provenance file, the layer drawing bodies from the render delta, dust puffs from events, the `B` key and touch button, `main.ts` with its header.
- [ ] `smoke.test.ts` under the fake host: ready, no console errors, no CSP violations.
- [ ] Journey in the root `playwright.config.ts` (nightly): walk into a crate, its sprite moves.

### Task 6: evidence and docs
- [ ] Screenshots into `evidence/` (phone portrait, 780×270, desktop); show the Owner.
- [ ] `examples/README.md` row to built; **Progress** and the execution log; rows for 02 and 03 sent to the integration owner.

## Execution log

- (empty)
