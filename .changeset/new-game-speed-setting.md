---
'@automata/tools': patch
---
A new 2D game's square speed is a setting in `content/tuning.toml` that the Tuner edits, not a constant in the code. The game's `src/shared/tuning.ts` reads it, and the sim's content is `{ level, tuning }`.
