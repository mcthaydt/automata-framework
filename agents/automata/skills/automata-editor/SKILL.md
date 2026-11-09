---
name: automata-editor
description: How to open a game's levels in the Automata level editor with `automata editor` (this computer by default, --lan with a token for a tablet), what it may write, and what to do when it will not start or a Save conflicts. Use when asked to open, serve or edit a game's levels in the editor, or to reach it from an iPad.
---

# Opening the level editor: `automata editor`

`automata editor [folder] [--port <n>] [--lan] [--token <t>]` opens the 2D level editor on the game in the folder
(default: this one) until Ctrl+C. The level editor comes with `@automata/tools`, so there is nothing to build.
The full guide is the Editor page of the docs.

## Do

1. Run `automata editor` in the game folder (`pnpm exec automata editor` if the tools are only the game's dev
   dependency) and open the address it prints.
2. Home lists the game's levels (`content/levels/*.af2d.json`); open one, draw, press Save. Save writes the level's
   game files too, so the running game (`pnpm dev`) plays the new level.
3. For a tablet on the same network use `--lan`: it listens on every address and needs a token (it makes one and
   prints it in the address). Never run `--lan` on a network you do not trust; the editor writes files.

## What it may touch

- With `content/editors.toml` (every new game has one): only what its `[[file]]` rows list is written. `.git`, the
  list itself and generated files never are.
- Without it: only level files (`*.af2d.json`) outside `.git`, `node_modules`, `dist`, `.vitest`, `.claude` and
  `.github`.
- Never outside the game folder; a symbolic link out is refused.

## If something goes wrong

| Symptom | Cause | Do |
|---|---|---|
| `listening beyond the loopback needs a token` | a wide host without a token | give `--token`, or use `--lan`, which makes one |
| `401` in the page | opened without the token | open the address the command printed, with `?token=` |
| `403` for a file | the list does not allow it | add a `[[file]]` row to `content/editors.toml`, or move the file |
| Save says the file changed | the file was edited on disk after the editor read it | choose Use mine, Use theirs, or save a copy; do not hand-edit a file the editor has open |
| `EADDRINUSE` | the port is taken | choose `--port <n>` or leave it to pick a free one |

The editor never decides what the game does: a level it saves is the game's file, so run the game's own checks
(`automata check`) after editing; its `levels` step says when a level and its game files disagree.
