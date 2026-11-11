# The Last Light: design rules

These are the game's rules. A change to one changes this file in the same commit.

- **Tone:** worn, not grimy. No gore. The fear is in what is not seen.
- **Camera:** follows the player at a 50 mm lens and a 30 degree home tilt; turns in eight 45 degree steps by the
  player's hand; no automatic yaw, pitch or roll in play; a peek is at most 1.2 m.
- **Light:** no real-time lights. Rooms are lit from a baked light and lamp levels.
- **Picture and figures:** the picture is capped at 640 by 480 (640 by 360 in a wide window). Figures are painted at
  density 1 in play (about 37 texels a metre), at true size; a finer density only in a cutscene close-up.
- **Nothing from the network at run time:** packaged files (sound, music, content) load as every game on the
  framework loads them.
- **A line changes only on the Owner's word.** The English words are byte-equal to the game's record; a translation
  never changes the English. The script wins: a thing a line names is in the scene.
- **Phone first:** every screen is designed and tested at 390 by 844 and 844 by 390; touch targets are at least 44 px
  (primary actions 48 px).
- **Where a piece goes:** core if any game could use it, an extension if it is generic within a genre, this game if it
  is its alone.
