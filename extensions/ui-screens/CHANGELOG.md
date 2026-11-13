# @automata/ui-screens

## 0.1.0

### Patch Changes

- b0f31b6: A credits name is held to every language's font. `@automata/content/schema` gains `verbatim()`, beside `localized()`: text drawn as written in every language, with no message key. The font build cuts every face to it and refuses a build in which a language's faces lack one of its characters, naming the file, the key and the characters. The credits kind marks a name with it, and `creditsSchemaWith` takes the name's schema as an optional second argument.
- b6ebb01: The free extensions publish with the framework and share its version: physics, feel, audio-synth, debug, puzzle, net, net-ui, net-server and ui-screens. A game adds the ones it wants as `@automata/<name>`; none of them is imported by the framework itself.
- 77e5702: `@automata/framework` exports the locale pieces a game with its own words needs: `bindWords` (keeps `data-word` and `data-word-label` elements of a plain-DOM panel in the player's language, and fills them again when it changes), `matchLocale` (the rule the runtime chooses a language by), `formatNumber` and `DEFAULT_LOCALES`. `@automata/ui-screens` and `@automata/net-ui` use `matchLocale` instead of their own copy of the rule.
- 05c8e03: `passFirstRun` in `@automata/tools/e2e` no longer hangs when the language screen is followed at once by the flashing warning: after a press it waits only for the screen it pressed. `@automata/ui-screens/credits` adds `showCredits`, which shows the credits panel in a screen's layer for a game that is plain TypeScript and has no Svelte of its own to mount it with, and hands back how to close it.
- 618d03a: `@automata/ui-screens/credits` adds a credits panel drawn from a content file: `creditsContent` is the `credits` content kind (`content/credits/credits.toml`: sections of names, a name with an optional role and an `https:` link; titles and roles are translated by `automata words`), and `CreditsPanel` shows it in core's `Modal` with the links opened through the host (`Hosting.openLink`). A name's link is a button only where the host grants `links`; a link the host refuses is said politely under the list. The panel's words are in the six languages (`screensWords(locale).credits`). `zod` is a dependency and `@automata/content` a peer.
- b7c536a: The package keeps the four screens core does not have: Title with the game's own actions, Results, Loading and Error. The Pause and Settings screens are gone from it, because core's Paused and Settings screens do everything they did (and also the saves, the leaderboard and the controller-reconnect step). A game that imported `@automata/ui-screens/pause` or `/settings` imports core's screens instead.
- 5a6e7eb: `@automata/ui-screens/splash` adds a studio splash: `splashStep({ logo })` is an opening step that shows the logo for a moment (1.5 seconds unless `holdMs` says otherwise) and ends early on any key, click or tap. It runs after the host is ready, so it never holds the ready signal back, and it makes no sound. The line under the logo is translated into the framework's six languages; the package's words are in `@automata/ui-screens/words/<language>.json`.
- Updated dependencies [0676026]
- Updated dependencies [5386c34]
- Updated dependencies [474d2f9]
- Updated dependencies [1b83c1b]
- Updated dependencies [30e8765]
- Updated dependencies [856e7eb]
- Updated dependencies [ee474b0]
- Updated dependencies [3357672]
- Updated dependencies [4b4328b]
- Updated dependencies [4374fdd]
- Updated dependencies [7312642]
- Updated dependencies [ceb2a01]
- Updated dependencies [b0f31b6]
- Updated dependencies [0500f40]
- Updated dependencies [4835238]
- Updated dependencies [dac7515]
- Updated dependencies [c078373]
- Updated dependencies [deb1360]
- Updated dependencies [f863ad0]
- Updated dependencies [fa85558]
- Updated dependencies [551a11f]
- Updated dependencies [030110a]
- Updated dependencies [f82f756]
- Updated dependencies [12bda87]
- Updated dependencies [6c0ccee]
- Updated dependencies [156126a]
- Updated dependencies [ceb2a01]
- Updated dependencies [b0f31b6]
- Updated dependencies [a66b4e0]
- Updated dependencies [7dc3e29]
- Updated dependencies [f68d822]
- Updated dependencies [3aef585]
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
- Updated dependencies [30667aa]
- Updated dependencies [5ee493d]
  - @automata/framework@0.1.0
  - @automata/content@0.1.0
