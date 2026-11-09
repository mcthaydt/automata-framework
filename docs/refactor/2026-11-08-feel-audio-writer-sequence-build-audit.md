# Feel, Audio, Writer and Sequence: build audit

Status: build audit, 2026-11-08. Audits AF PR #487 at `f85e63fe` (branch `claude/project-thread-2salzc`) against
[`2026-11-08-feel-spec.md`](2026-11-08-feel-spec.md), [`2026-11-08-audio-spec.md`](2026-11-08-audio-spec.md),
[`2026-11-08-writer-spec.md`](2026-11-08-writer-spec.md), [`2026-11-08-sequence-spec.md`](2026-11-08-sequence-spec.md),
their plans, plan audits and logs, and the code. Every finding names the file or the run that shows it. Screens are in the
project files under `refactor/2026-11-08-content-editors-build-audit-screens/`.

Out of scope, as asked: the guard and Schematic proof (#486); WebKit, Firefox and the GPU runner; Audio's mix, shadowed
rows, Check the sounds and the sound's picture; `pnpm check` failures from the base.

## 1. Verdict

The four editors are real, and what the 2D story's journeys edit does show in play: a word and a flash from Feel, two
imported tracks and their rules from Audio, the keeper's words from Writer, a caption from Sequence. I repeated each by hand
and went further (a new choice and part in Writer, a second caption in Sequence, a sound named by both Feel and Audio): all
of those reached the game too.

Doing the real thing found what the journeys do not cover. The shake Feel adds by default moves nothing, in the editor
or in the game. Feel's stage shows the word's hidden key instead of its words and never plays the sound it names. On a
phone, Sequence's step fields sit over the timeline with their labels hidden, and on every size its playhead and the
selected step are invisible (a colour token that does not exist). Writer's advice after the most common edit, a choice to
a new part, tells the person to break the conversation. A game made with `create-game` lists all four editors but plays
none of what they make. Eight high findings, twelve medium, ten low.

## 2. What I ran

| Run | Result |
| --- | --- |
| `pnpm build` (root), then `@automata/editors` build | pass |
| `@automata/editors` `test:unit` | 23 files, 232 tests, pass |
| `@automata/editors` `typecheck` (svelte-check, warnings fail) | pass |
| Layout tests, Chromium (`vitest --project layout --browser.name=chromium`) | 16 of 16 pass. `test:browser` as written also starts WebKit and Firefox, which are not installed here, and fails. |
| The eight served journeys (`test:e2e`, phone and iPad, Chromium) | 7 pass; `sequence-shows-in-game` on the phone failed once with 2 workers ("Safe travels." not found), then passed 3 of 3 alone |
| `@automata/feel` unit, `@automata/audio-synth` unit | 91 and 102 tests, pass |
| `examples/2d-story` `test` and `typecheck` | 16 tests, pass; typecheck clean |
| `pnpm boundaries`, `pnpm style` | 0 findings |
| My own journeys in the story (served editor, edits through the UI, then play; not committed) | see section 3 |
| A new game from `automata create-game`, opened in `automata editor`, edited in all four, played | see section 3 |

Not run: WebKit, Firefox, the GPU runner, the full `pnpm check`.

## 3. The real thing, end to end

In `examples/2d-story`, through the served `automata editor` and then the game it started:

- **Feel, a new feel with the defaults.** "Add a feel" → "Something else" `systems.mode` (the list offers no guard event, M2),
  then Flash the screen, Shake the screen and Show a word as they come. Played to the guard. The game's own record:
  `{"shake":0,"flash":1,"words":["Pow!" × 14]}`. The word and the flash showed; the shake never moved the screen (H1).
- **Feel's stage.** On the iPad and the phone the stage drew `cutscene.started.word`, not "Pow!" (H5), and sat below every
  sentence (M5). Screens `feel-stage-ipad.png`, `feel-stage-phone.png`.
- **A sound named in Feel, made in Audio.** Audio: Add a sound (`sound-1`); "When things happen", typed `cutscene.started`
  (no list, M3), which picked `talk` for it, not the new sound. Feel: Play a sound, typed `sound-1`. In play the cutscene
  played `talk` and `sound-1`: Feel's sound reached the game's audio.
- **Writer, a new choice to a new part.** Add a choice "Tell me a joke." → A new part "joke" → a line "A wall walks into a
  bar. Ouch.". In play the keeper offered "Tell me a joke.", said the line, and the conversation closed. In the editor the
  new part ends the conversation by itself, and Writer said "End is a second way out. Make it lead to Joke." (H8,
  `writer-new-part-ipad.png`).
- **Sequence, a second caption.** Words on screen → Add here → Which line? "Safe travels." → Add here. It showed in play.
  In the editor the new bar could not be seen (H3) and its overlap with the old caption was a bare "!" (M9).
  `sequence-added-ipad.png`. "Add here" with no line picked did nothing and said nothing (L4).
- **Audio, removing a track a rule plays.** The ask said "Rules that play it will play nothing."; the file became invalid
  (`slot = []` with a rule for `calm`), and the page said only "1 problem in the audio file." (M4,
  `audio-remove-ask-ipad.png`, `audio-remove-after-ipad.png`).

In a new game (`automata create-game grandma-game`, then `automata editor`): Feel offered no events at all, only "Something
else"; Audio and Feel started their files; Writer asked for a scene; Sequence offered "Add a cutscene". The game's
`package.json` and `src/app/game.ts` have no feel, audio-synth, narrative or cutscenes, so nothing made in the four editors
can show in play (H7).

## 4. Findings

### High

| # | Editor | Finding | Evidence | Fix |
| --- | --- | --- | --- | --- |
| H1 | Feel | The shake Feel adds ("How hard" 0.3) moves the screen 0 px, in the stage and in the game. The offset is `round(noise × shake_px × trauma²)`; with the default 3 px, any "How hard" below about 0.41 rounds to 0 every frame. The person adds a shake and nothing shakes. | `extensions/feel/src/shared/dynamics/trauma.ts:24-31`; `feel-model.ts` `NEW_ROW.shake`; my run `felt.shake = 0` | Start a new shake where it is felt (0.6 or more), and make the field say what it does at this value ("Moves the screen up to 1 px"), not "At full: 3 px". Whether whole pixels stay is the Owner's look rule; keep it and fix the default. |
| H2 | Feel | The stage draws the word's key (`cutscene.started.word`), a name the spec says a person never sees, instead of the words. | `FeelStage.svelte:52` (`word.key`); `feel-stage-ipad.png` | Draw `word.words ?? ''`. A unit test on what the stage writes. |
| H3 | Sequence, Feel | `--color-accent` does not exist in the editor's tokens (only `-default`, `-ink`, `-soft`). So the playhead (ruler and lanes) is never drawn, the selected step has no fill or border and vanishes (a step just added with "Add here" cannot be seen), "Add here" and the preview's camera lose their colour, and Feel's "Also plays" link is plain text. | `packages/editor/src/shared/kit/tokens.css:109-111`; `SequenceTimeline.svelte:213, 241, 248, 256`; `SequencePreview.svelte:93, 97`; `FeelPlayer.svelte:104`; `sequence-added-ipad.png` | Use `--color-accent-default`. Add a check (style or a unit test over the svelte files) that every `var(--…)` an extension uses is defined. |
| H4 | Sequence | On a phone, the step's fields sit over the timeline: see-through, with "From", "Until", "Which line" and "Who says it" hidden under the pinned row names, and the line picker cut off. The layout test passes because it checks sizes, not overlap. | `SequenceInspector.svelte` `.sheet` (sticky, no stacking above the timeline's pinned names); `sequence-step-phone.png` | Make the step a real sheet over the page (fixed, above the timeline, opaque), or stack it under the timeline. Add a layout assertion that the field labels are visible and not covered (`elementFromPoint`). |
| H5 | Feel | The stage never plays a sound the game has. The suite page passes `browserOutputs()`, whose `cue` defaults to `() => true`, so the stage counts the sound as played, plays nothing and says nothing. Spec §3.3: it plays through `@automata/audio-synth`. | `extensions/editors/src/app/suite/main.ts` (`browserOutputs()`); `feel-stage.ts browserOutputs` | Give `browserOutputs` the Audio editor's player (`browserAudio`) over the game's audio file, so `cue(id)` plays the cue and returns whether it did. |
| H6 | Writer | A choice to "A new part…" makes a part with no "Then", so it ends the conversation on its own. Writer then blames the real way out: "End is a second way out. Make it lead to Joke." Following that advice would make End lead back into the joke. The first exit in reading order is taken as the true one. | `writer-problems.ts:44-55`; `writer-session.svelte.ts addChoice`; `writer-new-part-ipad.png` | A new part goes on to the conversation's way out when it has one. When two parts end it, name the one that is not the conversation's usual end ("Joke ends the conversation by itself. Make it go on to End."), ranked by which is reached last, not first. |
| H7 | all four | A game made with `create-game` lists Feel, Audio, Writer and Sequence in `content/editors.toml`, but its code plays none of them: no `feelStage`, `audioStage`, dialogue box or cutscenes, and none of those packages in its `package.json`. Content made there never shows in play, which breaks the Owner's standing rule for every new game. | `packages/tools/src/shared/create-game/template-content/editors.toml:13-55`; `template-game.ts`; the `grandma-game` run | Either the template wires `feelStage` and `audioStage` (the story's `story-feel-audio.ts` is the pattern) and keeps only the editors whose content it plays, or the rows wait until it does. The Owner's call (decision in §6). |
| H8 | Writer, Sequence | The plans and logs disagree with what was built and with progress.md. No step in any of the four plans is ticked; Writer's and Sequence's logs still say "Task 7 (served journey) not done" though their journeys are in and pass; only Feel's and Audio's plans carry the follow-up log. | `2026-11-08-{writer,sequence}-plan.md` Log; `docs/refactor/progress.md` lines 539-550 | Tick the steps whose checks passed, add the follow-up entry to Writer's and Sequence's logs, and leave unticked (and named) what did not run. |

### Medium

| # | Editor | Finding | Evidence | Fix |
| --- | --- | --- | --- | --- |
| M1 | Feel | "What freezes: Everything / Only what was hit" does nothing: the runtime never reads `target`. A freeze holds only the event's subject, and an event with no subject (the story's `systems.mode` and `cutscene.started`) freezes nothing, with no word from Feel. | `extensions/feel/src/features/frame/feel.ts:171-180` | Either the runtime freezes everything for `everything` (a world hold), or the field goes and Feel says "Freezes what was hit" and warns when the event has no subject. |
| M2 | Feel, Audio | Feel's list of the game's events comes from `workspace.files()`, which is only the files the editor list matches. The story does not list `content/systems`, so the guard's events (`systems.mode`, `systems.caught`) are never offered and the plan's own Task 7 step ("the guard changes mode") must be typed as an id. | `shared/game-events.ts:107-118`; `packages/editor/src/shared/kit/ports/suite-ports.ts:60-63`; the run in §3 | Find an extension's content by its folder in the game (a list call outside the editor list, or the extension's folder in the template's and the story's editor list). |
| M3 | Audio | "When things happen" asks the person to type an event id ("What happens in the game?") instead of offering the game's events (spec §3.4, `gameEvents`), and a new row plays the first sound in the file, not the one the person just made. Not in the known-not-done list. | `AudioCanvas.svelte:192-205`; `audio-events-ipad.png` | Offer `gameEvents` as in Feel's add list, with "Something else"; a new row starts on the sound chosen last, or asks. |
| M4 | Audio | Removing a track that a rule plays, or a sound that an event row plays, writes a file the schema refuses (`no slot calm`, `no cue …`), though the ask promised "Rules that play it will play nothing." The page then says only "1 problem in the audio file." and shows the rule with an empty "Play". | `AudioMusic.svelte` `removeTrack`, ask copy; `audio.schema.ts:300-302`; `audio-remove-*-ipad.png` | Remove the rules that play it in the same step (or set them to "Play nothing"), and say so in the ask; same for event rows of a removed sound. |
| M5 | Feel | Below 560 px of canvas (every phone, and an iPad in portrait, where the canvas is about 530 px) the stage sits under every sentence, so a person changing a field cannot see it play. Spec §6: stage first when stacked. | `FeelCanvas.svelte` `.split`; `feel-stage-phone.png`, `feel-stage-ipad.png` | Put the stage first when stacked, sticky at the top of the canvas. |
| M6 | Feel | "Which sound" is free text and a new sound row starts as `hit`, a sound the story does not have. Spec §4: a choice of the game's sounds, or typed. | `feel-model.ts` `NEW_ROW.sound`, the `audio` line's `text` field | A choice of `session.cues` plus "Something else"; a new row starts on the first cue the game has. |
| M7 | Feel | Adding a feel and then quickly "Add an effect" can put the effect on the feel shown before: the canvas keeps the old feel until the new feel's write returns. Seen once in five runs: the flash meant for "systems mode" went into "cutscene started". | `FeelPanel.svelte add` (`session.chosen` set after `await session.change`) | Choose the new feel at once and disable the canvas's actions while the write is pending, or carry the entry's `on` in the edit and resolve it at write time. |
| M8 | Writer | There is no way to add an "Only if" to a part, only to remove one (spec §3.3, plan Task 4 "edits for `when`"). | `WriterConversation.svelte:132-136` | An "Only if…" on a part: the scene's facts and items, then "is", "is at least", "has". |
| M9 | Sequence, Audio, Writer | A problem on a Sequence step is a bare "!" with its words in `title`, which a touch screen never shows; the status bar's "1 problem in the cutscene." (and Audio's "… in the audio file.") does not say which or what. Spec §3.7: words on the step. | `SequenceTimeline.svelte:131-140`; `sequence-added-ipad.png` | Show the problem's words in the step's sheet and under the timeline; the status line names the first problem and takes you to it. |
| M10 | Feel | Feel has no "Answers: … **Change**" to rename what a feel answers (spec §3.7). | `FeelCanvas.svelte` (no rename) | Add it beside the heading, with the same events list as "Add a feel". |
| M11 | journeys | The Audio journey proves the music the game *asked for* (`watch`), not that a file decoded and sounded; a missing or broken file only reaches `console.warn`. The Feel journey had to raise "Never more than" to 30 frames to see a flash at all. | `audio-plays-in-game.test.ts`; `story-feel-audio.ts` `onFault: console.warn`; `feel-shows-in-game.test.ts:44-49` | Record `onFault` in the story's log and assert it stays empty; in a second Feel journey, keep the defaults and assert what a person gets. |
| M12 | journeys | `sequence-shows-in-game` failed once on the phone with two workers. The caption sits from 2 s to 5.5 s and the assertion waits 5 s after pressing Next. | `/tmp` run, 1 of 4 on the phone | Wait on the cutscene's start (the story's log), then on the caption. |

### Low

| # | Finding | Evidence |
| --- | --- | --- |
| L1 | The events read as ids with the dots taken out: "narrative choices", "any narrative event", "cutscene ended", "When narrative line". The spec's words are "the guard changes mode". | `shared/event-words.ts`; `audio-events-ipad.png` |
| L2 | "At full: 3 px" under a shake means nothing to a person (see H1 for the words). | `feel-model.ts` shake `hint` |
| L3 | Feel's preview starts with Reduce motion off, not the device's setting (plan Task 4). | `feel-session.svelte.ts` `preview` |
| L4 | Sequence "Add here" with no line picked does nothing and says nothing. | the §3 run |
| L5 | Writer's map is hidden until **Map** is pressed, even at 820 px and wider (spec §6: beside the script). | `WriterConversation.svelte:36, 322-324` |
| L6 | A music condition "is at least" with words for a value is saved as 0 without a word. | `AudioMusic.svelte conditionOf` |
| L7 | A word's hidden key is `<on>.word<n>`, `n` from the row count: a `*` pattern gives `player.*.word`, and removing a word then adding one can repeat a key. | `feel-model.ts wordKey` |
| L8 | `test:browser` runs WebKit and Firefox as well, so it cannot pass where only Chromium is installed; journeys and plans say "Chromium only here". Document `--browser.name=chromium` or add a `test:browser:chromium`. | `vitest.config.ts`; `package.json` |
| L9 | Writer writes a new part as an inline table at the top of the graph (`nodes.joke = { say = [...] }`), unlike the file's own `[graphs.nodes.*]` sections. Valid, but harder to read by hand. | the §3 run's `keeper.toml` |
| L10 | A Feel flash is timed (frames / 60 s), not counted in drawn frames: at about 17 drawn frames a second in the headless run, the default two-frame flash was drawn once. Fine at 60 fps; worth a floor of one drawn frame. | `feel.ts:186-188`; the §3 run `flash: 1` |

## 5. Drunk grandma

Passes: "Shake the screen", "Freeze the action", "Flash the screen", "What it says", "Never more than", "How squash
moves", "What music plays when", "Tracks in your game folder" / "Use this track", "The game plays the first rule that
holds", "Words on screen", "Add here", Writer's script with "Keeper says" and "You say".

Fails: an added shake that does not shake (H1); a key on the stage (H2); a playhead and a chosen step you cannot see (H3);
labels hidden on a phone (H4); advice that would break the conversation (H6); editors that offer to make things a new game
never shows (H7); "What freezes: Everything" that freezes nothing (M1); typing `cutscene.started` (M3); "1 problem in the
audio file." with no what or where (M4, M9); "narrative choices" (L1); "At full: 3 px" (L2).

## 6. Owner decision

H7: a new game from `create-game` lists the four content editors but plays none of their content. Recommended: the
template wires Feel and Audio now (small: two renderer and audio hooks, as the story does) and lists Writer and Sequence
only once the template has a dialogue box and cutscenes; the alternative is to take the four rows out of the template
until it plays them.

## 7. What was checked and holds

- Feel: every field of spec §4 is there with its words; a choice back to its default removes the key; a flash with no
  brightness reads "As bright as allowed (0.85)"; the three limit notes match `limitWarnings`; the squash spring writes the
  whole table; "Also plays"; the player's settings change only the preview; "Fix the file to play it."; a word's `words`
  are `localized()` in the content kind and plain in `feelSchema`; `feelStage` shakes through `world.pivot`, holds and
  squashes the subject's view, draws words, and its cues reached the story's audio in play.
- Audio: tracks are imported, never made (the Owner, 05:10): "Use this track", a track with no file named, rules with
  Move up and Move down as one step; `audioStage` plays event cues on core's buses and switches tracks by the rules in play.
- Writer: words live in the line (`words`, `localized()`), the id is made from the words, a two-file choice is two undo
  steps, renaming a part follows every reference, the translations note, Play it; a new choice and part play in the game.
- Sequence: rows in words, Sounds read only, 3D-only rows named, Add here from the director's state, a caption picked by
  its words, problems worked out in the page; a caption pointed or added in Sequence shows in the game.
- Every write goes through the content session (mtime guard, in-order write queue); the editors stay out of core
  (`pnpm boundaries` clean).
