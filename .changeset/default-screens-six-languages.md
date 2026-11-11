---
'@automata/framework': patch
---
The default screens (title, paused, settings, saves, scores), the boot and failure panels, the loading lines and the rotate and fullscreen prompts now speak English, Japanese, Korean, Latin American Spanish, Brazilian Portuguese and Simplified Chinese with no work from the game: the words are message catalogs (`@automata/framework/words/<language>.json`), chosen by the player's language, and a game's own `copy` still wins. All six catalogs ship in the bundle so a language switch is instant and works offline; the site playground's runtime grew by 13,090 bytes gzipped (404,364 to 417,454; budget 460,000).
