# PRODUCT.8b: the Party Racer race sim on Rapier 2D, TDD plan

- **Spec:** the framework's PRODUCT spec (`docs/superpowers/specs/2026-10-16-product-core-and-plus-design.md`) §3
  (FloorFifty on AF: the race rules stay the game's), §6 (starters), §10 (PRODUCT.8, P-b), §11 PD-2 ("the Party Racer
  ports FloorFifty's Planck race onto Rapier 2D").
- **Plan above this one:** `2026-10-30-product8-party-racer.md` (PRODUCT.8a), slice 8b: "players, platforms, collision,
  the step and one mode, ported from `packages/shared/src/simulation` and `level/course.ts` onto
  `@mcthaydt/automata-physics/2d` on placeholder content". Acceptance: "a golden of a scripted four-player race,
  identical in Node, Chromium, WebKit and Firefox; the course generator's seeded output pinned".
- **Row:** PRODUCT.8b in the framework's `docs/02-master-delivery-plan.md`. Prerequisites PRODUCT.5f, PRODUCT.8a
  (merged). Size L.
- **Branch:** `claude/plus-PRODUCT.8b-race-sim`.
- **Source:** FloorFifty at `677d4568b7b2265fda4246d711065b8f417cac26` (the 8a baseline's commit), read-only:
  `packages/shared/src/simulation/{simulation,step,players,platforms,collision,input}.ts`,
  `simulation/planck/{world,facts,consequences,planck-simulation,config,units}.ts`, `level/course.ts`, `level/rng.ts`.
- **Status:** implemented and checked locally, the three-browser parity included; Plus CI and review pending.

## Scope

In: the race sim of one mode (FloorFifty's lap race), as a sim plugin in `starters/party-racer/src/sim`, on
placeholder tuning in `starters/party-racer/src/content`; the course generator; a scripted four-player race golden in
Node and three browsers; the workspace changes that put `starters/` under the F1 boundary test and the sim
boundaries.

Out: Survival and Endless (FloorFifty's other modes), the select steps, CPU steering (`level/steering.ts`; the room's
bot seats are M7's), rooms and countdown (8c), the client (8d). Nothing in FloorFifty changes.

## What maps to what

| FloorFifty (`677d456`) | Party Racer | How |
|---|---|---|
| `planck/world.ts` racer body: dynamic box, `fixedRotation`, no sleep, racers never collide with racers | `race-start.system.ts` spawns `transform2d` + `body2d(dynamic)` + `collider2d.cuboid` with groups racer→floor | Rapier, through `physics2d`. `fixedRotation` has no field in `RigidBody2D`, so the step zeroes rotation and spin before each physics step |
| floor bodies: static, or kinematic steered by velocity onto the domain's target (`driveFloors`) | `Floor` entity: `body2d(fixed)` or `body2d(kinematicVelocity)`, `vx` solved from the target | Same rule |
| `setActive(isInMotion)` | the racer's body kind is `kinematicPosition` while not in motion (awaiting input, held, finished) and `dynamic` otherwise | Plus physics has no active flag; a kinematic body neither falls nor is pushed |
| `facts.ts` pre-solve normals and the foot sensor | `contacts.ts`: classify each racer/floor pair from the post-step poses (the smaller gap axis gives the face) and the pre-step velocity (the approach test); the foot band is the same box overlap | `physics2d` exposes collision events but no manifold, so the face is computed from geometry, as FloorFifty's own reference controller does (`CONTACT_TOLERANCE_PIXELS`) |
| `consequences.ts` bounce, ground, credit, carry; `input.ts` held input, first-input bounce, fast fall and its override, reset as an edge; `collision.ts` wrap, death line, respawn; `step.ts` lap and winner | `race-step.system.ts` and `race-rules.ts` | Ported; the race-mode branch only |
| `level/course.ts` + `level/rng.ts` (SplitMix32) | `course.generator.ts` on core's `createRng` / `deriveSeed` | Same rule (fixed start floor, independent x draw across bounds, a coin for moving, a speed range, prefix-stable per floor index); core's RNG, so the same seed gives a different course than FloorFifty's |
| pixels at 50 per metre | metres | The tuning is placeholder content, written in metres |

## Files

- `pnpm-workspace.yaml`: `starters/*` joins the workspace.
- `tooling/boundary/core-imports.ts` (+ test): the F1 scan reads workspace packages under `starters/` too.
- Root `package.json`: `boundaries` adds `starters/party-racer/src/sim`.
- `tooling/ci/workspace-scripts.test.ts`: a starter's `src/sim` is under a boundaries root.
- `starters/party-racer/package.json` (private, `party-racer`; core and physics as dependencies), `tsconfig.json`,
  `vitest.config.ts` (node and browsers projects, physics's pattern), `SOURCE.md` (FloorFifty's commit and file map).
- `src/sim/tuning.schema.ts`: `raceTuningSchema` (Zod), `RaceTuning`.
- `src/sim/course.generator.ts`: `createCourse(seed, tuning): Course`, `courseBounds(tuning)`.
- `src/sim/racer.component.ts`: `Racer`, `HeldInput`. `src/sim/floor.component.ts`: `Floor`.
- `src/sim/race.resource.ts`: `Race` (phase, start tick, laps, floor count, death line, standings, winner).
- `src/sim/race.command.ts`: `RaceStart` (`race.start` { courseSeed, seats }), `RaceInput` (`race.input` { left,
  right, fastFall }), `RaceReset` (`race.reset` {}). A seat's commands carry `source` = seat (M7's input queue).
- `src/sim/race.event.ts`: `FloorLanded`, `LapCompleted`, `RacerReset`, `RaceFinished`.
- `src/sim/contacts.ts`: `racerContacts(racer, floors, sizes)` → sorted facts (pure).
- `src/sim/race-rules.ts`: the rules on plain values: inputs, consequences, carry, wrap and deaths, laps.
- `src/sim/race-start.system.ts`, `race-step.system.ts`: the systems. `src/sim/race.plugin.ts`:
  `racePlugins(tuning): PluginDef[]` (`physics2d` with the tuning's gravity, then the race plugin; tuning in the
  plugin `config`, so it is in the schema hash). `src/sim/index.ts`.
- `src/content/placeholder.content.ts`: `PLACEHOLDER_TUNING`, `PLACEHOLDER_COURSE_SEED`.
- `src/testing/scripted-race.ts`: four scripted seats and `runScriptedRace(restoreAt?)`.
- Tests: `course.generator.test.ts`, `contacts.test.ts`, `race.plugin.test.ts`, `race.parity.test.ts` (Node and
  browsers).

## Interfaces

```ts
export const raceTuningSchema: z.ZodObject<…>   // metres, seconds; floorCount ≤ 64, laps ≥ 1
export type RaceTuning = z.output<typeof raceTuningSchema>
export interface CourseFloor { index: number; x: number; y: number; moving: boolean; speed: number }
export interface Course { seed: number; floors: CourseFloor[]; bounds: { left: number; right: number }; deathLineY: number }
export function createCourse(seed: number, tuning: RaceTuning): Course
export function racePlugins(tuning: RaceTuning): PluginDef[]
export const RaceStart, RaceInput, RaceReset: CommandDef
export const FloorLanded, LapCompleted, RacerReset, RaceFinished: EventDef
export const Racer, HeldInput, Floor: ComponentDef
export const Race: ResourceDef
```

## Steps

- [x] 1. This plan (first commit).
- [x] 2. Workspace: red F1 test for a `starters/` package, then scan it; red workspace-scripts test for the starter's
  sim folder, then add it to `boundaries`; `starters/*` in the workspace; the starter's manifest and configs.
- [x] 3. Tuning schema and placeholder content: red on a bad tuning, then the schema.
- [x] 4. Course generator: red tests (start floor fixed, gap, bounds, moving share, prefix stability, pinned output
  for the placeholder seed), then the generator.
- [x] 5. Contacts: red tests (top, side, underside, the approach test, the foot band, tolerance, sort order), then
  `contacts.ts`.
- [x] 6. Race start: red test (`race.start` spawns the floors and four racers at the spawn, racing phase, awaiting
  input), then the start system and plugin.
- [x] 7. The step: red tests one at a time (awaiting input stands still; the first input bounces; held steer moves
  and a release stops; a racer credits a floor on landing; a side contact lifts; a moving floor carries; fast fall
  overrides; wrap; death line respawns; reset is an edge; a lap respawns and holds; the race finishes with standings
  and a winner, and a finished race ignores input), then the rules and the step system.
- [x] 8. Golden: the scripted four-player race finishes with a winner; straight and restored mid-way agree; hash and
  event hash recorded from Node, then confirmed in Chromium, WebKit and Firefox (`test:parity`).
- [ ] 9. `SOURCE.md`, the execution log; PR (draft).
- [ ] 10. Self-review of the pushed diff; findings fixed test-first.

## Decisions for the Owner's veto

- **8b-D1:** contacts are classified from geometry after the Rapier step (the smaller gap axis is the face), because
  `physics2d` exposes collision events but no contact normals. A manifold query in `physics` would be a physics change
  (its spec is M2.1's) and is not needed for the golden.
- **8b-D2:** a racer's lock on rotation is a reset of rotation and spin before each physics step; `RigidBody2D` has no
  `lockRotations`. Not in motion is a `kinematicPosition` body, not an inactive one.
- **8b-D3:** the course uses core's RNG (`createRng`, `deriveSeed`), not FloorFifty's SplitMix32: one RNG in the
  workspace. The same seed gives a different course from FloorFifty's.
- **8b-D4:** placeholder tuning in metres, chosen so that a bounce clears a floor gap (FloorFifty's climb depends on
  wall-riding with a 2 px margin) and a fast fall cannot pass through a floor in one tick (Plus physics has no CCD
  flag).
- **8b-D5:** `race.start` is a sim command (the room sends it, 8c); input is held state per seat, set by `race.input`,
  and a reset is its own command, `race.reset`, so the edge rule needs no sequence numbers in the sim.

## Execution log

| Date | Step | Evidence |
|---|---|---|
| 2026-10-30 | 2 | Red: the F1 test for a `starters/` package found nothing (`expected [] to deeply equal [ Array(1) ]`); the workspace-scripts test did not find `starters/party-racer/src/sim` among the boundaries roots. Green after the scan and the root. |
| 2026-10-30 | 3–5 | Red on the missing modules, then green. One test fixed, not the code: `courseBounds` is `9.6 - 2.4 = 7.199999999999999` in IEEE doubles, so the test computes it the same way; the tolerance edge case moved inside the tolerance for the same reason. Course golden `b92243c1c7556cad` recorded from Node. |
| 2026-10-30 | 6–7 | 16 plugin tests red on the missing module, then 14 green, 2 red. Both were the tests' assumptions, checked by tracing the trajectory: near floor 1 Rapier's position correction still moves a racer whose `vx` is 0, so "stops dead" runs in open air; a landing sinks up to one tick's fall before the bounce leaves, so "never below" allows `bounceVelocity / 60`. `SPAWN_Y` is compared as an f32. |
| 2026-10-30 | 8 | Golden red on `pending`, then recorded from Node: 530 ticks, hash `9c5d87536ffe7a28`, events `0d03c77b48a5bb6a` (187), seat 0 wins. Straight and restored at tick 260 equal. `pnpm test:parity` in `starters/party-racer`: Chromium, WebKit and Firefox (Playwright 1.63.0, this container) all match, the course hash too (6 of 6). |
