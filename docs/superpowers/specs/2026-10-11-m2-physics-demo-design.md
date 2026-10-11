# M2.1b Physics demo `examples/physics/bodies-2d` (lane **sim**): design

- **Status:** drafted 2026-10-11 by the M2 specs thread; revised after the PR #12 audit (base-2d checked at PR #10 head `ab4f857`); awaiting Owner review with the [M2 milestone spec](./2026-10-11-m2-deterministic-core-design.md).
- **Amended 2026-10-11 (PR #17):** the demo was built on feature-demos PR #14's version, and §11 lists where it differs from §§3–7 below, with the reason for each. §11 wins where the two disagree.
- **Task:** M2.1b, the demo M2.1 (PR #9, merged as `d556d23`) listed as waiting on `base-2d` ([`examples/README.md`](../../../examples/README.md)). Plan: [m2-physics-demo](../plans/2026-10-11-m2-physics-demo.md).
- **Waits on:** `base-2d` (#10, open) on `main`. Nothing else: #9 is merged; the golden starts as a final-hash test and becomes a `replayGolden` when M2.3 merges.
- **Needs from integration (base-2d), asked through the coordinator:** (1) `startGame` is not exported and builds its sims with a bare `createBaseSim()` (`src/game.ts:24,40,91`); the request is to export it with options `{ plugins?, onRound?(sim), layers? }`, so a demo adds plugins, spawns per round and adds layers without copying the game loop. (2) A `./sim` export (§3.4). (3) A typed first-sim failure (§6). The demo edits no base-2d file.
- **Builds from:** the [M2.1 physics spec](./2026-10-11-m2-sim-physics-design.md) §3.3 (components, spawn helpers) and §3.4 (systems and phases, paired collision events); base-2d at #10 head `ab4f857`: `createBaseSim({ room?, plugins? })` (`src/base-sim.ts:8-21`), `Player` (hitbox top-left in subpixels, `SUB = 256`, 8 px tiles, y down; `src/sim/player.component.ts`), `moveCommand`, and the `@af-examples/base-2d/render` entry with `createRenderer` and `Renderer.addLayer(layer: RendererLayer): () => void` (`src/render/renderer.ts:55-80`, drawn above the tiles, under the light map and under Wick).

## 1. What it shows

One thing: **Rapier bodies living in a base-2d room.** Crates and balls fall, tumble and settle on the room's platforms; Wick shoves them as he walks; `B` drops a new ball above him.

## 2. Ownership

| Owns | Must not touch |
|---|---|
| `examples/physics/bodies-2d/` (package `@af-examples/physics-bodies-2d`, private); the `physics/bodies-2d` row in `examples/README.md`; in `tooling/check-boundaries/src/check.ts`, the two physics entries in `IMPORT_ALLOWED` and an `--allow-import` option (§3.4; agreed in [04 How we build](../../04-how-we-build.md)'s sim row) | `examples/base-2d/` (integration: requests go through the coordinator); `packages/physics/` (merged; a bug found here is a separate fix PR); every other package |

## 3. How it works

### 3.1 Files

The examples rule is "one entry file a reader learns from" ([`examples/README.md`](../../../examples/README.md)). `check-style` puts every `define*` call in a file with its role suffix, so the sim definitions cannot live in `main.ts`. The demo keeps that split small and says so in `main.ts`'s header:

| File | What |
|---|---|
| `main.ts` | The entry and the lesson: calls base-2d's `startGame` with the plugins, an `onRound` that spawns the room colliders and bodies, the layer, and the `B` key. Its header names the files below. |
| `src/sim/bodies.plugin.ts` | `definePlugin` with the systems, the command, the tag components and the resource below |
| `src/sim/bodies.component.ts` | `Crate`, `Ball`, `Wall`, `WickBody` tags (rendered, so the layer can tell bodies apart: `RigidBody2D` and `Collider2D` are `render: false`, `packages/physics/src/physics-2d.component.ts:26,46`) |
| `src/sim/drop-ball.command.ts`, `src/sim/bodies.system.ts`, `src/sim/balls.resource.ts` | The command; `bodies.follow-wick` and `bodies.drop-ball`; the ball counter |
| `src/sim/room-colliders.ts` | A plain function from base-2d's parsed room to wall rectangles |
| `src/layer.ts` | The `RendererLayer`: one sprite per body |
| `src/art/sprites.ts`, `src/art/PROVENANCE.md` | Two 8×8 sprites |

No HUD, no particles, no new screens: the demo shows bodies, and nothing it adds distracts from that.

### 3.2 Sim

- **Units.** One tile is one metre (8 px). Positions convert at the edges only: `metres = pixels / 8`. Gravity is `{ x: 0, y: 30 }` (y down, as base-2d), tuned by eye; it is in the physics plugin's config, so it is part of the schema hash (#9 §10.8).
- **Room.** At setup (outside `step`, like base-2d's player spawn in `createBaseSim`) each horizontal run of solid tiles becomes one fixed cuboid (`transform2d` + `collider2d.cuboid` + `Wall`), so the room is a few dozen colliders, not hundreds.
- **Bodies.** Six crates (`collider2d.cuboid(0.5, 0.5, { friction: 0.8 })` + `Crate`) and four balls (`collider2d.ball(0.4, { restitution: 0.5 })` + `Ball`), dynamic, at fixed places listed in `main.ts`.
- **Wick.** A kinematic-position body with a capsule collider and `WickBody`. `bodies.follow-wick` runs in `prePhysics`, `before: ['physics2d.sync-in']`, and copies the `Player` hitbox centre into that body's `Transform2D`. base-2d moves Wick in `player.move`, which is in the `physics` phase (`src/sim/player-move.system.ts:25`) next to `physics2d.step`; the schedule breaks the tie by name (`packages/sim/src/schedule/schedule.ts:54`), so `physics2d.step` runs first, every time, in every engine. The body therefore follows Wick one tick late, which is invisible at 60 Hz. Wick's own movement still collides with tiles only: he pushes bodies but never stands on them (standing would need base-2d's movement to read physics, a game decision, not the demo's).
- **Dropping a ball.** A `drop-ball` command with an empty payload; `bodies.drop-ball` (phase `gameplay`) spawns a ball 2 m above Wick and increments the `Balls` resource. When `Balls.count` is 64 the system ignores the command, so the scene stays cheap on phones. Commands are the only input (A0+A1 §4.4).

```ts
export const bodiesPlugin = definePlugin({
  name: 'bodies',
  dependsOn: ['physics-2d', 'base-2d'],
  components: [Crate, Ball, Wall, WickBody],
  resources: [Balls],
  commands: [DropBall],
  systems: [followWick, dropBall],
})
// main.ts
createBaseSim({ plugins: [physics2d({ gravity: { x: 0, y: 30 } }), bodiesPlugin] })
```

### 3.3 Rendering

`main.ts` passes a `RendererLayer` in `startGame({ layers })`; base-2d's game, which owns the renderer, calls `renderer.addLayer` with it. Its `apply(result)` reads `Transform2D` rows from the step's `RenderDelta` (`added`, `changed`, `removed`, `resync`) for entities that carry `Crate` or `Ball` (walls are tiles already, so they draw nothing), and places one sprite each at pixel = metres × 8, rotated by `rotation`, snapped to whole pixels. `reset()` clears the sprites for a new round. The layer sits under the light map, so Wick's lantern lights the crates like the room.

Crate and ball are new 8×8 palette-indexed pixel maps (Endesga 64 only): a moss-banded wooden crate and a lantern-glass ball, in base-2d's original Emberwick style. No reference game's sprites are copied. Provenance in `src/art/PROVENANCE.md`.

### 3.4 Boundaries

`IMPORT_ALLOWED` (`tooling/check-boundaries/src/check.ts:96-106`) has neither `@mcthaydt/automata-physics/2d` nor any game's own sim package, so the demo's `src/sim` fails `check-boundaries` as it stands. The same wall stops any game whose sim imports physics. This task adds:

- `@mcthaydt/automata-physics/2d` and `/3d` to `IMPORT_ALLOWED`, with the sim entries' reason: they are checked sources themselves (the root `boundaries` script checks `packages/physics/src`).
- `--allow-import <specifier>` (repeatable): a game passes the sim entry of another package it also checks. The demo's script is `check-boundaries src/sim --allow-import @af-examples/base-2d/sim`.
- A request to integration: a `./sim` export on base-2d pointing at `src/sim/index.ts` (already sim-only). The package root re-exports boot code that imports `@ruken/sdk`, so the demo's sim must not import it.

M2.4 renames the package and threads the option through `game-ci.yml` (`allow-imports` input).

## 4. Controls, layout, input

`←`/`→` walk, `Z`/`Space` jump, `Esc` pause (all base-2d), `B` drop a ball. Touch: base-2d's controls plus one 48 px `B` button in the same corner group. Phone portrait, 780×270 and desktop show the whole room (base-2d's letterbox). No new `ui` primitives.

## 5. Lifecycle

Boot is base-2d's: handshake, then ready, then the first round. Each round makes a fresh sim (base-2d's `rounds.ts`), so `main.ts`'s `onRound` spawns colliders and bodies per round, the layer's `reset()` drops the old sprites, and the `Balls` count restarts at 0. Pause stops stepping; the bodies freeze where they are. Dispose is base-2d's: the sim and the Rapier world go with the round.

## 6. Failure policy

| Case | Behaviour |
|---|---|
| Rapier fails to load (`createSim` rejects, #9 §5) | Whatever base-2d's boot failure shows, with `data-state="failed"`; no retry, as in base-2d. **Today that is the wrong message:** base-2d makes its first sim with `Effect.promise` (`src/game.ts:40` at `ab4f857`), so the rejection is a defect, and `main.ts:24-28` picks its text from `error._tag`, which the `FiberFailure` from `Effect.runPromise` never has, so the page says "Couldn't connect to Ruken." The request to integration (with #10's own fix, raised by the audit): fail the first sim as a typed error and read the tag from the `Cause`, and map that tag to "This device can't run the game." (today `main.ts:27` maps only `RendererFailed` to it; reusing `RendererFailed` for a sim that cannot be made is fine too, the demo only needs the text). The test makes Rapier fail with `vi.mock` of physics' `./rapier-2d` loader (`physics-2d.ts:29`, `rapier-2d.ts:46`). The demo's `boot.test.ts` pins that text once the fix is on `main`; until then the demo row stays waiting |
| A round's sim cannot be made | base-2d's terminal failure path (`src/failure.ts`) |
| `drop-ball` at 64 balls | Ignored by the system; nothing else changes |
| A hash differs in one engine | A failure; never rebaselined per engine |

## 7. Tests

| Test | What | Expected first failure |
|---|---|---|
| `src/sim/room-colliders.test.ts` (Node) | base-2d's `ROOM` becomes the hand-counted number of rectangles; the first three match | module missing |
| `src/sim/bodies.test.ts` (Node) | a crate dropped on a platform rests on its top (y within 0.01 m) within 120 ticks; walking right into a crate moves it right; `drop-ball` spawns 2 m above Wick; the 65th does nothing | plugin missing |
| `tooling/check-boundaries/src/check.test.ts` (Node) | an import of `@mcthaydt/automata-physics/2d` passes; `@af-examples/base-2d/sim` fails without `--allow-import` and passes with it | the import is reported |
| `src/art/art.test.ts` | every pixel is an Endesga 64 index | module missing |
| `src/golden.test.ts`, `src/golden.parity.test.ts` | a scripted 600-tick run (walk right pushing crates, jump, drop five balls, walk back): a final-hash golden like base-2d's; after M2.3, `replayGolden` with `snapshotEvery: 10`. Identical in Node, Chromium, WebKit and Firefox (milestone exit 3) | no golden file |
| `src/boot.test.ts` | boots under the fake Ruken host, reaches ready, no console errors, no CSP violations (Rapier's wasm needs `'wasm-unsafe-eval'`, which Ruken's CSP allows, S2) | `main.ts` missing |
| Journey (nightly, GPU runner; root `playwright.config.ts`) | phone portrait and 780×270: walk into a crate and its sprite's x changes | project missing |

## 8. Feedback workflow

`pnpm vitest run src/sim/bodies.test.ts` while writing systems; `pnpm --filter @af-examples/physics-bodies-2d test:parity` for the golden; `pnpm check` (boundaries and style) before each commit; `pnpm ci:local` before calling the PR green. The journey runs on the GPU runner on request (`AGENTS.md`).

## 9. Ruken alignment

Nothing new crosses the host boundary: the demo is base-2d's game with a plugin, so handshake, ready and rounds are base-2d's. CSP: Rapier needs `'wasm-unsafe-eval'`, which Ruken allows; the demo adds no `eval`.

## 10. Exit criteria

1. Every test in §7 green locally, each seen failing first; parity identical in four engines.
2. Screenshots (phone portrait, 780×270, desktop; crates at rest and mid-tumble) in `evidence/`, shown to the Owner before promotion.
3. The README row moves from waiting to built.

## 11. As built (PR #17, stacked on #14)

Feature-demos PR #14 shipped a first `physics/bodies-2d` before this lane started. M2.1b finished that demo rather than making a second one, which the coordinator asked for. Where this spec and the code differ, the code was kept for the reason given, and this section is the contract.

| Spec (§§3–7) | As built | Why |
|---|---|---|
| Boots through base-2d's `startGame({ plugins, onRound, layers })` | Boots through `playRoom` (`@af-examples/base-2d/play`), under `bootPage` (`boot.ts` types the failures) | `startGame` (#15, `@af-examples/base-2d/game`) runs base-2d's game: its game id, its connect, and only the `move` command each step. The demo needs its own game id (the host checks it), a `drop` command and an `onStep` for the collision counter, and `playRoom` has all three. `examples/README.md` makes `playRoom` the way 2D demos are built. Moving to `startGame` would need base-2d to add `commands`, `onStep` and a game id. That is not needed for this demo. |
| Rapier failing shows "This device can't run the game." | Same: `playBodies` turns a rejected start into `SimFailed`, and a host failure becomes `BaseBootFailed`. base-2d's `bootPage` picks the message and sets `data-state` | `boot.test.ts` mocks physics' Rapier loader to reject, and checks the text, the state and the logged cause |
| 8 px a metre, gravity +30, y down | 16 px a metre (a tile is 8 px, half a metre), gravity −40, y up | Rapier's convention is y up. Base-2d's tiles are 8 px, and at 16 px a metre a 0.5 m crate is exactly one 8 × 8 sprite. The −40 is tuned so crates fall as briskly as Wick |
| `Crate`, `Ball`, `Wall` and `WickBody` tags; a `Balls` resource | One rendered `Prop { kind }` (crate or stone) on loose bodies, and a `Follower` on Wick's box. Walls carry neither | The layer only needs to tell a crate from a stone; a wall is drawn by the room's tiles. Bodies are counted with a query, so no resource is needed |
| Six crates and four balls; drop 2 m above Wick; 64 cap, the 65th drop ignored | Four crates and three stones; drop 1.25 m above Wick, moved up a tile at a time until clear of solid tiles; a cap of 40 loose bodies, removing the oldest | Wick walks under the low platform, and 2 m (or 1.25 m) above him can be inside it, so the drop climbs out first. Removing the oldest keeps `B` working forever, and 40 is cheaper on phones than 64 |
| `follow-wick` in `prePhysics`, before `physics2d.sync-in` | In `postPhysics`, after base-2d's `player.move` | Both follow Wick one tick late. After the move, the box reads this tick's position, and the next step uses it |
| Files under `src/` | At the package root (`main.ts`, `boot.ts`, `bodies-sim.ts`, `layer.ts`, `sim/`, `art/`) | #14's layout, like the other feature demos |
| `--allow-import`; `/2d` and `/3d` allowed | `--allow`; only `/2d` | Done in #14. Its audit left `/3d` out until a game sim imports it |
| A journey on phone portrait and 780 × 270 | `e2e/bodies-2d.e2e.ts` in the `demos` project, on Pixel 7 portrait and 780 × 270: a pushed crate's sprite moves (`data-crate-x`) | It runs with the demos project's servers. No separate root project is needed |
