# Typed words are saved (`claude/typed-words-saved`): implementation audit

Audited 2026-11-13 on `ea7052b9` (10 commits on `main` `7b6ce6ac`), full history, against Task 1 of the editors' v2
landing plan (`claude/editors-v2-landing-plan-audit`: `docs/superpowers/plans/2026-11-12-editors-v2-landing.md`) and
its plan audit's A3, A4 and A5.

## Verdict

**Ready to merge: no, not on `ea7052b9`.** The fix itself is sound: typed words reach the save without Enter or blur in
every field kind that has a text box, on a pause, on leaving and on page hide, and no sign-in or sync code came across.
But the saved line can still say "Saved on this device" when nothing is kept (finding 1, blocker), it promises a "Save a
copy" that does not exist (2), it hides most of its one data-loss warning on wider bars (3, the coordinator's ruling
C), and two widgets key their drafts by label (4). Each is small and local and is fixed in this session's "Fixes"
section; with them the branch is ready to be named for merge (see "Fixes" for the head and the gate).

## Findings

### 1. Blocker: the 3D page and the content editors' page never pass `kept`, so a sample held in memory says "Saved on this device"

`openSuitePorts` returns `kept: false` when the browser refuses private storage (the sample then lives in a memory
store). Only the 2D page's `packages/editor/src/app/suite/main.ts` passes it on. `packages/editor-3d/src/app/suite/suite-main.ts:25`
and `extensions/editors/src/app/suite/main.ts:27` destructure `{ ports, sample, gameUrl, game, … }` without `kept`, and
`boot.ts` and `Suite.svelte` default `kept` to `true`. So on the 3D page and on the content editors' page (the page
finding B's commit `eaffacf15` was meant to make honest), a private window or blocked site data shows "Saved on this
device" while a reload loses the work. Finding B fixed the ports (the sample now goes through `openSuitePorts`'s `sample`
option, verified) but not the flag that tells the line. **Fix:** the default says less, not more: a sample with no
`kept` given is not kept (`kept` defaults to `false`), and both pages pass `kept` through. Test first: `Suite` on a
sample with no `kept` says "Not saved".

### 2. Should fix: the warning names an action that does not exist

`save-line.ts`: "Not saved: this browser can't keep files. Save a copy to keep your work." There is no "Save a copy"
anywhere in the suite: the sample has no Publish (`publish: undefined` for the sample in `open-suite-ports.ts`), no
download, no export (`git grep -niE "save a copy|download" packages/editor/src/features/suite` finds only Publish's
"Download the zip", which a sample never shows). A drunk grandma reads the line, looks for "Save a copy", and finds
nothing. **Fix:** words that say what is true and what to expect: "Not saved: this browser can't keep your work. It is
lost when this page closes." `docs/refactor/copy.md`'s row follows.

### 3. Should fix (the coordinator's ruling C): the data-loss warning is cut on bars wider than a portrait phone

`SuiteTopBar.svelte` puts the line on a row of its own only for `compact && width < 600`; elsewhere `.where` is
`flex: 0 1 auto; min-width: 5.5rem` with an ellipsis, and the whole words only in `title` (nothing on touch). The layout
test accepted it (`shortens` in `suite-save-line.test.ts`). **Fix:** a line in the `failed` state (the warning, and
"Not saved: <the store's words>") always takes the second row, whole, at every size; the short "saved" lines stay on one
row. `suite-save-line`'s cases at phone landscape (844 x 390) and iPad portrait and landscape assert the whole warning
is on screen and not cut, with Undo and Redo in view and no page scroll.

### 4. Should fix: Stepper and ColorField key their drafts by label

B1 keys `FieldRow` and `WordsField` drafts by `fieldPosition`, but `Stepper.svelte` keys by `label` and `ColorField.svelte`
by `` `${label} hex` ``. Labels repeat: `AnimationSection.svelte` draws a "Speed" stepper for every clip; Levels 3D's
`SectorCard` draws `piece.label` in a loop. A number typed into the second clip's Speed and left when the tab closed is
offered to **every** stepper with that label whose value matches the draft's base (both clips at the default speed get
it: reproduced, `expected [[12, 0], [12, 1]] to deeply equal [[12, 1]]`). **Fix:** both widgets register their typing
field from an action on their root element and key it by `fieldPosition(node)`.

### 5. Should fix: plan IDs in comments

AGENTS.md: comments "do not say which plan asked for the code". Ten new comments say `P14` or `P7`
(`Suite.svelte`, `suite-session.ts`, `suite-ports.ts`, `typed-save.test.ts`, `typing-widgets.test.ts`, `history.test.ts`,
`FieldEditor.test.ts`, the journey `typed-words-kept.test.ts`, …). **Fix:** drop the IDs; the sentences already say why.

### 6. Should fix: props that only made sense with sign-in

`SaveLineInput.sync` ("what the sync loop says about GitHub") and `SaveLineInput.reason` are never passed by anything on
this branch; `OpenedSuitePorts.where` and `.reason` are returned and never read (`main.ts` reads `kept`). They are the
sync chain's, which arrives whole in the plan's Task 8. **Fix:** remove them, and their test case; `kept` and `lineBelow`
stay (each is used and true). `kept` was never on `main` (`git log -S` finds no removal), so nothing `main` removed on
purpose came back.

### 7. Note: a refused value left in a field stays a draft until some other write lands

`typing-drafts.ts` adds a field's key to `awaiting` when it is left with a refused text (`!refused || leaving`), and only
a later write's `wrote(true)` removes it. Leave "0." in a number field and close the tab with no other edit: the next
open offers "0." back, and `FieldRow` says "Type a number." under a field the person did not touch. Harmless (nothing is
written) and rare; left for the v2 merge, which rewrites these fields.

### 8. Note: the 2D and 3D editors have no `draftView`

The five content editors give `draftView` (the file and the thing chosen); Levels 2D, Characters, Tiles, the Tuner,
Levels 3D and the Studio do not, so their drafts are kept under the editor and entry only, plus the field's place or id.
The `base` check (a draft goes back only to a field that still reads what it was typed over) stops most mix-ups; one that
gets through needs a closed tab mid-typing, then a different level or character open in the same view whose field reads
the same old value. Worth a `draftView` each when the v2 merge touches those sessions; not a merge blocker.

### 9. Note: the draft scope of a game with no name is the sample's

`Suite.svelte` scopes drafts by `game ?? 'sample'`. A served game whose server sends no name shares the try-it sample's
scope on the same origin. The `base` check and the editor/entry/place key keep this from mattering in practice.

### 10. Note: the journeys cover Writer, Feel, the Tuner and Schematic; the widgets are proved in unit tests

The plan's "Done means" lists a Stepper, a colour hex, and the Characters and Tiles text fields among the journeys. They
are proved by DOM tests (`typing-widgets.test.ts`, `typed-save.test.ts`, `FieldEditor.test.ts`), not by a reload in a
real browser. Finding A's adaptation is otherwise faithful: every journey types with `pressSequentially`, never presses
Enter or leaves the field, and reads the words back after a reload or a closed browser; the fields journey checks that
the two other "What it says" lines and the door's "Waits" are untouched (no assertion was weakened against the plan's).

## What was verified, and how

- **No sync came across:** `git grep -nE "kit/sync|web-games|holdWhile"` prints nothing.
- **Unit suites** on `ea7052b9`: editor 3310 passed (278 files), editors 671 passed (56 files): the report's numbers.
- **The fix in every field kind:** read `typed-save.ts`, `typing-drafts.ts` and each call site: FieldEditor (text and
  long text, keyed by row id), FieldRow (number and text, by place; names `commit="leave"`), WordsField (Writer's lines,
  by place), the Tuner's numbers and control names, Characters' labels, ids and options, Tiles' group names, Stepper
  and ColorField (finding 4). A pause of 500 ms, leaving, Ctrl/Cmd+Enter and `pagehide` (`flushOnHide`) all commit;
  `beforeunload` asks while a draft waits or a write runs. Timers are injected (`TypingTimers`), and every unit test
  uses a fake clock; `pageTimers` is the page's only wall clock and it is presentation, not the sim.
- **Undo:** one visit to a field is one Undo step (`visit()` joins writes; `history.test.ts`, `write-path.test.ts`).
- **Drafts:** scoped by game, keyed by editor, entry, view and field; offered back only over the value they were typed
  over; removed once the write that carries them has finished (`wrote(idle)`), kept while a write is in flight.
- **Storage honesty:** `keep-storage.test.ts` (persist refused, the write throws: the line says not kept, no other
  store written) re-run green. Device storage is used only where `openPrivateStores` says it is persistent; a refusal
  gives a memory store and `kept: false` (finding 1 is where that flag was lost).
- **Conventions:** every changed source file is under 600 lines; tests import `#src/…`; no "hook skipped" leftovers.
- **Copy:** the editors are English-only today (no editor string goes through a catalogue), so the saved-line words have
  no translations to keep in step; `copy.md`'s four rows match the shipped strings except the one finding 2 changes.

## Merging with the v2 landing

A trial merge of `origin/claude/editors-v2-landing` (`d2fe266f`, which already contains `main`) with this branch, both
ways, full history: **16 conflicting files, the same 16 either way.** For whoever merges second, file by file (v2's
side is "v2", this branch's is "typed"):

| File | v2 changed | typed changed | Resolution that keeps both |
|---|---|---|---|
| `packages/editor/src/features/suite/shell/SuiteTopBar.svelte` | deleted (v2's `SuiteHeader` + `SaveState`) | the saved line, `lineBelow`, the second row | stays deleted. The line's words come from `saveLine()`; `SaveState.svelte` takes a `SaveLine` (or v2's `save` built from it) and shows `line.words` whole; the failed state wraps under the header's first row, as finding 3's fix does here. Never `white-space: nowrap` on a failed line. |
| `Suite.svelte` (4 hunks) | `SuiteHeader`, `gameName`, `playOff`, `problemCounts` | drafts, `keep`, saved line, `lineBelow`, `drafts.place`, leave guard | keep v2's header and imports; add typed's `setTypingDrafts` import, the `kept` prop (no default but `false`, finding 1), the drafts, `keep`, the `pending`/`failed` effect, `line`, `drafts.place`, the hide/leave effect; pass `line` to `SuiteHeader`/`SaveState`. Drop typed's `editorMenu`/`folded` only if v2 removed them. |
| `EditorShell.svelte` | the `.frame` face before the header | `data-rows={topbarRows}` | v2's frame line, then typed's header with `data-rows`. |
| `shell-regions.css` | the compact header wraps; the status line hidden on a phone | `[data-rows="2"]` wrap | keep both rules; v2's compact wrap already covers the phone, typed's covers a failed line at any size. |
| `open-suite-ports.ts` (2) | `playOff` | `kept` (after finding 6: no `where`, `reason`) | both: `kept` and `playOff` in each return. |
| `packages/editor/src/app/suite/main.ts`, `extensions/editors/src/app/suite/main.ts` | `playOff`; the every-editor page's comment | `kept`; "kept in this browser" | destructure both `kept` and `playOff` and pass both to `startSuite`; v2's comment, with "held in memory" corrected to "kept in this browser" (the content sample now goes through `openSuitePorts`). The 3D page in v2 too. |
| `suite-session.ts` | `list: { ensure }` | `visit`, `counted`, `inFlight`, `failed` | both keys in `portsFor`, both sets of fields. |
| `suite-ports.ts` | `list?: EditorListPort` and the port | `visit?` | both members. |
| `suite-editor.ts` | `header`, `entries`, `homeNames`, `showView` | `draftView` | all of them. With `entries` one editor has several rail entries: `drafts.place` already includes `entry?.id`, so keep it. |
| `write-path.ts` | `writeAll` wraps `writeSteps` in `refusedBy` | `writeAll(…, options)` with `join` | v2's wrapper, with `options: WriteOptions = {}` threaded through `writeAll` into `writeSteps`. |
| `FieldEditor.svelte` (3) | `SELF_LABELLED` | `uid`, `drafts`, `use:typedSave` with `aria-describedby` | both: v2's set, typed's `uid` and `drafts`; each text box takes typed's `use:typedSave` and `aria-describedby`, no `value=`. |
| `extensions/editors/src/shared/ui/FieldRow.svelte` (2) | v2's `Field` wrapper, its own indentation | typed save, `commit="leave"`, `check()` | v2's markup inside `Field`; the input takes typed's `bind:this`, `use:typedSave` and no `value`/`onchange`. Import both `Field` and the typing kit. |
| `packages/editor/src/testing/suite/suite-layout.ts` | `game: Pick<…, 'playUrl' \| 'playOff' \| 'publish'>` | `game: Pick<…, 'game' \| 'sample' \| 'kept'>` | one `game` parameter picking all six. |
| `tests/unit/suite/shell/suite-session.test.ts` | `loadedList`, `setup(checks)` | the doc comment on `loadedList`, typed's cases | v2's helpers with typed's comment; keep every case from both. |
| `tooling/api-report/reports/editor.api.md` (3) | v2's exports | typed's exports | regenerate: `pnpm build`, `pnpm api-report --update`. |

Not a conflict but a trap: `extensions/editors/src/app/suite/open-content-suite.ts` merges to this branch's version
(the sample through `openSuitePorts`), and v2's `main.ts` must then read `kept` from it (row above), or finding 1
comes back on the every-editor page. After the merge, `suite-save-line` must run against `SaveState` (the test looks for
`[role="status"] .words`; adjust the selector, not the assertions).

## For the tracker

- Task 1 (typed words are saved): implementation audited 2026-11-13 on `ea7052b9`; 1 blocker, 5 should-fix, 4 notes
  (`docs/superpowers/audits/2026-11-12-typed-words-saved-implementation-audit.md`). Fixed on the branch: findings 1 to 6
  and the coordinator's ruling C. Notes 7 to 10 left for the v2 merge.
- The v2 merge meets this branch in 16 files; the resolution table is in the audit ("Merging with the v2 landing").

## Not run

- WebKit, Firefox and real devices (an iPhone's on-screen keyboard, a real rotation with a field focused): the Owner's.
- A real Chromium profile with site data blocked was not driven by hand; the refusal is proved by `keep-storage` and by
  the layout case "in a browser that keeps nothing" (the suite given `kept: false`).
- The 3D and the editors' layout suites and the journeys were not re-run in full here; see "Fixes" for what was.

## Fixes

Each in its own commit, the test red first where there is behaviour to test (the hook ran each package's unit tests on
every commit, never skipped):

| Finding | Commit | Test, red then green |
|---|---|---|
| 1, `kept` lost on the 3D and content pages | `887c4f30` | `Suite-topbar.test.ts` "on a sample nobody said is kept, the line says it is not saved": red on the branch (the line said "Saved on this device"), green after; `kept` now defaults to `false` and both pages pass it |
| 4, Stepper and ColorField keyed by label | `49d193ec` | `typing-widgets.test.ts` "offers a typed number back to the stepper it was typed in, and to no other": red (`[[12, 0], [12, 1]]`), green after; the two older reload cases now clear the page between renders, as a reload does |
| 3, the coordinator's ruling C | `91f45676` | `suite-save-line.test.ts` at phone portrait and landscape (844 x 390), a small phone, iPad Pro 11 portrait and landscape and iPad mini portrait, with a mouse and with touch: the whole warning, not cut across or below, game name, Undo and Redo on screen, no page scroll. Red at 5 cases (every size wider than 600 px), green after; `suite.test.ts` (the sample suite's targets, 44/48 px under touch) green with it: 102 of 102 |
| 2, "Save a copy" that does not exist | `b338ce89` | `save-line.test.ts` and `keep-storage.test.ts` on the new words, red then green; `copy.md` row changed with them |
| 6, sign-in-only props | `ee066fe3` | removal; `open-suite-ports.test.ts` now asks `kept` only |
| 5, plan IDs in comments | `e0ae21d6` | comments only |

There is no "Save a copy" action to name (finding 2): the warning now promises none. Not fixed, as notes: 7, 8, 9, 10.
