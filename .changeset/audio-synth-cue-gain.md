---
'@automata/audio-synth': patch
---

A cue takes an optional `gain`, a multiplier (1 when unset) for how loud it plays against the others, as a slot's fallback takes `volume`. A recorded file plays as it was made, so this is where its level is set; the master gain still multiplies it.
