---
'@automata/tools': patch
---
`automata words` has an AI translate a game's words: every missing or changed word into every language the game ships, one language with `--to`, one line with a key, everything again with `--all`, and `--mark` to record translations written some other way. It needs `ANTHROPIC_API_KEY` on the computer running it, uses the key to reach the translator and nothing else, and can be pointed at another model with `words.model` in `ship.config.ts`.
