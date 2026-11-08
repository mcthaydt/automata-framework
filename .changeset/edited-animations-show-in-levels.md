---
'@automata/framework': patch
'@automata/content': patch
---

A character with an animation looks the same in the editor and in the game: `pictureOf` returns its first frame, and the
level scene shows a waiting tile or animation in its own colour. A level scene gives a hook an `overlay` that covers every
view, and a clip whose frame is past its picture says so.
