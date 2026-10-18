---
"@mcthaydt/automata-content": patch
---

Font subsetting (M5.5): `content/fonts.toml` names each committed source font with its sha256, licence and languages. `automata-content assets` cuts each language's subset to woff2 with a content-hashed name and writes `fonts.json`. A source whose hash differs is refused (`invalidAsset`), and a message with a character none of its language's subsets holds fails at the message's `file:line:col` with the code point (`missingGlyph`). The `./assets` entry adds `buildFonts`, `subsetWoff2` and `fontCoverage`. `CompiledContent.messageLocations` says where each language's message is written.
