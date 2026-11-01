---
name: automata-editor
description: How to serve an Automata level editor against a game checkout with `automata editor` (loopback by default, --lan with a token for a tablet), what it may write, and what to do when it will not start or a Save conflicts. Use when asked to open, serve or edit a game's levels in the editor, or to reach it from an iPad.
---

# Serving the editors: `automata editor`

`automata editor [dir] [--app 2d|3d|suite] [--app-dir <build>] [--port <n>] [--lan] [--token <t>]` serves an editor
against a game checkout until Ctrl+C. The full guide is `docs/guides/editor.md` in the framework repository.

## Do

1. Build the editor once: `pnpm --filter @mcthaydt/automata-editor-3d build` (`-2d`, `-suite` for the others). The
   command says so when the build is missing (exit 2).
2. Run `automata editor` in the game folder and open the address it prints.
3. For a tablet on the same network use `--lan`: it listens on every address and needs a token (it makes one and
   prints it in the address). Never run `--lan` on a network you do not trust; the editor writes files.

## What it may touch

- With `content/editors.toml`: only what its `[[file]]` rows list is written. `.git`, the list itself and gate records
  never are, generated files are read only.
- Without it: `.json` files outside `.git`, `node_modules`, `dist`, `.vitest`, `.claude` and `.github`.
- Never outside the checkout; a symbolic link out is refused.

## If something goes wrong

| Symptom | Cause | Do |
|---|---|---|
| `no editor build at …` | the editor is not built | run the `pnpm --filter … build` it names |
| `listening beyond the loopback needs a token` | `--lan` or a wide host without a token | give `--token`, or use `--lan`, which makes one |
| `401` in the page | opened without the token | open the address the command printed, with `?token=` |
| `403` for a file | the policy does not allow it | add a `[[file]]` row to `content/editors.toml`, or move the file |
| Save says the file changed | the file was edited on disk after the editor read it | choose keep mine, take theirs or save a copy; do not hand-edit a file the editor has open |
| `EADDRINUSE` | the port is taken | choose `--port <n>` or leave it to pick a free one |

The editor never decides what the game does: a level it saves is the game's file, so run the game's own checks
(`automata check`) after editing.
