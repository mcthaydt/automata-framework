# M2.1b Physics demo: TDD plan

> Steps use checkboxes. Tick each one when its check passes and commit the tick with that step's work.

- **Spec:** [m2-physics-demo](../specs/2026-10-11-m2-physics-demo-design.md) ("spec"); milestone: [M2](../specs/2026-10-11-m2-deterministic-core-design.md).
- **Lane:** sim, on its own branch and worktree from `main` once `base-2d` (#10) is merged. Draft PR titled `M2.1b Physics demo`.
- **Before Task 1:** base-2d's `startGame` options, `./sim` export and typed first-sim failure (spec, "Needs from integration" (1)–(3), §6) are on `main`. Until (3) lands the demo row stays waiting, even if everything else is done. They are integration's work, asked through the coordinator; this plan does not tick them. Tasks 1–3 need neither and can start as soon as #10 merges.
- **Progress:** 5 / 6 tasks (1–5). Task 6 on the Owner's look at the screenshots. Where the code and §§3–7 of the spec differ, spec §11 is the contract.
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
- [x] `check.test.ts`: `import { physics2d } from '@mcthaydt/automata-physics/2d'` in a sim root passes; `@af-examples/base-2d/sim` is reported; with `allowImports: ['@af-examples/base-2d/sim']` it passes. Expected failure: the physics import is reported as not allowed. *Done in feature-demos PR #14 (`957b63d`). The option is named `--allow`, not `--allow-import`.*
- [x] Add the two physics entries to `IMPORT_ALLOWED` (with the reason comment) and the `--allow-import` option to `cli.ts`; `pnpm --filter @mcthaydt/check-boundaries test` passes. *Done in #14 with `/2d` only. Its audit fix left `/3d` out until a game sim imports it. The demo has no per-package `check` script: the root `pnpm boundaries` lists `examples/physics/bodies-2d/sim` with `--allow @af-examples/base-2d/sim`.*

### Task 2: room colliders
- [x] `room-colliders.test.ts` *At `sim/room-colliders.test.ts`: the demo keeps #14's layout with no `src/`. 56 rectangles at 16 px a metre (a tile is 8 px, half a metre). Seen failing first: module missing.*: `roomColliders(parseRoom(ROOM))` merges horizontal runs; the count and the first three rectangles match a hand count of base-2d's room. Expected failure: module missing.
- [x] Implement `src/sim/room-colliders.ts` *`sim/room-colliders.ts`; `bodies-sim.ts` spawns the walls from it.* (a plain function returning rectangles in metres).

### Task 3: plugin, follow and drop
- [x] `bodies.test.ts` on *#14's tests already covered settling, the follower, drops and the cap. This task added three: Wick shoves the crate stack right, every loose body carries a rendered `Prop`, and the drop height. The drop test failed first: a drop under the low platform started inside it, and Rapier pushed it out. Deviations kept from #14: the cap is 40 loose bodies, removing the oldest, not 64 with the 65th ignored. Drops start 1.25 m above Wick.* `createBaseSim({ plugins: [physics2d(...), bodiesPlugin] })` with the colliders and bodies spawned as `main.ts` will: a crate settles on a platform within 120 ticks; walking right into a crate moves it right; `drop-ball` spawns 2 m above Wick; at 64 balls a 65th `drop-ball` changes nothing. Expected failure: `bodiesPlugin` does not exist.
- [x] Implement the five `src/sim` files *#14's single `sim/bodies.plugin.ts`, plus a `Prop` component (crate or stone; rendered, so the layer reads it from the RenderDelta). Also `dropHeight`: when 1.25 m above Wick is inside a platform, the drop moves up a tile at a time until it is clear. `follow-wick` stays in `postPhysics` as in #14. Like the spec's version, it follows one tick late. `pnpm boundaries` passes.* (spec §3.2), `follow-wick` with `before: ['physics2d.sync-in']`; the package's `check` script runs `check-boundaries src/sim --allow-import @af-examples/base-2d/sim`; `pnpm boundaries` and `pnpm style` pass.

### Task 4: golden
- [x] `golden.test.ts`: the scripted 600-tick run against a committed final hash, like base-2d's `golden.test.ts`. Expected failure: no golden recorded. Record in Node, commit the golden alone with the reason; `golden.parity.test.ts` identical in Chromium, WebKit and Firefox. *#14 had a 360-tick golden. It was re-recorded with the spec's 600-tick script and a jump (`ad621eea6325a8db`). On 2026-10-11, `pnpm ci:local` passed in this thread's container, with the same hash in Chromium, WebKit and Firefox.*
- [x] After M2.3 merges (a separate small commit, or this PR if M2.3 is already in): swap to `replayGolden` with `snapshotEvery: 10`. Expected failure: no `.replay` golden until recorded. *Built against #20's branch before it merged (that branch is merged into this one). `golden.test.ts` records `__goldens__/bodies.replay` from `bodiesSimSetup().create` and `goldenDrive`, with `snapshotEvery: 30`, not 10: at 10 it packs to 497 KB, under the 512 KiB golden cap but with little headroom; at 30 it is 175 KB. `golden.parity.test.ts` replays it in Chromium, WebKit and Firefox (6/6 locally). First failure seen: `bodies.replay is missing`. With the drop height changed on purpose, the report names tick 11 (the first drop is on tick 10) and the differing fields. The final-hash golden stays as a quick check.*

### Task 5: page
- [x] `art.test.ts`: every pixel *`art/sprites.ts` (8 × 8 crate and stone), `art/art.test.ts`, `art/PROVENANCE.md`. The layer moved to `layer.ts`, drawn from the RenderDelta alone (`layer.test.ts`: sprites per body, whole-pixel positions, moves, reset, removal). `B` joins #14's `X`/`C` as drop keys.* of the crate and ball sprites is an Endesga 64 index. Expected failure: module missing. Then `sprites.ts` and `PROVENANCE.md`.
- [x] `boot.test.ts` under the fake host: ready, no console errors, no CSP violations; with Rapier's loader made to reject (`vi.mock` of physics' `./rapier-2d`), the page shows "This device can't run the game." and `data-state="failed"` (needs request (3)). Expected failure: `main.ts` missing. Then `layer.ts` and `main.ts` with its header (spec §3.1), the `B` key and touch button. *Booting under the fake host with no console errors and no CSP violations is checked by `e2e/bodies-2d.e2e.ts` (from #14). `boot.test.ts` (Node) mocks Rapier's loader to reject: the page shows "This device can't run the game.", sets `data-state="failed"` and logs the loader's error. It also checks that a host failure is blamed on the connection. The failures are typed in `boot.ts`, and `main.ts` runs under base-2d's `bootPage` (#15). The demo boots through `playRoom`, not `startGame` (spec §11).*
- [x] `e2e/bodies.e2e.ts` and its project in the root `playwright.config.ts` (nightly): walk into a crate, its sprite moves. Expected failure: no project named `physics-bodies-2d`. Run on the GPU runner on request; record the run. *Added to #14's `e2e/bodies-2d.e2e.ts` in the `demos` project, not as a new root project (spec §11). It runs on Pixel 7 portrait and 780 × 270, and passed locally in Chromium (3/3).*

### Task 6: evidence and docs
- [ ] Screenshots into `evidence/` (phone portrait, 780×270, desktop); show the Owner.
- [ ] `examples/README.md` row to built; **Progress** and the execution log; rows for 02 and 03 sent to the integration owner.

## Execution log

- 2026-10-11, M2.1b thread: the branch is stacked on feature-demos PR #14 (merged into it at `87e97f1`). #14 had already built `physics/bodies-2d` on `playRoom`, with boundaries `--allow`, a final-hash golden and a parity test. This lane fills the gaps instead of making a second demo: room colliders, the push test, the `Prop` tag, drop heights clear of platforms, the RenderDelta layer and the 8 × 8 sprites. The golden was re-recorded (`ad621eea6325a8db`) because the sim changed on purpose (`Prop`, drop heights) and the script grew to the spec's 600 ticks with a jump. The new hash matches in Node and in local Chromium; WebKit and Firefox run on af-linux. Screenshots are in the project's `evidence/physics-bodies-2d-2026-10-11/`. Still open: `startGame` options, the typed first-sim failure and the boot test (base-2d thread), the crate-moves journey, and `replayGolden` after M2.3.
- 2026-10-11, after the #17 audit: #15 (base-2d errors) was merged into the branch, taking the union of base-2d's exports. `main.ts` now runs under `bootPage`, with typed failures (`boot.ts`, `boot.test.ts`). The spec gained §11, which lists every deviation with its reason. Also added: a test for the layer's clear on resync (seen failing with the clear removed), `data-crate-x` and the crate-moves journey (phone portrait and 780 × 270), and a 30 s test timeout for the Rapier-heavy unit tests.
- 2026-10-11, after the audit's re-check: the crate-moves journey now waits for 60 ticks before pressing, because the crates land first; that was the Firefox flake at 780 × 270. Task 1's code spans are fixed. Task 4's `replayGolden` was built on M2.3's branch (#20), which is merged in locally.
