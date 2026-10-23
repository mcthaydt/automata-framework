---
'@mcthaydt/automata-check-boundaries': patch
'@mcthaydt/automata-physics': patch
---

An extension declares which of its entries a game's sim may import, in its own `package.json` (`"automata": { "simEntries": ["./2d", "./3d"] }`), and `automata-check-boundaries` reads it. The two physics entries are no longer hard-coded in the checker; physics declares them. A malformed declaration is reported with the package's name.
