---
'@automataframework/content': patch
'@automataframework/framework': patch
---
A game's default controls can be data: `content/controls.toml` (the `controls` kind in `@automataframework/content/controls`) and `controlsFrom(command, file)` in the framework build the same input map `keys()` does.
