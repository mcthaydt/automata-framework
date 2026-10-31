---
'@mcthaydt/automata': patch
'@mcthaydt/automata-game': patch
'@mcthaydt/automata-ui': patch
---

The default screens' words come from the game (DX.2d). `GameSpec.copy.screens` takes a part of the new `ScreensCopy`
record, or a function of the locale that returns one, over the English defaults: Play, Pause, the paused menu and its
quit confirm, every Settings group, the save slots and status, the board, and the unsupported-controller notice. The
screens read it in the player's language and again on each change, without remounting. `TouchControls` now wraps a
side whose labels do not fit on one row, and breaks a long label inside its button, so a longer language never pushes
the touch row off screen.
