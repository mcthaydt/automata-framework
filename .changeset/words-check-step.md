---
'@automata/tools': patch
---
`automata check` has a `words` step: every language a game ships must have all its words, with the same `{placeholders}` as the source, and the game's fonts (`content/fonts.toml`) must be able to draw every letter of every language. A language no font is declared for is a finding, and the device's fonts never count. A game with one language and no `fonts.toml` has nothing to check, so no game that exists today changes.
