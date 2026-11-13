---
'@automata/content': patch
---

`Picture` is a `StillPicture` (a tile or a flat shape) or a `ClipPicture` (the first frame of a character's animation, cut from its picture). Code that read `Picture` as a tile or a flat shape now checks for `clip` too.
