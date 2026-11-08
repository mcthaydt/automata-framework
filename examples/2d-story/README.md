# 2D story

A small 2D game made to be edited: two areas ("Hall" and "Yard"), a solid wall between them with one gap, a keeper in
the Hall and a guard in the Yard. It is the game the served journeys of the content editors play (Writer, Sequence,
Schematic, Feel, Audio): each edits this game's files through `automata editor` and then plays it.

It is `automata create-game`'s game plus the level above, so what it does today is move a square around that level.
The keeper's words, the cutscene and the guard's patrol arrive with the dialogue, cutscene and systems extensions in 2D
(`docs/refactor/2026-11-08-content-in-play-plan.md`, Tasks 10 to 16).

- `pnpm dev` runs the game, `pnpm test` its tests, `pnpm check` typecheck, tests and boundaries.
- `pnpm exec automata editor` opens the editors on `content/` and starts the game beside them.
- `content/levels/start.af2d.json` is the level the 2D editor edits; Save writes `content/project.toml`,
  `content/levels/start.toml` and `content/world.toml`, which the game reads.
- The cutscene starts the keeper at `at = "actor:keeper"`, so moving him in Levels moves where the scene begins.
- `content/controls.toml` holds the default keys and pad buttons; the Tuner edits it and the game reads it.
- The guard keeps hunting while the player is frozen in a conversation: the world is not paused for the dialogue box. A
  game that wants a pause says so in code.
