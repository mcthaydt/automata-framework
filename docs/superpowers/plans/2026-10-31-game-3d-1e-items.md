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
- [x] 5. Gates: `pnpm format`, `TURBO_FORCE=true pnpm check`, base-3d `test:parity`, `build`, the base-3d e2e spec.

## Part 2: Ember Bombs (interfaces, rules, steps)

Produced: `Bomb { x, z, fuse }` (components.ts); `BOMBS { fuse 120, radius 1.6 m, max 10 }` and the `bomb-blast`
move (constants/items.ts: one active frame, an `around` ring of 1.6 m, from the floor to 3.5 m, 2 damage, power 3,
unblockable; `MoveHit.wickDmg` 1, the damage it does to Wick); `bomb.fuse` (systems/items.ts, gameplay before
`combat.hits`); `bomb.blast { x, z }` (events.ts); `DropKind.pellets`, `DropKind.bombs` and `dropOf(roll, ammo)`.

1. A press of Item with bombs owned, equipped and in stock places a bomb at Wick's feet and spends one; one per
   press.
2. The fuse counts 120 live ticks; then the bomb plays `bomb-blast` once (a fighter on neither side, so it reaches
   both sides) and is gone. A power-3 hit knocks down anyone it reaches but the steady Warden (it downs the Warden
   only in its charge, 1d); it is unblockable, so a knight's shield does not stop it; Wick takes 1 (`wickDmg`).
3. The drop row (§8.1 rule 6): a roll that gives one ember gives 5 pellets instead when Wick owns the sling and has
   fewer than 15; a roll that gives five embers gives 2 bombs instead when he owns bombs and has fewer than 5.
   Taking them adds to the ammo up to its cap (30, 10).

- [x] 1. Tests: placing (ammo spent, one per press, none at 0, unowned or unequipped).
- [x] 2. Tests: the fuse's 120 ticks; the blast knocks a Sootling within 1.6 m down and leaves one at 2.5 m; it
      knocks an Ash Knight down from the front; it hurts Wick 1 and knocks him down when he stands in it.
- [x] 3. Tests: `dropOf` with ammo (the swaps and their limits); taking a pellet or bomb drop adds up to the cap.
- [x] 4. Goldens re-recorded with the explanation; gates as part 1's.

## Part 3: the Hookchain (interfaces, rules, steps)

Produced: `HOOKCHAIN { step 12 m/s, range 8 m, pull 10 m/s, post radius 0.4 m, stops 0.6 m from the post, stun 90 }`
(constants/items.ts); `Chain { x, z, facing, travelled, pulling, postX, postZ }` (components.ts); `AreaSource.posts`
(hook posts, metres; 1f's `hook-post` entity later); `chain.fly` (systems/items.ts, physics after `hero.move`);
`chain.hooked { x, z }` (events.ts). `aimDirection` and `pickTarget` are shared with the sling: the posts join the
foes as candidates (a post's height is its own; the chain ignores height).

1. Holding Item with the hookchain owned and equipped aims; letting go throws a chain along the aim (or at the picked
   post or foe), one at a time.
2. The chain flies 12 m/s, at most 8 m. Each tick: a wall across this tick's flight ends it (it returns); a post
   within 0.4 m of the flight hooks it; else the first foe whose hurt cylinder the flight meets stops it, and a
   Sootling or a Wisp is stunned 90 ticks (another foe only stops it).
3. Hooked, Wick is pulled in a straight line toward the post at 10 m/s until he is 0.6 m from it, with no hit landing
   on him (i-frames held), the stick ignored; then the chain is gone. The flight checked the line for walls, so the
   pull never crosses one.

- [x] 1. Tests: a post 5 m ahead pulls Wick straight to 0.6 m from it at 10 m/s, invulnerable, the stick ignored.
- [x] 2. Tests: a post behind a wall, or past 8 m, pulls nothing; the chain is gone.
- [x] 3. Tests: a Sootling or a Wisp it meets is stunned 90 (the Wisp on the floor); an Ash Knight only stops it.
- [x] 4. Tests: nothing with the hookchain unowned or unequipped; one chain at a time.
- [ ] 5. Goldens re-recorded with the explanation; gates as part 1's.

## Part 4: hearts from the save and the `equip` command (interfaces, rules, steps)

The screens of the old part 4 (the Items screen) move to part 5 with the HUD and the map: the default paused screen
has no seam for a game's buttons. The coordinator chose (c), 2026-10-31: Items opens with the I key and a HUD chip,
Map with M and the corner Map button, equipping with 1/2/3, all in base-3d with no copied framework screen. **Pause →
Items and pause → Map wait on GAME.PAUSE1** (a `paused.actions` extension slot in `@mcthaydt/automata-game`, the
coordinator's core lane; not built here).

Produced: `Progress.maxHealth` (half-hearts; resources.ts); `newGame` with 4 hearts (§7.8); `equip { item }`
(commands.ts, §14.1) and `item.equip` (systems/items.ts, input phase after `hero.input`).

1. `newGame` starts at 4 hearts (§7.8; was 3, the 1c follow-up). Applying a save sets the sim's maximum health to
   `hearts.max` × 2 and Wick's health to it (a loaded game starts full at the area entrance); capturing writes the
   maximum back as hearts. The game over's Continue still sets 3 hearts.
2. A recovery heart heals up to the maximum health, not the constant.
3. `equip { item }` equips an owned item (its code into `Inventory.equipped`) and drops any draw under way; an item
   not owned changes nothing.

- [x] 1. Tests: `newGame` has 4 hearts; applying 5 hearts gives Wick 10 half-hearts and a maximum of 10, captured
      back as 5; a heart drop heals up to it.
- [x] 2. Tests: `equip` equips the sling when owned, leaves the equipped item when bombs are not owned, and resets
      the draw.
- [x] 3. Goldens re-recorded with the explanation; gates as part 1's.

## Part 5: the HUD, the Items screen and the map (interfaces, rules, steps)

Split in three pushes, stacked (branches `claude/3d-game-3d-1e-5`, `-1e-5b`, `-1e-5c`; worktree
`/home/user/wt/game-3d-1e-5`): **5a** the HUD and the lock reticle, **5b** the Items screen and the 1/2/3 keys,
**5c** the Map screen. Presentation and screens only: no sim schema change, so the goldens stay as part 4 left them
(any change is a fault). Pause → Items and pause → Map still wait on GAME.PAUSE1.

### 5a: the HUD (§9.5) and the lock reticle (§8.1 rule 4)

Consumed: `Progress`, `Inventory` (resources.ts), `Hero`, `Fighter`, `Enemy` (components.ts), `ENEMIES`/`enemyOf`
(constants/enemies.ts), `ItemCode` (constants/items.ts); the play screen's `hud.overlay` slot
(`@mcthaydt/automata-game`, mounted with no props inside the visible region); ui's `InputMethodTracker`.

Produced:
- `screens/hud.ts`: `hudOf(sim): HudState` (`health`, `maxHealth`, `embers`, `equipped` `{ item, ammo? }` or none,
  `boss` `{ name, health, max }` or none), `heartsOf(health, max)` (one `'full' | 'half' | 'empty'` a heart), and
  `hudInPlay` (`{ sim }`, the running sim, set by the screens' `watchSim` as `settingsInPlay` holds the store).
- `screens/Hud.svelte`: reads `hudOf(hudInPlay.sim)` every animation frame while mounted; hearts (top inline-start),
  embers under them, the boss bar (top centre), the equipped item chip (bottom inline-end, not in touch mode: the
  Item touch button's face is 1h's). `pointer-events: none` throughout (the HUD is never a control, M4.12).
- `screens/hud.extension.ts`: `hudExtension` (`hud.overlay`), added to main.ts's `EXTENSIONS`.
- `views/enemies.ts`: `reticleOf(sid, components, lockedSid, ms)` (`undefined`, or `{ scale }`), drawn as a flat
  ring round the locked enemy's feet (deviation, see the log); `EnemyViewOptions.locked()` gives the hero's `lockTarget` sid (main.ts reads it from
  the hero row it already draws).

Rules:
1. Hearts: `maxHealth / 2` hearts (a half-heart rounds up); health 7 of 10 is 3 full, 1 half, 1 empty.
2. A drop in health flashes the hearts for 400 ms (presentation time; reduced motion keeps the flash, no shake).
3. Embers show always; small keys wait on 1f's kiln keys (no sim state holds them yet).
4. The equipped item: its name and, for the sling and bombs, the ammo (`Inventory.pellets`, `bombAmmo`); none
   equipped hides the chip.
5. The boss bar shows while a living Warden exists: its English name (the game has no message catalogue yet; the
   names sit in one map for the locale work), its health of `ENEMIES`' 24, as a `meter` with an accessible label.
6. The reticle shows over the enemy whose sid is the hero's `lockTarget`; while that enemy's `token` is set it pulses
   (scale 1 to 1.25, 400 ms), else it holds at 1. A dummy or no lock: no reticle.

- [x] 1. Tests (node, hud.test.ts): `heartsOf` half steps; `hudOf` on a started sim (4 hearts, 0 embers, nothing
      equipped, no boss), after the save's sling and 12 pellets (`{ item: 'sling', ammo: 12 }`), and with a Warden
      in a fight yard (`{ name: 'The Ashen Warden', health: 24, max: 24 }`).
- [x] 2. Tests (node, views/enemies.test.ts): `reticleOf` none unlocked, steady without a token, pulsing with one.
- [x] 3. DOM tests (screens.dom.test.ts, "the HUD"): the HUD on play shows the hearts, embers and the chip, flashes on a hurt,
      shows the boss bar with a Warden, and is not on paused.
- [x] 4. Layout tests (hud.layout.test.ts, 844×390 and 780×270, three engines): the hearts stay inside the visible
      region, nothing overlaps the corner Pause, the boss bar clears the hearts, and in touch mode the touch row is
      left to its buttons (the chip is not drawn there).
- [x] 5. Review images (docs/evidence/owner-visual/2026-10-31-game-3d-1e-5/): play with the HUD, with the boss bar,
      with the reticle; goldens unchanged; gates as part 1's.

### 5b: the Items screen (§9.3) and the 1/2/3 keys (§14.2)

Consumed: `Equip` (commands.ts) and `item.equip` (part 4); the save as play captures it (`game.saves.capture`, the
heart pieces and the kiln live only there); `hudInPlay` (5a); ui's `ScreenFrame` (its corner Back), `FocusNavigator`
and `arrowKeyNav` (`[data-focus-grid]` steers spatially).

Produced:
- `screens/items.ts`: `itemsOf(save, pending?)` (the five slots with `owned`, `equippable` and ammo against its most,
  the equipped item, heart pieces toward the next heart, embers, the kiln's keys, map and compass).
- `screens/copy.ts` and `copy.svelte.ts` (the #339 review's follow-up 1): the game's own words, one `Base3dCopy`
  record a language (`BASE3D_COPY`, English only so far; a language falls back to its base language, then English),
  and `liveCopy`/`followLocale`, which keep them in the runtime `Locale`'s language while play or Items is open, as
  DX.2d's `screensCopy` does for the default screens. The HUD (hearts, embers, Items, item names, the boss's name and
  bar) and the Items screen read them; `hudOf`'s boss row carries the boss's id, not its name.
- `screens/saves.ts` (the #339 review's follow-up 2): the applied slot is kept per sim, so a new game never carries
  what an earlier Continue applied.
- `LockInput.equip(item)` (screens/lock-input.ts): one queued `equip`, sent on the next tick; commands renumber
  `tick × 6 + n` (the equip sixth).
- `screens/ItemsScreen.svelte` and an `items` screen in screens.ts and BASE3D_FLOW (`play --items--> items`,
  `items --back--> play`, `pausesSim`).
- The HUD's Items button (44 px, under the embers; touch's way to swap, GAME3D-D16), `hudInPlay.openItems`, set by
  play while it is open.
- In play: I opens Items; 1, 2 and 3 equip the sling, the bombs and the hookchain (`input.equip`; the sim ignores an
  item not owned).

Rules:
1. Choosing an owned sling, bombs or hookchain slot asks for `equip` and marks it equipped at once (the sim is paused;
   the command goes on play's first tick). The sword, the shield and an unowned slot do nothing (`aria-disabled`).
2. Unowned slots are outlined and say so to a screen reader ("not found yet"); the equipped slot is marked
   (`aria-pressed`).
3. Arrow keys move focus over the grid (the screen's own listener, ui's `FocusNavigator`); Back (the corner button,
   Escape, the system back when standalone) returns to play.
4. The contents scroll inside a declared scroll region at compact height; the corner Back stays fixed; every slot is
   at least 44 px.
5. Defaults: 1, 2 and 3 are fixed keys (not yet in the rebindable map, M4.4); the gamepad's D-pad and LB wait on the
   menu-input seam (`driveMenu` is not exported from `@mcthaydt/automata-game`) and GAME-3D.1h; the kiln row shows
   in every area until the hub exists.

- [x] 1. Tests (node): `itemsOf` (slots, ammo, equipped, pieces, kiln, a pending choice); `lockInput`'s queued
      equip and the new numbering.
- [x] 2. DOM tests (screens.dom.test.ts, "the Items screen"): I and the HUD's Items button open it over a paused sim;
      it shows owned and outlined slots and the ammo; choosing the hookchain marks it and play's first tick equips it
      (the HUD's chip follows); Escape and Back return to play; 1, 2 and 3 in play equip owned items only. (The
      arrow keys' steering moved to the layout test: jsdom lays nothing out, so the grid has no boxes to steer by.)
- [x] 3. Layout tests (items.layout.test.ts, 844×390 and 780×270, three engines): slots at least 44 px, the corner
      Back fixed and in view, the contents inside the declared scroll region, nothing past the viewport outside it;
      the arrow keys steer the grid.
- [x] 4. Review images (844×390, 780×270) beside DESIGN §9.3; goldens unchanged; gates as 5a.

### 5c: the Map screen (§9.4)

Consumed: the compiled `Area` (systems/area.ts: `rooms` as plan boxes named by their view, `walls`), `Location.area`,
`Hero` (`x`, `z`, `facing`), `CameraHeading.heading`, the save's `kiln.visited` and `kiln.map` (as play captures it);
the copy (5b) and `hudInPlay` (5a).

Produced:
- `screens/map.ts`: `mapOf(area, at)` (`at`: Wick's place and facing, the camera's heading, the visited room ids and
  whether Wick has the map) → the plan in metres: its bounds, each room with `here`, `visited` or `outline` (an
  unvisited room shows only with the map; without it, it is left out), the walls, Wick's arrow and the camera's
  heading, both in degrees clockwise from +z (north up).
- `screens/MapScreen.svelte`: the plan as an SVG scaled to the container (north up, Wick's arrow, the camera wedge)
  inside a declared scroll region, a fixed 44 px Close (the frame's corner back, labelled Close), Escape closes.
- A `map` screen in screens.ts and BASE3D_FLOW (`play --map--> map`, `map --close--> play`, `pausesSim`); M opens
  it; a 44 px Map button at the HUD's top inline-end (`hudInPlay.openMap`). `base3dScreens` takes the `world`.

Rules:
1. A room is `here` while Wick stands in it, `visited` when its view id is in `kiln.visited`, else `outline` with the
   map and absent without it.
2. Wick's arrow points along his facing; the wedge (60°) along the camera's heading; turn units 0 is +z (map north)
   and grow toward +x (clockwise on the map).
3. The plan fills the container's width at most, keeps its aspect ratio, is never under 240 px tall, scrolls in its
   region when taller, and opens scrolled to Wick's arrow.

Defaults (for the Owner's veto): the Map button sits at the HUD's top inline-end under Pause, not in the frame's
corner row (the play screen has no seam for a game's corner controls; GAME.PAUSE1's kind of seam); doors, chests and
the boss mark wait on GAME-3D.1f's entities (nothing in the sim names them yet); visited rooms come from the save's
`kiln.visited` plus the room Wick stands in (no sim state records visits yet: 1f); the hub's own map waits on the hub.

- [x] 1. Tests (node, map.test.ts): the first slice's two rooms, the hall `here` at the spawn and the kiln absent
      without the map, `outline` with it, `visited` from the save; Wick's arrow and the camera's heading in
      degrees; the bounds.
- [x] 2. DOM tests (screens.dom.test.ts, "the Map screen"): M and the HUD's Map button open it over a paused sim;
      it draws the rooms and Wick's arrow; Close and Escape return to play.
- [x] 3. Layout tests (map.layout.test.ts, 844×390 and 780×270, three engines): Close 44 px, fixed and in view;
      the plan inside the declared scroll region and no wider than it.
- [x] 4. Review images beside DESIGN §9.4; goldens unchanged; gates as 5a.

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

**Part 2 (2026-10-31, branch `claude/3d-game-3d-1e-2`).**

- Red first: the 6 new cases failed on the missing `Bomb`, `BOMBS` and `dropOf`'s ammo argument.
- Two expectations in my own cases were wrong, not the rules: the blast's 2 damage beats a 2-health Sootling
  outright (the case now says so; the knight's case shows the knockdown), and a knight's chop on Wick holds the fuse
  through its hitstop (the fuse counts live ticks), so the knight's case steps to the blast's own tick instead of
  counting 120.
- A bomb is a fighter on neither side (`side: 2`) playing `bomb-blast` on its last tick, so `combat.hits` lands it on
  both sides through every existing rule (the Warden is steady except in its charge; a shield does not stop an
  unblockable hit). boss.test.ts keeps its bomb stand-in for the Warden's charge (a placed bomb would need the charge
  to cross it on its blast tick); items.test.ts covers the real bomb.

**Defaults (part 2, for the Owner's veto):** a blast does 2 to a foe and 1 to Wick (§9.1 names only Wick's 1), no
knockback (a ring has no one direction), hitstop 6; it knocks Wick down too (§7.2: "a power-3 hit or a bomb"); the
ammo row swaps the one-ember result for 5 pellets and the five-ember result for 2 bombs, below half (15 pellets,
5 bombs).

**Goldens (part 2).** `base-3d/golden-route` `9fad84dd7ebb29d1` → `a82292370d4f0a0c`; `base-3d/golden-fights`
`bf79815307dba14c` → `b8c81523f5712ca5`; `base-3d/golden-boss` `28e5ff49a2269c98` → `e44b61fb2e3004a9`. Schema
(`bomb`, `bomb.blast`, `bomb.fuse`) and content (the blast move); every other assertion unchanged.

**Part 3 (2026-10-31, branch `claude/3d-game-3d-1e-3`).**

- Red first: the 4 new cases failed on the unknown `posts` field and the missing `Chain`.
- One real fault after the first code: the chain's 24 steps left it 8 Q16.16 units short of 8 m, so it took one more
  full step and hooked a post at 8.6 m. Its last tick's flight is now cut at the range.
- The chain is its own sim entity, stepped in `chain.fly` (physics, after `hero.move`, which leaves Wick to the chain
  while it pulls). It does not go through `combat.hits`: it deals no damage, and its stun is set directly.

**Defaults (part 3, for the Owner's veto):** the throw needs only a press and release (no draw); a chain that misses,
meets a wall or stops on a foe is gone at once (its return is presentation); a hook post is hooked when its point lies
within 0.4 m of the flight, and the pull stops 0.6 m from it; the chain ignores height (§9.2: hook posts are targets);
posts are an area list until GAME-3D.1f's `hook-post` entities.

**Goldens (part 3).** `base-3d/golden-route` `a82292370d4f0a0c` → `ead70ed6a0084968`; `base-3d/golden-fights`
`b8c81523f5712ca5` → `b7d6c15114c2ba92`; `base-3d/golden-boss` `e44b61fb2e3004a9` → `c9d3f93da355ae54`. Schema
(`chain`, `chain.hooked`, `shot.fired`'s `hookchain`, `chain.fly`) and content (`posts`); every other assertion
unchanged.

**Part 4 (2026-10-31, branch `claude/3d-game-3d-1e-4`).**

- Red first: `newGame`'s 4 hearts, the save's hearts in the sim, and `equip` failed before their code.
- game.test.ts's two save cases compared the whole `progress` row, which gained `maxHealth`; they now include it
  (8, Wick's 4 hearts) and still assert the embers as before.
- The Items screen moved to part 5 (the paused screen has no seam for a game's buttons; asked the coordinator, default
  (c) in the part 4 section above).

**Defaults (part 4, for the Owner's veto):** a loaded game starts with full health at the area entrance (the game
over's Continue keeps its 3 hearts); the save's version stays 1, since `hearts.max`'s shape did not change, only the
new game's value (no build has deployed a save yet); `equip` runs on frozen ticks too (it changes no fight state).

**Goldens (part 4).** `base-3d/golden-route` `ead70ed6a0084968` → `94925b319d992b19`; `base-3d/golden-fights`
`b7d6c15114c2ba92` → `59b84ddde6bfeb94`; `base-3d/golden-boss` `c9d3f93da355ae54` → `de0bb982dcf6aa53`. Schema only
(`progress.maxHealth`, `equip`, `item.equip`); every other assertion unchanged.

**Part 5a (2026-10-31, branch `claude/3d-game-3d-1e-5`).**

- Red first: hud.test.ts on the missing module, `reticleOf`'s cases on the missing export, and the three HUD DOM
  cases ("timed out waiting for the HUD") with `hudExtension` left out of `EXTENSIONS`.
- `heartsOf` first clamped health to the rounded-up hearts (an odd maximum of 7 showed 4 full hearts); it clamps to
  the maximum now, as its case says.
- The layout case at 780 × 270 caught the boss bar (46% wide) over a full row of 10 hearts; it is now as wide as
  leaves a row of hearts and a gap clear on both sides, at most 22rem.
- The review captures caught three faults, fixed: the native `<meter>` drew a thin green line (now a styled bar,
  `role="meter"`); the figure branch still passed the old reticle argument after a formatter rewrap (NaN placement,
  no ring; typecheck would have said so, and now passes); `@pixi/3d`'s torus is built flat, so the quarter turn
  stood the ring up.
- Deviation: the reticle is a flat ring round the target's feet, not over its head: over a 3.2 m Warden's head it
  left the top of the view under the 25° camera. Its colour is cyan, apart from both danger colours.
- The HUD reads the running sim each animation frame (`hudInPlay.sim`, set in the screens' `watchSim`, as
  `settingsInPlay` holds the settings store): the `hud.overlay` slot mounts its component with no props.

**Defaults (part 5a, for the Owner's veto):** the reticle on the floor round the feet, cyan; the item chip only off
touch (the touch Item button's face is 1h's); the boss bar while any living Warden exists (1i's boss room will be the
only place one lives); the boss's name in English from one map until a message catalogue exists; the hearts flash
white-yellow for 400 ms on any loss of health; the HUD sits under the frame's corner row (the slot is the frame's
body).

**Goldens (part 5a).** Unchanged: route `94925b319d992b19`, fights `59b84ddde6bfeb94`, boss `de0bb982dcf6aa53`
(no sim change).

**Part 5b (2026-10-31, branch `claude/3d-game-3d-1e-5b`).**

- Red first: items.test.ts on the missing module; the two `lockInput` cases on the missing `equip`; the five Items
  DOM cases (the screen never opened, the button was missing, and 3 did not equip).
- The arrow-key case failed in jsdom for a reason of the harness, not the screen: `FocusNavigator.steer` walks a
  grid by its children's boxes, and jsdom gives every box 0 × 0. The steering moved into `ItemsScreen.svelte` (its
  own window listener) and its case into items.layout.test.ts, which runs in the three engines. That case and the
  layout cases were written after the move and passed first time: they check CSS and steering already in place.
- The first capture had no title; the frame's `header` now says "Items".
- `lockInput` numbers its commands `tick × 6 + n` (was 5): a sixth, the queued equip. The goldens send their own
  commands (testing/sim.ts), so they do not see this.

**Defaults (part 5b, for the Owner's veto):** 1, 2 and 3 are fixed keys (not in the rebindable map); a second ask
before the next tick replaces the first; the gamepad's LB and D-pad focus on the screen wait on GAME-3D.1h (the menu
input seam is not exported); the kiln row shows in every area; the sword and shield are shown owned and are not
choosable; the HUD's Items button sits under the embers in every input mode.

**Goldens (part 5b).** Unchanged: route `94925b319d992b19`, fights `59b84ddde6bfeb94`, boss `de0bb982dcf6aa53`.

**Part 5b, the #339 review's follow-ups (2026-10-31).**

- New game and the save. The default screens' New game captures a fresh sim and writes it; it applies nothing (the
  game package's own case pins this: its starting data is the fresh sim's, not `empty()`). `base3dSaves` kept one
  `applied` slot for every sim, so a Continue, Quit, Delete and New game wrote the old slot's heart pieces, kiln,
  flags and play time into the new game. That is why 5a's patched `newGame()` never showed: nothing applies it.
  Red first: saves.test.ts's second case (the fresh sim carried the flags and 9000 play ticks). Fixed in base-3d
  alone (a `WeakMap` by sim; a fresh sim captures over `newGame()`); its first case holds a fresh sim's capture to
  `newGame()` exactly, so the sim's defaults and `newGame()` cannot drift apart unseen. No framework change.
- The words. DX.2d's `ScreensCopy` (#312, on main, not under this stack) covers the default screens only; a game's
  own screens have no seam there. base-3d follows its way with its own record (copy.ts above). Red first:
  copy.test.ts on the missing module; hud.test.ts's boss case (an id, not a name); the HUD DOM case's live language
  change (it re-renders the boss's name in place, the HUD not remounted).

**Defaults (follow-ups, for the Owner's veto):** English only (the game has no translations yet; `fr-CA` falls back
to `fr`, then English); no pseudo-locale record (the pseudo-localizer lives in the content tooling, not the game's
bundle); the words are read live while play and Items are open, as DX.2d's screens do.

**Part 5c (2026-10-31, branch `claude/3d-game-3d-1e-5c`).**

- Red first: map.test.ts on the missing module; the two Map DOM cases (the screen never opened, the button was
  missing).
- The DOM cases then failed on a real fault: Svelte's `bind:clientWidth` needs `ResizeObserver`, which jsdom lacks,
  and the screen failed to mount ("Couldn't start the game"). The region is now measured by a guarded observer (no
  observer: the plan draws at its smallest).
- The first capture showed the paused game through the plan, and at 780 × 270 Wick's arrow scrolled out of view.
  The plan now has a panel under it, and a layout assertion (red first at 780 × 270 in all three engines) holds the
  arrow in view on open: the region opens scrolled to Wick.
- The HUD's layout case now covers the Items and Map buttons too (44 px, clear of Pause and the boss bar).

**Defaults (part 5c, for the Owner's veto):** the Map button at the HUD's top inline-end under Pause (no corner seam
for a game); M also closes the map; visits from the save plus the current room; the compass's marks, doors' lock
kinds and the hub map wait on GAME-3D.1f and the hub; the wedge is 60° and 2.5 m.

**Goldens (part 5c).** Unchanged: route `94925b319d992b19`, fights `59b84ddde6bfeb94`, boss `de0bb982dcf6aa53`.
