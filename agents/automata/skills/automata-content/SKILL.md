---
name: automata-content
description: "How code meets what a person makes in the editors: placed characters, tunables, events, words, scenes and characters that think. Use when adding anything a person should be able to change in an editor, or when a feature passes its tests but does nothing in play."
---

# Give the editors something to edit

A person changes a game's **content** in the editors; you write its **behaviour** in code. Content is a file an editor
writes and the game reads. Code that holds the same fact as a number or a string is a bug: the person cannot reach it.

Ask of every feature: what would the person want to move, tune, hear, read or direct? Then make that a file the code
reads, using the row below.

| Editor | The file a person changes | What reads it | What the code must do |
|---|---|---|---|
| Levels | `content/levels/*.af2d.json` | `entitiesOf(level, layer)`, `levelScene({ live })` | Spawn one sim entity per placed item, and list its definition in `live` so core stops drawing it |
| Characters | the definition's picture and size in the level project (`content/project.toml`) | `pictureView(project, def, images)` | Draw the entity with `pictureView`; take its box from the definition's size, not from a constant |
| Tuner | `content/tuning.toml` | the sim's `ctx.content.tuning`, read through `src/shared/tuning.ts` | Add a row with a range and a field to `Tuning`; never a constant in a sim file |
| Feel | `content/feel/*.toml` | the game's events | Emit a `defineEvent` from a `.event.ts` file; Feel finds it by itself |
| Audio | `content/audio/*.toml` | the game's events | The same events; Audio finds them by itself |
| Writer | `content/lines/*.toml`, `content/dialogue/*.toml` | `wordsOf` (the story's `src/features/story/story-content.ts`) | Show words by line key, never a string in code |
| Sequence | `content/cutscenes/*.toml` | `cutscenesExtension({ anchor })`, `levelAnchors` | Name characters by their placed id (`actor:keeper`) |
| Schematic | `content/systems/*.toml`, `content/nav/*.toml`, `content/puzzles/*.toml` | `systemsExtension`, `createNavExtension` | Give the thinking character a `SystemsAgent` |

Writer, Sequence and Schematic rows apply to a game made with the story; a plain game has only Levels, Characters,
Tuner, Feel and Audio. The events of the story's extensions (a conversation shows a line, a cutscene starts, a character
catches the player) appear in Feel and Audio by themselves when the game has that content. You add nothing.

## The coin: one example, all the way through

[`example/coin.md`](example/coin.md) adds a coin a person places in Levels, picks up in play, and answers in Feel. It is
the shortest path through every row of the table that a first feature needs, including the two steps an agent forgets:
adding the plugin to the game's plugin list and the view to `views`.

## When a feature passes its tests but does nothing in play

1. **Is the thing placed?** Open `content/levels/start.af2d.json` and find its definition's id under `entities`.
2. **Is it spawned?** The sim has no coin until your setup spawns one per placed item. A test that makes up coordinates
   will pass without ever reading the level file; load the file and use what it holds.
3. **Is it drawn once?** List its definition in `live` if your code spawns it, or core draws it and so do you.
4. **Is its plugin added and its view registered?** The plugin to the game's plugin list, the view to `views`.
5. **Does the number come from content?** A speed written in code cannot be tuned.

Run `pnpm check`, then `pnpm editor`, press Play, and see it.
