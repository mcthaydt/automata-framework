---
'@automata/tools': patch
---
`automata create-game` makes a game that installs outside this repository: it depends on the published framework versions, targets `web` and `itch` unless you ask for `tauri` or `ruken`, and comes with a test and the `src/features/` layout. `automata check` accepts only that layout. The README starts with the one command to run.
