---
'@automata/framework': patch
---

The default screens' words are plainer (task 8.1):

- The paused dialog's ✕ is named `Close` (`copy.screens.paused.close`), so it no longer shares the name `Resume` with the menu's first button.
- Settings: an action with nothing on a device says `Not set` (was `Unbound`); the rebind prompt says `Press a new keyboard button for Jump. 9 seconds left. Escape cancels.`; a refused rebind says `Fire needs that one. Pick another for Jump.`; the audio toggle is `Mute when you switch away` and the master slider `All sound`; reduced motion says `Reduced motion is on in your device’s settings.`
- Saves: a save from another version says `From another version: it loads, but some things may reset`.
