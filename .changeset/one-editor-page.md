---
'@automata/tools': patch
---

`automata editor` picks the editors your game needs from its `content/editors.toml`, so `--app` is gone. A 2D game
opens Levels and the Tuner; a game whose list names a 3D editor opens the full suite.
