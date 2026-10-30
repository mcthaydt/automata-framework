---
'@mcthaydt/automata-check-boundaries': patch
---

`--game <src>` checks a game laid out by role (GL spec §4.5): only its sim set (`constants`, `components`, `commands`, `events`, `resources`, `systems`, `state`, each as a file or a folder, plus `sim.ts`) follows the sim rules, a value import from a sim file must stay inside the set, and a game root with no sim files exits 2.
