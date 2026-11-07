# 3D slice audit

- **Stage:** 1 of 6 of the 3D slice (audit). The next stage writes the plan and spec from this.
- **Date:** 2026-11-07, on top of the 2D editors and site stack (PR #441, head `a51dbb13`).
- **What it covers:** the 3D core (`render-pixi3d`, `figures`, `sector-format`, `vendor/pixi-3d`), the 3D editors
  (`editor-3d`: Levels 3D, the Studio, the full suite page, and the suite's phone layout), the base 3D game
  (`games/base-3d`), the 3D examples (`examples/3d`), the 3D gates (`3d.yml`, the `:3d` scripts) and the 3D parts of
  the site, measured against the patterns the two earlier slices set.
- **Its sources too** (added the same day, on the Owner's word): FigureBuilder and EnvironmentBuilder, which the Owner
  says were updated substantially, measured against AF in section 9.
- **What it does not do:** change code. Section 8 lists the decisions only the Owner can make (D1 to D10), each with
  a recommendation.

Every number below was measured on this checkout on 2026-11-07; the commands are in the appendix. WebKit and Firefox
cannot be installed in a cloud session, so every browser run here is Chromium; hosted CI was not run. Screens are in the
project files, `refactor/2026-11-07-3d-slice-audit-screens/`.

## The short version

1. **The 3D editor cannot open the 3D game.** `automata editor games/base-3d --app 3d` says "No projects yet". The 2D
   slice narrowed what the server lets a page read, when a game has no `content/editors.toml`, to `*.af2d.json`; base-3d
   has no editor list, and keeps its room under `src/content/levels/`, not `content/`. No test covers this, and no 3D
   gate ran on the 2D stack, so nothing caught it.
2. **The Studio and Levels 3D are unreachable.** The only page that holds them (editor-3d's suite page) always opens
   the in-memory sample game, which the 2D slice rewrote to a 2D platformer with one tuning file. Both say "Nothing to
   edit in … yet." Served inside base-3d's folder it still says "This is a sample game, not yours. Run automata editor
   inside your game's folder", which is where it was run.
3. **On a phone the 3D level view has no tools.** At 390 × 844 the level shows Back, Layers, Undo, Redo and Save over a
   black grid: no drawing tool, no Plan/3D/Walk switch, no inspector. On a phone's Home the only way to start is behind
   a button called "Sources". The Studio's top bar at 390 px clips Publish to "Pu", and its layout test still passes.
4. **The 3D code is where 2D was before its refactor.** 50,000 source lines in four packages, a game and the
   examples, laid out by layer (`app/`, `model/`, `ui/`, `view/`), 317 of 326 test files beside their code, 1,021 plan
   IDs and 1,126 mentions of the source projects in code and tests, Effect still inside the 3D renderer, and a second level
   format (the source game's "blockout" and "facility" files, 1,558 source and 3,660 test lines) that no AF game uses
   and that the editor names on screen.
5. **The tests are many and mostly unit tests; nothing tests the product end to end.** 3,836 unit and DOM tests pass,
   and the renderer's parity, the figures' goldens and the game's browser tests pass in Chromium. The editor's layout and canvas projects pass 187 and fail 8, the known 8: seven are a test reading
   the kit's new dialog scroll region instead of the list, and one is a Pencil journey whose corners now land under a
   sheet at iPad mini landscape. No 3D editor test starts `automata editor`, opens a game folder or reads a file on
   disk; no journey goes from an edit to the game.
6. **The 3D gate is off, and the pause is not in the stack.** `pnpm check` runs no 3D unit test (`test:unit:2d`).
   PR #425, which pauses `3d.yml`, is open on a side branch, and the workflow is active in Actions, so at #441's head
   `3d.yml` still runs on every pull request that touches `packages/**`, and will fail on the 8 tests when the stack
   merges.
7. **Nothing 3D can ship yet.** `@pixi/3d` is still not on npm (404, 2026-11-07); its beta terms forbid public
   deployment. The site has no 3D page, example or demo, and says nothing about 3D.
8. **The good parts are worth keeping.** The base 3D game is small (1,906 source lines), passes its 8 journeys in
   Chromium and has a cross-engine golden replay. `sector-format` is one owner for the level file, read by the game and
   the editor alike. The renderer's parity and the figures' goldens pass. The Studio reads well on an iPad. The kit is
   still free of 3D.
9. **Its two sources have moved on, and AF has none of it.** FigureBuilder has 171 commits since the copy AF took on 28
   October: a natural stand, body and face diversity, new hair, garments sized from the body, its wardrobe moved out
   behind hooks, and the feature folders AF wants. EnvironmentBuilder, new on 5 November, builds furnished, lit rooms
   and streets from Build-style maps, as geometry. Section 9 measures both. **The Owner took D10 the same day:
   everything comes in, the builders' pixel-art look included**, which reverses the 30 October call that 3D figures are
   meshes; D9 (how) stands on its recommendation.

## 1. What this slice covers

The Owner, 2026-11-06: "we do the editor refactors that 2D touch and website refactor as if it's ready to ship with 2D
alone, then we do the same for 3D". "Ready to ship 3D" is read here as: someone makes a 3D game, edits its level and
its hero in the editors, sees the change in the game and publishes it; the site shows 3D beside 2D; journeys prove each
step on every pull request. Publishing waits for Pixi 3D's public release (Owner, 2026-10-23).

| Area | In this audit |
|---|---|
| 3D core | `packages/render-pixi3d`, `packages/figures`, `packages/sector-format`, `vendor/pixi-3d` |
| 3D editors | `packages/editor-3d` (Levels 3D's own app, the Studio, the full suite page `suite-main.ts`), the suite shell's phone layout, `automata editor --app 3d` |
| 3D game and examples | `games/base-3d` (with `DESIGN.md`, `EDITOR-GAPS.md`), `examples/3d` |
| Gates | `.github/workflows/3d.yml`, `test:unit:3d`, `test:browser:3d`, `test:journeys:3d`, PR #425 |
| Site and docs | the site's 3D parts (none), `docs/design/editor-3d`, `docs/README.md`, the agent package's 3D mentions |
| Not in it | the 2D editor, the kit and the 2D suite page (done in slice 2) except where 3D uses them |

## 2. The numbers

Source is `.ts`, `.svelte`, `.css` (and `.js`) outside tests; tests are `*.test.ts` and `tests/`.

| Package | Source lines (files) | Test lines (files) | Unit + DOM tests | Browser run here (Chromium) |
|---|---:|---:|---|---|
| `editor-3d` | 26,358 (232) | 42,178 (202) | 2,932 pass, 43 s | layout + canvas: 187 pass, **8 fail**, 24 skipped (review images) |
| `figures` | 14,878 (112; 13,217 outside `testing/`) | 5,199 (46) | 426 pass, 30 s | golden parity: 24 pass |
| `render-pixi3d` | 4,797 (58) | 4,890 (47) | 292 pass, 11 s | parity: 17 pass, 2 skipped (WebKit and Firefox not run) |
| `sector-format` | 1,198 (10) | 601 (4) | 104 pass | |
| `games/base-3d` | 1,906 (34, without generated files) | 1,825 (19) | 82 pass, 9 s | browsers + layout: 32 pass; journeys: 8 of 8, 44 s |
| `examples/3d` | 869 (10) | 547 (8) | | journeys: 9 of 9 (WebKit's 9 not run) |
| **3D slice** | **~50,000** | **~55,200** | **3,836** | |
| For scale: `@automata/editor` (kit, 2D editor, 2D suite) | 47,333 | 45,499 | | |
| For scale: Emberwick | 2,374 (src) | 1,472 | | |

- **Where tests sit:** 317 of 326 test files are beside the code (`editor-3d` 202, `render-pixi3d` 47, `figures` 46,
  `base-3d` 18, `sector-format` 2 in `src/` and 2 in `blockout/`). Only `examples/3d` (8) and one base-3d dev-server
  test use `tests/`. Suffixes: `.dom`, `.layout`, `.canvas`, `.journey`, `.parity`, `.bench`, `.schema`.
- **Plan IDs in comments:** 1,021 (`editor-3d` 515, `render-pixi3d` 207, `figures` 205, `base-3d` 72, `sector-format`
  14, `examples/3d` 8). `pnpm style --plan-comments` covers none of these folders.
- **Source project names** (the `source-names` patterns): 1,126 hits in 436 files (`editor-3d` 520, `figures` 491,
  `base-3d` 59, `render-pixi3d` 37, `examples/3d` 13, `sector-format` 6), including user-facing strings. `pnpm
  source-names` reads only Markdown. Core still has some too (`packages/automata` 202, `content` 74, `tools` 13).
- **Builds:** `editor-3d` builds its app (main chunk 489 kB, 160 kB gzip) and the full suite (main chunk 1,164 kB,
  370 kB gzip, plus a 323 kB `stage-renderer` chunk holding `@pixi/3d`). In dev the hero's first pose took 64 ms against
  a 5 ms budget (the console says so).
- **Mock-ups:** `docs/design/editor-3d` holds 4,221 lines of hand-run `.mjs`; the 2D slice archived the 2D ones.

## 3. Findings: the 3D core

Each finding has an ID so the plan can point at it.

### Package shape and structure

| ID | Finding | Evidence |
|---|---|---|
| S1 | Three private 3D packages that only each other and base-3d import: `render-pixi3d` depends on `figures` and `sector-format`; every consumer imports all three. The core slice merged six browser packages into one grouped by feature; 3D still has the old shape. | `package.json` deps; imports: `figures` 31, `render-pixi3d` 16 + `/sim` 16 + `/camera-view` 5, `sector-format` 10 |
| S2 | Folders by topic, not the `app/ features/ shared/ entries/ testing/` shape; `pnpm boundaries --features` does not run on any 3D package. | `packages/figures/src/{build,clip,evaluate,figure,garments,hair,…}`; root `package.json` `boundaries` |
| S3 | Tests beside code in every 3D package (317 files); the rule is `tests/` with `#src/…` imports. `--test-imports` skips them. | section 2; `style` script |
| S4 | Effect is still inside the 3D renderer (`Scope`, `Runtime`, `Effect.gen` in `create-pixi3d-renderer.ts`, `context-loss.ts`, `load-models.ts`) behind a plain wrapper; AGENTS.md law 5 allows it "until the 3D phase". `figures` ships Effect in its public `./testing` entry (`compile-fixture.ts`); base-3d lists `effect` as a runtime dependency and uses it in one test. | `grep "from 'effect'"` |
| S5 | `sector-format` has a `./blockout` entry for the source game's blockout format, and `editor-3d/src/format/*.ts` are four re-export files "so the editor's files keep their names". | `packages/sector-format/blockout/`, `packages/editor-3d/src/format/` |
| S6 | `figures`' `streetwear/` (3,516 lines, 11 files: bomber, hoodie, puffer, jacket, …) and `garments/` (1,479) have no tests of their own; they are checked only against goldens recorded from the source project's code. No AF game or example wears a streetwear garment (Wick wears a top, trousers, shoes, a cape, a cap and eyes). | `wick.toml`; `grep` over `games`, `examples`, `editor-3d` |
| S7 | `figures`' goldens (1 MB of JSON) are regenerated only by scripts that need a checkout of the source repository at a pinned commit, so AF cannot re-record its own behaviour. | `packages/figures/scripts/*-goldens.ts` |
| S8 | No README in any 3D package; `docs/README.md` still names `packages/editor-*` and calls base-3d "in progress". | `ls packages/*/README.md` |
| S9 | Imports with `.js` in `render-pixi3d`, `.ts` in base-3d's `main.ts`, none in `figures`: three styles. | the files' imports |
| S10 | `docs/design/editor-3d` (4,221 lines of hand-run `.mjs` mock-ups) is the pre-redesign look; the 2D slice archived its own, and the approved mock-ups are the reference now. | `docs/design/editor-3d/` |

### Contracts

| ID | Finding | Evidence |
|---|---|---|
| K1 | Good: one owner for the level file. `@automata/sector-format` defines `af-sector/1`; the game's converter and the editor both read it. Keep. | `af-sector.schema.ts`, `games/base-3d/src/content/levels/sector-area.ts` |
| K2 | base-3d's room needs data the editor cannot write: entity definitions are bare ids, camera views live in code (`ROOM_VIEWS`), pits are "floor below 0" by convention, rooms must be axis-aligned boxes (EDITOR-GAPS EG-2 to EG-5). The game-facing meaning of a level is not in the contract. | `games/base-3d/EDITOR-GAPS.md` |
| K3 | `suite-content-shim.ts` imports `content`'s source by relative path (`../../content/src/shared/…`) though `@automata/content/schema` and `/palette` now exist; its comment asks for exactly those entries. | `packages/editor-3d/src/suite-content-shim.ts` |

## 4. Findings: the 3D editors

### Shipping

| ID | Finding | Evidence |
|---|---|---|
| E1 | `automata editor games/base-3d --app 3d` lists no projects. With no `content/editors.toml` the policy reads only `*.af2d.json` (2D slice, E3); base-3d has no list and keeps its room at `src/content/levels/room.af-sector.json`. | `editor-policy.ts` (`LEVEL_FILE`); screen `e3d-home-ipad.png` |
| E2 | The full suite page (`suite-main.ts`) always calls `samplePorts(SAMPLE_GAME)` with `sample: true`; it never tries the checkout it is served on (the 2D page calls `openSuitePorts`). The sample game has no 3D level and no figure, so Levels 3D and the Studio show "Nothing to edit in … yet." | `packages/editor-3d/src/suite-main.ts`; `sample-ports.ts`; screens `suite3d-*` |
| E3 | The full suite is reachable only with `--app-dir packages/editor-3d/dist/suite`, and the CLI then says "Opened Base 3d in the level editor." `--app 3d` serves the standalone 3D editor, which has no Studio. | `editor-command.ts` `BUILDS`; server output |
| E4 | Four editor pages now exist: the 2D editor, the 2D suite page, the 3D editor, the full suite. Levels 3D and the standalone 3D editor are the same editor in two shells. | `packages/editor/src/app/*/main.ts`, `packages/editor-3d/src/{main,suite-main}.ts` |
| E5 | The `@automata/editor-3d` root entry (384 lines of re-exports, half of them the kit's) and its `./suite` entry are imported by nothing outside the package. | `grep "@automata/editor-3d"` |
| E6 | Unbuilt features are on screen: World ("Not ready yet: the map of all your levels is coming soon."), Ask (an AI proposal flow with no provider), and the suite's Review, Publish, Export changes and Import changes over a sample game. | screen `e3d-level-ipad.png`; `app/ask-controller.ts` |

### Layout and the look

| ID | Finding | Evidence |
|---|---|---|
| V1 | Phone: the level view has no tool, view switch or inspector at 390 × 844, so nothing can be drawn; Home's actions hide behind "Sources". | screens `e3d-level-p-phone.png`, `e3d-level-phone.png` |
| V2 | The 3D editor is the pre-redesign look: words for tools in a left rail (Select, Sector, Vertex, Portal, Door, Window, Things), a row of bordered buttons on top, the old kit Home ("Open from", "This workspace", "Import zip…"), emoji lock icons, two lime buttons on one screen (Open and Open another). The approved mock-up has a floating icon toolbar, label-left inspector and Saved as status. | screens; `refactor/2026-11-06-redesign-mockups/editor-level.html` |
| V3 | 14 tokens it uses do not exist in the kit (`--color-accent` 15 uses, `--radius-control` 7, `--color-surface-base` 6, `--color-border` 6, `--color-state-error` 5, `--edk-*`, `--shadow-pop`, …), so they fall back to hard-coded values (`var(--radius-control, 8px)`) or to nothing; 23 uses of `--radius*`/`--pill` (the rule is `--edge-sm/md/lg`). | `grep var(--…)` against `tokens.css` |
| V4 | The suite on a phone (both pages): the top bar leaves out the game's name; the full page has a bottom bar of five tabs (Tuner, Levels, Levels 3D, Studio, Review) where "Levels" is the 2D one, and its Home lists only Tuner and Levels; the 2D page offers Export changes and Import changes on a real game folder. In phone landscape the bottom bar takes 52 of 390 px. | screens `suite3d-home-phone.png`, `suite2d-home-phone-land.png` |
| V5 | The Studio at 390 × 844: the top bar's Undo, Redo, Publish, two panel toggles and a "Dock" text button do not fit, and Publish is clipped to "Pu" under them; the stage leaves the timeline a bottom sheet. On an iPad it reads well (Figures, Poses, Clips; Look, Pose, Animate; body sliders). | screens `studio-animate-phone-portrait.png`, `studio-look-ipad-pro-11-landscape.png` |

### Tests

| ID | Finding | Evidence |
|---|---|---|
| T1 | The 8 known failures, reproduced in Chromium, and the same 8 fail in WebKit and Firefox on the runner (this PR's `3D - parity` job: 24 failures, everything else in the 3D browser suites passes in all three engines). Seven: `open-flows.layout` reads the first `[data-scroll-region]`, which is now the kit dialog's own body, not the problem list; the list does scroll (screen). The product now nests two scroll regions. One: `sector-tools.layout`'s Pencil journey fails at iPad mini landscape only (it passes at the four other non-compact sizes): since the 2D slice put the 3D editor on the size-based layouts, an inspector sheet covers the lower third of the plan and the floating tool bar sits over the room there, so the test's corners land on overlays ("that point is already a corner"), the room never closes and Undo has nothing to name. A layout question as much as a test one. | `e3d-browser.log`; `Dialog.svelte:101`; `ErrorPanel.svelte:46`; screen `t1-pencil-ipad-mini.png` |
| T2 | No test starts `automata editor`, opens a game folder, writes a file or looks at the game. The three "journeys" mount the app in a test page. E1 and E2 exist because of this. | `packages/editor-3d/src/journeys/`, `*.journey.test.ts` |
| T3 | `pnpm check` runs no 3D unit test; `ci:local` runs no 3D suite; the 3D editor's journeys run in WebKit only, so a session cannot run them. | root `package.json`; `journey-project.ts` |
| T4 | 24 review-image canvas tests are skipped unless `ED3D_VISUALS=1`; nothing compares their pictures. | canvas run |
| T5 | The Studio's layout test passes at phone portrait while Publish is clipped (V5): it checks the stage, the modes and the timeline, not that every top-bar action is whole and inside the screen. The phone checks in general prove sizes, not that a person can do the job (V1 passed its tests too). | `studio.layout.test.ts`; screen |
| T6 | base-3d's browser run can fail before its tests run. Every Vite server the run starts compiles the game's words with Paraglide, which empties `src/paraglide` and writes it again; a server whose dependency scan reads the folder in that gap fails ("Could not load src/paraglide/messages/title.js"), finds its dependencies late, reloads the test page, and `hud.layout.test.ts` never becomes ready (60 s). It happened on this PR's second `3D - parity` run (78 tests passed, 1 error) and not on its first; a Chromium-only run here empties the folder three times in 1.7 s, so the gap is real and only its timing varies. The fix belongs in `-content`'s compile (compile into the temporary folder, then copy over only what changed, so the folder is never empty and an unchanged compile writes nothing). It reaches any game that sets `paraglide`; today only base-3d does. | Actions run 42359697986, job `3D - parity`; `compile-messages.ts` (`compileInFolder`); a 2 ms poll of `src/paraglide/messages/title.js` during `vitest run --project 'layout (chromium)' --project 'browsers (chromium)'` |

## 5. Findings: the game, the examples, CI and the site

| ID | Finding | Evidence |
|---|---|---|
| G1 | base-3d is laid out by role (`commands.ts`, `components.ts`, `systems/`, `views/`, `screens/`), Emberwick by feature (D15 of the 2D slice: one feature-folder game layout). base-3d keeps content in `src/content/`, Emberwick in `content/`. | `ls games/*/src` |
| G2 | base-3d's journeys cover boot, the fake host, readiness, the compile budget, the rotate hint, saves and a host with no saves (8 of 8 in Chromium). None plays with touch, uses the Roll button or reaches the goal; the golden replay covers the sim only. | `e2e/base-3d.e2e.ts` |
| G3 | `EDITOR-GAPS.md` is stale in part: the Things layer and definitions editor now exist (EG-1), but the room's entities are still hand-written. | `editor-3d/src/things/`, `ui/definitions/` |
| G4 | One game, three names: "Ember Hall" on its title screen, `base-3d` ("Base 3d" in the CLI) and "Emberwick in 3D" in `DESIGN.md`. | `messages/ui/en.json`; server output |
| G5 | The title menu shows Slot 1 and New game; Settings is reached only from pause. `DESIGN.md` says the menu has New game, Continue and Settings. | `screens/flow.ts`; screen `game-ipad-2-menu.png` |
| G6 | The HUD shows "● 0" with no total ("Embers 0 of 6" is only the screen reader's label); pause is the text "II". On an iPad the room is drawn in a wide band with about 40% of the screen empty above and below. | screen `game-ipad-3-play.png` |
| G7 | The hero's first pose takes 64 to 102 ms against its 5 ms budget (a console warning in dev, Chromium with a software GPU); nothing fails on it. | dev server console |
| Q1 | PR #425 (3D paused, browser gates at two suites) is not an ancestor of #441; at the head, `3d.yml` runs on pull requests and `test:browser*` still use `--concurrency=3`. The `3d` workflow is active in Actions (not disabled by hand). AGENTS.md says the 3D suites run in `3d.yml`, not that they are paused. | `git merge-base --is-ancestor`; `3d.yml` `on:`; the Actions workflow list |
| Q2 | When 3D is turned back on, 3D's parity, journeys and game CI are four jobs on the Owner's Mac, whose queue the 2D stack already fills. | `3d.yml` `runs-on` (`af-mac`, `af-linux`) |
| W1 | The site has no 3D: no example, demo, editor, doc or API page; `examples.ts` keeps the 3D examples out on purpose. Home, Start and the docs describe a 2D framework. | `site/src`; `grep 3D` |
| W2 | Nothing 3D can be public yet: `@pixi/3d` 0.1.0-beta.2 is vendored and its terms allow no public deployment; npm has no `@pixi/3d` on 2026-11-07, a week after the "about two weeks" of 2026-10-30. `ship prepare` and the `-tools` scan refuse it, which is right. | `vendor/pixi-3d/README.md`; `npm view @pixi/3d` |

## 6. Copy and UX (the drunk grandma test)

| ID | What a person sees | Why it fails |
|---|---|---|
| C1 | "Read as af-sector. This editor opens af-sector and last-light-blockout." | A file format's id, and the source project's name, on screen |
| C2 | "sectors.0.floor Invalid input: expected number, received string" ×40 | Raw schema messages and JSON paths; no word on how to fix it |
| C3 | "This is a sample game, not yours. Run automata editor inside your game's folder to edit it." | Shown when it was run inside the game's folder |
| C4 | "No projects yet. Import a folder or a zip to start." (phone, no button in sight) | The action is behind "Sources" |
| C5 | Sector, Vertex, Portal, Definitions…, spawn, "51 px per metre", "af-sector" badge, the file's path under its name | Build-engine words; a grandma draws rooms, walls, doors and puts things in them |
| C6 | "Nothing to edit in Studio yet." | No way to get anything to edit |
| C7 | "Opened Base 3d in the level editor." (full suite), "Base 3d" for base-3d | Wrong editor named; the name is the folder's |
| C8 | Two dots per layer row (shown, colour) and a 🔓 emoji | Unclear which dot does what; emoji where the kit has icons |
| C9 | The Studio lists `wick`, `guard-high`, `pickup-low`; Skin `wick-shadow`, Gait `bounce`; sliders read 0.4; Playhead, Add key, Dock | Content ids instead of names; numbers without meaning |
| C10 | The game's HUD "● 0", pause "II", and a menu with no Settings | A player cannot tell what the number counts, or where the settings are |

## 7. Ready to ship 3D: where each step stands

| Step | Today | Findings |
|---|---|---|
| Make a 3D game | No: `create-game` makes 2D only; base-3d is the only 3D game | |
| Open its level in the editor | No | E1, G1 |
| Edit its hero in the Studio | No | E2, E3 |
| See the change in the game | The game reads the level file directly, so yes once E1 is fixed | K1, K2 |
| Use the editors on a phone and an iPad | iPad layout passes its tests; the phone has no level tools and a clipped Studio bar | V1, V4, V5 |
| Look like the approved mock-ups | No | V2, V3 |
| Publish | Blocked on Pixi 3D's public release; the refusals are correct | W2 |
| The site shows 3D | No | W1 |
| Journeys prove each step on every pull request | No: no end-to-end editor journey, 3D gate off | T2, T3, Q1 |

## 8. For the plan stage

### Decisions only the Owner can make

Each has a recommendation; the plan stage builds on the recommended option unless the Owner picks another.

- **D1. When 3D ships, now that Pixi 3D is late.**
  - **A (recommended):** refactor and finish 3D now on the vendored beta, everything but the public parts; publish the 3D
    package, the 3D editors and the site's 3D pages the day `@pixi/3d` is on npm, as one last phase.
  - B: stop 3D work until Pixi 3D is public.
  - C: launch 2D alone now and 3D later as its own release (already possible under the 2D slice's D2).
- **D2. The 3D core's package shape.**
  - **A (recommended):** one package `@automata/3d` (renderer, figures and the sector format, by feature, with
    `./sim` as its sim entry), public once Pixi 3D is; `editor-3d` stays its own private package (the 2D slice's D6).
  - B: keep the three packages and restructure inside each.
- **D3. The source game's level format in the 3D editor** (blockout and facility files, their checks for doors, lamps,
  puzzle hotspots and nav links; 1,558 source and 3,660 test lines; named on screen).
  - **A (recommended):** delete it; AF's editor opens `af-sector` files only.
  - B: keep it as an opt-in extension profile, renamed.
- **D4. One editor app.**
  - **A (recommended):** `automata editor` opens one suite on the game's folder, holding Levels (2D or 3D, by the file),
    the Studio and the Tuner, and listing only what the game has; the standalone 2D and 3D pages go. A game without an
    editor list gets one from `create-game`; base-3d gets one.
  - B: keep the four pages and wire each to the checkout.
- **D5. The 3D editor on a phone.**
  - **A (recommended):** full authoring on a phone, as the 2D editor has (tools in a dock, views in a menu, the inspector
    in a sheet).
  - B: phone opens, walks and changes properties; drawing is iPad and desktop only, and the phone says so.
- **D6. What the 3D editors keep** (the essential-only rule; core authoring is never cut).
  - **A (recommended):** keep drawing rooms, walls, doors, windows, things and their definitions, the Plan, 3D and Walk
    views, the checks, Undo and Save, and the Studio's Look, Pose and Animate. Cut World (unbuilt), Ask (no provider),
    the suite's change-set desk (Review, Export changes, Import changes) until it does something on a real game, and
    `figures`' streetwear wardrobe, which no game wears (or move it to an example).
  - B: keep everything that is built.
- **D7. 3D on the site** (after D1's release).
  - **A (recommended):** the lean site grows by dimension: base-3d playable on Home beside Emberwick, a 3D group in
    Examples, "Try the 3D editor" on the Editor page, a 3D section in the docs, and the API page for `@automata/3d`.
  - B: one 3D page only.
- **D8. The Owner's own inputs.** Pixi 3D's public release (or the Pixi team's written okay to deploy the beta), a run of
  WebKit and Firefox on the Mac (3D parity and journeys), merging PR #425 or saying to re-land its pause in the stack,
  and playing base-3d and the 3D editor on the iPad.
- **D9. How AF takes from FigureBuilder and EnvironmentBuilder** (section 9, B9 and B10).
  - **A (recommended):** port by hand into AF's 3D package from the commits read here (`025ffb4`, `6d82a52`), each
    recorded in `docs/provenance/sources.md` with what was taken; AF owns its copy, and a later pull is a planned task
    that diffs the source from the recorded commit. AF stays standalone and publishable.
  - B: AF depends on them (a submodule, or packages they publish). One copy, but both would have to be public and
    licensed, and their painter-first designs would steer AF's.
  - C: take nothing new in this slice; AF keeps `a1f7246` and has no environment builder.
- **D10. What the 3D slice takes from them** (B1 to B8).
  - **A (recommended):** FigureBuilder's generator side (B1: the stand, the mesh half of the diversity sliders, the hair
    pieces, fit, seats, the garment registries, its folders) and EnvironmentBuilder's world layer (B6: props, the dresser
    and its kits, doors, wall trim and decor, window grids, lamps, generated maps) as geometry Pixi 3D draws, in one
    sector format that grows EnvironmentBuilder's fields (B7). Not the painters, the photo pipeline or the CPU views
    (M3R-D2 stands). With this, D6's wardrobe cut is the source's own: the wardrobe leaves core, and an example can
    register it.
  - B: A, plus the photo pipeline as a Node tool that makes textures on the game's palette (B8).
  - C: the pixel-art look as well: reopen M3R-D2 and draw 3D the way the two builders paint (another renderer and look;
    under law 6 the painter could only be an offline bake).
  - D: FigureBuilder's generator side only; EnvironmentBuilder in a later slice.
  - **Taken by the Owner, 2026-11-07: C**, on the decision card ("Their pixel-art look too"), then in the thread: "Take
    everything basically". Read as: all of both builders comes in (B1 to B8 with nothing left out): FigureBuilder's
    generator, painter, lighting and actors, and EnvironmentBuilder's world, photo pipeline, painter, lighting, stage and
    views. M3R-D2 (figures are meshes, the painter stays out) is reversed. D6's wardrobe cut still matches FigureBuilder's
    `main`, whose base no longer holds a wardrobe; its registries come in.

### Work the plan should cover, in order

1. **Gates first** (Q1, T1, T3, T5, T6): bring #425's pause into the stack or turn 3D back on deliberately; fix the 8 tests
   (read the list's own region, one scroll region per dialog, the plan clear of the sheet at iPad mini landscape); put
   the 3D unit tests in a 3D `check` the plan names; run the 3D editor's journeys in Chromium as well as WebKit; phone
   checks that every action of a screen is whole and inside it; Paraglide compiled without emptying its folder.
2. **Open the 3D game in the editor** (E1, E2, G1, G3): base-3d gets `content/editors.toml` and moves its content to
   `content/`; the full suite opens the checkout; one Playwright journey per editor against the real `automata editor`
   on a temporary copy of base-3d (open the room, draw, save, the file changes, `automata check` passes, the game
   shows it; and the Studio changes Wick). Chromium and WebKit.
3. **Package shape and folders** (D2, S1 to S3, S5, S9, E5, K3): one 3D package by feature; `editor-3d` by feature with
   tests in `tests/`; the re-export files and dead entries go; `--features`, `--test-imports` and `--plan-comments`
   cover every 3D folder.
4. **Effect out** (S4): the 3D renderer in plain TypeScript with the browser package's `Clock` and `Disposables`.
5. **Cuts** (D3, D6, S6): the source game's format, the unbuilt views, and the wardrobe as decided; goldens recorded from
   AF's own code (S7).
6. **Pull the builders** (D9, D10 as taken, B1 to B10): everything from FigureBuilder `025ffb4` and EnvironmentBuilder
   `6d82a52`, ported into AF's 3D package in their feature folders and recorded in `sources.md` (`source-names` learns the
   new name). The plan answers first, from measurements:
   - **Law 6 and ADR 0002** ("PixiJS only for rendering"): both painters rasterise on the CPU. Either Pixi presents the
     painted frame (a texture per frame or per sprite cell) and the law is amended to say so, or the painters' rules
     (DUEL snap, stepped light, outlines) are rebuilt as Pixi passes. The plan writes the ADR amendment for whichever it
     picks. Both painters' source is plain TypeScript with no Node imports (only EnvironmentBuilder's photo loading and
     PNG code use Node), so they can run in a browser.
   - **Does 3D still need `@pixi/3d`?** If the painters draw the frame, Pixi 3D may no longer be needed, and D1's wait for
     its public release with it. That changes the launch rule the Owner set on 2026-10-23 ("we launch when pixi 3D goes
     public"), so the plan measures it and puts the answer to the Owner.
   - **One palette:** both builders paint on DUEL; AF's palette content defaults to Endesga 64. The 3D look is DUEL
     unless the plan finds a reason it cannot be.
   - **One timeline:** FigureBuilder's actors and AF's clips and `evaluate()` (B5) become one.
   - **One level format** the 3D editor edits (B7), with props, dressing, lamps and time of day placeable.
   - **The frame budget** on a phone and an iPad for the first-person and diorama views at their native size, and whether
     the editor's Plan, 3D and Walk views are drawn by the painter too.
   Then the port, with the builders' goldens re-recorded from AF's code (S7), and base-3d's room dressed from a kit.
7. **Redesign** (V1 to V5, D4, D5, S10): the 3D editor and the Studio from the approved mock-ups and the kit's tokens, phone
   first; one suite.
8. **Copy pass** (C1 to C10, G4 to G6): the copy table in `copy.md`, plain words, no format ids, paths or source names
   on screen; one name for the game.
9. **Words in code** (S8, section 2): plan IDs and source names out of code and tests; READMEs; `source-names` reads code
   too.
10. **The site** (D7, W1) and **the release** (D1, W2): built and tested behind the beta check; published when Pixi 3D is.

## 9. FigureBuilder and EnvironmentBuilder

The Owner, 2026-11-07: "Pull from the figurebuilders repo and environmentbuilders repo, they were updated
substantially." Read here as: the 3D slice takes their updates, so this section measures them against AF, and the plan
ports what D9 and D10 choose. Both were read at their `main` heads: FigureBuilder `025ffb4` and EnvironmentBuilder
`6d82a52` (both 2026-11-06). Nothing was ported in this stage. The Owner took D10 the same day (everything, the
pixel-art look included), so B4 and B8 below describe what M3R-D2 kept out, all of which now comes in.

- **FigureBuilder** since `a1f7246` (2026-10-28, the commit AF's `figures` was extracted from): 171 commits; `src/` and
  `base/` 47 files changed, +3,061 and −3,512 lines; now 6,570 source and 2,681 test lines. Five cycles: the base-pair
  refactor (feature folders in layers, tests only in `tests/`, a public surface, an architecture test; the wardrobe, the
  random cast, headwear, portraits and the scene prototype cut from base), the wardrobe hooks (five registries a fork
  fills), c3-stand (a natural stand), c4-diversity and c3-cloth (fabrics and fit).
- **EnvironmentBuilder** is new: started 2026-11-05 from FigureBuilder's cut scene prototype, 182 commits, 7,844 source
  and 2,988 test lines, 3,142 lines of library JSON and 2.9 MB of photos. It builds Build-style maps into geometry and
  paints them as pixel art with FigureBuilder's rasteriser, which it takes as a submodule pinned at `50235f4` (before
  c3-stand, c4-diversity and c3-cloth).

| ID | Finding | Evidence |
|---|---|---|
| B1 | AF's figures is three weeks behind on the generator. What applies to meshes, and AF has none of: the natural stand (the head over the shoulders, a straight weight leg, a trace of weight shift, the arms at the thighs); `fat` on the limbs, neck and jaw, `bust`, `seat`, `bodyAsymmetry` and the face's `asymmetry` (jaw, nose, mouth); the hair's low pony, bun, fall and curl volume; fit (the body's rings and girth, so cuffs, collars and hems are sized from the body and clear every slider's end); seats. | `git diff a1f7246 025ffb4` on `body/genes.ts`, `motion/motion.ts`, `outfit/fit.ts`, `hair/hair.ts`; `grep -r 'bodyAsymmetry\|eyeSize\|girth\|registerGarment' packages/figures/src` finds nothing |
| B2 | FigureBuilder took its wardrobe out of base: `streetwear.ts` (1,476 lines), the random cast, headwear, graphics and sets are gone, kept for forks (tag `archive/pre-refactor`) behind five registries (`registerGarment`, `registerOutfitHooks`, `registerHairPiece`, `registerFinish`, `registerFabric`). AF still carries the `a1f7246` wardrobe: 11 files in `figures/src/streetwear/` and the `figure-headwear` content kind. That is D6's recommendation, made by the source itself, and the registries are the shape AF's extension rule asks for (opt-in, never editing core). | FigureBuilder README, "Forking FigureBuilder"; `ls packages/figures/src/streetwear` |
| B3 | FigureBuilder now has the layout AF's rules ask for (feature folders, tests in `tests/`, a layer test); AF's copy is by noun with its tests beside the code (S1). A port can take the source's folders: body, motion, hair, outfit, figure. | FigureBuilder `CLAUDE.md`, "Layout" and "Rules"; its `tests/architecture.test.ts` |
| B4 | About half of FigureBuilder's new work paints texels and stays out under M3R-D2 (figures are meshes on Endesga 64; the painter and DUEL stay in FigureBuilder): fabrics (a tile of tone labels), the cloth coordinates, the neckline rule, lips on a two-row chin, the lighting feature and its light hook. The eyes' size, spacing and tilt move a texel at density 2 and up, so a mesh needs its own reading of them. | `src/features/paint/`, `lighting/`, `figure/cloth.ts`; the M3 characters spec, M3R-D2 |
| B5 | FigureBuilder's scripted actors (an action set on a timeline: `actions.json`, `actions.ts`, `actor.ts`, `pose-spec.ts`, 939 lines) overlap AF's clips and `evaluate()`, which already took its reach, look and flinch as fixture clips. Two timelines would drift; the action set fits AF as clip content. | `src/features/actors/`; the header of `packages/figures/src/index.ts` |
| B6 | EnvironmentBuilder's world layer is renderer-free geometry that Pixi 3D could draw: meshes with swatch materials, built from a map (sectors with sloped floors and ceilings and open sky; swinging doors; walls with a dado, rail, cornice, windows, shopfronts and signs; window grids on facades), a props library and generators (furniture, fixtures, clutter), a dresser that fills a room from a purpose kit by one field (`"dress": { "as": "office" }`, every piece with an id an edit can name), lettering, decals, lamps from a kit, times of day, and generated maps (`apartment@<seed>`, `block@<seed>`). AF's 3D has none of these: base-3d's room is bare sectors, and the 3D editor places crates and a spawn. | EnvironmentBuilder `src/features/world/`, `docs/dressing.md`; `games/base-3d/src/content/levels/room.af-sector.json` |
| B7 | The two map formats share an ancestor and have diverged. EnvironmentBuilder's: `verts` or `rect`, `floor` and `ceil` planes with `slope` and `sky`, walls by edge index with `decor`, `dress`, `sprites`, `lamps`, `time`, `views`, `horizon`, `grime`, `reads`. AF's `af-sector/1`: `corners` that carry their walls, `holes`, plain numbers for floor and ceiling, `light`, `style`, textures by name, `entities`. Neither reads the other, so taking the world layer means one format, which the 3D editor then edits. | EnvironmentBuilder `src/features/world/types.ts`; `packages/sector-format/src/af-sector.schema.ts` |
| B8 | EnvironmentBuilder's look is its painter's: per-vertex light stepped and snapped to DUEL; Poly Haven CC0 photos indexed to DUEL ramps by a photo pipeline (flatten, facet, resample, index, wear, clean); CPU diorama, top-down and first-person views at 320 × 200. Under M3R-D2 none of it ports as it is. The photo pipeline could become a Node tool that makes textures on the game's palette, if AF's levels are to be textured from photos (a level names a texture per surface; base-3d's room names none). | `src/features/paint/`, `photo/`, `view/`; `docs/photos.md` |
| B9 | Where the code came from is not recorded. `docs/provenance/sources.md`, the one file that may name a source, has no FigureBuilder entry, though `figures` names FigureBuilder and `a1f7246` in its comments (part of S8's 491 hits there), and `source-names` does not know EnvironmentBuilder. Neither repository has a licence file or a `license` field (both private, the Owner's). EnvironmentBuilder's photos are Poly Haven CC0, credited in its `photos.json`, and it keeps copies of the source game's files in `docs/reference/`. | `docs/provenance/sources.md`; `tooling/repo-hygiene/src/source-names.ts`; both `package.json` files |
| B10 | There is no way to pull again. AF rewrote what it took (renderer-free, Zod content kinds, Endesga 64), so neither a merge nor a submodule fits: EnvironmentBuilder takes FigureBuilder as a submodule behind one door file and a fork merges `upstream/main`, but AF publishes to npm and its packages cannot ship a private repository. Each pull is a hand diff from a recorded commit, and EnvironmentBuilder itself lags FigureBuilder by three cycles. | EnvironmentBuilder `CLAUDE.md`, "FigureBuilder", and `.gitmodules`; `git submodule status` |

## Appendix: how the numbers were measured

Checkout at `a51dbb13` (#441's head), Node 24.22.1 (`/opt/node24/bin`), pnpm 10.34.6, Playwright's preinstalled Chromium.

- **Lines:** `find <dir> -type f \( -name '*.ts' -o -name '*.svelte' -o -name '*.css' -o -name '*.js' \) ! -name
  '*.test.ts' ! -path '*/tests/*' | xargs cat | wc -l`; tests the same over `*.test.ts` and `tests/`. base-3d without
  `src/paraglide` and `src/content/generated`.
- **FigureBuilder and EnvironmentBuilder:** shallow clones of `main` deepened to 1,000 commits; `git log --no-merges
  a1f7246..025ffb4 | wc -l`; `git diff -M --stat a1f7246 025ffb4 -- src base`; lines with `git ls-files '<dir>/*.ts' |
  xargs cat | wc -l` over `src`, `base` and `scripts`, and `tests`.
- **Unit and DOM tests:** `pnpm test:unit` in each 3D package and in `games/base-3d`.
- **Editor browser tests:** `npx vitest run --project 'layout (chromium)' --project canvas` in `packages/editor-3d`.
- **3D parity and game browser tests:** `npx vitest run --project 'browsers (chromium)'` in `packages/render-pixi3d` and
  `packages/figures`; `npx vitest run --configLoader runner --project 'browsers (chromium)' --project 'layout (chromium)'`
  in `games/base-3d`.
- **Game and example journeys:** `npx playwright test --project base-3d --project base-3d-dev` in `games/base-3d`;
  `npx playwright test` in `examples/3d` (the WebKit project fails to launch here).
- **Served editors:** `pnpm --filter @automata/editor-3d build`, `pnpm exec turbo run build --filter
  @automata/tools`, then `node packages/tools/dist/bin.js editor games/base-3d --app 3d` and `--app-dir
  packages/editor-3d/dist/suite`, the 3D editor's `dist` served as static files for browser storage, and a Playwright
  script at 390 × 844, 844 × 390, 1194 × 834 and 1440 × 900 that read the page's text and took the screens.
- **The game:** `games/base-3d`'s Vite dev server, played by a Playwright script at 844 × 390, 390 × 844 and 1194 × 834
  (Chromium, software GPU). The Studio's screens are the ones its layout test writes (`.vitest/shots`).
- **Actions:** the workflow list from the GitHub API (`3d` is `active`).
- **Plan IDs:** `grep -rEo` for `M<n>[.<n>]`, `ED3D`, `EDS`, `EDK`, `M3R-D`, `DX.`, `QB.`, `PUB.`, `APP.`, `GL.`, `DIST.`,
  "spec §", "§<n>", "plan <ID>" and "Owner, 2026" over `.ts`, `.svelte`, `.css`.
- **Source names:** the patterns in `tooling/repo-hygiene/src/source-names.ts` (plus "last light" with a hyphen) over
  each folder, `node_modules` and `dist` excluded.
- **Tokens:** every `var(--…)` in `packages/editor-3d/src` against the custom properties `tokens.css` defines and any
  definition inside the package.
- **WebKit and Firefox:** this PR's own `3D - parity` job on the runner (Actions run 42358120705), read from its log.
- **The stack:** `git merge-base --is-ancestor origin/claude/project-thread-ajhkmg HEAD` (#425's head) returns false.
- **Pixi 3D:** `npm view @pixi/3d versions` returns E404 on 2026-11-07.
