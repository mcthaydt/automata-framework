---
'@automata/framework': patch
'@automata/feel': patch
---
The stage has a port for characters (`PixiStage.characters`, with `StageCharacters`): where a word above one sits, squashing it, holding its pose. The 2D renderer answers it; Feel uses it instead of the 2D consumer, so a renderer that draws characters its own way can answer it too.
