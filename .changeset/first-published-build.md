---
'@mcthaydt/automata-check-boundaries': patch
'@mcthaydt/automata-content': patch
'@mcthaydt/automata-host': patch
'@mcthaydt/automata-node': patch
'@mcthaydt/automata-physics': patch
'@mcthaydt/automata-ship': patch
'@mcthaydt/automata-sim': patch
'@mcthaydt/automata-testing': patch
'@mcthaydt/automata-ui': patch
---

First published build (M2.4): every package builds to `dist/` with tsdown (ui with svelte-package), bundles the
vendored Ruken code it needs, and publishes to GitHub Packages. `check-boundaries` is now
`@mcthaydt/automata-check-boundaries` with an `automata-check-boundaries` bin.
