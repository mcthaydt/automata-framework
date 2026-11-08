# Draw levels in the editor

`automata editor` opens the editors on your game's own files: the level you draw is the level your game plays. The
editors run in the browser; the command is a small local server beside them.

## Open it

In your game's folder (with the editor built once: `pnpm --filter @mcthaydt/automata-editor build`):

```sh
automata editor                 # the level editor on the game in this folder
automata editor ../my-game      # the game in another folder
automata editor --app suite     # the level editor and the Tuner together
automata editor --port 4173     # a port you choose (default: a free one)
```

Open the address it prints. Stop it with Ctrl+C.

## Draw

Home lists your game's levels by name. Tap one to open it. Along the top are the four views:

- **Level**: paint walls and floors, tiles and characters. The tools are at the top of the level (at the bottom on a
  phone): select, brush, rectangle, fill, eraser and pick. Layers are on the left; what you chose is on the right.
- **Map**: where each level sits beside the others. Tap a level to edit it.
- **Tiles**: your sets of tiles and the tiles that place themselves. **Add tiles** turns a picture of tiles into a set.
- **Characters**: the kinds of character and item a level can hold, and their settings.

Undo and Redo are beside Save. A two-finger tap undoes too.

## Save

Save writes your game's files. Beside it the editor says where the level stands: **Saved**, **Not saved**,
**Saving…** or **Couldn't save**. If you edit a file by hand while it is open, Save does not write over your change: the
editor says the file changed and lets you keep yours, take the file's, or save a copy. Use one editor tab per game.

## Play

Start your game as usual (`pnpm dev`). With `--app suite`, the Tuner shows your game running beside its settings:
change how fast your character runs or how high it jumps, and the game starts over with the new feel. Each setting is
shown in a unit you can feel (pixels a second, seconds). If your game is not on `http://localhost:5173`, give its
address with `--game-url`.

## On a tablet

By default only this computer can open the editor. To open it from an iPad on the same network:

```sh
automata editor --lan
```

It prints an address with a token in it (`http://192.168.1.20:4173/?token=...`). Open that on the tablet; a reload
needs no token. Give your own with `--token <text>`. The editors write files, so they never listen beyond this
computer without a token.

## What it can change

- With `content/editors.toml` in your game, that list decides which files the editors write; `.git`, the list itself
  and generated files are never written.
- Without one, the game's level files are read and written, except in `.git`, `node_modules`, `dist`, `.vitest`,
  `.claude` and `.github`.
- Nothing outside your game's folder is reachable, and a link that leads out of it is refused.

## Without the command

The built editor also runs from any web host (the website's Try it page is one). It then keeps your levels in this
browser, and Share downloads or copies them.
