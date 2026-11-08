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

## Global Constraints

- The content editors plan's constraints hold (no "Plus", core never imports this package, feature folders, tests in
  `tests/`, 600 lines a file, drunk grandma copy, 44/48 px targets, span-preserving edits, test first).
- Words are the spec's section 4 table, verbatim. No key (`cue`, `bus`, `slot`, `no_duck`, `master_gain`) on screen.
- Nothing plays without a tap; playing never writes the file.
- The audio pipeline runs in Node through the checks port; the page never imports `@automata/pipelines`.

## Review Focus

1. **A rule list with `hold` and `silence`.** Shown as "Keep what plays" / "Play nothing"; reordering keeps the rest
   of each rule's text. Test in Task 3.
2. **A music piece whose file does not exist and has no placeholder.** Play says "There is no file chase yet." and
   plays nothing. Test in Task 3.
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

### Task 3: Music pieces and rules

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
- Create: `mix-model.ts`, `AudioMix.svelte`, `audio-findings.ts`
- Modify: the events page in `AudioCanvas.svelte` (uses `gameEvents` from `shared/game-events.ts`; Feel's plan Task 2
  creates it, or this task does if it runs first)
- Test: `tests/unit/audio/mix-model.test.ts`, `tests/unit/audio/audio-findings.test.ts`, `audio-editor.test.ts`

**Interfaces:**
- Produces: `duckLines(content): { words: string; index: number }[]` ("While a voice plays, music drops 6 dB (in 0.1 s,
  back in 0.5 s)"), duck add/remove/field edits, `masterEdit(content, value)`; `unanswered(content, events: GameEvent[]):
  GameEvent[]`; `findingWords(finding): { sound?: string; words: string }` for true peak, clicks, loudness, duck depth,
  world pan and missing events, with the spec section 3.7 sentences.

- [ ] **Step 1: Write the failing tests** including Review Focus 5 (findings carry the content text they were run on;
  a changed text moves them to "Out of date").
- [ ] **Step 2–4: Run, implement, run.** **Check the sounds** declares the `after` check `audio` in the sample game's
  checks.
- [ ] **Step 5: Commit** `feat(editors): Audio's events, mix and sound checks`.

### Task 5: Layout, template, proof and records

- [ ] Chromium layout test at 390×844 and 820×1180; screens to the project files, looked at before they are kept.
- [ ] Add Audio's row to the create-game template `editors.toml` (`content/audio/*.toml`).
- [ ] `pnpm format`, the package's `test:unit` and `typecheck`, `pnpm boundaries`.
- [ ] Log entry below; a line in `docs/refactor/progress.md`; say what did not run.

## Log

(Each session records what it did here, with evidence.)
