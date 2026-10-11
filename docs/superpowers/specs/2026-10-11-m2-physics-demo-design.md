# M2.1b Physics demo `examples/physics/bodies-2d` (lane **sim**): design

- **Status:** drafted 2026-10-11 by the M2 specs thread; awaiting Owner review with the [M2 milestone spec](./2026-10-11-m2-deterministic-core-design.md).
- **Task:** M2.1b, the demo M2.1 (PR #9) listed as waiting on `base-2d` ([`examples/README.md`](../../../examples/README.md)). Plan: [m2-physics-demo](../plans/2026-10-11-m2-physics-demo.md).
- **Owns:** `examples/physics/bodies-2d/`; the `physics/bodies-2d` row in `examples/README.md`.
- **Waits on:** #9 (physics) and #10 (`base-2d`) on `main`; M2.3's `replayGolden` for the golden (until M2.3 merges, the golden is a final-hash test like base-2d's `golden.test.ts`, swapped for `replayGolden` afterwards).
- **Needs from integration (`base-2d`):** a way to add a layer to base-2d's renderer. `Renderer` (`examples/base-2d/src/render/renderer.ts:50`) exposes `apply`, `draw`, `reset`, `fit`, `playerPixel` and `destroy`, but no container. The request: `addLayer(layer: Container, above: 'tiles' | 'player')` on `Renderer`. The demo does not edit base-2d's files.
- **Builds from:** the [M2.1 physics spec](./2026-10-11-m2-sim-physics-design.md) §3.3 (components, spawn helpers, what makes a Rapier object), §3.4 (systems and phases, paired collision events); base-2d's `createBaseSim({ room, plugins })`, `Player` (subpixel position, `SUB = 256`, 8 px tiles, y down), `moveCommand`, input, screens.

## 1. What it shows

One thing: **Rapier bodies living in a base-2d room.** Crates and balls fall, tumble and settle on the room's platforms; Wick shoves them as he walks; `B` drops a new ball above him. Contact events puff a little dust.

## 2. How it works (the one `main.ts` a reader learns from)

- **Units.** One tile is one metre (8 px). Positions convert at the edges only: `metres = pixels / 8`. Gravity is `{ x: 0, y: 30 }` (y down, as base-2d), tuned by eye; it is in the physics plugin's config, so it is part of the schema hash (#9 §10.8).
- **Room.** At setup (outside `step`, like base-2d's player spawn) each horizontal run of `#` tiles becomes one lone cuboid collider (`transform2d` + `collider2d.cuboid`), so the room is a few dozen colliders, not hundreds.
- **Bodies.** Six crates (`collider2d.cuboid(0.5, 0.5, { friction: 0.8 })`) and four balls (`collider2d.ball(0.4, { restitution: 0.5 })`), dynamic, spawned at fixed places from the demo's content.
- **Wick.** A kinematic-position body with a capsule collider follows the `Player` component. A demo system `bodies.follow-wick` runs in `prePhysics` before `physics2d.sync-in`, copying the player's hitbox centre into the body's `Transform2D`. Wick moves in `gameplay`, after physics, so the body lags him by one tick, which is invisible at 60 Hz. Wick's own movement still collides with tiles only: he pushes bodies but never stands on them (standing would need base-2d's movement to read physics, a game decision, not the demo's).
- **Dropping a ball.** A `drop-ball` command (no payload); the demo's input sends it on `B` or the touch button. Its system spawns a ball 2 m above Wick. Commands are the only input (A0+A1 §4.4).
- **Dust.** `physics2d.collision-started` events with a crate or ball reach the renderer through `StepResult.events`; the demo draws a 4-frame dust puff at the contact's lower body. Presentation only.

## 3. Sim plugin

```ts
export const bodiesDemoPlugin = definePlugin({
  name: 'bodies-demo',
  dependsOn: ['physics-2d', 'base-2d'],    // plugin names as registered
  components: [WickBody],                   // marks the kinematic body
  commands: [DropBall],
  systems: [followWickSystem, dropBallSystem],
})
createBaseSim({ plugins: [physics2d({ gravity: { x: 0, y: 30 } }), bodiesDemoPlugin] })
```

`examples/physics/bodies-2d/src/sim/` is added to the demo's `check-boundaries` run (master spec §5: every package with sim plugins).

## 4. Rendering

A Pixi `Container` added through base-2d's `addLayer(…, 'player')`: one sprite per body, positioned from `Transform2D` rows in each `RenderDelta` (`added`, `changed`, `removed`, `resync`), at pixel = metres × 8, rotated by `rotation`, snapped to whole pixels for the crisp pixel look. Crate and ball sprites are new 8×8 palette-indexed pixel maps in the demo's `src/art/sprites.ts` (Endesga 64 only): a moss-banded wooden crate and a lantern-glass ball that catches Wick's light, in base-2d's original Emberwick style. No reference game's sprites are copied. Provenance in `src/art/PROVENANCE.md`.

## 5. Controls, layout, input

`←`/`→` walk, `Z`/`Space` jump (base-2d), `B` drop a ball, `Esc` pause. Touch: base-2d's touch controls plus a 48 px `B` button in the corner controls area. Phone portrait, 780×270 and desktop all show the whole room (base-2d's letterbox). No new `ui` primitives.

## 6. Failure policy

| Case | Behaviour |
|---|---|
| Rapier fails to load | The demo shows base-2d's error panel with Try again (the `createSim` rejection, #9 §5) |
| More than 64 balls | `drop-ball` is rejected by its system's guard (a resource counter), so the scene stays cheap on phones; the HUD shows `64 / 64` |
| A hash differs in one engine | A failure; never rebaselined per engine |

## 7. Tests

| Test | What |
|---|---|
| `bodies.test.ts` (Node) | The room becomes the expected number of merged colliders; a crate dropped on a platform comes to rest on its top (y within 0.01 m) within 120 ticks; walking right into a crate moves it right; `drop-ball` spawns a ball 2 m above Wick; the 65th is refused |
| `bodies.golden.test.ts` (Node and browsers) | A scripted 600-tick run (walk right pushing crates, jump, drop five balls, walk back) as a `replayGolden` with `snapshotEvery: 10`, identical in Node, Chromium, WebKit and Firefox (milestone exit 3) |
| `smoke.test.ts` | Boots under the fake Ruken host, reaches ready, no console errors, no CSP violations (Rapier's wasm needs `'wasm-unsafe-eval'`, which Ruken's CSP allows, S2) |
| Journey (nightly, GPU runner) | Phone portrait and 780×270: walk into a crate and see it move (its sprite's x changes) |

## 8. Header of `main.ts`

What it shows; controls; base `@af-examples/base-2d`; packages `@mcthaydt/automata-sim`, `@mcthaydt/automata-physics/2d`.

## 9. Exit criteria

1. Every test in §7 green locally, each seen failing first; parity identical in four engines.
2. Screenshots (phone portrait, 780×270, desktop; crates at rest and mid-tumble) in `evidence/`, shown to the Owner before promotion.
3. The README row moves from waiting to built.
