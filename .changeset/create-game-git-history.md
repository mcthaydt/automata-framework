---
'@automata/tools': patch
---
`create-game` now starts a git history for the new game with a first commit, "Start <title>", unless git is not installed, the folder is already inside a repository, or you pass `--no-git`. If git has no name to put on the commit, the game is still made and the command says how to save the first version.
