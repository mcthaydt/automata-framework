---
'@automata/framework': patch
---
A component in the `hud.overlay` slot can read how the player is playing: `usePlay().inputMethod` is `touch`, `keyboard` or `gamepad`, whichever they used last, so a game draws its own on-screen buttons for touch only. It is the input mode and separate from layout, which follows the container. `mountInPlay` (in `@automata/framework/testing`) takes the method and `noteInputMethod` changes it.
