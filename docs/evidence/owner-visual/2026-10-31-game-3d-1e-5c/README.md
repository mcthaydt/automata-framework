# GAME-3D.1e part 5c: review images (2026-10-31)

The Map screen (DESIGN.md §9.4) and the HUD's Map button. Taken from a production build (`vite build` +
`vite preview`) in headless Chromium with SwiftShader, after New game, then M.

One throwaway patch made the outline state show; it was reverted and is not committed: `newGame()` gave the kiln's
map (`kiln.map: true`), so the unvisited kiln is outlined. (New game captures over `newGame()` since 5b's save fix,
so the patch shows directly.)

| Image | What it shows |
|---|---|
| `map-844x390.png` | The plan, north up, on a panel: the hall Wick stands in filled, the kiln (unvisited, with the map) as a dashed outline, the walls with the 2 m doorway between the rooms, Wick's yellow arrow facing north and the camera's 60° cyan wedge; the corner Close and the title |
| `map-780x270.png` | The compact height: the plan keeps its 240 px floor and scrolls inside its region, opened scrolled to Wick; Close stays fixed |
| `hud-map-button-844x390.png` | Play: the HUD's 44 px Map button at the top inline-end, under the corner Pause |

## Against the reference (DESIGN.md §9.4; no mockup exists for the screen)

- Drawn from the compiled geometry, nothing authored: rooms are the area's plan boxes, walls its wall boxes.
- Visited rooms filled; with the map, unvisited ones as outlines: as specified. Visits come from the save's
  `kiln.visited` plus the room Wick stands in; nothing records visits in the sim yet (GAME-3D.1f).
- Wick's arrow and the camera's wedge: as specified.
- Not yet drawn: the compass's chests and boss mark, the doors' lock kinds, and the hub's own map. Nothing in the sim
  names them yet (GAME-3D.1f's entities, the hub).
- Scales to the container; at compact height it scrolls inside a declared region and Close stays fixed: as specified.
- The Map button is not in the frame's corner row beside Pause: the play screen has no seam for a game's corner
  controls, so it sits at the HUD's top inline-end, under Pause.

## The Items screen, after the #340 review

The same throwaway patch as 5b's (`resources.ts`: the sling with 12 pellets, equipped, the hookchain, 37 embers;
reverted).

| Image | What it shows |
|---|---|
| `items-panel-844x390.png` | The contents on a panel of their own (`--af-surface`), so the grey labels no longer sit on the 3D scene; the Sword and Shield flat and edgeless with "Own button" under their names (owned, not choosable, `aria-disabled`), apart from the choosable Spark Sling (equipped, accent border) and Hookchain (focused), and the dashed "Not found yet" Bombs |
| `items-panel-780x270.png` | The same at the compact height |
