---
'@automata/framework': patch
---
In a landscape view the whole level now shows. The field is fitted to the window (the smaller of the width and height ratios) and centred, with bars at the sides when the window is wider than the field's shape, instead of filling the width and cutting off the top and foot. The top and bottom crop (`barFraction`) now defaults to 0; a game can still ask for one. Portrait is unchanged.
