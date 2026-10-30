---
'@mcthaydt/automata-ui': patch
---

`BootFailure` gains `ModelInvalid { file, reason }` (a 3D model file that could not be read, M3 spec §6). It draws the new `model-invalid` state, "A 3D model in this copy of the game is damaged: {file}.", with Try again.

BREAKING: `BootFailure` and `BootFailureState` gain the `ModelInvalid` failure and the `model-invalid` state, so an exhaustive `switch` over either must add a case; code that only draws `BootFailurePanel` is unchanged.
