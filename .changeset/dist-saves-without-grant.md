---
"@mcthaydt/automata-runtime": patch
---

A target that does not grant `saves` (a web page with storage blocked) no longer stops the game at boot (DIST spec §8
flow 5). The boot reads settings only when `saves` is granted and otherwise starts on their defaults; the save service
lists every slot empty, loads an empty slot as the empty value and sends no write, so nothing fails and the paused
screen says progress won't be kept. Nothing is written to the device's storage instead.
