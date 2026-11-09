---
'@automataframework/automata-content': patch
---

A ranged tunable in `content/tuning.toml` may carry a `unit` (text) and a `scale` (a finite number other than 0): the
Tuner shows the value times the scale in that unit, so a speed in subpixels a tick reads as pixels a second. Neither
reaches the values or `tuning-meta.json`; the file and the sim keep their own units.
