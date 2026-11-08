---
name: automata-editor
description: How to open a game in the Automata editors with `automata editor` (this computer by default, --lan with a token for a tablet), what the editors write, and what to do when it will not start or a Save conflicts. Use when asked to open, serve or edit a game's levels, characters, tuning, feel, sound, words, scenes or enemies in the editors, to play or publish the game, or to reach it from an iPad.
---

# Opening the editors: `automata editor`

`automata editor [folder] [--port <n>] [--lan] [--token <t>]` opens the editors on the game in the folder (default:
this one) until Ctrl+C. They come with `@automata/tools`, so there is nothing to build. A game made with `create-game`
also has `pnpm editor`. The full guide is the Editor page of the docs.

One page holds every editor, and the game's `content/editors.toml` says which files each one opens:

| Editor | What a person changes in it |
|---|---|
| Levels | where things are placed and the ground they stand on |
| Characters | what a thing looks like and its size |
| Tuner | numbers (speed, jump) and the controls |
| Feel | the shake, flash and words when something happens |
| Audio | the sounds and music when something happens |
| Writer | what people say |
| Sequence | scenes that play on their own |
| Schematic | how enemies think and where they may walk |

**Play** in the top bar opens the game with what they just made. **Publish** makes one zip to upload to itch.io or any
website host. Which editors have something to open depends on what the game has: the `automata-content` skill says
what code has to do for each one.

## Do

1. Run `automata editor` in the game folder (`pnpm exec automata editor` if the tools are only the game's dev
   dependency) and open the address it prints.
2. Home lists what the game has. Open something, change it, and the editor saves as it goes. A change to a level or a
   number reaches the running game (`pnpm dev`), because the editor writes the game's own files.
3. For a tablet on the same network use `--lan`: it listens on every address and needs a token (it makes one and
   prints it in the address). Never run `--lan` on a network you do not trust; the editors write files.

## What it may touch

- With `content/editors.toml` (every new game has one): only what its `[[file]]` rows list is written. `.git`, the
  list itself and generated files never are.
- Without it: only level files (`*.af2d.json`) outside `.git`, `node_modules`, `dist`, `.vitest`, `.claude` and
  `.github`. A game made with `create-game` always has the list.
- Never outside the game folder; a symbolic link out is refused.

## If something goes wrong

| Symptom | Cause | Do |
|---|---|---|
| `listening beyond the loopback needs a token` | a wide host without a token | give `--token`, or use `--lan`, which makes one |
| `401` in the page | opened without the token | open the address the command printed, with `?token=` |
| `403` for a file | the list does not allow it | add a `[[file]]` row to `content/editors.toml`, or move the file |
| Save says the file changed | the file was edited on disk after the editor read it | choose Use mine, Use theirs, or save a copy; do not hand-edit a file the editor has open |
| `EADDRINUSE` | the port is taken | choose `--port <n>` or leave it to pick a free one |

The editors never decide what the game does: what they save is the game's own file, so run the game's checks
(`automata check`) after editing; its `levels` step says when a level and its game files disagree.
