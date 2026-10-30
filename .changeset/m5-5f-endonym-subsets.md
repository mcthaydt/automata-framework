---
'@mcthaydt/automata-content': patch
'@mcthaydt/automata-ui': patch
---

The font build cuts every content language's name, as the language picker shows it, into every subset, and the glyph gate holds each language's subsets to the names of the languages the fonts serve: a missing glyph is `missingGlyph` at the language's entry in `locales` in `content/fonts.toml` (M5.5F). `endonymOf` moves to `@mcthaydt/automata-content/locale`, so the build and the picker share one function; `@mcthaydt/automata-ui` re-exports it unchanged and now depends on `@mcthaydt/automata-content`.
