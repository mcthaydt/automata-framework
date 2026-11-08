---
'@automata/framework': patch
---
Text a game draws with `ctx.text` is now sharp on every screen. It draws on a new `hud` layer above the pixel picture and outside every post filter (`PixiStage.hud`, `PixiStage.hudScale()`), from a baked Geist SemiBold MSDF font for Latin and Cyrillic text and in the device's own face for anything else, and it is never smaller than 12 CSS px on screen. `ctx.text` now returns the box it took, takes `anchor` and `shadow` options, and `createHudText` is exported for extensions that draw their own canvas text. A game whose `draw` writes no text never downloads the font.
