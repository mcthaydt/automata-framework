# @automata/tools

## 0.1.0

### Minor Changes

- 12bda87: The first public release: the four packages are on npmjs.org, free to install with no sign-in. `npx @automata/tools create-game my-game` makes a small game that runs, with a level you can open in the editor, a test and its own release workflow.
  
  BREAKING: this release replaces everything published before it under `@mcthaydt/*`. The packages are now `@automata/framework`, `@automata/content`, `@automata/sim` and `@automata/tools`; the browser packages (host, runtime, render, ui, game, testing) are one package, and the build tools (ship, cli, node) are one package, `@automata/tools`. The browser runtime no longer uses Effect, `NetworkPort` and `AuthoritativeSnapshot` are gone, and the root entry of `@automata/framework` is smaller (600 names became 274). Change your imports and your `package.json` to the new names.
  
  - `automata editor` opens the 2D level editor and the Tuner, which shows your game beside its settings, with nothing else installed; it names the game it opened in plain words.
  - `automata check` runs the determinism and layout checker, and a `levels` step that fails when a level project and the game files saved from it disagree; `--only <step>` runs one step.
  - `automata ship prepare` and `publish` take `--target web|itch|tauri|ruken` and check a web build for secrets, inlined assets, `eval` and root-absolute paths.
  - `@automata/content` has `level-2d`, the 2D level format the editor writes and games read, two browser-safe entries (`schema`, `palette`), and tunables that may carry a `label`, `feel`, `unit` and `scale`. In dev, a content save updates the running game in place.
  - `@automata/framework` has plainer default screens and messages, `startGame(game, { at })`, and `checkLayout` targets for editors.
  - The messages and `--help` of every command say what to do next in plain words.

### Patch Changes

- 0676026: Doc comments that named the three 3D packages (the renderer, the figures and the sector format) now say they are one, `@automata/3d`. No behaviour changes.
- 5386c34: `@automata/framework/testing` now exports `fakeClock`, and `@automata/framework` exports `systemClock`, so a renderer can time a wait without Effect. `@automata/content` adds `compileContentResult` and `@automata/tools` adds `manifestOf` and `rukenHeadersOf`, plain-value forms of what the Effect API did.
- 474d2f9: A game declares achievements in `ship.config.ts` beside its leaderboards: an id, a title, a description and one goal on one of its boards (`reach` a score, or the `top_percent` of players). `@automata/content/game-config` exports `AchievementConfig` and `AchievementGoal` and its schema checks the declaration; it names no host. `automata ship prepare --target ruken` writes each achievement into `ruken.toml` (and a board's `title`), refuses a top share Ruken has no rule for with the shares it allows, and puts Ruken's own achievement errors in plain words. The web, itch.io and desktop builds accept the declaration and do nothing with it. `automata check` has a new `achievements` step, and `automata words` writes the achievements' source words to `messages/achievements/en.json` and translates them like any other catalog. `@automata/content/game-config` can now be loaded by plain Node from source.
- e61b179: `automata words` has an AI translate a game's words: every missing or changed word into every language the game ships, one language with `--to`, one line with a key, everything again with `--all`, and `--mark` to record translations written some other way. It needs `ANTHROPIC_API_KEY` on the computer running it, uses the key to reach the translator and nothing else, and can be pointed at another model with `words.model` in `ship.config.ts`.
- c4f5070: `automata-check-boundaries --browser` no longer reads a `.json` file a browser entry imports as if it were code, so a package can ship message catalogs beside its source.
- b0f31b6: `automata-check-boundaries --browser` refuses `@anthropic-ai/sdk` (a Node-only library) in a browser package's entries, as it does `fontkit`, `pngjs` and `subset-font`.
- 0aad7f3: `automata-check-boundaries` can now refuse a package's imports. `--forbid <package-root>:<package>,…` fails any source, test or Svelte file under the root that imports one of the named packages, and `--features … --shared-island <folder>` keeps a folder of `shared/` from importing its siblings. `--features` now reads Svelte components as well as `.ts` files.
- 30e8765: The comments in the generated API reference say what each name does and why, not which project the code first came from.
- 235011b: `automata-check-boundaries --confine <package>:<folder> <root>...` fails when a source under the roots outside the folder imports the package, so a private package stays behind its one door.
- 32fc7b1: A new game's editor list names the content editors' files (Feel, Audio, Writer and Sequence), so each editor can start its first file.
- 4374fdd: A new game keeps its default controls in `content/controls.toml`, which the Tuner edits, and `@automata/framework` exports `keyLabel`, `padLabel` and `PROMPT_COPY` for showing key and button names.
- d065195: `automata create-game` takes `--template 2d|3d`, `2d` by default. The 3D template makes a game of Wick walking around one room, with a tuning file and the editor list. It is offered only where the 3D package is found (inside this repository, or with `AF_BETA_3D=1`); anywhere else `--template 3d` says "3D games need a package that is not public yet. For now, make a 2D game: leave out --template." and writes nothing.
- 11ce6dd: A game made with `create-game` runs `pnpm fonts` before `pnpm check`, so the check's build finds the font faces `src/main.ts` imports. Before, a fresh game's `pnpm check` failed at the no-eval step until `pnpm dev` or a build had cut the fonts once.
- dd8f716: The 3D game template's camera comment now describes the new default gameplay camera: 50 mm, 30 degrees down, 16 m back, turned in 45 degree steps. The template's code is unchanged; it takes the camera from `@automata/3d`.
- ceae06f: `automata ship prepare --target tauri` says what is missing in plain words, with the one command that installs it:
  Rust (also when `cargo` is not on the path at all, which used to print `could not run cargo: spawn cargo ENOENT`),
  the Linux desktop libraries (now Tauri 2's whole Debian and Ubuntu list, not just WebKitGTK), the game's Tauri CLI,
  and a missing web build (`run pnpm build:tauri first`, instead of an `lstat` error).
- 6c0ccee: `@automata/tools/e2e` has `passFirstRun(page, language?)`, which presses through a game's first-run language screen (and its photosensitivity warning) the way a player does, for a browser journey of a game that ships more than one language.
- 85b8e52: `automata editor` names the game by the title its `package.json` gives under `automata.title`, so a game called `base-3d` opens as "Ember Hall" and not "Base 3d". Without a title it names the folder, as before.
- 1dd042e: A new game draws the level and the characters the editor made, and `automata editor` no longer fails to list the game's files while the content build is writing its own: a file that is gone by the time it is read is left out, so a save in the editor is not lost.
- e344f12: `automata editor` opens a 3D room (`*.af-sector.json`) as well as a 2D level when the game has no editor list, and its first line names the game by its title: "Opened Ember Hall." instead of "Opened Ember Hall in the level editor."
- 91e439b: When the game beside `automata editor` stops before it starts, "Play is off" now says the cause in one line (for example the package Vite could not find) and what to do, where it used to print the end of a stack trace.
- 334188c: `automata editor` opens the editors page by default, starts the game beside it (Play opens it, the Tuner shows it) and
  serves Publish, which builds the game for the web, checks it and hands over one zip to upload. Give `--game-url` when the
  game already runs and the command starts none.
- c353394: `automata editor` now prepares the game the way `pnpm dev` does before it starts the game's Vite: it runs the game's own `fonts` script, so a new game that was never started with `pnpm dev` no longer opens a blank Play tab (its `src/main.ts` imported fonts that were not written yet).
- 6933104: `@automata/feel` now asks for `pixi.js` with a caret (`^8.22.0`), as the other packages do. A game made with `create-game` now plays Feel and Audio: it comes with a starter feel and sound for the square bumping a wall, and its Feel and Audio editors change what it plays.
- 7dc3e29: `Hosting` gains `openLink(url)`: a game opens a web page the way its host wants it done. Ruken asks the player first (the game adds `'links'` to `hosting.wants`), the web and itch targets open a new tab, and the desktop opens the player's own browser. Only `https:` addresses are opened, a host or player that says no is an answer (`opened: false`) and not an error, and the game is never navigated away. The web, itch and desktop targets grant `links` themselves. `@automata/framework/testing`'s `describeHostingContract` takes an optional `LinksProbe` to run the same link cases on an adapter, and `fakeHosting` records links and answers them. The generated desktop project registers Tauri's opener plugin and allows `https:` addresses only; `@tauri-apps/plugin-opener` is a new optional peer of `@automata/framework`, and `create-game` adds it for a game that builds for `tauri`.
- 5ecd0fa: Browser journeys take free ports from the operating system when their Playwright config loads, instead of ports worked out from the checkout and `AF_RUNNER_PORT_OFFSET`, so jobs sharing a machine never meet on a port. `AF_RUNNER_PORT_OFFSET`, `AF_E2E_*_PORT` and `QB_*_PORT` no longer do anything.
- 95ce3e0: A game made with `create-game --template 3d` plays its room in the time of day the level file names, so the 3D level editor's Time of day picker changes what the player sees.
- fc1c6cf: A game made with `create-game` now plays the level the editor saved under any name, and draws only the characters its project defines, so a level made in the site's try-it editor and put into a new game opens instead of showing a blank screen.
- 3aef585: `automata create-game` makes a game that sounds and speaks like the framework's own: its buttons play starter sounds (`ui.press`, `ui.back` and `ui.focus`, cues in `content/audio/audio.toml` that the Audio editor changes, mapped by `uiSounds` in `src/app/feel-audio.ts`), it ships in the six default languages with a catalog for each, and it draws them in the Fusion Pixel font set copied into `assets/fonts/` with its licence and named in `content/fonts.toml`. `pnpm dev` and every build cut the fonts first (`automata-content assets`, from the new `automata.content.ts`), and the page draws in `var(--af-font)`. The 3D template is unchanged.
- c47303a: `automata-check-boundaries --no-extension-imports <root>...` fails when a source under the roots imports a package from `extensions/`, so core never depends on an extension.
- ad389be: `automata editor` picks the editors your game needs from its `content/editors.toml`, so `--app` is gone. A 2D game
  opens Levels and the Tuner; a game whose list names a 3D editor opens the full suite.
- 05c8e03: `passFirstRun` in `@automata/tools/e2e` no longer hangs when the language screen is followed at once by the flashing warning: after a press it waits only for the screen it pressed. `@automata/ui-screens/credits` adds `showCredits`, which shows the credits panel in a screen's layer for a game that is plain TypeScript and has no Svelte of its own to mount it with, and hands back how to close it.
- d401a9f: BREAKING: the root entry of `@automata/tools` is `defineShipConfig` and the types of its sections, and nothing else. The ship, deploy, secret-scan, board and Tauri helpers that the root used to export are no longer public: a game drives them through the `automata` command (`automata ship prepare|publish`, `automata check`, `automata build`, `automata editor`), and the repository's own tooling imports them from `./internal`, which is not published.
- 3763a3d: Groundwork for `automata words`: reading a game's message catalogs (its content words and its interface words), the `{placeholder}` check on a translation, and the record of which source text each translation was made from, so a word whose source changed reads as stale.
- 29ccea7: `automata check` has a `words` step: every language a game ships must have all its words, with the same `{placeholders}` as the source, and the game's fonts (`content/fonts.toml`) must be able to draw every letter of every language. A language no font is declared for is a finding, and the device's fonts never count. A game with one language and no `fonts.toml` has nothing to check, so no game that exists today changes. The framework packages' words (`@automata/framework`, `@automata/ui-screens`, `@automata/net-ui`) are held to the same fonts.
- d14076d: `automata words` tells a key the translator turned down, a limit and an outage apart from a model's refusal, and stops at the first of them instead of asking for every word (what it translated is kept). A 429 is asked again a few times, waiting longer each time. The key is `AUTOMATA_ANTHROPIC_KEY` when set, else `ANTHROPIC_API_KEY`, and is never printed.
- b42955c: `automata` loads the editor server only for `automata editor`, so the other commands run from the workspace sources.
- Updated dependencies [5386c34]
- Updated dependencies [474d2f9]
- Updated dependencies [30e8765]
- Updated dependencies [856e7eb]
- Updated dependencies [ee474b0]
- Updated dependencies [3357672]
- Updated dependencies [4b4328b]
- Updated dependencies [b0f31b6]
- Updated dependencies [0500f40]
- Updated dependencies [f863ad0]
- Updated dependencies [fa85558]
- Updated dependencies [551a11f]
- Updated dependencies [12bda87]
- Updated dependencies [156126a]
- Updated dependencies [ceb2a01]
- Updated dependencies [a66b4e0]
- Updated dependencies [3aef585]
  - @automata/content@0.1.0
