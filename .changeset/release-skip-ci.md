---
'@mcthaydt/automata-ship': patch
---

The release workflow's version commit carries `[skip ci]`, so a push to the Version packages branch starts no
`ci`, `parity`, game-ci or consumer-smoke run (the release job checks and publishes the commit itself).
