---
'@mcthaydt/automata-game': patch
'@mcthaydt/automata': patch
---

`keys()` takes an `analog` option (the sticks and the camera drag added to the held keys' payload), `InputMap` gains `touchStick` and `toCommand`'s optional third parameter, `TouchButton` an optional `side`, and the default play screen draws the camera-drag surface and the touch stick when the map asks for them.

BREAKING: `InputMap` gains the required `touchStick` (only `keys()` and `inputs()` build one), `KeysOptions` gains the optional `analog`, `TouchButton` the optional `side`, and `ScreensCopy.play` gains the required `move` (the stick's accessible name; `DEFAULT_SCREENS_COPY` has it, a game that spells out the whole `play` object adds it).
