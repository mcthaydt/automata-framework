---
'@automataframework/automata-tools': patch
---
Adds `--features` (a package's `src/` is `app/`, `features/<x>/`, `shared/`, `entries/` and `testing/`, and imports between them go one way) and `--browser` (nothing a browser entry reaches imports Effect, a Node built-in or a Node-only library). `--game` now also finds a game's sim by role suffix (`.system.ts`, `.component.ts` and the rest) and by what those files import.
