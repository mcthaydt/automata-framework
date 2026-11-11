---
'@automata/net': patch
'@automata/net-server': patch
'@automata/net-ui': patch
---
An online game tells a player their tab is out of date before the title. `@automata/net-server` serves its build facts on `GET /version` (503 before the content has loaded; `/health` still carries none). `@automata/net` exports `checkServerVersion` and the `BuildFacts` shape, which say `stale` only when the server answered readable facts that differ. `@automata/net-ui` adds `staleBuildStep`, an opening step that waits at most 1.5 seconds for the answer and, when the build is stale, shows "This game was updated" with Reload in the framework's six languages (`staleWords`, and the catalogs at `@automata/net-ui/words/<language>.json`). The join check stays the authority.
