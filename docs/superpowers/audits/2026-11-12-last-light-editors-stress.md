# The Last Light through every editor: a stress audit (2026-11-12)

Branch `claude/last-light-editors-stress`, from `claude/last-light-prologue` at `8d8202694`. No product or game file is
changed; every edit made while testing was reverted (`git status` clean on `games/` at the end). Run in Chromium
(Playwright 1.63, headless, software GL), on `automata editor` served from `games/the-last-light`. This branch has
`main`'s pre-v2 editors. Screenshots are in [`2026-11-12-last-light-editors-stress/`](2026-11-12-last-light-editors-stress/),
and each one was opened and looked at.

## Verdict

**The Last Light does not open in every editor today.** Five of the nine editors are on a different page from Levels
3D, Characters cannot open Ada at all, and the most-used editor on this game, Levels 3D, cannot select a prop in Plan.
Where an editor does open the game's file, **saving is safe**. Every file put through an edit and then back again came
out byte-identical or differed only by number formatting (`11` written back as `11.0`). No field the editor does not know
was dropped, nothing was reordered, and no comment was lost. So the data is safe, but finding and changing the content
is the problem: what the editors show is often untrue to the game, and some content kinds have no editor that can
reach them.

What a maker can do today, by kind of content:

| Content | Editor | Opens | Shows it truly | Small change | Save round-trip | Shows in play |
|---|---|---|---|---|---|---|
| The level (`prologue.af-sector.json`, 7 rooms, 66 props, 15 lamps, 3 views, 20 entities) | Levels 3D | yes, Plan in under 1 s | partly: props are same-sized squares, 3D shows blockouts and none of the 57 models, "41 problems" with no list | **no**: tapping a prop or hotspot selects the room; a drag moved the whole hall | yes, byte-identical after undo | not checked (the room move was undone) |
| Lines (`lines/prologue.toml`, 74 lines) | Writer, content page only | yes, under 1 s | the words, speaker and kind; not the id or motifs | yes | yes, a one-line diff, and none after putting it back | yes, in the compiled content the game serves |
| Cutscenes (5 files, 160 steps) | Sequence, content page only | yes | the timeline, yes; the picture is a top-down plan, not what the camera sees | yes (retimed a camera step) | `t = 11` comes back as `11.0` | yes (10.5 reached the game's content) |
| Systems, nav graph, puzzle (3 files) | Schematic, content page only | yes, as one scene | the creature's senses and modes, yes; the graph overlaps at this size | yes (sight range) | `5` saved as `5.0`; no diff after putting it back | not checked |
| Audio (`audio.toml`: 23 cues, 49 events, 5 music rules) | Audio, content page only | yes | **no**: every recorded `.ogg` cue says "This sound is silent" | yes (a cue's draft flag) | yes, no diff after putting it back | not checked |
| Feel (`feel.toml`, 2 entries) | Feel, content page only | yes | yes | yes | yes | not checked |
| Tuning (`tuning.toml`, 1 number) | Tuner | yes | yes | yes | `3` comes back as `3.0` | yes (3.1 reached the game's content) |
| Ada and the nurse (`src/features/figures/cast.ts`, 203 lines of TypeScript) | Characters (the Studio) | **no**: there is no row in `editors.toml`, no card on the page, and the Studio opens only core's mesh figures | | | | |
| Everything else in the inventory (look, lights out, peek, carried light, swatches, HUD, storylets, beats, help, canon, credits, translations, controls) | none | | | | | |

## The ledger, ranked for launch

The severity column uses three words. **BLOCKS**: the stress test cannot pass, because an editor cannot open,
change or round-trip the game's real content, or loses data, or shows something false. **DEGRADES**: it works, with
friction. **MISSING**: no editor covers this kind of content. "Covered" names the work in flight that already answers the
row: the v2 landing plan
(`origin/claude/editors-v2-landing-plan-audit:docs/superpowers/plans/2026-11-12-editors-v2-landing.md`), the 3D lane's
Part C (`origin/claude/ship-3d-plan-audit:docs/superpowers/plans/2026-11-12-ship-3d-and-editors.md`), the camera branch
or Ada's branch.

| # | Gap | Evidence | Severity | Size | Fix owned by | Covered by work in flight |
|---|---|---|---|---|---|---|
| 1 | No single page holds every editor. `automata editor` serves the full page, where Writer, Sequence, Schematic, Audio and Feel say "Not in this build. Its files open read only". The content page (`--app-dir extensions/editors/dist/suite`) has those five, but shows the level as read-only raw JSON | `01-full-page-home.png`; `packages/tools/src/features/editor/page-for.ts:13` (only `levels-3d` and `studio` pick the full page); `packages/editor-3d/src/app/suite/suite-main.ts:27` (Tuner, Levels 2D, Levels 3D, Studio only) | BLOCKS | M | `@automata/editor-3d`, `@automata/editors`, `@automata/tools` | **Yes**: v2 landing Task 6 ("One page for every game"), with Task 7 for the site; ship-3d Part C, tasks C1 and C2 |
| 2 | Levels 3D: tapping a prop, lamp or hotspot in Plan selects the room underneath. Dragging then moves the room's corners (the hall moved 1 m, 20 lines changed, the props stayed where they were). Locking Rooms and Walls in Layers did not let a tap reach the prop, and tapping the "Bed" layer row selects nothing | `09-levels3d-prop-tap-selects-room.png`; the diff in the per-editor record | BLOCKS (no prop can be moved, and the realistic mistake moves a whole room) | M | `@automata/editor-3d` (plan hit-testing, the layers list) | Not found in either plan. Check `claude/editor-journeys-green`'s Levels 3D journeys: they use the starter level, not 66 props inside rooms |
| 3 | Characters cannot open Ada or the nurse. They are TypeScript (`src/features/figures/cast.ts`, `old-swatches.ts`, `old-gaits.ts`: 379 lines), the Studio opens only core's mesh figures, and `editors.toml` has no row for them | `01-full-page-home.png` (no Characters card); old ledger row 2 | BLOCKS / MISSING | L | `@automata/character-kit` (a content kind for painted figures: a figure file with outfit, hair, swatches and gait) plus `@automata/editor-3d` (the Studio opening it) | Partly. Ship-3d Part B5 (`character-kit`) makes the package public, not editable. Ada's branch (`dimmest`, `bobOpen`, `grid: true`) adds more fields in code, so the gap grows |
| 4 | Audio shows every recorded cue as "This sound is silent. Add a tone or a hiss to hear it" (9 cues name `sounds/*.ogg`). It cannot play or choose a recorded file, and the cue's `gain` is not shown. The 3 music files are listed by name only | `06-audio-recorded-cue-silent.png`; `content/audio/audio.toml:16-19`; `extensions/editors/src/features/audio/` renders synth voices only | BLOCKS (shows something false) | M | `@automata/editors` (Audio) | Not found |
| 5 | Levels 3D says "41 problems" as a plain `<p>`, with no list and no place on the plan. `automata check`'s levels step passes on the same file | `08-levels3d-plan.png`; `packages/editor-3d/src/features/levels-3d/plan/plan-status.ts:55` | DEGRADES (fails the drunk-grandma test: something is wrong, and nothing says what or where) | S | `@automata/editor-3d` | Not found |
| 6 | Levels 3D's 3D and Walk views draw the props as generated blockouts. None of the 57 `model` props is drawn, so the room looks nothing like play | `10-levels3d-3d.png`, `11-levels3d-walk.png` against `12-game-in-play.png`; old ledger row 17 | DEGRADES | M | `@automata/editor-3d` (draw `drawWorld`'s models with the game's `public/models`) | Not found; old row 17 is still open |
| 7 | Levels 3D has no fields for a view. The room shows a "Camera: Hall" picker, but not `distance`, `lensMm`, `follow`, `lead` or `focusBounds`, nor the camera branch's `peekReach`. Walk's follow camera reads `lensMm` (`walk/follow-camera.ts:25`) | room inspector text in the per-editor record | MISSING | S to M | `@automata/editor-3d` (a view inspector made from the view schema in `@automata/3d`) | Not covered. `origin/claude/last-light-camera` touches only `follow-camera.ts` in the editor |
| 8 | Levels 3D does not open a prop's `with` block (56 props have one), `model` or `fit`, nor a wall's `dado` (17 walls). The room inspector shows Skirting 0 and Wainscot 0 for the hall, whose walls carry per-wall trim and a 1.14 m dado | room inspector; `PROP_ORDER` in `af-codec.ts:63` has no `model` or `fit` (they are kept, and the round-trip proves it); old ledger rows 16 and 17 | DEGRADES (shows numbers that are not what the room draws) | M | `@automata/editor-3d` | Not found |
| 9 | Sequence's picture is a top-down plan with a frustum. There is no camera's-eye view, so a close-up's lens (26 to 28 mm on Ada's face) cannot be judged, and bars, the LCD panel and the grade are not shown. At t = 0 the opening is a black panel (its fade, which is correct). The "nurse" and "player" labels overlap | `04-sequence-preview-plan.png`; `01`'s Found preview | DEGRADES | L | `@automata/editors` (Sequence) with `@automata/3d` | Not found |
| 10 | Sequence shows `ease = "linear"` as "Moves (its own curve)" | `03-sequence-camera-step.png`; `content/cutscenes/opening.toml:35` | DEGRADES (not truthful) | S | `@automata/editors` | Not found |
| 11 | A whole number typed back into a decimal field is saved as `X.0` (Sequence `t = 11.0`, Tuner `value = 3.0`, Schematic `range = 5.0`). The value is equal, but the diff is noise in a file a person also edits by hand | diffs in the per-editor record | DEGRADES | S | `@automata/editor` (the TOML session's number writer) | Not found |
| 12 | Writer opens `lines/` only. The five translation catalogues (`content/messages/*.json`, 79 keys each), storylets, beats, help ladders and canon have no editor. Writer shows no line id, no motifs and no search across 74 lines | `02-writer.png`; old ledger rows 7 and 12 | MISSING (catalogues and narrative kinds), DEGRADES (search) | M each | `@automata/editors` (Writer) | Not found |
| 13 | Schematic opens three files (systems, nav, puzzle) as one "Prologue". The home page lists one card entry for three files. The diagram overlaps at 1280 px and is clipped at phone size; the top bar's Play is cut off at 390 px | `05-schematic.png`, `14-phone-schematic.png` | DEGRADES | S | `@automata/editors` | Partly: the v2 look changes the top bar |
| 14 | Phone: Levels 3D's plan has a blank white strip at the top, and its tool row runs off the right edge ("Wi…") | `13-phone-levels3d.png` | DEGRADES | S | `@automata/editor-3d` | Probably the v2 look; check after it lands |
| 15 | The look (`content/look.toml`: retro grade, LCD panel, lamp gain), lights out (`lights-out.toml`), peek, carried light and the game's 8 world swatches have content kinds and no editor | inventory; old ledger rows 10, 11, 16 and 18 | MISSING | S to M each | `@automata/editors` (a generic schema form would cover peek, carried light and lights out) and `@automata/3d` (swatches) | Not found |
| 16 | HUD (`content/hud/play.toml`, 25 pieces), credits and controls have no editor. The controls are code in `src/app/controls.ts` and `game.ts` | old ledger rows 1, 4, 13 and 15 | MISSING | L | the UI editor (workstream 3) | Not found |
| 17 | `editors.toml` routes look, lights out, peek, carried light, swatches, the HUD, storylets, beats, help, canon, credits and translations nowhere, so the home page does not list them at all. A maker cannot tell that they exist | `content/editors.toml` | DEGRADES | S | the game (rows) and `@automata/editor` (show unrouted content as "no editor yet, edit as text") | Not found |

Ledger rows 1 to 18 in `docs/superpowers/progress.md` still stand. This table adds rows 2, 4, 5, 7, 9, 10, 11, 13, 14 and 17,
and gives evidence for rows 2 and 16 to 18 there.

## Per-editor record

Times are from the tap on the home page's file to the editor's first control on screen, on a software renderer.

**Home (the full page, `automata editor`).** The page was up in 4.4 s. It shows Tuner, Levels, and five editors marked
"Not in this build" (`01-full-page-home.png`). The three Schematic files are listed as "Prologue", "Prologue", "Prologue",
with nothing to tell them apart. There is no Characters card. On the content page, the level is listed under "Levels:
Not in this build", and tapping it shows the raw JSON read-only.

**Levels 3D.** The canvas was up 0.9 s after the tap. The layers show 7 rooms, 50 walls and 99 things in 26 kinds; the
file has 19 hotspots and Layers counts 17. The plan draws each thing as a small square of one size: the 2.05 m bed and a
note look the same. "41 problems" is not a control. Tapping on a prop or a hotspot dot selected the room under it, and a
drag of about 1 m moved all 14 of the hall's corners (`"-1.475"` → `"-0.475"` and so on, 20 lines). The 30-odd props and
the hotspots stayed in place. Ctrl+Z restored the file byte-identical, which shows the codec keeps the file as written.
3D (`10`) and Walk (`11`) draw the rooms, with the blockout props in flat dithered colours: no models, and no night.
The game in play (`12`) is a dark, LCD-graded room with Ada painted. The room inspector (hall) shows its floor, ceiling,
light, materials and the camera's name; it shows Skirting 0 and Wainscot 0 where the walls carry their own trim and dado.
The view's numbers are not shown.

**Writer** (content page). The first text box was up 0.8 s after the tap. 74 lines are in one list with no filter
(`02-writer.png`). The speaker and kind are shown in words ("A note to read", "Read when you look at something"); the id
and motifs are not. Appending " Turn over again." to the handover note gave a one-line diff, and the text reached the
game's compiled content (`virtual:automata/content` from the running game). Putting the text back left no diff.

**Sequence** (content page). Opening the editor opens Found; Opening is a tap in the list (82 ms). The timeline lists
38 steps for Opening; steps at the same moment (a cut and the key before it) stack as two boxes. The camera step's
inspector names each number in words (`03`). Retiming the close-up's end from 11 s to 10.5 s gave a one-line diff and
reached play's content. Typing 11 back saved `t = 11.0`. The preview over the level is a plan with walls and a frustum
(`04`).

**Schematic** (content page). The nurse's modes, senses and rules are shown in words (`05`), with fields such as "Sees up
to 4.5 m" and "Boxes and closed doors block its view: no" (the file says `wallsOnly = true`, which matches). Changing the
sight range to 5 gave `range = 5.0`; putting 4.5 back left no diff. The diagram's notes overlap at desktop width.

**Audio** (content page). 23 sounds are listed; the ones whose id ends in `Placeholder` are marked so. Every recorded
cue reads "This sound is silent" (`06`). Turning "Not final yet" on wrote `draft = true` after the cue's `sound` line,
and turning it off again left no diff: the `sound`, `gain` and `steps` table are kept.

**Feel** (content page). Both entries open with their effects in words. A number change and its reversal left no diff.

**Tuner.** The one number (walking speed) shows beside the running game, behind its flashing-lights warning (`07`).
One step up wrote `value = 3.1`, which reached play's content; one step down wrote `value = 3.0`.

**Characters.** Not reachable (row 3).

**Phone, 390 × 844.** Neither page scrolls sideways. On Levels 3D (`13`), a white strip covers the top of the plan and
the tool row is cut off at the right. On Schematic (`14`), the top bar clips Play and the diagram shows one node. A scan
for controls under 44 px returned none on the three screens; that scan was quick, and is not a substitute for the layout
suite.

**Scale.** The counts the editors met: 66 props, 15 lamps, 20 entities, 74 lines, 160 cutscene steps (61 in Lights out),
23 cues and 49 events, and a 942-line systems file. Nothing was slow: the editors that were timed (Levels 3D, Writer, the switch inside Sequence) drew in under a second after the tap.
The friction is in finding things. Writer, Audio and the Levels layers have no search or filter at these counts, the
plan's things all look alike, and two editors stack same-time steps or overlap labels.

**Not run:** WebKit, Firefox, a real GPU, real devices, focus through rotation, the on-screen keyboard. "Shows in play"
was checked as the game's served content (`virtual:automata/content`), not by playing to the moment, except for the
level, which was not checked in play. `automata check` in the game fails to start its test and build steps under plain
Node (`packages/sim/src/shared/world/snapshot.ts:135`, a parameter property): a tools problem, not an editor one,
noted here only.

## What no editor can express (inventory)

D marks content that is data an editor could own. C marks content that is code, with whether it is the game's own logic
or should be a content kind.

| Kind | Files | Format | D/C | Editor today | Smallest honest change |
|---|---|---|---|---|---|
| Level: rooms, walls, trim, dado, doors, windows | `content/levels/prologue.af-sector.json` | JSON | D | Levels 3D (partly: rows 2, 8) | Plan hit-testing; a wall's band fields |
| Props, models and fit | the same file (66 props, 57 with `model`, 56 with `with`); `public/models/*.bin` (41) | JSON + binary | D | Levels 3D keeps them and draws none | A prop inspector from the generator's `with` schema; the model picker (old row 17) |
| Lamps | the same file (15) | JSON | D | Levels 3D (layers and plan) | Its inspector, checked against the level |
| Views (camera) | the same file (`views`: 3) | JSON | D | name only | A view inspector (row 7) |
| Hotspots, spawn | the same file (`entityDefs`, 20 entities) | JSON | D | Levels 3D fields; `when` has no field type (old row 8) | A condition field type |
| Look: grade, LCD panel, lamp gain | `content/look.toml` (39 lines); passes in `src/app/look-passes.ts`, `look.ts` | TOML + C (wiring) | D | none | A schema form (old row 18) |
| Lights out | `content/lights-out.toml` | TOML | D | none | A schema form |
| Surfaces and photo textures | `content/world-swatches/*.toml` (8), `src/features/room/world-tiles/*.tile.json` (25) | TOML/JSON | D | none | A swatch editor in `@automata/3d`'s kit |
| Ada and the nurse: figure, outfit, hair, swatches, gait | `src/features/figures/cast.ts`, `old-swatches.ts`, `old-gaits.ts` (379 lines) | C, but data-shaped | should be a content kind | none | A painted-figure content kind, then the Studio (row 3) |
| Cutscenes | `content/cutscenes/*.toml` (5) | TOML | D | Sequence | A camera view, per-cutscene bars, video (the game's framework gaps) |
| Lines | `content/lines/prologue.toml` (74) | TOML | D | Writer | Search; id and motifs |
| Translations | `content/messages/*.json` (5 × 79), `messages/ui/*.json` (6 + context) | JSON | D | none | Writer's language column (old row 7) |
| Storylets, beats, help, canon | `content/storylets`, `beats`, `help`, `canon` | TOML | D | none | Old row 12 |
| Systems, nav, puzzle | `content/systems`, `nav`, `puzzles` | TOML | D | Schematic | Labels per file |
| Keys, cabinet, closet, doors | puzzle file (83 entries) + `src/shared/doors.ts` | TOML + C | D | Schematic (puzzle) | none needed beyond row 13 |
| Night logic: lamp, catch, rouse, steps, objective | `src/features/{lamp,catch,night,objective}` | C (the game's own logic) | | | stays code |
| Audio cues, events, music rules, steps | `content/audio/audio.toml`; `public/sounds` (9), `public/music` (3) | TOML + ogg | D | Audio (synth only) | Recorded sounds (row 4) |
| Music state | `src/features/sound/music-state.ts`, `music-inputs.ts` | C | the inputs could be content | none | stays code for now |
| Feel | `content/feel/feel.toml` | TOML | D | Feel | none |
| Tuning, peek, carried light | `content/tuning.toml`, `peek.toml`, `carried-light.toml` | TOML | D | Tuner (tuning only) | Tuner rows for the other two, or a schema form |
| HUD and prompts | `content/hud/play.toml` (25) | TOML | D | none | UI editor (old rows 1 and 15) |
| Controls | `src/app/controls.ts`, `game.ts` | C | should be a content kind | none | Old row 13 |
| Credits | `content/credits/credits.toml` | TOML | D | none | Old row 4 |

## Journeys that would keep the stress test honest

Each journey runs on a copy of the game's real files (the game's own `AF_E2E_CONTENT_ROOT` pattern), one per editor,
in Chromium on the gate and the 3D lane:

1. Open The Last Light in Levels 3D, select the bed in Plan, move it 0.5 m, save, Play, and see the bed's blockout box
   moved in the game's `World.props`. Then check that undo leaves the file byte-identical.
2. Open it in Writer, change the handover note, save, Play, read the note, and see the new words.
3. Open it in Sequence, move Opening's close-up cut by 0.5 s, save, Play, and see the cut at the new tick.
4. Open it in Schematic, set the nurse's sight to 5 m, save, and see the sim's sense range at 5 in the game's probe.
5. Open it in Audio, open `openingWard`, and check that it names its recorded file and plays it (fails today: row 4).
6. Open it in Feel, change the catch's shake, save, and see it in the feel log.
7. Open it in the Tuner, move the walking speed one step, and see Ada's speed in the probe.
8. Open Ada in Characters, change her hair, save, Play, and see the new hair (fails today: row 3).
9. Run every file in `content/` through open, then save with no change. The diff must be empty, number spelling
   included (row 11).

## For the coordinator: what "opens, round-trips and plays from every editor" needs at launch

In order:

1. One page with every editor, served by `automata editor` (row 1). The v2 landing Task 6 and Part C cover it, so it
   needs to land, then be re-checked on this game.
2. Levels 3D can select and move a prop, lamp and hotspot inside a room (row 2). Not covered.
3. Audio shows and plays a recorded cue truthfully (row 4). Not covered.
4. Characters opens Ada: a painted-figure content kind and the Studio reading it (row 3). Not covered, and the largest
   item.
5. The "41 problems" can be listed and located (row 5). This is small.
6. The journeys above in CI, with journey 9 as the cheapest and broadest guard.

What can honestly wait until after launch: the models in the editor's 3D view (row 6), view fields (row 7, which the
game edits by hand today), `with` and dado fields (row 8), Sequence's camera view (row 9), the label fixes (rows 10 and
13), number spelling (row 11, which is cosmetic), the missing editors for translations, narrative kinds, look, swatches,
HUD, controls and credits (rows 12, 15 and 16, which are already on the ledger as "to be specced"), and the phone layout
fixes (row 14, once v2 lands).

## For the tracker

The coordinator asked that this branch not edit `docs/superpowers/progress.md`. This is what would have been appended
under the Editor gaps ledger:

> 2026-11-12, the stress audit ([last-light-editors-stress](audits/2026-11-12-last-light-editors-stress.md)) put the
> prologue's real content through every editor. Saving is safe: each round-trip was lossless but for `X.0` number spelling.
> Opening, showing and changing the content is not. Its ledger, ranked for launch, supersedes this table's order; rows 19
> to 25 come from it.

| # | Content with no editor | Found by | State |
|---|---|---|---|
| 19 | Writer, Sequence, Schematic, Audio and Feel are not on the page `automata editor` serves to a 3D game | Stress audit, 2026-11-12 | Covered by v2 landing Task 6 and ship-3d C1 and C2 |
| 20 | Levels 3D cannot select a prop, lamp or hotspot inside a room in Plan; a drag moves the room | Stress audit, 2026-11-12 | Open, blocks |
| 21 | Audio shows recorded (`.ogg`) cues as silent, and cannot play or choose a recorded file | Stress audit, 2026-11-12 | Open, blocks |
| 22 | Levels 3D's "41 problems" has no list and no place on the plan | Stress audit, 2026-11-12 | Open |
| 23 | A level's views (`distance`, `lensMm`, `follow`, `lead`, `focusBounds`, `peekReach`) have no fields | Stress audit, 2026-11-12 | Open |
| 24 | Sequence previews a plan, not the camera's picture; `linear` shows as "its own curve" | Stress audit, 2026-11-12 | Open |
| 25 | Number fields write a whole number back as `X.0` | Stress audit, 2026-11-12 | Open, cosmetic |
