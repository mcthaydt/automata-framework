---
'@automataframework/framework': patch
---
Every control can sound without wiring: `defineGame({ uiSounds })` takes the interface's sounds by name (`press`, `back`, `focus`, `open`, `close`, `error`, or the game's own), as a map to assets or one function, and one listener on the game's root plays them on the interface bus, under its volume and mute. A control says otherwise with `data-sfx="back"` or `data-sfx="none"`, and a component with no press behind it asks with `requestUiSound`. Moving focus ticks softly (never faster than every 90 ms, never on top of a press, a scroll or a touch). Core marks its own Back, Close and Cancel buttons as leaving and its Mute and the touch buttons as silent. A game that maps nothing stays silent. `Toggle` takes an `sfx` name.
