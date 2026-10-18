---
"@mcthaydt/automata-ui": patch
---

Display policy (M4.7): `LandscapeGate` and `RotateHint`, standalone fullscreen (`fullscreenSupport`, `isFullscreen`, `onFullscreenChange`, `enterFullscreen`), and the touch overlay's reduced set: a `TouchButtonSpec` marked `required` stays when the buttons do not all fit, never shrunk. The touch group's sticky margin no longer reaches over what sits above it, and the layout contract reports a control under a touch button. The private runtime and game packages gain the display policy (the landscape gate standalone only, the rotate hint pausing under `display`), `GameSpec.orientation`, `keys()`'s `required`, and the play screen's `hud.overlay` slot.
