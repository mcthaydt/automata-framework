---
'@mcthaydt/automata-sim': patch
---

Add `definePlugin({ name, defs })`, which sorts one flat list of components, commands, events, resources and systems into the keyed lists, and the `defineSystem(name, run)` and `defineSystem(name, phase, run)` short forms (phase defaults to `gameplay`). Additive: existing plugins keep their schema hash.
