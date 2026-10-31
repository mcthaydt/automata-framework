# GAME-3D.1a part 3: game over and Lock mode (review images, 2026-10-31)

Captured in the base-3d e2e build under the fake Ruken host (Chromium headless shell, Pixel 7 landscape, software
WebGL2), at 844 × 390 and 780 × 270. Health is GAME-3D.1c's, so the game-over captures came from a local build with a
temporary test plugin that raised `hero.defeated` once Wick walked a metre north; that change was never committed.

| Image | What it shows | What to check |
|---|---|---|
| `game-over-844x390.png` | The game over over the run's last frame, dimmed like paused: "The flame went out", Continue (primary, focused) and Quit | Continue has the focus ring; both buttons are at least 48 px tall; the scrim lets the room read through without hurting the title |
| `game-over-780x270.png` | The same at the compact height | Title and both actions fit without scrolling; nothing clipped |
| `lock-mode-844x390.png` | Settings opened from paused, scrolled to the end: the game's own "Game" group with Lock mode, Toggle (chosen, filled and ticked) and Hold | The group matches the core groups (heading, option-group legend, 44 px options); Toggle is the default |
| `lock-mode-780x270.png` | The same at the compact height | The section is reachable in the Settings scroll region; the tabs and close stay in reach |

The words are English constants until part 2 (localization) moves them to message keys.
