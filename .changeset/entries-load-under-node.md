---
'@automata/content': patch
'@automata/sim': patch
---

The workspace's source entries of `@automata/content` (and the `@automata/sim` modules they reach) load under plain Node: relative imports name their `.ts` file, and the atlas error's field is no longer a parameter property. `automata check --only no-eval` now passes for a game inside the repository; a published install was never affected.
