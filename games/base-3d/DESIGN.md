# base-3d: The Cold Kiln (design doc)

- **Status:** Drafted 2026-10-30 (task GAME-3D.0, branch `claude/3d-game-3d-0-design`, from `main` `30e9606c`). Docs only. **Waiting for the Owner's review**, which comes before GAME-3D.1. Every GAME3D-D decision (§22) holds its recommended default until the Owner vetoes it. The game-design reading in this doc (lock-on combat, dungeons, items, puzzles) is the agent's, and the review confirms or changes it.
- **Task:** GAME-3D.0 in [02 Master delivery plan](../../docs/02-master-delivery-plan.md). Plan: [2026-10-30-game-3d-0-design](../../docs/superpowers/plans/2026-10-30-game-3d-0-design.md).
- **Parents:** the [M3 spec](../../docs/superpowers/specs/2026-10-18-m3-3d-characters-design.md) (approved 2026-10-23): §4.2 camera, §4.4 figures, rig, poses and clips, §4.7 the first slice, §17 the direction brief, §18 the parity list. The [editor-suite spec (EDS)](../../docs/superpowers/specs/2026-10-30-editor-suite-design.md) and the [3D level editor spec (ED3D)](../../docs/superpowers/specs/2026-10-23-editor-3d-design.md) for the content formats. The [M4 spec](../../docs/superpowers/specs/2026-10-16-m4-input-display-design.md) for input and the touch overlay, including its §16 (M4.12, analog input), which is in PR #204 on branch `claude/3d-m4-12-analog-input` at `0b23f8ca` and not merged yet. The [M5 spec](../../docs/superpowers/specs/2026-10-16-m5-saves-audio-design.md) for saves and audio. [Art direction](../../docs/art/README.md).
- **Counterpart:** `games/emberwick`, the 2D base game. Emberwick has no design doc in its folder; its design is the [M1.8 base-2d spec](../../docs/superpowers/specs/2026-10-11-m1-base-2d-design.md). This doc follows that spec's shape and the headings that [01 Decomposition](../../docs/01-decomposition.md) §5 requires, and adds the game design.
- **Owner direction it serves** (the M3 spec's direction table has the message ids): "make the character action adventure like ocarina of time switch 2 remake, but use an angle like crow country for the 3D" and "procedural only for now" (2026-10-23 08:45); "25deg tilt, 5m distance is great … per pixel rotation … that's our base 3D game like our 2D platformer game - I want to do everything we did for 2D but for 3D with procedural character" (14:18); "3D ships 1.0" (14:18); "Visually it should match the 2D game too in terms of quality, use the editors" (14:21); "we launch when pixi 3D goes public" (14:49). **2026-10-30, decision 7:** `games/base-3d` is free and uses core only, like Emberwick.

## 0. Amendment: the trimmed slice (2026-10-31)

**The Owner's words** (2026-10-31, about 11:05Z, through the coordinator): "I think we overscoped the 3D one a bit".
Asked what scope the 1.0 base-3d game should have, the Owner chose **"Trimmed slice"**: keep the systems already
built, and cut the content to one short dungeon. The coordinator's brief: 3 rooms (an entry room, a puzzle room using
keys/doors plus the switch and block pieces, and the boss room with the Ashen Warden); no hub (Cinderford), no
townsfolk, no shop, no target minigame; 2 enemy types plus the boss; the items already built stay, each given a use in
the 3 rooms where that is cheap, otherwise off the required path; stair foot IK (GAME-3D.1g) out of 1.0; 1i, 1j and 1k
shrink to the 3 rooms and the reduced cast; in 1f, npc and shop are dropped, and the other part-4 pieces kept only
where the 3 rooms use them. Acceptance: the Owner, 2026-10-31: "Reminder that everything is auto approved and accepted,
do not wait on me to do any approvals".

**This section wins** over §2, §6, §8, §9, §10, §17, §19 and §20 wherever they disagree; each carries a one-line
pointer here. Every other section stands. Code already built stays unless a row below cuts it.

### 0.1 Goal and boundaries (replaces parts of §2)

- **Flow:** splash → menu → the Cold Kiln (3 rooms) → the Warden → end, with pause, settings, items and map. No hub,
  so New game and Continue start at the kiln's mouth (`resume: 'kiln'` always; the save's `'hub'` value stays legal in
  version 1 and is read as `'kiln'`).
- **Added exclusions:** the hub and its area change, townsfolk and talk, the shop and buying, the target minigame,
  heart pieces, ground-contact IK on stairs (GAME-3D.1g), stairs and two-level rooms, the mini-boss as content (the
  Captain's code stays), the Wisp as content (its code stays).

### 0.2 The 3 rooms (replaces §6.1, §6.4 and §6.5)

| Item | Count |
|---|---|
| Hub | none |
| Dungeon | 1: the Cold Kiln, **3 rooms** (R1, R2, R3) plus R2's niche, in one `af-sector` file |
| Boss | 1: the Ashen Warden (§8.4, unchanged) |
| Items | Sword and shield (start), the Spark Sling (R1), Ember Bombs (R2), the Hookchain (R2's niche) |
| Enemy types | 2: Sootling and Ash Knight |
| Collectables | Embers, recovery hearts, ammo refills; **no heart pieces** (Wick keeps 4 hearts) |
| Dungeon pickups | 1 small key, the map, the compass; **no boss key** (the boss door is the small-key door) |
| Save slots | 1 |

| Room | Size | Camera | Enemies | Pieces and pickups | Exits |
|---|---|---|---|---|---|
| **R1 Furnace Mouth** (entry) | 12×10 | Default | 2 Sootlings | Spawn by the south wall. 3 pots. The **Spark Sling** chest and the **map** chest. An **eye switch** (a latching `sling-target` 2.6 m up over the north door) opens the **switch door** to R2: the sling's first use | North (switch door) to R2 |
| **R2 Bellows Gallery** (the puzzle) | 14×12 | Default, bounds clamp | 1 Ash Knight, 2 Sootlings (at most 3 alive) | One **block** and a **latching plate**: on the plate, the **Ember Bombs** chest appears. The **compass** chest. A **cracked wall** on the east side closes **the niche** (2×3 m, its own view), which holds the **small key** and the **Hookchain**. A slag channel 4 m wide across the west end with **2 hook posts** leads to a ledge with an `embers:50` chest (optional: the Hookchain's use; a fall costs a half-heart, §7.8) | South to R1; north (the **small-key door**, the boss door) to R3 |
| **R3 Hearth Chamber** (the boss) | 11×11 (an arena) | `rotate: true`, bounds tight | The **Ashen Warden** (§8.4) | Its doors lock (`clear`) behind Wick until it falls; then the hearth, and the end screen | — |

**The solver's path (G3-q):** R1: the sling and the map → the eye switch (sling) opens the switch door → R2: the block
onto the latching plate shows the bombs chest; the compass → a bomb opens the cracked wall → the niche: the small key
and the Hookchain → (optional) hook post to hook post across the channel to the embers chest → the small key opens the
boss door → R3: the Warden. One small key and one small-key door, so no order of opening spends a key needed elsewhere.
Every built item has a use: the sling is on the required path (the eye, and the Warden's mouth), the bombs too (the
cracked wall, and the Warden's charge), the Hookchain only on the optional ledge.

### 0.3 Enemies (replaces §8.2's cast and §8.3 as content)

The 1.0 content places **Sootlings and Ash Knights** only, with the Warden. The Wisp (§8.2) and the Ash Knight
Captain (§8.3) stay in code with their tests, unplaced. The Sootling's vent respawn (D3) is not used.

### 0.4 Items and pieces (replaces §9.1's "Got" column and §10's table where they disagree)

- The Spark Sling comes from R1's chest (not the hub's Lamplighter), with a full bag (30 pellets); Ember Bombs from
  R2's plate chest (10); the Hookchain from R2's niche. Refills come from pots and drops only (no shop).
- **Pieces in the 1.0 content:** `spawn`, `door` (`switch`, `small-key`, `clear`), `switch` (`eye`, `plate`), `block`,
  `chest`, `pot`, `cracked`, `hook-post`, `sling-target`, `pit`. **Cut from the code** (GAME-3D.1f, "cut by the
  2026-10-31 rescope"): `npc`, `shop`, `one-way`, `ledge-drop`, and the chest contents `heart-piece`. **Kept in code,
  unplaced:** the `lever` switch and the `boss-key` lock (built in 1f parts 2 and 3, small and tested), `area-exit`
  and `entry` (the area change stays core to the game's flow code).

### 0.5 Editor gaps (replaces §17's rows where they disagree)

One level file, `content/levels/kiln.af-sector.json`, with R1, R2, the niche and R3. Gap 2 (slopes and stairs) no
longer applies (no stairs). Figures authored in the Studio: Wick, the Sootling, the Ash Knight and the Warden, and the
item library entries; no townsfolk. Gaps 1 and 3 to 9 stand, gap 5's strings shrink to the screens and the 3 rooms'
signs, and gap 9's music to the kiln and the boss.

### 0.6 Acceptance cases (changes to §19)

- **Dropped:** 1g's own cases (stair feet), since 1g is out of 1.0.
- **Reduced:** G3-a (the journeys open every chest of the 3 rooms, the optional ledge included); G3-b (the golden's
  route becomes R1 and R2 with two fights, a parry, a lock cycle, a camera turn and a doorway latch, with no hub
  lanterns); G3-m (the Sootling and the Ash Knight in content; the Wisp's unit case stays, as its code does); G3-p,
  G3-q and G3-u ("both areas" becomes the kiln; G3-q follows §0.2's path, and "every heart piece" leaves the list);
  G3-y (the heaviest scenes are R2's fight and the Warden).
- **Unchanged:** every other case, G3-r included.
- **Owner acceptance:** unchanged, over the trimmed game.

### 0.7 Rows (changes to §20)

| Row | Change |
|---|---|
| **1a** flow, saves, localization | No hub: menu → kiln; `resume` reads `'kiln'` |
| **1e** items, inventory, map | Unchanged in code; the sling's source is R1's chest |
| **1f** dungeon pieces | As built, less the cuts in §0.4 |
| **1g** ground-contact IK | **Cut from 1.0** |
| **1i** levels in ED3D | The one kiln file of §0.2 |
| **1j** figures, poses, clips | Wick, the Sootling, the Ash Knight, the Warden and the item library; no townsfolk, no Captain or Wisp authoring |
| **1k** text, tuning, audio, feel | The 3 rooms' strings and cues; no npc lines; music for the kiln and the boss |
| **1l** gates, deploy, acceptance | Over the trimmed game |

## 1. Concept and tone

**One line.** Wick, the small lamplighter from Emberwick, goes down into the cold kiln under a hillside village to bring the hearth-ember back. It is a third-person action-adventure in the spirit of Ocarina of Time, with lock-on sword-and-shield combat, one dungeon of locked doors and switches, three items, and a boss.

**Working title:** *The Cold Kiln* (GAME3D-D1). The package and folder stay `games/base-3d`.

**What the player does.** They explore a village hub, talk to three townsfolk, earn a sling and use it to open the kiln gate. Then they work through the Kiln's eight rooms. They fight Sootlings, Ash Knights and Wisps with lock-on, find small keys, a map and a compass, pick up bombs and a hookchain, and push blocks onto plates. Finally they defeat the Ashen Warden and relight the hearth. A first play-through runs 25 to 40 minutes (a design target, measured during GAME-3D.1l playtests, not a gate).

**Tone.** Warm, a little worn, and friendly. The village sits at dusk with cold lanterns. The kiln is soot, brick and dull orange. There is no gore and no blood: a beaten enemy bursts into a puff of ash and a few embers. The tone follows Emberwick's original characters and settings (art direction: "influences, not motifs to copy"). There are no Ocarina characters, names or places. The Ocarina reference is about structure: lock-on, a hub and a dungeon, items that open the dungeon, and a boss that tests what the dungeon taught.

**The look: AF's one look, at Emberwick's quality (M3R-D17).**
- **Palette.** Endesga 64 ([palette file](../../docs/art/palettes/endesga-64.txt)) is the game's palette content. Every material swatch names an Endesga colour (M3 §4.4.1; the Owner's decision 6).
- **Post.** A low internal resolution, a palette lock to Endesga 64 and an outline, written as game code on core's `postFilter` verb (M3.7c, restated for decision 7). The Plus `post-retro` is not installed.
- **Light.** Static meshes take baked vertex light. Figures take one tint per character per frame (M3 §4.3, M3R-D4). There are at most two lamps per room that light figures (§16).
- **Figures.** Procedural 3D meshes from FigureBuilder's generator, posed on M3's IK rig, with clips that step at 12 poses a second (M3R-D3). Rigged glTF is deferred ("procedural only for now").
- **Juice.** It carries over from Emberwick: squash on landing, dust, hit sparks, hitstop and a little shake. Everything except hitstop is presentation (§7.6).

**The camera (M3 §4.2; the Owner's numbers).** Crow Country's angle: a follow camera on a **24 mm lens** (53.13° vertical), **25° down** and **5 m back**, focus 1.0 m above Wick. The player turns it **freely, per pixel**: a one-finger drag, a right-button mouse drag, the right stick (180° a second) or Q/E (120° a second). The heading is an integer in the sim, 65,536 units to a turn. Each room has its own `camera-view` (bounds, an optional entry yaw, and `rotate: false` only for the boss arena's entry shot, §6.8). The near walls cut away and tall props fade (M3's occluder rule). At 844×390 the default view shows about 10.8 m across, and a 1.62 m figure is about 115 px tall; at 780×270 it shows about 14.4 m across and the figure is about 79 px (M3 §8). The rooms are sized for that (§6.3).

## 2. Goal and boundaries

> **Amended 2026-10-31 (the trimmed slice):** see §0, which wins where they disagree.

**Observable result.** `pnpm --filter @af-games/base-3d dev` (the package name is set by M3.7a) serves the game. It boots under Ruken's CSP, standalone or inside Ruken's frame, and shows nothing before ready. The flow is splash → menu → hub → dungeon → boss → end, with pause, settings, items and map screens. It plays with touch, keyboard and mouse, or a gamepad, in landscape on a phone. It saves to one Ruken slot with migrations. It localizes every string. It holds p95 ≤ 33.3 ms on both phone profiles. Its golden replay is identical in Node, Chromium, WebKit and Firefox.

**Deliverables (GAME-3D.1a to 1l, §20):**
- `games/base-3d/` grown from M3.7's first slice: the sim plugin (lock-on, combat, enemies, boss, items, dungeon pieces), the game's content and its content checks, the renderer layers (look, hit feel, reticles), the screens, input, saves, localization, and the ship config.
- The content files are authored in the editors (§17).
- Unit, parity, DOM, layout and e2e tests, plus the frame-budget run.
- The deploy to Ruken's local stack and the private dev host while D-1 stands.

**Prerequisite artifacts.**
- M3.7a and M3.7b, the first slice: the sim plugin with heading, view, latch and lock target, two rooms, Wick's four clips, and the lock-on demo.
- M3.7c (the look), M3.10 (M3's exit), and M4.12 (analog input: the touch stick, the camera drag, the camera settings).
- ED3D.12 (the 3D level editor accepted) and EDS.9c (the Studio's Animate).
- PRODUCT.L (core localization), M5's `Save` and `Audio` services, and EDS.4a (Tuner) and EDS.5a (Audio recipes) for the content they edit.

**Exclusions.**
- Physics: there is no `physics`, no `physics-bodies-3d` and no Rapier. Movement and collision are the sim plugin's own fixed-point code against sector walls, as in the first slice.
- M6 extensions: `sectors`, `nav`, `puzzle`, `systems`, `narrative`, `cutscenes`, `feel` and `debug` are not used (decision 7).
- Anything else Plus: `post-retro` and `pipelines`.
- Rigged or skinned characters: deferred by the Owner.
- An open overworld, terrain, streaming and online play: not asked for (M3 §17).
- More than one save slot, and a second dungeon.
- Jumping on a button: there is none. Wick drops off marked ledges and crosses gaps with the hookchain (GAME3D-D19).
- Free vertical aim: the ranged aim works on the ground plane (§9, GAME3D-D3).
- Voice acting and music beyond core music playback of a rendered song (ASSET.3).

## 3. Decision 7, recorded

**The Owner's words (2026-10-30, in 03):** "`games/base-3d` is free and uses core only, like Emberwick: its rooms, keys, feel and cutscenes are game code. The M6 extensions are built in Plus. M9 promotes the 3D runtime pieces (controller, camera, figures) as free and the gameplay systems (combat, lock-on, items, dungeon pieces) as Plus."

What this doc does with it:
- **Core only.** base-3d depends on `sim`, `content`, `host`, `runtime`, `ui`, `game`, `render-pixi` (for `no-eval` and the shared init) and the two free 3D packages, `render-pixi3d` and `figures` (M3R-D20). It depends on no Plus package and nothing in automata-plus.
- **Game code.** Lock-on, combat (including hitstop), items and the inventory, the dungeon pieces, enemy and boss behaviour, cutscene-like moments (the item get, the boss intro), the hit feel (shake, sparks), positional panning, the cue map and the map screen all live in `games/base-3d/src`.
- **M9 promotes, base-3d keeps its copies.** Once GAME-3D.1 proves these systems:
  - M9.2 promotes the third-person controller (camera-relative movement, the latch, the heading) as a free package, and base-3d moves onto it (M9.9).
  - M9.7 promotes ground-contact IK into `figures`, free.
  - M9.8 promotes brush environments into `render-pixi3d`, free.
  - M9.3 to M9.6 promote lock-on, combat, items and the dungeon pieces as **Plus** packages in automata-plus. A free game cannot import Plus, so **base-3d keeps its own lock-on, combat, items and dungeon code** (M9.9), and the Plus packages start as copies of it, with the same golden.
- **One contract owner, then.** Until M9, base-3d's code is the owner of these contracts. After M9, the Plus packages own their published API and base-3d's copies are frozen game code. A later fix in one is ported to the other, and its golden test covers both (the M9 spec decides the porting rule; here it is flagged as a risk in §23).

### 3.1 Code layout (GAME3D-D21; the Owner's direction, 2026-10-30)

**The Owner's direction (2026-10-30, in the session chat, relayed by the coordinator):** AF games, the `create-game` template and the one-file examples take EsperRedux's layout (`mcthaydt/PyrayExperiments_EsperRedux`): one flat file per role. The layout spec (GL.0) is being drafted; until it lands, this section records the direction for base-3d, before any code exists.

```text
games/base-3d/src/
  constants.ts     tuning constants the code reads (the tunables themselves are content/tuning.toml)
  components.ts    Koota traits: hero, enemies, boss, projectiles, dungeon pieces
  commands.ts      move, camera-turn, lock, lock-cycle, attack, shield, roll, item, interact, pause
  systems.ts       the system order; each large system moves into systems/ (below)
  systems/         lock-on.ts, combat.ts, hero.ts, enemies.ts, boss.ts, items.ts, dungeon.ts, camera.ts
  events.ts        sim events: hit, hurt, parry, item.get, door.open, boss.defeated, hero.ko
  state.ts         resources and setup: inventory, progress, area load; grows into state/ (save.ts and its fixtures)
  views.ts         render rows to figures, meshes, reticles and the HUD feed
  main.ts          defineGame: the plugin, content, screens, renderer and ship config
  game.test.ts     commands in, step, assert state; plus the golden replay
  screens/         splash, menu, hub HUD, pause, items, map, settings, end; flow.ts
  content/         figures, poses, clips, camera views, levels (af-sector), messages, moves, tuning
```

- **One file per role, a folder when it grows.** A role file that grows large becomes a folder of the same name. base-3d will need `systems/` from GAME-3D.1b (lock-on, combat, enemies and the rest are each hundreds of lines), and `state/` for the save definition and its fixtures. `screens/` and `content/` are folders from the start.
- **Left behind from EsperRedux:** no Redux store beside the sim, no globals, and no input read inside a system. Input becomes commands in `main.ts`'s input mapping, once per fixed step, and systems read only commands and the world.
- **Naming until GL.1.** `pnpm style` still requires role suffixes (`*.system.ts`, `*.component.ts` and so on) for files that hold `define*` results, and accepts the plural role files only from GL.1. Until then, the files inside role folders keep the suffix names (`systems/lock-on.system.ts`), and the flat files are named to pass the current check. Every path in this doc uses the target layout; GAME-3D.1a applies whatever GL.1 has landed by then.
- **The sim boundary.** `pnpm boundaries` scans base-3d's sim files: `constants.ts`, `components.ts`, `commands.ts`, `systems.ts` and `systems/`, `events.ts` and `state.ts`. `views.ts`, `main.ts` and `screens/` are outside the sim and may import runtime, ui and the renderers.

## 4. Ownership

| State | Owner | Writers | Readers |
|---|---|---|---|
| Wick's position, facing, velocity, health, i-frames, combat state, move and frame | The sim (`src/systems/hero.ts`, `src/systems/combat.ts`; components in `src/components.ts`) | Sim systems, from commands | Render rows; HUD through the presentation bus |
| `view` id, `heading`, the stick latch | The sim (M3.7a's plugin, extended) | The room-entry system; the `camera-turn` and lock-assist systems | `render-pixi3d`'s `CameraRig` through render rows |
| The lock target, the lock state, the candidate list | The sim (`src/systems/lock-on.ts`) | The lock system, from `lock` and `lock-cycle` | The rig (`frame(lock)`), the figure's `aim`, the reticle |
| Enemies, the boss and their brains | The sim (`src/systems/enemies.ts`, `src/systems/boss.ts`) | Enemy systems; the seeded RNG for drops only | Render rows |
| Projectiles (sling pellets), bombs, the hookchain | The sim (`src/systems/items.ts`) | Item systems | Render rows |
| Doors, switches, blocks, chests, gates, pots, pickups | The sim (`src/systems/dungeon.ts`), placed from the area's `af-sector` entities at area load | Dungeon systems | Render rows; the map screen |
| Inventory, keys, map, compass, flags, embers, heart pieces | Sim resources (`inventory`, `progress`) | Sim systems | Saves (read at a save point), HUD, the items and map screens |
| The area's geometry (sectors, walls, portals, heights) | Content (`content/levels/*.af-sector.json`), compiled once at area load into wall segments and floor heights in fixed point | Authors, in ED3D | Sim collision and room lookup; `render-pixi3d` meshes; the map |
| Camera views | Content (`camera-view`, `render-pixi3d`'s schema; one owner, M3 §4.2) | Authors | Sim (yaw, rotate) and rig |
| Figures, poses, clips, the figure library | Content (`figures`' schemas) | Authors, in the Studio | The figure view; the game's content checks (marker ↔ frame data) |
| Moves (frame data), enemy kinds, items, the boss script | Game content modules (`src/content/*.content.ts`), hashed as sim content | Authors (by hand; an editor gap, §17) | The sim |
| Tunables (speeds, ranges, hitstop lengths, shake amplitudes) | `content/tuning.toml` (core, with `tuning-meta.json`) | Authors, in the Tuner (EDS.4a) | The sim (gameplay values) and the renderer (feel values) |
| Strings | Locale content (`content/messages/*.json`, PRODUCT.L) | Authors (by hand; an editor gap, §17) | Screens, dialogue, HUD |
| Sounds | Core sound recipes (ASSET.0 format, rendered at build, ASSET.2) | Authors, in the Audio editor (EDS.5a) | `Audio.sound` through the game's cue map |
| Which screen shows | `src/screens/flow.ts`, a pure state machine | Screen handlers, sim events (`boss.defeated`, `hero.ko`), the host's lifecycle and menu | Screens |
| Held input, drag, sticks | Runtime `Input` (M4, M4.12) | DOM and the pad | The game's command mapping, once per fixed step |
| The save record | Runtime `Save` (M5) | The game, at save points | Continue |
| Settings | Core settings record (`CORE_SETTINGS`, with `camera` from M4.12) plus a game section (lock mode) | Settings screen | The command mapping |
| The session, rounds, lifecycle, saves storage | `Hosting` and the Ruken SDK | The host | Runtime |

**Sim versus presentation.** Only the sim changes gameplay state (law 1). Hitstop, the heading, the latch, lock-on, the lock assist, drops (seeded) and every hit and hurt window are sim. Shake, sparks, the reticle, occluder fades, clip sampling, the panning of sounds and the map drawing are presentation and never feed back.

## 5. The core loop

**Second to second:** move, lock on, read the telegraph, then attack, shield, parry or roll. Hitstop and the spark confirm a hit.

**Room to room:** enter a room and the camera takes the room's view. Read the room: its enemies, its pieces and its exits. Clear it, or solve it, or both. A door opens or a chest appears. Collect, then move on.

**Dungeon level:** find the map, which shows the rooms. Find small keys to open small-key doors. Find the dungeon item, which opens the rest. Find the compass, which shows the chests and the boss. Get the boss key, then the boss.

**Game level:** hub → earn the sling → open the kiln → dungeon → boss → the hearth is relit and the village's lanterns come on (the end screen). After the end, Continue returns to the hub with everything kept, so the player can find missed heart pieces (§10.4).

The loop's promises are what the acceptance cases check (§19):
- Every attack is readable before it lands.
- Every door says what opens it.
- Nothing needs a reflex the touch controls cannot give.

## 6. Playable scope and the room-by-room outline

> **Amended 2026-10-31 (the trimmed slice):** see §0, which wins where they disagree.

### 6.1 Scope (GAME3D-D2)

| Item | Count |
|---|---|
| Hub | 1: Cinderford, a village square and its edges, in one `af-sector` file |
| Dungeon | 1: the Cold Kiln, **8 rooms**, D1 to D7 plus the boss room, in one `af-sector` file |
| Boss | 1: the Ashen Warden |
| Items | Sword and shield (start), plus **three**: Spark Sling (ranged; hub), Ember Bombs (utility; dungeon), Hookchain (traversal; dungeon) |
| Enemy types | 3: Sootling, Ash Knight (with a heavier mini-boss variant), Wisp |
| Townsfolk | 3 talking figures (the Lamplighter, the Smith, Pell the child) |
| Collectables | Embers (currency), recovery hearts, 4 heart pieces (2 in the hub, 2 in the dungeon; 4 make 1 heart), ammo refills |
| Dungeon pickups | 2 small keys, 1 boss key, the map, the compass |
| Save slots | 1 |

### 6.2 The world as rooms

The hub file and the kiln file are separate areas. A sector portal marked as an area exit links the kiln gate (hub) to D1's mouth (kiln). Crossing it is an **area change**: the screen fades over 300 ms (instant under reduced motion), the sim loads the other area's compiled geometry and places Wick at the entry point, and the room's view cuts.

Inside an area, a **room** is a group of sectors that share one `view` id (the `af-sector` sector field). Entering a sector of another view changes the view; M3's latch keeps the stick steady across the doorway.

### 6.3 Room sizing rule

A room's walkable floor is at most **14 m across and 12 m deep**: about the default view's width at 844×390 (10.8 m) plus the turn the player makes to look around. Arenas meant to be seen whole (D4, the boss room) are at most 11 m across. Every room closes its far side with a wall or fog, because the horizon sits 1.6° inside the frame (M3 §4.2). There are at most **4 enemies alive at once** in a room (§16).

### 6.4 Hub: Cinderford

| Part | What is there | What it teaches or gives |
|---|---|---|
| The square (spawn) | A dead bonfire, three cold lanterns on posts, the Lamplighter, a training dummy | Movement and camera turn. A tip sign shows the drag, the right stick and Q/E. Locking onto the dummy and the sword combo (the dummy never hits back) |
| The smithy (east) | The Smith, a counter (the shop), a cracked back wall | The shop sells pellets (after the sling) and bombs (after the bombs). **Heart piece 1** is behind the cracked wall, so it needs bombs (return after D4) |
| Lamplighter's path (north) | The Lamplighter gives the **Spark Sling** after the first talk. Three lantern targets (bells) at 2 to 3 m height on the path | Aiming the sling on the ground plane with lock-on assist (§9). Lighting all three lanterns opens the kiln gate |
| The orchard edge (west) | Pell, five pots, the target game (hit 5 moving targets in 20 s) | Embers and hearts from pots. **Heart piece 2** is the target game's prize |
| The kiln gate (south) | A gate that opens when the three lanterns are lit; the area exit to D1 | The dungeon's door |

### 6.5 The Cold Kiln: D1 to D7 and the boss room

The order in which a player meets the rooms: D1 → D2 → D3 (sling switch, small key 1, compass) → D2 → D4 (mini-boss, **Ember Bombs**) → D5 (bomb wall, stairs, small key 2, heart piece 3) → back to D2 through D5's one-way gate → D6 (small-key door 1, **Hookchain**) → D7 (small-key door 2, boss key, heart piece 4) → boss door → the Hearth Chamber.

| Room | Size (m) | View | Contents | Pieces | Out |
|---|---|---|---|---|---|
| **D1 Kiln Mouth** | 10×8 | Default; entry yaw faces into the kiln | 2 Sootlings | A clear-room door (opens when the room's enemies are gone), two pots | North to D2 |
| **D2 Furnace Hall** (the dungeon's own hub) | 14×12 | Default, bounds clamp at the walls | 1 Sootling. **The map chest** appears when the block is on the plate | One pushable block, one floor plate, doors W (D3), E (D4), N (small-key door 1 to D6), N-upper (small-key door 2 to D7, up a stair), the boss door's corridor beyond D7; the one-way gate from D5 (east wall) | W, E, N, N-upper |
| **D3 Bellows Gallery** | 12×10 | Default | 2 Sootlings that come back up out of the vents while the plates are empty | Two blocks and two plates. When both are held, an **eye switch** opens above the far door, 2.6 m up; one sling shot opens it. **Small key 1** is in a chest behind it, and **the compass** is in a chest by a pot cluster | Back to D2 |
| **D4 Slag Pit** | 11×11 (an arena) | `rotate: true`, bounds tight | **Mini-boss: the Ash Knight Captain** (§8.3). The doors lock behind Wick until it falls | A chest with the **Ember Bombs** appears; a cracked wall on the east side | West to D2, east (bombed) to D5 |
| **D5 Cinder Stair** | 12×12, two levels 2.4 m apart joined by a stair of 8 steps (stepped sectors of 0.3 m) | Default; a second view on the lower level (cut at the stair foot) | 2 Wisps, 1 Sootling | The stair (ground-contact IK on steps, GAME-3D.1g). A cracked floor drops to a ledge with **heart piece 3** in a chest. **Small key 2** is in a chest that appears when the Wisps are gone. A **one-way gate** opens from the lower level back into D2 (the shortcut) | One-way gate to D2 |
| **D6 Chain Vault** | 14×10, with a pit 5 m wide across its middle | Default | 1 Ash Knight, 1 Wisp | The **Hookchain** chest on this side, behind a sling eye switch. Three hook posts across the pit, so Wick hooks from post to post to the far ledge. Falling into the pit costs one half-heart and returns Wick to the room's last entry point (§7.8). A lever on the far side lowers a bridge back, so the return trip needs no hooks | Back to D2 |
| **D7 Bell Loft** | 12×12 | Default | A gauntlet in two waves: 2 Sootlings and 1 Ash Knight, then 2 Wisps and 1 Ash Knight (4 alive at most) | Doors lock until both waves fall. Two hook posts lead up to a gallery with the **boss-key chest** and **heart piece 4**. A one-way drop leads back down | South to D2, east to the boss door's corridor |
| **Hearth Chamber** (boss) | 11×11 round arena, 4 pillars, an outer trench | An entry shot, then the default view with `rotate: true`; bounds hold the arena | **The Ashen Warden** (§8.4) | The boss door needs the boss key. The doors lock until the fight ends | After the fight: the hearth relights, the end screen (§13) |

Small-key doors: 2. Small keys: 2. Keys are per dungeon and count down when used, as in Ocarina. The doors say what opens them: a small-key door shows a keyhole plate, the boss door a large one, a clear-room door bars, and a switch door a link line drawn to its switch. That rule is game art and is checked in §19 (G3-r).

### 6.6 What "done" means for the content

All 9 rooms and the hub are playable from New game to the end screen with only touch controls (G3-a), and also with only a keyboard and with only a gamepad. Every chest, key and heart piece can be reached, which the solver test proves (G3-q).

## 7. Combat

### 7.1 Source: The Last Light's fight code (read at `92e6704`)

`src/fight/moves.ts` (141 lines) and `sim.ts` (187) are a deterministic two-fighter duel at 60 Hz. `src/fight/brawl/moves.ts` (197) and `brawl/sim.ts` (451) are a ten-fighter brawl on a floor plane. Their tests (`tests/fight.test.ts`, `tests/brawl.test.ts`) prove that a fight replays frame for frame from its move log alone. **What base-3d reuses, as rules and numbers, rewritten:**

| Idea in the source | Where | In base-3d |
|---|---|---|
| A move is one record of frame data (`total`, `active`, `hit { reach, height, dmg, kb, stun, stop, power }`, `parry`, `block`, `impulse`, `hurt`) beside its key poses | `moves.ts` `Move`, `Hit` | `MoveDef` in `src/content/moves.content.ts`. The keys become a **clip id** with markers (M3R-D14) instead of inline stick poses |
| States `idle`, `act`, `stun`, `air`, `down`, `rise`, `stagger`, `land`, `blockstun` | `sim.ts` `State` | `CombatState` with the same names, minus `air` (no launches) |
| Hits resolved together on one frame, so two that land on the same frame trade | `sim.ts` step "Hits" | The same order: gather, then resolve |
| Parry beats a hit and the attacker staggers (28 frames, hitstop 14); a block costs blockstun 12 and a push; a `low` hit is unblockable | `sim.ts` | The same numbers as starting tunables (§7.4) |
| Hitstop as a freeze counter set to the largest `stop` of the frame's hits | `sim.ts` `w.freeze` (the duel), local per pair in the brawl | Global freeze (GAME3D-D6) |
| Facing toward the mark and a strafe that keeps a ring (`strafe`, `keep`) | `brawl/sim.ts`, `brawl/moves.ts` (`circle`, `watch`) | The enemies' circling while they wait for an attack token (§8.1) |
| `around` hits (a spin) and a hurtbox height per move | `brawl/moves.ts` `BrawlHit` | Wick's spin attack; `hurt` heights on rolls |
| Replay from the log | the tests' first case | base-3d's golden replay (G3-b) |

**What is not reused.**
- The code itself. It uses floats, `Math.sin`, `Math.hypot`, `Math.exp` and `**` (in `director.ts`), which `pnpm boundaries` forbids in a sim. base-3d writes the rules again in the sim plugin's fixed-point units, with `@mcthaydt/automata-sim/math` for trig. Each file that carries a rule records the source path and `92e6704` in its header comment (decision 8: AF-side only; The Last Light is not edited).
- Juggles, launches, ground bounces, homing leaps, weapons off racks, pistols, boards that break and the cinematic director.

Its tests come across as behaviours: a fight replays from its command log, and a parry inside the window always staggers.

### 7.2 Wick's moves (starting frame data; ticks at 60 Hz)

Each move names a clip (authored in the Studio, GAME-3D.1j) and the markers `windup`, `contact` and `recover`. The sim sets `action.length` to `total` ticks, and the view retimes the clip so that `contact` shows on the first frame at or after the active start (M3 §4.4.4, I-i).

| Move | Input | Total | Active | Combo window (cancel into next) | Dmg (half-hearts) | Hitstop | Target stun | Knockback (m/s) | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `slash-1` | Attack | 22 | 6–9 | 10–18 | 1 | 4 | 18 | 1.5 | Right-to-left; `mask: [armR, armL, torso]` plays over the walk |
| `slash-2` | Attack in window | 24 | 7–10 | 11–19 | 1 | 5 | 20 | 1.5 | Left-to-right |
| `thrust` (finisher) | Attack in window | 34 | 10–14 | — | 2 | 8 | 30 | 4.0 | Power 3: the largest shake |
| `spin` | Hold Attack ≥ 40 ticks, release | 36 | 8–20, `around` 1.6 m | — | 2 | 6 | 24 | 3.0 | A charge glow is presentation |
| `guard` | Hold Shield | stance (`hold` clip) | — | — | — | — | — | — | Blocks a frontal 120° arc; walk speed × 0.5 while held |
| `parry` | Shield pressed, frames 1–8 of `guard` | — | — | — | — | 14 | attacker `stagger` 28 | — | "Perfect guard": the attacker is open |
| `roll` | Action while moving, unlocked | 24 | — | — | — | — | — | travel 3.2 m | Invulnerable on frames 2–12 |
| `hop-side`, `hop-back` | Action while locked, stick side or back | 20 | — | — | — | — | — | travel 2.0 m | Invulnerable on frames 2–10; facing stays on the target |
| `hurt` | Taking a hit | 18 (stun) | — | — | — | — | — | — | 60 ticks of i-frames after it; the figure flashes (presentation) |
| `knockdown`, `rise` | A power-3 hit or a bomb | 40 + 14 | — | — | — | — | — | — | Invulnerable while down and rising |
| `fall` | Walking off a pit edge | 60 | — | — | 1 (cost) | — | — | — | §7.8 |
| `item-*` | Item | per item (§9) | — | — | — | — | — | — | Sling `draw`/`release`, bomb `place`, hook `throw` |

The numbers are starting values. They are tunables (§17) and the Tuner edits them. The table's structure (which moves exist, which cancel into which) is game content. **Buffering:** an Attack pressed from frame 4 of a slash to the end of its window queues the next slash, which starts at the window's first frame. One press queues one slash, and three slashes end the chain.

### 7.3 Hits and hurtboxes

Hitboxes and hurtboxes are **cylinders** in the sim: a radius and a height band above the floor, in fixed point. A move's hit is a reach band (`[near, far]` metres along the facing) and a height band, as in the source. `around` hits test a ring. Wick's hurt radius is 0.3 m and his height 1.6 m (0.9 m while rolling). Enemies declare their own. A hit lands when the reach segment overlaps the hurt cylinder in plan and the height bands overlap. Each move hits a given target once (`hitDone` per target). Damage, knockback and stun apply in a fixed order: by entity id, attackers first.

### 7.4 Shield, block and parry

- **Block.** A frontal hit inside the shield's 120° arc, from a move that is not `unblockable`, is blocked. The attacker gets hitstop 4. Wick gets blockstun 12 and a push of 2.4 m/s, and takes no damage (the source's block takes 1 HP; base-3d takes none, so that a beginner's turtling works).
- **Parry.** A hit that arrives on frames 1 to 8 after the shield went up is parried: the attacker is in `stagger` for 28 ticks, there are 14 ticks of hitstop, and an event drives the spark and sound. A staggered enemy takes double damage from the next sword hit. The window is the source's `parry: [2, 12]` shortened to 8 frames, because a shield held up is not a committed move. That is a tuning call, open to the Owner's play.
- **Unblockable** hits (the Warden's sweep, bomb blasts) are telegraphed in their own colour and pose (§8.5).

### 7.5 Hitstop (sim)

Hitstop is a sim freeze counter (GAME3D-D6). On a frame whose hits set stops, `freeze = max(stop)`. While `freeze > 0` the sim advances nothing but the counter and the input buffer, so an Attack pressed during hitstop queues. The view keeps drawing, and the frozen poses hold (the figure's `action.startedAt` shifts by the frozen ticks, so clips do not run ahead). Freezes are in the golden.

### 7.6 Shake and sparks (presentation, game code)

Shake is a screen-space translation, not a camera rotation, keyed by the hit's power (1, 2 or 3). Starting amplitudes are 1, 2 and 4 internal pixels, decaying over 120 ms (tunables). Sparks and ash puffs are presentation layers in palette colours. Under reduced motion, shake is off and sparks are shortened. The sim never reads either. Decision 7 keeps them out of the Plus `feel`.

### 7.7 Pose-space transitions

A slash into a slash, a roll into the guard, or a hurt mid-swing uses M3's pose-space transition (M3R-D16, 80 ms by default, I-k). Combo slashes set `blend.inMs` to 50, so the chain reads snappy (a clip field, authored in the Studio).

### 7.8 Health, damage, falls and defeat

- Wick starts with **4 hearts** (8 half-hearts). Heart pieces raise the maximum to 5 hearts. A recovery heart heals one heart.
- Falling into a pit costs one half-heart, plays `fall`, and returns Wick after 60 ticks to the room's last entry point (the sector portal he came through), facing into the room, with 60 i-frames.
- At 0 health: `knockdown`, then the Game over screen: **Continue** (the last resume point, §12.3, with 3 hearts) or **Quit** (to the menu). A boss fight lost restarts at the boss door with the boss at full health.

## 8. Enemies and the boss

### 8.1 Readability rules (all enemies)

1. Every attack has a **windup of at least 24 ticks (0.4 s)**, with its own pose, a sound cue at its start, and an eye glow in palette orange. The boss's windups are at least 36 ticks.
2. **Attack tokens.** At most **2 enemies** hold an attack token at once (a sim resource). An enemy without a token circles at 3 m (the brawl's `watch` strafe, ring 2.9 to 3.8 m, as a reference) and never starts a windup.
3. An enemy that is hit loses its token, so a combo is never interrupted by a second attacker's windup that started during it.
4. Every enemy is lockable. The lock reticle shows which one holds a token: the reticle pulses.
5. Brains are deterministic state machines (`idle → notice → approach → windup → attack → recover → …`) in the sim. They use only sim state, integer timers and the seeded RNG, and only for the drops.
6. A beaten enemy bursts into ash (presentation) and may drop an item. Drops use a seeded table: 30% nothing, 40% one ember, 20% five embers, 10% a recovery heart (and pellets or bombs, if Wick owns them and is below half).

The Last Light's `src/game/agents.ts` and `pursuit.ts` (at `92e6704`) are the reference for agent state stored in the world (so checkpoints and replays carry it) and for line-of-sight checks past walls. Nothing is copied from them.

### 8.2 The three types

> **Amended 2026-10-31 (the trimmed slice):** see §0, which wins where they disagree.

| Enemy | Figure | HP | Behaviour | Telegraph | Counterplay |
|---|---|---|---|---|---|
| **Sootling** | A small figure, 0.9 m, in a soot hood (Studio content) | 2 | Wanders; notices at 6 m; approaches to 1.6 m; **lunge bite** (active 3 frames, 1 dmg) | Crouches and its eyes glow for 30 ticks | Two slashes; a shield block; it can be stunned by the hookchain. It respawns from vents in D3 while the plates are empty |
| **Ash Knight** | A full figure, 1.8 m, helmet, a sword and a shield as items | 6 | Faces Wick with its **shield up**, which blocks frontal hits from Wick. **Overhead chop** (windup 30, active 4, 2 dmg). **Shield bash** (windup 24, pushes Wick back 3 m, no damage) | Raises the sword high; it scrapes its shield | Strafe round its shield while locked and hit its back; parry the chop (stagger) and then hit; a bomb at its feet knocks it down |
| **Wisp** | **Not a figure:** a floating ember mask, a static mesh animated in game code (GAME3D-D10) | 2 | Hovers at 2.2 m, out of sword reach, and circles; **dive** in a straight line at Wick (windup 30 with a shriek, active through the dive, 1 dmg) | Stops, flares and shrieks | One sling pellet drops it to the floor for 120 ticks, where the sword finishes it; a block stops the dive |

### 8.3 The mini-boss: the Ash Knight Captain (D4)

> **Amended 2026-10-31 (the trimmed slice):** see §0, which wins where they disagree.

The Ash Knight Captain is the Ash Knight with 14 HP, 2.1 m tall, and one extra move, a **two-chop combo** (windups 30 and 20). At half health it gets angry: its windups shorten by 4 ticks and it calls one Sootling at a time from the vents (at most 2 alive). Its death opens the doors and drops the Ember Bombs chest. It teaches strafing and parrying before the boss.

### 8.4 The boss: the Ashen Warden (Hearth Chamber)

A **3.2 m figure** (a procedural figure at the top of the height slider, with plate garments; GAME3D-D20 records the risk) with a furnace grate in its chest and a stone hammer. It has 24 HP and two phases.

| Phase | Moves (windup / active / damage) | Opening | Lesson |
|---|---|---|---|
| **Phase 1** (24 to 13 HP) | **Hammer slam** (40 / 6 / 2; a shockwave ring 2.5 m wide that a roll avoids). **Grate swipe** (36 / 8 / 2, blockable) | **Parry the slam:** a perfect guard on the slam's contact staggers it for 90 ticks and it kneels, grate open, and the sword hits the grate (×2 damage). The swipe can be blocked but opens nothing | The shield and the parry |
| **Phase 2** (12 to 0 HP) | It shuts the grate and stands across the trench by a pillar. **Ember breath** (inhales for 48 ticks, then a cone 70° wide and 5 m long; unblockable; hide behind a pillar or roll). **Charge** (40 windup, a straight line across the arena) | **Sling into its open mouth** during the inhale: it chokes, staggers for 120 ticks and kneels on Wick's side, and the sword hits. **Or** a bomb in its charge path knocks it down for 90 ticks | The sling under the angled camera; bombs as a second answer |

Entering the room plays an **entry shot**: a 2.5 s fixed view (`rotate: false`, tilt 35°, distance 9 m) while the Warden stands up, then a cut to the arena's normal view. It is game code (decision 7: cutscenes are game code), and the player can skip it (Action) and it is shortened under reduced motion. The boss health bar is HUD. Defeat plays the hearth relighting (a 4 s game-code shot), then the end screen.

### 8.5 Colour of danger

Blockable windups glow orange. Unblockable windups glow **white-yellow and pulse**. Both are Endesga colours, and the HUD legend in the pause screen explains them. A colour-blind check is the core theme's contrast rule (3:1 against the room) plus the pulse, so colour is never the only signal.

## 9. Items, the inventory and the map

### 9.1 The items

> **Amended 2026-10-31 (the trimmed slice):** see §0, which wins where they disagree.

| Item | Got | Use | Sim rule | Ammo |
|---|---|---|---|---|
| **Sword** | Start | Attack (§7.2) | — | — |
| **Shield** | Start | Hold to guard; parry | — | — |
| **Spark Sling** (ranged) | Hub, from the Lamplighter | Item: hold to draw (8 ticks), release to fire. A pellet flies 20 m/s, at most 15 m. It lights lanterns, opens eye switches, drops Wisps, chokes the Warden and stuns a Sootling for 60 ticks | A sim projectile, fixed point, stepped each tick against walls and hurt cylinders; aim as §9.2 | 30 pellets (shop, drops) |
| **Ember Bombs** (utility) | D4 chest | Item: place at the feet. The fuse is 120 ticks, then a blast 1.6 m in radius. It breaks cracked walls and floors (an entity), knocks Ash Knights and the Warden down, and hurts Wick too (1) | A sim entity with a timer; the blast is a ring hit, unblockable | 10 bombs (shop after D4, drops) |
| **Hookchain** (traversal) | D6 chest | Item: aim as §9.2, release to throw. The chain flies 12 m/s, at most 8 m. On a **hook post** it pulls Wick to the post at 10 m/s (Wick is invulnerable while pulled). On a Sootling or Wisp it stuns for 90 ticks. On a wall it returns | A sim ray stepped each tick; the pull is a straight-line move to the post's foot, so there is no physics | — |

Collectables: **embers** (currency, at most 999; pots, drops, the target game) and **recovery hearts**. Ammo refills are pellet packs (+10) and bomb packs (+5). **Heart pieces**: 4, as listed in §6. Dungeon pickups: small keys, the boss key, the map and the compass.

### 9.2 The ranged aim under the angled camera (GAME3D-D3, for the Owner's veto)

**The question** (M3 §17, open for this task): Ocarina aims in first person. Under a 25° three-quarter camera that the player turns freely, how does a ranged item aim?

| Option | How it plays | For | Against |
|---|---|---|---|
| **A. First-person aim view** | Holding Item switches to a camera at Wick's eye. The drag or right stick aims yaw and pitch, and release fires | The closest to Ocarina; free vertical aim | A second camera outside `CameraRig`'s angled views, with its own framing, near-plane clipping of walls and its own frame cost on phones. The player loses sight of Wick and the room while enemies keep acting. On touch it needs a two-thumb aim (the stick moves nothing while aiming). It breaks the Owner's one camera identity (24 mm, 25°, 5 m) in gameplay |
| **B. Over-the-shoulder** | Holding Item dollies the camera to about 1.5 m behind Wick's shoulder, with a reticle | Keeps Wick on screen; familiar from modern games | The distance is outside M3's authored range (3 to 12 m) and the occluder rule was designed for 5 m; tight rooms push the camera into walls. It is still a second camera behaviour, and two-thumb on touch |
| **C. Ground-plane aim with lock-on assist (recommended)** | The camera never changes. Holding Item draws: Wick turns to the **aim direction**, which is the lock target when locked, or else the stick direction (camera-relative, through the heading), or else Wick's facing. A dotted line on the floor shows the shot's path to its end. **Height is automatic:** the shot rises to hit the **sling target** (an eye switch, a lantern, a Wisp, the Warden's mouth) whose plan position lies within ±6° of the aim line and within range, choosing the nearest. With no such target it flies level at chest height. Release fires | One thumb on touch (stick plus Item), no new camera, no new render path, cheap on phones. It is all integer sim math (a plan ray, then a height pick), so it is easy to replay. Lock-on already exists and teaches the same verb. It matches the Owner's camera and turn rule | No free vertical aim, so **every shootable thing must be a declared target** (`sling-target` entity, enemies, the boss's mouth) placed at 0.5 to 3 m. Content follows that rule, and a content check enforces it (G3-p). Less like Ocarina's sling |

**Recommended default: C.** The reasons:
- It keeps the camera the Owner chose as the game's identity at all times.
- It is the only option that plays with one thumb on a phone, the primary target.
- It needs no second camera, so there is no new presentation contract or phone frame cost.
- It reuses lock-on, so ranged combat teaches nothing new.
- It is exact in the sim, because the aim is a plan direction and a target choice, with no free pitch.

The hookchain aims the same way (hook posts are targets). **If the Owner vetoes it,** option A is the fallback; it would need a request to the render3d lane for a first-person view outside `CameraRig` (M3 §17 names it) and a GAME-3D.1h touch layout with an aim drag.

### 9.3 The inventory (pause → Items)

The Items screen is a grid of five slots: Sword, Shield, Sling (with ammo), Bombs (with count) and Hookchain. Unowned slots are empty outlines. Selecting an owned item **equips it to the Item button** (one equipped at a time). It also shows the four heart pieces (as quarters), embers, and, in the kiln, the small keys, boss key, map and compass. Quick swap: on keyboard, 1, 2 and 3; on gamepad, LB; on touch, the Items screen (GAME3D-D16). Focus is a grid with arrow keys, the D-pad and taps; Back returns.

### 9.4 The map (pause → Map, or the corner Map button)

The map is drawn from the area's compiled geometry; nothing is authored. It is a top-down plan of each room's sectors:
- Visited rooms are filled. With the map, unvisited rooms show as outlines.
- With the compass, chests (open or closed) and the boss room's mark show.
- Wick's arrow and a wedge for the camera's heading are drawn.
- Doors show their lock kind (§6.5's legend). The hub has its own map, always complete.

The map scales to the container. At compact height it scrolls inside a declared scroll region, and its 44 px Close button stays fixed. It is game code on `ui` primitives (no UI composer exists).

### 9.5 HUD

| Element | Where | Notes |
|---|---|---|
| Hearts | Top inline-start, inside `visible` | Half-heart steps; flashes on hurt |
| Embers, small keys | Under the hearts | Keys only in the kiln |
| Equipped item and ammo | On the Item touch button's face; a corner chip on desktop | |
| Lock reticle | Over the target (presentation) | Pulses while the target holds a token |
| Boss bar | Top centre during the boss fight | Its name, localized |
| Corner controls | Top inline-end: Pause, Map (44 px each) | M4's `[data-corner-controls]` |
| Prompt | Above the Action button: "Talk", "Open", "Push", "Read" | Shows when a context action is in reach; the Action button's label changes too |

## 10. Dungeon pieces

> **Amended 2026-10-31 (the trimmed slice):** see §0, which wins where they disagree.

All are game code in `src/systems/dungeon.ts`. They are placed from `af-sector` **entity definitions** that the area files declare (ED3D §4.7). The fields are typed, so ED3D's inspector edits them.

| Entity def | Shape | Fields | Rule |
|---|---|---|---|
| `spawn` | point, single | `facing` (angle) | Area start |
| `entry` | point | `facing`, `portal` (ref) | Where a fall or a Continue returns Wick |
| `door` | box | `lock`: `none`/`small-key`/`boss-key`/`clear`/`switch`; `switch` (ref); `id` | Blocks a portal while closed. Opening one with a key consumes the key and saves the flag. `clear` opens when the room's enemies are gone, `switch` when its switch is on |
| `switch` | point/box | `kind`: `plate`/`eye`/`lever`; `latch` (bool); `targets` (refs) | A plate is on while a block or Wick stands on it (Wick's weight counts only when `latch`). An eye is hit by a pellet. A lever is pulled with Action. Latching switches save |
| `block` | box 1×1×1 m | `home` | Pushed one grid cell (1 m) per Push held for 30 ticks, along the axis Wick faces most. It never pushes into a wall, a block or a pit. It resets to `home` on room entry unless its plate latched |
| `one-way` | box | `from` (sector ref) | Passable from `from` only; a gate visual |
| `chest` | box | `contents`: an item id, `small-key`, `boss-key`, `map`, `compass`, `heart-piece`, `embers:N`; `hidden` until (ref) | Opened with Action; the item-get pose and banner (§13). Saves the flag |
| `pot` | box | `drop` (table id) | Breaks on a hit or a bomb; drops from the table |
| `cracked` | box | — | A bomb blast removes it for good (saved), which opens the portal or floor it covers |
| `hook-post` | point | — | A hookchain target |
| `sling-target` | point | `height` (0.5–3 m), `targets` (refs) | A lantern, a bell or an eye. Lockable |
| `enemy` | point | `kind`, `wave` (int), `respawn` (bool) | Spawned on room entry. A cleared room's enemies come back on re-entry, except mini-bosses and bosses (GAME3D-D17) |
| `pit` | sector flag via a box entity over the sector | — | A fall (§7.8) |
| `ledge-drop` | box | `to` (sector ref) | Walking off the marked edge drops Wick to the lower sector (one way); otherwise sector heights block |
| `npc` | point | `figure` (ref), `lines` (message key prefix) | Talk with Action |
| `shop` | box | `stock` (table id) | Buy with Action |
| `area-exit` | box | `to` (area id), `entry` (ref) | An area change (§6.2) |

**What persists** (in the save): opened doors, used keys, collected chests, broken cracked entities, latched switches, picked-up heart pieces, the boss defeated, the lanterns lit and the items owned. **What resets on room entry:** blocks (unless latched), non-latching switches, pots, enemies (except bosses) and projectiles.

## 11. Lock-on (sim-side)

### 11.1 Selection

- **Candidates:** lockable entities (enemies, the boss, sling targets, hook posts, NPCs to talk to) within **12 m** in plan and on the same level, with a clear line in plan past the room's wall segments (fixed-point segment test).
- **Score:** among the candidates inside a **±60° cone around the camera's forward direction** (the heading), pick the one with the smallest `angle_rank × 4 + distance_rank`, where the ranks compare integer dot products and squared distances, so there is no `atan` and no float. Ties go to the lower entity id. With nothing inside the cone, take the nearest candidate in any direction within 6 m. With nothing at all, the press **recentres the camera** behind Wick: the heading becomes his facing, eased 250 ms by the view (Ocarina's Z with no target).
- **Lock mode:** toggle by default (a press locks, the next press releases), or hold (a settings choice; GAME3D-D4).

### 11.2 While locked

- **Facing** is set toward the target every tick. The **stick moves relative to the camera** through the heading, so pushing sideways circles the target. `moveDir` (the angle of travel relative to the facing) goes to the figure, which plays the strafe or back-step cycle (F-h).
- **Head and weapon aim:** the render row carries `aim` (head and chest at the target's chest height; the right hand during sling draw), so M3's aim layer turns them (I-e).
- **Camera framing:** the view calls `frame(lock)`, which biases the focus up to 35% toward the target, inside bounds, with Wick in the middle third (M3 §4.2).
- **Lock heading assist (sim, GAME3D-D5):** if the target is more than **45°** off the camera's forward direction as seen from Wick, the sim turns the heading toward the Wick-to-target yaw at up to **180° a second** (546 units a tick), stopping inside 45°. It is integer, in the golden, and never latches the stick (the player's own and the assist's turns do not latch; only a view change latches, M3R-D15).
- **Cycling:** while locked, a `lock-cycle { dir }` command picks the next candidate clockwise or anticlockwise around Wick. Touch: a horizontal camera drag of at least 40 px while locked cycles instead of turning, once per drag. Pad: a right-stick flick past 0.7. Keyboard: Q/E (the camera-turn keys). Mouse: a right-button drag of 40 px. While locked, the player cannot turn the camera manually, because the assist owns the heading.
- **Breaking:** the target dies, leaves 15 m, or is out of line of sight for 60 ticks; the player releases (or, in toggle mode, presses again); a fall or an area change.

### 11.3 Tests

The lock target, the lock state and the heading are in the golden (B-a). Unit tests cover selection (cone, ranks, tie by id, recentre with no target), cycling order, the assist's rate and stop, the break rules, and that the mapper keeps "stick up" away from the camera under the assist (D3-i's property) (G3-e to G3-h).

## 12. Saves, settings and localization

### 12.1 Saves (M5 `SaveDef`, one slot)

```ts
// src/state/save.ts (the design; GAME-3D.1a writes it test first)
SaveDef<Base3dSave> = {
  key: 'base-3d',            // one Ruken key; no `slots` (one slot)
  version: 1,
  schema: base3dSaveSchema,  // zod, passthrough for unknown fields (M5 §4.2)
  empty: newGame,
  migrations: {},            // grows one step per shape change (rule below)
  autosave: { on: ['screen-exit', 'background', 'interval'], intervalSeconds: 60 },
}
interface Base3dSave {
  hearts: { max: number; pieces: readonly string[] }  // heart-piece entity ids collected
  embers: number
  items: { sling: boolean; bombs: boolean; hookchain: boolean }
  ammo: { pellets: number; bombs: number }
  equipped: 'sling' | 'bombs' | 'hookchain' | null
  flags: readonly string[]            // persistent entity ids: opened doors, chests, cracked, latched switches, lanterns
  kiln: { smallKeys: number; bossKey: boolean; map: boolean; compass: boolean; visited: readonly string[]; bossDefeated: boolean }
  resume: 'hub' | 'kiln'              // the area whose entrance Continue returns to
  playTicks: number
}
```

- **The resume point is the area's entrance** (GAME3D-D9): the hub's square, or D1's mouth in the kiln. Room-local state is not saved, so no half-pushed block is ever restored. Health is restored to full on Continue.
- **Save points:** autosave on screen exit (pause, quit), on going to the background, and every 60 s. The game calls `touch()` when a persistent flag changes. An explicit `write` follows each key-item get, so a power loss right after the Hookchain does not lose it.
- **Migration rule:** every change to the saved shape after the first deploy bumps `version` and adds `migrations[n]` (`n → n+1`), with a fixture of a real version-`n` record in `src/state/save-fixtures/v<n>.json` and a test that the fixture migrates and parses. GAME-3D.1a ships version 1 and a test-only version-2 fixture that proves the path (G3-s).
- **Failure follows M5 §6:** an unreadable slot shows "Your save can't be read" with New game, which asks before it overwrites; a slot from a newer build is read-only, with Continue disabled and an explanation; a host that refuses saves shows "Progress won't be saved here" once and plays on, with **no device-storage fallback** (host authority).

### 12.2 Settings

- **Core rows:** language, volumes, reduced motion, rebinding, the touch overlay's visibility.
- **M4.12's camera rows** (GAME-3D.1h builds them in the `settings.sections` slot):
  - **Camera turn speed**: a Slider over 0.05 to 1°/px, default 0.25. It scales the drag directly, and the pad and key rates in proportion: 180°/s and 120°/s at 0.25 (GAME3D-D18).
  - **Invert camera**: a Toggle.
- **Game section:** **Lock mode** (Toggle / Hold, default Toggle), stored in the game's own settings record as an account field.

### 12.3 Localization (PRODUCT.L)

- Every string goes through core `t()`: screens, HUD, item names and descriptions, signs, NPC lines, the item-get banners, the boss name and the end text. There is no text in textures.
- The source locale is English. Every layout contract runs in the `xx-long` pseudo-locale, so the dialogue box wraps within three lines at compact height and scrolls in a declared region.
- Dialogue is a list of message keys per NPC (`npc.lamplighter.1` …), stepped with Action. The text is authored in `content/messages/*.json` by hand, an editor gap (§17).
- Number formatting (embers, time) uses `Intl`. Right-to-left is handled by core (`<html dir>`), and the HUD mirrors through inline-start and inline-end positions.

## 13. Flows

**Boot.**
1. The empty page loads, and `main.ts` imports `render-pixi/no-eval` first.
2. Runtime boots `Hosting`. The SDK init asks for `menu`, and pause behaviour is `pause`. Wait for ready; nothing renders before it (R-04).
3. Load the content: palette, figures, poses, clips, camera views, the two area files compiled at boot (G3-u checks the cost), and the messages.
4. Build `render-pixi3d`'s view, the look chain, the screens and the `Save` service.
5. Splash.

**Menu.** Continue (shown when the slot is ready), New game (asks first if a save exists), Settings. Continue loads the slot and enters `resume`'s area entrance. New game starts the hub at `spawn` and calls `session.round.start()`.

**Play, per frame.**
1. The runtime loop steps the sim at 60 Hz, at most 5 steps a frame.
2. Each step, the command mapping reads `Input` once and sends `move` (the quantized stick), `camera-turn { units }` (drag, stick and keys; `turnUnitsFromPixels`, clamped), `lock`, `lock-cycle`, `attack`, `shield`, `action`, `item` and `equip`.
3. The renderer reads render rows: positions interpolated, view and heading, lock and aim, and the figure state with `action`, `length` and `stances`.
4. Presentation listens to sim events for sparks, shake, sounds and HUD changes.

**Room entry.** A sim system notices the sector's view changed. It sets `view` (and `heading`, if the view has a yaw), latches the stick, resets the room-local pieces, spawns the enemies and marks the room visited. The renderer calls `activate(view, 'cut')` at doorways and `'ease'` for the boss's entry shot exit.

**Area change.** `area-exit` → a 300 ms fade (presentation) → the sim swaps the area's compiled geometry and places Wick at the entry → the view cuts → the fade comes back.

**Item get.** Opening a chest freezes enemies (sim `cutscene` flag, 90 ticks). Wick plays `item-get` (a clip with the item held overhead), and a banner shows the item's name and use. Action dismisses it after 30 ticks. For a key item, a `write` follows.

**Pause.** The pause button, Escape/P, the host's menu, or the lifecycle going to background stops stepping. Tabs: Items, Map, Settings, Quit. Resume restores focus to play.

**End.** On `boss.defeated`: the hearth shot plays, then the round completes (`session.round.complete`), then the end screen shows the time and heart pieces with **Continue** (back to the hub with everything kept, `resume: 'hub'`) and **Menu**.

**Game over.** §7.8.

**Shutdown and restart.** The scope closes the sim, the renderer, the audio and the input. A context loss restores the same sim hash (X-c), and the scene rebuilds from content.

## 14. Controls

### 14.1 Commands (sim input)

| Command | Payload | From |
|---|---|---|
| `move` | quantized stick `{x, y}` −127..127 (M4-D2) | Touch stick, left stick, WASD and arrows (digital → ±127) |
| `camera-turn` | `{ units }` integer, ±8,192 a step at most | Drag, right stick, Q/E; ignored while locked or in `rotate: false` views |
| `lock` | `{ down: boolean }` | Lock button, LT/L2, F |
| `lock-cycle` | `{ dir: -1 \| 1 }` | While locked: a drag ≥ 40 px, a right-stick flick, Q/E |
| `attack` | `{ down: boolean }` | Attack button, X/Square, J, left mouse on the scene |
| `shield` | `{ down: boolean }` | Shield button, RB/R1, L or Left Shift |
| `action` | press | Action button, A/Cross, Space or K |
| `item` | `{ down: boolean }` | Item button, Y/Triangle, R |
| `equip` | `{ item }` | Items screen; 1, 2, 3; LB cycles |

### 14.2 Keyboard and mouse

WASD or the arrows move. **Q/E** turn the camera (or cycle while locked), and a **right-button drag** turns it. **J** or the **left button** attacks. **Space/K** is Action and roll. **L/Left Shift** holds the shield. **F** locks on. **R** uses the item. **1/2/3** equip. **M** opens the map, **I** the items. **Escape/P** pauses. **Middle click or C** recentres the camera. Everything can be rebound through M4.4. The left button on a HUD control is the control's, not an attack (M4.12: a primary click is never a turn, and the scene surface sends Attack only for a primary press that lands on the scene).

### 14.3 Gamepad (standard mapping)

The left stick moves. The right stick turns the camera at 180°/s and flicks to cycle while locked. **R3** recentres. **A/Cross** is Action and roll. **X/Square** attacks. **RB/R1** is the shield. **LT/L2** locks on. **Y/Triangle** uses the item. **LB** cycles the equipped item forward (RB is the shield). **Start** pauses and **Back/Select** opens the map. Prompts follow the device (M4.4).

### 14.4 Touch (M4's overlay, M4.12's stick and drag)

- **The stick** is M4.12's floating stick, in a 96 px square zone at the overlay's inline-start (96×48 at compact height), with a 48 px radius and the runtime's 0.25 dead zone.
- **The camera drag** is M4.12's `CameraDragSurface` under the controls. A drag never starts in `hostReserved` or on a control. While locked, it cycles (§11.2).
- **Buttons**, in M4's `end` group, all **48 px** (the primary size) with 8 px gaps, all `required`: **Attack**, **Action** (its label follows the context prompt), **Shield**, **Lock**, **Item** (it shows the equipped item's icon and ammo). One row at the end is 5 × 48 + 4 × 8 = **272 px** wide.
- **Corner controls:** Pause and Map (44 px).

| Viewport | Layout |
|---|---|
| **844×390** (phone landscape) | The stick zone 96×96 at bottom-left; the button row bottom-right; the corner row at top-right. Between them, 844 − 96 − 272 − margins leaves about 430 px of scene for the drag. The figure is about 115 px tall at the frame's middle, clear of both groups |
| **780×270** (compact landscape) | The stick zone 96×48. The button row stays 48 px, one row at bottom-right (272 px). The corner row is at top-right (44 px). The scene band between them is about 270 − 44 − 48 − 2 × 16 ≈ 146 px tall, and the figure is about 79 px. Nothing shrinks, and all five buttons stay (they fit in one row, so the reduced set is never needed) |
| **Portrait (any)** | M4's rotate hint, `rotateHint: 'block'` (the default): the game pauses under the cover until rotated (G3-x) |
| **Tablet landscape** | As the phone layout, with larger gaps (M4 §8) |
| **`hostReserved` on either edge** | Both groups move inside `visible` without remounting (M4 §4.9) |

The ergonomics of a five-button row against an Ocarina-style cluster is GAME3D-D8. The default is M4's row, with no core change. If the Owner's device pass asks for a cluster (Attack larger and central, the others around it), that becomes a request to the ui lane for a cluster arrangement in `TouchControls`.

## 15. Positional audio

**What core has** (`main` `30e9606c`, `packages/runtime/src/audio/audio.manager.ts`):
- `Audio.sound(alias, { bus?, gain?, rate? })`, voices on buses, ducking, music, mute and the unlock.
- **No pan and no listener.** `audio-voices.ts` notes that the pan is left out of the FloorFifty extraction.

**What base-3d needs:**
- A hit, a footstep, a Wisp's shriek or a Sootling's windup should come from its side of the screen and grow quieter with distance. With a camera the player turns, that is how a sound tells where an attack is coming from (§8.1).
- Loops that follow a moving source are not needed for 1.0. The Warden's rumble is non-positional ambience.

**The smallest addition** (a request to the **runtime** lane, an additive amendment to the M5 spec §4.6; it needs a row in 02 by the integration owner):

```ts
// packages/runtime/src/audio/audio.manager.ts — SoundOptions gains one optional field
readonly pan?: number // −1 (left) .. 1 (right); 0 or absent: centred, as today. A StereoPannerNode on the voice, before its gain.
```

- It is additive. With `pan` absent, the graph is unchanged sample for sample, so existing tests and Emberwick are unaffected. Non-finite values read as 0, and values are clamped.
- `StereoPannerNode` is in every target engine, Safari included since 14.1.

**What stays in the game (presentation):** a `spatial(listener, at)` helper written after The Last Light's `src/audio/mixer.ts` at `92e6704`.
- The **listener** is the camera's focus point on the ground plane and the sim's heading. The interpolated heading is used, not the sim's raw value, so a sound stays where the picture is.
- **Pan** = 0.8 × the clamped dot product of the source direction with the camera's right vector.
- **Gain** = 1 within 2 m, then 2 / (2 + 0.6 × (d − 2)).
- The game calls `audio.sound(alias, { bus: 'effects', gain, pan })` when it plays a cue. The cue map (sim event → sound alias) is game code, because the event-to-cue editor belongs to the Plus `audio-synth` (EDS §2).

Until the core request lands, base-3d plays its cues centred with the distance gain only. G3-w checks the pan once the request is merged.

## 16. Target devices and budgets

| Profile | Size (landscape) | Budget | Gate |
|---|---|---|---|
| Galaxy S20 profile | 800×360, DPR 3, Chromium, 4× CPU throttle (M3-D6) | p95 ≤ 33.3 ms over 20 s after a 3 s warm-up, WebGL2 and WebGPU | Frame-budget probe (PRODUCT.7) on the GPU runner (af-mac), exclusive (CI.N1a) |
| iPhone 13 profile | 844×390, DPR 3, Chromium, 4× throttle; WebKit at the same size without throttle | Same | Same |
| Desktop | The probe's desktop profile | The budget PRODUCT.7 recorded; no new number here | Same |
| Real phones | One Android and one iPhone under Ruken's local stack | Played through; device, browser, renderer and date recorded | **Owner** (GAME-3D.1l) |

**Content ceilings (design limits, to be confirmed by S7-Q8 and S7-Q9's measured costs; not measured yet):**
- At most **6 animated figures** on screen: Wick, 4 enemies and 1 more (or the Warden alone with 2 Sootlings).
- At most **2 lamps** lighting figures per room.
- At most **40 static props** per room.
- One fading occluder at a time on the camera-to-Wick line.
- Pot and ash particles drawn from a fixed pool of 64.

If the probe misses, the ceilings are cut, never the budget (03: "the frame budget is not loosened"). The cut values become checks in base-3d's content tests. The measurement runs on the heaviest scenes: D7's second wave, the boss phase 2 breath with the trench fog, and the hub with three townsfolk and five pots.

## 17. Content: authored in the editors, and the editor gaps

> **Amended 2026-10-31 (the trimmed slice):** see §0, which wins where they disagree.

The Owner: "use the editors". The editors and formats come from the EDS spec (§2, EDS-D4) and the ED3D spec (§4.6, §4.7).

| Content | Format and path | Editor | Gap? |
|---|---|---|---|
| Hub and kiln geometry: sectors, heights, portals, the stair steps, walls with `occlude`, sector `view` ids | `af-sector/1`: `content/levels/hub.af-sector.json`, `content/levels/kiln.af-sector.json` | **Levels 3D (ED3D)** | No. `view` and `occlude` are already in the schema (`packages/editor-3d/src/format/af-sector.schema.ts`) |
| Dungeon pieces and spawns as entities (§10's defs, typed fields) | `entityDefs` and `entities` in the same files | **ED3D** Things layer and definitions editor (ED3D.13) | No |
| `camera-view` content (tilt, distance, bounds, yaw, rotate) | `content/camera-views/*.toml` (`render-pixi3d`'s schema) | ED3D previews a view (the M3 §16 request) but no listed editor **writes** `camera-view` files | **Gap 1:** hand-edited until ED3D or the Tuner covers it; request to the ED3D lane |
| Slopes (GAME-3D.1g wants "stairs and slopes") | A sector with a sloped floor | ED3D §2.1: floors are flat inside a sector | **Gap 2:** stairs are stepped sectors (covered); **slopes are out until `af-sector` gains a sloped floor**. Request to the ED3D lane; until then GAME-3D.1g proves stairs and a ramp made of small steps, and the doc's rooms use no true slope |
| Props as meshes (pots, chests, lanterns, the bonfire, pillars) | GLB or `.bin` files referenced by an entity field `model` | ED3D places them as boxes; it cannot preview the mesh | **Gap 3 (preview only):** placement works and the look shows only in the game. The GLBs are made by hand or procedurally in game code (the props pipeline is Plus) |
| Figures: Wick, Sootling, Ash Knight, the Captain, the Warden, the 3 townsfolk | `content/figures/*.toml` | **Studio** (EDS.9a) | No |
| Items in the figure library: sword, shield, sling, hookchain, bomb (with holds) | `content/figure-library/*.toml` | **Studio** (the library is in its scope) | No; FigureBuilder's library has no sword or shield (M3.7b), so they are authored new |
| Poses and clips with markers and cues (every move in §7.2, the enemies' moves, item-get, talk idles) | `content/figure-poses/*.toml`, `content/figure-clips/*.toml` | **Studio** (EDS.9b, 9c) | No |
| Frame data, enemy kinds, items, drop tables, boss phases (structure) | Game modules `src/content/*.content.ts` | none | **Gap 4:** hand-edited. Combat data has no free editor (the Feel editor is Plus and edits `feel`, not frame data) |
| Tunables (speeds, ranges, windups, hitstop, shake, lock range, assist rate) | `content/tuning.toml` with `tuning-meta.json` bounds | **Tuner** (EDS.4a) | No; every number in §7, §8, §9 and §11 marked "starting value" is a tunable |
| Strings and dialogue | `content/messages/*.json` (PRODUCT.L) | The Writer is Plus and edits `narrative` | **Gap 5:** hand-edited |
| Sounds | Core sound recipes (ASSET.0's format, rendered at build) | **Audio** (EDS.5a, free recipes) | No |
| The event-to-cue map | Game code (`src/audio/cues.ts`) | The cue map panel is Plus (`audio-synth`) | **Gap 6:** hand-edited |
| The boss entry shot, the hearth shot, item-get timing | Game code | Sequence is Plus (`cutscenes`) | **Gap 7:** hand-edited |
| Screens, HUD and the map's look | Game code on `ui` primitives | No UI composer exists (EDS: `NO_EDITOR_YET`) | **Gap 8:** code |
| Music (hub, kiln, boss) | Core music (a song rendered at build, ASSET.3) | Audio editor if ASSET.3 gives it a format; otherwise none | **Gap 9 (conditional)** |

**How gaps are logged.** An edit an editor cannot make is made by hand and logged as an editor gap for that editor's lane (M3R-D17). base-3d keeps the ledger in `games/base-3d/EDITOR-GAPS.md`, which GAME-3D.1i to 1k create on their first gap: id, editor, the edit, the file and the requesting row. Each gap also goes to its lane as a request in the PR that met it. Gaps 1 and 2 go to the ED3D lane now (§21).

## 18. The M3 spec §18 parity list, row by row

| §18 row | Verdict | Amendment or note |
|---|---|---|
| Reference game: splash → menu → room → pause → end, touch, Ruken → `games/base-3d` | **Confirmed** | The flow grows to splash → menu → hub → dungeon → boss → end with pause, items, map and game over (§13) |
| `render-pixi` init and CSP → `render-pixi3d` under the same rules | **Confirmed** | — |
| The look: Endesga 64, pixel lighting → `post-retro` over the 3D view | **Amended (decision 7)** | base-3d's look is **game code on core's `postFilter`** (M3.7c): low internal resolution, palette lock, outline. `post-retro` stays Plus with its own example in automata-plus |
| Deterministic sim, goldens in four engines → base-3d's golden and `physics-bodies-3d` | **Amended (decision 7)** | base-3d's golden (heading, view, lock target, combat, hitstop, enemies, boss, items, drops) in Node, Chromium, WebKit and Firefox is the game's (B-a, G3-b). `physics-bodies-3d` is **Plus** (M3.7d, B-c) and not part of base-3d |
| Content compiler and hashed content → `figure`, `figure-pose`, `figure-clip`, `camera-view`, 3D levels | **Confirmed, with a note** | `af-sector` levels are read by base-3d's own loader (decision 7) and compiled into the sim content at area load, then hashed. Game tables (moves, enemies, items) are content modules hashed like Emberwick's room |
| Input and display (M4) → lock-on, action and item buttons, camera drag, right stick, rotate gate | **Confirmed** | On M4.12 (PR #204, pending); the layout is §14.4 |
| Saves, audio, localization (M5) → saves with migrations, buses, strings; positional audio for GAME-3D.0 to specify | **Confirmed; positional audio specified** | §12 and §15. Positional audio is the one-field core request (`SoundOptions.pan`) plus game-side panning |
| Gameplay extensions (M6) → rooms on `sectors` and `nav`, keys on `puzzle`, hitstop on `feel`, cutscenes, `debug` | **Amended (decision 7)** | **base-3d uses no M6 extension.** Rooms, keys, switches, hitstop, shake, cutscene-like shots and debug overlays are game code. The M6 extensions' 3D counterparts are M6's tasks in automata-plus, and M9.3 to M9.6 promote base-3d's systems as Plus packages. base-3d needs no `nav`: enemies move straight at Wick, or circle him, inside one room's walls |
| The editors → 3D level editor, Studio, Sequence, Writer, Tuner, Audio, Feel | **Amended (EDS-D4)** | base-3d is authored in **Levels 3D, the Studio, the Tuner and Audio (recipes)**, the free editors. Sequence, Writer and Feel edit Plus content, so base-3d's shots, text and feel are hand-edited and logged as gaps (§17) |
| The asset pipelines → the procedural character pipeline and the props pipeline | **Amended (decision 7)** | The pipelines are Plus. base-3d's figures are authored in the Studio, and its props are made by hand or in code; G5 and G6 belong to M3.9 and M3.10, not to base-3d |
| One-file examples, the catalog, the demo gallery → `render3d-*` and `figures-*` examples | **Confirmed** | The playable base-3d in the gallery is M10.5's, after D-1 lifts |
| DX: template, skills, `automata check` → a 3D template, skills and the guard's `camera-view` range check; GAME-3D.0 places them in M8 | **Confirmed and placed** | §21 and GAME3D-D12, D13 |
| Publishing to Ruken or itch.io, size budgets, the CSP scan → the same `ship` path; refusal while `@pixi/3d` is private | **Confirmed** | Deploys go to Ruken's local stack and the private dev host only, until M9.10 |
| Quality gates → X-a, GPU captures, D3-g, reduced motion, Owner acceptance against Emberwick | **Confirmed** | §19 adds the game's own cases |
| Online play, the store, Party Racer → not asked for | **Confirmed** | — |
| **(new row)** Golden replays of player journeys (Emberwick's scripted run) | **Added** | base-3d's golden is a scripted run through the hub's lantern puzzle and D1 to D2 with combat and lock-on, plus a recorded run through the boss (G3-b, G3-c) |

## 19. Acceptance cases

> **Amended 2026-10-31 (the trimmed slice):** see §0, which wins where they disagree.

The gates are reported separately: implemented; locally verified; GPU-runner verified; deployed (Ruken's local stack and the private dev host); Owner accepted.

**Success:**
- **G3-a.** From New game, a scripted touch-only journey (stick, drag, buttons) at 844×390 reaches the end screen with every chest opened. A keyboard-only journey and a gamepad-only journey (the virtual pad of M4.10) do the same at desktop size.
- **G3-b.** base-3d's golden replay hash (the scripted run: hub lanterns, D1 and D2 with two fights, a parry, a lock cycle, a camera turn and a doorway latch) is identical in Node, Chromium, WebKit and Firefox.
- **G3-c.** A recorded command log of the boss fight replays to the same `boss.defeated` tick and the same final hash in the four engines.
- **G3-d.** Each of Wick's moves opens its hit window on exactly the tick of §7.2's table (by tunables). The content check confirms that the clip's `contact` marker, retimed to `total`, falls on the active start within one tick, for every move that names a clip (M3R-D14).
- **G3-e.** Lock selection picks the target with the smallest rank inside the ±60° cone, takes the nearest within 6 m when the cone is empty, recentres the heading to the facing with no candidate, and breaks the tie by the lower id.
- **G3-f.** While locked, "stick right" circles the target clockwise as seen from above at every heading, and `moveDir` is ±π/2 within one turn unit.
- **G3-g.** The lock assist turns the heading by at most 546 units a tick and stops inside 45°; it never latches the stick mapping. A view change during a lock latches as M3R-D15 says.
- **G3-h.** `lock-cycle` visits every candidate once, in angular order around Wick, and wraps.
- **G3-i.** A hit landing on frames 1 to 8 of `guard` is parried (attacker `stagger` 28, freeze 14). On frame 9 it is blocked (blockstun 12, no damage). A `low` or unblockable hit is never blocked.
- **G3-j.** Hitstop freezes every sim entity and timer except the freeze counter and the input buffer. An Attack pressed during hitstop starts the next slash on the first live tick in its window.
- **G3-k.** Two hits that land on the same tick both resolve (they trade), in entity-id order.
- **G3-l.** At most 2 enemies hold an attack token at any tick of the golden run, and no enemy starts a windup without one. Every enemy attack's windup is at least 24 ticks (the boss's at least 36), checked over the content tables.
- **G3-m.** A Sootling, an Ash Knight and a Wisp each die to the counterplay of §8.2 in a unit scene; the Ash Knight blocks a frontal slash and takes a slash from behind.
- **G3-n.** The Warden goes to phase 2 at 12 HP; a parried slam staggers it for 90 ticks; a pellet into its mouth during the inhale staggers it for 120 ticks; a bomb in its charge path knocks it down.
- **G3-o.** The sling's ground-plane aim (§9.2) hits a `sling-target` within ±6° of the aim line and in range at its authored height, and flies level otherwise. The hookchain pulls Wick to a post in a straight line and never through a wall.
- **G3-p.** The content check passes on both areas: every `sling-target` has a height between 0.5 and 3 m, every `hook-post` is reachable from a floor within 8 m in plan, and every door's lock names an existing key, switch or clear rule.
- **G3-q.** A solver test over the compiled areas proves that every chest, key, heart piece and the boss room can be reached from `spawn` with the items available at that point, in the §6.5 order, so the dungeon cannot soft-lock: no small-key door can use up a key needed to reach another key.
- **G3-r.** Each door kind draws its own marker (keyhole, boss plate, bars, switch link) in a render test of the four kinds.
- **G3-s.** The save round-trips through Ruken's fake host. The version-2 test fixture migrates from version 1 and parses. Continue resumes at the area entrance with the flags, items and keys of the last write.
- **G3-t.** Every string shown in the golden run's screens comes from `t()`. With `xx-long`, every screen passes `checkLayout` at 844×390 and 780×270 with no clipped primary action.
- **G3-u.** Booting under the fake host renders nothing before ready, with zero console errors and zero CSP violations. Loading and compiling both areas takes less than the boot budget recorded by the first run (measured, then held).
- **G3-v.** At 844×390 and 780×270, under each `hostReserved` variant, the stick zone and the five buttons are at full size (48 px, the stick 96 px), pass `checkLayout`, and a point of the scene between them hits the drag surface.
- **G3-w.** (After the core `pan` request lands.) A cue at a source 3 m to the camera's right plays with pan 0.8 × the dot product and the distance gain, at every heading; with `pan` absent, core's graph is unchanged sample for sample.
- **G3-x.** In portrait the rotate cover shows and the sim does not step; rotating back resumes with the same state and focus.
- **G3-y.** Both phone profiles hold p95 ≤ 33.3 ms on the heaviest scenes of §16, WebGL2 and WebGPU, under Ruken's CSP, on the GPU runner (X-a for the full game).
- **G3-z.** Reduced motion makes view eases, the fade, shake, the entry shot's moves and occluder fades instant or off; the clips and the gait still play.
- **G3-aa.** The camera-turn settings: speed 0.5 doubles the turn units of the same drag, the pad and key rates in proportion; invert negates them; lock mode Hold releases on the button's release.

**Failure (shown by tests):**
- **G3-F1.** A move whose clip lacks the `contact` marker, or whose retimed marker misses the active start by more than one tick, fails base-3d's content check with the move id and the clip.
- **G3-F2.** An `af-sector` entity with an unknown `kind`, `lock`, `contents` or a dangling ref fails the area load with the file and the JSON path (ED3D's locator).
- **G3-F3.** A save from a newer build is read-only: Continue is disabled, and no autosave writes. An unreadable save is never overwritten without the player's confirmation.
- **G3-F4.** A host that refuses saves shows the notice once, and nothing is written to device storage.
- **G3-F5.** A `NaN` or infinite drag never reaches the sim; a `camera-turn` beyond ±8,192 is clamped; `camera-turn` in a `rotate: false` view or while locked changes nothing.
- **G3-F6.** Pushing a block into a wall, another block or a pit leaves it in place; a block never overlaps Wick.
- **G3-F7.** An enemy whose brain names a missing clip logs one warning and keeps its locomotion; content that names a missing clip fails compile (M3 §6).
- **G3-F8.** A hit on a dying or defeated enemy (same tick) applies once; a defeated boss never re-enters a phase.

**Owner acceptance (never ticked by an agent):**
- The design doc reviewed, and GAME3D-D3 (the ranged aim) kept or vetoed.
- base-3d played through on a real Android phone and an iPhone under Ruken's local stack, with device, browser, renderer and date recorded.
- The look, the figures, the poses, the clips and the combat feel judged against Emberwick's quality from real-device captures and the played game (M3R-D17).
- The touch layout (GAME3D-D8) on the devices.

## 20. GAME-3D.1a to 1l: what each row builds

> **Amended 2026-10-31 (the trimmed slice):** see §0, which wins where they disagree.

| Row | Builds (sections) | Its acceptance cases |
|---|---|---|
| **1a** flow, saves, localization | §12, §13 (boot, menu, pause, end, game over, area change), screens, settings rows (lock mode) | G3-s, G3-t, G3-u, G3-x, G3-F3, G3-F4 |
| **1b** lock-on and camera framing (sim) | §11, the assist, `frame(lock)` wiring, aim rows | G3-e, G3-f, G3-g, G3-h, part of G3-b |
| **1c** combat | §7: moves, buffering, hits, block, parry, roll, hops, hurt, fall, knockdown, hitstop, shake and sparks, pose transitions | G3-d, G3-i, G3-j, G3-k, G3-F1, G3-F8 |
| **1d** enemies and boss | §8, attack tokens, drops, the boss phases, the entry and hearth shots | G3-c, G3-l, G3-m, G3-n, G3-F7 |
| **1e** items, inventory, map | §9: the three items, ammo, the aim, the Items and Map screens, HUD | G3-o, the map and HUD DOM tests |
| **1f** dungeon pieces | §10: every entity def and its rule, persistence, resets | G3-p, G3-q, G3-r, G3-F2, G3-F6 |
| **1g** ground-contact IK | Feet planted on D5's stair and the hub's steps (a probe against baked geometry with M3's pins); slopes wait for gap 2 | Its own cases in its plan (feet within tolerance on each step); no gameplay change (the golden is unchanged) |
| **1h** controls | §14: the command mapping, the touch layout, the drag cycling, keys and pad, the camera settings, the rotate gate | G3-v, G3-aa, G3-F5, G3-a's input halves |
| **1i** levels in ED3D | §6: the hub and the kiln as `af-sector` files with views, occluders and entities; editor gaps 1 to 3 logged | G3-p and G3-q on the authored files |
| **1j** figures, poses, clips in the Studio | Wick, the 3 enemies, the Captain, the Warden, the 3 townsfolk, the item library entries, every clip of §7.2 and §8 | G3-d on the authored clips; I-g and I-h hold for the game's clips |
| **1k** text, tuning, audio, feel | Messages (gap 5), `tuning.toml` in the Tuner, sound recipes in Audio, the cue map (gap 6), the shots (gap 7), music (gap 9); positional panning | G3-t (strings), G3-w (when core pan lands), G3-z |
| **1l** gates, deploy, acceptance | The golden in four engines, the journeys at phone sizes, the frame budget, deploy, the Owner's passes | G3-a, G3-b, G3-y, X-a; the Owner acceptance |

## 21. Requests to other lanes and to the integration owner

None of these edits 00 to 04 or `AGENTS.md`; the integration owner applies the 02 changes.

| To | Request | Why |
|---|---|---|
| **runtime** (M5 audio; an M5 §4.6 amendment) | `SoundOptions.pan?: number` with a `StereoPannerNode` per voice, additive (§15) | Positional audio; needs a 02 row (suggested id **M5.3p**, lane runtime, size S, before GAME-3D.1k) |
| **editor-3d** (ED3D) | (1) Write `camera-view` files, or edit the view of a selected sector in the inspector (gap 1). (2) A sloped floor in `af-sector` (gap 2). Both are format or UI amendments the ED3D lane decides | GAME-3D.1i and 1g |
| **ui** (M4) | Only if GAME3D-D8 is vetoed after the device pass: a cluster arrangement for `TouchControls`' end group | The touch ergonomics |
| **render3d** | Only if GAME3D-D3 is vetoed: a first-person aim view outside `CameraRig` (M3 §17 option A) | The ranged aim |
| **integration (02)** | Place **GAME-3D.T** in M8 (GAME3D-D12): prerequisites GAME-3D.1l and M9.10 (the template installs the published `render-pixi3d` and `figures`) and DX.5; make it a prerequisite of **M8.6b** (its 3D guide uses the template), **M8.9** (the 1.0 release) and **M8.9s** (the skills mirror carries the 3D skill). Note the GAME3D-D13 check in GAME-3D.T's row | §18's DX row |
| **integration (02)** | GAME-3D.1g's row: "stairs and slopes" becomes "stairs; slopes when `af-sector` has them" (gap 2) | ED3D §2.1 |
| **integration (02, 03)** | Record GAME3D-D1 to D20 for the Owner's veto, and D21 (the Owner's layout direction), and the doc's status | The review |

### 21.1 GAME-3D.T among M8's tasks (GAME3D-D12)

- **The template.** `automata create-game --template 3d` (DX.5's `create-game`, lane ship) writes a small 3D game: one `af-sector` room with a `camera-view`, Wick as figure content with the pose library and two clips, the free packages (`render-pixi3d`, `figures`), a sim plugin with heading, view and latch, and a golden test. It lands **after M9.9**, so it uses the promoted free controller package (M9.2), not base-3d's game code, and **after M9.10**, so it installs published packages rather than the vendored beta (a template a user runs cannot carry a private tarball). Until then, a workspace-only test keeps it building. It does not ship lock-on or combat (those are Plus after M9); the template's README points to base-3d as the full example.
- **The skill.** `agents/automata/skills/automata-3d/` (beside `automata`, `automata-api`, `automata-feature` and `automata-verify`): the camera rules (24 mm, 25°, 5 m, free turn, heading in the sim), figures, poses and clips through the Studio, `af-sector` levels, and the content checks. It is written with M9.9's per-package skills and is mirrored by M8.9s.
- **The check** (GAME3D-D13). The camera-view range and the lens lock are an **`automata check` step** (DX.6's `packages/cli/src/check`), so that a free game gets it without the Plus pipelines guard. It refuses a `camera-view` with a tilt outside 15° to 60° or a distance outside 3 to 12 m. It also refuses a `lensMm` other than 24 where a game declares one, unless the game's own `pipeline.toml`/ship config records a different lens decision. The schema already refuses out-of-range views at compile time, so the step reports them with file and line before the build.
- **Order in M8:** DX.5 → M9.9 → M9.10 (= M8.9a) → GAME-3D.T → M8.6b (the 3D guide) → M8.9 (the release) → M8.9s (the mirror).

## 22. Open decisions (recommended defaults, in effect until the Owner vetoes)

| ID | Question | Recommended default | Why |
|---|---|---|---|
| GAME3D-D1 | Title and hero | Working title **The Cold Kiln**; the hero is **Wick**, Emberwick's character, as figure content | Wick is already AF's fixture figure (M3 §4.4.1) and ties the two base games together; the title is a placeholder |
| GAME3D-D2 | Scope | One hub, one **8-room** dungeon (7 + boss), the Warden, sword and shield plus **three items** (Sling, Bombs, Hookchain), 3 enemy types plus a mini-boss variant, 4 heart pieces, one save slot | The suggested scope at its upper end, so every Ocarina verb (lock-on, keys, items opening the dungeon, a boss) is proven once |
| GAME3D-D3 | Ranged-item aim | **Ground-plane aim with lock-on assist** (option C, §9.2) | One thumb on a phone, no second camera, the Owner's camera kept, exact in the sim |
| GAME3D-D4 | Lock mode | **Toggle** by default; Hold as a setting | Toggle frees a thumb on touch; Hold is Ocarina's and stays available |
| GAME3D-D5 | The camera while locked | **The sim's lock assist** turns the heading toward the target past 45° off-axis, at up to 180°/s; manual turning is off while locked, and the drag cycles targets | M3 gives framing but no yaw; with a free camera a target behind Wick would be off screen. It is the sim's because the heading drives movement |
| GAME3D-D6 | Hitstop scope | **Global** (the whole sim freezes), as The Last Light's duel | A single-player game with at most 4 enemies; a local freeze (the brawl's) would let a second enemy act during the first's hitstop and hurt readability |
| GAME3D-D7 | Positional audio | **Core gets `SoundOptions.pan`; the listener, pan law and distance gain stay in the game** | The smallest core change; a listener-in-core would be a speculative abstraction with one consumer |
| GAME3D-D8 | Touch layout | **M4's end group, one row of five 48 px buttons**, the M4.12 stick and drag; no core change | It fits at 780×270 at full size; a cluster waits for the Owner's device pass |
| GAME3D-D9 | Where Continue resumes | **The area's entrance**, with persistent flags only; room-local state resets | No half-solved room restored; a simple, robust save shape |
| GAME3D-D10 | The flying enemy | **A Wisp: a static mesh animated in game code**, not a figure | The figure generator is humanoid; a bat would need non-humanoid figures (not in M3) |
| GAME3D-D11 | Fall penalty | **One half-heart**, back to the room's last entry | Ocarina's rule; soft on touch players |
| GAME3D-D12 | GAME-3D.T in M8 | **After M9.9 and M9.10, before M8.6b, M8.9 and M8.9s** (§21.1) | The template must install published packages and the promoted controller |
| GAME3D-D13 | The camera-view range and lens check for a free game | **An `automata check` step**, not the Plus pipelines guard | Decision 7: a free game has no Plus guard |
| GAME3D-D14 | How The Last Light's combat comes in | **Rules and numbers rewritten in fixed point**, source path and `92e6704` recorded per file; its replay tests come across as behaviours | Its code uses float trig and `**`, which the sim boundary forbids |
| GAME3D-D15 | Block damage | **None** (the source takes 1 HP) | Lets a beginner learn by turtling; parry is the reward |
| GAME3D-D16 | Quick swap on touch | **Through the Items screen only** (no sixth button) | Keeps the overlay at five required buttons |
| GAME3D-D17 | Enemy respawn | **Respawn on room re-entry**, except the mini-boss and the boss | Ocarina's rule; keeps backtracking alive for drops |
| GAME3D-D18 | Camera turn speed setting | **One slider scales drag, stick and keys together** (180°/s and 120°/s at the default 0.25°/px) | One setting is easier to explain; M4-D16 leaves the rates to the game |
| GAME3D-D19 | Jumping | **No jump button**; marked ledge drops, stairs and the hookchain | Ocarina's model; one less touch button; no physics |
| GAME3D-D20 | The boss as a figure | **The Warden is a 3.2 m procedural figure** with plate garments | It proves figures at scale; if the sliders cannot reach 3.2 m, the fallback is a 2.4 m figure on a stone plinth, recorded in GAME-3D.1j |
| GAME3D-D21 | Code layout | **EsperRedux's flat layout, one file per role** (`constants`, `components`, `commands`, `systems`, `events`, `state`, `views`, `main`, `game.test`), with `systems/` and `state/` as folders when they grow and `screens/` and `content/` as folders (§3.1) | **The Owner's direction, 2026-10-30** (AF games, the template and the examples take this layout); GL.0 specifies it. Not a default for veto: recorded here so the code follows it from the first commit |

## 23. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| M3's critical path (to M3.10) runs about three weeks (03), and the editors come first | GAME-3D.1 starts late | Rows 1b to 1d (sim) can start on M3.7a's plugin with placeholder clips before EDS.9c; content rows wait for the editors |
| Combat feel at 12 poses a second | Slashes may read late | Markers snap the contact pose to the hit tick (M3 §4.4.4); combo clips may raise `rate` (a clip field) |
| Five buttons in a row on small phones | Thumb travel | GAME3D-D8's device pass; the cluster request is ready |
| The figure count per room on phone profiles | A frame budget miss | The ceilings in §16 are cut first; S7-Q8 and Q9 give the real costs |
| Two copies of lock-on, combat and items after M9 (base-3d's and Plus) | Drift | The same golden for both; the M9 spec sets the porting rule |
| `@pixi/3d` public release changes behaviour | Re-verification | M9.10 re-runs S7; base-3d's captures and golden are re-checked then |
| A content-heavy game with many hand-edited gaps | "Use the editors" partly unmet | The gap ledger (§17) makes every gap visible, and each is a request to its lane |

## 24. Ruken alignment

- The handshake, ready gate, lifecycle (background pauses), menu request (opens pause), and rounds (`round.start` on New game and Continue; `round.complete` on the boss's defeat; `quit` on Quit) come from `@ruken/sdk`, through `Hosting` (never the SDK bridge directly).
- Saves use `Hosting.saves` through M5's `Save`, one key, Ruken's key rule.
- Headers: `compileHeaders`' CSP, no eval (`render-pixi/no-eval` first).
- The manifest comes from `ship.config.ts` (`runtime.orientation = "landscape"`, renderer `webgl2`, file types `.glb` and `.bin` per M3 §11).
- **No new Ruken request.** Positional audio is an AF core change, not a host capability.

## 25. Sources

| Source | Revision | Used for |
|---|---|---|
| AF `main` | `30e9606c` | The specs and rows cited above; `af-sector.schema.ts` (`view`, `occlude`); `audio.manager.ts` and `audio-voices.ts` (no pan); `touch-button.ts` (groups, `required`); `games/emberwick`'s layout and e2e projects |
| M4 §16 (M4.12), PR #204 | branch `claude/3d-m4-12-analog-input` at `0b23f8ca` | The stick, drag, turn units and camera settings |
| The Last Light, `mcthaydt/PixiJS3D_Experiment_001` | `92e6704` | `src/fight/moves.ts`, `sim.ts`, `director.ts`, `brawl/moves.ts`, `brawl/sim.ts`, `tests/fight.test.ts`, `tests/brawl.test.ts` (§7); `src/game/pursuit.ts` and `agents.ts` as the enemy reference (§8.1); `src/audio/mixer.ts` (`spatial`, `Listener`, §15) |
| FigureBuilder, `mcthaydt/FigureBuilder` | `a1f7246` | Through the M3 and EDS specs (the figure generator, its library, the Studio's sources); not re-read for this doc |
| Crow Country's camera, Ocarina of Time's structure | — | Cited through the M3 spec and the Owner's words; nothing is copied |
