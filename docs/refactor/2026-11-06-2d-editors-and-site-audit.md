# 2D editors and website audit

- **Stage:** 1 of 6 of the "2D editors and website" slice (audit). The next stage writes the plan and spec from this.
- **Date:** 2026-11-06, on top of the core-and-2D stack (PR #403, head `f2d2174b`), and `mcthaydt/automata-website` at
  `main` `4a514eb3` (the site's data is pinned to framework commit `f8023a90`, from before the refactor).
- **What it covers:** what a 2D-only launch needs from the editors and the website: `editor-kit`, `editor-2d`, the parts
  of `editor-suite` that 2D touches, `automata editor` in `-tools`, the editor guide and mock-ups, and the whole website
  repository.
- **What it does not do:** change code, or audit 3D (`editor-3d`, the Studio, `render-pixi3d`, `figures`,
  `sector-format`, `games/base-3d`). Section 6 notes where 3D will plug in. Section 7 lists the decisions the Owner takes.

Every number below was measured on these checkouts on 2026-11-06. The commands are in the appendix. WebKit and Firefox
cannot be installed in a cloud session, so every browser run here is Chromium; hosted CI was not run.

## The short version

1. **You cannot edit Emberwick's level and see the change in the game.** The 2D editor opens Emberwick's room from the
   checkout and Save writes it back. But the game reads other files (the export), which change only if a person opens
   Export, downloads four files and copies them into `content/` by hand. Nothing checks that the two agree.
2. **The editors do not ship to anyone.** `automata editor` serves `packages/editor-<app>/dist` from a checkout of this
   repository; the published `-tools` package contains no editor. A game made with `create-game` has no level, no editor
   list and no way to open an editor. The command opens the 3D editor by default.
3. **There are two 2D editors, and only one works on a real game.** `editor-2d`'s own app reads and writes the checkout
   and has all its views. The editor suite always opens a built-in "Sample game", whatever folder it is served on; its
   Levels 2D has only the Level view; its rail lists nine editors, two of which work in 2D; and its Ship, Ask, checks and
   gates are built and tested but wired to nothing. The suite also bundles the closed Pixi 3D beta.
4. **Editor unit tests are strong. Nothing tests the product end to end, and the 2D gate runs none of it.** 3,348 unit
   and DOM tests pass, and the 2D editor's layout and canvas tests pass in Chromium (252). The ten "journeys" mount the
   editor inside a test page: none starts `automata editor`, opens the built page or looks at a file on disk. `pnpm check`
   and `ci.yml` skip every editor package.
5. **The website describes the framework before the refactor, and breaks on the refactored one.** Its Start page tells
   visitors to clone a private repository and run a package name that no longer exists; the home page walks through six
   files the refactor deleted. Against the refactored framework, 6 of its 78 test files fail and `pnpm build` stops at
   its first step, because the site imports Emberwick's and the sim's source files by relative path.
6. **The website has never been deployed, and it is heavier than what it has to say.** There is no host, DNS or deploy
   credential (the deploy job is a dry run). It has 17 pages, 26 scripts (1,081 lines of them copy data out of the
   framework), 7.3 MB of committed demo builds (4.3 MB of them a demo nothing links to), and release, proof and rollback
   machinery for a site with no visitors yet.
7. **The good parts are worth keeping.** The editor kit is dimension-neutral and really shared. The 2D editor is capable,
   loads in 139 kB gzip and passes its iPad-shaped tests. `automata editor`'s server is careful. The site's browser gates
   and its playground are solid.

## 1. What this slice covers

The Owner, 2026-11-06: "we do the editor refactors that 2D touch and website refactor as if it's ready to ship with 2D
alone, then we do the same for 3D".

"Ready to ship with 2D alone" is read here as: someone who has never seen this repository finds the site, makes a 2D
game, edits its level in the editor, plays it and publishes it, and nothing from 3D gets in the way.

| Area | In this audit | Left for the 3D slice |
|---|---|---|
| Shared editor code | `packages/editor-kit` (all of it; it has no 3D code) | |
| 2D editor | `packages/editor-2d` | |
| Editor suite | `packages/editor-suite`: the shell, Levels 2D, the Tuner, the Node adapters, the sample mode | the Studio (`editors/studio`), Levels 3D |
| CLI | `automata editor` (`packages/tools/src/features/editor`) | |
| Docs | `docs/guides/editor.md`; `docs/design/editor-kit`, `editor-2d`, `editor-suite` | `docs/design/editor-3d` |
| Website | `mcthaydt/automata-website`, all of it | 3D pages and demos |
| 3D | | `editor-3d`, `render-pixi3d`, `figures`, `sector-format`, `games/base-3d`, `vendor/pixi-3d` |

## 2. The numbers

### Editors

"Tests" are `*.test.ts` files. Unit and DOM tests ran with each package's `test:unit` (Node and jsdom).

| Package | Source lines | Test lines | Unit + DOM tests | Browser tests run here |
|---|---:|---:|---|---|
| `editor-kit` | 15,775 (139 files) | 13,725 (109 files) | 1,373 pass, 47 s | none (layout and journeys need WebKit and Firefox) |
| `editor-2d` | 22,295 (189 files) | 23,676 (150 files) | 1,552 pass, 48 s | layout + canvas in Chromium: 252 pass, 6 skipped, 57 s |
| `editor-suite` | 9,222 (75 files) | 7,391 (60 files) | 423 pass, 25 s | none |
| **2D slice** | **47,292** | **44,792** | **3,348** | |
| For scale: refactored core and Emberwick | 45,944 | 48,624 | | |
| `editor-3d` (not audited) | 23,283 | 40,156 | | |

- **Where tests sit:** all 319 test files are in `src/` beside the code, under 15 suffixes (231 plain `.test.ts`, 35
  `.dom`, 19 `.layout`, 10 `.journey`, 10 `.canvas`, and ten one-offs such as `.codec-bug`, `.ship.dom`, `.refusal`).
- **Plan IDs in comments:** 943 (`editor-kit` 193, `editor-2d` 437, `editor-suite` 313).
- **Source project names** (FloorFifty, The Last Light): 120 (`editor-kit` 47, `editor-suite` 73), mostly fixtures and
  tests; the suite's sample game is FloorFifty's editor list.
- **Builds:** `editor-2d` builds in 2.0 s; its main chunk is 438.9 kB (139.0 kB gzip), and Pixi loads in its own chunks
  with the first level thumbnail. The suite's build is 2.29 MB of assets and includes `@pixi/3d` (the `stage-renderer`
  chunk).
- **Mock-ups:** `docs/design` holds 19,816 lines in 35 files (31 hand-run `.mjs` scripts) for the four editors.

### Website

| Part | Lines | Files |
|---|---:|---:|
| `src/routes` | 727 | 32 |
| `src/lib` (components, the playground, helpers) | 2,252 | 41 |
| `src/data` (page content; plus generated JSON) | 1,564 | 20 (+14 generated) |
| `src/app.css` | 622 | 1 |
| `scripts` | 2,356 | 26 (10 sync scripts and their helpers: 1,081 lines) |
| `tests` | 7,454 | 85 (70 unit, 8 playground, 5 end to end, helpers) |
| `workshop` (the double-jump demo) | 161 | 6 |

- **Committed build output:** demo bundles 7.3 MB (`physics/bodies-2d` alone 4.3 MB), playground 2.0 MB, `llms*.txt`
  0.95 MB, API data 0.6 MB.
- **Against the refactored framework (the sibling checkout at #403):** unit tests 508 of 510 pass, but 6 of 78 files fail
  (4 cannot even load); `pnpm build` exits 1 at its first step (`verify:workshop`).
- **Pages:** 17 routes, plus 21 doc sections, 17 playground examples and the API reference per package.
- **Visibility:** both repositories are private (GitHub search, 2026-11-06). The site has never been deployed.

## 3. Findings: the editors

Each finding has an ID so the plan can point at it.

### Shipping

**E1. Save does not reach the game.** Served by `automata editor` on Emberwick, the 2D editor says "Kept in your game's
checkout", and Save writes `content/rooms/room-1.af2d.json`. The game reads `content/levels/room-1.toml`, `project.toml`
and `world.toml`. The editor writes those only from its Export view: tick "Game files", press Download (Share and Copy
take one file), then copy four files into `content/` by hand. "Write to folder" stays off and says "Open a game folder
to write into it.", though the editor is already in the game folder. No test or check compares the room with its
export, so the two can drift silently. (Seen in Chromium against the built editor; commands in the appendix.)

**E2. The editors are not in any package.** `automata editor` serves `<repository>/packages/editor-<app>/dist`, found
by walking up to a `pnpm-workspace.yaml`. `-tools` publishes `dist/` and `VENDORED.md` only. Outside this repository
the command can only answer "no editor build at ... Build it first: pnpm --filter @mcthaydt/automata-editor-2d build",
which a game author cannot do. `tools/tsdown.config.ts` says as much: "the command runs from a checkout of this
repository that built an editor". From source, `node packages/tools/src/app/bin.ts editor` still crashes on the suite's
extensionless imports (`ERR_MODULE_NOT_FOUND`); only the built bin runs it.

**E3. A new game has nothing to edit, and the fallback is too wide.** `create-game` writes the role files and no
`content/` folder, editor list or level. Without `content/editors.toml`, `editor-policy.ts` lets the browser read and
write every `.json` file in the checkout outside the tool folders, `package.json` and `tsconfig.json` included.

**E4. `automata editor` opens the 3D editor by default.** `parseEditorArgs` sets `app` to `3d`, and the guide's first
step builds `editor-3d`. In a 2D-only launch the default is an editor that cannot open a 2D game.

**E5. The suite never opens the game it is served on.** `editor-suite/src/main.ts` always mounts
`samplePorts(FLOORFIFTY_SAMPLE)` ("Until `automata editor` serves a game's checkout (EDS.1d), the page opens a sample
game held in memory"). Served on Emberwick it shows "Sample game", a Tuner card for a file that is not Emberwick's, and
"Levels 2D: No files yet" (Emberwick has a room). Edits go nowhere.

**E6. The suite's Ship, Ask, checks and gates are wired to nothing.** `editor-suite/src/node` has five Node adapters
(a git change set that opens a draft PR, Claude Ask, the checks runner, the gates reader, an argv runner), each with
tests. Nothing outside the package imports them, and `serve-editor.ts` serves only static files and four file routes.
The suite's top bar still shows "No change set", "No checks run", "Gates not readable" and a primary Ship button.

**E7. The suite carries the closed Pixi 3D beta.** It depends on `@pixi/3d` (the vendored tarball), and its build holds
it. The vendor README: "Keep this tarball, the source that uses it and every build that contains it private."
`ship prepare` refuses a public game bundle that contains `@pixi/3d`, but nothing stops a suite build from being
hosted. `editor-2d` has no 3D dependency.

### Sprawl

**S1. Two shells for 2D editing, and the complete one is not the suite.** `editor-2d` has its own app: Home, the
document session and recovery, and the Level, World, Tilesets, Entities, Checks and Export views. The suite has a second
shell (Home, rail, status pills, Review, Import/Export, Ship, Ask) and embeds only `editor-2d`'s Level view. Each shell
has its own Home, boot and error text.

**S2. The suite promises nine editors and has three.** Its rail always shows Tuner, Studio, Audio, Feel, Writer,
Schematic, Sequence, Levels and Review (`SUITE_ENTRIES`), and Cmd 1 to 9 choose them. The Studio is 3D; Audio has no
code; Feel, Writer, Schematic and Sequence would come from an `editor-plus` package that does not exist here. On Home,
the card of an editor that is not built says "... isn't in this build. It comes with the Plus editors (editor-plus)."

**S3. Public entries nobody imports.** `editor-2d`'s root entry re-exports 172 lines of names (commands, codecs, the
draw list); only its own entry test imports it. The suite's `./node` entry is the same (E6). knip counts a package's
exports as used, so it cannot flag either.

**S4. Each editor package has its own paperwork.** `biome.json`, `svelte.config.js`, `LICENSE`, `tsconfig.json`, a Vite
config and a Vitest config with five or six projects each. The editors pin TypeScript 6.0.3; the root pins 7.0.2.

**S5. Comments cite plans, and fixtures name the source projects.** 943 plan IDs (`ED2D.4c2a`, `EDS.1d`, "spec §14"):
core now fails `pnpm style --plan-comments` on these, but that check does not cover the editors. The 120 mentions of
FloorFifty and The Last Light are mostly fixture names (`floorfifty.editors.toml`, `last-light-bay.editors.toml`,
`FLOORFIFTY_SAMPLE`); `AGENTS.md` says published text never names the source projects.

**S6. 19,816 lines of mock-up scripts.** `docs/design` holds the scripts that drew the editors before they existed.
Nothing builds or tests them; the built editors are the record now.

**S7. Three looks for one product.** Core has Button, Dialog, Slider and Toast for game screens. The editor kit has its
own Button, Dialog, Slider and ToastRegion, IBM Plex and its own tokens. The site has a third look on Geist. Game
screens should stay themable per game, but the editors and the site are the same product's face and look unrelated.

### Contracts

**K1. The 2D level format has no owner in core.** The editor owns the project format (`.af2d.json`) and the game-facing
export (`af2d-content` TOML) in `editor-2d/src/profiles/level-project`. Emberwick declares the level again with its own
loose Zod schema (`src/shared/kinds.ts`). Every new 2D game would write that schema once more, and nothing ties it to
the editor's. That breaks the "one contract owner" rule.

**K2. The editors barely touch the framework they edit for.** From `@mcthaydt/automata` they import five names (the
geometry owner and its types) and `settleLayout` from `/testing`. The 2D editor draws with Pixi on its own and cannot
show the level as the game draws it or play it. There is no "play this level".

### Tests

**T1. Unit and DOM tests are strong.** 3,348 pass in under two minutes across the three packages, and the 2D editor's
layout and canvas suites pass in Chromium (252 pass, 6 skipped). `automata editor`'s server has 13 tests over a real
HTTP server: the loopback default, the token, the `Host` check, symlinks out of the checkout and the mtime guard.

**T2. The journeys are component tests in a real browser, not end-to-end tests.** The ten `*.journey.test.ts` files
(kit 4, 2D 5, suite 1) mount the editor in a Vitest browser page in WebKit with an iPad context (touch, 2× screen,
Safari's user agent) and drive it with real pointer events. They test the iPad gestures well. None starts
`automata editor`, loads the built page, saves into a checkout or opens the game afterwards, so E1, E2, E4 and E5 pass
every test there is.

**T3. The 2D gate runs no editor test.** `pnpm check` runs `test:unit:core`, which filters out `./packages/editor-*`.
`ci.yml` leaves the editors to `3d-and-editors.yml`, which is "not a required check ... Read it before merging". The 2D
editors share that workflow with the 3D suites, so a red 3D suite hides a red 2D editor and the other way round.

**T4. Tests sit beside the code.** All 319 test files live in `src/` with 15 suffixes. Since the core refactor the rule
is `tests/{unit,browser,e2e}` beside `src/`, one `.test.ts` suffix and `#src/` imports; `pnpm style --test-imports`
does not cover the editors yet.

**T5. Nothing checks that a room and its export agree** (E1).

### Copy and UX (the drunk grandma test)

**G1. Save does not save the game** (E1). The one thing a person expects from an editor opened on their game.

**G2. The suite's top bar speaks in internals.** "No change set", "No checks run", "Gates not readable", "Ship",
"Review". A drunk grandma does not know what a change set or a gate is, and none of these do anything yet (E6).

**G3. Words in the 2D editor.** The Entities layer is subtitled "Things", the Collision layer "Grid values"; the Level
inspector says "This project gives levels no fields."; the eyedropper is "Pick"; the new-project cards say
"Platformer / side view", "Top-down RPG / maps · NPCs" and "Blank / own layers". Mostly fine, a few labels to retire.

**G4. Package names on screen.** "It comes with the Plus editors (editor-plus)", "the editor-3d package" (S2).

**G5. The tool bar runs off the edge at iPad landscape.** At 1194 × 834 in Chromium the Level view's tool bar shows
"Brush size − 1"; "+" and "Fit" are past the right edge of a sideways scroll region. To check on the iPad.

## 4. Findings: the website

### Shipping

**W1. Start sends visitors to a private repository and an old package name.** "Keep building on your machine" says
`git clone https://github.com/mcthaydt/automata-framework.git` and `pnpm --filter @af-examples/base-2d dev`. The
repository is private, and after the refactor the package is `@af-games/emberwick`. The checks block uses the old name
too. There is no `create-game` path.

**W2. The home page explains deleted code.** "One state. Many views." walks through `src/content/room.ts` ("# is solid,
. is empty, P is the player start"), `room.test.ts`, `sim/player-move.system.ts`, `render/renderer.ts`, `play-room.ts`
and `boot.ts` ("Effect handles the host handshake"). All six are gone or moved, Effect is out of the browser, and the
room is an editor file now. Start's "Change the room" links point at the same deleted files.

**W3. The site breaks on the refactored framework.** Its tests and its workshop import framework source by relative path
from a sibling checkout (`../../automata-framework/packages/sim/src/index`, Emberwick's `base-sim`, `content/room`,
`input/devices`). Against #403:

| Test file | Why it fails |
|---|---|
| `double-jump`, `first-change`, `workshop-controls` | cannot load: the Emberwick files they import are gone |
| `api-contract` | reads `packages/runtime/package.json` (merged into `packages/automata`) |
| `example-sources` | expects `games/emberwick/src/render/renderer.ts` |
| `license-claim` | marked "expected red until DX.11"; the packages now declare MIT, so it passes and the marker fails it |

`pnpm build` runs `verify:workshop` (the first two files) first, so the site cannot build once its pin moves.

**W4. Every synced copy is a snapshot of 2026-10-31.** From framework commit `f8023a90`: the API reference "0.0.3"
describes the twelve old packages; the playground's 17 examples (the same 17 the framework has) run a runtime compiled
from those old packages; the docs include "Effect
Runtime & Concurrency"; the "What's inside" page says "Plus is the paid Automata Plus tier" (Plus has been free since
2026-10-30), lists Effect as core and names FloorFifty and The Last Light; the Proof page shows Emberwick's golden as
`31f50888ccb4cf0a`, recorded 2026-10-18, beside Plus physics and 3D scenarios (the refactor's golden is
`421c5a1bf522299e`).

**W5. The site has never been deployed.** `deploy.yml` is a dry run against a placeholder target. The host, the deploy
credential and DNS for `automata.ruken.com` are the Owner's to supply and do not exist yet. The address is a Ruken
subdomain, though AF treats Ruken as one target among four (ADR 0006).

**W6. Links that a visitor cannot open.** The showcase's "Submit your game" and the community page open issues on the
private repository; the AI page links `packages/cli/src/check/csp-probe-live.ts` (the CLI is in `-tools` now); the
editors page links `docs/superpowers/specs/2026-10-30-editor-suite-design.md` (now under `docs/archive/`); the
cheatsheet, the source explorer, the Proof page and the docs link source on `blob/`. Every GitHub link 404s for anyone
without access.

**W7. The framework's guides never arrive.** `scripts/sync-guides.ts` reads `docs/guide`; the framework's folder is
`docs/guides`. A missing folder returns an empty list without an error, so the publish guides (web, itch, Ruken,
desktop) and the editor guide are not on the site, and `llms-guides.txt` still says the desktop build "is planned".

**W8. The editors page says there is nothing to open.** "None of these is released yet and there is no editor to open
on this site." It lists nine editors, five of them 3D or Plus, all "(in development)". For a 2D launch this is the page
that should say "open the 2D editor".

**W9. The contact address is personal.** Terms, Privacy and `security.txt` give the Owner's own mailbox for questions
and security reports.

### Sprawl

**WS1. Copies instead of imports.** Ten sync scripts (1,081 lines), a framework pin (`framework.ref`), a read-only deploy
key for CI and a sibling-checkout convention exist to copy demos, docs, the API index, the playground runtime, the stack
page, evidence and changelogs out of the framework. Each copy can go stale (W3, W4, W7), and a framework pull request
cannot see what it breaks on the site.

**WS2. Launch machinery before launch.** `restorations.ts` (claims waiting for proof rows DX.10b to DX.10e), an
evidence schema and the Proof page, release manifests, a rollback rehearsal, uptime and deployed-site checks, a
Lighthouse baseline and budget test, and tests that pin history ("expected red until DX.11").

**WS3. Committed build output.** 7.3 MB of demo bundles are in git; `static/demos/physics/bodies-2d` (4.3 MB) is linked
from nowhere since the framework removed that example.

**WS4. Seventeen pages for one game and a playground.** Home, Start, Examples, Showcase (one game; "No community
submissions"), Docs (21 sections, five of them "coming from Unity, Godot, Unreal, GameMaker, the web"), API,
Cheatsheet, AI, Editors, Inside, Proof, Releases ("Nothing has been published"), Community ("There is no chat server
yet"), Terms and Privacy.

**WS5. Layers, not features.** `src/data` (34 files) holds every page's content, components and routes sit elsewhere;
only the playground is a feature folder. Tests are already in their own folder (70 files flat at its top level).

**WS6. Tooling drift from the framework.** Vite 6, SvelteKit 2.16 and the Svelte plugin 5 (the framework: Vite 8,
plugin 7), Zod 4.6.5 against 4.6.6, caret ranges where the framework pins exact versions, and no linter or formatter.

### Tests

**WT1. Unit tests mostly pin claims to data.** 510 tests in 78 files: most check that a page's words match a data file
(restorations, the licence claim, evidence, generated docs); the playground's eight files test behaviour.

**WT2. The end-to-end tests are good gates, not journeys.** Five files: every sitemap page at four sizes for horizontal
scroll, console errors, third-party requests, cookies, storage, axe, focus rings and dead buttons; 702 lines on the
playground; one click on the double-jump demo. Nothing follows a visitor (land, play Emberwick, Start, set up, open the
editor), and nothing checks that links into the framework resolve.

### Copy and UX (the drunk grandma test)

**WG1. Two audiences on one path.** The hero says "You bring the idea; your coding agent helps with code and tests." Two
clicks later the docs open on "ECS Simulation & Determinism", "Zero-Eval CSP & Host Security" and "Effect Runtime &
Concurrency", and the Proof page shows hashes.

**WG2. The editor is missing from the story.** Home, Start and AI never mention drawing a level by hand; Start says "No
hosted editor is required."

**WG3. Old names on screen.** "Emberwick: Base 2D Adventure", `?demo=base-2d`, `/demos/base-2d/`.

**WG4. Some copy already passes and is worth keeping as the voice:** Start's "Click the game, hold Space to jump,
release, then press again before landing." and the Privacy page.

## 5. Ready to ship with 2D alone: where each step stands

| Step | Today | Findings |
|---|---|---|
| A visitor finds the site at a real address | No: never deployed; host and DNS are the Owner's | W5 |
| They install AF without cloning it | No: packages publish to GitHub Packages, which needs a token even for public packages; nothing is on npmjs.org | D2 |
| `create-game` makes a 2D game with a level and an editor list | No | E3 |
| `automata editor` opens the 2D editor on that game | No: no editor in the package; 3D by default | E2, E4 |
| Save in the editor changes the game | No: manual Export | E1, K1 |
| They play and publish it | Yes, from the core slice: the create-game journey and `automata ship` | |
| The docs describe the current code | No | W2, W4, W7 |
| Nothing closed-beta reaches a public artifact | `editor-2d` yes; the suite no; the repository holds `vendor/pixi-3d` | E7, D2 |
| Tests prove each step on every pull request | No | T2, T3, WT2 |

## 6. Seams 3D will need

1. **The suite takes its editors as a list.** `createSuite({ editors })` already does, but `main.ts` imports
   `editor-3d` and the Studio statically. The 3D editors should register from `editor-3d` (as an extension does), so a
   2D build contains no `@pixi/3d` and the rail lists only the editors that are there.
2. **One owner per level contract.** The 2D game-facing level schema moves to core (K1, D5). 3D sectors follow the same
   rule: the game-facing schema in a published package, the editor's own format in the editor.
3. **`automata editor --app`.** `2d` now. `3d` and `suite` ship in `-tools` only when their builds hold no closed beta,
   or after Pixi 3D is public.
4. **Gates by dimension.** The 2D gate takes the kit and the 2D editor; the 3D editors join a 3D gate. Keep the kit free
   of 3D, as it is today.
5. **One licence check for every public artifact.** `ship prepare` refuses `@pixi/3d` in a game bundle; the editor
   build inside `-tools` and the site build need the same check.
6. **The site groups by dimension.** Examples and editors by 2D and 3D, demo slots generated from the games list, API
   pages generated per published package so `render-pixi3d` appears when it publishes.
7. **The suite's Node adapters serve both dimensions.** Git, checks and Ask are wired once, for every editor (E6).

## 7. For the plan stage

### Decisions for the Owner (each with a recommended default)

The plan stage can start on the recommendations; a different choice changes the parts named.

- **D1. Where the website lives.**
  - **A (recommended):** move it into this repository as `site/`, a workspace package that reads the framework's code,
    examples and docs directly and builds its demos at deploy time. The site breaks in the same pull request as the code
    it describes, its tests join the gate, and the sync scripts, the pin, the deploy key and the committed bundles go.
  - B: keep it separate, consuming published packages and a data bundle that `release-checks.yml` builds.
  - C: keep it as it is (pin and sync).
  - Under A the site's source is private until this repository is public (D2); the built site is public either way.
- **D2. How 2D ships while the Pixi 3D beta stays private.**
  - **A (recommended):** ship the packages on npmjs.org and the site; the repository stays private until Pixi 3D is
    public and is opened then, with 3D. No history rewrite. A game author never needs the framework's source, so Start
    moves to `create-game` and the site shows code inline instead of linking GitHub.
  - B: move 3D to a private repository now and open this one with 2D (history still holds the beta).
  - C: wait and launch 2D and 3D together.
  - A needs the Owner's `NPM_TOKEN` and release approval.
- **D3. Which editor ships with 2D.**
  - **A (recommended):** `editor-2d`'s own app. It is the one that works on a real game, it has every 2D view, and it
    has no 3D. The suite (and the Tuner inside it) waits for the 3D slice, when there are two level editors to hold.
  - B: finish the suite now: wire it to the checkout, bring the 2D views into it, hide what is not built, take 3D out
    of its default build, and ship it with Levels 2D and the Tuner.
  - C: ship both.
- **D4. How the editor reaches a game author.**
  - **A (recommended):** the built 2D editor ships inside `-tools`, so `automata editor` works in any game, and the site
    hosts the same build as "Try the editor" (browser storage, Import and Export).
  - B: a separate published `@mcthaydt/automata-editor` package.
  - C: hosted only.
- **D5. How a level reaches the game.**
  - **A (recommended):** on a checkout, Save writes the project file and its game files together; the game-facing
    level schema moves into `-content`, so games import it instead of writing their own; `automata check` fails when a
    project and its game files disagree.
  - B: the content compiler reads `.af2d.json` itself and the TOML export goes away (the compiler then depends on the
    editor's format).
  - C: keep the manual Export and add the check.
- **D6. The editors' package shape.**
  - **A (recommended):** one private `editor` package for the kit, the 2D editor and the suite shell, grouped by
    feature like core (`app/`, `features/`, `shared/`, `tests/`); `editor-3d` stays its own package and plugs into the
    suite. Three packages' paperwork becomes one, and the suite stops depending on 3D.
  - B: keep the four packages and move to feature folders inside each.
- **D7. The launch site's pages.**
  - **A (recommended):** a lean site: Home, Start (create a game, play it, edit its level, publish), Examples (the
    playground), Editor (try it), Docs (rewritten for the four packages, the jargon pages folded into one "How it
    works"), API (generated), Terms and Privacy. Showcase, Community, AI, Inside, Proof, Releases and Cheatsheet fold
    into those or wait until they have something to show.
  - B: keep all 17 pages and update each.
- **D8. The Owner's own inputs.** These block the launch, not the refactor: the domain (recommended: an AF domain rather
  than `automata.ruken.com`, per ADR 0006), the host and its deploy credential, a project contact address instead of the
  personal one (W9), and `NPM_TOKEN` (D2).

### Work the plan should cover, in order

1. **Make the 2D gate see the 2D editors.** `editor-kit` and `editor-2d` unit, DOM and layout tests in `pnpm check` and
   `ci.yml`, their journeys in WebKit in the 2D gate; `3d-and-editors.yml` keeps `editor-3d` and, while it holds 3D, the
   suite (T3).
2. **Close the save loop** (D5): Save writes the game files, the schema moves to `-content`, Emberwick imports it, a
   check catches drift. Narrow the no-list fallback to level files (E3).
3. **Ship the editor** (D4): the editor build inside `-tools`, `--app` defaulting to `2d`, `automata editor` runnable from
   source; `create-game` writes `content/editors.toml` and a starter room (E2 to E4).
4. **Take 3D out of the suite's default build** (seam 1, E7) and stop the sample mode when a checkout is served (E5), even
   though the suite does not ship in this slice.
5. **Restructure by feature and move tests to `tests/`** (D6, T4): plan IDs out of comments, fixtures renamed away from
   the source projects, `editor-2d`'s unused root entry trimmed, `docs/design` archived (S3, S5, S6). Extend
   `pnpm style` (`--plan-comments`, `--test-imports`) to the editors.
6. **Real journeys** (T2): Playwright against `automata editor` on a temporary copy of Emberwick: open the room, paint,
   save, see the file change on disk, `automata check` passes, the game shows the change. Chromium and WebKit, every pull
   request.
7. **The website** (D1, D7, W1 to W8): move it in, build its data from the refactored framework at build time, Start on
   `create-game`, the home page on current files, the editor page with "Try the editor", docs rewritten, broken links
   fixed, the orphaned demo deleted; its end-to-end tests add the visitor's journey and a link check (WT2).
8. **A copy pass on both** (G1 to G5, WG1 to WG3): plain words, no package names or internals on screen.
9. **The Owner's inputs** (D8), then deploy.

## Appendix: how the numbers were measured

Framework at `f2d2174b` (#403), website at `4a514eb3`, Node 24.22.1 (`/opt/node24/bin`), pnpm 10.34.6, Playwright's
preinstalled Chromium.

- **Lines:** `find <package>/src -type f \( -name '*.ts' -o -name '*.svelte' -o -name '*.css' \) ! -name '*.test.ts' |
  xargs cat | wc -l` for source, and the same over `*.test.ts` for tests. Core and Emberwick: the same over `src/` and
  `tests/`.
- **Unit and DOM tests:** `pnpm test:unit` in `packages/editor-kit`, `packages/editor-2d` and `packages/editor-suite`.
- **Browser tests:** a throwaway Vitest config (deleted after the run) that kept `editor-2d`'s `layout` and `canvas`
  projects with Chromium as the only instance.
- **The served editors:** `pnpm --filter @mcthaydt/automata-editor-2d build`, `pnpm exec turbo run build --filter
  @mcthaydt/automata-tools`, then `node packages/tools/dist/bin.js editor games/emberwick --app 2d` (and `--app suite`)
  and a Playwright script that opened the page at 1194 × 834 and 390 × 844, opened the room, visited Export and read the
  text and the screenshots.
- **Website tests and build:** `pnpm install --frozen-lockfile`, `pnpm test` and `pnpm build` in a clone beside this
  checkout (the layout the site's scripts expect), with this checkout at #403.
- **Plan IDs:** `grep -rEo` for `ED2D`, `EDK`, `EDS`, `EDFF`, `ED`, `M<n>`, `DX`, `QB`, `PUB`, `APP` and `GL` followed by
  `.` or `-` and an ID, "spec §", "plan <ID>" and "Owner, 2026", over each package's `src/`.
- **Visibility:** `gh api -X GET search/repositories -f q='user:mcthaydt automata'`.
- **Not run:** WebKit and Firefox (not installable here), the editors' journeys (WebKit only), the suite's browser
  tests, hosted CI, the site's end-to-end tests and Lighthouse.
