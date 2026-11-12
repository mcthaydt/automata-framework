---
'@automataframework/net': patch
'@automataframework/net-ui': patch
'@automataframework/net-server': patch
---

Fix the stale-build check across origins. `GET /version` now carries the CORS header for the server's allowed origins, so a game served from another origin can read it. `checkServerVersion` says `unchecked` (a new `VersionVerdict`) for an answer it cannot read instead of `current`, and the opening step logs it.
