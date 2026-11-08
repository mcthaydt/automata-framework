---
'@automata/tools': patch
---
`automata editor` runs the checks a game's `content/editors.toml` declares, so a served game's editors can use them (Schematic's "Check now" for fair play). It runs only the ids the list names, as argv in the game's folder with no shell, and says `checks` in its ping.
