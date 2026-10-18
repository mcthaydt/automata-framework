---
"@mcthaydt/automata-ui": patch
---

Settings and Pause, laid out as FloorFifty's (Owner, 2026-10-18): `SettingsScreen` is a dialog of tabs (`SettingsTab`: Settings, Controls) over the dimmed game; `ControlsSection` has one section per device, the one in use first and marked, with one rebind button a row; `TouchSection` is the Touch controls group. `Modal` gains `head` (beside the title on a wide dialog) and `wide` (widens on a short band), and keeps room for a focused control's ring. `ControlsCopy` gains `touch` and `inUse` and loses `touchMode` and `touchModes` (now `TouchCopy`). The private game package's Paused screen becomes FloorFifty's pause dialog, with Quit asking first.

`ScrollList` and `TouchControls` no longer measure their element after it unmounts (Svelte sets it to null).
