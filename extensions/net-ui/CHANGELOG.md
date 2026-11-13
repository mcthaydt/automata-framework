# @automata/net-ui

## 0.1.0

### Patch Changes

- b6ebb01: The free extensions publish with the framework and share its version: physics, feel, audio-synth, debug, puzzle, net, net-ui, net-server and ui-screens. A game adds the ones it wants as `@automata/<name>`; none of them is imported by the framework itself.
- 77e5702: `@automata/framework` exports the locale pieces a game with its own words needs: `bindWords` (keeps `data-word` and `data-word-label` elements of a plain-DOM panel in the player's language, and fills them again when it changes), `matchLocale` (the rule the runtime chooses a language by), `formatNumber` and `DEFAULT_LOCALES`. `@automata/ui-screens` and `@automata/net-ui` use `matchLocale` instead of their own copy of the rule.
- 1961fc5: Fix the stale-build check across origins. `GET /version` now carries the CORS header for the server's allowed origins, so a game served from another origin can read it. `checkServerVersion` says `unchecked` (a new `VersionVerdict`) for an answer it cannot read instead of `current`, and the opening step logs it.
- 2d87462: An online game tells a player their tab is out of date before the title. `@automata/net-server` serves its build facts on `GET /version` (503 before the content has loaded; `/health` still carries none). `@automata/net` exports `checkServerVersion` and the `BuildFacts` shape, which say `stale` only when the server answered readable facts that differ. `@automata/net-ui` adds `staleBuildStep`, an opening step that waits at most 1.5 seconds for the answer and, when the build is stale, shows "This game was updated" with Reload in the framework's six languages (`staleWords`, and the catalogs at `@automata/net-ui/words/<language>.json`). The join check stays the authority.
- Updated dependencies [0676026]
- Updated dependencies [5386c34]
- Updated dependencies [1b83c1b]
- Updated dependencies [30e8765]
- Updated dependencies [4b4328b]
- Updated dependencies [4374fdd]
- Updated dependencies [7312642]
- Updated dependencies [ceb2a01]
- Updated dependencies [4835238]
- Updated dependencies [dac7515]
- Updated dependencies [c078373]
- Updated dependencies [deb1360]
- Updated dependencies [f863ad0]
- Updated dependencies [030110a]
- Updated dependencies [b6ebb01]
- Updated dependencies [f82f756]
- Updated dependencies [12bda87]
- Updated dependencies [6c0ccee]
- Updated dependencies [b0f31b6]
- Updated dependencies [7dc3e29]
- Updated dependencies [f68d822]
- Updated dependencies [1f423dd]
- Updated dependencies [3565abc]
- Updated dependencies [77e5702]
- Updated dependencies [dd38dc7]
- Updated dependencies [9953006]
- Updated dependencies [2b7c322]
- Updated dependencies [d2e9d7f]
- Updated dependencies [5e86d02]
- Updated dependencies [4310b78]
- Updated dependencies [076ae04]
- Updated dependencies [acbd16e]
- Updated dependencies [1961fc5]
- Updated dependencies [2d87462]
- Updated dependencies [30667aa]
- Updated dependencies [5ee493d]
  - @automata/framework@0.1.0
  - @automata/net@0.1.0
