---
'@automata/content': patch
'@automata/tools': patch
---
A new game's test run no longer prints two warnings every time: the content compiler stays quiet about the editors' own project files (`*.af2d.json`, `*.af-sector.json`), and a new game writes the empty Svelte config the Svelte plugin looks for.
