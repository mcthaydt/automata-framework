---
'@automata/framework': patch
---
A component in the `hud.overlay` slot can call `usePlay()` (from `@automata/framework`) to read the running game, read-only, and to `send` it a command. A sent command joins the commands from the input map for the next tick, so a recording of that stream has it. `@automata/framework/testing` gains `mountInPlay` to mount a slot component in the real play screen in a test.
