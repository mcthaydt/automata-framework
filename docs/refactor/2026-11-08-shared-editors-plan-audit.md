# Shared editors: plan audit

- **Stage:** 3 of 6 of the shared-editors pipeline (plan audit), 2026-11-08.
- **What it checked:** the [spec](2026-11-08-shared-editors-spec.md) and the [plan](2026-11-08-shared-editors-plan.md)
  (PR #512, head `f3f79fc4`: 18 tasks in 6 phases) against the [audit](2026-11-08-shared-editors-audit.md) (PR #509),
  the Owner's D1 (A: one Characters rail entry in both kinds), the Owner's pricing (only the essentials on the web; which
  ones is the apps audit's open D1), and the code the build starts from: PR #508 at `89db7336`, the head every path in
  the plan was read at. Every finding below was checked in that code; the evidence column says where.
- **Outcome:** 21 findings. 12 would have stopped the build or shipped a hole, 9 are smaller. All are fixed in the spec
  and plan in this pull request. Task 16 is split in two, so the plan now has 19 tasks in 6 phases. No decision is left
  for the Owner: the one fix that touches what ships (PA3) keeps the spec's own promise that the published tools do not
  change.

## The asks, checked

**D1 = A.** Covered: one "Characters" rail entry in both kinds; in 3D the Studio, in 2D a second rail entry of Levels 2D
that opens its Characters view (spec §3, tasks 1 to 3). The reason given for one editor with two entries holds in the
code: sessions are kept per editor id (`Suite.svelte:118`), and Undo follows the open editor's id (`Suite.svelte:148`),
so both entries share one history and one write queue. Three things stood between the design and a working entry: the
suite opens nothing when two Home cards name one editor (PA4), the icon it names does not exist (PA10), and the Level and
Tiles tabs stayed in the top bar inside Characters (PA15).

**Pricing: no page gains or loses an editor.** Holds after PA3. Task 2 adds a rail entry to the 2D page, which the web
serves, but it opens a view of Levels 2D that page already has; the apps audit's recommended free set lists "Levels 2D
(with its Characters view and Add tiles)". Tasks 1 and 3 change only which registered editors show. No task touches
`page-for.ts`, `editor-command.ts`'s `BUILDS` or the site. The one place the plan did change what the published tools
carry was the 2D template's dependencies (PA3).

**Buildable task by task by a Sonnet builder.** Not as written: four tasks named code that does not exist or does not
work the way the plan says (PA5, PA7, PA8, PA10), two left the builder to discover a whole missing mechanism (PA1, PA7),
one claimed a gate that does not run (PA6), and one task was five tasks (PA12). Each is now pinned.

**The drunk grandma test.** The start page's sentence said a game "can't show sounds and music" and sent a person to "a
new copy of the tools" (PA14); Characters kept Levels' tabs, so the rail said one place and the canvas showed another
(PA15); the iPad rail still cut "Characters" (PA16); a refusal named a Start button the person may not see (PA21). Fixed.
The other words pass: "More", "Nothing made yet. Open it to start.", the list refusal, the Tuner's controls sentence.

**The end-to-end rule.** The stage-1 audit made, played and saw a 2D and a 3D game on this same head an hour earlier
(its "What was done by hand"). This audit did not repeat it. Task 19 keeps the rule for the build.

**Checked by running.** On #508 (`pnpm install --frozen-lockfile`, exit 0), three throwaway Vitest cases, not committed:

- PA1, the page's ports (`samplePorts(SAMPLE_GAME)`, classed the way `openSuitePorts` classes a served checkout):
  appending Feel's row to the list gave `{"ok":false,"reason":"policy","message":"content/editors.toml is read only:
  never written by an editor (content/editors.toml)"}`, and starting `content/feel/feel.toml` gave
  `"content/feel/feel.toml is read only: no row of content/editors.toml lists it"`.
- PA5, the same ports with `content/generated/events.json` present: `workspace.generated(...)` gave `undefined`.
- PA5, `gameEvents` over `{ "events": ["wick.bumped"] }`: no ids (`[]`).

## Findings that would have stopped the build

| # | Finding | Evidence | Fix |
|---|---|---|---|
| PA1 | **The page refuses the list write before the server sees it.** Task 7 adds the rows through "the suite's raw ports". Those ports classify every path with the list read once when the page opened, and refuse any write the list calls read only. The list itself is `ALWAYS_NEVER`, so `ensureListed` is refused in the page ("content/editors.toml is read only: never written by an editor"). Even past that, the new `content/feel/feel.toml` would be classified with the old list (unlisted, refused) and `files()` would not list it under Feel until a reload. Task 6 fixes only the server. | `open-suite-ports.ts:60-68`, `sample-ports.ts:21-31` (the list read once); `memory-workspace.ts:52-56`, `:88-91` (writes refused by `classify`); `workspace-policy.ts:20` | Task 7 gives the page's ports a live list: one loaded list that a list write replaces, which `classify` reads. The page lets a list write through only under PA2's rule. New tests in `open-suite-ports.test.ts`: after `ensureListed`, the same ports write `content/feel/feel.toml` and `files('feel')` lists it. |
| PA2 | **"Rows may only be appended" lets the editors widen their own access.** The list is never written so that "the suite cannot widen its own allowlist, and an Ask diff cannot add a command to a check's `run`". Under spec §5 a page could append `glob = "vite.config.ts"` or `"src/**"` (code Node runs at the next dev start) or a `[[check]]` with any `run`. | `workspace-policy.ts:10-13`; `editors.schema.ts:126` (`run`); spec §5, task 6 | A list write is allowed only when the new list loads, the old list's every table is unchanged and in order (`format`, every `[[file]]`, `[[check]]`, `[[gate]]`, `never`, `generated`), and every added row is exactly one of `editorRows(id)`'s rows. The rule is `listGrowsBy` beside `editorRows` in the editor-list module (task 5), used by the server (task 6) and the page (task 7). Never from no list: the editors do not start a list. |
| PA3 | **A new 2D game made with the published tools could not install.** Task 13 adds `@automata/narrative`, `-cutscenes`, `-systems`, `-nav`, `-places` and `-level-2d` to the 2D template; all six are private. Outside this workspace the template asks `^<tools version>` of each, and the stranger's journey makes a 2D game from the published packs and installs it. It also broke spec §2's promise that the published tools do not change. | each package's `"private": true`; `template-file.ts:29` (`frameworkSpec`); `tooling/consumer-smoke/tests/e2e/stranger.test.ts:88-115` | The story comes with a gate in the shape of the 3D template's: `storyAvailable()` (this workspace, or `AF_BETA_STORY=1`) in `story-gate.ts`. Without it, `create-game` writes today's 2D game plus the settings file (task 12 adds no package). The 3D template is already workspace-only (`three-d-gate.ts`). `stranger-3d.test.ts` packs only `@automata/3d` beside the published packs, so it would need the story packages too: recorded as pending (it runs on request). Publishing them is the apps work's call. |
| PA4 | **Neither Levels nor Characters could open.** The suite opens an entry only when exactly one installed Home card's `editor` is in the entry's `editors`. Tasks 2 and 3 give Characters its own card with `editor: 'levels-2d'`, so both entries find two cards and open neither. | `Suite.svelte:102-108`; plan task 2 step 3, task 3 | The entry opens the card whose `entry` is its id (`card.entry === entry.id`); `Home`'s filtered list goes by entry too. Task 2's test presses Characters, then Levels, then Characters, and checks one session. |
| PA5 | **The events list is never read, and its shape is wrong.** `gameEvents` reads a JSON array (of ids or `{ id }` rows) and returns nothing for the object `{ "events": [...] }` that spec §7 and task 9 write. And a served page reads compiler outputs through `workspace.generated()`, which answers only paths a `generated` predicate allows; the served ports pass none, so it is always `undefined` (why the Tuner's `tuning-meta.json` is read only in tests). | `game-events.ts:87-99`, `:108`; `open-suite-ports.ts:62-68`; `memory-workspace.ts:118`; `tuner-fixtures.ts:82` | The plugin writes a sorted JSON array of ids. `openSuitePorts` passes `generated: (path) => path.startsWith('content/generated/')`, with a test; this also lets the served Tuner read `tuning-meta.json`, so task 9 reruns the Tuner journeys. Task 16's Feel journey picks "Wick bumped" from the list, which proves it in play. |
| PA6 | **No gate typechecks or tests the new games.** Tasks 13 and 16 said the integration test makes the new game build, typecheck and pass its own tests. It checks `ruken.toml` and the itch zip only. The story code is template strings no repository typecheck reads, and Vite does not typecheck, so a type error would pass every gate and land in a person's first game. | `create-game.integration.test.ts:31`, `:80` | Tasks 12, 13, 16 and 17 run `tsc -p .` and `vitest run` in a game made by the journeys' `newGame` (its packages are linked from the workspace), and record both. |
| PA7 | **The 3D cutscene stage could not know a cutscene is playing.** The 2D stage reads `CutsceneState` through `LevelSceneHooks.draw(sim, …)`. A `PixiStageHooks` gets only `StepResult` (tick, events, render). The example task 14 lifts has no cutscene sim ("The sim has nothing in it: the scene's clock is its tick"). Its camera is `{ pos, look, fov }`, not the plan's `{ x, y, z, yaw, pitch }`, and the 3D template's follow camera rewrites the camera every frame. | `cutscene-stage-2d.ts:99-101`; `sim.ts:69-76`; `cutscenes-door-and-lamp.ts:64`, `:91-93`; `cutscene.event.ts:11-14` | The 3D stage follows `cutscene.started` (`{ id, start, end }`) and `cutscene.ended` in `apply(result).events`, plays `director.stateAt((tick - start) / tickHz)` and writes `{ pos, look, fov }`. The game returns it from `createPixi3dRenderer`'s `scene` hook, whose hooks run after the camera driver's (`create-renderer.ts:250-258`), so the scene's pose wins while it plays. Interfaces rewritten. |
| PA8 | **Task 11 names a Pixi 3D call that does not exist.** It projects through `view.camera.worldToScreen`. The beta's call is `View3D.worldToScreen(position)`, which returns pixi global coordinates, or `null` behind the camera. | `vendor/pixi-3d/pixi-3d-0.1.0-beta.2.tgz`, `dist/scene/View3D.d.ts:970-1000` | `point` is `ui.toLocal(view.worldToScreen(head))`, `undefined` on `null`; the unit test stubs `worldToScreen` and builds no renderer. |
| PA9 | **More breaks the journeys that look for tabs.** `railHas` finds a `tab` by name, and both complete-game journeys run at phone size and check five or more editors on the rail. Under More, Schematic is a menu item. | `harness/complete-game.ts:16-18`; `complete-game-2d.test.ts:67-70` | Task 4 changes the harness: `railHas` finds a tab or a More item, and `openFromRail(page, name)` presses the tab or opens More and picks the item. Every journey that chooses an editor uses it. |
| PA10 | **The Characters icon does not exist.** Task 2 gives `characters-2d` the icon `person`; the kit has no `person`. The Studio's rail icon is `list` (from `iconFor`). D1 A is one entry in both kinds, so both should look alike. | `icons/paths.ts` (names `select` to `lamp`); `suite-entries.ts:17-21` | The kit gains a `person` icon, and `iconFor` gives it to `studio` and `characters-2d`. |
| PA11 | **Task 1's label rule contradicts its own test.** Appending " 3D" to Levels 3D's label "Levels 3D" gives "Levels 3D 3D", and keeping "Levels" for one kind needs the special case the step says it replaces. Counting a list that did not load as both kinds also names "Levels 2D" and "Characters 2D" on the 2D page, which has no 3D editor; today the labels part only when the shown entries hold both. | `levels-3d-suite-editor.ts:37`; `suite-entries.ts:32-37`, `:45-46` | Levels 3D's label becomes "Levels" (its one-kind name, like Levels 2D's). An entry with a kind gains " 2D" or " 3D" only when the entries shown hold both kinds. The test fixture and `suite-entries.test.ts:50` change with it. |
| PA12 | **Task 16 was five tasks, and Writer and Sequence in 3D had nothing to port from.** One task held the shared Feel and Audio file, `wick.bumped`, the players' wiring, the whole 3D story (a conversation, a cutscene, a guard as figures), the Tuner's controls sentence and five journeys. `examples/3d-story` has the guard but no conversation or cutscene; no game has shown a conversation in 3D. | plan task 16; `examples/3d-story/src/features/guard/*`, `src/app/story.ts` | Split: task 16 is Feel and Audio in a new 3D game (two journeys); task 17 is the 3D story, porting the guard from `examples/3d-story` and the keeper and `look` from task 13's `template-story.ts` with `sectorsPlaces` and `sectorAnchors` (three journeys). The controls sentence moves to task 18 (words). The dialogue box and the caption need nothing new: both are `hud.overlay` slots, whatever the game's kind (`narrative.extension.ts:40-41`). |

## Smaller findings

| # | Finding | Evidence | Fix |
|---|---|---|---|
| PA13 | **Task 12: the 2D sim's content is the level.** "Reads `SPEED` from `ctx.content` as the 3D template does" needs the 2D content to become a record, and `speed = 2` is a bare number, which the Tuner shows with no name a person reads and no range. The 3D file uses an inline table with a label. | `template-game.ts:56` (`levelIn(ctx.content)`), `:151-157`; `template-3d-content/tuning.toml` | The sim's content is `{ level, tuning }` (`PlayContent`, as the 3D template's `read-room.ts`), and the file is `SPEED = { value = 2, min = 1, max = 4, step = 1, label = "Speed", feel = "How far the square moves each step.", unit = "pixels a step" }`. Steps stay whole pixels. |
| PA14 | **The "no player" sentence fails the grandma test.** "Your game can't show sounds and music yet" (a sound is played, not shown); "Games made with a new copy of the tools have it" names tools a person never sees and does nothing for the game they have. | spec §6; plan task 8 | One first sentence per editor (Feel "can't show what the player feels yet", Audio "can't play sounds or music yet", Writer "can't show conversations yet", Sequence "can't play cutscenes yet", Schematic "can't move characters that think yet"), then for all: "Its code doesn't have the part that plays them. You can still make them here, and they'll show once it does." |
| PA15 | **Characters kept Levels' view tabs.** Dropping `characters` from `VIEWS` leaves Level and Tiles in the top bar while the Characters entry is open; pressing Level there shows the level while the rail says Characters. | `Levels2dTools.svelte:33-36` | While the view is `characters`, the tools show neither the view tabs nor the level picker; the rail is the way back. Asserted in `Suite-levels.test.ts`. |
| PA16 | **The iPad rail still cut "Characters".** At 1180 px the rail is a 56 px column; "Characte…" is that column, not the phone's bar. Task 4 changed only the bar. | `shell-layout.css:12` (`--shell-rail: 56px`); `SuiteRail.svelte:105`, `:142-150` | Task 4 widens `--shell-rail` to the longest label's measured width and asserts at 1180 × 820 that no rail label is cut (`scrollWidth <= clientWidth`), then reruns the suite's layout tests at that size. |
| PA17 | **`showView` in an `$effect` draws the old view first.** An effect runs after the DOM updates, so choosing Characters paints the level for a frame. | Svelte 5 effect timing; plan task 2 step 3 | `showView` runs in `choose()` when the session exists, and in the open's `.then` before the session is stored. |
| PA18 | **Schematic does not start through `ContentSession`.** Task 7 put `ensure` in `ContentSession.start()` and "the five content editors' session constructors". Schematic adds its first file in its own session; Writer and Sequence make several `ContentSession`s. | `schematic-session.svelte.ts:579`; `writer-session.svelte.ts:141-142`; `sequence-session.svelte.ts:177`, `:200` | Task 7 names Schematic's first Add and says every `ContentSession` Writer and Sequence make gets the editor's id. |
| PA19 | **`point` meant two things.** Feel places a word at the view's own position minus 12 px; spec §8 called `point` the character's top, and the 3D one added the height. | `feel-stage.ts:52`, `:107-112` | `point` is "where a word above this character sits": in 2D the view's position (today's), in 3D the head projected. Feel keeps its 12 px for both. |
| PA20 | **The server's file list kept the old policy.** `openCheckout` lists files by the policy it was made with; task 6 made only the file route live. | `checkout.ts:40-46`; `serve-editor.ts:266` | The checkout takes the same live policy. |
| PA21 | **Small slips.** The refusal "Press Start to add it" names a button only a start page has. `rail-phone.layout.test.ts`: the editor package's layout tests are plain `.test.ts`. `content-session.test.ts` does not exist (create, not modify). `Suite.svelte`'s `target` and open effect are at `:102` and `:115`, not `:93` and `:106`. The 2D template's list comment promised no rows "until the files exist". | `suite-phone.test.ts`; `Suite.svelte`; `template-content/editors.toml:13-15`, `:38` | The refusal reads "Feel can't save: this game's list of editors leaves Feel out." on an open file and keeps "Press Start" only on a start page; the test is `rail-phone.test.ts`; paths and lines corrected. |

## What holds up

- The rule for the rail (kind, not the list) restores the content editors spec's §7 ruling and matches `pageFor`, which
  stays untouched.
- Feel's port: the 3D renderer mounts before the game's `setup` (`create-renderer.ts:250-258`), and Feel reads
  `stage.characters` every frame, so order does not matter.
- `@automata/cutscenes` already depends on `@automata/3d`, and `@automata/editors` on `@automata/3d`, so the 3D stage
  and Sequence's 3D reading add no new package edge.
- The changeset list matches which packages are public (`@automata/framework`, `-feel`, `-content`, `-tools`); every
  other package the plan touches is private.
- The five Review Focus lines each have a test in a named task.

## Not run

- `pnpm check`: this stage changes documents only.
- The plan's journeys and the stranger's journeys (nothing to run until the build).
- WebKit and Firefox (not installed in cloud sessions); the GPU runner's suites.
