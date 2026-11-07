# Core and 2D refactor: spec

- **Stage:** 2 of 6 of the core-and-2D refactor (plan and spec). The plan that carries this out is
  [2026-11-05-core-and-2d-plan.md](2026-11-05-core-and-2d-plan.md); the facts behind it are in the
  [audit](2026-11-05-core-and-2d-audit.md). Finding IDs (S1 to S9, O1 to O6, T1 to T7, C1 to C5) point at the audit.
- **Date:** 2026-11-05, written on `claude/refactor-2d-plan`, stacked on the audit branch `claude/refactor-2d-audit`.
- **Decisions it builds on:** the Owner took all four audit recommendations ("go with your recs", 2026-11-05):
  D1 option B, D2 Effect only in Node tooling, D3 3D and editors follow core by codemod, D4 unused features leave
  core.
- **Status:** reviewed in stage 3 (the [plan audit](2026-11-05-core-and-2d-plan-audit.md), 2026-11-05); its fixes
  are applied here. Nothing here is built yet.

## 1. What done looks like

The refactor is finished when all of these are true, each checked by a command or by the Owner:

1. **Emberwick's journeys run on every pull request, in Chromium and WebKit, and pass.** (T2, T5)
2. **The Owner plays Emberwick on the iPad** from a build the agent hands over (the `game-ci` build artifact served
   on the local network, or the dev host deploy). (J1; the Owner's step)
3. **Core is four packages**, each grouped by feature: `sim`, `content`, `automata`, `tools` (section 3). (D1, S1 to S3)
4. **Effect is gone from everything that runs in the browser.** `pnpm boundaries` fails if a browser file imports
   `effect`. (D2, O2)
5. **Every test lives in a `tests/` folder**, in one of three kinds (`unit`, `browser`, `e2e`), named `*.test.ts`
   (`*.svelte.test.ts` when it uses Svelte runes). (T7, O4)
6. **A feature never imports another feature**, and lint says so. (section 3.3)
7. **A pull request that touches only core and 2D is not blocked by 3D or editor tests.** (C1, D3)
8. **GitHub has `main` plus fewer than five other branches**, each with an open pull request and CI. Merged branches
   delete themselves. (section 5 of the audit)
9. **`.vscode/` hides what the Owner does not need to see.** (section 6 of the audit)
10. **Everything a player or a new developer reads passes the drunk grandma test** (section 8).
11. **`docs/refactor/progress.md` says 100% for core and 2D.**

What does *not* change: the sim's rules (the seven laws), cross-engine determinism (same hashes in Node, Chromium,
WebKit and Firefox), strict TypeScript, Biome, knip, Zod as the one schema language, PixiJS as the renderer, and
Emberwick's movement and content. These are the parts the audit says to keep (section 3, "What is good").

## 2. Scope

**In:** the twelve core packages, `games/emberwick`, `games/placeholder` (removed), the 2D one-file examples
(`examples/core`, `shapes`, `textures`, `render`, `audio`, `ui`, `content`) and their journeys, all of `tooling/`,
`examples/resources`, CI workflows, root config, `AGENTS.md`, the numbered docs, branches and `.vscode`.

**Touched only to keep them building (D3):** `packages/editor-*`, `packages/render-pixi3d`, `packages/figures`,
`packages/sector-format`, `games/base-3d`, `examples/render3d`, `examples/figures` and their journeys in
`examples/e2e` (`render3d-*`, `figures-*`), and `agents/automata` (the Claude Code plugin and skills, whose
example game `pnpm boundaries` and `plugin:validate` check). Their imports are rewritten by
a codemod; their own code is not restructured; their tests still run, but not in the core pull request gate. Their
own refactor is the 3D and editor phases.

**Out:** the website repository; new game features; new engine features; publishing a release.

## 3. Package shape (D1, option B)

### 3.1 The four packages

| Package | Folder | Runs in | Made from | Effect | Published |
|---|---|---|---|---|---|
| `@mcthaydt/automata-sim` | `packages/sim` | anywhere (pure, except `src/testing/`, which runs under Vitest) | `sim`, plus the sim helpers of `testing` (`testing/sim`) | never | yes |
| `@mcthaydt/automata-content` | `packages/content` | Node (compiler, Vite plugin); its `game-config` and `locale` entries also in the browser (`assets` is Node-only: it needs `fontkit`, `pngjs` and `node:crypto`) | `content` | compiler files only | yes |
| `@mcthaydt/automata` | `packages/automata` | browser | `host`, `runtime`, `render-pixi`, `ui`, `game`, the umbrella, and the browser helpers of `testing` | never | yes |
| `@mcthaydt/automata-tools` | `packages/tools` | Node | `ship`, `cli`, `node`, and the Playwright helpers of `testing` (`testing/e2e`) | yes | yes |

The packages `host`, `runtime`, `render-pixi`, `ui`, `game`, `testing`, `node`, `ship` and `cli` stop existing.

Dependencies point one way: `automata` → `content` (browser-safe entries only) → `sim`; `tools` → `content` → `sim`.
`sim` imports nothing from AF. Nothing imports `tools` except games' build scripts and tests.

### 3.2 Entry points

Each package publishes as few entries as its users need. Every entry is a file in `src/entries/`.

| Package | Entries |
|---|---|
| `automata-sim` | `.`, `./math`, `./hash`, `./replay`, `./testing`, `./testing/commands` (Vitest browser commands, Node side), `./testing/property` |
| `automata-content` | `.` (compiler API), `./vite`, `./game-config`, `./locale`, `./assets`, `./schema`, `./palette` (the last two from #383); bin `automata-content` |
| `automata` | `.` (what a game imports: `defineGame`, `startGame`, the sim re-exports, input, draw), `./no-eval`, `./extension`, `./target`, `./testing`, `./theme.css`, `./tooling` |
| `automata-tools` | `.` (`defineShipConfig` and the ship API), `./e2e` (Playwright helpers); one bin, `automata` |

`./target` keeps today's build-time target choice (ADR 0006): a conditional export with the conditions
`automata-web` (also the default), `automata-ruken` and `automata-tauri`, which `ship` sets when it builds for a target. Inside the
package, `app/boot` imports it by its public name (`@mcthaydt/automata/target`), as `runtime` does today.

`sim/src/testing/` is test-helper code: it imports `vitest` (an optional peer dependency of `automata-sim`) and
reads golden files with `node:fs` in Node, so it sits outside the sim purity rule and nothing else in `sim/src`
may import it.

The one bin `automata` takes every command: `automata create-game`, `automata ship prepare`, `automata add`,
`automata check`, `automata editor`. `automata-ship` stays as an alias for one release and prints
"`automata-ship` is now `automata ship`".

### 3.3 Inside a package: features

Every package's `src/` follows the reference layout (`WebDevSimplified/parity-deals-clone`,
`feature-folder-structure`), with names that fit a game framework:

```
packages/automata/src/
  app/            the composition root: defineGame, startGame, runGame, boot. Wires features together.
  features/       one folder per feature, everything about it in one place
    audio/  display/  extension/  flow/  input/  loading/  locale/  render/  saves/  screens/  settings/  targets/
  shared/         code more than one feature needs, owned by no feature
    host/         the host contract (the port every target implements)
    ui/           the widget kit: controls, dialog, focus, geometry, layout, slots, status, touch, theme
    lib/          small helpers: subscribable, clock, disposables, errors
  entries/        the published entry files; each re-exports from app/, features/ or shared/
  testing/        the published test helpers (the `./testing` entry), product code, not tests
```

The rules, enforced by `pnpm boundaries` (section 3.5):

1. A file in `features/<x>/` imports from `features/<x>/`, `shared/`, other AF packages' public entries and
   third-party packages. **Never from another feature, `app/` or `entries/`.**
2. A file in `shared/` imports only from `shared/` and outside packages. Never from `features/`, `app/` or `entries/`.
3. `app/` may import features and shared. Only `entries/` and `testing/` import `app/`.
4. `entries/` re-exports only; it holds no logic.
5. `testing/` may import anything in its own package; product code never imports `testing/`.

When feature A needs feature B (for example the settings screen needs the audio volume), `app/` passes B's value
or function into A. Features stay testable alone, and the place where features meet is one folder.

The same layout applies, sized down, to the other packages:

- `sim`: `src/features/{world,schedule,define,rng,replay,hash}`, `src/shared/{math,util,version}`, `src/entries/`,
  `src/testing/`. All of it except `src/testing/` stays under the sim purity rule.
- `content`: `src/features/{compile,parse,assets,locale,flow,game,tuning,palette,preload,generate,vite}`,
  `src/shared/{diagnostics,files,hash,schema}`, `src/app/cli/`, `src/entries/`, `src/testing/`. The browser-safe entries may not
  import (directly or not) `effect`, `node:*`, `fontkit`, `pngjs` or `subset-font`.
- `tools`: `src/features/{ship,create-game,add,check,editor,build}`, `src/shared/{node,errors,config}`,
  `src/app/cli.ts`, `src/entries/`, `src/e2e/`.

**Games use features too.** The game-layout-by-role rule (GL spec, "constants.ts, components.ts, systems.ts")
is retired for games; a game's `src/` is `features/<x>/` plus `app/` like a package, and `main.ts` at the game
root. The sim purity rule follows the files: every file whose name ends in `.component.ts`, `.system.ts`,
`.command.ts`, `.event.ts`, `.resource.ts` or `.plugin.ts`, wherever it sits, is a sim file, **and so is every file
a sim file imports by relative path** (Emberwick's `tiles.ts`, `tuning.ts` and `place-wick.ts` have no suffix but
are sim code, and are checked today). `packages/sim/src` and `packages/sector-format/src` stay sim by path. The one-file examples
keep their `// --- <role> ---` sections, since they are one file.

Emberwick after the move:

```
games/emberwick/
  main.ts  index.html  ship.config.ts  package.json  vite.config.ts  playwright.config.ts
  content/                     authored content, unchanged
  src/
    app/game.ts                defineGame({...}): wires the features
    features/
      player/                  player.component.ts, player-input.system.ts, player-move.system.ts, move.command.ts, place-wick.ts
      room/                    room content loader, level-room, tiles, backdrop, light levels
      goal/                    goal.system.ts, the ember
      art/                     palette, sprites, PROVENANCE.md
      screens/                 Emberwick's menu copy and screens
    shared/                    what two Emberwick features both need (kinds, pixels)
  tests/
    unit/  browser/  e2e/  fixtures/
```

### 3.4 Tests

Each package and game has a `tests/` folder beside `src/`:

```
tests/
  unit/<feature>/      Node, or jsdom when the file starts with `// @vitest-environment jsdom`
  browser/<feature>/   Vitest browser mode, real Chromium, WebKit and Firefox (parity, layout, goldens)
  e2e/                 Playwright journeys (games, examples, and `tools`' `create-game` journey)
  bench/               timings, run by `pnpm bench` only, never in a gate
  fixtures/            data and fakes the tests share
```

- **One suffix:** `*.test.ts`, or `*.svelte.test.ts` for a test that uses Svelte runes (Svelte compiles runes only
  in files named `.svelte.*`). Svelte test host components (`*.test.svelte`) are fixtures: they sit in
  `tests/fixtures/`, or in `src/testing/` when a published helper uses them. The folder says what kind a test is.
  The other suffixes (`.parity`, `.layout`, `.dom`, `.slow`, `.golden`, `.contract`, ...) go. (O4) Role suffixes
  stay: `move.schema.test.ts` tests `move.schema.ts`.
- **One Vitest preset:** `tooling/vitest-preset` exports `defineTests(options)`, which returns the `unit` and
  `browser` projects with the folder globs above. The options are what today's 24 configs differ by and nothing
  more: `environment` (`node` or `jsdom`, the package's default for unit tests), `setupFiles`, `css`, `svelte`,
  `browsers` (engines, default all three), `browserCommands` (golden file commands) and `optimizeDeps`. Each
  package's `vitest.config.ts` is one call to it. Project names are only `unit` and `browser` (plus `bench` when
  `pnpm bench` runs). A test file whose environment differs from its package's default says so in its first line
  (`// @vitest-environment jsdom`).
- **One Playwright config per game or example set:** `games/emberwick/playwright.config.ts` starts only
  Emberwick's two servers; `examples/playwright.config.ts` starts only the examples' server. The root config goes.
  (T3)
- **Typecheck covers tests:** each package's `tsconfig.json` includes `src`, `tests` and its config files.
- Tests import the code they test through the package's public entries where they can, and through
  `#src/<path>` (a `package.json` `imports` alias) where they test something internal. No `../../src` chains.
  (T7's 875 relative imports)

**Which tests run where:**

| Gate | Runs | When |
|---|---|---|
| `pnpm check` (local and PR) | lint, typecheck, boundaries, style, knip, every `unit` project in core and 2D, `changeset status`, `check-changesets` | every PR |
| `pnpm test:browser` (PR) | core and 2D `browser` projects in Chromium, WebKit and Firefox | every PR that touches core or 2D (turbo `--affected`) |
| `pnpm test:e2e` (PR) | Emberwick's journeys in Chromium and WebKit (phone and iPad sizes); the 2D examples' journeys in Chromium | every PR |
| 3D and editor suites | their `unit`, `browser` and journeys, base-3d's game job, the 3D examples' journeys | their own workflow, on PRs that touch their files or core (so the codemod's results are checked); not a required check, because a required check that a path filter skips never reports and blocks the merge |
| release | build, API report, API index, agent skills, plugin validation, consumer smoke, dist test | before every publish (called by `release-packages.yml`), nightly and by hand; not on PRs (O5) |
| frame budget | the core stress example's frame budget (`tooling/frame-budget`) | nightly; reports "skipped: software renderer" and exits 0 when the GPU is a software one (C2); still fails on an unset budget, a bad result or a different GPU |

### 3.5 Boundaries tool

`tooling/check-boundaries` grows one check, `--features <package-root>...`, that reads each file's imports
(its existing AST reader) and fails on any import that breaks the rules in section 3.3, printing:

```
packages/automata/src/features/saves/save-slots.ts:4:1
  "saves" imports "settings" (features/settings/settings.manager.ts).
  A feature may only use its own files and shared/. Pass what it needs in from app/, or move the shared part to shared/.
```

It also learns two more rules:

- `--browser <package-root>...`: no file reachable from a browser entry value-imports `effect` or `node:*` (D2).
  `import type` lines bring no code and do not count.
- The sim rule finds sim files by role suffix and by what they import (section 3.3), so the game roots in
  `package.json`'s `boundaries` script become `games/*/src`. Every other root and flag of today's line stays:
  `packages/sim/src`, `packages/render-pixi3d/src/sim`, `packages/sector-format/src`,
  `tooling/frame-budget/stress/sim`, the agent skill's example sim, `--inline examples` and `--platform-imports`.
- `#src/…` imports (section 3.4) are allowed only in `tests/`.

## 4. Effect leaves the browser (D2)

ADR 0003 is amended: Effect is used in Node tooling (`tools`, `content`'s compiler) only. The browser package uses
plain TypeScript with these five patterns, which replace Effect's:

| Effect | Plain TypeScript, in `shared/lib/` |
|---|---|
| `Context.Tag` services, `Layer` | a `create<Thing>(deps)` factory returning a plain object; `app/` builds them in order |
| `Clock`, `TestClock` | `Clock` interface (`now(): number`, `setTimeout`, `clearTimeout`) passed in; `fakeClock()` in `testing/` |
| `Scope`, finalizers | `Disposables`: `add(fn)`, `dispose()` runs them in reverse once; each factory returns `{ dispose }` |
| tagged errors, `Effect.fail` | a host refusal is a value (`{ ok: false, reason }`), a bug throws an `Error` with a plain message |
| `Stream`, `SubscriptionRef`, `Subscribable` | a new plain `Subscribable` (`subscribe(fn) → unsubscribe`, `get()`); today's `host/src/subscribable.ts` wraps Effect's |

No new dependency. Every converted feature keeps its tests, rewritten to the same behaviour (a test that checked
"the save fails with `SaveDenied`" now checks "the save returns `{ ok: false, reason: 'denied' }`").

**Success:** `pnpm boundaries` passes with the `--browser` rule; Emberwick's production build has no Effect module
in it (checked by `tooling/bundle-report`, below); Emberwick's journeys pass.

**Bundle report.** `tooling/bundle-report` (new, small) builds a game with Vite's manifest and prints the gzip
size per library (pixi, svelte, zod, effect, AF, the game). It runs once before D2, once after, and the numbers go
in `progress.md`. It replaces the placeholder's `budget:size`.

## 5. What leaves core (D4)

A feature stays when Emberwick, `games/base-3d` or an editor uses it, or when every distribution target needs it.
"Uses" counts what `defineGame` wires in for a game by default (the default Settings, Pause and Title screens),
not only what a game's own `src/` names: a grep of game source alone misses those (the first draft of this table
made that mistake and listed rebinding as unused; the Owner caught it on 2026-11-05). One-file examples, fake
hosts, the website playground's runner and journeys do not count as users: they show or test a feature, so they
go with it.

| Feature | Used by | Decision |
|---|---|---|
| Rebinding and input profiles (`input/bindings`, `ControlsSection`) | every game: `keys()` builds the profile; `base-3d` uses the default Settings screen, whose Controls section rebinds it (Emberwick has its own screens) | **keep**, in `features/input` and `features/settings/ui`. The `core-input-rebind` example and journey stay |
| Gamepad glyph families | the Controls section and button prompts in the default screens | **keep** |
| Swipe gestures | `keys()` and the Touch section of the default Settings screen | **keep** |
| Haptics and the vibration setting | the default Settings screen's Vibration section; `base-3d` settings | **keep** |
| Leaderboards (if deleted, also `core-leaderboard` and its journey, and the leaderboard parts of `examples-runner`'s fake Ruken host and `examples/ui/primitives`) | `defineGame` and the default Pause screen wire them; no game declares a leaderboard | **keep** (task 2.4, step 0, 2026-11-05). Neither game declares `scores`, so the default Pause screen's `LeaderboardPanel` never shows (Emberwick has its own screens). But the boot path changes without it: `boot-program.ts` builds the `Leaderboards` manager, `defineGame`'s `scores` option and the `ship` board names feed it, and the host contract carries a `leaderboards` capability that the `ruken` target answers. Removing it is a breaking change to a published contract, so it is left for the Owner to decide, not taken as "unused" |
| Networking port (`runtime/src/net`) | nobody, not even through `defineGame` | **delete** |
| Analog input and camera turn | `base-3d`, `render-pixi3d` | keep, in `features/input/analog` |
| Tauri target (`host/src/tauri`, `ship/src/targets/tauri`, the `automata-tauri` condition) | every new game: `create-game` writes all four targets by default; itch.io's desktop downloads are the Tauri bundles (`publish --target itch --from tauri`); `game-release.yml` builds them | **keep**, in `features/targets/tauri` and `tools`' `features/ship`; a peer of `web`, `itch` and `ruken` (ADR 0006). The first draft deleted it; the Owner asked why on 2026-11-05 and the plan audit found these default users |
| Six-language font subsetting | build step, Emberwick ships `en` | keep (Node only, costs the player nothing) |

"Delete" removes the code, its tests, its examples and journeys, its settings copy and its API entries. Git keeps
it; a tag `pre-refactor-2d` on the last commit before the first deletion marks where to find it.

Also removed: Emberwick's stand-ins (O1: `play-room.ts`, `loop.ts`, `input/devices.ts`, `input/keys.ts`,
`render/renderer.ts`, `boot-page.ts`, `boot-failure.ts`, `ruken/boot.ts` and their tests; the hot-reload demo
moves to `startGame`), and `games/placeholder` (S7) with its CI job, servers, `ci:local` steps and budgets.

## 6. One name per thing (S5, S6)

- **The game is Emberwick everywhere:** folder `games/emberwick`, package `@af-games/emberwick`, game id
  `emberwick`, sim plugin `emberwick`, title "Emberwick", Playwright projects `emberwick-<size>-<engine>`
  (`phone`, `compact`, `ipad`). (Pre-1.0: no save migration is needed; the old id's saves are not carried over,
  and the spec says so.) The plugin name is part of the sim's state hash, so the rename re-records Emberwick's
  golden hash once, in Node, with the reason in the commit; Chromium, WebKit and Firefox must then match it.
- **Games import one package:** `@mcthaydt/automata` (plus `@mcthaydt/automata-tools` in build and test files).
  Emberwick and the examples both do. The public surface is what they import plus what the 3D game and editors
  import (measured by the codemod's report), and nothing else. (S4)

## 7. Process weight (O5, S8, S9, C5)

- `ci:local` becomes `pnpm ci:local` = `pnpm check && pnpm test:browser && pnpm test:e2e`. Three steps.
- `docs/` keeps: `README.md` (what AF is, five minutes), `docs/status.md` (one page, replaces `02` and `03`),
  `docs/adr/`, `docs/guides/`, `docs/refactor/`, and the files tools or rules read: `versions.md` and `stack.md`
  (`tooling/versions`), `cheatsheet.md` (`pnpm cheatsheet`), `provenance/` (`AGENTS.md`), `runbook.md` (the Owner's
  credential procedure), `art/`, and `design/` (the editors' phase). Everything else moves to `docs/archive/` in
  one commit;
  `docs/evidence/` PNGs leave git (kept as CI artifacts; one commit deletes them; history keeps them).
- `AGENTS.md` is rewritten to under 150 lines: the current rules only, no history. The direction-change paragraph
  goes to `docs/archive/direction-log.md`.
- Comments that cite a plan ID, spec section or dated Owner decision are rewritten to say *why* in plain words, or
  removed when the code already says it. `check-style` fails on a new one (`/\b(M\d+(\.\d+)*|[A-Z]{2,}\.\d+|§\d)/`
  in a comment).
- `examples/README.md` describes what is there today.

## 8. Drunk grandma test

Every string a player sees, every error a developer sees, and every README is checked against four questions. A
string that fails any of them is rewritten.

1. **Can she tell what is happening?** ("Saving..." not "Persisting slot 1")
2. **Can she tell what to do next?** Every error ends in an action ("Tap to try again", "Run `pnpm install`").
3. **Is it short?** One idea per sentence; a button is one to three words.
4. **Is there no jargon?** No package names, IDs, codes or framework terms in player text.

The UX half:

- Every action a player needs is a visible button at least 48 px tall (44 px for secondary), on every screen size
  the journeys test.
- Nothing needs a keyboard on a touch device or a mouse on a keyboard device.
- Every wait longer than half a second shows that something is happening.
- The boot failure panel says in one sentence what went wrong and has one button that fixes the usual cause.

The plan's copy task lists every player-facing string (from `features/screens/*copy*` and Emberwick's screens) in a
table with its old and new text, and a journey asserts the menu, pause and failure copy by role and name, so a
regression shows in E2E.

## 9. Branches and editor setup

- **End state:** `main`, the refactor's working branch while a PR is open, and nothing else from core and 2D.
  Parked 3D and editor drafts (#377, #381, #382) are kept as tags `parked/<branch>` and their PRs closed with a
  comment pointing at the tag; #378 is closed; #383 and #379 land on `main` before the refactor starts (plan task
  2.1), so the refactor carries their changes. The 334 merged branches and the 13 abandoned ones are deleted after tagging the 13
  (`abandoned/<branch>`). **Deleting branches and closing PRs is the Owner's call** (`AGENTS.md`): the plan's
  branch task prepares the script and the list and runs it only after the Owner says go in the thread.
- **Auto-delete:** `delete_branch_on_merge` on (a repository setting; the Owner's switch, or the agent's with the
  Owner's go).
- **`.vscode/`:** `settings.json` with the audit's `files.exclude` and `search.exclude` lists (section 6), updated
  for the new layout (the old package folders are gone, so fewer entries), Biome as the default formatter with
  format on save, and `extensions.json` recommending Biome, Svelte and Playwright. The "hide while 2D runs" block
  sits under a comment `// Hidden while the core and 2D refactor runs. Remove when 3D starts.`

## 10. Order and pull requests

Each phase is one pull request (two where noted), merged before the next starts, so `main` stays green and each
review is about one thing. Sessions are refreshed after 90 minutes; most tasks fit one, and the four that cannot
(test move, the `automata` merge, the Effect conversion, the comment rewrite) name their session breaks in the
plan.

| # | Phase | Findings | PRs |
|---|---|---|---|
| 1 | CI tells the truth: per-game Playwright configs, Emberwick on PRs in two browsers, editors out of the gate, frame budget skips, release-only checks, `.vscode` | T2, T3, T5, C1, C2, O5 | 1 |
| 2 | Remove what is unused: stand-ins, placeholder, D4 features | O1, O6, S7 | 2 (stand-ins + placeholder; D4) |
| 3 | Test layout: `tests/` folders, one suffix, the Vitest preset | T7, O4 | 1 |
| 4 | Four packages by feature, the boundaries rules, the codemod for 3D and editors | S1 to S3, C4, D1, D3 | 2 (`automata` merge; `tools` and `sim`/`content` tidy) |
| 5 | Effect leaves the browser, feature by feature | O2, D2 | 2 (host and lib; runtime features and game) |
| 6 | One name, one import, smaller surface; Emberwick by feature | S4 to S6 | 1 |
| 7 | Process weight: docs, AGENTS.md, comments, `ci:local` | S8, S9, O5 | 1 |
| 8 | Copy and UX pass (drunk grandma), new journeys | T6, section 8 | 1 |
| 9 | Branches, tags, auto-delete (with the Owner's go) | C5 | none (repository actions) |

## 11. Risks and how the plan handles them

| Risk | Handling |
|---|---|
| A move changes behaviour without a test noticing | Phases 3 and 4 are moves only; every unit, browser and journey test passes before and after, with the same test count, and the sim goldens' hashes (the sim package's goldens and Emberwick's `GOLDEN_HASH`) do not change. The one planned hash change is the plugin rename in phase 6. |
| 3D or the editors break | The codemod (phase 4) rewrites their imports from a mapping table, and their CI job must pass on the same PR (it is not in the core gate, but it is run). |
| Effect removal changes timing | The converted features keep their deterministic tests on a fake clock; Emberwick's journeys and the boot tests run after each feature. |
| WebKit journeys are slow or flaky on the runner | Journeys wait on semantic readiness, never on sleeps (`AGENTS.md`); the golden-route journey runs once per engine at one size, not per size. |
| Deleting a feature someone wanted | The tag `pre-refactor-2d` keeps it; section 5's table is the record of why. |
| Lost work in branches | Every unmerged branch is tagged before it is deleted. |

## 12. Veto defaults (decided here; the plan audit or the Owner may change them)

1. Tests sit in a `tests/` folder in each package and game, not in one repository-wide `tests/`, so each package
   builds and tests on its own and turbo can cache it.
2. The browser package takes the umbrella's name, `@mcthaydt/automata`; the tools package is
   `@mcthaydt/automata-tools`.
3. ~~The Tauri target leaves core.~~ Withdrawn: the Owner chose "Keep Tauri" on 2026-11-05 (section 5).
4. Games move from role files to features (section 3.3), retiring the GL spec for games.
5. The game id becomes `emberwick`; old saves are not migrated.
6. Evidence PNGs leave git going forward (history keeps the old ones).
7. The 3D and editor suites run in their own path-filtered CI job rather than being frozen.
8. `@mcthaydt/automata-tools` is published, so `create-game`, `add`, `check` and `editor` (today in the private
   `cli`) are published for the first time. (Added by the plan audit.)
9. `changeset status` and `check-changesets` stay on pull requests: they take seconds and catch a missing
   changeset before merge rather than at publish. (Added by the plan audit.)
