# Draw levels in the editor

In your game's folder, run:

```sh
pnpm exec automata editor
```

Open the address it prints. The command also starts your game, so there is nothing else to run. Draw: each step is
saved into your game's files as you make it. Press **Play** to play your game, and **Publish** when it is ready to put
online. Stop everything with Ctrl+C.

## Open it

```sh
automata editor                 # the editors (Levels and the Tuner) on the game in this folder
automata editor ../my-game      # the game in another folder
automata editor --app 2d        # the level editor on its own page
automata editor --port 4173     # a port you choose (default: a free one)
```

The editor runs in your browser, and the command is a small server on your computer that reads and writes your game's
files for it.

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

The command starts your game beside the editors (it prints **Your game is running** and the address). **Play** opens
it in a new tab, and it picks up each change you save. The Tuner shows the game running beside its settings: change
how fast your character runs or how high it jumps, and the game starts over with the new feel. Each setting is shown in
a unit you can feel (pixels a second, seconds). If your game is already running (`pnpm dev`), give its address with
`--game-url` and the command starts no other. If your game's packages are not installed, it prints **Play is off** and
says what to run.

## Publish

**Publish**, then **Build my game**, builds your game for the web and checks it is ready to go online: no secrets,
nothing that needs eval, and within itch.io's limits. Then **Download the zip**. On itch.io, make a new project, choose
HTML as its kind and upload the zip; any website host takes it too. If something stops the build, the editor says what
in plain words with the build's last lines, and **Try again** runs it again. The same steps from a terminal are
`automata build` and `automata ship prepare --target itch` (see [Publish to itch.io](publish-to-itch.md)).

## On a tablet

By default only this computer can open the editor. To open it from an iPad on the same network:

```sh
automata editor --lan
```

It prints an address with a token in it (`http://192.168.1.20:4173/?token=...`). Open that on the tablet; a reload
needs no token. Give your own with `--token <text>`. Your game runs on the network too, so **Play** on the tablet
opens it. The editors write files, so they never listen beyond this
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
