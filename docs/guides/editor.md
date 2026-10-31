# Edit a game's levels with the editors

`automata editor` serves an Automata editor against your game's own files, so the level you draw on a tablet is the
file in your checkout. The editor runs in the browser; the command is a small local server beside it.

## Start it

From the game folder, with the editor built once (`pnpm --filter @mcthaydt/automata-editor-3d build`):

```sh
automata editor                 # the 3D level editor against this folder, at http://127.0.0.1:<port>
automata editor ../my-game      # another checkout
automata editor --app 2d        # the 2D editor (--app suite for the editor suite)
automata editor --port 4173     # a port you choose (default: a free one)
```

Open the address it prints. Stop it with Ctrl+C.

## Use it from a tablet

By default the server answers only on this computer. To open it from an iPad on the same network:

```sh
automata editor --lan
```

The command makes a token and prints the address for the network, with the token in it
(`http://192.168.1.20:4173/?token=...`). Open that address on the tablet. The token is kept for that tab, so a reload
needs no token in the address. Give your own with `--token <text>`. The editor writes files, so listening beyond this
computer without a token is refused.

## What it can read and write

- With `content/editors.toml` in the checkout, the editor list decides: the files its `[[file]]` rows match are
  written; `.git`, the list itself and the gates' records never are; generated files are read only.
- Without one, the checkout's `.json` files are read and written, except in `.git`, `node_modules`, `dist`, `.vitest`,
  `.claude` and `.github`.
- Nothing outside the checkout is reachable, and a symbolic link that leads out of it is refused.

## If the file changed under you

The editor remembers when it read each file. If you edit the file by hand while the editor has it open, Save does not
overwrite your change: the editor says the file changed and offers to keep yours, take the file's, or save a copy. The
check and the write are two steps, so the supported setup is one editor tab per checkout.

## Without the command

The built editor also runs from any static host. It then keeps its files in the browser (private storage) and you move
them with Import and Export.
