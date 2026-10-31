# GAME-3D.1f: the dungeon pieces (plan, draft)

> **Task:** GAME-3D.1f in [02 Master delivery plan](../../02-master-delivery-plan.md): "Keys and doors, switches,
> pushable blocks, one-way gates and the boss door, as game code (decision 7: not on M6's `puzzle` or `sectors`)".
> Lane sim, integration; after GAME-3D.1a. Size L.
> **Design:** [`games/base-3d/DESIGN.md`](../../../games/base-3d/DESIGN.md) §10 (every entity def, its fields and
> rule; what persists and what resets), §6.5 (the Cold Kiln's rooms and the order a player meets them), §7.8
> (falls), §9 (the items the pieces answer to), §12.1 (the save), §20 row 1f; acceptance cases G3-p, G3-q, G3-r,
> G3-F2, G3-F6.
> **Carried here:** from 1e, `sling-target` entities join `pickTarget`, `hook-post` entities replace
> `AreaSource.posts`, doors open on `captain.defeated`, the Ember Bombs chest, heart pieces raising `hearts.max`, the
> map's visits recorded in the sim and its chests, boss mark and door kinds; from 1d, the captain's arena doors.
> **Lane:** 3D. **Branches:** `claude/3d-game-3d-1f` (part 1) to `-1f-5`, stacked on the 1e stack (#342) or on
> `main` once it has landed. One push per part.
> **Status:** draft, written ahead of its parents (the coordinator, 2026-10-31: "draft the GAME-3D.1f plan if the
> spec allows"); its interfaces are checked again against `main` before part 1's code. **Spec and plan
> acceptance:** the Owner, 2026-10-30: "Auto accept all spec and plans"; 2026-10-31: "everything is auto approved
> and accepted, do not wait on me to do any approvals".

## What already exists (verified on the 1e stack, not rebuilt)

- Areas are `AreaSource` objects compiled by `compileArea` (systems/area.ts): rooms (plan boxes named by camera
  view), walls, targets, the ember, exits, pits, foes, vents and `posts` (the hookchain's stand-in list, 1e part 3).
- The af-sector/1 level format (packages/editor-3d/src/profile/af-sector): `entities: { def, id, x, z, ...fields
  }[]`, ids unique across a file; ED3D authors them (§4.7). GAME-3D.1i authors the Kiln in ED3D; until then the
  areas are hand-written `AreaSource`s.
- Sim: `Fighter`, `Enemy` (brains, tokens, drops), the items (`Inventory`, pellets, bombs as fighters, the chain),
  `Progress`, `Location` (area changes, the fall's return point), `combat.hits` (a bomb's blast, a pellet's hit).
- Save (state/save.ts): `flags: string[]`, `kiln { smallKeys, bossKey, map, compass, visited, bossDefeated }`,
  `hearts { max, pieces }`; base3dSaves keeps what the sim does not hold, per sim (1e part 5b).
- The HUD (5a), the Items screen (5b) and the map (5c) read keys, the map, the compass and visits from the save.

## Scope, in five parts (one PR each, stacked)

1. **Entities and loading (G3-F2).** `AreaSource.entities` in af-sector/1's shape (`{ def, id, x, z, ...fields }`),
   one Zod schema per def of §10's table (`constants/entities.ts`), refs checked (a door's `switch`, a switch's
   `targets`, an `entry`'s `portal`, a `one-way`'s `from`, a chest's `hidden`), and a load error naming the area and
   the JSON path (`entities[3].lock`) for an unknown def, an unknown `lock`/`kind`/`contents` or a dangling ref.
   Compiled into fixed point like the rest of the area. `hook-post` entities replace `posts` (the chain's rule
   unchanged); `sling-target` entities (height 0.5–3 m) join `pickTarget`'s candidates and take a pellet's hit.
2. **Doors and keys.** A `Dungeon` resource (the sorted ids of opened doors, opened chests, broken `cracked`,
   latched switches, visited rooms; small keys and the boss key, the map and the compass), applied from and captured
   to the save (`flags` and `kiln`). `door` entities block their box while closed (walls for `slide` and
   `lineOfSight`): `small-key` opens with Action when a key is held (the key is spent, the door saved), `boss-key`
   likewise with the boss key, `clear` when the room's enemies are gone (and on `captain.defeated` for the arena),
   `switch` while its switch is on. Rooms visited are recorded as Wick enters them (the map reads the sim, not only
   the save). The HUD's small keys (5a's follow-up) and the Items screen's kiln row read `Dungeon`.
3. **Switches and blocks (G3-F6).** `switch` kinds `plate` (on while a block or, when `latch`, Wick stands on it),
   `eye` (a pellet's hit), `lever` (Action); latching ones save. `block` entities pushed one 1 m cell per Push held
   30 ticks along the axis Wick faces most, never into a wall, a block, a closed door or a pit, never overlapping
   Wick; they reset to `home` on room entry unless their plate latched. What resets on room entry (§10): blocks,
   non-latching switches, pots, enemies but bosses (GAME3D-D17) and projectiles.
4. **Chests, pots, cracked, one-way, ledge-drop, npc, shop.** A chest opens with Action (the item-get pose and
   banner are 1k's presentation; the sim emits `chest.opened { id, contents }`), gives its contents (an item, a
   small key, the boss key, the map, the compass, a heart piece, embers) and saves; `hidden` chests appear when
   their ref holds. Heart pieces: every fourth raises `Progress.maxHealth` by 2 and `hearts.max` by 1. Pots break on
   a hit or a blast and roll the drop table; `cracked` goes for good on a blast; `one-way` passes from `from` only;
   `ledge-drop` drops one way to its sector; `npc` and `shop` are placed and answer Action with an event (their
   lines and stock are 1k's and the hub's).
5. **Checks and markers (G3-p, G3-q, G3-r).** The content check over every area (sling-target heights, hook posts
   reachable from a floor within 8 m in plan, every lock naming an existing key, switch or clear rule); a solver
   test over the compiled areas walking §6.5's order with the items held at each point (no small-key door can spend
   a key needed to reach another key); and each door kind's marker (keyhole, boss plate, bars, switch link) in a
   render test of the four kinds, with review images. The map draws doors' lock kinds, and with the compass the
   chests and the boss room's mark (5c's follow-ups).

## Interfaces (to confirm against `main` before part 1)

- Produced, sim (each a component, resource, command or event in its role file): `DungeonPiece` (an entity's def,
  its area-local id and its state), `Door`, `Switch`, `Block`, `Chest`, `Dungeon` (resource), `push` (Act's held
  bit, until 1h splits `act`), events `door.opened`, `chest.opened`, `switch.changed`, `block.moved`, `piece.broke`.
- Produced, content: `AreaSource.entities`, `constants/entities.ts` (the defs and their Zod schemas), and the
  content check (`checkArea`) the build and G3-p run.
- Consumed: `compileArea`, `slide`, `lineOfSight`, `pickTarget`, `combat.hits`' pellet and blast hits, the enemies'
  room membership, `Location`, the save's `flags` and `kiln`, `base3dSaves`.
- No framework change: decision 7 keeps the pieces in game code. A field af-sector/1 cannot hold is an ED3D request,
  not a copy of its codec.

## Rules (each a case first)

1. A closed door is a wall to Wick, foes, pellets, the chain and line of sight; an open one is nothing.
2. A small key is spent only by opening a small-key door; a door already open never spends one; keys count per
   dungeon (§6.5).
3. A latching switch stays on and saves; a non-latching one resets on room entry.
4. A block moves one cell after Push held 30 ticks, along Wick's dominant facing axis; blocked moves leave it in
   place (G3-F6); it never overlaps Wick.
5. Every persisted piece is restored from the save before tick 0 and captured back; a fresh sim captures none.
6. Determinism: every new system is in the sim's fixed order, uses no RNG but the drop table's, and the goldens
   re-record once per part with the change explained (the route's hash moves only where the first slice gains
   entities).

## Steps (per part: red first, then the code, then the gates)

- [x] Part 1: tests for each def's schema (a good entity of each def loads; an unknown def, `lock`, `kind` or
      `contents`, and a dangling ref fail with the area and JSON path, G3-F2); `hook-post` entities pull as
      `posts` did (items.test.ts's chain cases move onto them); a `sling-target` is picked and hit.
- [x] Part 2: door cases (each lock kind closed and open; a key spent once; the boss key; `clear` and the captain's
      arena; `switch` doors follow their switch); save cases (opened doors, keys and visits round-trip; a fresh sim
      has none); the HUD's keys and the map's visits from the sim (DOM).
- [x] Part 3: switch cases (plate by block, plate by Wick when latching, eye by pellet, lever by Action); block
      cases (a push, each blocked push, never over Wick, G3-F6); the resets on room entry.
- [x] Part 4: chest cases (each contents kind; hidden until its ref; a fourth heart piece raises the hearts); pot,
      cracked, one-way and ledge-drop cases; npc and shop answer Action.
- [x] Part 5: G3-p's content check (a failing area per rule); G3-q's solver over the Kiln as it stands (the first
      slice plus the test areas until 1i authors D1–D7; re-run when 1i lands); G3-r's render test and images; the
      map's door kinds and compass marks (DOM and layout).

## Failure and recovery

- A bad area fails the load with its file and JSON path (G3-F2), at build and at boot, never at play.
- A save naming a piece the area no longer has keeps the flag (unknown flags are kept, §12.1) and changes nothing.
- A block pushed where it cannot go stays; a door that cannot open says why through its marker, never silently.

## Defaults (for the Owner's veto)

1. Until 1i, the Kiln's pieces are written into `AreaSource.entities` by hand in af-sector/1's shape, so 1i's files
   replace them without a format change.
2. Push is Act's held `pickup` bit in the sim until 1h splits `act` (§14.1 names no separate `push` command).
3. Persisted ids are `<area>/<entity id>` strings in the save's `flags`; the sim holds them as sorted area-local
   indexes.
4. The item-get pose and banner, npc lines and shop stock are presentation and content for 1k and the hub; the sim
   emits the events now.

## Execution log

**Part 1 (2026-10-31, branch `claude/3d-game-3d-1f`, local until #340 and #342 merge; the coordinator, 2026-10-31:
"start 1f part 1 on the 1e stack (from f1a7573e), local commits only, TDD, and don't push until #340 and #342 have
merged").**

- Red first: systems/entities.test.ts's 7 cases (no `entities`, no `AreaLoadError`); dungeon.test.ts's 3 cases (no
  `SlingTarget`). items.test.ts's chain cases moved onto `hook-post` entities and still pass unchanged.
- Produced: `constants/entities.ts` (`ENTITY_DEFS`, one strict Zod schema per §10 definition new in 1f, and
  `CHEST_CONTENTS`); `AreaSource.entities`, `Area.entities` (lengths in Q16.16) and `AreaLoadError` (`area`, `path`)
  in systems/area.ts; `Area.posts` from the `hook-post` entities; the `sling-target` component and
  `sling-target.hit` event; `spawnPieces` (systems/dungeon.ts), spawned with the foes on area start and swap; a
  combat rule: a sling target takes any hit without harm (a `hit.landed` for the sparks) and reports a pellet's.
- The sling target needs nothing new in the aim: as a living `target` and `fighter` on the foes' side it is already
  one of `pickTarget`'s candidates and lockable (§10), and a pellet flies at its middle, its height.
- G3-F2's "file" is the area's id until GAME-3D.1i loads af-sector files (the error carries both once a file does).

**Defaults (part 1, for the Owner's veto):** a box entity's size is `width` and `depth` in metres centred on `x`,
`z`, 1 m when not given (af-sector/1 holds a point and loose fields; ED3D's typed model may name them differently,
which is then a rename here); the area's spawn, foes, pits and exits stay their own lists until 1i; a block's home is
where it is placed (§10's `home` field is its `x` and `z`); a sling target's hurt cylinder is 0.3 m round and 0.5 m
tall around its height; a sword or a blast on it lands (sparks) but reports nothing.

**Goldens (part 1).** `base-3d/golden-route` `94925b319d992b19` → `ceedc79c82950861`; `base-3d/golden-fights`
`59b84ddde6bfeb94` → `7dd808482d9dd9bc`; `base-3d/golden-boss` `de0bb982dcf6aa53` → `61691d237e2d2427` (defeat on
tick 458, health 8, unchanged). Schema (`sling-target`, `sling-target.hit`) and content (`entities` for `posts`; the
first slice has none); every other assertion is unchanged.

**Part 1's two causes, measured apart (2026-10-31, the coordinator's golden item (a)).** In a scratch worktree at
225064cd, a throwaway patch left the compiled area's `entities` key out when it is empty (and `spawnPieces` read
`area.entities ?? []`), so the content had the shape it had before 1f (`posts: []`, no `entities`) while the schema
kept part 1's additions. Measured with `createSim(GAME_SIM).contentHash` and the three golden cases (node):

| | content hash | route | fights | boss (tick, health) |
|---|---|---|---|---|
| before 1f (225064cd~1) | `fef723a72fc674e0` | `94925b319d992b19` | `59b84ddde6bfeb94` | `de0bb982dcf6aa53` (458, 8) |
| part 1's schema only (patched 225064cd) | `fef723a72fc674e0` | `0399a92d8606ffaf` | `ab64111610077306` | `9e921e77802a71e4` (458, 8) |
| part 1 as committed (225064cd) | `d894381c47fd70d8` | `ceedc79c82950861` | `7dd808482d9dd9bc` | `61691d237e2d2427` (458, 8) |

So the schema (`sling-target`, `sling-target.hit`) moved each hash from its pre-1f value to the schema-only one, and
the content's new `entities: []` on each area (the content hash `fef723a7…` → `d894381c…`) moved it on to the recorded
one. With the patch reverted, the three cases pass on the recorded hashes at 225064cd. The content hash is
`d894381c47fd70d8` at 8c891db6 (part 2), 471d8bd0 (part 3) and ee67b1c8 alike: parts 2 and 3 moved the goldens through
the schema alone. History was not rewritten; the patch was never committed.

**Part 2 (2026-10-31, branch `claude/3d-game-3d-1f`, local).**

- Red first: dungeon.test.ts's 7 door and save cases (no `Door`, no `Dungeon`); hud.test.ts's keys cases; the HUD
  DOM case's keys label.
- Produced: the `door` component (its piece, `open`, its plan box), spawned closed with the area's pieces and
  despawned on an area swap; the `dungeon` resource (`flags` as sorted `<area>/<entity id>`, the small keys, the
  boss key, the map, the compass, the visited rooms by view id); `door.opened`; `wallsOf(ctx)` (systems/walls.ts):
  the area's walls and the closed doors, now read by every wall check (Wick's and foes' moves and pushes, line of
  sight, the lock, pellets, the chain); `dungeon.doors` (prePhysics, after `hero.act`): a door saved open opens, a
  `clear` door opens when no living foe stands in a room that holds its centre (the Captain's arena included: a
  beaten foe is not living), and a pick-up press within reach opens a `none` door, a `small-key` door with a key
  (spent) or the boss door with the boss key (spent); `dungeon.visit` (postPhysics, after `hero.view`); the save
  applies and captures the flags whole (unknown flags kept) and the kiln's keys, map, compass and visits; the HUD
  shows the small keys.
- game.test.ts's capture case now includes the room Wick stood in (`kiln.visited: ['open']`): the save records
  visits now, as intended.
- Not in part 2: `switch` doors follow their switch in part 3; the map still reads visits through the save's capture,
  which now comes from the sim.

**Defaults (part 2, for the Owner's veto):** doors open with the pick-up press (F, the build's interact verb) until
1h splits `act` (§14.1's Action also rolls); a `clear` door stays open once opened (saved); a `none` door is closed
until pressed; the boss key is spent by the boss door; the HUD shows the small keys in every area while the kiln is
the only one.

**Goldens (part 2).** `base-3d/golden-route` `ceedc79c82950861` → `a1c35d544c35e923`; `base-3d/golden-fights`
`7dd808482d9dd9bc` → `309c87cc6b57a8d2`; `base-3d/golden-boss` `61691d237e2d2427` → `7c36c7e4cc306eea` (defeat on
tick 458, health 8, unchanged). Schema only (`door`, `dungeon`, `door.opened`, two systems); no door stands in
these areas, and every other assertion is unchanged.

**Part 3 (2026-10-31, branch `claude/3d-game-3d-1f`, local).**

- Red first: dungeon.test.ts's 7 switch and block cases (no `Switch`, no `Block`).
- Two expectations in my own cases were wrong, not the rules: 120 ticks of pushing moves a block two cells (Wick
  walks the 1 m back to it and pushes again), so the one-cell cases push 60; and one fixture named a switch that did
  not exist.
- A real fault the fixture's fix found: an entity field given as `undefined` survived `compileArea` and broke the
  content's canonical-JSON hash. The compile now leaves such fields out (a case pins it).
- Produced: the `switch` and `block` components, spawned from the pieces and despawned on a swap; `switch.changed`
  and `block.moved`; `dungeon.switches` (prePhysics, before the doors): a latching switch saved on is on, a plate is on
  while a block's centre stands on it (or Wick, when it latches), a lever goes on with a pick-up press within reach;
  an eye goes on when a pellet hits a sling target naming it in `targets` (`slingTargetHit`, called by combat's sling
  target rule); a switch door is open exactly while its switch is on (the switch is what is saved); blocks are walls
  (`wallsOf`) and `dungeon.blocks` (physics, after `hero.move`) moves one a cell after the push is held 30 ticks flush
  against its face, along Wick's dominant facing axis, unless the cell holds a wall, a closed door, a block, a pit or
  Wick (G3-F6); on entering another room (`Dungeon.room`), its blocks go home unless on a latched plate, and its
  switches that do not latch go off.

**Defaults (part 3, for the Owner's veto):** a lever, like a plate, goes on and (unless it latches) back off on room
entry; an eye switch is lit only through a sling target that names it (§10's eye has no height of its own; the
target carries it); the push is the pick-up button held with the stick (until 1h's push); a switch's `targets` field
is a link for the editor and the door marker (G3-r), not a rule: doors name their switch.

**Goldens (part 3).** `base-3d/golden-route` `a1c35d544c35e923` → `520ebd09e49bf0da`; `base-3d/golden-fights`
`309c87cc6b57a8d2` → `979e36f60d306703`; `base-3d/golden-boss` `7c36c7e4cc306eea` → `9c78334797c5e035` (defeat on
tick 458, health 8, unchanged). Schema only; every other assertion is unchanged.

**Part 4 (2026-10-31, branch `claude/3d-game-3d-1f`, local; session_01QYLU1gPdfpqyJgh9oNhJpE).**

- Red first: dungeon-pieces.test.ts's 16 cases (no `Chest`, `Breakable` or `Gate`) and entities.test.ts's unknown drop
  table case (`entities[0].drop`). One expectation of mine was wrong, not the rule: Wick walks 4 m/s, so the hidden
  chest's case walks him 50 ticks, not 40, to stand where the chest would be.
- Produced: `chest`, `breakable` (a pot or a cracked wall) and `gate` (a one-way gate or a ledge drop) components,
  spawned with the area's pieces (`pieceParts`, systems/dungeon-pieces.ts) and despawned on an area swap; events
  `chest.opened { piece, contents }`, `piece.broke`, `ledge.dropped`, `npc.talk`, `shop.open`; `Dungeon.heartPieces`
  (applied from and captured to the save's `hearts.pieces`); `DROP_TABLES` (`pot`, §8.1 rule 6's table) for a pot's
  `drop`. `dungeon.pieces` (prePhysics, after the doors): a cracked wall the save broke goes; a chest shows once it has
  no `hidden` ref or its ref holds (a switch on, a door open, or its flag saved), opens from the save, or opens with a
  pick-up press beside it, giving its contents once (a key, the boss key, the map, the compass, `embers:N`, an item
  with a full bag, a heart piece: every fourth raises `Progress.maxHealth` by 2 and fills Wick to it) and saving its
  flag; an npc or a shop within reach of the press answers with its event. `dungeon.gates` (prePhysics): a one-way
  gate is open while Wick stands in its `from` room, a ledge drop while he stands anywhere but its `to` room, either
  while he is in it; leaving a ledge drop into `to` emits `ledge.dropped`. combat's rule: a hit on a breakable lands
  (sparks) and harms nothing; a pot breaks on any hit and rolls the drop table at its place, a cracked wall only on a
  bomb's blast, saved. `wallsOf` adds shown chests, standing breakables and closed gates; the lock and the sling's aim
  never take a breakable. On room entry, broken pots stand again (`resetPots`), except one that would stand on Wick.
  The shared plan helpers moved from dungeon.ts to systems/dungeon-common.ts (unchanged).
- The Ember Bombs chest: a chest `hidden` behind the Captain's arena `clear` door shows when the door opens (a case
  pins it); 1i places it in D4.

**Defaults (part 4, for the Owner's veto):** a chest is a wall once shown, and stays shown once revealed for the rest
of the area visit (an unopened one revealed by a non-latching switch hides again after a reload until its switch is
on); an item chest gives the item with a full bag (30 pellets, 10 bombs) and puts it on the Item button only when
nothing is there; the fourth heart piece fills Wick's health to the new maximum; the `pot` drop table is the enemies'
(§8.1 rule 6) with its ammo row; a pot or a cracked wall is a wall with a hurt cylinder (radius half its box's longer
side; 0.8 m tall, a cracked wall 3 m), never a lock or aim candidate, and a sword on a cracked wall sparks; a ledge drop
is a one-way passage into its `to` room (sector heights are 1g's; the landing is presentation's, from
`ledge.dropped`); the npc and shop are not walls and not lock candidates yet (§11.1 names NPCs to talk to: with 1k's
lines); the item-get freeze (§13's 90-tick cutscene) is 1k's with the pose and banner.

**Goldens (part 4).** `base-3d/golden-route` `520ebd09e49bf0da` → `7f9dd7df51a5c134`; `base-3d/golden-fights`
`979e36f60d306703` → `ba6fe5d1044ff0c8`; `base-3d/golden-boss` `9c78334797c5e035` → `7400e13e71871368` (defeat on
tick 458, health 8, unchanged). Schema only: the content hash is still `d894381c47fd70d8` (measured); every other
assertion is unchanged.

**Gates (part 4).** `pnpm exec automata-check-boundaries --game src`: 28 files, 0 findings. `TURBO_FORCE=true pnpm
check`: 35/35. base-3d `test:unit`: 337 passed. base-3d `test:parity` (Chromium, WebKit, Firefox): 30 files, 585
tests passed, the three goldens equal in every engine.

**Part 5 (2026-10-31, branch `claude/3d-game-3d-1f`, local; session_01QYLU1gPdfpqyJgh9oNhJpE).** Four commits.

- G3-p (red first: systems/area-check.test.ts, no `checkWorld`): `checkWorld(world)` (systems/area-check.ts) names
  each sling target outside 0.5–3 m, each hook post with no floor cell (0.5 m grid, in a room, in no pit or wall)
  within the chain's 8 m in plan with a clear line, and each door whose lock names nothing that opens it (as many
  small-key chests as small-key doors across the world, a boss-key chest, a foe standing in a clear door's rooms).
  `base3dSim` runs it and refuses a world that fails, naming each fault (so at boot and in every test of the game's
  sim). One fault of my own on the way: the first sampling took points on room edges, which a full-width pit's strict
  test let through; the floor is now sampled at cell centres with edges counted as pit or wall.
- G3-q (red first: dungeon-solver.test.ts, no solver): `solveWorld` (testing/solver.ts) joins rooms through the gaps
  their walls leave on a shared edge (at least Wick's width), through the pieces standing in a gap (a door by its
  lock, a cracked wall with bombs, a one-way gate or a ledge drop one way), and area exits to their entries' rooms;
  chests open as their rooms and `hidden` refs are reached; every order of opening the small-key and boss doors is
  tried, and a state with goals (every chest, the boss rooms) left and no door to open is a soft lock. It passes the
  shipped world and a two-key, boss-key test dungeon, follows a hidden chest, a switch door and a bombed wall, and
  finds the soft lock of a key spent on the wrong door and the chests a missing item or a one-way gate leaves out. Not
  yet modelled, with 1i's D1–D7: the pit crossings by hook post (D6) and stairs between levels (D5); the solver is
  re-run over the authored Kiln then.
- Map (red first: map.test.ts's two cases, `doors` and `chests` undefined): `mapOf` lists the doors of the rooms it
  draws (lock kind, open from the save's flags, a switch door's link to its switch) and, with the compass, every chest
  (open or closed) and the boss room's centre (the room a Warden stands in); `MapAt` gains `hasCompass` and `flags`,
  which screens.ts passes from the save. MapScreen draws them in §6.5's legend. The layout case (Chromium, WebKit,
  Firefox) was written after the Svelte change; it was then run with the change reverted and failed for the expected
  reason (no door marks), and passes with it.
- G3-r (red first: views/doors.test.ts, no `doorParts`): `doorParts` draws a closed door as a slab with its kind's
  marker (a keyhole plate on each face, a larger boss plate, three bars, a floor link to its switch), each kind in its
  own colour; `doorView(area)` draws each `door` row from them and hides it while open; main.ts registers it under
  `door`. Review images: docs/evidence/owner-visual/2026-10-31-game-3d-1f-doors/ (README sets each against §6.5 and
  §9.4, with the throwaway patch that placed the doors).

**Defaults (part 5, for the Owner's veto):** the content check runs at boot in `base3dSim` (G3-F2's "at build and at
boot": the build runs it once 1i's level files are compiled by the content step); small keys count across the world;
the solver is test code (testing/solver.ts) and, until 1i, opens a clear door from either side, lights an eye with the
sling, and treats blocks as pushable; the door view reads the first area's entities (main.ts draws one area until 1i's
area loading); a door's slab is a flat placeholder, 2.2 m tall, not drawn when open; the map's door and chest colours
are the HUD's Endesga 64 ones.

**Goldens (part 5).** Unchanged: no sim schema or content changed (the check reads the world; the views and the map
are presentation).

**Gates (part 5).** `pnpm exec automata-check-boundaries --game src`: 29 files, 0 findings. `TURBO_FORCE=true pnpm
check`: 35/35. base-3d `test:parity` (Chromium, WebKit, Firefox): 30 files, 588 tests passed, the goldens unchanged in
every engine. base-3d `pnpm build`: passes. Omitted: the base-3d e2e journeys (the shipped first slice has no pieces, so
play is unchanged; the boot check runs in every unit test that makes the game's sim).

**Cut by the 2026-10-31 rescope (session_01QYLU1gPdfpqyJgh9oNhJpE).** The Owner, 2026-10-31: "I think we overscoped
the 3D one a bit", then "Trimmed slice" (DESIGN.md §0). The coordinator: "remove the npc and shop entity defs,
`npc.talk`, `shop.open` and their tests in a new commit, rather than keeping them unused … If a piece has no use in
the 3 rooms, cut it the same way". §0.2's three rooms use chests, pots, cracked walls, switches (eye, plate), blocks,
doors (switch, small-key, clear) and hook posts, so these were cut from code and tests: the `npc` and `shop` defs and
`npc.talk`, `shop.open`; the `one-way` and `ledge-drop` defs, the `gate` component, `ledge.dropped`, the
`dungeon.gates` system, the area's room refs (only those two defs had them) and the solver's one-way passages; the
chest contents `heart-piece`, `Dungeon.heartPieces` and its save capture (the save's `hearts.pieces` stays in the
version-1 shape, always empty now). Kept in code, unplaced (built and tested in parts 2 and 3): the `lever` switch
and the `boss-key` lock. The cases that went with them: dungeon-pieces.test.ts's heart-piece, gate and npc/shop cases,
entities.test.ts's room-ref paths, and the solver's one-way case (its heart-piece fixture chest now holds embers).

**Goldens (the cuts).** `base-3d/golden-route` `7f9dd7df51a5c134` → `89a7944f44728902`; `base-3d/golden-fights`
`ba6fe5d1044ff0c8` → `bf08cd1a1fc23e74`; `base-3d/golden-boss` `7400e13e71871368` → `07e43ce75ab06a1a` (defeat on
tick 458, health 8, unchanged). Schema only (the components, events, system and resource field above left it); the
content hash is still `d894381c47fd70d8` (measured); every other assertion is unchanged.

**Gates (the cuts).** `TURBO_FORCE=true pnpm check`: 35/35. Boundaries: 29 files, 0 findings. base-3d `test:unit`:
350 passed. base-3d `test:parity` (Chromium, WebKit, Firefox): 30 files, 573 tests passed, the new goldens equal in
every engine.

**The Items screen's heart pieces (the rescope, after #342 was merged in).** 1e's Items screen showed heart pieces as
quarters; with heart pieces cut, the row, `ItemsView.heartPieces` and the copy's `heartPieces` and `piecesOf` went
(red first: items.test.ts expects no `heartPieces`). Unit 354 passed; the Items and xx-long layout runs, 51 passed in
the three engines. Goldens unchanged (presentation only).
