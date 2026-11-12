---
'@automata/tools': patch
---

Publish in the editor now checks the level files and controls before it builds and the build for `eval` after it, shows
a failed step without colour codes or stack frames, and says why Play is off. Under `--lan` the command warns that the
game's own page has no token. A new game has a `pnpm editor` script and its title in `package.json`.
