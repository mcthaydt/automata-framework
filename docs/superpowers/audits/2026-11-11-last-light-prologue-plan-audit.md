# The Last Light, slice 1 (the prologue): plan audit

**Date:** 2026-11-11. **Stage:** 3 (plan audit) of workstream 2, slice 1. **Tracker:** [`../progress.md`](../progress.md).
**Audited:** [the plan](../plans/2026-11-11-last-light-prologue.md) and [the survey](2026-11-11-last-light-prologue-survey.md)
as merged at `main` `81ce53a9`, against [the spec](../specs/2026-11-11-last-light-on-the-framework-design.md) (at
`94f2a216`, and again after `main` was merged in at `32b90536` and `6a70f9b1`, which amended it three times:
`acb0361d` and its correction `909f6b10`, where a new piece goes, and `864361d4`, the 3D examples cut; and added
workstream 4's spec, `44c4da09`; findings 30 to 32), `AGENTS.md`, the code on `main` `81ce53a9`, workstream 1's
[spec](../specs/2026-11-11-shared-polish-design.md) and [plan](../plans/2026-11-11-shared-polish.md) on `main` and on
`claude/shared-polish-build` (`04887266`), and the game's repository `mcthaydt/PixiJS3D_Experiment_001` at `92e6704`
(read only, cloned shallow; nothing pushed to it).

## What was checked, and what was not run

- **Every path, export and name** the plan and survey give, read in the source on `main`: the extensions' entries and
  schemas (`nav`, `puzzle`, `systems`, `narrative`, `cutscenes`, `audio-synth`, `world-kit`, `editors`, `debug`),
  `packages/3d` (level schema, camera views, lamp kit, `play-camera.ts`), `packages/automata` (the `hud.overlay` slot,
  `UiComponent`), `packages/tools` (the boundaries rules, `check-steps.ts`), the root scripts, the workflows, the
  repo-hygiene checks and their pinned tests, `tooling/examples-runner`, `tooling/frame-budget`, `games/emberwick` and
  `games/base-3d`.
- **The fixtures against the game:** the blockout fixture is byte-for-byte the game's `docs/art/blockout-prologue/blockout.json`
  (a JSON compare); the fixtures' line counts (puzzle 484, systems 948, cutscenes 1,020), 74 line records, 74 locale
  entries, 34 actions, 22 hotspots, 15 lamps and 3 zones were counted from the files. The survey's claim that they are
  still true holds: the game's head is the commit `SOURCE.json` records.
- **The game's prologue:** all 16 files (1,142 lines, counted), `rules.ts`, `cutscenes.ts`, `delivery.ts`,
  `presentation.ts`, `dress.ts`, `../clinic/visibility.ts`, `src/game/peek.ts` (129 lines), `src/ui.ts` (501 lines),
  `src/audio/{cues,events,music,music-rules,samples}.ts` and `src/main.ts` where it plays sound. The 14 tangles (T1 to
  T14) were each found in the code as the survey describes them. The editor-gaps ledger has 76 rows (156 lines), and the
  survey's table names each row exactly once.
- **What names Ember Hall,** searched again on `81ce53a9` with a wider, case-insensitive pattern
  (`ember[ _-]?hall|base[-_]?3d|af-games/base`): 61 files outside `games/base-3d` and `docs/`, not 58 (finding 3).
- **Not run:** nothing was built or tested; `node_modules` is not installed in this container and this stage changes
  documents only. The FigureBuilder submodule was not needed and was not attached.

## Findings

Ranked: **blocking** (the plan as written would fail its own gates, break something, or contradict the spec or a
decision), **should fix** (a gap or a wrong fact a builder would hit), **tidy**. Each was fixed in the plan or the
survey in this branch unless it says **open**. Findings 30 to 32 come from the spec's two amendments and workstream 4's
spec, which landed while the audit ran; they are numbered last and ranked where they belong.

### Blocking

**1. The game's own sound table duplicates the framework's `audio` content kind.** Fixed.
Task 14 creates `content/sound/prologue.toml` and `src/features/sound/{sound-table.schema,sound-table,music-now}.ts`
(`SoundRow`, `MusicRow`, `soundTableSchema`, `musicNow`) for "which event plays which file or cue, and which music
when" (plan, task 14 and call 7; survey rows 49 and 51). `@automata/audio-synth`'s `audio` kind already holds all of
it: a cue whose `sound` is a core sound alias plays that recorded file in place of its voices, `event` rows map a sim
event (or a `*` pattern) to a cue or to `silent`, `slot` rows are music files with fallbacks, `linger` and `relief`,
and `music_rule` rows pick a slot, `hold` or `silence` from the game's state (`extensions/audio-synth/src/shared/audio.schema.ts:28-156`,
`src/features/synth/music.ts:54-110`, `createMusicDirector`). The Audio editor edits the music rules
(`extensions/editors/src/features/audio/AudioMusic.svelte`, `music-model.ts`). A second table in the game is the spec's
anti-goal ("a private copy, inside the game, of anything another game would need", spec line 67) and the plan's own
constraint, and it would leave which sound plays when out of the Audio editor (spec goal 3, "sound in Audio").
**Fix:** task 14 writes cues, events, slots and music rules in `content/audio/audio.toml`; the recorded files are
`sound` aliases registered with core; the game's `sound` feature only fills the music state from the sim each frame.
The file structure, the features table, call 7 and survey rows 49 and 51 say so.

**2. The prologue's recorded sounds are not the six files the survey lists.** Fixed in the plan and survey; the
question is **open** with the Owner (sent to the coordinator).
In the game at `92e6704`, the events table and the player send the prologue to these recorded files:
`cutscene.opening` plays `opening-ward.ogg`, `cutscene.keypad` `cabinet-open.ogg`, `cutscene.rest` `lamps-out.ogg`,
`cutscene.found` `pulse-counted.ogg` (`src/audio/events.ts:109-118`), and the figure (agent id `nurse`) entering
`dormant`, `patrol`, `investigate`, `hunt` and `flee` plays `nurse-settle`, `nurse-move-off`, `turn-to-sound`,
`nurse-sees` and `nurse-back-off` (`events.ts:77-79`, `src/main.ts:602`, `src/audio/cues.ts:141-145`).
`all-lamps-die.ogg` never plays: `lightsOut` has its own `sting` sound key, and a cutscene with sound keys skips its
event (`src/main.ts:344`, `src/scenes/prologue/cutscenes.ts:67`). The music has a fourth state the survey omits:
while Ada hides there is silence (`src/audio/music-rules.ts:80`, above the prologue's rows 81 to 83). The Owner's
decision names six files, made on the survey's list. **Fix:** the plan keeps the six (the decision binds) and takes
the sound table from the old event table: every recorded file it does not bring plays as a synth cue written new or
is silent, each a row of `audio.toml`, so a later swap is a content change. The music rules gain "hidden: silence".
The survey's sound section is corrected. Which other files cross is the Owner's (options A, B, C sent to the
coordinator; default A).

**3. Three editor journeys lean on Ember Hall through a constant, and the removal list misses them.** Fixed.
`packages/editor/tests/e2e/harness/fixtures.ts:23` defines `BASE_3D` as the path of `games/base-3d`, and three
journeys copy it: `packages/editor/tests/e2e/journeys/{dark-levels-3d,levels-3d-edit-reaches-the-game,new-3d-game-plays-its-edits}.test.ts`
(`test.use({ source: BASE_3D })`, `runGame(BASE_3D, …)`, `newGame(BASE_3D, …)`). The survey counted `fixtures.ts`
under "Others" but not the journeys, and its "Others: 8" names seven files (the eighth is `pnpm-lock.yaml`). Task 19's
grep test uses the four case-sensitive patterns, which miss `BASE_3D` and `base3dPort`, so it would pass while these
journeys break when task 20 deletes the folder. **Fix:** the survey's table and count (61 files) and task 19 name the
three journeys (they edit "the 3D reference game", so they move to The Last Light); the grep test is case-insensitive
(`ember[ _-]?hall|base[-_]?3d|af-games/base`).

**4. Deleting `games/base-3d` fails `pnpm source-names`, through the provenance record.** Fixed.
`docs/provenance/sources.md:91` records `games/base-3d/content/figure-actions/look.toml` as where a builder file was
ported, and `pnpm source-names` runs `sources-md-cli.ts --complete`, which reports a row whose AF path does not exist
(`tooling/repo-hygiene/src/sources-md.ts:87-88`, `sources-md-cli.ts:15`). **Fix:** task 20 repoints the row to the
same file at `packages/3d/tests/fixtures/content/figure-actions/look.toml`, and rewords line 83's note and line 673's
row (base-3d's four generated `.wav` files go with the folder).

**5. Task 19 changes tests and ports that only task 20's changes make true, then requires `pnpm check` to pass.** Fixed.
Task 19 has the three repo-hygiene gate tests "expect the new names" and gives Ember Hall's two ports to The Last Light
(plan, task 19), while root `package.json`, `.github/workflows/3d.yml` and `games/base-3d/e2e/origin.ts` (which imports
`base3dPort`) change only in task 20; step 3 requires `pnpm check` green with Ember Hall present. The tests pin today's
strings (`tooling/repo-hygiene/tests/unit/gate-scripts.test.ts:77`, `source-names-wired.test.ts:32`,
`workflow-invariants.test.ts:117-122`). Task 15 also gives The Last Light "a slot" in `ports.ts`, so the two tasks
disagree. **Fix:** task 15 adds a new slot for the game; task 20 removes Ember Hall's two slots and changes the three
pinned tests in the same commit as the scripts and the workflow.

**6. The new extensions and the game are not wired into the gates, so law 1 goes unchecked for them.** Fixed.
The root `boundaries` script names every sim folder it checks for I/O, wall clock and `Math.random`
(`--skip-dir … extensions/nav/src/shared/sim …`), and lists packages by name for `--features`, `--forbid …:effect` and
`--forbid …:@pixi/3d,figure-builder`; `style` lists `--plan-comments` and `--test-imports` folders by name; the
`test:unit:2d/3d` and `test:browser:2d/3d` filters split extensions by name (root `package.json`). Task 1 says to add
the new extension "only if they list extensions by name"; they do, and without it `extensions/interact/src/shared/sim`
is never checked as sim code and `@automata/hud`'s browser tests fall into the 2D job. Task 10 adds the game only to
`--plan-comments`, `--game` and "the 3D script filters". **Fix:** tasks 1 and 2 name each list; task 10 adds the game to
`--features`, `--forbid …:effect`, `--test-imports`, the source-names `--code` list (and its pinned test,
`source-names-wired.test.ts:32`) and the 3D filters; `ci:local` gains its journeys in task 15.

**7. The systems fixture's calls are not all accounted for, so the converted scene would not load or would run a dead
rule.** Fixed.
The fixture names the agent hooks `chase`, `replan`, `fleeGoal`, `stop` and `leave` and the rule calls `burnLight`,
`wake`, `vigil` and `footsteps` (`extensions/systems/src/testing/fixtures/prologue.systems.toml:304-360,596,667`). The
plan rewrites `chase` and `fleeGoal`, and gives `nightHooks` `wake`, `vigil`, `leave` and `resetFor`; `replan`, `stop`,
`burnLight` and `footsteps` have no fate. Rule R15 reads the fact `light` with `is = "off"` and calls `burnLight`
(the old lamp-as-lighter, T2), but the plan maps only `lit` and `fuel` and burns fuel in the lamp feature, so R15 would
name an unknown fact and an unknown call. **Fix:** task 11's converter rule lists every call with its fate: `chase` to
`goTo = "player"`; `replan` to a rule or effect `every` (task 4); `fleeGoal` to `flee = "light"`; `stop`, `leave`,
`wake` and `vigil` to `nightHooks`; R15 and its `burnLight` dropped (the lamp feature burns), reported; the `footsteps`
rule dropped (the night feature's steps system calls `systems.hear`), reported; any `light` condition rewritten to
`lit`. A content test asserts every call the systems file names is a hook the game passes.

**30. The plan keeps and leans on the 3D examples, which the spec now cuts in this slice.** Fixed.
The spec, amended at `864361d4` while this audit ran ("The 3D examples go too, and are recreated after the prologue"):
`examples/3d` and `examples/3d-story` are removed with Ember Hall when the prologue plays, the site's Examples page lists
no 3D example, and the 3D workflow's coverage comes from the reference game's journeys and the packages' browser tests.
The plan built on them: task 6 rewired `examples/3d/cutscenes/cutscenes-door-and-lamp.ts` and ran its journey, task 8
tested on `examples/3d-story`'s hall, task 9 looked at its props in `examples/3d/worldkit/`, and task 17 added a hotspot
and the HUD to `examples/3d-story`. **Fix:** tasks 6, 8 and 9 test on small scenes of their own package; task 17 is the
guide alone, with the prologue as its example; tasks 19 and 20 remove both folders (76 and 58 files, measured at
`32b90536`) and everything that names them (the 28 files of the measure below, and `extensions/systems/README.md`,
`knip.jsonc`, `pnpm-workspace.yaml` and the workflow for `examples/3d-story`), and the site's Examples page shows no 3D
example. The wardrobe example's garments are judged with the rest, as the spec says.

**31. The plan rules homes by the old rule, and three of its homes disagree with the spec's new examples.** Fixed.
(Sent to the coordinator as a contradiction; the spec was corrected at `909f6b10` while the audit ran, and the fix
follows it.)
The spec, amended at `acb0361d` ("Where a new piece goes"): core only what any game could use; an extension what is
generic within a genre; the game what is its alone; "the plan says for each addition which home it has and why; the plan
audit checks each one". The plan ruled by "core only if … both reference games need it" (its global constraint and
call 9) and had no table. Checked against the new rule: rooms per view is core (`@automata/3d`), as the spec's own
example says; peeking and hiding are `@automata/systems`, as its example says; delivery, the 3D stage, footsteps by
floor, the props and Sequence stay where planned; the vigil, the catch and the music state are the game's. Three
disagree with the spec's examples and cannot simply move: "using a thing in the world" and "a HUD drawn from data" are
named core, but `@automata/interact` imports `nav` and `puzzle`, and `@automata/hud` imports `puzzle` and `narrative`,
and core never imports an extension (`AGENTS.md`, `pnpm boundaries`); "a lamp that burns fuel" is named an extension,
and the plan has it as the game's. The spec's correction at `909f6b10` settles the first two: core imports no
extension and still needs every target or both reference games, so interact and the HUD are adventure-genre
extensions, with their dependency-free halves written so they can move to core later. It left "a lamp that burns fuel"
as its example of a genre extension. **Fix:** the plan's constraint states the rule; a "Homes" table rules every
addition; interact keeps its pending use and reach in a file that imports no extension, and the HUD its layout schema
and placing; task 4 adds a carried light that burns fuel to `@automata/systems` (beside light as a sense), and the
game's `lamp` feature keeps only the item, its numbers, the `fill` call and its lines. No piece the plan adds carries
the game's names (the props are named for what they are).

### Should fix

**8. The game's page and its layer test contradict the framework's feature rule.** Fixed.
The plan puts the page at `src/main.ts`, importing `app/`, and its architecture test allows "main → app" (plan, file
structure and task 10). The framework's `--features` rule lets only `entries/` and `testing/` import `app/`
(`packages/tools/src/features/boundaries/features.ts:9-17`), and Emberwick keeps `main.ts` at the package root with
`src/entries/` (`games/emberwick/main.ts`, `games/emberwick/src/entries/`). **Fix:** `main.ts` at the package root;
`src/entries/` in the layers; the architecture test states the same five rules as `--features`, and the game is in
`boundaries --features` (finding 6), so the two cannot disagree.

**9. The examine box and narrative's dialogue box would both draw, and the plan imports a name that is not exported.** Fixed.
Task 3 "consumes `dialogueBoxSlot`'s box from `@automata/narrative`", but narrative's entries do not export it
(`extensions/narrative/src/entries/index.ts`), and `narrativeExtension` puts its own box in `hud.overlay` whenever the
game passes `words` (`extensions/narrative/src/app/narrative.extension.ts:27-40`). **Fix:** task 3 adds an export of the
box component to narrative and the HUD's `examine` piece draws it in its placed region; the game passes no `words` to
`narrativeExtension`, so one box draws. Task 5's typing lands in that one component.

**10. Delivery's emphasis is dropped without a word.** Fixed.
The old delivery marks emphasis inside the words (`*not*`, `_not._`) and two pause lengths (`{.}`, `{..}`)
(`src/scenes/prologue/delivery.ts`, 22 lines); survey row 41 lists emphasis, but the plan's `Delivery` has only `how`,
`pace` and sentence `beats`. **Fix:** the plan says emphasis is not carried (it would put marks into translated words);
the converter reports each one as `approximated`, beside the moved pauses.

**11. Hotspot names have no place in the catalogs.** Fixed.
The 22 hotspot names are English in the blockout (`"Bed 04"`, `"Linen trolley"`) and the prompt shows them; the survey
says each becomes a message key (row 4), but task 18's catalog lists only "the HUD's action words and room names".
**Fix:** the converter writes `hotspot.<id>` keys and the English names into the game's `messages/ui/en.json`; task 18
translates them; "Bed 04" joins the never-translated terms where it is a bed number.

**12. Task 18's paths disagree with workstream 1.** Fixed.
Workstream 1 reads a game's fonts from `content/fonts.toml` and records translations in one `words-sources.json` at the
game's root (`docs/superpowers/plans/2026-11-11-shared-polish.md:340-341, 489-515`). Task 18 puts `fonts.toml` at the
game's root and omits `words-sources.json`. **Fix:** both paths corrected.

**13. The game's journeys use Ember Hall's old shape and lose WebKit.** Fixed.
Task 15 creates `e2e/origin.ts` at the package root; `AGENTS.md` puts end-to-end tests under `tests/e2e/`, as Emberwick
does (`games/emberwick/tests/e2e/origins.ts`). Ember Hall's journeys run three projects, one of them WebKit for the
Owner's iPad (`games/base-3d/playwright.config.ts`), and `3d.yml` installs WebKit for them; the plan's are Chromium
only, so removing Ember Hall would drop the only WebKit game journey in the 3D workflow. **Fix:** `tests/e2e/origin.ts`;
the game's config has a preview project and a dev project in Chromium and WebKit; WebKit runs on the runner and is
reported as not run here.

**14. The 3D workflow does not run the new game until task 20.** Fixed.
`3d.yml` runs on `games/base-3d/**` and runs only Ember Hall's journeys (`.github/workflows/3d.yml:20,81`), so the
second branch's pull request, which touches `games/the-last-light/**`, does not start it, and the journeys of task 15
are in no workflow. **Fix:** task 10 adds the path; task 15 adds the step. `workflow-invariants.test.ts` pins the paths
with `arrayContaining`, so adding one keeps it green.

**15. The frame budget cannot be measured here, and its harness does not play a game.** Fixed.
`tooling/frame-budget` measures its own stress scene, and reports a software renderer as "not comparable … never a
budget" (`tooling/frame-budget/src/budget.ts:74-130`); its 3D rows are targets until the Owner's GPU run
(`budget.json` note). Task 20 step 2 says to measure the prologue with `pnpm test:frame-budget` and write the number.
**Fix:** task 20 adds a probe project that opens the prologue's build, its row a target with the spec's numbers,
measured on the Owner's GPU runner; here it is reported as skipped.

**16. Using the register is not wired.** Fixed.
The old prologue's register is a save point with four lines (`presentation.ts`, `saves: registerAsk, registerSign,
registerLeave, registerSigned`). Survey row 26 says the three-line conversation is a `dialogue` file, but the fixture
has none (`prologue.dialogue.toml`: `graphs = []`), and no task says what using the register does. **Fix:** survey row
26 corrected; task 14 wires using the register to open core's save slots with the ask line, and the sign and leave
lines as its two answers, with a test; the empty dialogue file is not copied.

**17. `found` needs more than a camera anchor.** Fixed.
The old `found` puts the figure 0.9 m beside Ada where that spot is clear and seen, and picks the lens by distance
(`cutscenes.ts`, `found`: `moved`, `clearSpot`, `sees`, `fit`). Actor keys stand at an anchor's point with no offset
(`extensions/cutscenes/src/shared/sim/anchors.ts:19-30`). **Fix:** in task 11 the figure stands at her own anchor
(`actor:npc`, where she caught Ada), the step beside and the lens fitting are dropped and reported; the test that the
line and its timing hold covers `found` too.

**18. The published `@automata/puzzle` changes with no changeset or API report, and `VerbPayload` is not exported.** Fixed.
`@automata/puzzle` is published (`extensions/puzzle/package.json`: no `private`), and task 1 adds `applyVerb` to its
`./sim` entry; `AGENTS.md` asks for a `patch` changeset and `pnpm build`, `pnpm api-report --update`,
`pnpm api-index --write` after a changed export. Task 1 also "consumes" `VerbPayload`, which `./sim` does not export
(`extensions/puzzle/src/entries/sim.ts` exports `VerbCommand` only). **Fix:** task 1 exports both, with the changeset and
the reports.

**19. The private FigureBuilder submodule is not mentioned.** Fixed.
`pnpm install` and the typecheck need `vendor/FigureBuilder` at `d6e3c9fb` (`.gitmodules`; `vendor/figure-builder`'s
`src` and `base` are links into it), and it is empty in a fresh clone. **Fix:** "Before task 1" says to attach it read
only, place it at the pinned commit and commit nothing from it.

**20. Workstream 1's task 17 (Ember Hall in six languages) is still in its plan.** Fixed in this plan; **open** for the
coordinator. The plan says it is cut (the coordinator, 2026-11-11), but workstream 1's plan lists it on `main` and on
`claude/shared-polish-build` (`docs/superpowers/plans/2026-11-11-shared-polish.md:53, 1422-1445`). If it runs, Ember
Hall gains fonts, catalogs and a `words-sources.json` that tasks 19 and 20 must also remove. **Fix:** task 19 measures
again before it starts; the coordinator is asked to have workstream 1's plan record the cut.

**21. What follows the prologue's end is not said.** Fixed.
The old prologue ends by moving to act one after `rest` (`rules.ts`, `exit: w.rested ? { to: 'clinic', … }`); slice 1
has no act one. **Fix:** task 14: after `rest`, the game shows Credits (workstream 1) and returns to the title; the
journey of task 15 reads `rest` ending and the Credits screen.

**32. The dressing task does not know workstream 4, which now supplies its figures and goes first.** Fixed.
Workstream 4's spec (`44c4da09`, merged at `32b90536`) runs "ahead of the prologue's dressing tasks", ends when "the
prologue's dressing tasks can start", and adds "a ward nurse's uniform, street clothes, the Night Nurse, as
character-kit library entries, not per-character code" (its "Done means" line 4, "Finish" step 5, call 2); it also
takes over #588, which this plan listed among the superseded clinic branches. Task 13 made the figures itself from
whatever was on `main`. **Fix:** task 13 starts on workstream 4's word and picks its library entries in the Studio;
tasks 1 to 12 do not wait; the constraint on superseded branches leaves #588 to workstream 4; the survey's "What slice
1 waits for" names it.

### Tidy

**22. Seven of the lamps are of kinds the kit has, not nine.** Fixed in the survey (row 5): desk, two pendants, three
bulbs and a fluorescent; with four dark lamps, two moons and two fills that makes fifteen.

**23. The fixtures' headers say "Do not edit".** Fixed: task 11 rewrites the header of each copy (the game's file is the
source and is edited by hand and in the editors), and leaves the extensions' own fixtures as they are.

**24. The director takes a clip starter.** Fixed: `createDirector(script, startClip)` (`director.ts:38`) and scripts carry
`clips` rows; the 3D stage's `ActorView` gains `clip(name, at)`, passed as the start-clip function.

**25. `Rule.every` already exists.** Fixed: a rule already runs "every so often" (`systems.schema.ts:64`), so task 4
tries a `replan` rule on the clock first and adds `every` to `goTo` only if that cannot express it.

**26. The systems environment holds the player's entity, not a point.** Fixed: `SystemsEnvValue` is `player`, `moving`,
`lights`, `warmth` (`systems.resource.ts:195-203`); task 4 adds `facing` beside them and reads the point from the entity.

**27. `@automata/world-kit` is private.** Fixed: task 9 needs no changeset and no API report; the conditional is removed.

**28. The Sequence journey exists by name.** Fixed: task 8 extends
`extensions/editors/tests/e2e/journeys/sequence-shows-in-game.test.ts`.

**29. The cutscene mark is not the nav node of the same name.** Fixed: the bedside mark is where the old `bedside()`
falls back, `(-2.9, 0.7)`, not the nav node `bedside` at `(-2.9, 2.45)`; task 11 says so.

## What the merge order needs

The three branches hold together with workstream 1's: the framework branch touches no core file workstream 1 changes.
Three textual overlaps, each trivial, are named in the plan: `tooling/repo-hygiene/src/source-names.ts` (workstream 1's
`63afc47d` adds `superpowers` to the record folders; task 10a drops an entry a few lines above), `examples/README.md`
(both add rows) and the root `package.json` scripts. Task 18 merges `main` first, after workstream 1 has merged; the
second branch's other tasks do not need it.

## The 3D examples: decided while the audit ran

The coordinator's brief said the 3D examples' fate was pending and asked for no task. The spec settled it at
`864361d4` (merged here at `32b90536`): both `examples/3d` and `examples/3d-story` are cut in this slice and recreated
after it. That made it a spec section the plan had to cover, so finding 30 adds it to tasks 19 and 20 and takes it out
of tasks 6, 8, 9 and 17; the coordinator was told at once. What it adds, measured at `32b90536`: `examples/3d` is 76
tracked files (19 examples, each with a journey, and the `@af-examples/wardrobe-3d` workspace package),
`examples/3d-story` 58, and 28 files outside them and the record folders name `examples/3d` (`3d.yml`, root
`package.json` and `pnpm-workspace.yaml`, `knip.jsonc`, `.vscode/settings.json`, `examples/README.md`,
`docs/provenance/sources.md`, `tooling/examples-runner` ports and two tests, three repo-hygiene tests, six `packages/3d`
files, two character-kit files, the cutscenes README, three spike files, two Playwright configs and the lockfile).

## Counts

32 findings: 9 blocking, 15 should fix, 8 tidy. All are fixed in the plan or the survey. Two stay **open** outside
them, each sent to the coordinator: the Owner's answer on which recorded files cross (finding 2, default A), and
workstream 1's plan recording that its task 17 is cut (finding 20). The homes question (finding 31) was settled by the
spec's correction at `909f6b10` during the audit.
