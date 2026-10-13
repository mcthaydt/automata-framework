---
'@mcthaydt/automata-ship': patch
---

Inside AF, an example's game-ci job skips `Check` and the determinism checker (the `checks` job already runs
them for every package), and `ci:local` stops repeating base-2d's check.
