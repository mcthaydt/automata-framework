# The content editors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task
> (the project runs plans natively, never with subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the suite's five missing editors (Feel, Audio, Writer, Sequence, Schematic) as free editors, in a new
private package beside the extensions they edit.

**Architecture:** `extensions/editors` (`@automata/editors`) depends on `@automata/editor` (suite, kit) and
on the extensions; core never imports it. One shared TOML session (kit content documents + kit `History` + the
extension's Zod schema) backs every editor; each editor is a model (file to sentences and back) and Svelte regions.
The package's own suite page registers the core editors and the five.

**Tech Stack:** TypeScript 6.0.3, Svelte 5.57.1, Zod 4.6.6, Vitest 5.0.3 (jsdom + Testing Library, Chromium layout),
Vite 8.3.3.

**Spec:** [`2026-11-08-content-editors-spec.md`](2026-11-08-content-editors-spec.md)

## Global Constraints

- Every editor is free. No copy, comment or name says "Plus", "paid" or "comes with" (Owner, 2026-11-08).
- Core (`packages/*`) never imports an extension or this package.
- Feature folders: a feature imports only itself and `shared/`; `app/` wires; `entries/` only re-exports
  (`pnpm boundaries`).
- Tests in `tests/` (`unit/<feature>/`, `browser/`), suffix `.test.ts`, import code as `#src/…`.
- Files at most 600 lines; kebab-case names; comments say why, never which plan asked.
- Copy passes the drunk grandma test: no key names, schema words or package names on screen.
- Touch targets at least 44 px, primary actions 48 px; phone first.
- Edits go through kit content documents (span-preserving); a write the port refuses leaves history unchanged.
- Private package: no changeset.
- Test first: write the failing test and see it fail for the right reason.

## Review Focus

1. **A file that does not parse.** The editor opens read only with the line and column, and never throws. Test in
   Task 1 (`openTomlSession` on `"[[entry]\n"`).
2. **A write the workspace refuses (conflict after an outside edit).** The message shows, the history keeps its
   previous state, Undo still works. Test in Task 1.
3. **Two rows with the same name** (two feel entries answering one event, two cues with one id). The schema's issue
   shows on the second row in words; the editor never merges or drops either. Test in Task 3 (Feel).
4. **An empty or missing file.** One "Start …" button makes it; nothing else is offered. Test in Task 1 and each editor.
5. **A game whose list names none of the five.** The rail still shows all five, and each opens on its "start" page
   (spec section 7; each editor's plan tests its page).

---

### Task 1: The package and the shared TOML session

**Files:**
- Create: `extensions/editors/{package.json,tsconfig.json,svelte.config.js,vitest.config.ts,README.md}` (shape of
  `extensions/debug`, `private: true`, no `publishConfig`, deps `@automata/editor` and the five extensions as
  `workspace:*`)
- Create: `extensions/editors/src/shared/toml-session.ts`, `src/shared/problem-words.ts`, `src/entries/index.ts`
- Test: `extensions/editors/tests/unit/shared/toml-session.test.ts`, `tests/unit/shared/problem-words.test.ts`
- Modify: `pnpm-workspace.yaml` only if `extensions/*` is not already listed; `knip.jsonc` workspace entry

**Interfaces:**
- Produces:
  - `openTomlSession<T>(options: { path: string; ports: SuitePorts; schema: z.ZodType<T>; empty: string }): Promise<TomlSession<T>>`
  - `interface TomlSession<T> { history: History<TomlState>; read(): TomlRead<T>; exists(): boolean; create(label: string): Promise<Outcome>; edit(label: string, edits: readonly ContentEdit[], options?: { coalesce?: string }): Promise<Outcome>; accept(text: string, summary: string): Promise<Outcome>; undo(): Promise<Outcome>; redo(): Promise<Outcome> }`
  - `type TomlState = { readonly text: string | undefined }`
  - `type TomlRead<T> = { kind: 'missing' } | { kind: 'syntax'; line?: number; column?: number; message: string } | { kind: 'ok'; value: T; problems: readonly Problem[] } | { kind: 'invalid'; value: unknown; problems: readonly Problem[] }`
  - `type Outcome = { ok: true } | { ok: false; message: string }`
  - `interface Problem { keyPath: readonly (string | number)[]; message: string }`
  - `problemWords(issue: z.core.$ZodIssue): string` (in `problem-words.ts`)
  - `undoOf(session: TomlSession<unknown>): SuiteUndo`, `askOf(session, scope: () => readonly string[]): SuiteAskTarget`

- [ ] **Step 1: Failing tests.** `toml-session.test.ts` over `createMemoryPorts` (from `@automata/editor/kit/ports/testing`):
  opens an existing file and reads `ok` with the parsed value; `edit('Shake harder', [{ keyPath: ['entry', 0, 'camera', 0, 'shake'], expected: 0.2, set: 0.4 }])` writes the file, keeps the comment beside it, and `history.undoLabel === 'Shake harder'`; `undo()` writes the old text back; a file `"[[entry]\n"` reads `syntax` with `line: 1` and no throw; a schema failure reads `invalid` with the problem's key path; a write refused after an outside change returns `{ ok: false }` with a message and `history.revision` unchanged; `exists()` false for a missing file and `create('Start a feel file')` writes `empty`. `problem-words.test.ts`: a `too_big` number issue reads "Must be 1 or less."; an `invalid_type` reads "Must be a number." (and text, a list); a custom issue keeps its own message.
- [ ] **Step 2: Run** `pnpm --filter @automata/editors test:unit` and see them fail (module not found).
- [ ] **Step 3: Implement** `toml-session.ts` on `openDocument` (kit documents) and `createHistory`, writing with the
  read mtime (`{ mtime }`) and refreshing it after each write; `problem-words.ts` over Zod's issue codes.
- [ ] **Step 4: Run** the tests; they pass. `pnpm --filter @automata/editors typecheck` is clean.
- [ ] **Step 5: Commit** `feat(extension-editors): the package and the shared TOML session`

### Task 2: The suite's rail lists only the editors the game uses

**Files:**
- Modify: `packages/editor/src/features/suite/shell/suite-entries.ts`, its caller (`Suite.svelte` or `suite-session.ts`),
  `create-suite.ts` (the "Plus build (EDS.P)" comment)
- Test: `packages/editor/tests/unit/suite/shell/suite-entries.test.ts`

**Interfaces:**
- Produces: `suiteEntries(editors, review: boolean, listed?: ReadonlySet<string>): SuiteEntry[]`: with `listed`, only
  editors in it; without, all.

- [ ] **Step 1: Failing test:** with editors `tuner, levels-2d, feel` and `listed = {tuner, levels-2d}`, the entries are
  Tuner and Levels; with `listed` undefined, all three; with an empty set, none (plus Review when `review`).
- [ ] **Step 2: Run** `pnpm --filter @automata/editor exec vitest run --project unit suite-entries`; it fails.
- [ ] **Step 3: Implement**; the caller passes the editor ids the loaded list names, or `undefined` when the list did
  not load. Rewrite the `create-suite.ts` header to say: a suite page passes the editors it has; another package's
  page adds its own.
- [ ] **Step 4: Run** the editor's unit tests; all pass.
- [ ] **Step 5: Commit** `feat(suite): the rail lists the editors the game's list names`

### Task 3: Feel

**Files:**
- Create: `extensions/editors/src/features/feel/{feel-model.ts,feel-session.ts,feel-suite-editor.ts,FeelRegions.svelte,FeelEntry.svelte}`
- Test: `extensions/editors/tests/unit/feel/{feel-model.test.ts,FeelRegions.test.ts}`

**Interfaces:**
- Consumes: Task 1's `openTomlSession`, `undoOf`, `askOf`; `feelSchema`, `type FeelContent` from `@automata/feel`.
- Produces: `createFeel(): SuiteEditor<FeelSession>` with `id: 'feel'`, `label: 'Feel'`, `icon: 'list'`,
  `hue: 'color/ed/feel'`; `eventWords(on: string): string`; `effectSentences(entry: FeelEntry): EffectLine[]` where
  `EffectLine = { channel: Channel; index: number; words: string; fields: EffectField[] }` and
  `EffectField = { key: string; label: string; unit?: string; min: number; max: number; step: number; value: number }`.

Words (fixed copy): an entry is "When {event words}" (`player.hit` → "the player is hit", `door.*` → "any door
event"); camera "Shake the screen" (field "How hard", 0 to 1); pose "Freeze the action" (ms); visual flash "Flash
{colour}" (frames), tint "Tint the screen {colour}" (ms, how strong), squash "Squash" (how much); word "Show the word
{key}" (ms); haptic "Rumble" (strong, weak, ms); audio "Play the sound {cue}". Limits are "Never more than" rows:
"Shake: {n} px", "Freeze: {n} ms", "Flash: {n} frames", "Flash strength: {n}". Empty file: "Nothing has a feel yet.
Add one for something that happens in your game." with "Add a feel" (48 px).

- [ ] **Step 1: Failing tests.** Model: `eventWords('player.hit')` is "the player is hit", `eventWords('door.*')` is
  "any door event"; `effectSentences` gives the sentences above with the values in the fields. DOM (`FeelRegions.test.ts`
  over memory ports holding a two-entry `content/feel/feel.toml`): the panel lists "When the player is hit"; choosing it
  shows "Shake the screen" with a "How hard" field at 0.2; setting it to 0.4 writes `shake = 0.4` and keeps the file's
  other lines; Add a feel → an event field → a new `[[entry]]` with that `on`; Remove asks "Remove this feel?"; two
  entries with one `on` show "Two feels answer the player is hit." on the second; no `hit_stop_ms`, `entry` or `on`
  text anywhere on screen.
- [ ] **Step 2: Run** them; they fail.
- [ ] **Step 3: Implement** the model, the session (Task 1's session on the first `content/feel/*.toml` the editor list
  hands it), the regions (panel, canvas, status) and `createFeel`.
- [ ] **Step 4: Run** the package's unit tests and typecheck; all pass.
- [ ] **Step 5: Commit** `feat(extension-editors): Feel`

### Task 4: The suite page and the sample game

**Files:**
- Create: `extensions/editors/{suite.html,vite.config.ts}`, `src/app/suite/{main.ts,sample-game.ts,content-editors.ts}`,
  `src/app/suite/sample/{editors.toml,feel.toml,audio.toml,dialogue.toml,cutscene.toml,systems.toml}`
- Modify: `src/entries/index.ts` (re-export `contentEditors`)
- Test: `tests/unit/app/content-editors.test.ts`, `tests/browser/suite-layout.test.ts` (Chromium, phone 390×844 and
  iPad 820×1180)

**Interfaces:**
- Produces: `contentEditors(): SuiteEditor<unknown>[]` (the five, in rail order Feel, Audio, Writer, Sequence,
  Schematic; editors not yet built are simply absent); `CONTENT_SAMPLE_GAME: Record<string, string>`.

- [ ] **Step 1: Failing tests:** `contentEditors()` ids are unique and in order; the sample list loads with no
  problems and routes each sample file to its editor; layout test opens the page on the sample, sees Feel in the rail,
  opens it, and every button is at least 44 px.
- [ ] **Step 2–4:** implement the page like `packages/editor-3d/src/suite-main.ts` (core editors first, then
  `contentEditors()`), `vite build --mode suite` to `dist/suite` with `suite.html` renamed `index.html`; run until green.
- [ ] **Step 5: Commit** `feat(extension-editors): the suite page with the content editors`

### Task 5: Audio

**Files:** `src/features/audio/{audio-model.ts,audio-session.ts,audio-suite-editor.ts,AudioRegions.svelte,SoundInspector.svelte,play-sound.ts}`;
tests `tests/unit/audio/*`.

**Interfaces:** `createAudio(options: { play: (cue: Cue) => Promise<void> }): SuiteEditor<AudioSession>`; the page
passes a `play` built on `@automata/audio-synth/browser` (a fresh `AudioContext` on the first press only).

Words: panel sections "Sounds" (cues; a draft one marked "Placeholder"), "Music" (beds), "When things happen" (events:
"When {event words}, play {sound}" or "stay silent: {reason}"). A sound's inspector: "Plays on" (Music, Effects,
Menus, Voices), "Volume", and its voices as "Tone {shape} from {from} Hz to {to} Hz" or "Hiss around {hiss} Hz",
each with "Starts at" and "Lasts" in seconds. Play (48 px) previews; nothing plays by itself.

- [ ] Tests first: model sentences; DOM: rename, volume, add/remove a sound, an event row whose sound is gone shows
  "This sound does not exist." Play calls `play` with the cue. Then implement, run, commit `feat(extension-editors): Audio`.

### Task 6: Writer

**Files:** `src/features/writer/{writer-model.ts,writer-session.ts,writer-suite-editor.ts,WriterRegions.svelte,Conversation.svelte}`;
tests `tests/unit/writer/*`.

**Interfaces:** `createWriter(): SuiteEditor<WriterSession>`; opens `content/dialogue/*.toml` (and the scene's
`content/lines/*.toml` for the line text the nodes point at).

Words: panel lists conversations by their first line; the canvas reads like a script: "{speaker}: {text}", then the
player's choices as buttons "→ {choice text}" that jump to where they lead; "Add a line", "Add a choice". A choice
that leads nowhere says "This choice goes nowhere yet."

- [ ] Tests first (model: a dialogue graph to script lines and back; DOM: edit a line's text, add a choice, a dangling
  choice's message). Implement, run, commit `feat(extension-editors): Writer`.

### Task 7: Sequence

**Files:** `src/features/sequence/{sequence-model.ts,sequence-session.ts,sequence-suite-editor.ts,SequenceRegions.svelte}`;
tests `tests/unit/sequence/*`.

**Interfaces:** `createSequence(): SuiteEditor<SequenceSession>`; opens one `content/cutscenes/*.toml`.

Words: the canvas is a list of steps in time order, each "At {t} s: {sentence}" (camera "Move the camera", actor
"{actor} walks to …", caption "Show the words …", sound "Play {sound}", door "Open/Close {door}", light, time of day,
grade, prop, cue). Changing a step's time re-sorts the list and keeps the step chosen. Total length shown at the top.

- [ ] Tests first; implement; run; commit `feat(extension-editors): Sequence`.

### Task 8: Schematic

**Files:** `src/features/schematic/{agent-model.ts,rule-model.ts,probe-words.ts,effect-words.ts,puzzle-model.ts,schematic-session.ts,schematic-suite-editor.ts,SchematicRegions.svelte,AgentView.svelte,RuleView.svelte}`;
tests `tests/unit/schematic/*`.

**Interfaces:** `createSchematic(): SuiteEditor<SchematicSession>`; `probeWords(probe: Probe): string`,
`effectWords(effect: SysEffect): string` (every variant of `systems.schema.ts`, each with a test).

Words: panel sections "Characters" (agents) and "World rules" (rules), and "Puzzle" when the scene has one. A
character reads: "Notices: sight up to {range} m, sound …"; "Moves at" per mode; "Starts in {initial}"; then one
sentence per switch, highest priority first: "From {from} to {to} when {probes joined by 'and'}". A rule reads "When
… then …". Editing in this pass: numbers (ranges, speeds, timers, priorities), mode names, and the order of switches;
adding a switch picks from/to modes and one condition from a list in words. Probes and effects the editor cannot
compose yet show their sentence read only with "Edit this in the file for now."

- [ ] Tests first (`probeWords`/`effectWords` per variant; DOM: change a speed, reorder two switches, add a switch).
  Implement, run, commit `feat(extension-editors): Schematic`.

### Task 9: Journeys, docs and the gate

**Files:** `tests/browser/journeys/{feel,audio,writer,sequence,schematic}.test.ts`; `docs/refactor/progress.md`;
`docs/refactor/copy.md` (the five editors' copy rows); `README.md` of the package.

- [ ] One journey each on the sample page: open from Home, change one thing, the file changes, Undo puts it back.
- [ ] `pnpm format`, `pnpm check`; record what ran and what did not (WebKit, Firefox: GPU runner) in the plan log.
- [ ] Commit `test(extension-editors): a journey per editor`.

## Log

(Each session records what it did here, with evidence.)

- **2026-11-08, first session.** Task 1 done (`4b5defbb`; 15 unit tests). Task 2 built (`a930be8a`) and then reverted on
  the Owner's word: hiding an editor the list does not name leaves no way to start its first file (spec section 7).
  Task 3, Feel, done (`0651911b`; 23 unit and DOM tests). Task 4, the suite page, done (`d3dd2e0e`; checked in Chromium
  at 390x844 and 820x1180, screens in the project files `refactor/2026-11-08-content-editors-screens/`). Task 5, Audio,
  half done and parked (`291d4c3d`; not on the page; Play not wired). The Owner then asked for a spec and plan per editor
  (spec section 7b): Tasks 5 to 8 move to those plans, Schematic first, and Feel and Audio are brought in line with
  theirs. Not run: Chromium layout tests as a suite project, journeys, WebKit, Firefox.
