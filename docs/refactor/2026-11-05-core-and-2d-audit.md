# Core and 2D audit

- **Stage:** 1 of 6 of the core-and-2D refactor (audit). The next stage writes the plan and spec from this.
- **Date:** 2026-11-05, on `main` at `da765837` (the last merge, 2026-11-01).
- **What it covers:** everything "up to and including 2D": the core packages, the 2D game, the 2D examples, the
  tooling and CI that serve them, the branches, and the editor setup.
- **What it does not do:** change code, delete branches or design the new structure. It lists the facts and the
  choices the plan stage builds on (decided by the Owner on 2026-11-05, section 7).

Every number below was measured on this checkout or read from GitHub on 2026-11-05. The commands are in the
appendix, so anyone can check them.

## The short version

1. **The core is not badly written. It is too big for what it does.** About 44,000 lines of core code (plus 47,000
   lines of tests) run one game: a single room where Wick walks and jumps to an ember. The core publishes about
   1,040 public names; the two 2D games import 42 of them directly.
2. **Unit tests are strong. End-to-end tests are weak and do not protect anything.** Core unit coverage is 89 to
   100 percent of lines in every package but one, and all 3,367 unit tests pass. But no end-to-end test runs on a
   pull request. The nightly end-to-end job passed on 2 of the last 14 nights, and has been cut off at its
   30-minute limit for the last 5. Emberwick's own end-to-end tests do pass (18 of 18) when they run on their own.
3. **Features are cut into layers, not kept together.** "Saves" lives in four packages, "input" in six. Changing
   one feature means touching many packages, and each package carries its own publishing paperwork.
4. **The 2D game still carries its scaffolding.** Emberwick has about 590 lines of early stand-ins (its own loop,
   input, renderer and boot) that the real game no longer uses, plus about 800 lines of tests around them.
5. **The process weighs more than the product.** 88,000 lines of Markdown, a 502 KB task list, 3,086 commits and
   384 pull requests in 30 days, a 30-step local CI chain, and 354 branches on GitHub.
6. **The editors and 3D code make the core's checks red.** Every core pull request runs the editors' iPad tests,
   and the nightly failures on 2026-11-04 all came from `editor-3d` or the frame-budget job, not from core or 2D.
7. **The good parts are worth keeping as they are:** the deterministic sim, the content compiler, the one-call
   `defineGame`, the strict TypeScript and lint setup, and Emberwick's movement code.

## 1. What "core up to 2D" means here

The Owner's order is 2D, then 3D, then the editors, then the website, starting with "core up to 2D". Read from
the repository, that is:

| Area | In this audit | Left for a later phase |
|---|---|---|
| Core packages | `sim`, `content`, `host`, `ui`, `runtime`, `render-pixi`, `game`, `automata` (the one-import umbrella), `testing`, `node`, `ship`, `cli` | |
| 2D games | `games/emberwick` (package `@af-examples/base-2d`), `games/placeholder` | |
| Examples | the 2D one-file examples (`examples/core`, `shapes`, `textures`, `render`, `audio`, `ui`, `content`) and their end-to-end tests | `examples/render3d`, `examples/figures` (3D) |
| Tooling | all 13 packages in `tooling/` (they gate every change, core included) | |
| Repository | CI workflows, root config, `AGENTS.md`, the numbered docs, branches, editor settings | |
| 3D | | `render-pixi3d`, `figures`, `sector-format`, `games/base-3d`, `vendor/pixi-3d` |
| Editors | | `editor-kit`, `editor-2d`, `editor-3d`, `editor-suite`, `docs/design` |
| Website | | the separate `automata-website` repository |

**One catch for the plan:** the later phases depend on core. The editors import `ui`, `ui/testing` and `testing`;
the 3D code imports `sim`, `runtime`, `content`, `render-pixi`, `ui`, `game` and `testing`. Moving core code breaks their
imports (16 core entry points in all) unless the refactor updates them too, or core keeps the old entry points for
a while (section 7, D3).

## 2. The numbers

### Whole repository (lines, tests included)

| Area | Code lines | Share |
|---|---:|---:|
| Editors | 156,195 | 46% |
| Core packages | 91,524 (44,257 source, 47,267 tests) | 27% |
| 3D | 39,787 | 12% |
| Design mock-ups in `docs/design` | 19,554 | 6% |
| Tooling | 18,981 | 6% |
| 2D games and examples | 9,846 | 3% |
| **Total** | **336,373** | |
| Markdown | 88,042 lines in 427 files | |

On 2026-11-01 the Owner put it this way (quoted in `docs/03-continuation-prompt.md`): "130k lines of code with
barely anything to show for it is insane". It has grown since.

### Core packages

Coverage is lines / branches from Vitest's V8 coverage over each package's own unit run (`src/**`, tests and
`testing/` helpers left out). "Exports" counts the entries in each package's API report.

| Package | Source lines | Test lines | Unit tests | Line / branch coverage | Public exports |
|---|---:|---:|---:|---|---:|
| `sim` | 3,603 | 3,010 | 267 | 97.7% / 90.0% | 90 |
| `content` | 5,437 | 4,603 | 340 | 95.7% / 85.9% | 107 |
| `host` | 2,258 | 2,518 | 192 | 97.7% / 82.2% | 67 |
| `ui` | 8,905 | 7,778 | 648 | 95.4% / 87.3% | 204 |
| `runtime` | 8,550 | 12,627 | 571 | 97.6% / 87.7% | 204 |
| `render-pixi` | 1,783 | 2,414 | 121 | 97.0% / 85.0% | 55 |
| `game` | 3,403 | 3,895 | 229 | 97.1% / 90.9% | 45 |
| `automata` | 50 | 69 | 22 | 100% / 100% | 61 |
| `testing` | 2,877 | 1,806 | 168 | 75.4% / 67.2% | 76 |
| `node` | 215 | 160 | 12 | 97.6% / 64.7% | 11 |
| `ship` | 3,934 | 5,122 | 448 | 92.2% / 85.1% | 102 |
| `cli` | 3,242 | 3,265 | 188 | 89.4% / 84.6% | 20 |
| **Core total** | **44,257** | **47,267** | **3,206** | | **1,042** |
| `games/emberwick` | 3,335 | 1,987 | 147 | 50.1% / 62.1% | |
| `games/placeholder` | 461 | 225 | 14 | 50.0% / 50.0% | |

Emberwick's low number is honest but misleading: its drawing is tested in real browsers, which this unit run
leaves out, and about 40 percent of its unit test lines cover stand-ins the game no longer uses (finding O1).

## 3. Findings

Each finding has an ID so the plan can point at it.

### Sprawl

**S1. Twelve core packages, each with its own paperwork.** Every published package has its own `package.json`,
`tsconfig.json`, `tsdown.config.ts`, `vitest.config.ts`, `CHANGELOG.md`, `LICENSE`, API report and changeset rules.
`ui` and `game` add a `biome.json`, `svelte.config.js` and a second tsconfig; `runtime` adds a second tsdown
config. A new feature that crosses packages needs a changeset per package and an API report update per package.

**S2. Features are spread across layers.** Searching file names for a feature shows where it lives:

| Feature | Packages it is spread across |
|---|---|
| Saves | `host` (1 file), `runtime` (5), `ui` (6), `game` (5) |
| Input | `host` (1), `runtime` (the 16-file `src/input` folder), `game` (3), `ui` (1), `ship` (2), `testing` (2) |
| Settings | `runtime` (8), `ui` (5), `game` (7) |
| Audio | `host` (1), `runtime` (10), `ui` (2), `game` (1) |
| Locale | `content` (2), `runtime` (4), `ui` (1) |
| Leaderboards | `host` (1), `runtime` (2), `ui` (2) |

This is the opposite of the feature-folder layout the Owner asked for (section 4).

**S3. The layers point the wrong way.** `runtime` (the game loop, boot and managers) imports the Svelte UI kit
`ui` in 11 files. `render-pixi` (the 2D renderer) imports `runtime` or `ui` in 8 of its 18 source files. So the
renderer depends on the widget library, and the engine depends on its own menus. Any change to `ui` rebuilds and
retests the engine and the renderer.

**S4. The public surface is about 25 times what the games touch.** Core publishes 1,042 names. Emberwick and the
placeholder import 42 of them by name (21 from `sim`). `defineGame` uses more behind the scenes (saves, settings,
audio, locale), so the real use is larger, but nobody has measured it. `runtime` and `ui` publish 204 names each.

**S5. Three ways in, and the reference game mixes two of them.** A game can import the umbrella
`@mcthaydt/automata`, the `@mcthaydt/automata-game` package, or the twelve packages one by one. The one-file
examples use the umbrella; Emberwick uses `game` plus six individual packages.

**S6. One game, four names.** The folder is `games/emberwick`, the package is `@af-examples/base-2d`, the game id
is `base-2d` and the title is Emberwick. The Playwright projects are `base-2d` and `base-2d-compact`.

**S7. The placeholder game outlived its job.** `games/placeholder` says it "comes before the bases; base-2d
replaces it as the M1 exit example". Emberwick did replace it, but the placeholder still has its own CI job, its
own end-to-end servers, a place in `ci:local`, and the Effect bundle budget (S8 spike) hangs off it.

**S8. The docs record history, not the current state.**

- `docs/02-master-delivery-plan.md` is 502 KB in 845 lines (671 table rows).
- `docs/03-continuation-prompt.md` is a 47 KB log of session notes, newest on top, rather than a status page.
- `AGENTS.md` opens with a single 5,300-character paragraph of direction changes, several of which undo earlier
  ones ("Ruken first" and then "not so tightly coupled to Ruken"; Plus paid and then free).
- `examples/README.md` still describes demos "until EX.4 deletes them" and statuses from October.
- `docs/superpowers/` holds 40 specs and 231 plans (46,334 lines).
- `docs/evidence/` holds 497 PNG files (23 MB) in git.

**S9. The code comments point at plans.** Core and 2D code has 1,385 references to plan IDs, spec sections and
dated Owner decisions ("DX spec §3.1", "M5.2", "Owner, 2026-10-30"). A comment should explain the code to the
next reader; a plan ID only helps someone who also has the plan open.

### Overengineering

**O1. Emberwick ships a second, unused runtime.** These files are not on the game's path (`main.ts` →
`src/game.ts` → `startGame`). They were stand-ins from before the core packages existed, and nobody removed them
when the real ones landed:

| File | Lines | What it duplicates |
|---|---:|---|
| `src/play-room.ts` | 214 | the runtime's app loop and restart |
| `src/loop.ts` | 62 | `runtime`'s frame loop |
| `src/input/devices.ts`, `src/input/keys.ts` | 128 | `runtime`'s input manager and `game`'s `keys()` |
| `src/render/renderer.ts` | 78 | `render-pixi`'s renderer setup |
| `src/boot-page.ts`, `src/boot-failure.ts`, `src/ruken/boot.ts` | 110 | `runtime`'s boot and failure panel |

That is 592 source lines and about 800 test lines. The only outside user is one demo,
`examples/content/hot-reload`, through `@af-examples/base-2d/play`. `src/ruken/boot.ts` also imports `@ruken/sdk`
directly, which ADR 0006 allows only inside a target's adapter.

**O2. Effect runs through most of the browser runtime.** 102 non-test files in core and Emberwick import `effect`
(runtime 34, ship 16, host 13, content 12, game 9, cli 9). The S8 spike measured the cost: at least 28 kB gzip
for any use, 86 kB gzip of Effect modules in a runtime demo, and 50 to 73 ms more cold boot on a throttled phone.
It also asks every contributor to learn Effect's services, layers, scopes, fibers and streams on top of the game
itself. The sim already stays out of it (ADR 0003). Whether the browser runtime needs it is a decision for the
plan (section 7, D2).

**O3. Emberwick's bundle is large for one room.** Its production build is 923 KB (283 KB gzip) in the main chunk
and about 358 KB gzip in all, for one screen of tiles and one character. Pixi, Effect, Svelte and Zod all ship in
it; nobody has split the number by library yet, and the plan should before choosing what to cut.

**O4. Many ways to be a test.** Core, 2D, the examples and the tooling use 17 test file suffixes (`.test.ts`,
`.parity.test.ts`, `.layout.test.ts`, `.svelte.test.ts`, `.browser.test.ts`, `.dom.test.ts`, `.slow.test.ts`,
`.bench.test.ts`, `.golden.test.ts`, `.contract.test.ts` and more) across 17 Vitest configs with 10 different
project names (`unit`, `node`, `dom`, `browsers`, `layout`, `bench`, `bench-chromium`, `sim`, `sim-browsers`,
`renderer`). Where a test runs depends on its suffix and on which package it sits in.

**O5. Governance tooling runs on every pull request.** The checks job runs install, lint, typecheck, boundaries,
style, knip, unit tests, the editors' iPad journeys, a dependency audit, a secret scan, a new-dependency report,
two example builds, a bundle budget, two changeset checks, API reports, a build, a dist test, the API index, the
agent skills, and a Claude Code plugin validation that downloads Claude Code. `ci:local` chains 30 commands.
Several of these protect publishing and could run only when a release is cut.

**O6. Features ahead of their games.** Core already carries leaderboards, haptics, a networking port, rebinding
with input profiles, gamepad glyph families, swipe gestures, analog input, four distribution targets (`web`,
`itch`, `ruken`, `tauri`) and six-language font subsetting. Some of this is needed for 1.0; much of it has no game
using it yet. The rule in `AGENTS.md` ("Core is what every distribution target needs or what both reference games
need") is not being applied.

### Tests

**T1. Unit tests are not the problem.** 3,367 unit tests pass, and core line coverage is 89 to 100 percent in every
package except `testing` (75 percent). The weak spot is not how much is tested but what kind of test does the
checking.

**T2. Nothing end to end protects a pull request.** `ci.yml` runs browser journeys "only nightly and on request".
The only browser tests a pull request runs are the cross-engine parity suites (which check determinism and layout,
not a player's journey) and the editors' iPad journeys.

**T3. The nightly end-to-end job is broken.** From 2026-10-22 to 2026-11-04 the "browser journeys" job passed on
2 nights (10-24 and 10-29). The last five nights it was cancelled at its 30-minute limit. One
`playwright.config.ts` covers every game, example, editor playground and the 3D game, and starts 13 web servers
before the first test.

**T4. The 2D game's own end-to-end tests work.** Run on their own (Emberwick's two servers only), its 9 journeys at
two phone sizes passed 18 of 18 in 2.1 minutes in Chromium: boot under Ruken's headers, menu to room to pause and
back, walking and jumping, the full golden route to the ember, the touch buttons, button sizes, and the Ruken
handshake. The golden-route journey takes 1.2 to 1.5 minutes because the headless browser draws WebGL in software.

**T5. The 2D game is never tested in Safari.** Emberwick's journeys run in Chromium only, with phone emulation. The
Owner's first acceptance journey (J1, 2026-11-01) is "play Emberwick on the iPad".

**T6. Green unit tests did not mean working features.** The Owner's iPad test on 2026-11-01 showed, in the words of
`docs/03-continuation-prompt.md`, that "merged, ticked rows are not working features". Many unit tests run
against fakes (`FakeHosting`, a fake audio context, injected seams), which prove each part alone but not the
whole game.

**T7. Tests sit next to the code.** 405 test files in core and the 2D games sit beside their source, and they
reach it through 875 relative imports. Shared test helpers live in `src/testing/` folders, and several are
published (`runtime/testing`, `ui/testing`, `host/testing`) because the editors and 3D code use them.

### CI and scalability

**C1. Other phases' tests block core.** `pnpm test:journeys` runs only the editors' iPad journeys, and it is in
the checks job that every pull request needs. On 2026-11-04 the nightly checks failed on two `editor-3d` WebKit
timeouts, parity failed on an `editor-3d` Firefox layout test, and the frame budget failed; nothing in core or 2D
failed.

**C2. The frame-budget job fails on the machine it runs on.** Its budget was measured on the Owner's Mac GPU, but
the job runs on `AF_GPU_RUNNER || AF_LINUX_RUNNER`, which is the Windows PC under WSL. That runner draws in
software, the check reports "NOT COMPARABLE", and by design it exits 1.

**C3. CI is slow and runs on borrowed machines.** Hosted runners get no minutes, so every job runs on the Owner's
PC or Macs. On the last main push (2026-11-01) checks took 9 minutes, then parity took 13, with the three game
jobs running one after another beside it. The continuation notes record runs dying when a Mac went to sleep.

**C4. Changing one feature fans out.** Because of S1 to S3, a change to, say, how saves look reaches `host`,
`runtime`, `ui` and `game`, so it needs changeset entries and API report updates for four packages, and it runs
every dependent package's unit and parity suites.

**C5. The pace outran the checks.** 3,086 commits and 384 pull requests landed between 2026-10-02 and 2026-11-01.
`delete_branch_on_merge` is off, so merged branches pile up (section 5).

### What is good, and should be kept

- **The deterministic sim** (`packages/sim`): 3,600 lines, 98 percent covered, the same hashes in Node, Chromium,
  WebKit and Firefox, snapshots and replays. It is small, clear and does what the framework promises.
- **The content compiler**: errors point at `file:line:col`, the output is hashed, and the sim gets its own part.
- **The game API at the top**: `examples/core/core-basic-window.ts` is a whole game in 13 lines.
- **Emberwick's sim code**: the Celeste-style movement in `src/sim/player-move.system.ts` is short and readable.
- **Strict guard rails**: strict TypeScript (`exactOptionalPropertyTypes`, `isolatedDeclarations`), Biome, knip,
  and the sim purity check in `check-boundaries`.
- **Emberwick's end-to-end journeys**: they test real player paths and pass. They need to run, not be rewritten.

## 4. Moving to a feature-based structure

### What the reference does

The reference is `WebDevSimplified/parity-deals-clone`, branch `feature-folder-structure`:

```
src/
  app/          entry points only (pages and routes); may import features and shared code
  features/
    products/   everything about one feature: components/, schemas/, server/actions/, server/db/
    analytics/
    subscriptions/
    users/
  components/   shared UI (no feature imports)
  lib/          shared helpers
  hooks/  data/  drizzle/   more shared code
```

Three rules hold it together, and lint enforces them (`eslint-plugin-boundaries` and `independentModules.jsonc`):

1. A feature may import shared code and its own files, never another feature.
2. Shared folders may import only other shared folders, never a feature or the app.
3. The app folder composes features; nothing imports the app.

### Where AF stands

Inside each package, AF already groups by feature (`runtime/src/audio`, `runtime/src/input`, `ui/src/settings`).
Across packages it groups by technical layer (contract, manager, widget, screen), which splits each feature four or
six ways (S2). There is also a second, different rule for games: `AGENTS.md` says a game's `src/` groups by role
(`components.ts`, `systems.ts`, ...), and Emberwick follows neither rule fully (`src/sim/player.component.ts`,
`src/render/`, `src/screens/`).

### What the move involves

The plan has to pick a shape. Three reasonable ones:

| Option | Shape | Cost | Risk |
|---|---|---|---|
| **A. One core package** | `@mcthaydt/automata` with `src/features/{sim,content,host,input,saves,settings,audio,locale,flow,screens,render,...}`, `src/shared/` and `src/entries/` (the subpath exports). Build tools (`ship`, `cli`, `node`) stay a separate dev package. | Biggest move: every core import changes. | Highest churn for 3D and editors; publishing simplifies most. |
| **B. Few packages, features inside** | Keep the hard seams that really differ: `sim` (pure, no DOM), `content` (Node compiler), one browser package (`runtime` + `render-pixi` + `ui` + `game` merged, grouped by feature), and one tools package (`ship` + `cli` + `node`). | Medium. | Medium. Keeps the sim boundary simple to check. |
| **C. Keep packages, move features** | Same twelve packages, but each feature's files move to the package that owns that feature, and the layers are fixed (S3). | Smallest move. | Leaves most of S1 and C4 in place. |

Whichever is chosen, the move needs:

- **A boundary rule, enforced in lint.** `tooling/check-boundaries` already checks the sim's imports by AST; it can
  grow the reference's three rules (features import shared and themselves only) instead of adding ESLint.
- **The sim rule kept.** Sim files must stay free of DOM, clocks, `Math.random` and Effect, wherever they move.
  Today `pnpm boundaries` lists the sim roots by path, so the list changes with the folders.
- **Entry points kept or replaced on purpose.** `api-report` and `api-index` read today's entries; the umbrella
  re-exports `game` and `sim`; 3D and the editors import 16 core entry points.
- **The game rule settled.** Decide whether games also use features (`src/features/player`, `src/features/room`) or
  keep the role files from the GL spec, and make Emberwick match.

### Tests in a dedicated folder

What has to change:

- About 400 test files move in core and the 2D games (more in the examples and tooling), and their 875 relative
  imports are rewritten (a codemod, not by hand).
- 17 Vitest configs change their `include` globs; the suffix-based routing (O4) should shrink to three kinds at the
  same time: `unit` (Node or jsdom), `browser` (parity and layout in real browsers) and `e2e` (Playwright).
- `tsconfig.json` files include `src/**` only, so tests need their own tsconfig or include line to stay
  typechecked.
- `check-style` exempts tests by suffix and by `testing/` folder; `knip` and `biome.json` list fixture folders.
- Published test helpers (`*/testing` entries) are product code, not tests: they stay in source, as their own
  feature (`features/testing`).
- One root Playwright config becomes one per area, so a 2D run starts only 2D servers (T3).

A layout that fits all three options: `tests/unit/<feature>/`, `tests/browser/<feature>/`, and
`tests/e2e/<game>/`, with fixtures in `tests/fixtures/`.

## 5. Branches

GitHub has **354 branches**. Each was compared with `main` through the GitHub API:

| Group | Count | What to do |
|---|---:|---|
| `main` | 1 | Keep. |
| Fully merged into `main` (no commit that `main` lacks) | 334 | Delete. Nothing is lost: every commit is on `main`. Includes `archive/base-3d-adventure` (an ancestor of `main`; tag it first if the name matters) and `changeset-release/main` (the release bot recreates it). |
| Open draft pull requests | 6 | See below. |
| Unmerged, no open pull request | 13 | See below. |

**Open draft pull requests** (all last touched on 2026-11-01, all with CI runs):

| PR | Branch | Area | Suggestion |
|---|---|---|---|
| #383 | `claude/content-browser-entry` | Core (`content`) and 3D | Core fix: fold into the 2D refactor or merge first. |
| #379 | `claude/fix-touch-selection` | Core (`ui`), editors, placeholder | Small game-facing fix: fold into the 2D refactor or merge first. |
| #377 | `claude/3d-art-pass` | 3D | Park for the 3D phase. |
| #381 | `claude/j3-served-suite` | Editors | Park for the editors phase. |
| #382 | `claude/j4-checks-list` | Editors | Park for the editors phase. |
| #378 | `claude/eds-10-11` | Editors | Close: the 2026-11-01 reset superseded it. |

**Unmerged branches with no open pull request** (each looks superseded or abandoned; worth a glance before
deleting, because their commits are not on `main`):

| Branch | Commits not on `main` | Last commit | Why it looks safe to drop |
|---|---:|---|---|
| `claude/project-thread-z6q9rx` | 15 | 2026-10-12 | No PR; 2,757 commits behind. |
| `claude/clever-pasteur-ujmu6e-ci-timeouts` | 1 | 2026-10-16 | PR #53 closed unmerged. |
| `claude/clever-pasteur-ujmu6e-pub3` | 7 | 2026-10-16 | No PR, untouched for three weeks; PUB.4 merged after it (#50). |
| `claude/clever-pasteur-ujmu6e-pub3-wip` | 8 | 2026-10-16 | No PR; work in progress of the above. |
| `claude/clever-pasteur-ujmu6e-handoff` | 3 | 2026-10-18 | No PR; session handoff notes. |
| `handoff-local` | 3 | 2026-10-18 | Same tip commit as the line above (`bce35dee`). |
| `claude/3d-m3-6b-poses` | 9 | 2026-10-30 | Replaced by `-v2`, merged as #220. |
| `claude/3d-m3-6c-clips` | 15 | 2026-10-30 | Replaced by `-v2`, merged as #221. |
| `claude/3d-gitleaks-allow-false-positive` | 2 | 2026-10-30 | PR closed unmerged. |
| `backup/3d-m3-4a-sky-wip` | 1 | 2026-10-30 | A backup; tag it if the 3D phase wants it. |
| `claude/edff-2a-stage-assets` | 7 | 2026-10-31 | PR closed unmerged. |
| `claude/3d-game-3d-1a-2` | 1 | 2026-10-31 | No PR. |
| `claude/ed2d-6c-links` | 1 | 2026-10-31 | PR closed unmerged. |

**The end state the Owner asked for** ("only main and branches with active CI, fewer than 5") is reachable today:
`main`, the refactor's working branch, and at most the two core fixes (#383, #379) until they merge. The parked
3D and editor drafts can be closed and kept as tags, so their work is not lost and they stop counting as
branches.

Two settings stop the pile from coming back:

- Turn on **Automatically delete head branches** (Settings → General → Pull Requests). It is off today
  (`delete_branch_on_merge: false`).
- Agents should not push backup or handoff branches; a draft pull request or a tag does the same job.

`AGENTS.md` keeps branch deletion for the Owner, so this audit deletes nothing. The appendix has the command that
lists the 334 merged branches for review.

## 6. What `.vscode` should hide

There is no `.vscode` folder yet. This is the proposed `files.exclude` (hidden in the file tree) and
`search.exclude` (left out of search). Everything listed is generated, vendored, bookkeeping or tool config.

**Hide always:**

| Pattern | Why |
|---|---|
| `**/node_modules`, `**/dist`, `**/.turbo`, `**/.svelte-kit`, `**/.vitest` | Build and install output. |
| `**/test-results`, `**/playwright-report*`, `**/.evidence`, `frame-budget-results`, `evidence.json`, `evidence.schema.json`, `coverage` | Test and evidence output. |
| `**/content/generated`, `**/__goldens__`, `tooling/api-report/reports`, `docs/cheatsheet.md` | Generated files, checked by CI, never edited by hand. |
| `vendor`, `docs/evidence`, `docs/history`, `docs/provenance` | Vendored builds and archives. |
| `**/CHANGELOG.md`, `**/LICENSE`, `LICENSE-SCOPE.md`, `SECURITY.md` | Written by tools or written once. |
| `.changeset`, `.claude-plugin`, `.superpowers`, `.gitleaks.toml`, `.gitleaksignore`, `.npmrc`, `.nvmrc`, `lefthook.yml`, `renovate.json`, `knip.jsonc`, `turbo.json`, `pnpm-lock.yaml` | Tool config that rarely changes. |

**Keep visible:** `package.json`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `biome.json`, `tsconfig.base.json`,
`pnpm-workspace.yaml`, `playwright.config.ts`, `.github/` (CI is part of the goal), and all source and tests.

**Hide while the 2D phase runs** (a separate block, removed when 3D starts): `packages/editor-*`,
`packages/render-pixi3d`, `packages/figures`, `packages/sector-format`, `games/base-3d`, `examples/render3d`,
`examples/figures`, `docs/design`.

The same file can recommend the Biome and Svelte extensions and set Biome as the formatter, so format-on-save
matches `pnpm format`.

## 7. For the plan stage

### Decisions (made by the Owner, 2026-11-05)

The Owner took all four recommendations: "go with your recs". The plan stage builds on them.

- **D1. Package shape: option B.** A pure `sim`, the Node content compiler, one browser package grouped by feature,
  and one tools package. It fixes S1 to S4 and C4 while keeping the sim boundary easy to enforce. (A and C from
  section 4 were the alternatives.)
- **D2. Effect only in Node tooling.** `ship`, `cli` and `content`'s compiler keep Effect; the browser side
  (`host`, `runtime`, `game`) moves to plain TypeScript. It removes the 28 to 86 kB gzip and the extra boot time,
  and it is the single biggest cut in concepts a new reader has to learn. This reverses ADR 0003 for the browser;
  the plan stage records that in the ADR.
- **D3. 3D and editors follow core by codemod.** Their imports are updated in the same pull requests so `main`
  stays green, and their browser suites move out of the core pull request gate (C1).
- **D4. Features no game uses leave core** (O6). They move out or are deleted, and each comes back when a game
  needs it.

### Work the plan should cover, in order

1. **Make CI tell the truth about 2D.** Split the Playwright config by area; run Emberwick's journeys on every
   pull request in Chromium and WebKit (T2, T5); move the editors' journeys out of the core gate (C1); have the
   frame budget skip, not fail, on a software renderer (C2); turn on branch auto-delete and clean the branches
   (section 5).
2. **Remove what is not used.** Emberwick's stand-ins (O1) and the hot-reload demo's dependency on them; the
   placeholder game (S7); features with no game (O6, D4).
3. **Restructure by feature** (D1, section 4), with the boundary rule in `check-boundaries`, and tests moved to
   `tests/{unit,browser,e2e}` in the same pass (T7, O4).
4. **Shrink the public surface** to what games use, through the umbrella `@mcthaydt/automata`, and make Emberwick
   use the umbrella like the examples do (S4, S5). Pick one name for the game (S6).
5. **Decide Effect** (D2) and apply it.
6. **Cut the process weight.** Run publishing checks (API report, API index, agent skills, plugin validation,
   changeset checks, consumer smoke) on release, not on every pull request (O5); replace plan IDs in comments with
   plain explanations (S9); move `02`, `03`, the old specs, plans and evidence PNGs to an archive and keep one short
   status page (S8).
7. **Prove it with journeys.** Done means Emberwick's journeys pass on every pull request in two browsers, and the
   Owner plays it on the iPad (J1).

## Appendix: how the numbers were measured

All commands were run from the repository root on `da765837` with Node 24.21.0 (pnpm's pinned runtime).

- **Lines:** `find <paths> -name '*.ts' -o -name '*.svelte' ... | xargs cat | wc -l`, with `*.test.ts` and
  `*.e2e.ts` counted as tests and `node_modules` and `dist` left out.
- **Coverage:** `@vitest/coverage-v8@5.0.3` added for the run only (not committed), then in each package
  `pnpm exec vitest run <its test:unit projects> --coverage.enabled --coverage.include='src/**'
  --coverage.exclude='**/*.test.ts' --coverage.exclude='**/testing/**'`.
- **Exports:** the count of `###` headings in each `tooling/api-report/reports/<package>.api.md`.
- **Names the games import:** every `import { ... } from '@mcthaydt/automata-*'` in `games/emberwick` and
  `games/placeholder`, tests and `e2e/` left out.
- **Emberwick end to end:** a throwaway Playwright config with only Emberwick's two web servers and its two
  projects (`base-2d`, `base-2d-compact`), run with the preinstalled Chromium: 18 passed in 2.1 minutes.
- **Nightly history:** `gh api repos/mcthaydt/automata-framework/actions/runs?event=schedule` and each run's jobs.
- **Branches:** `git ls-remote --heads origin`, then `gh api repos/mcthaydt/automata-framework/compare/main...<branch>`
  for each (status, `ahead_by`, `behind_by`), joined with every pull request's head branch and state.
- **Merged branches, for review before deleting:** the 334 rows whose compare status is `behind` (`ahead_by` 0).
  List them with:

  ```sh
  git ls-remote --heads origin | awk '{sub("refs/heads/","",$2); print $2}' | grep -vx main |
    while read -r b; do
      [ "$(gh api "repos/mcthaydt/automata-framework/compare/main...$b" --jq .ahead_by)" = 0 ] && echo "$b"
    done
  ```
