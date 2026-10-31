# GAME-3D.1e part 5b: review images (2026-10-31)

The Items screen (DESIGN.md §9.3) and the HUD's Items button. Taken from a production build (`vite build` +
`vite preview`) in headless Chromium with SwiftShader, after New game, then I.

One throwaway patch made every slot state show; it was reverted and is not committed: `resources.ts`'s defaults
gave Wick the sling (12 pellets, equipped) and the hookchain, and 37 embers. Bombs stay unowned.

| Image | What it shows |
|---|---|
| `items-844x390.png` | The Items screen over the dimmed, paused game: the corner Back and the title; the five slots in one row (Sword, Shield, the equipped Spark Sling with "12 / 30" and the accent border, the unowned Bombs as a dashed outline saying "Not found yet", the Hookchain with focus); under them the heart pieces as quarters (none), the embers and the kiln's keys, boss key, map and compass |
| `items-780x270.png` | The compact height: the same, inside the declared scroll region under the fixed corner row |
| `hud-items-button-844x390.png` | Play: the HUD's 44 px Items button under the embers |

## Against the reference (DESIGN.md §9.3; no mockup exists for the screen)

- A grid of five slots, unowned as empty outlines, selecting an owned item equips it: as specified. The sword and
  shield are shown owned and are not choosable (they have their own buttons).
- Heart pieces as quarters, embers, and the kiln's small keys, boss key, map and compass: as specified. The kiln row
  shows in every area until the hub exists (the world has only the kiln's first slice).
- Quick swap: 1, 2 and 3 on the keyboard (in play); touch reaches the screen through the HUD's Items button. The
  gamepad's LB and D-pad focus are not wired yet (the menu-input seam is not exported from the game package;
  GAME-3D.1h). Arrow keys steer the grid.
- Opened by I and the HUD button, not pause → Items, which waits on GAME.PAUSE1.
- Texts come from the game's copy record (screens/copy.ts), in the player's language as the runtime's `Locale`
  gives it; the game has only English so far, so the images show the English record.
