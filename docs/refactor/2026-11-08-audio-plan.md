# Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (no
> subagents in this project). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the half-built Audio editor against its spec: on the suite page, Play that sounds, every field, music
pieces and rules, the mix, and the pipeline's checks in words.

**Architecture:** `extensions/editors/src/features/audio` keeps its model (pure functions over `AudioContent` that
return `ContentEdit`s) and its `ContentSession`. New files split the model by page (`music-model.ts`, `mix-model.ts`)
so none passes 600 lines. Play goes through an injected `AudioPlay` port; the page passes one built on `playCue`,
`startBed` and a real `AudioContext`.

**Tech Stack:** Svelte 5 runes, Vitest 5 (jsdom, Testing Library), Zod 4, `@automata/audio-synth`.

**Spec:** [`2026-11-08-audio-spec.md`](2026-11-08-audio-spec.md), with the shared
[`2026-11-08-content-editors-spec.md`](2026-11-08-content-editors-spec.md).

**Audit:** [`2026-11-08-audio-plan-audit.md`](2026-11-08-audio-plan-audit.md) (A1 to A8, fixed below). Tasks 5 and 6
were added by it: a sound picked here must be heard in play. Task 3 (music pieces and rules) waits for the Owner's call
(A4); until then it is not built.

## Global Constraints

- The content editors plan's constraints hold (no "Plus", core never imports this package, feature folders, tests in
  `tests/`, 600 lines a file, drunk grandma copy, 44/48 px targets, span-preserving edits, test first).
- Words are the spec's section 4 table, verbatim. No key (`cue`, `bus`, `slot`, `no_duck`, `master_gain`) on screen.
- Nothing plays without a tap; playing never writes the file.
- **Check the sounds** renders and measures in the page (`@automata/audio-synth/render` and `/measure`); the page never
  imports `@automata/pipelines` and uses no checks port for it (audit A5).
- What a person changes in Audio is heard in play, in a served journey (the Owner, 2026-11-08): Tasks 5 and 6. A
  journey step that could not run is left unchecked and named, never replaced by writing the file directly.

## Review Focus

1. **Two event rows that both match** (`player.*` above `player.hit`). Only the first plays (`rowFor`); the second
   says "Never plays: any player event above answers first." and **Move up** fixes it in one undo step. Test in Task 4.
2. **A sound picked for an event, then Play.** The game plays it when the event happens. Served journey in Task 6.
3. **Play pressed twice quickly, or a bed playing when another is chosen.** One sound at a time for beds; Stop works
   after switching pages. Test in Task 1.
4. **A hiss with a pitch range** (`hiss = [400, 1200]`). Shown as two fields, From and To, and kept as a range. Test in
   Task 2.
5. **Findings for a sound that was renamed since the check.** Shown under "Out of date" until the next check, never
   pinned to the wrong sound. Test in Task 4.

---

### Task 1: On the page, and Play that sounds

**Files:**

- Create: `extensions/editors/src/features/audio/audio-output.ts`
- Modify: `audio-suite-editor.ts`, `AudioCanvas.svelte`, `extensions/editors/src/app/suite/content-editors.ts`,
  `main.ts`, `sample/editors.toml`, add `sample/audio.toml`
- Test: `tests/unit/audio/audio-output.test.ts`, `tests/unit/audio/audio-editor.test.ts`, `tests/unit/app/content-editors.test.ts`

**Interfaces:**

- Consumes: the existing `AudioPlay = (content, what: { kind: 'sound' | 'bed'; id }) => Promise<void>`.
- Produces: `interface AudioOutput { readonly play: AudioPlay; stop(): void; close(): void; readonly unlocked: boolean }`
  and `browserAudio(make: () => AudioContext): AudioOutput` (makes the context on the first `play`; a sound plays once
  through `playCue`; a bed starts through `startBed` and stops any other; `stop()` stops the bed; `close()` closes the
  context). `AudioSession` gains `stop()` and `unlocked`. `contentEditors({ audio }?)` returns `[createFeel(),
createAudio({ play: audio.play })]`.

- [ ] **Step 1: Write the failing tests** with a fake `AudioContext`: no context before the first Play; Play makes one
  and schedules the cue's voices; a second bed stops the first; Stop stops it; the button reads **Tap to hear** until
  the first Play, then **Play**. `contentEditors()` lists Feel then Audio.
- [ ] **Step 2–4: Run, implement, run.**
- [ ] **Step 5: Commit** `feat(editors): Audio on the suite page, and Play sounds`.

### Task 2: Every sound and bed field, and the sound's picture

**Files:**

- Modify: `audio-model.ts`, `AudioCanvas.svelte`
- Create: `audio-picture.ts`, `AudioPicture.svelte`
- Test: `tests/unit/audio/audio-model.test.ts`, `tests/unit/audio/audio-picture.test.ts`

**Interfaces:**

- Produces: `soundFields` gains `about`, `world`, `no_duck`, `draft`, `sound` (a toggle sets `true` or removes the
  key); `bedFields` gains noise and pulse groups with add and remove; `picture(cue: Cue, width: number, height: number):
{ x: number; w: number; y0: number; y1: number; kind: 'tone' | 'hiss' }[]` (pitch on a log scale, 50 Hz to 8 kHz).

- [ ] **Step 1: Write the failing tests** for the section 4 words and Review Focus 4; `picture` places a tone from 0 s
  to half the length across half the width, rising when `to` > `from`.
- [ ] **Step 2–4: Run, implement, run.**
- [ ] **Step 5: Commit** `feat(editors): Audio edits every sound field and draws its shape`.

### Task 3: Music pieces and rules (waits for the Owner, audit A4)

Not built until the Owner says so: no game plays music pieces (`createMusicDirector` is unused) and a rule's state
comes only from game code, so nothing edited here would be heard in play. If the Owner keeps it, this task gains an
in-play step like Task 5's (the music director on the stage, with the game's state) and a journey step in Task 6, and a
rule with no conditions writes `when = {}` (`when` is required). The steps below stay as written for that day.

**Files:**

- Create: `music-model.ts`, `AudioMusic.svelte`
- Modify: `audio-session.svelte.ts` (`AudioChoice` gains `{ kind: 'music'; index }` and `{ kind: 'rules' }`),
  `AudioPanel.svelte`
- Test: `tests/unit/audio/music-model.test.ts`, `audio-editor.test.ts`

**Interfaces:**

- Produces: `musicFields(slot: Slot): Field[]`; `addSlotEdit`, `fallbackEdits`; `ruleLines(rules: readonly MusicRule[],
slots): { words: string; index: number }[]` ("When danger is at least 2: play Chase"; a rule with no `when` is
  "Otherwise: …"); `addRuleEdit`, `moveRuleEdits(from, to)`, `conditionEdit(rule, key, condition)`; `soundFiles(workspace):
Promise<string[]>`.

- [ ] **Step 1: Write the failing tests** including Review Focus 1 and 2.
- [ ] **Step 2–4: Run, implement, run.**
- [ ] **Step 5: Commit** `feat(editors): Audio sets up the music and its rules`.

### Task 4: When things happen, the mix, and the checks

**Files:**

- Create: `mix-model.ts`, `AudioMix.svelte`, `audio-findings.ts`, `audio-check.ts` (render and measure in the page)
- Modify: the events page in `AudioCanvas.svelte` (uses `gameEvents` from `shared/game-events.ts`; Feel's plan Task 2
  creates it, or this task does if it runs first)
- Test: `tests/unit/audio/mix-model.test.ts`, `tests/unit/audio/audio-findings.test.ts`, `audio-editor.test.ts`

**Interfaces:**

- Produces: `duckLines(content): { words: string; index: number }[]` ("While a voice plays, music drops 6 dB (in 0.1 s,
  back in 0.5 s)"), duck add/remove/field edits, `masterEdit(content, value)`; `unanswered(content, events: GameEvent[]):
GameEvent[]`; `shadowed(content): { index: number; by: number }[]` (a row a row above it answers first, `rowFor`'s
  rule) and `moveRowEdits(from, to)`; `checkSounds(content, make: () => OfflineAudioContext): Promise<SoundFinding[]>`
  (each cue through `renderCue`, then `truePeak`, `clicks` and `integratedLoudness` from `@automata/audio-synth/measure`)
  where `SoundFinding = { sound: string; kind: 'peak' | 'clicks' | 'loudness'; value: number }`;
  `findingWords(finding): string` with the spec section 3.7 sentences.

- [ ] **Step 1: Write the failing tests** including Review Focus 5 (findings carry the content text they were run on;
  a changed text moves them to "Out of date").
- [ ] **Step 2–4: Run, implement, run.** **Check the sounds** runs `checkSounds` with the page's
  `OfflineAudioContext` (a fake in jsdom that returns fixed samples: a clipped one, one with a click, a clean one).
  Review Focus 1 (shadowed rows) is tested here.
- [ ] **Step 5: Commit** `feat(editors): Audio's events, mix and sound checks`.

### Task 5: Audio in play

The Owner's rule (2026-11-08): what a person changes in an editor must be seen (here, heard) in play. Today nothing in
a game plays `audio.toml`: `audioSynthExtension` registers only the content kind and no game calls `createAudioSynth`
(audit A1).

**Files:**

- Create: `extensions/audio-synth/src/features/stage/audio-stage.ts`, entry `src/entries/stage.ts`
  (`@automata/audio-synth/stage`, in `package.json` `exports`); `extensions/audio-synth/tests/unit/stage/audio-stage.test.ts`;
  `.changeset/audio-synth-stage.md` (`patch`)
- Possibly modify: `packages/automata` (see Step 1)

**Interfaces:**

- Consumes: `createAudioSynth`, `MixerPort`; `PixiStage`, `PixiStageHooks`, `FrameInfo` from `@automata/framework`;
  `StepResult` from `@automata/sim`.
- Produces: `audioStage(options: { content: () => AudioContent; port: MixerPort }): { setup(stage: PixiStage):
PixiStageHooks; played(): readonly string[] }`: `apply(result)` hears `result.events` at `result.tick`; `draw` calls
  `frame(lastTick)` and keeps the ids it played for the game's test hook.

- [ ] **Step 1: Find the game's way to core's audio buses.** `MixerPort` is `AudioBuses.input(bus)` and
  `Audio.duck(bus, amount, seconds)`; core exports `AudioBuses` only as a type today
  (`packages/automata/src/entries/runtime.ts`). Find how a game's code reaches its running buses; if it cannot, add the
  smallest public way to core (a `mixerPort()` from the running game), test it, and give it a `patch` changeset. Record
  which in the log.
- [ ] **Step 2: Write the failing tests** with a fake port: an event a row answers plays its cue once when the drawn
  tick reaches it; a shadowed row never plays; a `world` cue pans; a duck rule calls `duck`.
- [ ] **Step 3–4: Run, implement, run.** `pnpm build`, `pnpm api-report --update`, `pnpm agent-skills --write`.
- [ ] **Step 5: Commit** `feat(audio-synth): a game plays its sounds when things happen`.

### Task 6: A sound picked in Audio plays in the game (served journey)

**Files:**

- Modify: `examples/2d-story/` (content-in-play Task 16): `src/` passes `audioStage({ … }).setup` in `renderer.setup`
  and exposes `played()` on the game's test hook; `content/editors.toml` gains the audio row.
- Create: `examples/2d-story/tests/e2e/audio-in-play.test.ts`

- [ ] **Step 1: Served journey** (Chromium, phone and iPad projects): `automata editor` in the example. In the suite,
  open Audio, make a sound "Alarm" (one tone), and under **When things happen** pick it for "systems mode" (the guard
  changes mode); Save. Press **Play**, tap once so the page may play sound, walk into the guard's sight; assert through
  the test hook that `alarm` was played. Explain the run in the log.
- [ ] **Step 2:** If `examples/2d-story` has not landed, leave this step unchecked, say so in the log and the PR, and
  do not count Audio as done. Never write the TOML directly and count it as edited.
- [ ] **Step 3: Commit** `test(examples): a sound picked in Audio plays in the game`.

### Task 7: Layout, template, proof and records

- [ ] Chromium layout test at 390×844 and 820×1180; screens to the project files, looked at before they are kept.
- [ ] Add Audio's row to the create-game template `editors.toml` (`content/audio/*.toml`).
- [ ] `pnpm format`, the package's `test:unit` and `typecheck`, `pnpm boundaries`.
- [ ] Log entry below; a line in `docs/refactor/progress.md`; say what did not run.

## Log

(Each session records what it did here, with evidence.)

**2026-11-08, build session (Sonnet, inline, no subagent).** Branch `claude/project-thread-2salzc`, stacked on #478.

- **The Owner's rule, 05:10:** "We didn't create music in audio, we just import tracks and orchestrate." Task 3 was
  rebuilt on that, not on the plan: Audio makes short sounds and never music. Beds (drones, noise, pulse) are gone from
  the editor; the file's `bed` tables are left untouched. Music is `slot` (an imported track: loops or plays once, how
  fast it fades in, its seam, its delay) and `music_rule` (which track plays when; the first that holds plays; Move up
  and Move down are one undo step; a condition is "is", "at least" or "at most" on a name the game keeps).
  `music-model.ts`, `AudioMusic.svelte`, 11 model tests and 6 editor tests.
- Ruling: the suite's workspace port reads and writes text only, so a track is **imported by putting its file in the
  game's `assets/music` folder**; Audio lists the files it finds ("Tracks in your game folder") with "Use this track",
  and says "The game has no music file called ... yet." for a track without a file. A picker that writes the file would
  need a binary write in the port, which is core's.
- Task 1 done: `audio-output.ts` (`browserAudio`: the context is made on the first Play, resumed, a cue's voices
  played once), Audio registered on the rail after Feel, `sample/audio.toml`, the sample editor list. Beds and their
  Play are gone. The button stays "Play"; "Tap to hear" before the first Play was not built.
- Task 2 partly: the model is as it was; not done: `about`, `world`, `no_duck`, `draft` toggles and the sound's picture.
- Task 4 not done: the mix, shadowed rows and **Check the sounds**. The events page uses the typed field, not
  `gameEvents` yet.
- **Task 5 not done:** `@automata/audio-synth/stage` is not written, and the small music player that makes the
  switching heard in play is not written, so no game plays `audio.toml` yet. Finding how a game reaches core's buses
  (Step 1) was not started.
- **Task 6 not done and not counted:** `examples/2d-story` has not landed.
- Task 7, partly: template rows (`content/audio/*.toml`, `assets/music/*`). Not done: the Chromium layout test and screens.
- Ran: `test:unit` (all pass), `typecheck`, `pnpm boundaries`, `pnpm style`, `pnpm knip`. Did not run: WebKit, Firefox,
  any browser test, any journey.

**Hand-off (build session, 2026-11-08, after the first log).** Not built: `@automata/audio-synth/stage` and the small in-play
music player. The bus question, answered: core has the seam `AudioBuses` (`@automata/framework`, `features/audio/audio-buses.ts`):
`input(bus)` returns the `AudioNode` a source connects to, `gain(bus)` / `setGain(bus, g)` are the player's gains. So the stage
takes the game's `AudioBuses` and the `AudioContext`, plays a cue with `playCue(ctx, buses.input(cue.bus), cue)` when an event
row matches, and plays the `music_rule` winner's track (an `<audio>` or decoded buffer from `assets/music`, connected to
`buses.input('music')`) with the slot's `fade` for the switch. The editor's own `browserAudio` (`src/features/audio/audio-output.ts`)
plays sounds on a throwaway context and is the pattern to copy. Still to find: where a game gets the `AudioContext` that core's
`AudioBuses` uses (the manager in `features/audio/audio.manager.ts`), and how track files in `assets/music` are served in play.
Also not built in the editor: the mix, shadowed rows, Check the sounds, the sound's picture, and the `about`/`world`/`no_duck`/`draft`
toggles. No served journey has run.

**Follow-up log (2026-11-08, PR #487 plus #484).** Built: `@automata/audio-synth/stage` (`audioStage`: the event map's cues on
their buses, imported tracks by `trackAlias`, music rules read against the game's state, fades; events heard while the audio
is locked are dropped, not replayed on unlock), `defineGame({ audio })` (core hands the game `Audio` and the presentation
bus), and Audio's "Use this track" and rules page working on a game with no tracks yet. `examples/2d-story` plays
`content/audio/audio.toml`; its music rules read `mode` (`chase` while the guard hunts or follows, else `calm`). The served
journey `audio-plays-in-game` ran on a phone and an iPad in Chromium: two tracks dropped into `assets/music`, used in Audio,
rules made (chase while `mode` is chase, calm otherwise); the played game's music went calm then chase, and the keeper's
cue played. Not built: the mix, shadowed rows, "Check the sounds", the sound's picture, the `about`/`world`/`no_duck`/`draft`
toggles, `seam` and `resume` in the player, `master_gain`. Not run: WebKit, Firefox.
