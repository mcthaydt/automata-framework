# ED2D.4c4a Level view: review images

Written by `packages/editor-2d/src/app/level/level-view.layout.test.ts` (`pnpm --filter @mcthaydt/automata-editor-2d
test:layout`, the Chromium instance) from the shipped Mossgate fixture, at head `02a07051`. They are for review only:
nothing compares against them. In `wide` the layers panel is inline, so its `level-layers-*` shot is the same image as
`level-view-*` and is left out.

Everything here is new in ED2D.4c4a: before it, a document opened onto a plain frame with no views. The rail, the Level
view (layers, palette, toolbar, canvas) and the Layers drawer and sheet all arrive in this PR.

| Image | Size | What to look at | What changed |
|---|---|---|---|
| `level-view-ipad-pro-11-landscape.png` | 1194×834, `wide` | The rail of six views in a column (Level chosen); the layers panel inline with Hide and Lock on every row and each kind in words (Things, Tiles, Auto tiles, Grid values); the palette for the Entities layer with swatches; the toolbar's tools in words and the brush size stepper; the level fitted in the canvas with tiles numbered and entities labelled; flipped tiles show mirrored numbers; no empty inspector column (the canvas takes that room until ED2D.4c4b) | New |
| `level-view-ipad-pro-13-landscape.png` | 1366×1024, `wide` | The same layout with more room: the canvas grows, the panel keeps its width | New |
| `level-view-ipad-pro-11-portrait.png` | 834×1194, `medium` | The rail becomes the 64 px tab bar at the bottom; a Layers button leading the tool row opens the panel; the canvas has the full width | New |
| `level-layers-ipad-pro-11-portrait.png` | 834×1194, `medium` | The layers and palette in the kit's drawer from the left, over the canvas; rows and buttons at 44 px | New |
| `level-view-phone-portrait.png` | 390×844, `compact` | Back, Undo, Redo and Save stay in the top bar; the Layers button leads the tool row, which scrolls sideways (its declared scroll region) rather than shrinking the tools; the tab bar keeps all six views; the save state shows above it | New |
| `level-layers-phone-portrait.png` | 390×844, `compact` | The layers in the kit's bottom sheet with its grab handle; the palette below scrolls inside the sheet; the tab bar stays in view | New |
