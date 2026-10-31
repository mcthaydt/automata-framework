# GAME-3D.1d: enemies and the boss (plan)

> **Task:** GAME-3D.1d in [02 Master delivery plan](../../02-master-delivery-plan.md): enemies and the boss.
> **Design:** [`games/base-3d/DESIGN.md`](../../../games/base-3d/DESIGN.md) §8 (enemies and the boss), §7 (the
> combat it builds on), §20 row 1d; acceptance cases G3-c, G3-l, G3-m, G3-n, G3-F7, and G3-F8's boss half (§19).
> Carried follow-up from 1c: the area swap does not despawn the old area's targets (1i's, taken here because the
> golden's fights need a second area).
> **Lane:** 3D. **Branch:** `claude/3d-game-3d-1d` (part 1), `-1d-2`, `-1d-3`, `-1d-4`, worktree
> `/home/user/wt/game-3d-1d`, stacked on `claude/3d-game-3d-1c-3` (#314) at `dd37d5b5`. Each part's draft PR is
> based on the part before it.
> **Spec and plan acceptance:** the Owner, 2026-10-30: "Auto accept all spec and plans"; 2026-10-31 (via the
> coordinator): "everything is auto approved and accepted, do not wait on me to do any approvals".

## What already exists (verified on the parent branch, not rebuilt)

- `Fighter` (components.ts) on Wick and on each training dummy (`side: 1`, a `target` row, no moves); `combat.freeze`,
  `combat.status`, `combat.moves`, `combat.hits` (systems/combat.ts). `combat.moves` already advances any fighter's
  running move and ends it after `total`; `combat.hits` already resolves a foe's hit on Wick: guard, parry (the
  attacker staggers 28, freeze 14), block, `low`, `unblockable`, hurt and i-frames, knockdown.
- `World.moves` (`compileWorld(areas, moves)`), `MoveDef`, `HERO_MOVES` (constants.ts). A foe's move is an index into
  `World.moves` + 1, as Wick's is.
- `hit.landed`, `foe.defeated` (events.ts). A foe at 0 health is despawned at the end of the tick.
- Lock-on picks among `target` rows (systems/lock-on.ts): anything with a `target` row is lockable (§8.1 rule 4's
  first half).
- `Progress.embers` (resources.ts), `slide` (systems/area.ts), `angleOf`, `lineOfSight` (systems/lock-target.ts),
  `facingVector`, `inArc` (systems/combat-geometry.ts). The sim's per-system RNG is `ctx.rng` (`int(n)`).

## Scope, split in four parts (one PR each, stacked)

**Part 1: the three types (sim).** The Sootling, the Ash Knight and the Wisp as fighters with deterministic brains,
the attack-token rule (§8.1), drops on the seeded table, the area's foes spawned with it and swapped with it, and a
golden segment in a second area that fights a Sootling and an Ash Knight (G3-b's "two fights", with a parry). G3-l,
G3-m.

**Part 2: the Captain (sim).** The Ash Knight Captain (D4): 14 HP, 2.1 m, the two-chop combo (windups 30 and 20), the
anger at half health (windups 4 shorter, one Sootling called at a time from the vents, at most 2 alive), its death
event (opens the doors and drops the Ember Bombs chest once 1f's doors and 1e's items exist: an event now).

**Part 3: the Warden (sim and its two shots).** Phases (24 to 13, 12 to 0), the slam's shockwave ring, the swipe, the
parried slam's 90-tick kneel with the grate open (×2), phase 2's breath cone, the inhale's mouth opening (a
`sling-pellet`-tagged hit during the inhale staggers it 120: 1e's pellet is the real source), the charge and a
power-3 hit in its path knocking it down 90; the boss door restart; the entry shot and the hearth shot (game code,
skippable, shortened under reduced motion); `boss.defeated`. G3-n, G3-c, G3-F8's boss half.

**Part 4: the look (presentation).** Placeholder figures and clips for each enemy and the boss (1j authors the real
ones), the windup's eye glow in the danger colours (§8.5), the ash burst on defeat, the reticle pulse on a token
holder (§8.1 rule 4), the boss bar (HUD), and G3-F7: a brain naming a missing clip logs one warning and keeps its
locomotion; content naming a missing clip fails the content check.

## Interfaces (part 1)

Consumed (unchanged): everything listed under "What already exists".

Produced (base-3d only; no package API changes):

| Name | File | Shape |
|---|---|---|
| `EnemyDef`, `ENEMIES`, `ENEMY_MOVES` | constants/enemies.ts (new; `constants.ts` becomes `constants/index.ts`, GL spec §300 lines) | `{ id, health, radius, height, lift, speed, turn, notice, reach, attacks: move ids, recover, shield?, grounded? }`; the moves `sootling-lunge`, `knight-chop`, `knight-bash`, `wisp-dive` from §8.2, a windup being the frames before `active` |
| `MoveDef.lunge` | constants | Q16.16 metres travelled along the facing over the active frames (the bite, the dive) |
| `Enemy` (new) | components.ts | `{ kind, brain, timer, token, attacks, homeX, homeZ }`; `brain` is `BrainState` |
| `Fighter.lift` | components.ts | the hurt cylinder's floor above the ground (a hovering Wisp, 2.2 m) |
| `BrainState` | constants | `idle, notice, approach, circle, attack, recover` |
| `Drop` (new) | components.ts | `{ x, z, kind, amount }`: an ember or a recovery heart on the floor |
| `DropTaken` (new) | events.ts | `drop.taken { kind, amount, x, z }` |
| `enemy.brain` | systems/enemies.ts (new) | prePhysics, after `combat.status`, before `combat.moves` |
| `drops.take` | systems/drops.ts (new) | postPhysics; `dropOf(roll)` (the table) |
| `AreaSource.foes` | systems/area.ts | `[{ kind, x, z, facing? }]` (degrees), default `[]` |
| `spawnFoes` | state/index.ts | the area's dummies and foes as spawn parts, for `spawnArea` and the swap |
| `KILN_YARD` | content/first-slice.ts | the second area (a Sootling, an Ash Knight), behind an exit in the kiln's north wall |
| test harness | src/testing/sim.ts (new; `testing/` is style-exempt) | `GAME_SIM`, `startSim`, `commandsFor`, `run`, `hero`, `openArea`, moved out of game.test.ts so enemies.test.ts shares them |

## Rules as implemented (part 1)

1. **Brains** (`enemy.brain`, sim, no RNG). Each tick, in id order, for each `enemy`:
   - A fighter in a held state (stun, blockstun, stagger, down, rise) gives up its token and returns to `approach`
     when it is idle again (§8.1 rule 3: an enemy that is hit loses its token).
   - `attack`: while its move runs it stands, facing fixed from the windup's first tick, and a move with `lunge`
     travels along that facing over the active frames. When the move ends it gives up the token and `recover`s for
     `recover` ticks, turning toward Wick.
   - `idle`: paces from home and back (1 m out over 60 ticks, 60 still, 60 back, 60 still) until Wick is within
     `notice` in plan with a line of sight, then `notice` for 20 ticks, turning toward him.
   - `approach`: turns toward Wick at `turn` units a tick. With the token, it walks to `reach` and starts its next
     attack (its `attacks` in order). Without one, it takes one when fewer than 2 enemies hold one (id order); else it
     `circle`s.
   - `circle`: keeps a ring 2.9 to 3.8 m from Wick (closer: backs off; farther: closes in; inside: strafes
     clockwise at half speed) and asks for a token each tick; never starts a windup (§8.1 rule 2).
   - Moves `slide` against the area's walls with the enemy's radius.
2. **Tokens.** Whether an enemy holds one is its `enemy.token`; the count is the number of `enemy` rows with it set.
   That is the "sim resource" of §8.1 rule 2 derived from the rows instead of stored twice (a deviation: one owner,
   no copy to keep in step when a foe is despawned).
3. **The Ash Knight's shield.** A hit on a knight that is idle (no move, not held) from inside its front 120° and
   not unblockable is blocked: no damage, `hit.landed { kind: 'block' }`, hitstop `BLOCK_FREEZE`. It turns at 150°
   a second, slower than Wick circles it at 1.5 m (§8.2 counterplay).
4. **The Wisp.** It hovers with `lift` 2.2 m, so the sword (top 1.5 m) misses. Its dive's active frames bring it down
   (`lift` 0). A hit that lands on it while it hovers grounds it: `stun` 120 with `lift` 0 (§8.2: the sling's pellet,
   1e; tests use a high-reaching stand-in move). A blocked lunge or dive stops: the attacker is stunned
   `BLOCK_STUN` and its move ends.
5. **Drops** (§8.1 rule 6). At a foe's defeat `combat.hits` rolls `ctx.rng.int(10)` once: 0–2 nothing, 3–6 one ember,
   7–8 five embers, 9 a recovery heart; a drop spawns at the foe's place. `drops.take`: Wick's centre within 0.6 m in
   plan takes it (embers into `Progress.embers`; a heart heals 2 half-hearts, up to `HERO_HEALTH`) and emits
   `drop.taken`. The pellets-and-bombs row waits for 1e's items (a follow-up).
6. **Areas.** An area lists `foes`; `spawnArea` spawns them, and the swap despawns every `target` and `drop` row of
   the old area and spawns the new area's dummies and foes.

## Steps (part 1)

Each step: the failing test first (run, confirm the reason), then the minimal code, then the focused run.

- [ ] 1. Move the sim test harness to `src/testing/sim.ts`; game.test.ts imports it (no behaviour change; the whole
      game.test.ts passes unchanged). Add `src/enemies.test.ts` to the `browsers` project.
- [ ] 2. `constants.ts` → `constants/index.ts`; `constants/enemies.ts` with `ENEMIES` and `ENEMY_MOVES`. Test: every
      enemy attack's windup is at least 24 ticks (G3-l's content half); every attack names a move in the table.
- [ ] 3. `foes` in `AreaSource`, `Enemy` and `Fighter.lift`, `spawnFoes`. Test: an area's foes spawn with their
      kind's health, cylinder and a `target` row (lockable).
- [ ] 4. `enemy.brain` idle, notice and approach. Tests: a Sootling paces at home and does not notice Wick at 6.5 m;
      it notices at 6 m, turns and walks to 1.6 m.
- [ ] 5. Attacks. Tests: the Sootling's bite lands 1 half-heart on Wick after a 30-tick windup; the lunge travels;
      Wick's block stops it (stunned, move ended); two slashes kill it (`foe.defeated`).
- [ ] 6. Tokens. Tests: three Sootlings round Wick: at most 2 hold a token on every tick, the third circles in the
      2.9–3.8 m ring and never starts a windup; a holder hit by Wick loses its token and the third takes it.
- [ ] 7. The Ash Knight. Tests: a frontal slash is blocked (no damage, a `block`), a slash from behind lands; a
      parried chop staggers it 28 and the next slash does double; the bash pushes Wick about 3 m, no damage.
- [ ] 8. The Wisp. Tests: a slash under it misses; a high stand-in hit grounds it 120 ticks and the sword then kills
      it; its dive lands on an open Wick and a block stops it.
- [ ] 9. Drops. Tests: `dropOf` maps 0–9 to the table; a defeat with a given seed spawns its drop; walking over an
      ember adds it; a heart heals and caps at 8.
- [ ] 10. The area swap clears and spawns. Test: through an exit, the old dummy is gone and the new area's foes stand.
- [ ] 11. The golden: the first slice's kiln gains an exit north to `kiln-yard` (a Sootling, an Ash Knight), off the
      old route; the route goes on through it and fights both (a block, a parry, both defeated). The old route's
      assertions hold unchanged; the hash is re-recorded with the explanation; at most 2 tokens on every tick
      (G3-l); the route's fights asserted (two `foe.defeated`, a `parry`).
- [ ] 12. Gates: `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm --filter @mcthaydt/base-3d test:parity`,
      `pnpm build:demos` if the page changed. No published package changes (no changeset).

## Execution log

(Filled in as the steps pass.)
