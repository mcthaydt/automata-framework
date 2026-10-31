# GAME-3D.1e: items, the inventory, the map and the HUD (plan)

> **Task:** GAME-3D.1e in [02 Master delivery plan](../../02-master-delivery-plan.md).
> **Design:** [`games/base-3d/DESIGN.md`](../../../games/base-3d/DESIGN.md) §9 (items, aim, inventory, map, HUD), §8.1
> rule 6's pellets-and-bombs drop row, §7.8 (hearts), §20 row 1e; acceptance case G3-o and "the map and HUD DOM tests".
> Moved here from 1d (#324): the boss bar and the lock reticle's pulse on a token holder. Carried from 1c: the save's
> `hearts.max` (3) against §7.8's 4 hearts, and the sim's `HERO_HEALTH` not reading the save.
> **Lane:** 3D. **Branches:** `claude/3d-game-3d-1e` (part 1) to `-1e-5`, worktree `/home/user/wt/game-3d-1d`
> (reused), stacked on `claude/3d-game-3d-1d-4` (#324) at `94521116`. One push per part (the PC runner's queue).
> **Spec and plan acceptance:** the Owner, 2026-10-30: "Auto accept all spec and plans"; 2026-10-31 (via the
> coordinator): "everything is auto approved and accepted, do not wait on me to do any approvals".

## What already exists (verified, not rebuilt)

- The save's `items { sling, bombs, hookchain }`, `ammo { pellets, bombs }`, `equipped`, `hearts { max, pieces }`
  (state/save.ts); `Progress.embers` applied into the sim (screens/saves.ts).
- `MoveHit.pellet` and the Warden's `opening` (a pellet in the inhale), `MoveDef.downed` (a power-3 hit in the
  charge), the Wisp's `grounded` (a hit while it hovers), and the stand-in moves in boss.test.ts and enemies.test.ts
  that play the pellet and the bomb (1d).
- Lock-on (`hero.lockTarget`), `mapStick` through the heading, `ringHits`, `reachHits`, `lineOfSight`, `slide`.
- `act { slash, guard, point, pickup, action }` (commands.ts); 1h splits it into §14.1's commands.

## Scope, in five parts (one PR each, stacked)

1. **The Spark Sling and the aim (sim).** `act.item`; the aim of §9.2 option C (the lock target, else the stick
   through the heading, else the facing); hold Item to draw (8 ticks), release to fire; a `pellet` entity flying
   20 m/s for at most 15 m, stepped each tick against walls and hurt cylinders, its height picked as the nearest foe
   within ±6° of the aim line and in range (at its hurt cylinder's middle), else chest height; a pellet hit is a
   `pellet` hit (the Wisp grounds, the Warden's mouth opens) and stuns a Sootling 60 ticks; ammo (30 at most) spent
   per shot, none fired at 0. `Inventory` resource (owned items, equipped, ammo), applied from and captured to the
   save. G3-o's sling half (the target pick; 1f's `sling-target` entities join the same pick).
2. **Ember Bombs (sim).** Item with bombs equipped places a bomb at Wick's feet (10 at most); a 120-tick fuse, then a
   blast ring of 1.6 m, unblockable, power 3 (an Ash Knight and the Warden's charge go down), which hurts Wick too
   (1). The drop table's pellets-and-bombs row: a roll that would give embers gives 5 pellets or 2 bombs when Wick
   owns them and has under half his ammo.
3. **The Hookchain (sim).** Aimed as the sling; a chain ray at 12 m/s for at most 8 m: on a hook post (an area's
   `posts`, 1f's entity later) it pulls Wick to the post's foot at 10 m/s in a straight line, invulnerable; on a
   Sootling or a Wisp it stuns 90 ticks; on a wall it returns. Never through a wall (G3-o's hookchain half).
4. **The inventory (state and screen).** Hearts: `newGame` starts at 4 (§7.8), the sim's maximum health comes from
   the save (`hearts.max` × 2) through `Progress`, a recovery heart heals up to it; the Items screen (pause → Items):
   the five slots, ammo, equipping, the heart pieces, embers and the kiln's keys, focus as a grid (DOM tests).
5. **The HUD and the map.** Hearts in half steps (flash on hurt), embers, keys, the equipped item and ammo, the boss
   bar (the Warden's health, its localized name), the lock reticle pulsing while its target holds a token; the Map
   screen from the area's compiled geometry (visited rooms, Wick's arrow, the camera wedge), its 44 px Close and
   scroll region (DOM and layout tests).

## Part 1: interfaces

Produced (base-3d only; no package API changes):

| Name | File | Shape |
|---|---|---|
| `act.item` | commands.ts | the Item button, held; `ACTION_BITS.item` |
| `Inventory` | resources.ts | `{ sling, bombs, hookchain: boolean, equipped: 0 none, 1 sling, 2 bombs, 3 hookchain, pellets, bombs: count }` (the bombs count as `bombAmmo`) |
| `Pellet` | components.ts | `{ x, z, y, dirX, dirZ (Q12), travelled, owner }`: a pellet in flight |
| `ITEMS` constants | constants/items.ts (new) | draw ticks, pellet speed, range, aim half-angle, chest height, ammo caps, the Sootling's stun |
| `aimDirection`, `pickTarget` | systems/aim.ts (new, pure) | the plan aim of §9.2 and the target pick |
| `item.use`, `pellet.fly` | systems/items.ts (new) | prePhysics after `hero.act`; gameplay before `combat.hits` |
| `ShotFired` | events.ts | `shot.fired { item, x, z }` |
| save capture/apply | screens/saves.ts | the inventory both ways |

## Part 1: rules

1. Holding Item with the sling equipped and pellets left draws; the release after 8 or more held ticks fires (a
   shorter release does nothing). Wick turns to the aim direction when he fires.
2. The aim direction: the locked target's bearing; else the stick, through the heading (as the walk maps it), when
   it is pushed; else his facing.
3. The pick: of the foes whose plan bearing from Wick lies within ±6° (1,092 turn units) of the aim and whose
   distance is within 15 m, the nearest by distance (ties by lower id). The pellet flies at the pick's hurt-cylinder
   middle height (`lift + height / 2`); with none, at chest height (1.2 m).
4. A pellet moves 20 m/s (21,845 Q16.16 a tick) along its direction; a wall it would enter ends it; the first foe
   whose hurt cylinder its segment meets in plan and whose height band holds its height takes a hit (`pellet`,
   damage 1, power 1) and ends it; it ends after 15 m.
5. A pellet hit: the Wisp grounds (1d), the Warden's inhale opens (1d), a Sootling is stunned 60 ticks; otherwise
   the hit's damage and stun as any hit.

## Part 1: steps

- [x] 1. Tests for `aimDirection` and `pickTarget` (pure): lock wins, then stick, then facing; the ±6° and 15 m
      limits; the nearest wins; the height is the cylinder's middle, else 1.2 m.
- [x] 2. Tests for the sling in the sim: draw and fire (a release before 8 ticks fires nothing); the pellet's
      flight, wall stop and range; it drops a hovering Wisp; it opens the Warden's mouth (the boss.test stand-in
      replaced); it stuns a Sootling 60; ammo spent, none fired at 0; nothing with the sling unowned or unequipped.
- [x] 3. The inventory through the save: applied before tick 0, captured back (screens.dom.test or saves test).
- [x] 4. Goldens re-recorded with the explanation (the schema gains `act.item`, `Inventory`, `pellet`); the routes'
      states unchanged.
- [ ] 5. Gates: `pnpm format`, `TURBO_FORCE=true pnpm check`, base-3d `test:parity`, `build`, the base-3d e2e spec.

Parts 2 to 5 get their interfaces and steps here before their code, as part 1's.

## Execution log

**Part 1 (2026-10-31, branch `claude/3d-game-3d-1e`).**

- Red first: aim.test.ts failed on the missing module; items.test.ts's 8 cases on the missing `Inventory`; the key
  map's cases on the missing `item` field and `KeyR`.
- Two cases still failed after the first code, each for a real reason:
  - the test harness compiled worlds with Wick's moves only, so `sling-pellet` was not in the table and no pellet
    could land; the harness now defaults to the game's own move table (`BASE3D_SIM.content.moves`);
  - a pellet flew straight up the aim line and passed 0.4 m beside a Wisp the pick had chosen 4.8° off it (its
    radius is 0.3 m). §9.2 says the shot hits the target it picks, so the pellet flies at the picked foe's bearing
    in plan (`pickTarget` returns it; a new case pins it at 867 turn units), and Wick turns that way.
- A pellet is a fighter on Wick's side playing the one-frame `sling-pellet` move on every tick it flies, so
  `combat.hits` lands it through every 1c and 1d rule (the Wisp grounds, the Warden's mouth opens, a knight's shield
  blocks it from the front); it is spent on its first contact (by attacker, then defender, id) and its band is the
  height it flies at. boss.test.ts's pellet stand-in is replaced by the real sling.

**Defaults (part 1, for the Owner's veto):**

1. A pellet stuns any foe it hits 60 ticks (§9.1 names the Sootling); a knight's shield blocks one from the front.
2. Its last tick of flight may reach up to one tick's flight (0.33 m) short of 15 m; it never reaches past 15 m.
3. Two foes on one tick's flight: the lower id is hit, not the nearer (a pellet covers 0.33 m a tick).
4. The draw counts only while the sling is owned, equipped and loaded; Item is R on the keyboard (§14.2).
5. 1f's `sling-target` entities join `pickTarget`'s candidates; until then it picks among foes.

**Goldens (part 1).** `base-3d/golden-route` `1cc2582080223c43` → `9fad84dd7ebb29d1`; `base-3d/golden-fights`
`72f569192c8c293d` → `bf79815307dba14c`; `base-3d/golden-boss` `b36cb175b4bade73` → `28e5ff49a2269c98`. The
schema (`act.item`, `inventory`, `pellet`, `shot.fired`, two systems) and the content (the sling's move); nothing
fires the sling on the routes, and every other assertion is unchanged.
