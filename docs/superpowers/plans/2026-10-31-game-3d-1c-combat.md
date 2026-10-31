# GAME-3D.1c: combat (plan)

> **Task:** GAME-3D.1c in [02 Master delivery plan](../../02-master-delivery-plan.md): combat.
> **Design:** [`games/base-3d/DESIGN.md`](../../../games/base-3d/DESIGN.md) §7 (combat), §7.8 (health and defeat),
> §14.1 (commands), §20 row 1c; acceptance cases G3-d, G3-i, G3-j, G3-k, G3-F1, G3-F8 (§19). Follow-up from #300:
> the game over's Continue (the area-entrance snapshot, with 3 hearts).
> **Lane:** 3D. **Branch:** `claude/3d-game-3d-1c`, worktree `/home/user/wt/game-3d-1c`, stacked on
> `claude/3d-game-3d-1b-2` (#307) at `6a2b9789`. Draft PR base: `claude/3d-game-3d-1b-2`.
> **Spec and plan acceptance:** the Owner, 2026-10-30: "Auto accept all spec and plans"; 2026-10-31 (via the
> coordinator): "everything is auto approved and accepted, do not wait on me to do any approvals".

## What already exists (verified on the parent branch, not rebuilt)

- `act { slash, guard, point, pickup }` (commands.ts), its bits on `hero-control` (`actHeld`, `actPressed`), and
  `hero.act` (systems/hero.ts): a slash press starts a 24-tick `slash` at once, replacing any action running; point
  and pickup start only when nothing runs; `guard` is a stance held with its button (`guard`, `guardSince` on
  `hero-action`).
- `target { x, z }` entities (the first slice's one lock target at 2 m, 9 m) and lock-on (1b).
- `hero.defeated` (events.ts) and the game over screen; nothing in the sim raises the event yet.
- The `slash` clip (content/figure-clips/slash.toml: 0.4 s, `windup` 0.096 s, `contact` 0.224 s) and the figures'
  `retime` (`FigureState.action.length`).
- No enemies: they are GAME-3D.1d. 1c's hits land on the targets, which become training dummies, and the tests spawn
  an attacker with a move already running (`sim.entity(sid).set`), so the defending rules are tested without AI.

## Scope, split in three parts (one PR each, stacked; the coordinator asked for focused PRs)

**Part 1: the sword and the shield (sim).** The fighter state, Wick's slash chain with buffering, hits against
hurt cylinders (once per move per target, same-tick trades in id order), block and parry, global hitstop, Wick's
health with `hurt` and its i-frames, and defeat at 0 (`knockdown`, then `hero.defeated`). G3-d (the sim's half: the
windows open on the table's ticks), G3-i, G3-j, G3-k, G3-F8 (the dummy's half). The golden changes (explained).

**Part 2: moving out of the way.** `spin` (hold Attack 40 ticks), `roll`, `hop-side`/`hop-back`, `knockdown`/`rise`
from a power-3 hit, `fall` and the pit return, and the game over's Continue: the area-entrance snapshot with 3 hearts
(the #300 follow-up). Commands stay `act` until 1h's command mapping; part 2 adds the Action button to `act`.

**Part 3: the look.** `hit.landed` drives shake and sparks (presentation, game code, off under reduced motion), the
moves' clips with `contact` on the active start (placeholder clips retimed from `slash` until 1j authors them), the
pose-space blend of a chain (`blend.inMs` 50), and base-3d's content check for G3-d/G3-F1.

## Interfaces (part 1)

Consumed (unchanged): `@mcthaydt/automata-sim` (`defineComponent`, `defineSystem`, `defineEvent`,
`defineResource`), render-pixi3d `/sim` (`mapStick`, `Q16`), lock-target.ts (`angleOf`, `signedTurn`).

Produced (base-3d only; no package API changes):

| Name | File | Shape |
|---|---|---|
| `MoveDef`, `HERO_MOVES` | constants.ts | `{ id, total, active: [from, to], window?: [from, to], next?, hit?: { near, far, low, high, dmg, stop, stun, kb, power, unblockable? } }`, Wick's `slash-1`, `slash-2`, `thrust` from §7.2 (ticks counted from 1, the source's frames). They move to content/tuning.toml with 1k (§17); a constant until then, as the other numbers in constants.ts |
| `Fighter` (new) | components.ts | `{ health, state, move, moveTick, stun, iframes, queued, hitBy, hitStamp, radius, height }`: one record for Wick and a dummy. `state` is `CombatState` (§7.1: idle, act, stun, blockstun, stagger, down) as a number; `move` is an index into the world's moves + 1 (0 none) |
| `CombatState` | constants.ts | the codes |
| `Freeze` (new resource) | resources.ts | `{ ticks }`: the global hitstop (GAME3D-D6) |
| `HitLanded` (new event) | events.ts | `hit.landed { attacker, target, kind: 'hit' \| 'block' \| 'parry', power, x, z }`: part 3's sparks and shake |
| `FoeDefeated` (new event) | events.ts | `foe.defeated { target }` |
| `World.moves` | systems/area.ts (`compileWorld`) | the world's move table: `HERO_MOVES` and anything a test (or 1d's enemies) adds; the sim reads moves only from content |
| `combat.freeze`, `combat.moves`, `combat.hits`, `combat.recover` | systems/combat.ts (new) | the order in "Rules" below |
| `reachHits`, `inArc`, `facingVector` | systems/combat-geometry.ts (new, pure) | the plan-view hit test on integers |

## Rules as implemented (part 1)

1. **Freeze first.** `combat.freeze` (input phase, after `hero.input`) counts `Freeze.ticks` down. Every other
   base-3d system and the camera-heading systems skip a tick with `ticks > 0` on entry (the camera ones through a
   read of `Freeze` in base-3d's own wrapper: render-pixi3d's `camera.turn` is skipped by refusing the turn, see
   rule 9). The input copy still runs, so `actPressed` is seen: a press during the freeze sets `Fighter.queued` (the
   buffer) and is spent on the first live tick (G3-j). Running actions' `startedAt` move on one tick per frozen tick,
   so the figure's clip holds (§7.5).
2. **Moves advance.** `combat.moves` adds 1 to `moveTick` of every fighter with a move. At `moveTick = total` the
   move ends (state idle), unless a queued slash starts the next. **Buffering:** an Attack press from `moveTick` 4 of
   a slash to the end of its window queues the move's `next`; it starts at the window's first tick (or at once, when
   the press comes inside the window). One press queues one move; `thrust` has no next, so three slashes end the
   chain. A press outside those ticks while a slash runs is dropped. Idle, a press starts `slash-1`. `hero.act`
   keeps point, pickup and the guard stance, and stops starting slashes (the old "a second slash replaces the first"
   case changes on purpose; the test says so).
3. **Hits gather, then resolve (G3-k).** `combat.hits` collects, for every attacker on an active tick, every
   defender whose hurt cylinder its reach meets (plan: the segment from `near` to `far` along the facing, within the
   defender's radius, on Q4 offsets so every product is an exact integer; height: the bands overlap), skipping a
   defender already hit by this move (`hitBy`/`hitStamp` = the attacker and its move's start tick) and one with
   i-frames. Then it applies them sorted by attacker id, then defender id, so two hits on one tick both land.
4. **Block and parry (G3-i).** Against Wick holding the guard, a hit from inside the 120° arc around his facing
   (the attacker's bearing within ±10,923 turn units) that is not `unblockable` and not `low` is a **parry** when
   `tick − guardSince` is 0 to 7 (frames 1 to 8 of `guard`) and a **block** otherwise. Parry: the attacker goes to
   `stagger` for 28 ticks, freeze 14, no damage. Block: Wick to `blockstun` 12, pushed 2.4 m/s back (0.04 m a tick
   for its 12 ticks, through `slide`), the attacker's freeze 4, no damage.
5. **A hit.** Damage in half-hearts (doubled on a `stagger`ed defender, which then leaves stagger), `stun` ticks
   (state `stun`), knockback as a push along the attacker's facing for the stun's ticks, `freeze = max(freeze,
   stop)` over the tick's hits. Wick hit: `hurt` (stun 18) then 60 ticks of i-frames counted from the hit.
6. **Defeat.** A dummy at 0 health emits `foe.defeated` once and is despawned; a second hit on the same tick does
   not apply again (G3-F8: the hits apply in order, and a defender at 0 is skipped). Wick at 0: state `down` for 40
   ticks (`knockdown`), then `hero.defeated` once.
7. **Wick's health:** 8 half-hearts (4 hearts, §7.8) on `Fighter.health`. A dummy: 6 half-hearts, radius 0.4 m,
   height 1.8 m (a training dummy; 1d's enemies declare their own). Wick: radius 0.3 m, height 1.6 m (§7.3).
8. **Movement while fighting.** `hero.move` does not move Wick in `stun`, `blockstun`, `stagger` or `down`, and
   walks at half speed while the guard is held (§7.2). Attacking does not stop the walk (the slash masks the arms).
9. **The camera under hitstop.** render-pixi3d's `camera.turn` is a package system; base-3d does not edit it. A
   frozen tick's `camera-turn` would still turn the heading, which is presentation-visible only (the heading is in
   the golden, so this is decided here): `combat.freeze` leaves it, and the PR records it as a veto item rather
   than reaching into the package. (Alternative for the veto: a `freeze` hook in render-pixi3d's heading plugin.)

## Steps (part 1)

Unit tests: `cd games/base-3d && pnpm vitest run --configLoader runner --project node <file>`.

- [ ] 1.1 Failing tests, `src/systems/combat-geometry.test.ts` (new): `facingVector` at the four quarters; `reachHits`
  (straight ahead inside the band, past `far`, short of `near`, beside the segment within and outside the radius,
  behind); `inArc` (±60° in, 61° out, exactly behind out).
- [ ] 1.2 `src/systems/combat-geometry.ts`; 1.1 passes.
- [ ] 1.3 Failing sim tests, `src/game.test.ts` `describe('combat (GAME-3D.1c, DESIGN.md §7)')`: each slash's hit
  window opens on its table tick and closes after its last (G3-d, sim half); a buffered press from tick 4 starts
  `slash-2` at the window's first tick, three presses end in `thrust` and a fourth is dropped; the dummy loses the
  move's damage once per move; two attackers hitting one defender on one tick both land, in id order (G3-k); a
  dummy hit to 0 by two hits on one tick is defeated once (G3-F8); a foe's hit on frames 1–8 of the guard is parried
  (stagger 28, freeze 14), on frame 9 blocked (blockstun 12, no damage), a `low` or unblockable one hurts (G3-i);
  hitstop freezes Wick's move, the dummy's stun and the area timers but not the freeze counter, and a press inside
  it starts the next slash on the first live tick in its window (G3-j); Wick hit loses health, is stunned 18 and
  cannot be hit again for 60; at 0 he goes down for 40 ticks and `hero.defeated` fires once. Run: they fail on the
  missing components and systems (record the reason).
- [ ] 1.4 Components, resource, events, `HERO_MOVES`, `World.moves`, `combat.ts`, the `hero.act` and `hero.move`
  changes; 1.3 passes, the old cases still pass or are changed on purpose with a comment.
- [ ] 1.5 Golden: the route's slash presses now run the chain and reach the dummy; re-record with the change
  explained, and keep asserting what did not change (0 rejected, the kiln tick, the lock segment's ticks, the action
  starts that still hold).
- [ ] 1.6 Gates: `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm --filter @af-games/base-3d test:parity`,
  `pnpm build:demos`, base-3d e2e (`--project=base-3d`).

## Steps (part 2) and (part 3)

Written in detail at the start of each part, from part 1's code, in this file.

## Gates

Selected: format, `pnpm check`, base-3d parity (Chromium, WebKit, Firefox), `pnpm build:demos`, base-3d e2e.
Omitted: api-report, api-index, agent-skills, changesets (base-3d is private and part 1 changes no package).
Pending: the Mac's CI.

## Execution log

- 2026-10-31: plan written from DESIGN §7, §7.8, §19, §20 and the parent branch at `6a2b9789`.
