---
'@automata/tools': patch
'@automata/audio-synth': patch
---

`automata editor` serves one page with every editor (Levels 2D and 3D, Characters, the Tuner, Feel, Audio, Writer,
Sequence and Schematic) wherever a game's editor list names a 3D or content editor. A new game's pictures and music are
globbed relative to their file, so Publish no longer refuses a game after Add tiles, and a new 3D game's Characters
editor is given every `content/figure*` folder, so Wick's swatches and gait are there to edit.
