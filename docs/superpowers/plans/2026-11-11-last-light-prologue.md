# The Last Light, the 3D reference game, slice 1: the prologue. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans to implement this plan task by task,
> with **no subagents** (the Owner's rule). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Last Light's prologue plays from its first cutscene to its end as the framework's 3D reference game at
`games/the-last-light`, opens and saves in six of the suite's editors, runs under the framework's shell in six
languages, and replaces Ember Hall, which is removed with the 3D examples (`examples/3d`, `examples/3d-story`).

**Architecture:** The framework gains what the prologue needs and any adventure game would (using a hotspot, a play
HUD drawn from a data file, peeking, line delivery, a 3D cutscene stage, footsteps by floor, nine props, Sequence over
a 3D level), each as an extension or an addition to one, tested with small content of its own. The game is a new
workspace package written by feature: its content starts from October's fixtures, a small converter makes the level,
and eight small features hold what is this game's own. Three proofs follow (it plays, it edits, the shell holds), then
everything that leaned on Ember Hall or the 3D examples is moved, and Ember Hall, `examples/3d` and `examples/3d-story`
are deleted (the spec: the examples are recreated from the reference game after this slice).

**Tech stack:** TypeScript 7, Koota behind `@automata/sim`, PixiJS 8 with `@pixi/3d` (vendored beta), Svelte 5 for
HUD pieces, Zod 4, smol-toml, Vitest and Playwright (Chromium), pnpm and turbo.

**Spec:** [`../specs/2026-11-11-last-light-on-the-framework-design.md`](../specs/2026-11-11-last-light-on-the-framework-design.md)
(as re-set on 2026-11-11: "The Last Light, the framework's 3D reference game"; planned against the spec at commit
`3c0a624f`, on `main` at `e7cd66ad`).
**Survey (read it first; this plan argues from it):**
[`../audits/2026-11-11-last-light-prologue-survey.md`](../audits/2026-11-11-last-light-prologue-survey.md).
"Survey 16" below is a row of its run-time tables; "T3" is a row of its table of tangles.

**This plan replaces the one committed at `43f94569`,** which was written before the spec was re-set (it put the game
in its own repository behind a pin). Nothing of that plan's Part B stands.

**Audited** at `main` `81ce53a9`, and again after merging `main` at `6a70f9b1` with the spec's amendments
(`acb0361d` and `909f6b10`, where a new piece goes; `864361d4`, the 3D examples cut) and workstream 4's spec ([the plan
audit](../audits/2026-11-11-last-light-prologue-plan-audit.md), 32 findings, all fixed here or in the survey). "Audit 7" below is a finding of that document.

## Amendments after the plan audit (the coordinator, 2026-11-11)

These bind every task below; where a task's text disagrees, this section wins and the executing session records the
difference in the log. They come from workstream 4's plan audit
([audit](../audits/2026-11-11-builders-look-plan-audit.md), "for workstream 2") and from the Owner's later word.

1. **Task 9b, the rooms a view draws, gains four behaviours** the old game has and the task lacked. Each gets its
   failing test first: the player's own room is always drawn; the room just left stays drawn for 0.35 s under the
   camera blend; a peek draws the far side of the doorway; a cutscene draws every room. `room-visibility` in draft
   #588 is a reference for these and is not merged.
2. **The prologue uses The Last Light's own look:** the LCD panel, the retro grade and whole-pixel scaling, on by
   default as in the old game. Task 14 adds them through the interfaces workstream 4's plan names in its section
   "What workstream 2 relies on" (`@automata/lcd-panel/pass` `addLcdPanelPass`, `@automata/retro-crisp/pass`
   `addRetroPass` before the snap, `crispRendererOptions` giving the letterbox's `scale: 'whole'`), with the clinic
   profiles as the game's content. Task 14 waits for workstream 4's effects branch for these three only; the rest of
   task 14 does not.
3. **Task 13 dresses Ada and the night figure as painted figures**, the builders' figures the Owner set as the target,
   not core mesh figures: each is a `CharacterDef` in the game, dressed from the character kit's ward entries plus
   hair and eyes, drawn with `paintedFigure`. It writes no `content/figures/*.toml` for them and does not pick them
   in the Studio. The Studio cannot open a painted figure; that is row 2 of the editor gaps ledger, and task 16's
   "one edit in the Studio" is replaced, for the figures, by an edit to the `CharacterDef` shown in play, with the gap
   stated. Task 13 waits for workstream 4's figures and wardrobe branches.
4. **Every kind of authorable content has an editor** (the Owner). Task 16 names, for each kind of content the
   prologue has, the editor that opens it; a kind none opens is added to the editor gaps ledger in the tracker and
   kept as a data file with a schema. It is not a reason to stop.
5. **Merge order with the other builds:** workstream 1's `claude/shared-polish-build` lands first; then workstream 4's
   `claude/builders-look-room` (it touches `packages/3d`); then this plan's `claude/last-light-framework`. Whichever
   branch lands after another runs `pnpm install` and commits the repaired lockfile.
6. **Every branch, documents included, gets the whole `pnpm check`** before it merges.

## One repository, three branches

All twenty-two tasks are in `mcthaydt/automata-framework`. The game's own repository
(`mcthaydt/PixiJS3D_Experiment_001`, at `92e6704`) is **read only**: it is attached to the session for reference and
nothing is pushed to it.

| Branch | From | Tasks | Merges |
|---|---|---|---|
| `claude/last-light-framework` | `main` | 1 to 9b: the framework's additions | First. Each addition stands on its own tests, so this can merge before the game exists |
| `claude/last-light-prologue` | `claude/last-light-framework` | 10a to 18: the name rule, the game, its three proofs, the example | Second, after the first has merged and `main` is merged in. Task 18 also needs workstream 1's build on `main` |
| `claude/last-light-ember-hall-goes` | `claude/last-light-prologue` | 19, 20: Ember Hall's references and its folder | Last, and only after task 15 passes, so the 3D gates are never without a game |

Each branch has one draft pull request. One session may build all three in order; a later branch is started only
when the one before it has passed its tasks' checks. A fault a game task finds in a framework addition is fixed on
the game's branch with its test first (it is the same repository), and the commit says which task it amends.

Workstream 1's task that put Ember Hall in six languages (its task 17) is cut (the coordinator, 2026-11-11), so
nothing of workstream 1 leans on Ember Hall. Its build branch marks it cut; `main`'s copy of its plan updates when that
branch merges (audit 20). Task 19 measures Ember Hall's references again before it starts all the same.

**Where the branches touch workstream 1's.** None of the framework branch's tasks changes a core file workstream 1
changes. Three files both touch, each a small textual merge: `tooling/repo-hygiene/src/source-names.ts` (workstream 1's
`63afc47d` adds `superpowers` to the record folders; task 10a drops an entry above it), `examples/README.md` (both add
rows) and the root `package.json` scripts. Task 18 merges `main` after workstream 1 has merged; the other tasks of the
second branch do not wait for it.

## Tracking

Progress: **4 of 22 tasks (18%)**. Tick a task only when its checks pass; write what ran beside it.

| # | Task | State | Evidence |
|---|---|---|---|
| 1 | `@automata/interact`: use a hotspot | done 2026-11-11 | `@automata/interact` 24 unit tests (pantry scene), `@automata/puzzle` +3 (`applyVerb`); the review-focus-1 test fails when the drop is taken out; `pnpm check` lint, typecheck, boundaries, style, source-names, knip green on the tree; the whole unit suite and `check:changesets` recorded in the log |
| 2 | `@automata/hud`: the `hud` file, the objective line and the prompt | done 2026-11-11 | `@automata/hud` 27 unit tests (jsdom: schema, objective choice, placing, the two pieces) and 2 browser tests in Chromium at 390×844 and 844×390 with a 140-character line (WebKit and Firefox not run here); `svelte-check` 0 errors, 0 warnings; the whole `pnpm check` result in the log |
| 3 | `@automata/hud`: inventory, examine box, keypad | done 2026-11-11 | `@automata/hud` 58 unit tests (jsdom) and 9 browser tests in Chromium (390×844 and 844×390: 20 items scroll in the row only, whole targets, a sheet keeps its place and focus on rotation, the keypad and a long examine line stay in the field); `@automata/narrative` 162 unit tests and its 3 Chromium layout tests unchanged after the box was split; `svelte-check` 0/0 on both; whole `pnpm check` in the log |
| 4 | `@automata/systems`: peeking, hide from a system, a re-route on a clock, a carried light that burns fuel | done 2026-11-11 | `@automata/systems` 120 unit tests (the 88 it had and 32 new: peek 15, hide 4, follow 4, carried light 9); the systems golden `8ec637bd430ca3de` (Chromium) and the state-bytes pin did not move; whole `pnpm check` in the log |
| 5 | `@automata/narrative`: delivery on a line, typed out; Writer's field | todo | |
| 6 | `@automata/cutscenes`: a camera key at an anchor, a 3D stage | todo | |
| 7 | `@automata/audio-synth`: footsteps by floor | todo | |
| 8 | Sequence: the preview over a 3D level | todo | |
| 9 | `@automata/world-kit`: nine prop generators | todo | |
| 9b | `@automata/3d`: the rooms a view draws; two lamp kinds | todo | |
| 10a | The name rule: The Last Light is no longer a source game | todo | |
| 10 | The game package by feature: the layer test, provenance, a blank room that boots | todo | |
| 11 | The converter, and the content from October's fixtures; the content checks; the puzzle can be finished | todo | |
| 12 | The game's own sim features; a bot finishes the scene in Node, twice, same hash | todo | |
| 13 | Dress it: props, lamps, Ada and the figure, poses | todo | |
| 14 | Draw it: renderer, cutscenes, HUD, recorded sound and music, synth cues, feel | todo | |
| 15 | Prove it plays (Chromium) | todo | |
| 16 | Prove it edits (six editors) | todo | |
| 17 | The guide to hotspots and the play HUD | todo | |
| 18 | Prove the shell: six languages, first run, gamepad, touch at phone size | todo | |
| 19 | Ember Hall goes, part 1: tests, tools, editors and tooling stop leaning on it | todo | |
| 20 | Ember Hall and the 3D examples go, part 2: journeys, workflow, the folders, the documents; final gates and record | todo | |

## Global constraints

From the spec, the tracker and `AGENTS.md`. Every task includes them.

- **No subagents.** The executing session opens no pull request unless the coordinator says so.
- **A line changes only on the Owner's word.** Every line's English words are byte-equal to the game's record; task
  11 has the test. A translation never changes the English.
- **The script wins.** A thing, a state or an action a line names is in the scene; where they disagree the scene
  changes, never the line.
- **The game's design rules hold:** tone (worn, not grimy; no gore); the camera rules (follow at a 50 mm lens and a 30°
  home tilt, eight 45° turns, no automatic yaw, pitch or roll in play, a peek of at most 1.2 m); no real-time lights;
  no `fetch()` at run time.
- **Everything in the game's folder is MIT,** and `games/the-last-light/PROVENANCE.md` names each asset the builders
  did not make. Every recorded file the old prologue actually plays crosses as it is (the Owner: "I paid for the
  elevenlabs so it's fine"; option B, the coordinator, 2026-11-11; audit 2): twelve files, the effects `opening-ward`, `cabinet-open`, `lamps-out`, `pulse-counted`, `nurse-settle`, `nurse-move-off`, `turn-to-sound`, `nurse-sees`, `nurse-back-off` and
  the music `the-last-light`, `four-seventeen`, `back-to-bed-ada` (all `.ogg`), each with its `PROVENANCE.md` row.
  `all-lamps-die.ogg` stays out: nothing in the prologue plays it. Where the old game is silent, the new one is too.
  No synth remake of a recorded sound. Nothing else from the old pipelines comes across: no model, atlas, texture or
  generated font. No paid API is called by a task.
- **Nothing is copied wholesale** from the old game or from the superseded clinic branches (#575, #596, #606). #588
  is now workstream 4's to finish or close (its spec, call 1); what of it reaches `main` is the framework's to use.
  October's fixtures are the one exception the spec allows: content, not code.
- **A refactor, not a transcription.** The old behaviour and its tests are the specification; the old code is not.
  Each rewrite is named in its task with its reason (the survey's T rows).
- **By feature, from the first file:** `src/app`, `src/features/<x>`, `src/shared`, `src/entries` (packages),
  `src/testing`; a feature imports only itself and `shared/`; `app/` wires features; tests in `tests/` mirroring
  `src/`, importing `#src/…`, one suffix `.test.ts`; a source file has at most 600 lines; kebab-case with role
  suffixes. The game has an architecture test that fails on a broken layer or a test beside the source.
- **Where a new piece goes** (the spec, "Where a new piece goes", at `acb0361d`; audit 31): core (`packages/`) only
  what any game could use, whatever its genre; an extension what is generic within a genre and names nothing of The
  Last Light; the game what is its alone. A piece that does not clearly pass a test goes one step down. Core never
  imports an extension (`AGENTS.md`). A private copy in the game of something another game would need is not allowed,
  and neither is game-specific code or a name of the game's in core or an extension. "Homes" below rules each
  addition.
- **The framework's laws:** only the sim changes gameplay state; no I/O, wall clock or `Math.random` in sim files; the
  same seed, content and inputs give the same hash, and a mismatch is never accepted as flaky; Zod only; PixiJS only;
  the no-eval entry first.
- **Tests first;** the smallest test, then wider; injected clocks and fixed seeds; browser tests wait on readiness.
- **Phone first:** every HUD piece is designed and tested at 390 by 844 and 844 by 390; touch targets at least 44 px,
  primary actions 48 px; copy passes the grandma test.
- **Each HUD screen keeps its layout and words as data** (the Owner): a piece reads its place, size and word keys from
  `content/hud/*.toml`, never from code.
- **Gates:** `pnpm format` before each commit; Conventional Commits; `pnpm check` green before a task is ticked. New
  extensions and the game are private, so they get no changeset; a changed published package gets a `patch`
  changeset, and a changed export of one means `pnpm build`, `pnpm api-report --update` and `pnpm api-index --write`,
  committed.
- **Report what ran.** Chromium only here; WebKit, Firefox and real devices are the Owner's and are said to be so.
- **Records:** update `docs/superpowers/progress.md` and this plan's tracking table and log in the same session as the
  work.

## The calls this plan makes

1. **The game package** is `games/the-last-light`, package name `@af-games/the-last-light`, private, with
   `"automata": { "title": "The Last Light" }`, in Emberwick's shape.
2. **The `source-names` rule drops one name** (the Owner: "it's no longer a source game"). Task 10a removes the
   entry for The Last Light from `tooling/repo-hygiene/src/source-names.ts`, its test changed first; the other source
   names stay; `docs/provenance/sources.md` says so.
3. **The content starts from October's fixtures** (the survey's table says which file becomes which). They are copied,
   not moved: the extensions' own tests keep reading theirs.
4. **The converter** is `games/the-last-light/tools/convert/`, a Node script kept as a record. It turns the blockout
   fixture into a level and a nav graph, joins each line's words to its record, and, given `--reference <path>` to a
   checkout of the game's repository, reads how lines are said and where furniture stands. It runs once, in task 11.
5. **Three cutscenes put Ada on a mark** before they start: `opening` (the spawn), `lightsOut` and `rest` (the bedside
   mark). `found` follows where she was caught. For each of the three, the line, its timing and what it names hold;
   task 11 has a test per cutscene so the implementation audit can check each.
6. **Props are placed again, not converted** (survey 11): each old model becomes a world-kit or core generator at the
   same place and footprint.
7. **The twelve recorded files the prologue plays cross; the rest is the synth; all of it is the framework's `audio`
   content.** The nine recorded effects are cues whose `sound` is a core sound alias, and the three tracks are music
   `slot`s, all in
   `content/audio/audio.toml`, the `audio` kind of `@automata/audio-synth` (`extensions/audio-synth/src/shared/audio.schema.ts`),
   which the Audio editor edits. Its `event` rows say which sim event plays which cue (or is `silent`, with why), and its
   `music_rule` rows pick a slot, `hold` or `silence` from the music state the game fills each frame
   (`createMusicDirector`). The game writes no sound table of its own (audit 1). The rows are taken from the old game's
   own table (`<ref>/src/audio/events.ts`, `music-rules.ts`): a recorded file where the old one played one, a synth
   cue written new where the old one was procedural, `silent` where it was silent. Swapping a cue for a file is a
   content change, never code. The game's old rule "no `fetch()` at runtime" is read as "nothing from
   the network at run time": packaged sound files are loaded as every game on the framework loads them.
8. **The five translations of the story's 74 lines are written by the building session** in task 18 and recorded with
   `automata words --mark` (the coordinator, relaying the Owner), so "story lines in six languages" closes inside this
   plan. Task 18's last step runs `automata words` for real once the coordinator says the Owner's key is saved.
9. **`@automata/interact` and `@automata/hud` are adventure-genre extensions; the hand lamp's mechanism is a genre
   extension's** (the spec at `909f6b10`, audit 31). Core imports no extension, and as planned both lean on `puzzle`,
   `nav` and `narrative`, so they are extensions; each keeps its dependency-free half (interact's pending use and
   reach, the HUD's layout file and placing) in its own folder that imports no extension, so it can move to core later
   unchanged. "A lamp that burns fuel" is the spec's own example of a genre extension: a carried light with fuel goes in
   `@automata/systems`, beside light as a sense (task 4); the game keeps the item, its numbers and the `fill` call. See
   "Homes".
10. **Checkpoints stay in the game** for this slice (survey 24): one sim snapshot kept by the game's `catch` feature.
    It moves to an extension when the clinic needs it.
11. **Ember Hall's tests move to the smallest thing that serves them:** a test that needed "a 3D game folder" gets a
    fixture folder of its own in that package; a test that needed "the 3D reference game" uses The Last Light. Task 19
    says which, file by file.
12. **Which rooms a view draws is the 3D package's** (survey 2): `@automata/3d` holds the level format and the camera
    views, and Emberwick has no rooms, so the rule "both reference games" does not put it in `@automata/framework`.
13. **The 3D template is not changed:** its starter content is already its own (the survey). Only the tests around it
    move.

## Homes

Each addition under the spec's three homes (audit 31), as the spec reads at `909f6b10`.

| Addition | Task | Home | Why |
|---|---|---|---|
| Use a hotspot: walk into reach, then act | 1 | `@automata/interact`, an adventure-genre extension | It sends `nav.walk-to` and `puzzle.verb`, so not core (the spec at `909f6b10`). Its dependency-free half (the pending use, reach, one at a time) is `src/shared/sim/pending.ts`, importing no extension, so it can move to core later |
| `applyVerb` | 1 | `@automata/puzzle` (extension) | It is the puzzle's own verb, callable by a system |
| The play HUD from a file: objective, prompt, inventory, examine, keypad | 2, 3 | `@automata/hud`, an adventure-genre extension | It reads `puzzle`'s conditions and draws `narrative`'s box, so not core (the spec at `909f6b10`). Its dependency-free half (the `hud` file's layout schema, `place.ts`, the pieces' shells fed by `HudModel`) is `src/features/layout/` and `src/shared/hud.schema.ts`, importing no extension |
| Peeking through a doorway; hide from a system; a route made again on a clock | 4 | `@automata/systems` (extension) | Sneaking within the horror and stealth genre; the spec's own example ("hiding and peeking") |
| A carried light that burns fuel: lit or not, fuel in ticks, a toggle, a refill, the pool it gives the senses | 4 | `@automata/systems` (extension) | The spec's own example ("a lamp that burns fuel"); it feeds `env.lights`, which the senses already read; it names no item of the game's |
| Delivery on a line, typed out; Writer's field | 5 | `@automata/narrative` (extension), `@automata/editors` | Lines are narrative's; nothing in it names the game |
| A camera key at an anchor; a 3D stage | 6 | `@automata/cutscenes` (extension) | Cutscenes are an extension; the stage is generic to any 3D game using it |
| Footsteps by floor | 7 | `@automata/audio-synth` (extension) | The `steps` table lives beside the cues it names |
| Sequence over a 3D level | 8 | `@automata/editors` | The suite |
| Nine prop generators | 9 | `@automata/world-kit` (extension) | Generic ward and workplace furniture; the names are what the things are (`sink`, `gurney`), none the game's |
| The rooms a view draws; `moon` and `fill` lamps | 9b | `@automata/3d` (core) | Any 3D game with rooms; the spec's own example ("a view that names the rooms it draws") |
| The hand lamp: which item it is, its numbers, the `fill` call | 12 | The game's `lamp` feature, over task 4's carried light | The item, the fill of 40 s and the cap of twice it are this game's content and rules |
| The vigil, what a catch does, the checkpoint kept, the music state, the table of piece states | 12, 13, 14 | The game | This story's rules; the checkpoint is small and moves to an extension when the clinic needs it (call 10) |

## Review focus

The five things the spec implies, no "Done means" line states, and a player or an editor would hit first. Each has
its test in the task named.

1. **A hotspot that cannot be reached** (a locked door between): the walk stops, a line says so, and the pending use is
   dropped; it must not fire later when the door opens. Task 1.
2. **The lamp runs dry in the supply room,** and the paraffin is in the ward: the scene must still be finishable (the
   drawer always has one more bottle). The bot's second route, task 12.
3. **A catch during a cutscene or with the inventory open:** the practice catch must not fire while a cutscene holds
   input, and an open HUD piece closes. Tasks 3 and 12.
4. **A translated line longer than the box at phone size** (Japanese has no spaces; Portuguese runs long): the examine
   box and the objective line wrap inside their declared region and never push a control under 44 px. Tasks 2, 3, 18.
5. **An edit that breaks the scene:** a hotspot deleted in Levels 3D that the puzzle still names must fail
   `automata check` with a sentence naming both, not at play. Task 11.

## File structure

**The framework's additions.** New packages follow `extensions/nav`'s shape (`package.json` with `"private": true`,
`"imports": { "#src/*": "./src/*" }`, `automata.simEntries`, `tsconfig.json`, `vitest.config.ts`, `README.md`).

```
extensions/interact/            @automata/interact (new)
  src/app/interact.extension.ts
  src/shared/sim/{interact.command,interact.event,interact.resource,interact.system,interact.plugin}.ts
  src/shared/sim/{hotspot.schema,hotspots-of}.ts
  src/shared/sim/pending.ts     the pending use and reach; imports no extension (it can move to core later)
  src/shared/use-commands.ts    the two commands a tap sends
  src/entries/{index,sim}.ts    src/testing/pantry.ts
  tests/unit/shared/…
extensions/hud/                 @automata/hud (new)
  src/shared/{hud.schema,hud.content,objective,hud-model}.ts
  src/features/layout/{HudRoot.svelte,place.ts}
  src/features/{objective,prompt,inventory,examine,keypad}/<Piece>.svelte (+ a .ts model each)
  src/app/hud.extension.ts      src/entries/{index,content}.ts
  tests/{unit,browser}/…
extensions/systems/src/shared/sim/{peek,carried-light}.ts (new), pursuit.ts, systems.plugin.ts, systems.schema.ts (modified)
extensions/narrative/src/shared/sim/lines.schema.ts (modified), src/shared/delivery.ts (new),
  src/features/box/{DialogueBox.svelte,dialogue-box.ts,typing.ts} (modified, new), src/entries/index.ts (exports the box)
extensions/editors/src/features/writer/… (delivery field), …/sequence/plan-view.ts (3D walls)
extensions/cutscenes/src/shared/sim/{cutscene.schema,anchors}.ts (modified),
  src/features/stage-3d/cutscene-stage-3d.ts (new), src/entries/stage-3d.ts (new)
extensions/audio-synth/src/features/synth/… (a `steps` table), src/features/steps/step-sounds.ts (new)
extensions/world-kit/src/features/props/ward.ts (new), register-props.ts (modified)
extensions/puzzle/src/shared/sim/puzzle.system.ts (export `applyVerb`), src/entries/sim.ts (and `VerbPayload`);
  a `patch` changeset: `@automata/puzzle` is published
package.json (root: `boundaries`, `style` and the 2D and 3D test filters name the new extensions and the game)
packages/3d/src/features/camera/sim/camera-view.schema.ts (a view's `rooms`), src/features/world/room-draw.ts (new),
  src/features/world/library/lamp-kit.json (`moon`, `fill`)
tooling/repo-hygiene/src/source-names.ts (one entry dropped)
```

**The game,** `games/the-last-light/`. The layers, top to bottom; an import may only go down:

```
main.ts                          the page, at the package root as Emberwick's: imports the no-eval entry, then src/app/game
src/entries/                     re-exports only (the game, its sim), as Emberwick's
src/app/                         wires features: game.ts, scene.plugin.ts, content.ts, controls.ts, flow.ts, play-state.ts
src/features/<feature>/          each owns its code and its data; imports only itself and shared/
src/shared/                      helpers with no feature logic
src/testing/                     the bot, the routes, the solver's model (tests and tools only)
```

These are the framework's own five rules for `src/` (`packages/tools/src/features/boundaries/features.ts`: a feature
imports only itself and `shared/`; `shared/` only itself; only `entries/` and `testing/` import `app/`; `entries/`
re-exports; product code never imports `testing/`). The game is in `pnpm boundaries --features`, and its architecture
test states the same rules (audit 8).

| Feature | Owns | Sim or view | Why it is the game's own |
|---|---|---|---|
| `ada` | The walker: a component, a move command, a walk system, her figure's view | both | Every game writes its own walker (`examples/3d-story` has one) |
| `lamp` | The hand lamp over `@automata/systems`' carried light (task 4): which item lights it, the `fill` call, its numbers, its glow | both | The item and its arithmetic are this game's (T2); the mechanism is the genre's (audit 31) |
| `night` | Lights out: waking the figure, the vigil's clock, her leaving, footsteps as noise | sim | The vigil is this scene's story |
| `catch` | One checkpoint, and what a practice catch does | sim | Call 10 |
| `figure` | The figure's view | view | Her look is the game's |
| `room` | Drawing the level; the table of states (which fact shows which lamp level, door and prop state) | view | T1 |
| `objective` | Reading the HUD file's objective rows against the world (the line and its target) | view | T3: one list, not two ladders |
| `sound` | The music state it fills each frame from the sim (lights out, the figure's mode, hidden, in a cutscene), the core sound aliases of the twelve files, and the step cue by floor | view | T12: core's audio and `@automata/audio-synth` play everything from `content/audio/audio.toml`; only the state the music rules read is the game's (audit 1) |

```
package.json  tsconfig.json  tsconfig.node.json  vite.config.ts  vitest.config.ts  playwright.config.ts  ship.config.ts
index.html  main.ts  README.md  DESIGN.md  PROVENANCE.md  words-sources.json
tools/convert/{convert.ts,level.ts,nav.ts,lines.ts,cutscenes.ts,props-table.ts,report.ts}   (typechecked by tsconfig.node.json)
content/levels/prologue.af-sector.json      content/nav/prologue.toml
content/puzzles/prologue.toml               content/systems/prologue.toml
content/lines/prologue.toml
content/storylets/prologue.toml  content/beats/prologue.toml  content/help/prologue.toml  content/canon/canon.toml
content/cutscenes/prologue.toml             content/hud/play.toml
content/audio/audio.toml   (cues, recorded `sound` aliases, event rows, music slots and rules, the steps table)
content/feel/feel.toml  content/tuning.toml  content/credits.toml  content/fonts.toml
public/sounds/{opening-ward,cabinet-open,lamps-out,pulse-counted,nurse-settle,nurse-move-off,turn-to-sound,nurse-sees,nurse-back-off}.ogg
public/music/{the-last-light,four-seventeen,back-to-bed-ada}.ogg
content/figures/{ada,figure}.toml  content/figure-*/…   content/world-props/…  content/world-swatches/…
content/states/prologue.toml  content/editors.toml
content/messages/{ja,ko,es-419,pt-BR,zh-Hans}.json  content/messages/context.json
messages/ui/{en,ja,ko,es-419,pt-BR,zh-Hans}.json
docs/convert-report.md  docs/dress-notes.md
src/…                            as the layers above
tests/unit/architecture.test.ts
tests/unit/{app,features/<feature>,shared,content,convert,play}/…     mirroring src/
tests/e2e/{playthrough,edits/*,shell/*}.test.ts  tests/e2e/{origin,driver}.ts
```

---

# The framework's additions (tasks 1 to 9b)

Before task 1: the private submodule `vendor/FigureBuilder` is empty in a fresh clone, and `pnpm install` and the
typecheck need it (`vendor/figure-builder`'s `src` and `base` link into it). Attach `mcthaydt/FigureBuilder` read only,
place it at the commit `git submodule status` pins (`d6e3c9fb` at `81ce53a9`), and commit nothing from it (audit 19).
Then `pnpm install`, and `pnpm check` once to learn the baseline; write its result in the tracking table.
These ten tasks use small content of their own (a pantry, a lantern, a watchman), so each extension's tests stand
without the game.

### Task 1: `@automata/interact`: use a hotspot

Survey 16, 21, 35. A game says "use this"; the sim walks there and acts on arrival.

**Files:**
- Create: `extensions/interact/` as in "File structure" (`pnpm-workspace.yaml` globs `extensions/*`, so it needs no
  line); `.changeset/puzzle-apply-verb.md` (`patch`).
- Modify: `extensions/puzzle/src/shared/sim/puzzle.system.ts`, `extensions/puzzle/src/entries/sim.ts` (export
  `applyVerb` and the type `VerbPayload`, which `./sim` does not export today). The root scripts name extensions one by
  one, so each gains `extensions/interact` (audit 6): `boundaries`' sim list (`extensions/interact/src/shared/sim`
  beside `extensions/nav/src/shared/sim`, so law 1 is checked there), `--features`, `--forbid …:effect`; `style`'s
  `--plan-comments` and `--test-imports`; the `test:unit:3d` and `test:browser:3d` filters, and their negations in
  `test:unit:2d`, `test:browser:2d` and `test:browser:affected` (it builds on nav and sectors, which are 3D). `knip.jsonc`
  only if `pnpm knip` asks.
- Test: `extensions/interact/tests/unit/shared/{interact,hotspots-of,use-commands}.test.ts`,
  `extensions/puzzle/tests/unit/shared/apply-verb.test.ts`

**Interfaces:**
- Consumes: `WalkTo`, `NavArrived`, `NavUnreachable` (`@automata/nav/sim`); `VerbCommand`'s `VerbPayload`, `holds`,
  `Reader`, `Cond` (`@automata/puzzle/sim`); `AfSector2`, `AfEntity` (`@automata/3d/level`); `defineExtension`
  (`@automata/framework/extension`).
- Produces:

```ts
// @automata/puzzle/sim (new export): what the puzzle system already does for one `puzzle.verb`, callable by a system.
export function applyVerb(ctx: SimContext, verb: VerbPayload): void

// @automata/interact/sim
export interface Hotspot { readonly id: string; readonly x: number; readonly z: number; readonly reach: number
  readonly name: string            // a message key
  readonly hide?: boolean | undefined
  readonly when?: readonly Cond[] | undefined }     // usable only while every condition holds
export const hotspotSchema: z.ZodType<Hotspot>
/** The level's entities of definition `def` as hotspots; a problem for each one that is not a valid hotspot. */
export function hotspotsOf(level: AfSector2, def?: string /* 'hotspot' */):
  { readonly hotspots: readonly Hotspot[]; readonly problems: readonly string[] }
export const Use: CommandDef       // 'interact.use'     { at: string, held?: string }
export const Combine: CommandDef   // 'interact.combine' { a: string, b: string }
export const EnterCode: CommandDef // 'interact.code'    { code: string }
export const Cancel: CommandDef    // 'interact.cancel'  {}
export const InteractPending: EventDef  // 'interact.pending' { at }
export const InteractRefused: EventDef  // 'interact.refused' { at, reason: 'unknown' | 'unavailable' | 'unreachable' }
export const InteractUsed: EventDef     // 'interact.used'    { at, held?: string, hid: boolean }
export interface InteractOptions {
  /** The player's entity and where it stands, each tick. */
  readonly player: (ctx: SimContext) => { readonly entity: number; readonly x: number; readonly z: number } | undefined
  /** The reader the hotspots' `when` is asked of: the same facts the puzzle reads. */
  readonly reader: (ctx: SimContext) => Reader
  /** Called for a hiding place in place of a verb; the game passes `systems.hide` (task 4). */
  readonly hide?: (ctx: SimContext, spot: string) => void
}
export interface Interact { readonly plugin: PluginDef
  readonly load: (ctx: SimContext, hotspots: readonly Hotspot[]) => void
  /** Hotspots within reach of the player now, nearest first: what the prompt shows. */
  readonly inReach: (ctx: SimContext) => readonly Hotspot[] }
export function createInteract(options: InteractOptions): Interact
// @automata/interact
export function interactExtension(options: InteractOptions): Interact & { readonly extension: ExtensionDef<'interact'> }
/** What a tap on a hotspot sends in one tick: the walk and the use. */
export function useCommands(entity: number, hotspot: Hotspot, held?: string):
  readonly [walk: { entity: number; to: { x: number; z: number } }, use: { at: string; held?: string }]
```

Behaviour: `Use` on an unknown id or one whose `when` fails emits `InteractRefused` and keeps nothing. Otherwise the
use is pending (one at a time; a new `Use`, a `Cancel`, a `NavUnreachable` for the player or the hotspot's `when`
turning false drops it). Each tick, a pending use whose player is within `reach` fires: `options.hide(ctx, id)` when
the hotspot hides and nothing is held, else `applyVerb(ctx, { at, held })`; then `InteractUsed`. `Combine` and
`EnterCode` call `applyVerb` at once with `{ at: 'combine', pair }` and `{ at: 'code', code }`. The extension
`requires: [places provider, 'nav', 'puzzle']`.

- [ ] **Step 1: Write the failing tests** on a small scene of the extension's own in `src/testing/pantry.ts` (two rooms, a door, a
  `jar` hotspot with reach 1.2, a `cupboard` that hides, a `shelf` with `when = [{ fact: 'doorOpen', is: true }]`):

```ts
it('walks, then acts on arrival', () => {            // Use{at:'jar'} + WalkTo; step until NavArrived
  expect(events(InteractUsed)).toEqual([{ at: 'jar', hid: false }]); expect(saidLines()).toEqual(['jar']) })
it('acts at once when already in reach', …)          // one tick, no walk
it('uses a held item', …)                            // applyVerb got { at: 'jar', held: 'spoon' }
it('refuses a hotspot whose condition fails', () => expect(events(InteractRefused)).toEqual([{ at: 'shelf', reason: 'unavailable' }]))
it('drops a pending use it cannot reach, and never fires it later', …)  // Review focus 1: open the door after; step 200 ticks; no InteractUsed
it('a second Use replaces the first', …)
it('hides at a hiding place, and sends no verb', …)
it('gives the same hash for the same commands', …)   // two runs, stateHash equal
it('hotspotsOf reports an entity with no reach', …)
it('useCommands walks to the hotspot and uses it', …)
```

- [ ] **Step 2: Run them and see them fail.** `pnpm --filter @automata/interact test:unit` → fails: no such module.
- [ ] **Step 3: Export `applyVerb` from puzzle** (its test first: a verb applied by a system gives the same
  `puzzle.said` as the same verb as a command), then **implement interact** to the interfaces above.
- [ ] **Step 4: Run.** `pnpm --filter @automata/interact test:unit && pnpm --filter @automata/puzzle test:unit` → pass.
  `pnpm boundaries && pnpm style` → pass.
- [ ] **Step 5: README** (what it is in one paragraph, "Turn it on", "What you get", in the other extensions' voice).
  `@automata/puzzle` is published, so: the `patch` changeset, `pnpm build`, `pnpm api-report --update`,
  `pnpm api-index --write`, and commit what they write (audit 18). `pnpm format`, commit:
  `feat(interact): use a hotspot: walk into reach, then act`

### Task 2: `@automata/hud`: the `hud` file, the objective line and the prompt

Survey 25, 30. The file is the hand-over to the coming UI editor: it holds where each piece sits, how big it may be
and which words it shows.

**Files:**
- Create: `extensions/hud/` (`hud.schema.ts`, `hud.content.ts`, `objective.ts`, `hud-model.ts`,
  `features/layout/{HudRoot.svelte,place.ts}`, `features/objective/Objective.svelte`, `features/prompt/Prompt.svelte`,
  `app/hud.extension.ts`, `entries/{index,content}.ts`, `README.md`)
- Modify: the root scripts, as in task 1 (audit 6): `boundaries --features` and `--forbid …:effect`, `style`'s
  `--plan-comments` and `--test-imports`. It has no sim folder. Its tests run in the 2D filters (it draws DOM, not 3D),
  so it is left out of the `:3d` lists.
- Test: `extensions/hud/tests/unit/shared/{hud-schema,objective,place}.test.ts`,
  `tests/unit/features/{objective,prompt}.test.ts` (DOM), `tests/browser/layout/hud-phone.test.ts`

**Interfaces:**
- Consumes: `Cond`, `holds`, `Reader` (`@automata/puzzle/sim`); `UiComponent` (`@automata/framework/extension`);
  `defineContentSchema` (`@automata/content`).
- Produces:

```ts
export type HudAnchor = 'top-left' | 'top' | 'top-right' | 'left' | 'centre' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right'
export type HudPieceKind = 'objective' | 'prompt' | 'inventory' | 'examine' | 'keypad'
export interface HudPiece { readonly kind: HudPieceKind; readonly anchor: HudAnchor
  readonly width?: number | undefined      // the most it may take, CSS px; the screen's safe width caps it
  readonly words?: Readonly<Record<string, string>> | undefined }   // slot name → message key
export interface ObjectiveRow { readonly when: readonly Cond[]; readonly line: string; readonly target?: string | undefined }
export interface HudFile { readonly pieces: readonly HudPiece[]; readonly objective?: readonly ObjectiveRow[] | undefined }
export const hudSchema: z.ZodType<HudFile>           // a kind may appear once; refused otherwise, in words
export const hudContent: ContentSchemaDef<'hud'>     // folder 'hud', not sim content
/** The first row whose conditions all hold. */
export function chooseObjective(rows: readonly ObjectiveRow[], reader: Reader): ObjectiveRow | undefined
export interface HudModel { readonly objective: string | undefined            // a message key
  readonly prompt: { readonly at: string; readonly name: string } | undefined // name: a message key
  readonly items: readonly { readonly id: string; readonly name: string; readonly text: string }[]
  readonly held: string | undefined
  readonly examine: { readonly title: string | undefined; readonly line: string } | undefined
  readonly keypad: { readonly open: boolean; readonly digits: number }
  readonly locked: boolean }                           // a cutscene holds input: every piece but examine is hidden
export interface HudActions { use(at: string): void; hold(item: string | undefined): void; examineItem(item: string): void
  combine(a: string, b: string): void; code(code: string): void; dismiss(): void }
export interface HudOptions { readonly file: HudFile; readonly words: (key: string) => string | undefined
  readonly model: () => HudModel; readonly actions: HudActions }
/** The whole play HUD as one `hud.overlay` component. */
export function hudSlot(options: HudOptions): UiComponent
```

`place.ts` turns an anchor into the framework's safe-area CSS (it reads core's layout variables; it invents no
breakpoints). The Prompt is a 48 px button showing the nearest hotspot's name; pressing it calls `actions.use`.

- [ ] **Step 1: Failing tests:** the schema refuses two `objective` pieces and an unknown anchor, each in a sentence;
  `chooseObjective` takes the first matching row and returns `undefined` when none match; `Objective` shows the words
  for `model().objective`, shows nothing when it is `undefined` or `locked`, and updates when the model changes;
  `Prompt` is absent with no hotspot in reach and calls `use('jar')` on press, on Enter and on a pad's confirm; the
  browser test mounts both at 390×844 and 844×390 with a 140-character line (Review focus 4) and asserts the line wraps
  inside its piece, the prompt is at least 48 px high, and nothing overlaps the safe area.
- [ ] **Step 2: Run, see them fail.** `pnpm --filter @automata/hud test:unit`
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** unit and `pnpm --filter @automata/hud test:browser` (Chromium) → pass.
- [ ] **Step 5: Commit:** `feat(hud): a play HUD drawn from a file: the objective line and the prompt`

### Task 3: `@automata/hud`: inventory, examine box, keypad

Survey 18, 30. Review focus 3 and 4.

**Files:**
- Create: `extensions/hud/src/features/inventory/{Inventory.svelte,inventory.ts}`,
  `features/examine/Examine.svelte`, `features/keypad/{Keypad.svelte,keypad.ts}`
- Modify: `extensions/narrative/src/entries/index.ts` (export the dialogue box component), `extensions/narrative/README.md`
- Test: `tests/unit/features/{inventory,examine,keypad}.test.ts`, extend `tests/browser/layout/hud-phone.test.ts`

**Interfaces:** consumes task 2's `HudModel`, `HudActions`; narrative's dialogue box component for the examine box's
text (task 5 gives it typing). `dialogueBoxSlot` is not exported today (`extensions/narrative/src/entries/index.ts`),
and `narrativeExtension` puts its own box in `hud.overlay` whenever the game passes it `words`
(`narrative.extension.ts:27-40`). So this task exports the box component from `@automata/narrative`, the `examine`
piece draws it inside its placed region, and a game using the HUD passes no `words` to `narrativeExtension`, so one
box draws, not two (audit 9). The README says so. Produces no other exports; `hudSlot` now draws all five kinds.

Behaviour, each piece keyboard, pad and touch:
- **Inventory:** a row of item buttons (44 px), the held one marked. Press an item: a small sheet with its name, its
  text and three actions: Hold (48 px, primary), Combine (then pick the second item; calls `combine(a, b)`), Close.
  Words for the three actions and the empty state come from the piece's `words` (`hold`, `combine`, `close`, `empty`).
- **Examine:** shows `model().examine`; any press calls `dismiss()`. It is the one piece shown while `locked`.
- **Keypad:** opens when `model().keypad.open`; ten digit buttons (48 px), Delete, Enter; `digits` long; Enter calls
  `code(...)`; Escape and Close call `dismiss()`. Typing digits on a keyboard works.
- When `model().locked` becomes true, an open inventory sheet or keypad closes (Review focus 3).

- [ ] **Step 1: Failing tests** for each bullet above, plus: focus returns to the item after its sheet closes; rotating
  (the browser test resizes 390×844 → 844×390) keeps the sheet open and its focus; every button's box is at least
  44 px, the primary 48 px; a 20-item inventory scrolls inside the piece and nowhere else.
- [ ] **Step 2 to 4:** run, implement, run (unit and browser).
- [ ] **Step 5: Commit:** `feat(hud): inventory, examine box and keypad`

### Task 4: `@automata/systems`: peeking, hide from a system, a re-route on a clock, a carried light that burns fuel

Survey 31, 34, 35, 36. Audit 31: "a lamp that burns fuel" is the spec's own example of a genre extension.

**Files:**
- Create: `extensions/systems/src/shared/sim/peek.ts`, `src/shared/sim/carried-light.ts`; test
  `tests/unit/shared/carried-light.test.ts`
- Modify: `systems.plugin.ts` (the `Systems` object), `pursuit.ts`, `systems.resource.ts`, `systems.schema.ts`,
  `systems.event.ts`, `systems-checks.ts`, `entries/sim.ts`, `README.md`
- Test: `extensions/systems/tests/unit/shared/{peek,hide-from-system,goto-every}.test.ts`

**Interfaces (produced):**

```ts
export interface Systems { /* as today, plus: */
  readonly hide: (ctx: SimContext, spot: string) => void     // what the `systems.hide` command does
  readonly unhide: (ctx: SimContext) => void }
// systems file: an optional block; absent means no peeking
export interface PeekDef { readonly reach: number   // how near the doorway's middle (m); the old game: 1.4
  readonly dwell: number                             // seconds still and facing it; 0.6
  readonly arc: number                               // the most her facing may be off it, degrees; 50
  readonly lean: number                              // the offset's full length (m); 1.2
  readonly ease: number }                            // seconds to reach it; 0.4
// in the pursuit resource, so snapshots and replays carry it
export interface PeekState { readonly portal: string; readonly into: string; readonly t: number; readonly x: number; readonly z: number }
export const SystemsPeek: EventDef   // 'systems.peek' { portal, into, on: boolean }
/** The player's peek now, or undefined. The view gives `x, z` to the play camera's `clampPeek`. */
export function peekOf(ctx: SimContext): PeekState | undefined
// a carried light: a component on the carrier, a command, a burn system, an event; it adds its pool to `env.lights`
export const CarriedLight: ComponentDef     // { lit: boolean, fuelTicks: number, radius: number }
export const ToggleLight: CommandDef        // 'systems.light-toggle' {}: lights only with fuel; refused in words when dry
export const LightDry: EventDef             // 'systems.light-dry' {}: fuel reached 0, the light went out
export function refuel(ctx: SimContext, entity: number, ticks: number, cap: number): void   // a game's refill calls it
// effect: `{ goTo: place, every?: number }`: with `every`, the route is made again each `every` seconds while the mode holds
```

A rule already runs on a clock (`Rule.every`, `extensions/systems/src/shared/sim/systems.schema.ts:64`). Try that first:
a rule `every = <replan>` whose `when` is the agent's hunting mode and whose `then` is `goTo = "player"`. Add `every` to
the `goTo` effect only if a rule cannot say it (a rule has no agent subject of its own, for one), and write which in this
plan's log (audit 25).

Rules, from the old game's behaviour (read `src/game/peek.ts` in the game's repository for the cases, write new): a peek starts
when the player is not moving, within `reach` of the middle of a doorway from her room into a room with a different
`zone`, facing it within `arc`, for `dwell` seconds; a doorway whose nav door is shut cannot be peeked; moving, turning
away, hiding or any verb (`puzzle.said`) ends it; the offset grows from 0 to `lean` over `ease` and points across the
doorway. `env` (`SystemsEnvValue`: `player`, the player's entity, `moving`, `lights`, `warmth`) gains `facing`
(radians) so the rule can read it; the player's point is read from the entity, as the other probes do; the game sets
`facing` each step (audit 26).

- [ ] **Step 1: Failing tests** on the extension's toy ward (`src/testing/ward-scene.ts`): stands still facing the
  doorway for 0.6 s → `SystemsPeek { on: true }` and `peekOf(ctx).x/z` reach length 1.2 after 0.4 s more; moving ends
  it with `on: false`; facing 60° off never starts; a shut door never starts; a snapshot taken mid-peek restores the
  same `t`; `systems.hide(ctx, 'cupboard')` from a system equals the `Hide` command (same hash); an agent with
  `goTo = "player", every = 0.4` follows a player who moves after the first route, and one without `every` walks to
  where she was; `systems-checks` reports a `peek` block with a negative number, in words.
  The carried light: lit, it burns one tick of fuel a tick and goes out at 0 with one `LightDry`; `ToggleLight`
  with no fuel does nothing; `refuel` caps at `cap`; while lit its pool is in `env.lights` at its radius, so an agent
  with `refuses` will not step into it (the existing light sense); two runs give the same hash.
- [ ] **Step 2 to 4:** run (`pnpm --filter @automata/systems test:unit`), implement, run. The extension's golden hash
  for existing scenes must not move (no existing scene has a `peek` block or `every`); if it moves, stop and find why.
- [ ] **Step 5: Commit:** `feat(systems): peeking, hide from a system, a route on a clock, a carried light that burns fuel`

### Task 5: `@automata/narrative`: delivery on a line, typed out; Writer's field

Survey 41; the game's ledger, gap 72.

**Files:**
- Create: `extensions/narrative/src/shared/delivery.ts`, `src/features/box/typing.ts`
- Modify: `src/shared/sim/lines.schema.ts`, `src/features/box/{DialogueBox.svelte,dialogue-box.ts}`,
  `src/entries/{index,content}.ts`, `README.md`; `extensions/cutscenes/src/features/caption/{Caption.svelte,caption.ts}`
  (captions type the same way); `extensions/editors/src/features/writer/{WriterLines.svelte,writer-model.ts}`
- Test: `extensions/narrative/tests/unit/shared/delivery.test.ts`, `tests/unit/features/typing.test.ts`,
  `extensions/editors/tests/unit/writer/delivery-field.test.ts`

**Interfaces (produced):**

```ts
// on a line record, optional; absent means said plainly
export interface Delivery { readonly how?: string | undefined     // a direction for the writer; never shown
  readonly pace?: number | undefined                               // 1 is normal; above is faster
  readonly beats?: readonly Beat[] | undefined }                   // pauses and emphasis, by sentence, not by character
export interface Beat { readonly after: number                     // the sentence it follows, counted from 1
  readonly pause: number }                                          // in beats: 1 is short, 2 long
/** Sentences of `words`, split the same way for every language: on `.`, `!`, `?`, `。`, `！`, `？` and line breaks. */
export function sentences(words: string): readonly string[]
/** What to show `seconds` into a line: how many characters, and whether it is done. `rate` is characters a second. */
export function typed(words: string, delivery: Delivery | undefined, seconds: number, rate: number):
  { readonly shown: number; readonly done: boolean }
```

Why by sentence: the game's old code marks pauses inside the English words (`{.}`), which a translation would have to carry.
Counting sentences keeps the translated words plain text, so `automata words` and its placeholder check need nothing
new. A pause the old game put inside a sentence moves to the sentence's end; the converter reports each one (task 11).
The old delivery also marks emphasis inside the words (`*not*`, `_not._`, `<ref>/src/scenes/prologue/delivery.ts`).
Emphasis is not carried, for the same reason (it would put marks into the translated words); the converter reports
each one as `approximated` (audit 10). `{.}` is a beat of 1 and `{..}` a beat of 2.
The box types at `rate × pace`, stops for `pause × 0.35 s` after a marked sentence, shows everything at once under
reduced motion, and a press completes the line before it dismisses it. The clock is injected.

- [ ] **Step 1: Failing tests:** `sentences` on English, Japanese (`。`) and a two-line note; `typed` reaches the end
  of sentence 1 and holds for the pause, then goes on; `pace = 2` halves the time; reduced motion shows all at 0 s; a
  delivery whose `after` is past the last sentence is a content problem naming the line; Writer shows How, Pace and the
  pauses for the chosen line, and an edit writes `delivery` into the lines file as one undo step.
- [ ] **Step 2 to 4:** run (`pnpm --filter @automata/narrative test:unit`, `--filter @automata/cutscenes`,
  `--filter @automata/editors`), implement, run.
- [ ] **Step 5: Commit:** `feat(narrative): how a line is said, typed out in the box and the caption; Writer edits it`

### Task 6: `@automata/cutscenes`: a camera key at an anchor, a 3D stage

Survey 45, 46.

**Files:**
- Create: `extensions/cutscenes/src/features/stage-3d/cutscene-stage-3d.ts`, `src/entries/stage-3d.ts`
- Modify: `src/shared/sim/{cutscene.schema,anchors}.ts`, `src/shared/lint.ts`, `package.json` (`exports`), `README.md`;
  `src/testing/door-and-lamp.ts` (new: a room with a door and a lamp, the extension's own; the spec cuts
  `examples/3d`, so the stage is not wired into `examples/3d/cutscenes/` and no test leans on it, audit 30)
- Test: `extensions/cutscenes/tests/unit/shared/camera-anchor.test.ts`, `tests/browser/stage-3d.test.ts`

**Interfaces (produced):**

```ts
// CameraKey gains: the key's `pos` and `look` are offsets from this anchor's point on the floor
readonly about?: string | undefined
// placeScript resolves camera anchors as it does actors'; `anchorsOf` lists both. PlacedScript's camera has no `about`.
// @automata/cutscenes/stage-3d
export interface CutsceneStage3dOptions {
  readonly camera: { set(pose: { pos: V3; look: V3; lens: number }): void; release(): void }   // the game's play camera hands over
  readonly pieces: (states: PieceStates) => void          // doors, props and lamp levels: `updatePieces` and the light
  readonly actor: (who: string) => ActorView | undefined  // 'player', an agent's id
  readonly fade: (value: number) => void                  // 0 clear, 1 black
  readonly sound?: (kind: string) => void }
export interface ActorView { place(at: { x: number; z: number; y?: number }, facing: number): void
  pose(name: string | undefined, moving: boolean): void; alpha(value: number): void
  clip(name: string, at: number): void }   // the director's `startClip` for a script's `clips` rows (audit 24)
export interface CutsceneStage3d { start(script: PlacedScript): void; draw(seconds: number): void; end(): void; readonly playing: boolean }
export function cutsceneStage3d(options: CutsceneStage3dOptions): CutsceneStage3d
```

The stage asks `createDirector(script, startClip).stateAt(seconds)` (`director.ts:38`; `startClip` calls the actor's
`clip`) and hands each part to the option that owns it. It holds no
time of its own: the caller passes the sim's cutscene clock, so a replay draws the same frames. `end()` releases the
camera and restores the piece states the scene had at the start, less what the script's last keys set.

- [ ] **Step 1: Failing tests:** a camera key `about = "player"` with `pos = [1, 2, 0]` resolves to the player's
  point plus the offset; an unknown camera anchor makes `placeScript` answer `{ ok: false, missing }`; the lint names a
  camera anchor the scene cannot resolve; a stage given fakes calls `camera.set` with the director's pose at 0, 3 and 6
  s, sets the lamp level and the door, places an actor and plays a sound key once even when `draw` is called twice in
  the same tick; `end()` calls `camera.release()`; the browser test draws `src/testing/door-and-lamp.ts` through the
  stage for its 6 s with an injected clock and reads the door open and the lamp at level 1 from the scene.
- [ ] **Step 2 to 4:** run (`pnpm --filter @automata/cutscenes test:unit` and its browser suite), implement, run. The four converted-scene tests in this extension must still pass unchanged.
- [ ] **Step 5: Commit:** `feat(cutscenes): a camera key at an anchor, and a 3D stage that draws a script`

### Task 7: `@automata/audio-synth`: footsteps by floor

Survey 50.

**Files:**
- Create: `extensions/audio-synth/src/features/steps/step-sounds.ts`
- Modify: the audio schema file under `src/features/synth/` (an optional `steps` table), `src/entries/index.ts`,
  `README.md`; `extensions/editors/src/features/audio/` only if the Audio editor refuses an unknown table (then it
  shows `steps` as rows of floor → cue)
- Test: `extensions/audio-synth/tests/unit/features/step-sounds.test.ts`

**Interfaces (produced):**

```ts
// audio.toml:  [steps]  default = "step"   [steps.floors]  tile = "stepTile"   carpet = "stepSoft"
export interface StepsTable { readonly default: string; readonly floors?: Readonly<Record<string, string>> | undefined }
/** The cue for a step on `floor` (a sector's `floorTexture`); the default when the table has no row for it. */
export function stepCue(table: StepsTable | undefined, floor: string | undefined): string | undefined
```

The game's view plays `stepCue(...)` when it hears its own step event; the synth and the sim are unchanged.

- [ ] **Step 1: Failing tests:** a floor with a row gives its cue; one without gives the default; no table gives
  `undefined`; a `steps` cue the file does not define is a content problem naming the floor and the cue.
- [ ] **Step 2 to 4:** run, implement, run. `pnpm build`, `pnpm api-report --update`, `pnpm api-index --write`
  (published package), and a `patch` changeset.
- [ ] **Step 5: Commit:** `feat(audio-synth): a step sound chosen by the floor`

### Task 8: Sequence: the preview over a 3D level

Survey, editors table; the game's ledger, gap 36.

**Files:**
- Modify: `extensions/editors/src/features/sequence/{plan-view.ts,sequence-session.svelte.ts,sequence-names.ts}`
- Test: `extensions/editors/tests/unit/sequence/plan-view-3d.test.ts`, extend the Sequence journey
  `extensions/editors/tests/e2e/journeys/sequence-shows-in-game.test.ts` (audit 28)

**Interfaces:** consumes `readLevel`, `AfSector2` (`@automata/3d/level`). Produces:

```ts
/** The walls of a level file as plan segments, in metres: a 2D level's solid cells, or a 3D level's sector edges that are not portals. */
export function levelWalls(text: string, path: string): { readonly walls: readonly Segment[] } | { readonly problem: string }
/** Names a 3D level offers a script: its lamps, doors, props and hotspot things, for the key fields' pickers. */
```

`sequence-names.ts` reads lamps, sector doors, props and things from an `af-sector/2` file so the Light, Doors, Props
and Actor-at pickers offer the level's own names. `@automata/editors` may import `@automata/3d/level` (Zod only, a sim
entry); if `pnpm boundaries` refuses the import, stop and report rather than copying the reader.

- [ ] **Step 1: Failing tests:** a three-room `af-sector/2` fixture of the editors' own (not `examples/3d-story`'s hall, which the spec cuts) gives one
  segment per solid wall and none across a portal; a wall with a door gives two segments either side of it; an
  `af2d` level gives what it gives today (the existing test, unchanged); a file that is neither says so in a sentence;
  the names include the level's lamp and door ids.
- [ ] **Step 2 to 4:** run (`pnpm --filter @automata/editors test:unit`), implement, run, and the editors' browser
  suite for Sequence.
- [ ] **Step 5: Commit:** `feat(editors): Sequence previews a cutscene over a 3D level`

### Task 9: `@automata/world-kit`: nine prop generators

Survey 11. Generic ward and workplace furniture, usable by any game.

**Files:**
- Create: `extensions/world-kit/src/features/props/ward.ts`
- Modify: `register-props.ts`, the kit's preset library and swatches where a new kind needs a default, `README.md`
- Test: `extensions/world-kit/tests/unit/props/ward.test.ts`; the kit's existing reads and golden tests

**Interfaces (produced):** nine generator kinds registered with `registerPropGenerator`, each taking `with` parameters
with defaults and returning the kit's part meshes: `sink` (`width`), `trolley` (`shelves`), `wheelchair`, `gurney`
(`length`), `monitorCart` (`on: boolean`, a lit screen when on), `wallClock` (`hour`, `minute`), `keyCabinet`
(`open: boolean`, a keypad face), `locker` (`doors`, `open: boolean`), `dripStand`. Each has a footprint the level's
collider reads, as the kit's other furniture does.

- [ ] **Step 1: Failing tests,** one block per kind: it is registered; the same parameters give the same mesh
  (vertex count and bounds equal across two calls); its bounds are within 5% of its documented size; `open: true`
  changes the mesh for `keyCabinet` and `locker`; the clock's hands differ between 8:00 and 4:17; the kit's reads check
  (`check-reads.ts`) passes for each in the base interior.
- [ ] **Step 2 to 4:** run (`pnpm --filter @automata/world-kit test:unit`), implement, run. **Look at each prop:**
  render the nine in the base interior in a browser test of the kit's own that writes a picture to `test-results/`
  (not `examples/3d/worldkit/`, which the spec cuts; audit 30), open the picture
  and say in the commit body what each looks like and what is weak. A picture is evidence of shape only.
- [ ] **Step 5:** `@automata/world-kit` is private, so no changeset and no API report (audit 27). Commit: `feat(world-kit): a sink, trolley, wheelchair, gurney, monitor cart, wall clock, key cabinet, locker and drip stand`

### Task 9b: `@automata/3d`: the rooms a view draws; two lamp kinds

Survey 2 and 5, both settled by reading. Call 12.

**Files:**
- Create: `packages/3d/src/features/world/room-draw.ts`
- Modify: `packages/3d/src/features/camera/sim/camera-view.schema.ts` (a view's optional `rooms`),
  `src/features/camera/sim/view-zone.ts` or the renderer file that changes the active view (it tells the world which
  rooms to show), `src/features/world/build.ts` only if rooms are not yet separate meshes,
  `src/features/world/library/lamp-kit.json`, `src/entries/index.ts`; `packages/editor-3d` so Levels 3D's view card
  lists and edits `rooms`; `docs/guides/` where camera views are described
- Test: `packages/3d/tests/unit/world/room-draw.test.ts`, `tests/unit/camera/view-rooms.test.ts`,
  `tests/unit/world/lamp-kit.test.ts`, a browser test beside the existing occluder ones

**Interfaces (produced):**

```ts
// a camera view, in a level's `views`: the sectors drawn while this view is active; absent means every room
readonly rooms?: readonly string[] | undefined
/** Which sectors and masses are drawn for a view. A mass is drawn when any sector it touches is. */
export function drawnRooms(level: AfSector2, view: string | undefined):
  { readonly sectors: ReadonlySet<string>; readonly masses: ReadonlySet<number> }
// lamp-kit.json gains two kinds: `moon` (a cool, soft light through a window, no fitting drawn) and `fill` (a soft
// light with no fitting and no glow), each with the kit's fields
```

- [ ] **Step 1: Read first.** Read `features/world/build.ts`, `sectors.ts` and `occluders.ts` to learn whether each
  sector is its own mesh group. Write what was found in this plan's log. If a room cannot be hidden without rebuilding
  the world, the task first splits the build by sector, with the existing world goldens unchanged.
- [ ] **Step 2: Failing tests** on a three-room level of the package's own: a view with `rooms = ["a", "b"]` draws
  those two and not the third; a view with no `rooms` draws all three; a mass between `a` and `c` is drawn when either
  is; a view that names a room the level lacks is a level problem in words; changing the active view from one to the
  other shows and hides the right groups in one frame (the browser test); `moon` and `fill` parse and light a floor.
- [ ] **Step 3 and 4:** implement, run (`pnpm --filter @automata/3d test:unit`, its browser suite). No existing
  golden picture or hash may move: no existing level has `rooms`.
- [ ] **Step 5: Commit:** `feat(3d): a camera view names the rooms it draws; moon and fill lamps`

---

# The game (tasks 10a to 18)

The game's own repository is attached read only, at `92e6704`. Read its `AGENTS.md` and `docs/design/camera-rules.md`
before task 10. `<ref>` below is the path of that checkout.

### Task 10a: The name rule: The Last Light is no longer a source game

Call 2. Its own early task, the hygiene test changed first.

**Files:**
- Modify: `tooling/repo-hygiene/tests/unit/source-names*.test.ts` (first), `tooling/repo-hygiene/src/source-names.ts`
  (drop the entry whose sample is "The Last Light"), `docs/provenance/sources.md` (one paragraph: since 2026-11-11 The
  Last Light is the framework's 3D reference game at `games/the-last-light`, so its name is no longer withheld; the
  rows that record what was taken from it stay; the other sources are still named nowhere else)

The entry for the game's repository name (`pixijs3d[\s_-]?experiment`) stays: the old repository is still a source
the framework does not name; only the game's title is freed. `PROVENANCE.md` may name it, because a game's Markdown is
not a scanned surface, but no `.ts`, `.toml` or `.json` file under the game may (task 10 adds the game to `--code`).

- [ ] **Step 1: Change the test first:** a file that names The Last Light gives no finding; a file that names each
  of the other sources still gives one; the entry numbers the findings print are still stable for the others (if they
  shift, the test says which changed and the message format keeps naming the entry, never the name).
- [ ] **Step 2: Run it and see it fail;** drop the entry; run `pnpm --filter @automata/repo-hygiene test:unit` (or the
  package's own name) and `pnpm source-names` → pass.
- [ ] **Step 3: Commit:** `chore(hygiene): The Last Light is the 3D reference game, so its name is no longer withheld`

### Task 10: The game package by feature: the layer test, provenance, a blank room that boots

Spec: "Where the game lives", "A refactor, not a transcription" (T13). Call 1.

**Files:**
- Create: `games/the-last-light/{package.json,tsconfig.json,tsconfig.node.json,vite.config.ts,vitest.config.ts,ship.config.ts,index.html,main.ts,README.md,DESIGN.md,PROVENANCE.md}`,
  `src/app/game.ts`, `src/entries/{index,game,sim}.ts`, `content/editors.toml`, `content/levels/blank.af-sector.json`
  (one square room, removed in task 11), `tests/unit/architecture.test.ts`, `tests/unit/app/boots.test.ts`
- Modify: root `package.json`, every list that names Emberwick's or Ember Hall's folder gains the new game's (audit 6):
  `boundaries`' `--game` (its `src`), `--features` and `--forbid …:effect` (not `--no-extension-imports`: the game uses
  extensions); `style`'s `--plan-comments` and `--test-imports`; `source-names`' `--code` (and its pinned string in
  `tooling/repo-hygiene/tests/unit/source-names-wired.test.ts`); the `test:unit:3d` and `test:browser:3d` filters and
  their negations in the `:2d` and `:affected` scripts. `.github/workflows/3d.yml`: its `pull_request` paths gain
  `games/the-last-light/**`, so the second branch's pull request starts the 3D workflow (audit 14;
  `workflow-invariants.test.ts` pins the paths with `arrayContaining`, so it stays green)

**Interfaces:**
- Consumes: `games/emberwick` as the pattern for a game package's files; `defineGame`, `render3dExtension`,
  `targetSize`, `DEFAULT_LOOK`.
- Produces: `pnpm --filter @af-games/the-last-light {dev,build,typecheck,test:unit,test:e2e}`; `game` exported from
  `src/app/game.ts` (`id: 'the-last-light'`, `title: 'The Last Light'`, `orientation: 'landscape'`,
  `size: targetSize({ width: 844, height: 390 }, DEFAULT_LOOK.pixel.short)`); and the layer rule as a test:

```ts
// tests/unit/architecture.test.ts: reads every file under src/ and tests/ and its imports; the same five rules as
// `pnpm boundaries --features` (audit 8), so the two cannot disagree
it('only entries/ and testing/ import app/; app imports features and shared; shared imports only shared', …)
it('a feature imports only itself and shared', …)                         // features/lamp may not import features/night
it('entries/ only re-exports, and product code never imports testing/', …)
it('no test sits beside the source', () => expect(glob('src/**/*.test.ts')).toEqual([]))
it('every folder under tests/unit names a folder under src, or is content, convert or play', …)
it('a test reaches the source as #src/…, never by a relative path', …)
it('nothing under src/ imports from tools/ or from outside the package by a relative path', …)
```

`main.ts` sits at the package root, as Emberwick's does, and imports `src/app/game.ts` after the no-eval entry; it is
outside `src/`, so the layer rules do not apply to it.

`PROVENANCE.md` starts with three sections: what was made here (everything, unless listed), what came from the
game's own repository as content (the story, the puzzle, the scene's layout: the Owner's own work, MIT by the Owner's
word of 2026-11-11), and outside assets (the twelve recorded files in task 14, the font in task 18).
`DESIGN.md` carries the game's design rules this plan's constraints quote, so they live with the game.

- [ ] **Step 1: Write the failing tests:** the architecture test above, and `boots.test.ts` (the sim steps a blank
  room 60 ticks and gives the same hash twice; the package's `automata.title` is "The Last Light").
- [ ] **Step 2: Run and see them fail:** `pnpm --filter @af-games/the-last-light test:unit` → no such package.
- [ ] **Step 3: Write the package to pass, with `render3dExtension`,
  `sectorsExtension` and the default screens.
- [ ] **Step 4: Run:** the game's unit tests, `pnpm --filter @af-games/the-last-light build`, `pnpm source-names`,
  `pnpm boundaries`, `pnpm style`. Open the dev page in headless Chromium: `data-state="ready"`, no page error.
- [ ] **Step 5: Commit:** `feat(the-last-light): the 3D reference game's package, by feature, with a blank room that boots`

### Task 11: The converter, and the content from October's fixtures; the content checks; the puzzle can be finished

Spec step 1. Calls 3 to 6. Survey 1 to 13, 17 to 28, 40 to 47; T4, T7, T8, T9, T10. Review focus 5.

**Files:**
- Create: `games/the-last-light/tools/convert/` (as in "File structure"), everything under `content/` except the
  figures, props' looks, audio, feel, HUD and messages (later tasks), `docs/convert-report.md`,
  `src/testing/solver-model.ts`, `tests/unit/convert/*.test.ts`, `tests/unit/content/{words,checks,solver,cutscene-marks,screenplay,calls}.test.ts`,
  `messages/ui/en.json` (the hotspots' names, audit 11). The fixture's dialogue file holds no conversation
  (`prologue.dialogue.toml`: `graphs = []`), so no `content/dialogue/` is written (audit 16).
- Delete: `content/levels/blank.af-sector.json`
- Modify: `content/editors.toml` (a row per kind, as `examples/3d-story` and `examples/2d-story` have them:
  `levels-3d`, `studio`, `tuner`, `schematic` for systems, nav and puzzles, `writer` for lines,
  `sequence` for cutscenes, `audio`, `feel`)

**Interfaces (produced):**

```ts
export interface Unexpressed { readonly kind: string        // 'wall-member' | 'lamp-kind' | 'prop' | 'cutscene' | 'delivery' | 'bounce' | …
  readonly where: string; readonly what: string; readonly did: 'dropped' | 'approximated' | 'left-for-hand' }
export interface Converted { readonly files: Readonly<Record<string, string>>   // path under content/ → text
  readonly report: readonly Unexpressed[] }
export function convertLevel(blockout: unknown, props: readonly PlacedModel[]): Converted   // af-sector/2: sectors, masses, lamps, things, views, props
export function convertNav(blockout: unknown): Converted                                     // nodes, edges, the door on an edge
export function joinWords(lines: string, locale: string, delivery: OldDelivery | undefined): Converted   // each line gets `words`, and `delivery` where it has one
export function restageCutscenes(cutscenes: string, marks: Readonly<Record<string, { x: number; z: number }>>): Converted
export function rewriteCalls(systems: string): Converted     // chase → goTo player (every = the replan number); fleeGoal → flee light
export function convert(options: { readonly fixtures: string; readonly reference?: string }): Converted
// CLI: node tools/convert/convert.ts [--reference <ref>] [--write] [--force]   without --write it prints the report only
```

Rules:
- **Words are bytes.** A line's `words` is the fixture's text, unchanged. A pause the old delivery put inside a
  sentence moves to the sentence's end and is reported (`delivery`, `approximated`); so is each emphasis mark (task 5).
- **Headers** (audit 23): each copied file's "converted once … Do not edit" header is replaced by one saying where it
  came from (the game's prologue at `92e6704`, through October's fixture) and that this file is now the source, edited
  by hand and in the editors. The extensions' own fixtures are not touched.
- **Hotspot names** (audit 11): each hotspot's `name` becomes the key `hotspot.<id>`, and its English name (from the
  blockout, as written) goes into `messages/ui/en.json`; task 18 translates them.
- **Message keys keep the old line ids** (`prologue.handover`), so the hints, beats and the screenplay tool keep working.
- **Hotspots** (T4): act one's three that the prologue hides (`scratches`, `scrawl`, `puddle`) are not written;
  `shelf` and `locker` get `when = [{ fact: 'closetOpen', is: true }]`; `locker` and `screen` get `hide = true`. The
  solver's model reads the same `when`, so the rule is in one place.
- **Camera** (T9): each sector gets a `view`; the three views carry the old zones' numbers (`look`, `distance`, `x`,
  `follow`, `depthFollow`); `figureFill` is dropped and reported.
- **Props:** `props-table.ts` maps each old model to a generator; a model with no generator is reported and written
  as a plain box of its size, so no collider is ever missing.
- **Cutscenes** (T10, call 5): `opening`, `lightsOut` and `rest` get a mark and keep every caption's line, start and
  end. The marks: the spawn for `opening`; for `lightsOut` and `rest`, the spot the old `bedside()` falls back to,
  `(-2.9, 0.7)`, which is not the nav node of the same name at `(-2.9, 2.45)` (audit 29). `found`'s first shot gets
  `about = "player"`, Ada's keys stand `at = "player"`, and the figure stands at her own anchor (`actor:npc`, where
  she caught Ada): the old step to 0.9 m beside Ada (`moved`, `clearSpot`, `sees`) and the lens fitted to distance
  (`fit`) are dropped and reported, since an actor key cannot stand at an offset from an anchor (audit 17).
- **Systems** (T7): the fixture's numbers are already literals. Every call it names gets a fate, and the report lists
  each (audit 7): `chase` becomes `goTo = "player"`; `replan` becomes the clock of task 4 (a rule's `every`, or
  `goTo`'s); `fleeGoal` becomes `flee = "light"`; `stop`, `leave`, `wake` and `vigil` stay calls, answered by the
  night feature's `nightHooks` (task 12); rule R15 and its `burnLight` are dropped, because the lamp feature burns its
  own fuel (T2), and any condition on the old fact `light` becomes `lit`; the `footsteps` rule is dropped, because the
  night feature's steps system calls `systems.hear` (survey 32).

- [ ] **Step 1: Failing tests for the converter,** each on a tiny hand-written input: a two-sector blockout with a
  portal and a door becomes a level `readLevel` accepts; a wall's `hideFrom` is dropped and reported; a hotspot with
  `hide: true` becomes a thing with `hide = true`; `joinWords` gives byte-equal words; `{.}` inside a sentence is
  reported; `{ call = "chase" }` becomes `goTo = "player"`; without `--write` nothing is written; with content present
  and no `--force` it refuses.
- [ ] **Step 2: Failing tests for the content:**

```ts
it('every line says exactly what the fixture says', () => {
  for (const [id, text] of Object.entries(FIXTURE_LOCALE)) expect(wordsOf(id), id).toBe(text) })
it('the puzzle can be finished', () => expect(solve(puzzle, MODEL).routes.length).toBeGreaterThan(0))
it('every hotspot the puzzle names is in the level, and the check says so when one is not', () => {
  expect(check(content)).toEqual([])
  expect(check(without(content, 'nightstand'))[0]).toMatch(/nightstand.*puzzle.*level/) })    // Review focus 5
it.each(['opening', 'lightsOut', 'rest'])('%s on a mark keeps each line, its timing and what it names', (id) => {
  expect(captions(now(id))).toEqual(captions(fixture(id)))      // line ids, start and end, in order
  expect(namedThings(now(id))).toEqual(namedThings(fixture(id))) })   // lamps, doors, props and sounds the script keys
it('found keeps its line and its timing', …)                      // the same caption check, for the restaged fourth
it('the systems file calls only the four hooks the night feature answers', () =>   // audit 7; task 12 answers them
  expect(callsOf(systems)).toEqual(['leave', 'stop', 'vigil', 'wake']))
it('every hotspot has its name in messages/ui/en.json', …)        // audit 11
it('the cutscenes pass the lint against the level', () => expect(lintAll()).toEqual([]))
it('the hints and beats pass the narrative lint; the screenplay holds every line once', …)
```

- [ ] **Step 3: Run them, see them fail.** Then run the converter once: `node tools/convert/convert.ts --reference
  <ref> --write`. Commit its output unedited (`feat(the-last-light): the prologue's content, from October's fixtures`),
  then fix by hand what the report marks `left-for-hand` in following commits, so the diff shows what a person changed.
- [ ] **Step 4: Run** the tests and `pnpm --filter @af-games/the-last-light exec automata check`. A check the content
  compiler fails on is fixed in the content; if the framework is wrong, it is fixed in the framework with its test.
- [ ] **Step 5: Write `docs/convert-report.md`:** every `Unexpressed` row and what was done about it. Commit:
  `docs(the-last-light): what the converter could not express, and what was done`

### Task 12: The game's own sim features; a bot finishes the scene in Node, twice, same hash

Spec steps 2 and 4. Survey 15, 19, 20, 24, 31 to 33, 37, 39. T2, T5, T6, T14. Review focus 2 and 3.

**Files:**
- Create: `src/features/ada/{ada.component,move.command,walk.system,ada.plugin}.ts`,
  `src/features/lamp/{lamp-controls,lamp.plugin,lamp-facts,fill}.ts` (the mechanism is task 4's carried light),
  `src/features/night/{vigil.resource,vigil.system,night-hooks,steps.system,night.plugin}.ts`,
  `src/features/catch/{checkpoint.resource,catch.event,catch.system,catch.plugin}.ts`,
  `src/shared/{constants,tuning}.ts`, `src/app/{scene.plugin,content}.ts`, `src/testing/{bot,route}.ts`,
  `tests/unit/features/{ada,lamp,night,catch}/*.test.ts`, `tests/unit/play/{route,second-route,fair}.test.ts`
- Modify: `src/app/game.ts` (the extensions, in order: `render3dExtension`, `sectorsExtension`, `navExtension`,
  `puzzleExtension({ extensions: ['systems', 'narrative'], calls, facts })`, `systems.extension`,
  `narrative.extension` (given no `words`: the HUD's examine piece draws the box, audit 9), `cutscenes.extension`,
  `interact.extension`)

**Interfaces (produced, the game's):**

```ts
// lamp (T2: a lamp, not a lighter in disguise), over `@automata/systems`' carried light (task 4, audit 31).
// Fuel is whole ticks, so the hash is exact.
export function fillLamp(ctx: SimContext): void          // the puzzle's `fill` call: `refuel` by the tuned fill, cap twice it, and lit
export const lampControls: …                             // F and the pad's north send `ToggleLight` once Ada holds `handLamp`
export const lampFacts: PuzzleOptions['facts']           // T6: only `lit` and `fuel` are mapped; the rest are the puzzle's own
// night
export const nightHooks: SystemsOptions['hooks']         // wake, vigil, leave, stop (audit 7); resetFor as a plain function (T14)
// catch
export const Checkpoint: ResourceDef       // the snapshot kept at `puzzle.checkpoint` and at lights out
export const PracticeCatch: EventDef       // 'catch.practice' {}
// testing
export interface BotResult { readonly finished: boolean; readonly ticks: number; readonly hash: string; readonly caught: number }
export function playRoute(route: readonly BotStep[], seed: number): BotResult
```

Rules, from the old behaviour (read `<ref>/src/scenes/prologue/rules.ts`, `src/game/tools.ts` and the old tests for
the cases; write new):
- The carried light (task 4) burns the fuel; the game says when it may be lit: `ToggleLight` is sent only once Ada
  holds `handLamp`; on `LightDry` Ada says `prologue.lighterEmpty` (the old line for the lamp guttering out), and on a
  toggle refused for want of fuel, `prologue.lampDry`, as the old game did.
- Each step the game gives systems `env.lights`: the lamp's pool at the tuned radius when lit, and the four room
  lamps until lights out; and the player's facing, for peeking.
- The tuned numbers (the fill, the lamp radius, the walk speed, the step interval) are in `content/tuning.toml` and
  the systems file, read through the sim's content each sim (T5: no module-level state), so the Tuner and Schematic
  edit them.
- A practice catch (`systems.caught` with cause `practice`) is ignored while a cutscene holds input; otherwise it
  starts `found` and, when that ends, restores `Checkpoint` and puts the figure at the node farthest from Ada.

- [ ] **Step 1: Failing tests,** smallest first: the lamp lit for its fill goes out and fires `LightDry` once; toggling
  with no lamp does nothing; two fills cap at twice the fill; `lampFacts` reads `lit`; every call the systems file
  names is a key of `nightHooks` (audit 7); two sims with different tuning
  differ (T5); the vigil is over after its tuned seconds unless she hunts; a catch during a cutscene does nothing
  (Review focus 3); a catch in play restores the checkpoint's facts and items. Then the routes:

```ts
it('the bot finishes the prologue from its first cutscene to its end', () => {
  const run = playRoute(ROUTE, 1); expect(run.finished).toBe(true); expect(run.caught).toBe(0) })
it('twice, the same hash', () => expect(playRoute(ROUTE, 1).hash).toBe(playRoute(ROUTE, 1).hash))
it('letting the lamp run dry in the supply room can still be finished', …)     // Review focus 2
it('a cautious bot is never caught in 20 seeds; the fairness targets of the systems file hold', …)
```

`ROUTE` is the old solver's order: the note, its back, the lamp, the paraffin, fill, the register, the cabinet and the
code `2000`, the supply door, the shelf, the bed with the sheets, hide behind the screen until she has gone, the bed.
The bot sends the commands a player's input sends (`useCommands`, `Combine`, `EnterCode`, `ToggleLight`,
`CutsceneSkip`), never a private door into the sim.

- [ ] **Step 2 to 4:** run (`pnpm --filter @af-games/the-last-light test:unit`), implement, run; `pnpm boundaries`.
  A hash that differs between two runs is a bug to find, never to re-record.
- [ ] **Step 5: Commit:** `feat(the-last-light): the lamp, the vigil and the practice catch; a bot finishes the prologue`

### Task 13: Dress it: props, lamps, Ada and the figure, poses

Spec step 3. Survey 5, 6, 11 to 14, 47. T1. No paid stage; no old art.

**Starts when workstream 4 says the prologue's dressing can start** (its spec,
[`2026-11-11-builders-look-and-figures-design.md`](../specs/2026-11-11-builders-look-and-figures-design.md), "Done
means" line 4: the lit room healthy, figures lit as sprites, and the wardrobe the reference game needs). The framework
tasks 1 to 9b and the game's tasks 10 to 12 do not wait for it (its call 2). Ada's street clothes, a ward nurse's
uniform and the Night Nurse come from workstream 4 as character-kit library entries; this task picks them in the
Studio and writes only the game's own figure files, never per-character code (audit 32).

**Files:**
- Create: `content/figures/{ada,figure}.toml`, `content/figure-swatches/*`, `content/figure-gaits/*`,
  `content/figure-actions/{read,flinch,pulse}.toml`, a `figure-seat` for sitting on the bed and one for lying,
  `content/world-props/*`, `content/world-swatches/*`, `content/states/prologue.toml`,
  `src/features/room/{room-view,states}.ts`, `src/features/figure/figure-view.ts`, `src/features/ada/ada-view.ts`,
  `tests/unit/features/room/states.test.ts`, `docs/dress-notes.md`
- Modify: `content/levels/prologue.af-sector.json` (props' `use` and `with`, lamp kinds, lettering), by hand or in
  Levels 3D

**Interfaces (produced):**

```ts
// content/states/prologue.toml (T1: the prologue's own table, no borrowed dressing):
// rows "while these conditions hold, this piece is in this state"; later rows win
export interface StateRow { readonly when: readonly Cond[]; readonly lamp?: string; readonly level?: number
  readonly door?: string; readonly open?: number; readonly prop?: string; readonly state?: string }
export function statesFor(rows: readonly StateRow[], reader: Reader): PieceStates
```

What to build, by eye and by the script:
- **Ada** in her own street clothes (1979, before the uniform) and **the figure** as a tall dark nurse's silhouette,
  from the character kit's library entries workstream 4 adds, picked in the Studio.
- **The ward** furnished from the converter's prop table and task 9's generators, its windows lit by task 9b's
  `moon` lamps and its two soft lights by `fill`; each camera view lists the rooms it draws (the hall's view: the
  hall, the counter, the ward and the corridor's mouth, corridor and doorway; the corridor's: those three; the supply
  room's: itself), as the old policy had them; the two dead bulbs, the lamps that
  go at lights out, the cabinet and the supply door open, and the bed made up are rows of the states file.
- **The five cutscene poses** as figure actions and seats.

- [ ] **Step 1: Failing test:** `statesFor` gives the corridor lamp level 0.12 before lights out and every room lamp
  0 after; the supply door open follows `closetOpen`; the bed shows `made` once `bedMade`.
- [ ] **Step 2 to 4:** run, implement, run; `automata check` passes.
- [ ] **Step 5: Look at it.** Take a picture of each of the three rooms and of each figure from the play camera and
  the Studio. Open every picture and write in `docs/dress-notes.md`, room by room: what reads, what does not, and what
  waits for the builders' look (the survey's "What slice 1 waits for"). Pictures prove composition only.
- [ ] **Step 6: Commit:** `feat(the-last-light): the ward furnished, lit by state, with Ada and the figure`

### Task 14: Draw it: renderer, cutscenes, HUD, recorded sound and music, synth cues, feel

Spec steps 2 and 3. Survey 9, 25 to 27, 30, 45 to 52. T3, T11, T12. Call 7. Audit 1, 2, 16, 21.

**Files:**
- Create: `content/hud/play.toml` (pieces: objective top-left, prompt bottom, inventory bottom-right, examine bottom,
  keypad centre; the nine objective rows, each with its line and its target, T3), `content/audio/audio.toml` (below),
  `public/sounds/{opening-ward,cabinet-open,lamps-out,pulse-counted,nurse-settle,nurse-move-off,turn-to-sound,nurse-sees,nurse-back-off}.ogg` and
  `public/music/{the-last-light,four-seventeen,back-to-bed-ada}.ogg` (copied byte for byte from `<ref>/src/audio/sfx/`
  and `<ref>/src/audio/music/`), `src/features/sound/{music-state,sound-files}.ts`,
  `tests/unit/features/sound/*.test.ts`, `tests/unit/content/audio.test.ts`,
  `content/feel/feel.toml`, `src/features/objective/objective.ts`, `src/features/lamp/lamp-view.ts`,
  `src/app/{controls,flow,play-state}.ts`, `tests/unit/app/{play-state,controls,flow}.test.ts`,
  `tests/unit/features/objective/objective.test.ts`
- Modify: `PROVENANCE.md` (a row for each of the twelve files: the file, what it is, "made with ElevenLabs through the
  old sound pipeline", the date of its commit in the game's repository, read with `git log` there, and the sha256 of the
  file); `src/app/game.ts` (`createRenderer` with the play camera following Ada through the level's views and
  `peekOf`; `cutsceneStage3d` wired to the camera, the room's piece states, the two figure views and the fade;
  `hudSlot` in `hud.overlay` with the caption slot; `audioSynthExtension`, `createAudioSynth` and
  `createMusicDirector` over `content/audio/audio.toml`, the twelve files as core sounds (`sounds`, `preload`);
  `createFeel`; `input`)

**`content/audio/audio.toml`** is the `audio` kind of `@automata/audio-synth`, which the Audio editor edits (call 7,
audit 1). The game writes no sound table of its own. Its rows come from the old game's own table, read once from
`<ref>/src/audio/events.ts`, `cues.ts` and `music-rules.ts` (the old behaviour is the specification):
- **Cues.** The nine recorded effects are cues with `sound` set to their core alias and no voices, played on the
  events the old table gives them (audit 2): `openingWard` (`cutscene.opening`), `cabinetOpen` (`cutscene.keypad`),
  `lampsOut` (`cutscene.rest`), `pulseCounted` (`cutscene.found`), and the figure entering `dormant`, `patrol`,
  `investigate`, `hunt` and `flee` (`nurseSettle`, `nurseMoveOff`, `turnToSound`, `nurseSees`, `nurseBackOff`).
  `cutscene.lightsOut` is `silent`: its script carries the sting, and the old game played no file there
  (`<ref>/src/main.ts:344`), so `all-lamps-die.ogg` does not cross. Written new for the synth, where the old cues were
  procedural: pick up, the keypad's buzz and chime, the sting, the lamp lit, a door, a curtain, hiding, the door
  rattle of a follow, the steps (by floor, task 7's `steps` table).
- **Events.** One row per sim event the prologue can make, a cue or `silent` with why, as the old table has them.
- **Music.** Slots `first-night` (its own file does not exist; it falls back to `the-last-light`, as the old one did),
  `four-seventeen`, `back-to-bed-ada`; rules in the old order: paused or the keypad open, `hold`; hidden, `silence`;
  the practice chase, `back-to-bed-ada`; after lights out with the figure about, `four-seventeen`; otherwise
  `first-night`.

**The register** (audit 16): using it opens core's save slots, with `prologue.registerAsk` as the question and
`registerSign` and `registerLeave` as the two answers; `registerSigned` shows once a slot is written. That is the old
save point (`<ref>/src/scenes/prologue/presentation.ts`, `saves`) on core's saves, with no dialogue file.

**After `rest`** (audit 21): the old prologue went on to act one, which slice 1 does not have. The game shows Credits
(workstream 1's screen) and returns to the title. `flow.ts` owns it.

**Interfaces (produced):**

```ts
/** The music state the audio file's `music_rule` rows read, from what the sim reported this step. Pure. */
export function musicStateOf(state: PlayState): MusicState   // { phase, lightsOut, figureAbout, chasing, hidden }
/** The HUD's model from what the sim reported this step. Pure. */
export function hudModelOf(state: PlayState, file: HudFile): HudModel
/** The objective now: the line's key, and the point to walk to when the row names a hotspot. */
export function objectiveNow(file: HudFile, reader: Reader, hotspots: readonly Hotspot[]):
  { readonly line: string; readonly target: { x: number; z: number } | undefined } | undefined
// controls: move (WASD, arrows, the left stick, the touch stick); turn the camera in 45° steps (Q and E, the pad's
// shoulders, two screen buttons); use the nearest hotspot (Space, Enter, the pad's confirm, the prompt button); the
// lamp (F, the pad's north); inventory (I, Tab, the pad's west); skip a cutscene (Escape held, the pad's start)
```

- [ ] **Step 1: Failing tests:** `hudModelOf` shows the first objective row at the start and the `hide` row after
  lights out; `prompt` is the nearest hotspot in reach and absent in a cutscene; `locked` is true while
  `cutscenes.locked`; `objectiveNow` gives the bed's point for the last row and no point for `hide`; every control has
  a keyboard, a pad and a touch way (a table test over `controls.ts`); the audio file passes the kind's own checks, every
  cue's `sound` is one of the twelve files in `public/`, and every event the prologue's content can make has a row (T12);
  the music rules give `first-night` at the start, `four-seventeen` after lights out, `back-to-bed-ada` while she
  hunts and silence while Ada hides (`createMusicDirector` over `musicStateOf`); each of the twelve files' sha256 equals
  the one in `PROVENANCE.md`; using the register opens the save slots and writing one shows `registerSigned`; after
  `rest`, Credits, then the title.
- [ ] **Step 2 to 4:** run, implement, run. Then play it by hand in headless Chromium with the debug overlay and fix
  what is wrong.
- [ ] **Step 5: Commit:** `feat(the-last-light): the prologue drawn: camera, cutscenes, HUD, sound, music and feel`

### Task 15: Prove it plays (Chromium)

Spec step 4; "Done means": the prologue plays from its first cutscene to its end under a bot, twice with the same
hash, in Chromium.

**Files:**
- Create: `games/the-last-light/playwright.config.ts`, `tests/e2e/playthrough.test.ts`, `tests/e2e/driver.ts`,
  `tests/e2e/origin.ts` (under `tests/e2e/`, as Emberwick's `origins.ts`, not at the package root as Ember Hall's;
  audit 13)
- Modify: `tooling/examples-runner/host/ports.ts` gains two new slots after `examples3dPort` (the game's preview
  build and its dev server), with `tooling/examples-runner/tests/unit/ports.test.ts`; Ember Hall keeps its own two until
  task 20 removes them (audit 5). Root `package.json` `ci:local` gains `--filter @af-games/the-last-light`, and
  `.github/workflows/3d.yml`'s journeys job gains `pnpm --filter @af-games/the-last-light test:e2e` (audit 14)

The config has the projects Ember Hall's had (`games/base-3d/playwright.config.ts`), so the 3D workflow keeps a WebKit
game journey when Ember Hall goes (audit 13): the preview build at 844 by 390 in Chromium, and the dev server in
Chromium and in WebKit (an iPad held sideways). This container runs the Chromium projects; WebKit runs on the 3D
runner and is reported as not run here.

- [ ] **Step 1: The failing journey:**

```ts
test('the prologue plays to its end, twice, with the same hash', async ({ page }) => {
  const first = await play(page, ROUTE, { seed: 1 })     // waits on sim state through the debug driver, never on a sleep
  const second = await play(page, ROUTE, { seed: 1 })
  expect(first.pageErrors).toEqual([]); expect(first.ended).toBe('rest')        // the last cutscene ran to its end
  expect(first.hash).toBe(second.hash); expect(first.hash).toBe(NODE_HASH) })   // and equals task 12's hash in Node
test('after rest, Credits, then the title', …)                                      // audit 21
```

`play` starts from the title's Play, lets the opening cutscene run (not skipped) and skips the others, sends the
route through the page's own controls where one exists (the prompt button, the inventory, the keypad), and uses the
driver only to wait. `NODE_HASH` is read from task 12's run at test time, not typed in.

- [ ] **Step 2 to 4:** run (`pnpm --filter @af-games/the-last-light test:e2e`), fix, run.
- [ ] **Step 5: Commit:** `test(the-last-light): a bot plays the prologue to its end in Chromium, twice, same hash`

### Task 16: Prove it edits (six editors)

Spec step 5; "Done means": it opens in Levels 3D, Writer, Sequence, Schematic, the Studio and the Tuner; one edit in
each shows in play. The pattern is `examples/3d-story/tests/e2e/schematic-in-play-3d.test.ts`.

**Files:**
- Create: `games/the-last-light/tests/e2e/edits/{levels,writer,sequence,schematic,studio,tuner}.test.ts`, `tests/e2e/edits/suite.ts`

Each journey opens the suite on the game, makes one edit through the editor's own controls, saves, plays, and reads
the change from the sim or the page. Every journey works on a copy of `content/` in a temp folder, so the committed
content never changes.

| Editor | The edit | What play shows |
|---|---|---|
| Levels 3D | Move the `nightstand` hotspot 0.5 m | The prompt appears at the new place and not the old |
| Writer | Add one new line and point the `trolley` action's line at it | The examine box shows the new words. No existing line's words change |
| Sequence | Move the `keypad` cutscene's caption 0.5 s later | The caption appears at the new time under an injected clock |
| Schematic | Halve the vigil | The figure leaves in half the ticks |
| Studio | Change one of Ada's swatches | The figure view's texture hash differs from before |
| Tuner | Raise the lamp's fill from 40 to 60 s | One fill lasts 60 s of ticks |

- [ ] **Step 1: Write the six journeys;** run them and see each fail for its own reason (or pass where the editor
  already works; a pass with no code change is a result, written down).
- [ ] **Step 2: Fix what fails:** an editor's fault in the editor, with its test first; the game's wiring in the game.
- [ ] **Step 3: Commit:** `test(the-last-light): one edit in each of six editors shows in play`

### Task 17: The guide to hotspots and the play HUD

So the two new pieces have a guide apart from the reference game. The spec cuts `examples/3d-story` in this slice
(spec, "The 3D examples go too"; audit 30), so this task no longer changes that example: the guide's worked example is
the prologue, and the new 3D examples, recreated from the reference game after slice 1, will each have a journey.

**Files:**
- Create: `docs/guides/hotspots-and-the-play-hud.md`
- Test: the guide's code blocks are checked as the other guides' are (`pnpm style`'s `--docs`); its links resolve

- [ ] **Step 1:** write the guide in the other guides' voice: what a hotspot is, how to place one in Levels 3D, the
  `hud` file and its five pieces, what the coming UI editor will take over; every example is a cut of the prologue's
  own files, quoted from them.
- [ ] **Step 2:** `pnpm style`, then commit: `docs(guides): hotspots and the play HUD`

### Task 18: Prove the shell: six languages, first run, gamepad, touch at phone size

Spec step 6; "Done means": it runs under the framework's shell with a gamepad and with touch at phone size, and its
menus and its story lines are in the six languages. **Needs workstream 1 on `main`;** merge `main` in first. Call 8.

**Files:**
- Create: `games/the-last-light/content/fonts.toml` (workstream 1's font set, cut to the characters the game shows;
  `content/fonts.toml` is where workstream 1's font build and `words` check read it, audit 12),
  `content/credits.toml`, `messages/ui/{ja,ko,es-419,pt-BR,zh-Hans}.json` and `messages/ui/context.json` (the game's
  interface words: the HUD's action words, room names and the hotspots' names that task 11 wrote into
  `messages/ui/en.json`, audit 11), `content/messages/context.json` (notes for a translator: the year is 1979; Ada
  speaks plainly and wryly, in the first person; "Bed 04", "St. Agnes", "A. Voss" and the code 2000 are never
  translated; the handover note is a hurried handwritten note), `content/messages/{ja,ko,es-419,pt-BR,zh-Hans}.json`,
  `words-sources.json` at the game's root (the record `automata words --mark` writes, one per game, audit 12),
  `tests/e2e/shell/*.test.ts`, `tests/unit/content/translations.test.ts`
- Modify: `messages/ui/en.json` (gains the HUD's action words and the room names beside task 11's hotspot names);
  `src/app/game.ts` (`firstRunLanguage`, `photosensitivity` on with the feel switches, since the prologue
  flickers; `opening` with the Splash; `uiSounds`), `src/app/flow.ts` (Credits from the title), `ship.config.ts`
  (`content.languages`), `PROVENANCE.md` (the font: its name, source, version and licence, as workstream 1 records it)

- [ ] **Step 1: Failing tests.** Unit: every one of the 74 lines, and every interface word with the 22 hotspot
  names, has a translation in each of the five languages;
  each keeps the never-translated terms; the English catalog is byte-equal to task 11's words; `automata check`'s
  words step passes (no missing key, no lost placeholder, no character the fonts cannot draw). Journeys, each at
  390×844 and 844×390 in Chromium:
  - a first run shows the language screen, then the flashing warning, then the splash, then the title; a second run
    goes straight to the title;
  - with a gamepad only: title → Play → skip the cutscene → walk → use a hotspot → open the inventory → hold an item →
    pause → settings → back;
  - with touch only: the same path with the touch stick, the prompt button and the inventory;
  - every HUD piece and menu control is at least 44 px (primary 48 px) in each of the six languages, with that
    language's longest line in the examine box (Review focus 4);
  - changing the language in Settings changes the menus, the HUD's words and the next line shown, at once.
- [ ] **Step 2: Write the translations.** For each language, translate all 74 lines and the interface words new, in
  that language's plain register, keeping Ada's voice and each line's meaning; never touch the English. A hotspot's
  name is a label on a button, so it is short. Record them
  with `automata words --mark`. The live model call is not run; it stays tested against the fake.
- [ ] **Step 3 and 4:** implement the shell wiring, run the tests and journeys.
- [ ] **Step 5: Commit:** `feat(the-last-light): the framework's shell around the prologue, in six languages`
- [ ] **Step 6, when the coordinator says the Owner's key is saved:** run `pnpm --filter @af-games/the-last-light
  exec automata words --all` for real, once. Read the diff of the five catalogs line by line against what the session
  wrote: keep the command's answer unless it lost a never-translated term or a placeholder (the command's own checks
  refuse those). The English must not change (`git diff` shows no change to the lines file). Run task 18's tests
  again. Commit: `feat(the-last-light): the story's translations, written by automata words`. If the key never
  comes, this step stays unticked and the record says so; the session's translations stand.

---

# Ember Hall and the 3D examples go (tasks 19 and 20)

The spec, as amended at `864361d4` ("The 3D examples go too, and are recreated after the prologue"): `examples/3d`
(76 files: 19 examples with their journeys and goldens, and the `@af-examples/wardrobe-3d` package) and
`examples/3d-story` (58 files) are removed in this slice with Ember Hall, when the prologue plays; the site's Examples
page lists no 3D example until the new ones exist; the 3D workflow's coverage comes from the reference game's journeys
and the packages' browser tests (audit 30). Recreating them is the next piece of work, not this plan's. The 2D examples
are untouched.

Only after task 15 passes. The survey's table "Ember Hall: what names it" is the list; `git grep -niE
"ember[ _-]?hall|base[-_]?3d|af-games/base"` is the check. It is case-insensitive on purpose: the narrower four patterns
miss `BASE_3D` and `base3dPort`, and with them three editor journeys (audit 3). Call 11 decides where each test goes.
Before task 19 starts, run the check again and compare with the survey's 61 files: a file added since (workstream 1's
task 17, if it ran, audit 20) joins the list.

### Task 19: Ember Hall goes, part 1: tests, tools, editors and tooling stop leaning on it

**Files (modify, by group):**
- `packages/editor-3d`: `src/testing/{game-files,hall-library}.ts` and the six unit tests read a fixture game folder
  of the package's own (`src/testing/fixtures/hall-game/`, the level and library they need and no more);
  `tests/unit/shared/level-session/af-sector/ember-hall.test.ts` is renamed for what it tests; the suite's sample game
  (`src/app/suite/sample-3d/`) keeps its content, with the comments that name Ember Hall rewritten.
- `packages/tools`: `src/shared/check/check-steps.ts` loses `ROLE_LAYOUT_GAMES` (no game is laid out by role any
  more); the six tests that used Ember Hall's folder as "a 3D game" use a temp game made by the 3D template, or
  `games/the-last-light` where the test is about the reference game; `serve-editor.ts`'s comment names the new title.
- `packages/3d`: comments, and the fixture rooms' header, no longer name it; the tests keep their own fixtures.
- `packages/editor`: the harness's `BASE_3D` (`tests/e2e/harness/fixtures.ts:23`) and the three journeys that copy
  it, `tests/e2e/journeys/{dark-levels-3d,levels-3d-edit-reaches-the-game,new-3d-game-plays-its-edits}.test.ts`
  (audit 3). They edit "the 3D reference game" and play the edit, so they take The Last Light's folder (the constant
  is renamed for it); where a journey needs Ember Hall's own room (its floors, its time of day), it reads the same
  thing in the prologue's level, and the commit says which assertion changed and why.
- `packages/content`, `extensions/pipelines`: one test each, the same way.
- `tooling/check-style`: `--role-layout` is removed with its tests (no script passes it once `check-steps.ts` no
  longer names a role-laid game). `tooling/examples-runner/tests/unit/runner-ports.test.ts` imports the new game's
  `tests/e2e/origin.ts` in place of Ember Hall's. Ember Hall's two ports, and the three repo-hygiene tests that pin
  today's scripts and workflow (`gate-scripts.test.ts:77`, `source-names-wired.test.ts:32`,
  `workflow-invariants.test.ts:117-122`), change in task 20 with the scripts and the workflow they pin, so this task's
  `pnpm check` stays green while Ember Hall is still there (audit 5).
- `spikes/3d-look`: it draws Ember Hall's room. Point it at the base interior of `@automata/3d/base`, or delete the
  spike if `docs/refactor/progress.md` says its question is answered; say which in the commit.
- The two pending changesets that name Ember Hall are reworded.
- **What leans on the 3D examples** (audit 30; measured at `32b90536`, `git grep -lE
  "examples/3d([^-]|$)|examples-3d|wardrobe-3d|examples3d|3d-story"` outside the two folders and the record folders):
  six `packages/3d` files (`src/entries/figures-kit.ts` comments, `src/testing/golden-{outfits,recorders}.ts`, and
  `tests/unit/{camera/occluders/framing,figures/content/figures-content,figures/motion/stands}.test.ts`), which read an
  example's content and get fixtures of their own; `extensions/character-kit/scripts/gate.ts` and
  `tests/unit/painted/painted-scale.test.ts`; the cutscenes and systems READMEs; `spikes/eb-look` and
  `spikes/tll-camera` (two `shoot.mjs` and a README); `examples/2d/playwright.config.ts` (a comment). The wardrobe
  example's eleven streetwear garments (`examples/3d/wardrobe/garments/`, moved there in 3D task 6.5, recorded at
  `docs/provenance/sources.md:24`) are judged with the rest, as the spec says: they move to the character kit's
  fixtures or go, and the commit says which and why. The site's Examples page: its catalog and journeys show no 3D
  example (`site/src/features/examples/`, `site/tests/unit/playground/runtime/playground-catalog.test.ts` names
  `render3d-meshes` as a fixture id, which is left alone if it is only a string).

**What each removed journey covered, and what holds it after** (the coordinator's ask, 2026-11-11; read from the
journeys' own headers at `6a70f9b1`). A row marked **gap** has no remaining test; task 19 records it in
`docs/superpowers/progress.md` as a thing the recreated examples must cover, and nothing is added for it here.

| Removed journey | What it proved | Held after by |
|---|---|---|
| `games/base-3d/e2e/base-3d.e2e.ts` | Boot under the fake host, the rotate gate on a phone held upright, the shell | The game's journeys (task 15) and the shell journeys (task 18), with the same host |
| `games/base-3d/e2e/play.e2e.ts` | Play by touch at a phone and an iPad held sideways: the stick, an action, the HUD counting | Task 18's touch-only journey, at the same two sizes |
| `games/base-3d/tests/e2e-dev/*` | The dev server's page boots with no page error, in Chromium and WebKit | The game's dev projects in Chromium and WebKit (task 15) |
| `examples/3d-story/tests/e2e/schematic-in-play-3d.test.ts` | A Schematic edit shows in a 3D game's play | Task 16's Schematic journey |
| `examples/3d/tests/e2e/cutscenes-door-and-lamp.test.ts` | A cutscene drives a door and a lamp in 3D | Task 6's browser test of the 3D stage, and the prologue's cutscenes (task 15) |
| `examples/3d/tests/e2e/cutscenes-reach-cue.test.ts` | The director starts a figure's clip on its cue | `extensions/cutscenes/tests/unit/director/director.test.ts` (the cue), task 6's stage test (the clip reaching a view) |
| `examples/3d/tests/e2e/characterkit-{hair,painted,wardrobe}.test.ts` | Hair, painted figures and a wardrobe drawn | `extensions/character-kit/tests/browser/{painted,parity}/` (painted view, depth, outfits, passes); hair: **gap** |
| `examples/3d/tests/e2e/figures-{aim,clips,outfits-items,poses,stand-and-sliders,walk}.test.ts` | A figure aims, plays clips, wears outfits and items, poses, stands, walks | `packages/3d/tests/browser/parity/figures/` and the figure goldens (`packages/3d/src/testing/golden-*`, given fixtures of their own); Ada and the figure walking and posing in the prologue (tasks 13, 15); aim and sliders: **gap** |
| `examples/3d/tests/e2e/look-pixel-art.test.ts` | The pixel look at its field size | `packages/3d/tests/browser/parity/look/look.parity.test.ts` |
| `examples/3d/tests/e2e/render3d-{angled-camera,lighting-fog,meshes}.test.ts` | The renderer's camera, light and fog, and plain meshes | The prologue under the play camera (task 15) for the camera; `look/time-of-day.parity.test.ts` for light and fog; plain meshes: **gap** |
| `examples/3d/tests/e2e/world-level-room.test.ts` | A level file drawn as a room | The prologue's level drawn (tasks 13, 15) and task 9b's browser test |
| `examples/3d/tests/e2e/worldkit-{furnished-room,generated-map,sky}.test.ts` | The dresser, a generated map, the sky | `extensions/world-kit/tests/browser/sky/` (the sky); task 9's prop picture test and the ward (task 13) for furnishing; the generated map: **gap** |

- [ ] **Step 1: The failing check:** add to `tooling/repo-hygiene/tests/unit/` a test that greps the tracked files
  outside `games/base-3d`, `docs/archive`, `docs/refactor`, `docs/superpowers` and `pnpm-lock.yaml` for the four
  patterns of the check above (case-insensitive), and the examples' patterns, and expects none but a named list: the files task 20 changes (the
  workflows, the root scripts and configs, `ports.ts` and its test, the three pinned repo-hygiene tests, the documents).
  It fails with today's 61 files; it passes once this task's groups have moved; task 20 empties the list.
- [ ] **Step 2: Move each group,** running that package's tests after each: a test that passed against Ember Hall must
  pass against its fixture or the new game with the same assertions. A test whose subject was Ember Hall itself (its
  own journeys, its HUD, its saves) is not moved: its equivalent for The Last Light is in tasks 15, 16 and 18, and the
  commit lists each such test with the task that replaces it.
- [ ] **Step 3:** `pnpm check` passes with `games/base-3d` still present. Commit, one per group:
  `refactor(<package>): tests use their own 3D fixture, not the old reference game`

### Task 20: Ember Hall and the 3D examples go, part 2: journeys, workflow, the folders, the documents; final gates and record

"Done means": `games/base-3d` is gone and nothing names it; the 3D workflow's suites and journeys pass on The Last
Light; the game's folder carries its provenance file, and everything in it is MIT.

**Files:**
- Delete: `games/base-3d/` (173 files), `examples/3d/` (76), `examples/3d-story/` (58)
- Modify: `.github/workflows/3d.yml` (Ember Hall's and `examples/3d/**`'s paths and the three journeys steps for
  Ember Hall, `examples-3d` and `3d-story` go; the `game-ci` job runs The Last Light), `pnpm-workspace.yaml` (the
  `examples/3d`, `examples/3d/wardrobe` and `examples/3d-story` lines), the `examples:3d` script,
  `.github/workflows/game-ci.yml` (a comment); root `package.json` (every list that names `games/base-3d` or
  `@af-games/base-3d`: `boundaries`, `style`, `source-names`, the 2D and 3D filters, `ci:local`), `knip.jsonc`,
  `.vscode/settings.json`; `tooling/examples-runner/host/ports.ts` (Ember Hall's two slots and `examples3dPort` go,
  with `tests/unit/{ports,catalog}.test.ts`); `tooling/repo-hygiene/tests/unit/{gate-scripts,source-names-wired,workflow-invariants}.test.ts`
  (the new scripts and workflow, audit 5) and task 19's check, its list now empty; `tooling/frame-budget` (a probe
  project for the prologue, below); `AGENTS.md` (line 38: `games/emberwick` and `games/the-last-light` both have the
  shape; the sentence about the default 3D reference); `docs/README.md`, `docs/status.md`, `examples/README.md`,
  `docs/adr/0007-3d-look.md` (a dated note, not a rewrite); `docs/provenance/sources.md`: line 91's row points at the
  same file in `packages/3d/tests/fixtures/content/figure-actions/look.toml`, line 83's note and line 673's row (Ember
  Hall's four generated sounds) are reworded, because `pnpm source-names` runs `sources-md-cli.ts --complete`, which
  fails on a row whose file does not exist (audit 4); `docs/superpowers/progress.md`

- [ ] **Step 1:** empty task 19's list; its check now fails on the workflow, the scripts, the ports, the pinned tests
  and the documents. Change them; delete the folder; `pnpm install` so the lockfile drops the package.
- [ ] **Step 2: The frame budget.** `tooling/frame-budget` measures its own stress scene and calls a run drawn by a
  software renderer "not comparable" (`src/budget.ts:74-130`), which every run in this container is. Add a probe
  project that opens the prologue's build and walks the hall; its `budget.json` row is a target (the spec's 3D phone
  and iPad numbers), with the note that the Owner's GPU run replaces it with a measured one. Run it here to prove it
  runs, and record "skipped: software renderer". A number is measured, never typed from memory (audit 15).
- [ ] **Step 3: Gates.** `pnpm format`; `pnpm check`; `pnpm test:browser:2d`; `pnpm test:browser:3d`;
  `pnpm test:journeys:3d`; `pnpm --filter @af-games/the-last-light test:e2e`; the site's unit tests and its
  Examples journey (no 3D example listed); `pnpm build`,
  `pnpm api-report`, `pnpm api-index`; `pnpm lint:actions` if Docker runs. Run locally what `3d.yml` would run, step
  by step, since hosted CI has no runners; write each result.
- [ ] **Step 4: MIT and provenance.** Read `games/the-last-light/PROVENANCE.md` against the folder: every file that is
  not text made here is listed; the only recorded sound and music are the twelve files
  the provenance file lists, with matching sha256; no `.glb`, no atlas `.png` and no other `.ogg` or `.mp3` is in the
  folder (a `git ls-files` listing proves it).
- [ ] **Step 5: "Done means", line by line,** in `docs/superpowers/progress.md`: each of the spec's six lines with the
  test that proves it, or the word **open** and why. Expected open: WebKit and Firefox parity, real devices, and what
  `docs/dress-notes.md` says waits for the builders' look.
- [ ] **Step 6: Commit:** `refactor!: The Last Light is the 3D reference game; the old one is removed`, then
  `docs(superpowers): slice 1's record: what is proven and what is open`. Push. Report to the coordinator.

---

## Self-review, done when this plan was written

- **Spec coverage.** Step 1 (convert once, starting from the fixtures): task 11. Step 2 (close the gaps): tasks 1 to 9,
  and 12 for the game's own. Step 3 (dress): tasks 9, 13, 14. Step 4 (plays): tasks 12, 15. Step 5 (edits): tasks 5,
  8, 16. Step 6 (shell): task 18. "Where the game lives": task 10. "A refactor, not a transcription": the layers and
  the features table up front, the architecture test in task 10, and each T row beside its task (T1 13; T2, T5, T6,
  T14 12; T3, T11, T12 14; T4, T7 to T10 11; T13 10). "Ember Hall goes": tasks 19, 20. MIT and provenance: tasks 10,
  14, 18, 20, and call 7. The name rule: task 10a. Rooms per view and lamp kinds: task 9b. "Done means": plays, 12 and 15; six editors, 16; shell, pad, touch, six languages for menus and
  story, 18; additions tested and `pnpm check`, each task and 20; Ember Hall gone and the 3D workflow on the new game,
  19 and 20; provenance and MIT, 20. HUD layout and words as data: tasks 2, 3, 14. Spec goal 3's "sound in Audio":
  task 14 puts every cue, event, slot and music rule in the `audio` kind the Audio editor edits (audit 1).
- **Not covered, on purpose:** Writer for storylets, beats and help; a camera-eye preview in Sequence; scenarios in
  Schematic. They are in the survey as suite work.
- **Names checked across tasks:** `applyVerb`, `useCommands`, `Hotspot`, `hudSlot`, `HudModel`, `HudActions`,
  `HudFile`, `chooseObjective`, `objectiveNow`, `hudModelOf`, `Systems.hide`, `peekOf`, `PeekDef`, `Delivery`, `typed`,
  `cutsceneStage3d`, `ActorView.clip`, `stepCue`, `levelWalls`, `statesFor`, `lampFacts`, `fillLamp`, `nightHooks`,
  `musicStateOf`, `playRoute` are spelled the same wherever they appear (checked again by the plan audit, which also
  removed `SoundRow`, `MusicRow`, `soundTableSchema` and `musicNow`).
- **What this plan could not check:** nothing was run. The survey's two "to check" items were read and became task
  9b. Two things are still decided by reading code at execution: whether the world is already built one room at a
  time (task 9b, step 1), and whether a rule's existing `every` re-routes her on a clock (task 4; if so, `goTo` gains
  nothing and the log says so).

## Log

| Date | Session | What |
|---|---|---|
| 2026-11-11 | Stage 2 (plan), `claude/last-light-prologue-plan` | The survey and a first plan (`43f94569`), written before the spec was re-set |
| 2026-11-11 | The same session | The survey revised and this plan rewritten for the re-set spec: the game at `games/the-last-light`, by feature, MIT, from October's fixtures; Ember Hall removed. No product code, no test run |
| 2026-11-11 | The same session | The Owner's last answers applied (spec `3c0a624f`): the six recorded files cross and play through core's audio; the name rule is its own task (10a); rooms per view and two lamp kinds (9b); three branches; a last step runs `automata words` for real |
| 2026-11-11 | Stage 3 (plan audit), `claude/last-light-prologue-plan-audit` | [The audit](../audits/2026-11-11-last-light-prologue-plan-audit.md) at `main` `81ce53a9` (then `6a70f9b1`) and the game at `92e6704`: 32 findings (9 blocking, 15 should fix, 8 tidy), all fixed here and in the survey. The spec's amendments during the audit: the 3D examples are removed in tasks 19 and 20 and no task leans on them; a "Homes" table rules each addition by the three-homes rule (interact and the HUD adventure-genre extensions with dependency-free halves; a carried light that burns fuel in `@automata/systems`, task 4); the dressing starts on workstream 4's word. The sound is the framework's `audio` kind, not a game table; the recorded files the old prologue plays are listed, six cross until the Owner says otherwise; three editor journeys and the provenance record join Ember Hall's removal; every systems call has a fate; the gates name the new extensions and the game; `main.ts` at the root; the register, the end, hotspot names and the FigureBuilder submodule are planned. No product code, no test run |
| 2026-11-11 | The same session | The coordinator's answers: every recorded file the prologue plays crosses (twelve; option B), `all-lamps-die.ogg` stays out; workstream 1's task 17 is cut on its build branch; what each removed journey covered and what holds it after, in task 19. Nothing left open |
| 2026-11-11 | Stage 4 (execution), `claude/last-light-framework`, built on `main` `a024bc4b` | Task 1. Rulings: (1) `applyVerb(ctx, verb, options = {})` takes the puzzle's own options as a third argument, since the plugin's `calls` and `facts` live in its closure and a caller cannot reach them; `InteractOptions.puzzle` carries the options the game gave `createPuzzlePlugin`; `applyVerb` also keeps the verb system's two guards (no scene loaded, `locked`). (2) The sim has no reading of a step's own events, so interact learns a refused walk from `NavRoutes`: a pending use whose walker is out of reach and has no route is dropped as `unreachable`; the interact system runs `after` `nav.walk`. (3) The player and reader options take a `SimView` (`entity`, `query`, `resource`: a system's context and a `Sim` both have them), not a `SimContext`, so `Interact.inReach(view)` can serve a HUD that holds a `Sim` and no context. (4) `requires` is `['nav', 'puzzle']`: interact reads no places (nav already requires the provider), so the plan's places entry is dropped. (5) A use that comes within reach stops the walk (drops the player's route) and acts, rather than letting the player walk onto the hotspot; a refused `Use` also clears any waiting use. (6) `extensions/interact/**` is added to the Biome override that allows a `then` property (puzzle effects use it). The old rule that the pending half imports no extension holds: `pending.ts` imports only `@automata/sim/math`. `pnpm api-index --write` exits 1 on three exports of other packages with no doc comment (`STICK_DIRECTIONS`, `Picture`, `PROMPT_COPY`), as it did before this branch; the two `VerbPayload` entries this task added are documented. |
| 2026-11-11 | Stage 4, task 2 | Task 2. Rulings: (1) `HudRoot.svelte` is in `src/app/` with `hudSlot`, not in `features/layout/`: it draws the objective and the prompt, and a feature may import only itself and `shared/`, so the composing component is the app's. `features/layout/` holds `place.ts`. (2) The file's schema is split so the dependency-free half imports no extension: `shared/layout.schema.ts` (anchors, pieces, width, words; no import of puzzle, nav or narrative) and `shared/hud-model.ts` are free of extensions; `shared/objective.ts` (rows and `chooseObjective`, over puzzle's `Cond`, `holds`, `Reader`) is the one file that leans on puzzle, and `hud.schema.ts` joins the two. (3) The HUD reads its model when the sim has stepped (`play.sim.tick`), as the dialogue box does, so a test steps the sim each frame. (4) A key with no words shows nothing and is reported once with `reportError`, as the dialogue box does. (5) `hudExtension` requires `puzzle` only. The Prompt takes Enter only when the key is not for another control, and a pad's A once per press (a button already held when the prompt appears is not a press). Words: the objective and the prompt's names are message keys with English in `src/testing/toy-hud.ts` only; the game's six-language catalogs are the join to workstream 1 (task 14 of this plan wires the keys to `words`). |
| 2026-11-11 | Stage 4, task 3 | Task 3. Rulings: (1) The plan's "export the dialogue box and draw it in the examine piece" cannot work as written: `DialogueBox` reads a conversation from the sim and cannot show a line the HUD is given. So narrative's box is split: `LineBox.svelte` (a speaker or title, the words and the caller's controls; `placed` and `style` let a caller position it) and `DialogueBox` draws one; both are exported from `@automata/narrative`, and the examine piece draws a `LineBox`. Narrative's own unit and layout tests pass unchanged, which is the proof the dialogue box looks and acts as before. Task 5's typing therefore lands in `LineBox`. (2) `HudActions.examineItem` is in the interface as the plan wrote it and no piece calls it: the sheet shows an item's own text, and the game chooses when an examine line is said. (3) A pad steers every piece itself (`shared/pad.ts`, shared because three features use it: D-pad to the nearest control that way, A presses, B goes back), because the default play screen steers only its own menus; the prompt takes A only when no other control has the focus, and steps aside while the examine box or the keypad is up. (4) `placeStyle` gained `width: max-content`: an absolutely placed piece pinned at a centre line (`left: 50%`) was squeezed to the room to its right. (5) Hold on the held item puts it away (`hold(undefined)`). The keypad scrolls inside itself on a short screen rather than shrinking a key. The words for each slot come from the piece's `words` in the file; a slot the file does not name shows the interface's own plain word (Hold, Combine, Close, Delete, Enter), never a key. Join to workstream 1: the item names and texts, the examine lines and the slot words are message keys here; the game's catalogs in six languages and the font that draws them are the game's `words` function (task 14). |
| 2026-11-11 | Stage 4, task 4 | Task 4, **a finding that changes the design, reported to the coordinator**: a snapshot's `schemaHash` covers every plugin's commands, events, components and systems and the JSON schema of every resource (`describeSchemas`, `packages/sim/src/shared/world/sim.ts`), so any addition to the `systems` plugin or its schemas moves the systems golden (`8ec637bd430ca3de`) and every consumer's. The plan's "must not move" cannot hold with its design (an optional `peek` block in the systems file, an `every` on `goTo`, a `facing` in `SystemsEnv`, a new event or command in the plugin). The stop rule wins, so nothing in the existing plugin or its schemas changed. Rulings: (1) **Peeking and the carried light are plugins of their own** in `@automata/systems` (`createPeek`, `createCarriedLight`), opt-in beside `systems`, so a sim without them keeps its header; the old game's numbers are `PeekDef` defaults (`DEFAULT_PEEK`: reach 1.4, dwell 0.6, arc 50, lean 1.2, ease 0.4) given as plugin options, not a block in the systems file, and a bad number is refused in words when the plugin is made. The game's tuning file can hold them. (2) The player's facing is an option (`facing(ctx)`), not a field of `SystemsEnv`; `moving` and the hiding come from the env and `systems.pursuit` already there. (3) A re-route on a clock is `followPlayer(every)`, a hook a transition calls from a mode to itself, not `every` on `goTo`: the plan said to try a rule first, and a rule has no agent (a rule's `goTo` does nothing), so the clock is the agent's own `replan`, which snapshots carry. (4) A doorway is a crossing between a room of the player's zone and a room of another (`places.crossing`), and a shut door is a wall in the game's `blocked` query on the walk from her to its middle, so no door is named in `systems`. (5) Any `puzzle.verb` command ends a peek, and `interrupt(ctx)` lets a game end it for its own commands (the interact extension's `Use` is one); the sim cannot read a step's own events, so `puzzle.said` is not used. (6) A peek carries `on` (the dwell is up) in its state, and `peekOf(sim)` gives it once it holds. (7) `Systems.hide` and `unhide` do what the commands do. (8) The carried light's toggle on a dry light emits `LightDry` ("refused in words") and changes nothing; the pool is appended to `env.lights` before the systems' step, so the game writes `env.lights` fresh each step, earlier (documented in the README). The ward game's test helper takes `plugins` as a function of the game's `Systems`. |
