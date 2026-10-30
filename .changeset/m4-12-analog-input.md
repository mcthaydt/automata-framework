---
'@mcthaydt/automata-ui': patch
---

Analog touch input for 3D (M4.12): a floating move stick on `TouchControls` (`stick`, `onstick`, `onstickend`) and
`CameraDragSurface`, which forwards a finger's or a secondary-button mouse drag to a drag tracker, under the controls
and outside the host's reserved strip.

BREAKING: the API report counts `TouchControlsProps`' new optional `stick`, `onstick` and `onstickend` props as a changed interface. Existing callers compile and behave as before.
