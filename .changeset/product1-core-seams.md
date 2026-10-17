---
'@mcthaydt/automata-host': patch
---

`Hosting.leaderboards.submit/get` relay Ruken's `LeaderboardsApi` (PRODUCT.1). Without the `leaderboards` grant, standalone or offline they fail with the SDK's code as a `HostError`; nothing falls back to a local board.

BREAKING: `Hosting` gains the required `leaderboards` member, so a hand-written `Hosting` implementation must add it.
