---
'@automata/content': patch
'@automata/framework': patch
---
A game's default controls can be data: `content/controls.toml` (the `controls` kind in `@automata/content/controls`) and `controlsFrom(command, file)` in the framework build the same input map `keys()` does.
