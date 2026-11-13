# @automata/net-server

## 0.1.0

### Patch Changes

- b6ebb01: The free extensions publish with the framework and share its version: physics, feel, audio-synth, debug, puzzle, net, net-ui, net-server and ui-screens. A game adds the ones it wants as `@automata/<name>`; none of them is imported by the framework itself.
- 1961fc5: Fix the stale-build check across origins. `GET /version` now carries the CORS header for the server's allowed origins, so a game served from another origin can read it. `checkServerVersion` says `unchecked` (a new `VersionVerdict`) for an answer it cannot read instead of `current`, and the opening step logs it.
- 2d87462: An online game tells a player their tab is out of date before the title. `@automata/net-server` serves its build facts on `GET /version` (503 before the content has loaded; `/health` still carries none). `@automata/net` exports `checkServerVersion` and the `BuildFacts` shape, which say `stale` only when the server answered readable facts that differ. `@automata/net-ui` adds `staleBuildStep`, an opening step that waits at most 1.5 seconds for the answer and, when the build is stale, shows "This game was updated" with Reload in the framework's six languages (`staleWords`, and the catalogs at `@automata/net-ui/words/<language>.json`). The join check stays the authority.
- Updated dependencies [551a11f]
- Updated dependencies [b6ebb01]
- Updated dependencies [12bda87]
- Updated dependencies [0990eea]
- Updated dependencies [1961fc5]
- Updated dependencies [2d87462]
  - @automata/sim@0.1.0
  - @automata/net@0.1.0
