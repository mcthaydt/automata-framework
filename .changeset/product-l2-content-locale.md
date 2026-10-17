---
'@mcthaydt/automata-content': patch
---

Content localization (PRODUCT.L2): a translation's missing key is reported at the source text's `file:line:col`, and an extra or non-text key at its own line and column; `CompiledContent` gains `languages` and `catalogs`; `ContentOptions.paraglide` compiles the catalogs (and a game's own) with Paraglide on build; the new `@mcthaydt/automata-content/locale` entry has `createContentText` for run-time lookup and the per-locale glyph sets.

BREAKING: `CompiledContent` gains the required `languages` and `catalogs` members, so a hand-built `CompiledContent` must add them. `ContentOptions` gains the optional `paraglide` member.
