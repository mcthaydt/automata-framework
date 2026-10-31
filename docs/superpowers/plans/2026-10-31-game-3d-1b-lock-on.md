# GAME-3D.1b: lock-on and camera framing (plan)

> **Task:** GAME-3D.1b in [02 Master delivery plan](../../02-master-delivery-plan.md): lock-on and camera framing (sim).
> **Design:** [`games/base-3d/DESIGN.md`](../../../games/base-3d/DESIGN.md) §11 (lock-on), §12.2 (Lock mode), §14
> (controls), §20 row 1b; acceptance cases G3-e, G3-f, G3-g, G3-h and part of G3-b (§19).
> **Lane:** 3D. **Branch:** `claude/3d-game-3d-1b`, worktree `/home/user/wt/game-3d-1b`, stacked on
> `claude/3d-game-3d-1a-flow` (#300) at `02a69fcb`. Draft PR base: `claude/3d-game-3d-1a-flow`.

## What already exists (verified on the parent branch, not rebuilt)

- `frame(lock)` wiring: `main.ts` passes `lock: lockPoint` (views.ts) to the camera driver, which calls
  `rig.frame(...)` (render-pixi3d `camera-driver.ts`, M3 §4.2). Head and chest aim rows: `heroFigureState` (views.ts)
  aims at the locked target's chest. Both are covered by `views.test.ts` and stay as they are.
- `lock.select` (systems/lock-on.ts): nearest target within 12 m on the press, held while the button is, released on
  release or when the target is gone. `Lock { down }` command; `lockHeld`/`lockPressed` on `hero-control`.
- The Lock mode setting (`game.lockMode`, `lockModeOf`, `LOCK_MODES` in screens/settings.ts) and its Settings section.

## Scope, split in two parts (one PR each, stacked)

**Part 1 (this PR's first commits): the sim.** Everything in DESIGN §11 that is sim state, so the golden covers it.
**Part 2: the input and view.** Lock mode from settings into the `lock` command, the cycle bindings (Q/E while
locked, touch drag 40 px, pad flick 0.7, mouse right-drag 40 px), the view's 250 ms ease on a recentre, the
game-over action row centring (follow-up from #300), and review images.

## Interfaces

Consumed (unchanged): render-pixi3d `/sim` (`CameraHeading`, `mapStick`, `moveDirection`, `enterView`,
`wrapHeading`, `TURN_UNITS`, `Q16`), `@mcthaydt/automata-sim` (`defineSystem`, `defineCommand`,
`defineComponent`), `@mcthaydt/automata-sim/math` (`atan2`).

Produced (base-3d only; no package API changes):

| Name | File | Shape |
|---|---|---|
| `Lock` (changed) | commands.ts | `{ down: boolean, mode: 'toggle' \| 'hold' }`: the player's Lock mode reaches the sim as command data, never as a settings read |
| `LockCycle` (new) | commands.ts | `lock-cycle { dir: 1 \| -1 }`: 1 the next target clockwise seen from above, −1 anticlockwise |
| `Hero.lockHidden` (new) | components.ts | `u32`: consecutive ticks the locked target has been out of line of sight |
| `HeroControl.lockMode`, `cycle` (new) | components.ts | `bool` hold flag; `i32` this tick's cycle (0 none) |
| `LOCK_FALLBACK`, `LOCK_BREAK`, `LOCK_HIDDEN_TICKS`, `LOCK_CONE_COS2`, `LOCK_ASSIST_LIMIT`, `LOCK_ASSIST_PER_TICK` | constants.ts | 6 m, 15 m, 60, cos²60° as 1/4, 8,192 (45°), 546 |
| `lockCandidates`, `selectLock`, `cycleLock`, `lineOfSight` | systems/lock-target.ts (new, pure) | the selection math, testable without a sim |
| `lockAssist` (new system) | systems/lock-on.ts | `lock.assist`, prePhysics after `lock.select` |

## Rules as implemented (DESIGN §11, with the interpretations recorded)

1. **Candidates:** every `target` within 12 m in plan (squared Q16 distances, exact) with a clear line in plan to
   Wick past the area's wall boxes (`lineOfSight`: an integer slab test, fractions compared by cross-multiplying,
   all products under 2^53). There are no levels yet, so "same level" is every target in the area.
2. **Cone and score:** the camera's forward is `mapStick({0, -127}, heading)`. A candidate is inside the ±60° cone
   when `dot > 0` and `4·dot² ≥ |d|²·|f|²`, on plan offsets truncated to 1/16 m (Q4) so every product stays exact.
   Angle rank compares `dot²·|d_b|²` against `dot_b²·|d|²` (larger cosine first), distance rank compares squared
   Q16 distances; ranks are dense (equal values share a rank). The smallest `angleRank × 4 + distanceRank` wins; a
   tie goes to the lower entity id.
3. **Fallback:** an empty cone takes the nearest candidate within 6 m in any direction (tie: lower id).
4. **Recentre:** no candidate at all sets the heading to Wick's facing, only in a view with `rotate`; the view eases
   it (part 2). It never latches.
5. **Lock mode:** toggle: a press locks (or recentres), the next press releases, the button's release does nothing.
   Hold: a press locks, the release lets go (today's rule).
6. **While locked:** the stick maps through the Wick-to-target yaw (the lock axis) instead of the heading, so "stick
   right" circles the target clockwise and `moveDir` is −16,384 within a unit at every heading (G3-f). With the
   assist holding the heading within 45° of that axis, "stick up" stays within 45° of away from the camera (D3-i's
   property). *Interpretation:* §11.2 says "through the heading"; mapping through the heading cannot give ±π/2 at
   every heading as G3-f requires, so the lock axis is used. Recorded in the PR as a veto item.
7. **Manual turn while locked:** `camera-heading.rotate` is false while locked (so render-pixi3d's `camera.turn`
   ignores turns, `turnCamera`) and is restored from the room's view on release.
8. **Assist:** while locked in a rotating view, when the target is more than 8,192 units off the heading as seen
   from Wick, the heading turns toward it by `min(546, |off| − 8,192)` a tick, so it stops at 45°. It never touches
   the latch.
9. **Cycling:** `lock-cycle { dir }` picks, among the candidates, the one with the smallest positive angular offset
   from the current target around Wick in that direction (clockwise = decreasing turn units), the current target
   counting as a full turn, so one candidate keeps itself and the order wraps (G3-h). Ties: lower id.
10. **Breaking:** the target is gone, is beyond 15 m, or has been out of line of sight for 60 consecutive ticks;
    the player releases (hold) or presses again (toggle); an area change (`area.exit` already moves Wick; the swap
    clears `lockTarget`). Falls do not exist yet.

## Steps (part 1)

Every unit test runs with `cd games/base-3d && pnpm vitest run --configLoader runner --project node <file>`.

- [ ] 1.1 Failing tests, `src/systems/lock-target.test.ts` (new): `lineOfSight` (clear, through a wall box, grazing
  a corner), `selectLock` cone/rank/score/tie-by-id/fallback/none (G3-e), `cycleLock` order and wrap with one and
  three candidates, both directions (G3-h). Expected failure: the module does not exist.
- [ ] 1.2 Minimal `src/systems/lock-target.ts`; 1.1 passes.
- [ ] 1.3 Failing sim tests in `src/game.test.ts` (`describe('lock-on (DESIGN §11)')`): toggle vs hold; recentre with
  no candidate (rotating and fixed view); camera turns ignored while locked and allowed after; G3-f at 8 headings;
  G3-g assist rate ≤ 546, stop at 45°, `latched` untouched, a view change while locked latches; break on 15 m, on 60
  hidden ticks (59 holds), on a gone target. Expected failure: `mode` is not in the `lock` schema, `lock-cycle` is
  not registered.
- [ ] 1.4 Commands, components, constants, `lock.select` rewrite, `lock.assist`, `hero.move` lock-axis mapping,
  plugin registration, `main.ts` sends `mode: 'hold'` for now (part 2 reads the setting); 1.3 passes.
- [ ] 1.5 Golden (G3-b part): the route keeps its held lock in `hold` mode (old behaviour still asserted:
  kiln tick, 50 locked ticks, action starts, end position) and gains a toggle press, a `lock-cycle` and a toggle
  release. Re-record the hash in Node with the reason; then parity in Chromium, WebKit and Firefox must match.
- [ ] 1.6 Gates: `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm --filter base-3d test:parity` (three
  browsers), `pnpm build:demos`; no package exports change, so no api-report, changeset or agent-skills.

## Steps (part 2)

- [ ] 2.1 Failing DOM/unit tests: the `lock` command carries the saved Lock mode; Q/E send `lock-cycle` while locked
  and `camera-turn` otherwise; a 40 px drag while locked cycles once per drag.
- [ ] 2.2 Implementation in `main.ts`/`screens/` and the touch layer; 2.1 passes.
- [ ] 2.3 The view's 250 ms recentre ease; GameOverScreen (and EndScreen if it shares it) action row centred, with
  a real-browser geometry check.
- [ ] 2.4 Review images under `docs/evidence/owner-visual/2026-10-31-game-3d-1b/` with a README; gates as 1.6 plus
  the focused base-3d e2e specs.

## Gates

Selected: format, `pnpm check`, base-3d parity (Chromium, WebKit, Firefox), `pnpm build:demos`, focused e2e (part 2).
Omitted: api-report, api-index, agent-skills, changesets (no published package changes; base-3d is a private game).
Pending: the Mac's CI.

## Execution log

- 2026-10-31: plan written from DESIGN §11/§19/§20 and the parent branch at `02a69fcb`.
