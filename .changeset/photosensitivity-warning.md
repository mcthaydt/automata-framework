---
'@automataframework/framework': patch
---
A game that flashes can warn about it: `defineGame({ photosensitivity: true })` shows a flashing-lights warning on a device's first run, after the language screen and before anything plays, once per device. An object adds the game's own effect settings as switches (`WarningSwitch`: a game with `@automataframework/feel` passes its `reduceFlashing` and `intensity`), each applied the moment it is flipped; the device's reduced-motion setting is stated. Continue, Close and Escape all go on. The words are in `ScreensCopy.firstRun.warning`, in all six languages. `Toggle` is now positioned, so its hidden checkbox scrolls and clips with its label inside a scrolling region.
