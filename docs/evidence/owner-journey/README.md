# AF as a user sees it: a screenshot journey (2026-10-23)

Shot from `main` at `1fa4acc` (#91 merged), in Chromium.
- Examples: through the examples dev server (`pnpm --filter @af-examples/examples dev`), at its index on 5173 and its View host on 5124.
- Emberwick (`games/emberwick`): built and previewed.
- UI primitives: from `examples/ui/primitives`.
- Desktop is 1280x720; phones are 390x844, or 844x390 sideways (Pixel 7).
- Nothing is staged: no canvas hidden, no backdrop added, no screen faked. Where something looks wrong, the note says so.

| # | Shot | What it shows |
|---|---|---|
| 01 | `01-examples-index.png` | The examples index: each example with its stars, its controls, and View and Source links. |
| 02 | `02-example-view-input-rebind.png` | An example's View page, `core/input-rebind`: the game on the left, its source on the right. **Note:** the built index (`examples/dist/index.html`) writes relative View links (`game=./core/...`), and the View host then throws "Failed to construct 'URL': Invalid URL" and shows a blank page. Opened from the dev server's index, the links are absolute and work, as here. |
| 03 | `03-emberwick-title.png` | Emberwick, the base-2d game: its title, Play focused, the controls under it. |
| 04 | `04-emberwick-gameplay.png` | Emberwick in play: Wick at the start of the room, the ember at the top. |
| 05 | `05-emberwick-pause.png` | Emberwick's pause. It draws its own (Resume, Quit), not AF's default dialog, and has no Settings screen. So AF's Pause, Settings and Controls are shot on `core/input-rebind` (06 to 08). |
| 06 | `06-af-pause-desktop.png`, `06-af-pause-phone.png` | AF's default Pause (#91): Resume, Mute, Settings, Quit to title. |
| 07 | `07-af-settings-desktop.png`, `07-af-settings-phone.png` | Settings. Desktop: Language beside Audio, then Display. Phone: a full-height sheet, scrolling. Vibration shows on the phone only: a desktop with no pad cannot vibrate. |
| 08 | `08-af-controls-*.png`, `08b-af-rebind-capturing-*.png` | The Controls tab by device, the one in use first; then Jump waiting for a key ("Press…", with the countdown above). |
| 09 | `09-phone-fullscreen-gate.png` | A phone held sideways, standalone: the fullscreen gate over the title. |
| 10 | `10-ui-primitives.png` | The UI primitives page: one primitive (the level-select screen) at four phone sizes, with a primitive and variant picker. |
| 11 | `11-render-quality.png` | `render/quality` in play: squares and a quality readout. **Looks rough:** the readout's text is blurry (drawn at the game's resolution and scaled up). |
| 12 | `12-textures-atlas.png` | `textures/atlas` in play: sprites from an atlas. **Looks sparse:** mostly black, and the second sprite is cut by the right edge. |
| 13 | `13-shapes-draw-hud.png` | `shapes/draw-hud` in play: squares, a minimap and a tick readout. **Looks rough:** the readout's text is blurry, and both HUD panels run into the bottom letterbox bar. |

The desktop examples show the letterbox bars (dark bands top and bottom) where the window's shape differs from the game's.
