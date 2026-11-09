---
'@automata/tools': patch
---

BREAKING: the root entry of `@automata/tools` is `defineShipConfig` and the types of its sections, and nothing else. The ship, deploy, secret-scan, board and Tauri helpers that the root used to export are no longer public: a game drives them through the `automata` command (`automata ship prepare|publish`, `automata check`, `automata build`, `automata editor`), and the repository's own tooling imports them from `./internal`, which is not published.
