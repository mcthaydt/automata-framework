---
'@automata/sim': patch
---

`@automata/sim`'s root entry loads under plain Node: the snapshot and replay readers declare their byte field instead of taking it as a parameter property, which Node's type stripping cannot erase. The world kit's `automata-world-textures` command ran into it from the workspace's source; a published install was never affected.
