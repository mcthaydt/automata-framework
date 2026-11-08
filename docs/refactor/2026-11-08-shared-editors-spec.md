# Shared editors: spec

The Owner, 2026-11-08 14:26: "editors should be shared - all editors should work between 2D and 3D unless obviously not
like 2D editor vs 3D editor." The Owner, 15:21, on the audit's D1: **A**, one Characters editor on the rail in both
kinds.

This is stage 2 (spec and plan) of the shared-editors pipeline. It answers the audit
([`2026-11-08-shared-editors-audit.md`](2026-11-08-shared-editors-audit.md), PR #509) and is built on PR #508
(`claude/complete-game-journeys`), whose `test.fail` journeys it turns into passing make-and-play journeys. Every path
and line cited here was read on #508 at `89db7336`. The plan is
[`2026-11-08-shared-editors-plan.md`](2026-11-08-shared-editors-plan.md).

## 1. What "shared" means

Every editor except the two level editors is on the rail of every game of either kind, and what a person makes in it
shows when the game is played. Levels 2D belongs to 2D games and Levels 3D (with Walk) to 3D games. Characters is one
rail entry with different insides per kind (section 3).

The bar for each editor is the one the audit set: made in the editor, played, seen. A journey proves it, not a rail
check. "On the rail" alone never takes a `test.fail` mark off.

## 2. What is not in this plan

- **Which editors are free on the web.** The Owner's pricing (2026-11-08 14:53) keeps only the essentials on the web
  and puts the full suite in the paid desktop and mobile apps. Which editors are the essentials is still the Owner's
  call (the apps audit's D1, `/mnt/project-files/refactor/apps-audit.md` §4). So this plan does not change what any
  page registers or what the published tools and the site carry. The audit's S4 (published tools pack every editor)
  and S10 (Try-it serves every editor) are dropped from this pipeline and belong to the apps work. Every rule below
  works on "the editors this page registers", whatever that set turns out to be. Characters for 2D stays inside the
  2D page because it is part of Levels 2D (section 3), so the apps audit's recommended free set loses nothing.
- **Building 2D figures from FigureBuilder** ("Build a figure", D1's option B). A possible later extension; nothing here
  blocks it.
- **3D controls as content** (half of S8). The 3D template reads two commands (move and camera turn) with an analog
  stick and a drag. `content/controls.toml` holds one command and digital stick directions
  (`packages/content/src/shared/controls/controls.schema.ts:87`). Making it hold both is a controls-format change with
  its own spec. Here the Tuner says so in words in a 3D game (section 9).
- **Schematic's places drawn over the level** (S16). Worth doing; not a sharing blocker.
- **Levels 3D floor and ceiling materials** and **Publish of a 3D game** stay `test.fail` (the audit's "known and
  kept").

## 3. Characters (D1 = A)

**One rail entry, "Characters", in both kinds.**

- **In a 3D game** it is the Studio, unchanged (`packages/editor-3d/src/features/studio/studio-suite-editor.ts`,
  id `studio`).
- **In a 2D game** it is Levels 2D's Characters view, which moves out of Levels' view tabs and onto the rail. Today the
  view is the third tab of Levels 2D (`packages/editor/src/app/suite/levels-2d/Levels2dTools.svelte:22`). After this
  change Levels' tabs are "Level" and "Tiles"; the rail has "Characters" right after "Levels".

**Why a rail entry that opens a view of Levels 2D, and not a second editor.** A 2D character's picture, its frames and
its clips are entity definitions inside the level project (`content/levels/*.af2d.json`), the same file Levels 2D
edits. Two editors on one file would mean two histories and two write queues on one path: each would see the other's
saves as a conflict, and the top bar's Undo (one history per owner on the write path, EDS-D19,
`packages/editor/src/features/suite/shell/suite-session.ts:12`) would replay steps out of order. One editor with two
rail entries keeps one history, one write queue and one owner. Undo in Characters takes back the last change to the
project, whichever entry made it, and its label says which ("Undo Paint tiles").

**The mechanism.** A suite editor may contribute more than one rail entry. Each entry names a view of the editor's
session. The suite opens the editor once (sessions are kept per editor id, as now) and, on choosing an entry, asks the
editor to show that view before its regions draw. Levels 2D gives two entries: `levels-2d` ("Levels", views Level and
Tiles) and `characters-2d` ("Characters", the Characters view). Placing a character in the level stays in Levels.

**Labels.** As with Levels, a game with one kind calls it "Characters"; a game whose list names both level editors calls
the two "Characters 2D" and "Characters 3D".

**Home.** Home's cards follow the rail: a 2D game shows a "Characters" card that opens the Characters entry with the
level project's files.

## 4. The rail

**Rule.** The rail shows every editor this page registers, in the order it registers them, except an editor for a kind
the game is not. The page knows nothing about which editors the game wants; the editor list says which files each
editor edits, not which editors exist.

- An editor or entry declares its kind: `'2d'`, `'3d'`, or none (both). `levels-2d` and `characters-2d` are `'2d'`;
  `levels-3d` and `studio` are `'3d'`; the Tuner and the content editors have none.
- **The game's kinds** come from its editor list: `'2d'` when a row names `levels-2d`, `'3d'` when a row names
  `levels-3d`. A list that names neither, or a list that did not load, counts as both kinds (every editor shows, as
  today's unloaded-list case).
- This reverses the filter added in `4cc4c4e1` (`packages/editor/src/features/suite/shell/suite-entries.ts:44`) and
  restores the content editors spec's §7 ruling: every registered editor stays on the rail whether or not the game has
  its files yet.

**An editor the list does not name** has a Home card and a rail entry with no files. Opening it shows its start page
(each content editor has one already, e.g. "Start a feel file"). Starting a file first adds the editor's rows to the
game's list (section 5), then writes the file.

**Phone.** With nine editors the tab bar no longer fits a 390 px phone (S12: eight tabs are 437 px). The tab bar shows
as many whole tabs as fit at their current size and puts the rest under a last tab, "More", which opens a menu of the
rest by name. The open editor is always one of the shown tabs (it takes the last plain slot when it would be under
More). Tabs keep their 44 px height; nothing shrinks to fit. The rail on a phone held sideways already folds into the
top bar's Editors menu; that stays.

## 5. Adding an editor to a game's list

A start page today tells a person to copy TOML into `content/editors.toml` (Schematic's `LIST_ROWS`,
`extensions/editors/src/features/schematic/schematic-facts.ts:9`), and even then every write is refused until
`automata editor` restarts (S9). Both go.

- **The rows each editor needs live in one place**: `editorRows(id)` in the editor-list module of `@automata/editor`,
  for `tuner` (both kinds' files), `feel`, `audio` (with `assets/music/*`), `writer`, `sequence` and `schematic`.
  Schematic's `LIST_ROWS` is deleted in its favour.
- **The suite adds them.** Starting a file (any content editor's start page, and the Tuner's "Make one") first calls
  `ensureListed(workspace, id)`: if the list lacks any of `editorRows(id)`'s globs for that editor, the rows are
  appended to `content/editors.toml` through the suite's own ports, not the editor's, so it is not an undo step: Undo
  after Start takes back the new file and leaves the editor listed, which is harmless (an empty listed editor is what
  the rail shows anyway). Then the file is written as today.
- **The server lets a list grow, never shrink.** `content/editors.toml` becomes writable through the editor server
  only by a write whose new text loads and keeps every row of the old text unchanged, in order (rows may only be
  appended). Any other write of the list is refused with "The editors can only add to this game's list of editors."
- **The server reads the list again** whenever it changes on disk (S9): the policy is looked up per request and
  rebuilt when the list's mtime moves. A row added by hand works without restarting. The page choice (`pageFor`) is
  untouched (section 2).

## 6. A game says when it cannot play what an editor makes

The content compiler reads only the folders of the game's registered kinds
(`packages/content/src/shared/compile/read-sources.ts`), so a dialogue file in a game without the narrative extension
is dropped without a word (S3). Each content editor now checks once, when it opens, whether the game's code has its
player, using the game's `package.json` dependencies (as Schematic does today, `schematic-facts.ts:31`):

| Editor    | Player package          | What it plays         |
| --------- | ----------------------- | --------------------- |
| Feel      | `@automata/feel`        | what the player feels |
| Audio     | `@automata/audio-synth` | sounds and music      |
| Writer    | `@automata/narrative`   | conversations         |
| Sequence  | `@automata/cutscenes`   | cutscenes             |
| Schematic | `@automata/systems`     | characters that think |

Without its player, the editor's start page and its status line say, in these words:

> Your game can't show conversations yet.
> Its code doesn't have the part that plays them. Games made with a new copy of the tools have it.

("conversations" is the "What it plays" column.) No link to a repository README. The editor still edits; a person may
be writing ahead of the code. A `package.json` that cannot be read counts as having the player (as today).

## 7. The game's events

Feel and Audio offer "What happens in the game?" from `content/generated/events.json`
(`extensions/editors/src/shared/game-events.ts:24`), which nothing writes (S5).

- **The content plugin writes it.** On every dev start and build, `automataContent`
  (`packages/content/src/features/vite/automata-content.ts`) scans the game's `src/**/*.event.ts` files for
  `defineEvent('<id>'` or `defineEvent("<id>"` and writes `{ "events": ["<id>", …] }`, sorted, to
  `content/generated/events.json`. The scan is text, not code: sim files are found by role suffix (the framework's
  layout rule), and an event file whose id is not a string literal is skipped. `content/generated/` is already
  ignored by new games' `.gitignore`.
- **The 3D template says when Wick bumps into something**: `wick.bumped`, emitted once when a move is blocked, in the
  shape of the 2D template's `square.bumped` (`packages/tools/src/shared/create-game/template-game.ts:19`).
- Feel's "Something else" box stays for events the scan cannot see, with the words "Another event (its name in the
  code)".

## 8. Characters in Feel, on both kinds

Feel's stage squashes, freezes and places words through `stage.consumer`
(`extensions/feel/src/app/feel-stage.ts:107`, `:123`, `:157`), which is core's 2D consumer. The 3D renderer draws its
characters through its own consumer (`packages/3d/src/app/create-renderer.ts:173`), so in 3D a squash or a freeze does
nothing and a word shows mid-screen (S6).

**Core gets a stage port for characters**, `StageCharacters`, on `PixiStage` as `characters`:

- `point(ref)`: where a character's top is, in `stage.ui`'s coordinates, or `undefined`;
- `squash(ref, x, y)`: scale a character's view by `x` and `y` from its own resting scale;
- `rest(ref)`: put that scale back;
- `hold(refs)`: hold these characters' poses until the next `hold`.

The 2D renderer provides one over its consumer (today's behaviour, moved). The 3D renderer replaces it with one over its
3D consumer when it mounts: `point` projects the character's position plus its height through the 3D camera, `squash`
scales the `Container3D`. Feel uses only `stage.characters`, read each frame. `PixiStage.consumer` stays for other
users.

## 9. The templates

A new game of either kind starts with **every content player wired and one small file for each editor**, so the first
change in each editor shows in play (S2, S13). The examples prove the wiring: `examples/2d-story` for 2D and
`examples/3d-story` for Schematic in 3D. The template's code does what the Owner's rule says code does (behaviour);
the files are content.

**Both kinds:**

- A **keeper**, a named character standing in the level, who says one line when the player walks up to him (the
  conversation `keeper`, two lines and one choice). Walking up starts it; walking away and back starts it again. This is
  `examples/2d-story`'s `story.system.ts` trimmed to the keeper.
- The conversation's last choice, "Show me", plays the cutscene `look` (the camera moves to the keeper and back, with a
  caption).
- A **guard** who walks a route of three places between two points (`content/systems/guard.toml`,
  `content/nav/guard.toml`).
- Feel (`content/feel/feel.toml`: a flash on the bump) and Audio (`content/audio/audio.toml`: a bump sound), as the 2D
  template does today.
- `content/editors.toml` lists every editor's rows (`editorRows`), and the list's comments say what each row is for in
  a sentence, not when it will be listed.
- **A settings file and a controls file.** 2D: `content/tuning.toml` holds the square's speed (moved from
  `src/shared/constants.ts`'s `SPEED`), so the Tuner's settings work in a new 2D game. 3D: keeps `content/tuning.toml`
  and its code controls; the Tuner's Controls part says "This game's controls are in its code." (section 2).

**3D only:**

- Feel and Audio wired as in 2D (`renderer: { setup }` and `audio`); the audit's step 8 showed the 2D template's
  `feel-audio.ts` works unchanged in 3D. The two templates share one source for that file.
- Places from `sectorsPlaces` (`@automata/sectors`), the keeper and the guard as figures from the base pair.
- The cutscene played by the new 3D stage (section 10).

The template files stay under 600 lines each; the story code moves into its own template module per kind.

## 10. Sequence on a 3D game

Sequence reads only 2D levels and the cutscenes extension has only a 2D stage (S7).

- **Sequence reads a 3D level's names**: walls from each sector's outline (one segment per corner pair), people from
  the level's cast (`castPlaceSchema`: `id`), lamps (`lampPlaceSchema`: `id`), doors (each sector's doors) and props
  (`propPlaceSchema`: `id`), all in metres (a 3D level is in metres already). The preview's "Walls show for 2D levels
  only, for now." goes. Lamps, doors and props are offered by name in pickers, as people are today.
- **`@automata/cutscenes/stage-3d`** plays a placed script in a 3D game: it moves the 3D camera, opens doors (piece
  states), sets lamp levels on the scene light and shows the caption. It is `examples/3d/cutscenes/cutscenes-door-and-lamp.ts`'s
  view code made into an entry, in the shape of `stage-2d`. The example then uses the entry.
- **Anchors**: `sectorAnchors(level)` in `@automata/sectors/sim` answers `actor:<id>` from the cast's places, the 3D
  twin of `levelAnchors` (`@automata/cutscenes/sim`).

## 11. Words (S14)

Every sentence a person reads in this work passes the drunk grandma test. Replaced:

| Where                                 | Today                                                                              | After                                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Schematic start page                  | "Add the systems extension to your game to use Schematic" + "How to add it"        | Section 6's sentence ("Your game can't show characters that think yet. …")             |
| Schematic start page                  | "Your game's list of editors does not name these files yet. Add this to it" + TOML | Gone: Start adds the rows (section 5)                                                  |
| Any refused write of an unlisted file | "content/feel/feel.toml is not one the editor may write"                           | "This game's list of editors doesn't include Feel yet. Press Start to add it."         |
| Tuner, 2D, no settings file           | "Make one" refused in file words                                                   | Make one adds the Tuner's rows and writes the file                                     |
| Home cards                            | "Feel / Feel", "No files yet."                                                     | The editor's name once; a card with no file says "Nothing made yet. Open it to start." |
| iPad rail                             | "Characte…"                                                                        | "Characters" in full (the tab's width follows its label up to the longest editor name) |
| Feel's event picker                   | "Something else" + an id box                                                       | "Another event (its name in the code)"                                                 |

## 12. Comments (S15)

The comments that no longer say what the code does are rewritten in the same change as the code they describe:
`packages/editor/src/app/suite/main.ts:19`, `extensions/editors/src/app/suite/main.ts:22`,
`extensions/editors/src/app/suite/content-editors.ts:1`, `suite-entries.ts:40`, the template lists' comments, and
`page-for.ts:3`.

## 13. Proof

Each `test.fail` mark on #508 comes off when a journey that makes something in that editor and sees it in play passes:

| Mark today                                | The journey that replaces it                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 2D: Writer on the rail                    | The keeper's line changed in Writer; walking up to him in Play shows the new words in the dialogue box |
| 2D: Sequence on the rail                  | The cutscene's caption changed in Sequence; "Show me" in Play shows the new caption                    |
| 2D: a character can be added in Schematic | The guard's speed changed in Schematic; in Play he has moved further after the same number of seconds  |
| 3D: Feel                                  | A flash on Wick's bump made in Feel; the game's brightness jumps when Wick walks into a wall           |
| 3D: Audio                                 | The bump's pitch changed in Audio; the game plays that pitch on the bump                               |
| 3D: Writer, Sequence, Schematic           | As in 2D, on the 3D template                                                                           |
| (new) 2D: Characters on the rail          | The player start's picture changed from the rail's Characters (no longer from Levels' view tab)        |

The journeys run in Chromium at iPad and phone sizes in `playwright.journeys.config.ts`; WebKit and Firefox run on the
GPU runner. Layout tests prove the phone rail (section 4) at 390 × 844 and 844 × 390.
