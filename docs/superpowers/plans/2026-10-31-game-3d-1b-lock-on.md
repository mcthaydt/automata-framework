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
| `HeroControl.lockHold`, `lockCycle` (new) | components.ts | `bool` hold flag (kept when no command comes); `i32` this tick's cycle (0 none) |
| `LOCK_FALLBACK`, `LOCK_BREAK`, `LOCK_HIDDEN_TICKS`, `LOCK_ASSIST_LIMIT`, `LOCK_ASSIST_PER_TICK` | constants.ts | 6 m, 15 m, 60, 8,192 (45°), 546 (the cone's cos² 60° = 1/4 is written in `selectLock`) |
| `lockCandidates`, `selectLock`, `cycleLock`, `lineOfSight`, `angleOf`, `signedTurn` | systems/lock-target.ts (new, pure) | the selection math, testable without a sim; `angleOf`/`signedTurn` moved here from hero.ts (one copy) |
| `lockAssist` (new system) | systems/lock-on.ts | `lock.assist`, prePhysics after `lock.select` |

## Rules as implemented (DESIGN §11, with the interpretations recorded)

1. **Candidates:** every `target` within 12 m in plan (squared Q16 distances, exact) with a clear line in plan to
   Wick past the area's wall boxes (`lineOfSight`: an integer slab test, fractions compared by cross-multiplying,
   all products under 2^53). There are no levels yet, so "same level" is every target in the area.
2. **Cone and score:** the camera's forward is `mapStick({0, -127}, heading)`. A candidate is inside the ±60° cone
   when `dot > 0` and `4·dot² ≥ |d|²·|f|²`, on plan offsets truncated to 1/16 m (Q4) so every product stays exact.
   Angle rank compares `dot²·|d_b|²` against `dot_b²·|d|²` (larger cosine first), distance rank compares squared
   Q16 distances; a rank counts the candidates strictly better (equal values share a rank). The smallest `angleRank × 4 + distanceRank` wins; a
   tie goes to the lower entity id.
3. **Fallback:** an empty cone takes the nearest candidate within 6 m in any direction (tie: lower id).
4. **Recentre:** no candidate at all sets the heading to Wick's facing, only in a view with `rotate`; the view eases
   it (part 2). It never latches.
5. **Lock mode:** toggle: a press locks (or recentres), the next press releases, the button's release does nothing.
   Hold: a press locks, the release lets go (today's rule).
6. **While locked:** the stick maps through the Wick-to-target yaw (the lock axis) instead of the heading, so "stick
   right" circles the target and `moveDir` is −16,384 within a unit at every heading (G3-f). *Geometry:* facing in
   and stepping to his right carries him round the target in increasing turn units, which in this frame (turning to
   his right is decreasing units, components.ts) is anticlockwise seen from above; G3-f's "clockwise" cannot hold
   for a right strafe, so the test asserts the real direction and the wording is a veto item. With the
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

- [x] 1.1 Failing tests, `src/systems/lock-target.test.ts` (new): `lineOfSight` (clear, through a wall box, grazing
  a corner), `selectLock` cone/rank/score/tie-by-id/fallback/none (G3-e), `cycleLock` order and wrap with one and
  three candidates, both directions (G3-h). Expected failure: the module does not exist.
- [x] 1.2 Minimal `src/systems/lock-target.ts`; 1.1 passes.
- [x] 1.3 Failing sim tests in `src/game.test.ts` (`describe('lock-on (DESIGN §11)')`): toggle vs hold; recentre with
  no candidate (rotating and fixed view); camera turns ignored while locked and allowed after; G3-f at 8 headings;
  G3-g assist rate ≤ 546, stop at 45°, `latched` untouched, a view change while locked latches; break on 15 m, on 60
  hidden ticks (59 holds), on a gone target. Expected failure: `mode` is not in the `lock` schema, `lock-cycle` is
  not registered.
- [x] 1.4 Commands, components, constants, `lock.select` rewrite, `lock.assist`, `hero.move` lock-axis mapping,
  plugin registration, `main.ts` sends `mode: 'hold'` for now (part 2 reads the setting); 1.3 passes.
- [x] 1.5 Golden (G3-b part): the route keeps its held lock in `hold` mode (old behaviour still asserted:
  kiln tick, 50 locked ticks, action starts, end position) and gains a toggle press, a `lock-cycle` and a toggle
  release. Re-record the hash in Node with the reason; then parity in Chromium, WebKit and Firefox must match.
- [x] 1.6 Gates: `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm --filter base-3d test:parity` (three
  browsers), `pnpm build:demos`; no package exports change, so no api-report, changeset or agent-skills.

## Steps (part 2)

Branch `claude/3d-game-3d-1b-2` (worktree `/home/user/wt/game-3d-1b2`), stacked on `claude/3d-game-3d-1b`; draft PR
base `claude/3d-game-3d-1b`.

Interfaces (part 2; base-3d only, plus one optional render-pixi3d camera option; render-pixi3d is private):

| Name | File | Shape |
|---|---|---|
| `lockInput(map, cycleKeys)` (new) | screens/lock-input.ts | wraps the game's `InputMap`: every `lock` carries `mode`, a press of a cycle key (Q −1, E 1) sends one `lock-cycle` on its first tick, `seq` is `tick × 5 + n` with `lock-cycle` the fifth |
| `LockInput.mode`, `.cycle(dir)` | screens/lock-input.ts | the saved Lock mode (set when play enters and when Settings closes); a cycle queued for the next tick |
| `cycleOnDrag(tracker, input)` (new) | screens/lock-input.ts | a ui `DragTracker` that forwards to `tracker` and queues one cycle per drag once it has moved 40 px |
| `cycleOnFlick(input)` (new) | screens/lock-input.ts | `(x) => void` for the right stick's x: one cycle past ±0.7, re-armed back inside 0.7 |
| `Pixi3dCameraOptions.easeHeading` (new, optional) | render-pixi3d camera/camera-driver.ts | `(curr, prev) => boolean`: this tick's heading change eases (`rig.heading(yaw, 'ease')`, 250 ms) instead of tracking |
| `recentred(curr, prev)` (new) | views.ts | true when the heading changed to Wick's facing with no lock before or after: a lock press with no target |

Interpretation: the sim already ignores `camera-turn` while locked (`rotate` is false) and `lock-cycle` while not,
so the input layer sends both for a Q/E press and needs no view state; a `lock-cycle` in an unlocked replay is a
no-op. `lock-cycle` is one tick's event, so the wrapper finds the key's first tick itself (the one edge in the input
layer; the held keys alone still decide every other command). The drag and the flick are written and tested here,
but base-3d has no camera drag surface or right-stick read until GAME-3D.1h (main.ts's header); 1h mounts
`cycleOnDrag` around its `CameraDragTracker` and feeds `cycleOnFlick` from its stick read.

- [x] 2.1 Failing tests. `screens/lock-input.test.ts` (node, new): the `lock` command carries `mode` (toggle and
  hold); Q's first tick sends `lock-cycle {dir: -1}` and the camera turn, its held ticks only the turn, a new press
  cycles again; E is dir 1; seq is `tick × 5 + n`; a queued `cycle` goes out on the next tick once; a drag cycles
  once past 40 px (either way, sign by direction) and again only after a new drag; a flick past 0.7 cycles once
  until the stick comes back inside. `game-spec.test.ts`: the page's input sends the saved mode (default toggle)
  and the cycle. `screens.dom.test.ts`: play takes the saved Lock mode on entry and after Settings changes it.
  `camera-driver.test.ts`: `easeHeading` true eases, false or absent tracks. `views.test.ts`: `recentred`.
- [x] 2.2 Implementation (lock-input.ts, main.ts, screens.ts, camera-driver.ts, views.ts); 2.1 passes.
- [x] 2.3 GameOverScreen and EndScreen: the action row centred under `ScreenFrame arrangement="stack"`, with a
  real-browser geometry check (left and right margins equal within 1 px at 844 × 390 and 390 × 844, the row at most
  26rem wide): `screens/screens.layout.test.ts` in a new `layout` vitest project (Chromium, WebKit, Firefox), which
  `test:parity` now runs beside `browsers`.
- [x] 2.4 Review images under `docs/evidence/owner-visual/2026-10-31-game-3d-1b/` with a README; gates as 1.6 plus
  the focused base-3d e2e specs.

## Gates

Selected: format, `pnpm check`, base-3d parity (Chromium, WebKit, Firefox), `pnpm build:demos`, focused e2e (part 2).
Omitted: api-report, api-index, agent-skills, changesets (no published package changes; base-3d is a private game).
Pending: the Mac's CI.

## Execution log

- 2026-10-31: plan written from DESIGN §11/§19/§20 and the parent branch at `02a69fcb`.
- 1.1: `lock-target.test.ts` written (16 cases); run failed with no tests collected because `./lock-target.ts` did not
  exist (the expected reason).
- 1.2: `lock-target.ts`; 16/16 pass.
- 1.3: 15 new sim cases in `game.test.ts` (`lock-on (GAME-3D.1b, DESIGN.md §11)`); the helper now sends `mode`
  (default hold, the old tests' meaning) and `lock-cycle`. Before 1.4, 33 cases failed on rejected commands (`mode`
  not in the `lock` schema, `lock-cycle` unregistered), the expected reason.
- 1.3, old cases changed on purpose (each with a comment in the test): the two-target lock now picks the target in
  the cone (it used to pick the nearer one 90° off); the tie case moved inside the cone (±30°); "faces the target"
  now walks at it on stick up (moveDir 0, was −16,384), because locked the stick maps through the lock axis.
- 1.4: implemented. Test corrections while making them pass (test bugs, not product changes): the 15 m case read
  the distance after the tick's move (the lock reads where the last tick left him); the D3-i case's target was
  close enough to walk past. G3-f's direction is the geometry note in rule 6.
- 1.4: `area.exit` clears `lockTarget` and `lockHidden` at the swap (rule 10). `main.ts` sends `mode: 'hold'`
  (Shift held, as before); `game-spec.test.ts` asserts it (failed first: the page module did not typecheck/load
  with the old payload).
- 1.5: golden re-recorded `d78ee833353d562f` → `9fd1aebdb8f26a81` (Node). Unchanged and still asserted: 0
  rejected, 0 events, kiln tick 118, the held segment's 50 locked ticks (62 with the toggle's 12), the action starts
  `1@278, 1@287, 3@348, 2@409` and the running point. Changed: the end pose (x 116,656, z 361,623, heading 6,556),
  because the held strafe now orbits the target and the assist turned the heading from 16,384 toward it.
- 1.6: `pnpm format`; `TURBO_FORCE=true pnpm check` exit 0; `pnpm --filter base-3d test:parity` 189/189 (game.test.ts's
  63 cases in Chromium, WebKit and Firefox, the golden `9fd1aebdb8f26a81` included); `pnpm build:demos` exit 0.
- Part 2 (2026-10-31, branch `claude/3d-game-3d-1b-2`): 2.1 `lock-input.test.ts` (8 cases) failed with no tests
  collected, `./lock-input.ts` missing (the expected reason); `game-spec.test.ts`'s 3 key-map cases failed on the
  lock's `mode: 'hold'` and the missing `lock-cycle`; `screens.dom.test.ts`'s Hold case failed with the lock kept
  after Shift's release (2 ≠ 0: the mode never reached the command), while Toggle passed (already the default);
  `camera-driver.test.ts`'s `easeHeading` case failed on `heading 90 track`. `views.test.ts`'s `recentred` cases
  were written before `recentred` but not run red on their own (the import would have failed); recorded, not hidden.
- 2.2: `lock-input.ts`, `main.ts` (`lockInput(inputs(...), { KeyQ: -1, KeyE: 1 })`), `screens.ts` (mode on play's
  entry and Settings' exit), `camera-driver.ts` (`easeHeading`, asked once a tick), `views.ts` (`recentred`). base-3d
  `test:unit` 140/140, typecheck clean; render-pixi3d `vitest run` 309 passed, 2 skipped.
- 2.2, interpretations: E is dir 1 and Q −1 (the previous lane's handoff); a drag or flick to the right is 1, as E.
  The drag and flick helpers are tested here and connected by GAME-3D.1h, which brings the camera drag surface and
  the right-stick read (base-3d has neither yet). `recentred` also eases a turn that happens to land exactly on the
  facing, which only smooths that one turn.
- 2.3: diagnosed in a production build: the row's boxes were symmetric (12 px each side at 844 × 390); the
  asymmetry was Continue's focus ring overhanging the full-width row's left gutter. `CentredActions.svelte` centres the
  row at `min(100%, 26rem)`. The layout test failed first in all three engines at 844 × 390 (812 > 416) and passed
  at 390 × 844; after the change 12/12.
- 2.4: review images and README in `docs/evidence/owner-visual/2026-10-31-game-3d-1b/` (a throwaway `screens.ts`
  patch reached the two screens; reverted, not committed).
- Part 2 gates: `pnpm format`; `TURBO_FORCE=true pnpm check` first failed on api-report's committed reports
  (`render-pixi3d.api.md`: the new `easeHeading` option), so `pnpm api-report --update` (one line added); then
  `pnpm build`, `pnpm api-index` (cheatsheet not stale), `pnpm agent-skills` (nothing to write), api-report's tests
  75/75, `pnpm --filter base-3d test:parity` 201/201 (game.test.ts's 63 cases and the 4 layout cases, each in
  Chromium, WebKit and Firefox; golden `9fd1aebdb8f26a81` unchanged), render-pixi3d `test:parity` exit 0,
  `pnpm build:demos` exit 0, the re-run `TURBO_FORCE=true pnpm check` exit 0, and the base-3d e2e specs
  (`playwright test --project=base-3d`) 7/7. No changeset: render-pixi3d and base-3d are private.
