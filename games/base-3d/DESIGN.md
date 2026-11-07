# Ember Hall (base-3d): the free 3D game (design)

> The free game is **Ember Hall**: the 2D reference game's flow, saves, settings and HUD pattern, one room, a
> third-person hero under the angled free-turn camera, and one verb beyond walking, the roll. The decision and its words
> are in [the rescope spec](../../docs/archive/superpowers/specs/2026-10-31-base-3d-emberwick-rescope.md); the plan that built it is
> [free base-3d](../../docs/archive/superpowers/plans/2026-10-31-free-base-3d.md). The action-adventure this game grew from (lock-on,
> combat, enemies, items, the dungeon pieces, the Cold Kiln and the Ashen Warden) moved to Plus; its last copy in this
> repository is the ref `archive/base-3d-adventure`.

## 1. What it is

- **Flow:** splash → menu (Continue when a save is there, New game when it is empty, Settings, which comes back to the menu) → play ("Embers 0 of 6" and Pause on screen) → pause (Resume, Settings, Quit) → end (the goal ember).
- **Screen:** the pixel field takes the shape of the screen the game boots on (`src/features/scene/field.ts`), so on a tablet the room fills its height instead of a band across the middle.
- **Room:** `content/levels/room.af-sector.json`, an `af-sector/1` file: three platforms and two 2 m channels that
  walking cannot cross and the roll's 3.2 m lunge does, five embers and the goal ember. The converter
  (`src/features/room/sector-area.ts`) reads it as the sim's area; the camera views are in `src/features/room/room.ts`
  (editor gap EG-3).
- **Verb:** the roll (24 ticks, 3.2 m, in the way Wick faces). Walking into a channel puts him back on the last safe spot,
  with his embers kept (`hero.fell`).
- **Camera:** 24 mm lens, 25° down, 5 m back, turned freely by the player (M3R-D15 latch on room cuts).
- **Goal:** take every ember you like; the goal ember ends the run.

## 2. Controls

Keys: WASD or the arrows walk, Q and E turn the camera, Space or K roll, Escape or P pause. Gamepad: left stick walks,
right stick turns, A rolls, Start pauses. Touch: the floating stick, a camera drag, and one 48 px Roll button (required)
in the end group; touch targets are at least 44 px.

## 3. Sim

`hero.input` → `hero.move` (walk, roll, fall) → `hero.view` → `ember.take`, at 60 Hz in Q16.16 metres. Commands: `move`,
`camera-turn` (@automata/3d's), `act { roll }`. Events: `ember.taken`, `goal.reached`, `hero.fell`. State: `Progress { taken,
goal }`, `Location` (the return point). The golden replay in `src/game.test.ts` walks the room, falls once, rolls across both
channels and takes the goal; its hash is equal in Node, Chromium, WebKit and Firefox.

## 4. Save

One slot, key `base-3d-free`, version 1: `{ taken: number[], goal, playTicks }` through `Hosting`. A save the adventure wrote
(key `base-3d`) is never read.
