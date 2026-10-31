---
"@mcthaydt/automata-host": patch
"@mcthaydt/automata-ui": patch
"@mcthaydt/automata-runtime": patch
---

The desktop (`tauri`) host adapter (DIST.5a, ADR 0006). `@mcthaydt/automata-host/target` under the `automata-tauri`
condition gives a desktop build's `Hosting`. It is the web adapter's page plus:
- the game's saves in one `saves.json` store in the app's data folder. They are never kept in `localStorage` or memory;
  when the store cannot be read, `saves` is not granted and every call fails `DENIED`;
- a flush that writes the store and answers `persisted: 'device'`;
- Quit (`exit` is granted). `exit` and the window's close request run the game's exiting handlers, then the flush,
  within `HOST_EXIT_CAP`, then quit.

`@tauri-apps/api`, `@tauri-apps/plugin-store` and `@tauri-apps/plugin-process` are optional peers that a desktop game
installs. `TAURI_MARKERS` and `findTauriMarkers` check that only a `tauri` build holds Tauri's IPC code.

`ui`'s boot failure knows the `tauri` host kind. Its exit action reads "Quit" (the new `quit` copy key), and a saves
failure that will not clear offers "Continue without loading". The runtime passes `tauri` through to it.
