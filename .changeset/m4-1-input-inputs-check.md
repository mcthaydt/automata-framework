---
'@mcthaydt/automata-ship': patch
---

`inputsProblems(inputs, bindings)` checks `runtime.inputs` against a game's input bindings (M4 spec §4.13): pad buttons need `"gamepad"`, and `"touch"` needs a touch button or a gesture. `prepareBuild` takes an optional `inputBindings` and fails with the new `ManifestInputsMismatch` before writing `ruken.toml`. Additive: without `inputBindings`, prepare behaves as before.
