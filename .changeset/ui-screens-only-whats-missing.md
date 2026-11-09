---
'@automata/ui-screens': patch
---

The package keeps the four screens core does not have: Title with the game's own actions, Results, Loading and Error. The Pause and Settings screens are gone from it, because core's Paused and Settings screens do everything they did (and also the saves, the leaderboard and the controller-reconnect step). A game that imported `@automata/ui-screens/pause` or `/settings` imports core's screens instead.
