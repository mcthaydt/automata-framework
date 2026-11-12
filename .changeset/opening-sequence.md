---
'@automata/framework': patch
---
A game can run an opening before its first screen: `defineGame({ opening: [step] })` takes steps that run in order after the host is ready, with the sim held, each in its own layer over the game (`OpeningStep`, `OpeningContext`). A step that throws is skipped, so an opening never blocks play, and the host's "Open game menu" does nothing until the first screen has entered. The first-run language, the warning and a studio splash are steps of it. Whether a first-run screen has been shown is kept once per device (`SeenFlags`).
