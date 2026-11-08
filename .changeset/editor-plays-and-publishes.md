---
'@automata/tools': patch
---
`automata editor` opens the editors page by default, starts the game beside it (Play opens it, the Tuner shows it) and
serves Publish, which builds the game for the web, checks it and hands over one zip to upload. Give `--game-url` when the
game already runs and the command starts none.
