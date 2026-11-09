---
'@automata/tools': patch
---
`automata create-game` takes `--template 2d|3d`, `2d` by default. The 3D template makes a game of Wick walking around one room, with a tuning file and the editor list. It is offered only where the 3D package is found (inside this repository, or with `AF_BETA_3D=1`); anywhere else `--template 3d` says "3D games need a package that is not public yet. For now, make a 2D game: leave out --template." and writes nothing.
