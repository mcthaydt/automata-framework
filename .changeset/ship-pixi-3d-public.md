---
'@automata/tools': patch
---
`automata ship prepare` and `ship publish` no longer refuse a build that carries Pixi 3D (`@pixi/3d`): it is public on
npmjs.org (MIT), so a 3D game goes to the web, itch.io, the desktop and Ruken like a 2D one. A build that carries
`@pixi/3d/extras` is still refused, because its particle code needs `eval`. `audience: 'private'` and
`publish --private` remain for a game its author keeps off the store, and no longer have anything to do with Pixi 3D.
`create-game --template 3d` pins `@pixi/3d` from the registry inside this repository too.
