---
'@mcthaydt/automata-check-boundaries': patch
---

`--inline` checks one-file examples: only the arguments of `defineSystem` and `definePlugin` calls are held to the sim rules, and file-level browser code and imports are left alone. A folder walk now skips `node_modules` and `dist`, and a root may be a single file.
