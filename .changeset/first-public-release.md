---
'@automata/framework': minor
'@automata/content': minor
'@automata/sim': minor
'@automata/tools': minor
---
The first public release: the four packages are on npmjs.org, free to install with no sign-in. `npx @automata/tools create-game my-game` makes a small game that runs, with a level you can open in the editor, a test and its own release workflow.

BREAKING: this release replaces everything published before it under `@mcthaydt/*`. The packages are now `@automata/framework`, `@automata/content`, `@automata/sim` and `@automata/tools`; the browser packages (host, runtime, render, ui, game, testing) are one package, and the build tools (ship, cli, node) are one package, `@automata/tools`. The browser runtime no longer uses Effect, `NetworkPort` and `AuthoritativeSnapshot` are gone, and the root entry of `@automata/framework` is smaller (600 names became 274). Change your imports and your `package.json` to the new names.

- `automata editor` opens the 2D level editor and the Tuner, which shows your game beside its settings, with nothing else installed; it names the game it opened in plain words.
- `automata check` runs the determinism and layout checker, and a `levels` step that fails when a level project and the game files saved from it disagree; `--only <step>` runs one step.
- `automata ship prepare` and `publish` take `--target web|itch|tauri|ruken` and check a web build for secrets, inlined assets, `eval` and root-absolute paths.
- `@automata/content` has `level-2d`, the 2D level format the editor writes and games read, two browser-safe entries (`schema`, `palette`), and tunables that may carry a `label`, `feel`, `unit` and `scale`. In dev, a content save updates the running game in place.
- `@automata/framework` has plainer default screens and messages, `startGame(game, { at })`, and `checkLayout` targets for editors.
- The messages and `--help` of every command say what to do next in plain words.
