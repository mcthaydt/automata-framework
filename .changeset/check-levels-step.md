---
'@mcthaydt/automata-tools': patch
---

`automata check` has a `levels` step that fails when a level project and the game files saved from it disagree, and
`--only <step>` runs one step. Without a content/editors.toml, `automata editor` opens only level files
(`*.af2d.json`).
