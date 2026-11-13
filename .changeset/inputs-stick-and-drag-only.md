---
'@automata/framework': patch
---
`inputs()` no longer refuses maps whose only touch input is the touch stick and the camera drag: they are something to touch, though neither a button nor a swipe, so a game can give a thumb a floating stick and a swipe and no row of key buttons.
