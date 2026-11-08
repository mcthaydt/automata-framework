---
'@mcthaydt/automata-tools': patch
---

`automata editor` can follow files changed outside it (`GET /api/watch`) and answer the Automata app's page (`--app-origin tauri://localhost`, with a token). The app's own `.automata/` folder is never reachable by an editor.
