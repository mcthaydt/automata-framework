---
'@automataframework/automata': patch
'@automataframework/automata-tools': patch
---
`startGame(game, { at })` starts on a named screen instead of the flow's entry (a screen the flow does not have starts at the entry), and the handle it returns says which screen shows (`screen`). A new game from `create-game` uses both in development: after a saved level or setting, the game starts over on the screen you were on, not its first one.
