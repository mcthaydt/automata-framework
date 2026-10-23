---
"@mcthaydt/automata-ship": patch
---

`runtime.inputs` against the game's input map without loading it (M4.1 follow-up): `prepare` (when the caller gives no `inputBindings`) and the private `automata check` (a new `inputs` step, rule `inputs-mismatch`) read the `keys()` calls in the game's sources, as the board and orientation checks read theirs, and apply `inputsProblems` to what they bind: a pad binding with no `gamepad`, or `touch` with nothing to touch. Anything not written as a literal counts as touchable and binds no pad, so a reported problem is always real. `ship` exports `keysBindingsIn`, `declaredInputsIn`, `findInputsProblems`, `isInputsSource` and `DeclaredInputs`.
