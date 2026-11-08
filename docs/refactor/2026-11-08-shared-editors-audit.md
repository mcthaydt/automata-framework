# Share every editor between 2D and 3D: audit

The Owner, 2026-11-08 14:26: "I mean, editors should be shared - all editors should work between 2D and 3D unless
obviously not like 2D editor vs 3D editor."

Read as: every editor except the two level editors (Levels 2D for a 2D game, Levels 3D with its Walk view for a 3D one)
is on the rail of every new game of either kind, and what a person makes in it shows up when the game is played and in
what Publish ships. Characters is the one editor whose reading was not obvious; the Owner decided it (D1, A): one
Characters editor on the rail in both kinds.

This is stage 1 (audit) of the pipeline. It was made on PR #508 (branch `claude/complete-game-journeys`, head
`89db7336`), which joins the content editors (#498), content in play (#494), Schematic's fixes (#497), the whole-game
loop's fixes (#485) and Levels 3D on af-sector/2 (#499). The hand checks ran on `d4b23841`, #508 before its last merge
of #498; that merge touched none of the files cited here (checked with `git diff`). Every finding says what was run or
read.

## The answer

What blocks each editor in each kind of new game today. "Works" means made in the editor, played and seen.

| Editor | New 2D game | New 3D game |
| --- | --- | --- |
| Levels 2D / Levels 3D | Works (its own kind only, by design) | Works, except a floor's or ceiling's material (known) |
| Characters | Not an editor: a view inside Levels (D1) | Works (Wick's figure, swatches and gait) |
| Tuner | Controls only; no settings file, and "Make one" is refused (S8) | Settings only; the controls are code (S8) |
| Feel | Works | Not on the rail (S1); no player and no events in the game (S2, S5); squash and freeze miss 3D characters (S6) |
| Audio | Works | Not on the rail (S1); no player and no events in the game (S2, S5) |
| Writer | Not on the rail (S1); the game has no dialogue box, so words are dropped without a word (S2, S3) | Same as 2D |
| Sequence | Not on the rail (S1); the game has no cutscenes, so scenes are dropped without a word (S2, S3) | Same, and the editor itself is 2D-shaped: no room in the preview, lamps and doors typed as ids, no 3D stage (S7) |
| Schematic | On the rail, but "Add the systems extension to your game" (S2) | Not on the rail (S1); same as 2D once listed |
| Play | Works | Works |
| Publish | Works | Refused while Pixi 3D is a closed beta (by design, the Owner's rule) |

Outside this repository it is worse for both kinds: the published tools carry only the page with Levels and the Tuner,
and the extensions Writer, Sequence and Schematic need are private (S4).

There are three kinds of blocker, and every editor but the level editors has at least one:

1. **The suite.** The rail hides any editor the game's list does not name (S1), the server reads the list once (S9),
   and the published tools and the site carry only the 2D page (S4, S10).
2. **The templates.** Neither new game wires the players for Writer, Sequence or Schematic, the 3D one wires none at
   all, and the 3D game says nothing happens that Feel or Audio could answer (S2, S5, S13).
3. **Code tied to one kind.** Feel's stage reaches only 2D characters (S6); Sequence reads only 2D levels and has only
   a 2D stage (S7); the 3D controls cannot be content yet (S8).

## What was done by hand

In a cloud container (Node 24.21.0, Chromium; WebKit and Firefox are not installed here):

1. `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm --filter @automata/editors build`: all exit 0.
2. The complete-game journeys, `pnpm exec playwright test -c playwright.journeys.config.ts complete-game --project
   editor-ipad-chromium`: 12 passed in 1.8 min. That is both complete-game journeys, and the ten expected failures
   failing for their stated reasons.
3. **A 2D game, by hand** (a script in the shape of the journeys' `newGame`: `automata create-game`, packages linked
   from Emberwick's install, then the built `automata editor`). At iPad size (1180 × 820) the rail read
   `Tuner, Levels, Feel, Audio, Schematic`. In Feel, the square bumping a wall got a 30-frame white flash; the file was
   written with no Save. Play opened the game; holding Left into the wall took the game's mean brightness from 47.7 to
   174.5, and the screenshot shows the white wash and "Bump!" (`2d-play-flash.png`). **Made, played, seen.**
4. In that game, Schematic opened on "This game does not use characters that think yet. Add the systems extension to
   your game to use Schematic. How to add it". Writer and Sequence were not on the rail. Adding their rows to
   `content/editors.toml` by hand and reloading put them on the rail, each on a start page ("This game has no words
   yet…", "This game has no cutscenes yet…"). The game cannot show either (S3).
5. In that game, the Tuner showed the controls and "This game has no settings file yet. Make one". Make one wrote
   nothing and said `content/tuning.toml: content/tuning.toml is read only: no row of content/editors.toml lists it`.
6. **A 3D game, by hand** (`create-game --template 3d`, packages from base-3d's install). The rail read
   `Tuner, Levels, Characters`. Played as it comes, then Wick's height set to the most in Characters (`height = 240`
   written), then played again: Wick stands about twice as tall (`3d-play-before.png`, `3d-play-after.png`).
   **Made, played, seen.** The Tuner shows "Walking speed, 4 m/s" and no controls.
7. In that game, the rows for Feel, Audio, Writer, Sequence and Schematic were added to the list by hand. After a
   reload all eight editors were on the rail, but "Start a feel file" was refused: `content/feel/feel.toml is not one
   the editor may write`. The server had read the list when it started (S9). After restarting `automata editor`, the
   feel file started, and "What happens in the game?" offered only "Something else" with an empty box to type an id
   into (`3d-feel-events-ipad.png`). Sequence's new cutscene showed an empty box with a camera wedge and "Walls show for
   2D levels only, for now." (`3d-sequence-started-ipad.png`). Schematic said the same as in 2D.
8. **Do Feel and Audio's players work in a 3D game?** In a copy of the new 3D game, by hand: a `wick.bumped` event
   when Wick is pushed into a wall, the 2D template's `feel-audio.ts` unchanged (`renderer: { setup: feelOnStage }`,
   `audio`), and `feelContent`/`audioContent` in the Vite config. Walking into the far wall, the per-frame brightness
   read `60, 57, 56, 157, 157, 157, 157, 56…`, and the page started an 880 Hz tone. **The flash, the shake and the
   sound carry over to 3D with no change to Feel or Audio.** Squash and freeze do not (S6, by reading).
9. With all eight editors listed, a phone (390 × 844) rail is 437 px of tabs in 390 px: Schematic sits off the right
   edge (`3d-phone-8-editors.png`).

Screens and the run log: `/mnt/project-files/refactor/2026-11-08-shared-editors-audit-screens/` (`log.txt` has every
line quoted above).

## Findings

### High

**S1. The rail hides every editor the game's list does not name, against the Owner's ruling.**
`suiteEntries` keeps only listed editors (`packages/editor/src/features/suite/shell/suite-entries.ts:44`), added on
2026-11-08 07:27 in "fix(suite): a game's own editors by their names" (`4cc4c4e1`). The content editors' spec records
the Owner's ruling of the same morning: "Every registered editor stays on the rail, whether or not the game has its
files yet… that leaves a game with no sounds no way to add its first one. Reverted." (`2026-11-08-content-editors-spec.md`
§7). This filter is the direct reason Writer and Sequence are missing from a new 2D game, and five editors from a new
3D game. The page's own comments disagree: `content-editors.ts:1` says the rail shows every one, `main.ts:23` says
only the listed ones. *Direction:* the rail shows every editor the page has, except the other kind's level editor;
an editor whose file the game lacks opens on its start page, as the spec says.

**S2. Neither template wires the players the editors need, and the 3D one wires none.** What each new game has:

| Needs | New 2D game | New 3D game |
| --- | --- | --- |
| Feel: `@automata/feel` stage on `renderer.setup` | Yes | No |
| Audio: `@automata/audio-synth` stage on `audio` | Yes | No |
| Writer: `@automata/narrative` (needs places and `puzzle`), its dialogue box, and something that starts a conversation | No | No |
| Sequence: `@automata/cutscenes` (needs places, nav, narrative), a stage and a caption | No | No |
| Schematic: `@automata/systems` (needs places, nav, puzzle) | No | No |
| A places provider | No (`level2dPlaces` from `@automata/level-2d`) | No (`sectorsPlaces` from `@automata/sectors`) |
| Rows in `content/editors.toml` | Feel, Audio, Schematic | None of the five |

`examples/2d-story` proves the 2D wiring works (all five editors, `story.extensions.ts`); `examples/3d-story` proves
Schematic in 3D. No game proves Feel, Audio, Writer or Sequence in 3D. The content editors' spec (§7) already asked that
"create-game's template list names every content editor's files"; the 2D list's comment instead waits for "a dialogue
box and cutscenes" (`template-content/editors.toml:14`). *Direction:* both templates wire every content player and
start with one small file per editor, so the first thing made in each shows in play.

**S3. Writer, Sequence, Feel and Audio write files the game ignores, and say nothing.** The content compiler reads only
the folders of the game's registered kinds (`packages/content/src/shared/compile/read-sources.ts:7`), so a lines,
dialogue or cutscene file in a new 2D game, or a feel or audio file in a 3D one, is dropped without a message. Only
Schematic looks for its player (`schematic-facts.ts:31`, the game's `package.json`). This breaks the house rule that a
missing extension "fails and says so". *Direction:* one shared check that each editor's player is in the game, and a
sentence a person can act on when it is not; the templates (S2) make it true for new games.

**S4. A game made outside this repository gets only Levels and the Tuner.** The published tools pack the 2D page
alone (`editor-command.ts` `BUILDS`: the full page is "built in the repository only"). A new 2D game lists Feel and
Audio, so every one made with the published tools prints "Feel and Audio are not in this release yet, so the editors
show Levels and the Tuner." (`editor-command.ts:108`), although the game plays both (`@automata/feel` and
`@automata/audio-synth` are public). The extensions Writer, Sequence and Schematic need are private: `narrative`,
`cutscenes`, `systems`, `nav`, `places`, `level-2d`, `sectors` (and the editors package itself). The 3D editors and
`@automata/3d` stay repo-only while Pixi 3D is a closed beta, which is the Owner's rule. *Direction:* the tools pack one
page with every editor except the 3D ones (its build must still carry no `@pixi/3d`), and the free extensions are
published like Feel and Audio. Publishing is a release, so the release run stays the Owner's.

**S5. A 3D game says nothing happens, and the list of a game's events is never written.** The 3D template defines no
event at all, so Feel and Audio have nothing to answer: step 7's "What happens in the game?" offered only "Something
else" and a box for an id. The content editors read "the game's own list" from `content/generated/events.json`
(`extensions/editors/src/shared/game-events.ts:24`), but nothing in the repository writes that file; only the
editors' tests do. A 2D game shows its bump only because the starter feel file already answers it. *Direction:* the
content build writes the game's event ids, and the 3D template says when Wick bumps into something.

### Medium

**S6. Feel's stage reaches only core's 2D characters.** `feelStage` squashes, freezes and places words through
`stage.consumer` (`extensions/feel/src/app/feel-stage.ts:107`, `:123`, `:134`, `:157`). The 3D renderer draws its
characters through its own `RenderDeltaConsumer` over the 3D view (`packages/3d/src/app/create-renderer.ts:173`), which
`PixiStage` does not expose. So in a 3D game a squash or a freeze does nothing, and a word meant for a character shows
in the middle. The shake and the flash work (step 8). *Direction:* the 3D renderer hands Feel its characters.

**S7. Sequence is shaped for 2D.** The preview draws walls only from a 2D level (`plan-view.ts:33`, "Walls show for
2D levels only, for now."). People come only from 2D levels' named characters, at a fixed 16 px a metre
(`sequence-names.ts:96`). Lamps, doors and props come only from other cutscenes, so in a 3D game a person types an id
such as `prop0.light0`. The cutscenes extension has a 2D stage (`@automata/cutscenes/stage-2d`) and no 3D one: the 3D
examples move the camera, doors and lamps in their own code (`examples/3d/cutscenes/`). *Direction:* Sequence reads a
3D level's rooms, characters, lamps, doors and props; the cutscenes extension gets a 3D stage.

**S8. Each template gives the Tuner half a game.** A new 2D game has `content/controls.toml` and no settings file (its
speed is a code constant), and the Tuner's "Make one" is refused in file words (step 5). A new 3D game has
`content/tuning.toml` and its controls in code (`template-3d-game.ts:80`, `:96`). They cannot simply move to
`controls.toml`: it has digital stick directions and a camera drag, but not the analog move stick the 3D game reads.
*Direction:* both templates get both files; the controls file learns an analog stick.

**S9. The editor server reads the list once.** The write policy is read when `automata editor` starts
(`serve-editor.ts:263`), and so is the choice of page (`pageFor`). Schematic's start page tells a person to add rows to
the list "then come back"; after doing so the page shows the editor but every write is refused (step 7) until the
command is restarted, and a game that started on the 2D page never gets the others. *Direction:* the server reads the
list again when it changes; one page for every game removes the page choice.

**S10. The site's Try-it shows two editors.** `site/scripts/build-demos.ts:67` copies `packages/editor/dist/suite`,
Levels and the Tuner. The full page's own sample (`extensions/editors/src/app/suite/sample-game.ts`) has a file for
each content editor but no level. *Direction:* Try-it serves the shared page with a sample that has a level and a file
for each editor.

**S11. "Characters" is two different places.** In a 3D game it is an editor on the rail (the Studio, `id: 'studio'`,
`label: 'Characters'`). In a 2D game it is a view inside Levels (the "Characters" choice beside "Level" and "Tiles"),
where a character's picture and animation are set. A person who has used one kind looks for it in the wrong place in
the other. See D1.

**S12. A phone cannot fit every editor's tab.** With eight editors the tab bar is 437 px wide on a 390 px phone and
Schematic is off the right edge, with nothing saying there are more (step 9). Tuner and Feel are already at 44 px.
Sharing every editor makes this the normal case. *Direction:* design the bar for eight or nine editors at phone size
first.

**S13. A conversation needs more than its words.** `narrative` requires a places provider and `puzzle`
(`narrative.extension.ts:35`); `cutscenes` requires places, nav and narrative (`cutscenes.extension.ts:33`); `systems`
requires places, nav and puzzle (`systems.extension.ts:19`). And something must start a conversation or a cutscene: in
`examples/2d-story` that is the story's own sim plugin. The Owner's rule is that behaviour stays code, so the template's
code must already do it, for example "walk up to a named character and its conversation starts". Without that, Writer
and Sequence can be listed and wired and still show nothing.

### Low

**S14. Words that fail the drunk grandma test.**
- Schematic: "Add the systems extension to your game to use Schematic", with "How to add it" linking to a README in
  this private repository (`SchematicStart.svelte:12`), and "Your game's list of editors does not name these files yet.
  Add this to it" over a block of TOML.
- Refusals in file words: "content/feel/feel.toml is not one the editor may write", "content/tuning.toml is read only:
  no row of content/editors.toml lists it".
- Home's cards repeat themselves ("Feel / Feel", "Audio / Audio") or say only "No files yet."
- The iPad rail cuts "Characters" to "Characte…" (`3d-home-ipad.png`).
- Feel's "Something else" asks for an event id typed by hand.

**S15. Comments that no longer say what the code does.** `packages/editor/src/app/suite/main.ts:19` ("Only these two:
the other suite editors are 3D … or not built yet"); the 2D template list's comment on Writer and Sequence; the two
contradicting rail comments in S1.

**S16. Schematic's places are numbers.** In both kinds a place is "Across" and "Down" in metres
(`PlacesCanvas.svelte`), never drawn over the level, so a person cannot see where a guard will walk. Not a sharing
blocker; worth a line in the plan.

### Known and kept

- **Levels 3D floor and ceiling materials.** Change materials opens the sheet for the walls only
  (`SectorCard.svelte:111`, `surface: 'walls'`). Levels 3D's own gap, not a sharing one; its journey stays `test.fail`
  until fixed.
- **Publish refuses a 3D game** while Pixi 3D is a closed beta. By design; its journey stays `test.fail` until Pixi 3D
  is public.

## The expected failures on #508, and what clears each

| Journey (marked `test.fail`) | Cleared by |
| --- | --- |
| 2D: Writer is on a new 2D game's rail | S1 (and S2, S13 so what Writer makes shows in play) |
| 2D: Sequence is on a new 2D game's rail | S1 (and S2, S13) |
| 2D: a character can be added in Schematic | S2 |
| 3D: Feel, Audio, Writer, Sequence, Schematic on the rail (five journeys) | S1, then S2, S5, S6, S7, S13 for play |
| 3D: a room's floor gets another material | Levels 3D (known) |
| 3D: published as one zip | Pixi 3D going public (kept) |

Being on the rail is not the bar. Each mark should come off with a journey that makes something in that editor and
sees it in play: a line in the dialogue box, a cutscene's caption and camera, a guard walking its route, and in 3D
Feel's flash and Audio's sound.

## Decision for the Owner

**D1. What does Characters mean in a 2D game?** *Decided: A (the Owner, 2026-11-08 15:21).*

- **A (recommended): one Characters editor on the rail in both kinds.** In a 2D game it edits each character's
  picture and animation, which live in Levels' Characters view today; placing characters stays in Levels. In a 3D game
  it stays the figure editor. Same name, same place, small change.
- **B: Characters makes figures for both kinds.** A 2D game draws a figure as a pixel-art sprite in eight directions,
  as FigureBuilder was built to do. One editor for both, but a sprite baker in core, which is a large piece of work.
- **C: keep it as it is.** Characters is 3D only; 2D characters stay inside Levels.

Asked for the pros and cons first ("our figure builder was designed for 3D"), the Owner chose A. FigureBuilder builds a
3D rig, but its own output is a pixel-art sprite in eight directions; AF draws the figure as a Pixi 3D mesh, and the 3D
trim cut the CPU painters (`2026-11-07-3d-scope-trim.md`, task 8.2). So B is left for later, not ruled out: it would
come as a "Build a figure" choice inside the same Characters editor, from an extension, with the painter run when the
game is built and writing the picture-and-frames file a 2D character already reads, so a 2D game needs nothing new to
play it. Nothing A builds is thrown away by B.

## Not run

- WebKit and Firefox (not installed in cloud sessions); the GPU runner's suites.
- The phone size of the complete-game journeys (the iPad size ran; #508 reports both green).
- `pnpm check` (this stage adds only this document).
