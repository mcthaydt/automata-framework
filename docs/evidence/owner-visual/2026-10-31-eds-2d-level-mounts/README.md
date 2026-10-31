# EDS.2d review images: the level editors in the suite

Made by `packages/editor-suite/src/shell/suite-levels.layout.test.ts` in Chromium (2026-10-31, branch `claude/eds-2d-level-mounts`), with the production CSS at the editor suite spec's §10 sizes. The same test passes in WebKit and Firefox. The canvases are stand-ins on purpose: the 2D level canvas shows nothing (jsdom-style stand-in, so the shot is about layout), and the 3D plan draws to a fake renderer, so its rulers show and its rooms do not. The editors' own canvas projects own the pixels.

| Image | What it shows | What to check |
| --- | --- | --- |
| `levels-2d-ipad-pro-11-landscape.png` | Levels 2D in the suite at 1194 × 834 (wide): the suite's rail, the layers and palette panel, the toolbar over the canvas, the inspector (Entity, Level, Checks) and the level-card dock under the canvas, the file in the status line | One top bar (the suite's: Home, the pills, Undo, Redo, Ship); no second bar from the level view; every control at least 44 px |
| `levels-2d-ipad-mini-portrait.png` | The same at 744 × 1133 (medium), after **Dock** was pressed: the dock strip that opens by default is closed and the canvas is uncovered | The new **Dock** toggle beside Panel and Details in the top bar |
| `levels-2d-phone-portrait.png`, `levels-2d-phone-landscape.png` | Levels 2D on a phone: panel and inspector behind Panel and Details, the dock behind Dock, the rail at the bottom (portrait) | The pills shrink to icons with counts; Home, Panel, Details and Dock stay in view; no page scroll |
| `levels-3d-ipad-pro-11-landscape.png` | Levels 3D at 1194 × 834: the layers list (Sectors, Walls, Things), the plan, the inspector (what is selected, how the checks stand), and the status line (file, zoom, selection) | No Dock toggle (Levels 3D has no dock) |
| `levels-3d-ipad-mini-portrait.png`, `levels-3d-phone-portrait.png`, `levels-3d-phone-landscape.png` | Levels 3D at medium and phone sizes | The plan fills the canvas region; no page scroll |
