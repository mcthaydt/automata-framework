# Customer value for AI game makers: plan audit

Stage 3 (plan audit) of the customer value pipeline. It checks the spec and plan on PR #533
([`2026-11-08-customer-value-spec.md`](2026-11-08-customer-value-spec.md),
[`2026-11-08-customer-value-plan.md`](2026-11-08-customer-value-plan.md)) against the code, for completeness,
consistency and cohesion, and runs the real thing: a small game made by an agent and the editors, played, reloaded,
closed and reopened.

Code was read at PR #522's head (`5cf0825b`), PR #521's head (`5fd3933c`) and PR #532's head (`829039d5`, every editor
free on the web, which now sits on #522). The fixes below are made in the spec and plan in this PR, on top of stage 2's own update of
Task 14 for the Owner's Publish answer.

## 1. Verdict

The plan covers every finding and its order is sound, but four of its tasks would fail or do needless work as written:
the skills it points every new game at do not exist yet (A1), the API reference cannot read the beta packages the way
Task 4 says (A2), Task 11 rebuilds something the editors already do (A3), and Task 5 is mostly done on #532 (A4). Each
is fixed in the plan here. Nothing here needs the Owner except A1's precondition, which is a step already on the
Owner's list (SKILLS_TOKEN and the first mirror push).

**The first run comes first** (the Owner, 2026-11-08 22:33: the customer value fixes and onboarding are top
priority). The first-run path, nothing to a played game the person edited, is Tasks 1, 2, 3, 6, 8, 9 and 7, then the
copy (10, 15). Of the findings, A1 (the agent is pointed at empty skills) and A7 (a workspace game's tests do not
start) are the two that would stop a first run; A1 is fixed only when the mirror is filled, so it is the first thing to
ask the Owner for. The plan's Base now orders the first-run tasks first.

## 2. Findings

| # | Severity | Finding | Fixed in the docs |
|---|---|---|---|
| A1 | High | The mirror every new game names is empty | Base, Task 2, Task 7, Task 18 |
| A2 | High | Task 4: private packages have no `.d.ts` and no `types` exports | Task 4 |
| A3 | High | Task 11 duplicates the editors' own extension event list; V10 is already fixed | Spec §1, §7; Task 11 |
| A4 | Medium | Task 5 is stale against #532: the packed page already wins | Spec §5; Task 5 |
| A5 | Medium | Task 13 makes a second itch.io guide; the dialog it edits says "build" | Task 13 |
| A6 | Medium | Task 7 reads Task 1's file from a stack that does not have it | Base, Task 7 |
| A7 | Medium | "Make a game with `--link-workspace` and run its tests" fails in the workspace | Global Constraints; Tasks 2, 6, 9 |
| A8 | Medium | Task 6 misses the story's sim setup and the template's own tests | Task 6 |
| A9 | Medium | Task 12 changes every game's landscape view and leaves out the controls and the HUD | Spec §9; Task 12 |
| A10 | Low | Task 1 should extend the existing install test, which is stale | Task 1 |
| A11 | Low | Task 3's "no 3D" test matches "configure"; Schematic's puzzles row is missing | Spec §4; Task 3 |
| A12 | Low | Task 14 (rewritten for the Owner's answer) misses three cases | Task 14 |
| A13 | Low | Facts written by hand: "19 comments", `CliDeps`, line numbers | Tasks 8, 10, 17 |

### A1. The mirror every new game names is empty (High)

`.claude/settings.json` (Task 2), `AGENTS.md` (Task 2), the site's prompt (Task 7) and `llms.txt` all send the agent to
`mcthaydt/automata-skills`. Today that repository holds only a README (checked through GitHub on 2026-11-08). The
release workflow copies `agents/automata` there only after a published release, and only when `SKILLS_TOKEN` exists
(`.github/workflows/release-packages.yml:193-241`); both are on the Owner's list. Until then, Claude Code offers a
marketplace it cannot add, and `npx skills add` finds no skills. The agent is told to install something that is not
there, which is the trap V1 set out to remove.

Fix (in the plan): a precondition in Base. Tasks 2 and 7 may be built and merged, but the site's words and the first
packed tools that carry the settings file ship only after the mirror holds `.claude-plugin/marketplace.json`. Task 18
checks the mirror's files before it runs the journey. `AGENTS.md` keeps working without the plugin, as the spec says.

### A2. Task 4: the beta packages have no declarations (High)

Task 4 says "The private packages' `.d.ts` come from `pnpm build` like the rest; a missing one is the same
`MissingTypesError`." That is not so. `entryPoints` (`tooling/api-index/src/entry-points.ts:30-47`) reads the `types`
target of each export of each *publishable* package, and `rows.ts` reads those declaration files. The private
extensions the templates import (`@automata/narrative`, `cutscenes`, `systems`, `nav`, `level-2d`) have no `build`
script and export source paths with no `types` (`"./sim": "./src/entries/sim.ts"`). Their version is `0.0.0`, which
the reference's version line and `plugin.json`'s version check would pick up.

The expected list in Step 4 also names `places`, which no 2D or story template imports (`level-2d` depends on it).

Fix (in the plan): beta entries take the export's source file (`src/entries/*.ts`) as their declaration input, read
through the TypeScript program as the published ones are; their version is left out of the version line and the
`plugin.json` check; the expected list is narrative, cutscenes, systems, nav and level-2d.

### A3. Task 11 rebuilds what the editors already do (High)

`extensions/editors/src/shared/game-events.ts` (on #522 and #532) already offers Feel and Audio the events of every
extension whose content the game has: systems, dialogue, cutscenes and puzzles, read from the extensions' own
`defineEvent`s. In the story game made for this audit, Feel's "What happens in the game?" lists "coin collected" (the
agent's new event), "a cutscene starts", "a conversation shows a line" and "a character catches the player"
(`7-feel-lists-extension-events.png`). The audit's V10 read only `content/generated/events.json`, which is the game's
own list; the editor adds the rest.

A second list in each extension's `package.json` would be two owners for one fact. Fix: Task 11 becomes a check, not
a mechanism: a test that the story game's Feel and Audio list the narrative, cutscene and systems events, and the
`automata-content` skill says an extension's events show up when the game has its content. Spec §1 and §7 say V10 is
met. The `@automata/content`, `feel`, `puzzle` and `audio-synth` changesets for Task 11 go.

### A4. Task 5 is mostly done on #532 (Medium)

On #532, `builtApp()` returns `packedPage()` first, wherever the game is (`editor-command.ts:157`), so the published
editor starts under any `pnpm-workspace.yaml`. `inRepository` now only chooses the error message (`:82`). The plan's
`builtApp('suite-2d')` and the page choice it fixes were deleted with `page-for.ts`.

Fix: Task 5 branches from #532 or later, keeps `findRepositoryRoot` (so the message is right) and the stranger step
(so it stays fixed), and drops the `builtApp` change.

### A5. A second itch.io guide (Medium)

`docs/guides/publish-to-itch.md` already exists and the site renders it. Task 13 would add `put-it-on-itch.md` beside
it. Fix: Task 13 puts a short "From the editor" part at the top of the existing guide, in drunk grandma words, and the
command-line part stays below. With the Owner's answer (A12) the guide is the fallback, not the main path.

The Publish dialog Task 13 edits says "Building your game…" and "This builds your game"
(`PublishGameDialog.svelte:46,54`), which the plan's own copy rule forbids. Task 13 now changes those words too
("Making your game's zip…").

### A6. Task 7 depends on a file its stack does not have (Medium)

Task 7's test reads `agents/automata/.claude-plugin/marketplace.json` (Task 1), but Task 7 branches from the site stack
(#521), which Task 1 is not on. Fix: Task 7 runs after Task 1 is in a head both stacks share (after V16), or after Task
1 is merged.

### A7. A workspace game's tests do not start (Medium)

Tasks 2, 6 and 9 say to make a game with `--link-workspace` and run its `pnpm test` or `pnpm check`. Done for this
audit, `pnpm test` stops before any test: `failed to load config … Cannot find module
'…/extensions/audio-synth/src/app/audio-synth.extension'`. Vitest loads `vite.config.ts` with Node's own loader,
which cannot follow the workspace sources' extensionless imports. `pnpm exec vitest run --configLoader runner` passes
(4 files, 15 tests). Fix: those steps say `--configLoader runner` for a workspace game, and the consumer smoke covers
the published path.

### A8. Task 6 misses files (Medium)

The story's player is spawned in `src/app/story-sim.ts`, written by `template-story.ts` (`:394-416`,
`start.y - SQUARE_SIZE / 2`), not by `template-story-game.ts`. The 2D template's own test also offsets the start
(`template-game.ts:276-282`, `ON_THE_START`). Both are added to Task 6's files. The test comment "the feet at x = 24
touch it" disagrees with its own assertion (24.5 touches, 23.5 does not, because the right edge is open); it now says so.

### A9. Task 12 is bigger than one file (Medium)

`LetterboxFrame` is core: every AF game, Emberwick included, draws through it. Fitting instead of cropping also puts
side bars on any desktop window wider than the field's shape. The plan does not say where the touch controls are laid
out (it promises they move into the side bars), what `scenery` means once the field is fitted, or that the in-game text
thread (#524/#526) reads this geometry for the HUD's safe area. `DEFAULT_BAR_FRACTION` is exported, so the API report
changes. Fix: Task 12 names the controls' layout file (found when the task starts, by what reads `gameplay`),
defines `scenery` as the whole view, coordinates with #526, runs `pnpm api-report --update`, and its PR says plainly
that every game's landscape view changes.

### A10. Task 1 and the install test (Low)

`tooling/agent-skills/tests/install/install.test.ts` already installs the plugin with the pinned Claude Code
(2.1.301) and checks the skills byte for byte; it lists four skills though five exist. Checked for this audit with
2.1.301 and 2.1.319: a copy of `agents/automata` with the new `marketplace.json` passes `plugin validate --strict` (it
validates the marketplace and, through it, `plugin.json`; a bad `plugin.json` still fails), `marketplace add --scope
project` and `install automata@automata --scope project`. Fix: Task 1 adds that case to the install test and brings
its skill list to six.

### A11. Task 3's tests (Low)

`not.toMatch(/3D|af-sector|figure/)` fails on "configure". It becomes `/\b3D\b|af-sector|\bfigures?\b/`. Spec §4's
Schematic row leaves out `content/puzzles/*.toml`, which the template's `editors.toml` lists; it is added.

### A12. Publish and itch.io (Low)

The Owner answered D1 on 2026-11-08 (22:31, A) and refined it (22:32): "the zip should be separate from itch, do the
zip then ask where they want, itch will be first output". Stage 2 rewrote Task 14 and spec §11 for it while
this audit ran, and the rewrite meets the answer: the zip is its own step with "Download the zip", then "Where do you
want to put it?" lists places from one list (`PLACES`, itch.io first), so the next place is one entry. itch.io uses
the person's own itch.io sign-in (`butler login`, or their own `BUTLER_API_KEY`), and AF writes neither; a test holds
the folders unchanged except `ship.config.ts`. Three gaps, fixed in Task 14:

1. A game made with `--targets web` has no `itch` block in `ship.config.ts` (`template-project.ts:20`); the first push
   adds it, not only replaces the placeholder.
2. `butler login` opens a browser on the computer running `automata editor`. A person on a tablet joined with `--lan`
   would wait for a page that never comes; the dialog says "Finish signing in on your computer".
3. `need: 'kind'` cannot be detected (butler does not report a page's kind), so "Set its kind to HTML" is a sentence
   shown before the first push, not an outcome.

## 3. The real thing: a game made by an agent and the editors

On #532's head, in the workspace (Node 24, Chromium), recorded in
`/mnt/project-files/refactor/2026-11-08-customer-value-plan-audit-screens/`:

1. `create-game coin-run --link-workspace` made the story game. No `AGENTS.md`, `CLAUDE.md`, `.claude/` or git
   repository (V1, V12 confirmed).
2. As the agent, following spec §4's table: a `coin` sim feature (component, `coin.collected` event, pick-up system,
   plugin), one entity per placed coin from `entitiesOf(startLevel, 'entities')`, `'coin'` added to `live`, a
   `pictureView(project, 'coin', images)` view, and a sim test. The table was enough; the two steps it does not name
   are adding the plugin to the game's plugin list and the view to `views` (now in the `automata-content` example).
3. Levels: placed two coins (`1-levels-two-coins.png`). The first brush was Area, a zone, not ground (V9 holds in the
   served editor too). The level file got both coins at once.
4. Tuner: speed 2 → 4; written at once, even when the tab closed right after (`2-tuner.png`).
5. Feel: "coin collected" was offered, and so were the story's extension events (A3). Typed "Coin!" in "What it says"
   and closed the tab without leaving the field: the bar said "Saved in your game folder" and the file still said
   "Pow!" (`3-feel-typed-not-saved.png`). This is V2/P14, owned by #528, still present on #532. After Tab, it saved.
6. Played: the coins show (`4-play-coins.png`); walking right picks one up and "Coin!" shows
   (`5-play-coin-picked.png`).
7. Reloaded the editor, stopped `automata editor` and started it again, opened a fresh browser: two coins, speed 4 and
   "Coin!" were all there, and play picked up the coin again (`6-after-restart-play.png`).

Seen on the way, outside this plan: the coin's word is blurry (in-game text thread), the keeper's conversation box
covers the floor where the coins are, and the level inspector's "+" buttons wrap at 1280 px.

## 4. What did not run

`pnpm check` and the unit suites were not run: this PR changes only Markdown. WebKit, Firefox and a real phone were
not used. The journey ran in the workspace, not from packed tools outside it (that is Task 18's).
