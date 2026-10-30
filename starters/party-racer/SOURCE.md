# Source: the Party Racer race sim

- **Ported from:** FloorFifty (`mcthaydt/floorfifty`) at `677d4568b7b2265fda4246d711065b8f417cac26`, the commit
  PRODUCT.8a measured. Read only; nothing in FloorFifty changed.
- **Task:** PRODUCT.8b (`docs/superpowers/plans/2026-10-30-product8b-race-sim.md`).
- **What moved:** the behaviour, rewritten onto the AF sim (Koota components, commands, events, a resource) and
  `@mcthaydt/automata-physics/2d` (Rapier 2D deterministic-compat) in place of Planck. No FloorFifty file was copied.
  FloorFifty's source tests were written against its `RaceState` and Planck world, so they do not run here; the cases
  they cover for race mode are rewritten in `src/sim/*.test.ts`.

| FloorFifty file | Here |
|---|---|
| `packages/shared/src/level/course.ts`, `level/rng.ts` | `src/sim/course.generator.ts` (core's RNG, 8b-D3) |
| `simulation/planck/world.ts` | `src/sim/race-start.system.ts` (bodies), `race-step.system.ts` (push, pull, drive) |
| `simulation/planck/facts.ts` | `src/sim/contacts.ts` (geometry instead of the manifold, 8b-D1) |
| `simulation/planck/consequences.ts` | `src/sim/race-step.system.ts` (`applyContacts`, `applyCarry`) |
| `simulation/planck/config.ts`, `units.ts` | `src/sim/race-rules.ts` (groups, materials); metres throughout |
| `simulation/input.ts` | `src/sim/race-input.system.ts`, `race-step.system.ts` (`prePhysics`) |
| `simulation/platforms.ts` | `src/sim/race-rules.ts` (`advanceFloor`) |
| `simulation/collision.ts`, `players.ts` | `src/sim/race-rules.ts`, `race-step.system.ts` (wrap, death line, respawn, credit) |
| `simulation/step.ts` (race mode) | `src/sim/race-step.system.ts` (`resolveLaps`) |
| `simulation/planck/planck-simulation.ts` (tick order) | `src/sim/race-step.system.ts` (header comment) |
| `common/tuning.ts` (race-mode subset) | `src/sim/tuning.schema.ts`; values are placeholder content in `src/content/` |

Not ported (other modes or later rows): `simulation/endless.ts`, `survival.ts`, `level/steering.ts`,
`level/tutorial.ts`, `level/demand.ts`, the ramp bands in `course.ts`, and the invariant asserts (a non-finite value
already faults the sim: every f32/f64 field refuses one).
