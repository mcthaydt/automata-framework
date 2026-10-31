# GAME-3D.1f part 5: review images (2026-10-31)

The doors' markers in the 3D scene (G3-r, DESIGN.md §6.5) and the map's door kinds, chests and switch link (§9.4).
Taken from a production build (`vite build` + `vite preview`) in headless Chromium with SwiftShader, after New game
(Space at the title), then W held 450 ms, then M.

One throwaway patch placed the pieces; it was reverted and is not committed:

- `content/first-slice.ts`: four doors standing free across the hall at z = 2, each 1.2 m wide (a small-key door at
  x = −3, the boss door at −1.3, a clear door at 0.4, a switch door at 2.4 linked to a plate at (3.4, 0)); a small-key
  chest at (−3.3, −3.3) and a boss-key chest in the kiln at (2.5, 8), and a Sootling in the hall's south-east corner,
  so the content check (G3-p) passes at boot.
- `resources.ts`: the dungeon's defaults hold the map and the compass, so the map outlines the kiln and marks the
  chests.

| Image | What it shows |
|---|---|
| `doors-hall-844x390.png` | Play at New game. The camera looks north, and in this view +x is to the screen's left (the pillar at x = −2 stands right of centre). Left to right: the switch door (a bare slab) with its cyan link on the floor running to the plate; the clear door with three grey bars; the boss door with its large red plate; the small-key door's small brass keyhole plate, partly behind the pillar |
| `doors-near-844x390.png` | The same, a few steps closer, where each marker reads larger |
| `map-doors-844x390.png` | The map: the hall Wick stands in, the kiln outlined (with the map), the four doors in §6.5's legend (brass key, red boss, grey bars, cyan switch), the switch door's dashed link to its plate, and with the compass the two chests (brass squares, closed) |

## Against the reference (DESIGN.md §6.5, §9.4; no mockup exists)

- §6.5: "a small-key door shows a keyhole plate, the boss door a large one, a clear-room door bars, and a switch door
  a link line drawn to its switch". All four show, each in its own colour (Endesga 64, as the HUD's palette). The
  plates sit on both faces at 1.2 m; the bars stand at the doorway's quarters; the link runs along the floor, one leg
  per axis.
- The slab is dark wood (#733e39) under a 2.6 m ceiling, 2.2 m tall. A placeholder look until GAME-3D.1i's authored
  rooms and 1k's art pass: no door frame and no opening animation (an open door is simply not drawn).
- The switch itself, the chests and the plate have no 3D view yet (their props are 1k's). Only the doors are new here.
- The map: doors show their lock kind, and with the compass the chests, as §9.4 says. The boss room's ring needs a
  Warden in the area, which this patch did not place. The map unit case and the layout case in Chromium, WebKit and
  Firefox draw it.
- The free-standing doors are only for the image. In the Kiln, doors fill doorways in walls.
