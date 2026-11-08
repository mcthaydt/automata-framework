---
'@automata/tools': patch
---
The player in a new game now collides with the box it is drawn in: the size of the player start in Characters, standing on its feet. Before, it was drawn 16 by 24 and bumped into walls as an 8 by 8 square. A new game's sim content now carries the box, so resizing the player in Characters moves the game, and the starter's saved test values move with it.
