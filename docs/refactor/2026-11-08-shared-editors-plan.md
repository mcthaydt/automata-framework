# Shared Editors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (no
> subagents in this project). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every editor but the two level editors works in a new 2D and a new 3D game: on the rail, and what a person
makes in it shows in play. Characters is one rail entry in both kinds (D1 = A).

**Architecture:** The suite's rail shows every editor the page registers, filtered only by the game's kind; Levels 2D
contributes a second rail entry, Characters, that opens its Characters view. Starting a file adds the editor's rows to
the game's list, which the server now lets grow and re-reads. Each content editor checks the game has its player. Core
gets a `StageCharacters` port so Feel reaches 3D characters, the cutscenes extension gets a 3D stage, and both
create-game templates wire every content player with one small file per editor.

**Tech Stack:** TypeScript, Svelte 5 runes, Vitest (jsdom, Testing Library, browser mode), Playwright journeys, Zod 4,
PixiJS 8 and Pixi 3D, Koota sim.

**Spec:** [`2026-11-08-shared-editors-spec.md`](2026-11-08-shared-editors-spec.md). Audit:
[`2026-11-08-shared-editors-audit.md`](2026-11-08-shared-editors-audit.md). Plan audit (its findings PA1 to PA21 are
fixed in this plan and the spec): [`2026-11-08-shared-editors-plan-audit.md`](2026-11-08-shared-editors-plan-audit.md).

**Base:** the build branches from PR #508 (`claude/complete-game-journeys`), or from the newest stack head that holds
it. Every path below was read there at `89db7336`.

## Global Constraints

- The framework's laws and `AGENTS.md` hold: test first, feature folders, tests in `tests/` importing `#src/…`,
  kebab-case files with role suffixes, at most 600 lines a file, comments say why and never name this plan.
- No page gains or loses an editor in this plan. What the web page, the published tools and the site carry is the
  apps work's (spec §2). Every rule here works on "the editors this page registers". A game made with the published
  tools gains no private package: the 2D story is behind `storyAvailable()` (Task 13).
- The editor list is never written by an editor except by `listGrowsBy` (Task 5): the old list unchanged, plus rows
  that are exactly `editorRows` rows. No other path widens what the editors may write or adds a check's command.
- Copy passes the drunk grandma test. The exact words are the spec's §6 and §11; a DOM test asserts each.
- Touch targets 44 px, primary actions 48 px. Never shrink a tab or hide an action to fit (spec §4).
- No file key, glob, package name or event id as page text, except Feel's "Another event (its name in the code)" box.
- Behaviour is code, content is files: the templates' story code starts conversations and cutscenes; the editors only
  edit files.
- Published packages touched get a `patch` changeset: of those here, `@automata/framework` (Task 10), `@automata/feel`
  (Task 10), `@automata/content` (Task 9) and `@automata/tools` (Tasks 6, 12, 13, 16, 17). `@automata/editor`, `-editors`,
  `-3d`, `-cutscenes` and `-sectors` are private and get none. After a
  published package's exports change: `pnpm build`, `pnpm api-report --update`, `pnpm agent-skills --write`,
  `pnpm cheatsheet`, and commit what they write.
- A hash that moves is investigated. None of this work should move a sim hash: the templates are new games, and core's
  sim is untouched.
- Each `test.fail` mark comes off only with a make-and-play journey (spec §13). A step that could not run stays
  unchecked in this plan's log, named.
- `pnpm format` and `pnpm check` before every commit; Conventional Commits; ordinary commits, no force-push.

## Review Focus

1. **A game whose list names both level editors** (`levels-2d` and `levels-3d`). The rail shows Levels 2D, Levels 3D,
   Characters 2D and Characters 3D, each opening the right thing. Test in Task 1.
2. **Undo right after Characters' first change, while Levels has older steps.** One history: the top bar's Undo label in
   Characters names the step it takes back, and taking it back does not undo a Levels step first. Test in Task 2.
3. **A hand edit of `content/editors.toml` that removes a row while the editor runs.** The server re-reads the list;
   a write to the removed file is refused in words, and the editor's own append-only rule never removes rows. Test in
   Task 6.
4. **A game whose `package.json` has the player under `devDependencies` only, or a `package.json` that is not JSON.**
   Both count as having the player (no false alarm). Test in Task 8.
5. **A phone held upright with the open editor last on the rail** (Schematic). It is one of the shown tabs; More holds
   the others. Test in Task 4.

---

## Phase 1: the rail and Characters

### Task 1: Editors have a kind; the rail shows every editor of the game's kinds

**Files:**

- Modify: `packages/editor/src/shared/kit/ports/suite-editor.ts` (add `kind`), `packages/editor/src/features/suite/shell/suite-entries.ts`,
  `packages/editor/src/features/suite/shell/Suite.svelte:86-88`, `packages/editor/src/app/suite/levels-2d/levels-2d-suite-editor.ts`,
  `packages/editor-3d/src/features/studio/studio-suite-editor.ts`, `packages/editor-3d/src/features/levels-3d/levels-3d-suite-editor.ts:37`
  (label "Levels", kind `'3d'`)
- Test: `packages/editor/tests/unit/suite/shell/suite-entries.test.ts`, `packages/editor/tests/unit/suite/shell/SuiteRail.test.ts`

**Interfaces:**

- Produces: `type EditorKind = '2d' | '3d'`; `SuiteEditor.kind?: EditorKind`; `gameKinds(listed: readonly string[] | undefined): ReadonlySet<EditorKind>`;
  `suiteEntries(editors: readonly Named[], listed?: readonly string[]): SuiteEntry[]` (same signature, new rule);
  `SuiteEntry.kind?: EditorKind`. `Named` gains `kind`.

- [x] **Step 1: Write the failing tests** in `suite-entries.test.ts`:

```ts
const tuner = { id: "tuner", label: "Tuner" };
const l2 = { id: "levels-2d", label: "Levels", kind: "2d" as const };
const l3 = { id: "levels-3d", label: "Levels", kind: "3d" as const };
const studio = { id: "studio", label: "Characters", kind: "3d" as const };
const feel = { id: "feel", label: "Feel" };
const all = [tuner, l2, l3, studio, feel];

it("shows every editor of a 2D game, listed or not, and none of 3D", () => {
  expect(suiteEntries(all, ["levels-2d", "tuner"]).map((e) => e.id)).toEqual([
    "tuner",
    "levels-2d",
    "feel",
  ]);
});
it("shows every editor of a 3D game, listed or not, and none of 2D", () => {
  expect(suiteEntries(all, ["levels-3d"]).map((e) => e.id)).toEqual([
    "tuner",
    "levels-3d",
    "studio",
    "feel",
  ]);
});
it("shows both kinds when the list names neither level editor, or did not load", () => {
  expect(suiteEntries(all, ["tuner"]).map((e) => e.id)).toEqual([
    "tuner",
    "levels-2d",
    "levels-3d",
    "studio",
    "feel",
  ]);
  expect(suiteEntries(all, undefined).map((e) => e.id)).toEqual([
    "tuner",
    "levels-2d",
    "levels-3d",
    "studio",
    "feel",
  ]);
});
it("names both kinds apart in a game with both level editors", () => {
  expect(
    suiteEntries(all, ["levels-2d", "levels-3d"]).map((e) => e.label),
  ).toEqual(["Tuner", "Levels 2D", "Levels 3D", "Characters 3D", "Feel"]);
});
it("names one kind plainly, even when the list did not load", () => {
  expect(suiteEntries([tuner, l2, feel], undefined).map((e) => e.label)).toEqual([
    "Tuner",
    "Levels",
    "Feel",
  ]);
  expect(suiteEntries(all, ["levels-3d"]).map((e) => e.label)).toEqual([
    "Tuner",
    "Levels",
    "Characters",
    "Feel",
  ]);
});
```

(`Characters 2D` joins this list in Task 2.)

- [x] **Step 2: Run** `pnpm --filter @automata/editor exec vitest run tests/unit/suite/shell/suite-entries.test.ts`.
      Expected: FAIL, unlisted `feel` missing from the first two.
- [x] **Step 3: Implement.** `gameKinds`: `'2d'` if `listed` has `levels-2d`, `'3d'` if `levels-3d`; neither or
      `undefined` gives both. `suiteEntries` keeps an editor when it has no `kind` or its kind is in `gameKinds(listed)`.
      An entry's label is its editor's label, plus " 2D" or " 3D" for an entry with a `kind` only when the entries kept
      hold both kinds (replacing the `levels-…` special case in `editorLabel`; Levels 3D's own label becomes "Levels",
      its one-kind name, like Levels 2D's). Set `kind` on Levels 2D (`'2d'`), Levels 3D and the Studio (`'3d'`). Rewrite
      the comments at `suite-entries.ts:40` and `Suite.svelte:84` to the rule.
- [x] **Step 4: Run** the test file and `SuiteRail.test.ts`. Expected: PASS. Fix any `Suite*.test.ts` that asserted the
      old filter by asserting the new rule instead; `suite-entries.test.ts:50` (Levels 3D alone, list not loaded) now
      expects "Levels". Between this task and Task 3 an unlisted editor's tab opens nothing: it has no Home card yet.
- [x] **Step 5: Commit** `feat(suite): the rail shows every editor of the game's kinds`.

### Task 2: A rail entry can open a view; Characters leaves Levels 2D's tabs

**Files:**

- Modify: `packages/editor/src/shared/kit/ports/suite-editor.ts`, `suite-entries.ts` (`iconFor`), `Suite.svelte` (the
  `target` derivation at `:102`, `choose` at `:182` and the open effect at `:115`), `packages/editor/src/features/suite/shell/home-model.ts`,
  `packages/editor/src/shared/kit/icons/paths.ts` (a `person` icon),
  `packages/editor/src/app/suite/levels-2d/levels-2d-suite-editor.ts`, `Levels2dTools.svelte:21-36`,
  `levels-2d-session.ts` (`Levels2dView` stays; nothing else)
- Modify: `packages/editor/tests/e2e/journeys/complete-game-2d.test.ts` (the "player start in Characters" steps)
- Test: `suite-entries.test.ts`, `home-model.test.ts`, `packages/editor/tests/unit/suite/shell/Suite-levels.test.ts`

**Interfaces:**

- Consumes: Task 1's `kind`, `gameKinds`.
- Produces: `interface SuiteEntryDef { readonly id: string; readonly label: string; readonly icon: IconName; readonly kind?: EditorKind; readonly view: string }`;
  `SuiteEditor.entries?: readonly SuiteEntryDef[]` (absent: one entry, the editor itself, as now);
  `SuiteEditor.showView?: (session: S, view: string) => void`; `SuiteEntry.view?: string`.
  Levels 2D's entries: `{ id: 'levels-2d', label: 'Levels', icon: 'grid', kind: '2d', view: 'level' }` and
  `{ id: 'characters-2d', label: 'Characters', icon: 'person', kind: '2d', view: 'characters' }`; `showView` sets
  `session.view` (and from `'characters'` to `'level'` only when the Levels entry is chosen while the view is
  `'characters'`, so Tiles survives a trip away and back). `person` is a new kit icon (a head and shoulders, drawn in
  `paths.ts` like the others), and `iconFor` gives it to `studio` too, so both kinds' Characters look alike.
  `EditorCard.entry` is the entry's id (`'characters-2d'` for the Characters card, whose `editor` is `'levels-2d'`).

- [x] **Step 1: Write the failing tests.** In `suite-entries.test.ts`: a 2D game's entries are
      `['tuner', 'levels-2d', 'characters-2d', 'feel']`, `characters-2d`'s `editors` is `['levels-2d']` and its `view`
      `'characters'`; with both kinds the labels include `'Characters 2D'` right after `'Levels 2D'`. In
      `Suite-levels.test.ts`: pressing the rail's "Characters" shows the Characters panel and the top bar shows no
      `Views` tabs and no level picker; pressing "Levels" shows the level with tabs `Level, Tiles` only; Characters,
      Levels, Characters again opens one session (the editor's `open` ran once); a change made in Characters, then the top
      bar's Undo, puts the definition back and the Undo button's label named that step (Review Focus 2). In
      `home-model.test.ts`: a 2D list gives a "Characters" card after "Levels" with the level project's rows and
      `entry: 'characters-2d'`. In `suite-entries.test.ts`: `studio` and `characters-2d` both have the icon `person`.
- [x] **Step 2: Run** the three files. Expected: FAIL (no `characters-2d`).
- [x] **Step 3: Implement.** `suiteEntries` expands an editor with `entries` into one `SuiteEntry` per def
      (`editors: [editor.id]`, `view`, the def's `kind`), each filtered by kind. `Suite.svelte`: `target` is the installed
      card whose `entry` is the chosen entry's id (today it wants exactly one card of the editor, and two entries of one
      editor have two cards, so neither would open); `Home`'s list for an entry goes by `card.entry` too. Call
      `editor.showView?.(session, entry.view)` in `choose()` when the editor's session exists, and in the open's `.then`
      before the session is stored, so the right view draws first (an `$effect` would paint the old view for a frame).
      `homeOf` gives each extra entry its own card with the editor's files. Drop `characters` from
      `Levels2dTools.svelte`'s `VIEWS`, and show neither the `Views` tabs nor the level picker while the view is
      `characters`: the rail is the way back to Levels.
- [x] **Step 4: Update the 2D journey.** In `complete-game-2d.test.ts`, the player start's picture is now changed from
      the rail: `await railHas(page, 'Characters').click()` replaces the Levels view tab step; nothing else in the journey
      changes.
- [x] **Step 5: Run** the unit files, then `pnpm --filter @automata/editor exec playwright test -c playwright.journeys.config.ts complete-game-2d
--project editor-ipad-chromium`. Expected: PASS (the five `test.fail` journeys still fail for their reasons).
- [x] **Step 6: Commit** `feat(suite): Characters is its own rail entry in 2D games`.

### Task 3: Home cards for every editor, and their words

**Files:**

- Modify: `home-model.ts`, `packages/editor/src/features/suite/shell/EditorCardView.svelte`
- Test: `home-model.test.ts`, `packages/editor/tests/unit/suite/shell/Suite.test.ts`

**Interfaces:**

- Consumes: Task 1's rule; Task 2's entries.
- Produces: `homeOf(load, files, suite)` returns a card for every rail entry (listed or not), in rail order, then the
  listed editors this page lacks; an unlisted card has `files: []`, `installed: true`.

- [x] **Step 1: Write the failing tests.** A 2D list naming only `levels-2d` gives cards for every 2D-kind and kindless
      editor the page registers; the Feel card has `files: []`. In `Suite.test.ts`: the Feel card shows the title "Feel"
      once (no "Feel / Feel") and the line "Nothing made yet. Open it to start."; pressing it opens Feel on its start
      page.
- [x] **Step 2: Run.** Expected: FAIL.
- [x] **Step 3: Implement** in `homeOf` from `suiteEntries(suite.editors, listed)`; the card component drops the
      repeated subtitle and shows the spec §11 line when `rows` is empty.
- [x] **Step 4: Run** the files and `Suite*.test.ts`. Expected: PASS.
- [x] **Step 5: Commit** `feat(suite): Home has a card for every editor on the rail`.

### Task 4: The phone rail fits nine editors

**Files:**

- Modify: `packages/editor/src/features/suite/shell/SuiteRail.svelte`,
  `packages/editor/src/shared/kit/shell/shell-layout.css:12` (`--shell-rail`),
  `packages/editor/tests/e2e/harness/complete-game.ts:16-18` (`railHas`, new `openFromRail`) and every journey that
  presses a rail tab (`grep -rn "railHas(" packages/editor/tests/e2e`)
- Create: `packages/editor/src/features/suite/shell/rail-fit.ts`
- Test: `packages/editor/tests/unit/suite/shell/rail-fit.test.ts`, `packages/editor/tests/browser/layout/suite/shell/rail-phone.test.ts`

**Interfaces:**

- Produces: `railFit(widths: readonly number[], room: number, open: number | undefined, moreWidth: number): { shown: number[]; more: number[] }`
  (indexes into the entries).

- [x] **Step 1: Write the failing unit tests**: all fit → `more` empty; nine 60 px tabs in 390 with a 56 px More →
      `shown` is the first five and `more` the rest; the open editor at index 8 → `shown` is `[0,1,2,3,8]`, `more`
      `[4,5,6,7]` (Review Focus 5); never fewer than one shown tab.
- [x] **Step 2: Run.** Expected: FAIL (no module).
- [x] **Step 3: Implement `railFit`** (greedy left to right, reserving More's width once anything overflows; the open
      one takes the last shown slot). `SuiteRail.svelte` measures each tab's natural width once (a hidden measuring row)
      and the bar's width with a `ResizeObserver`, renders `shown`, then a "More" tab (44 px tall, the `Menu` widget) with
      `more`'s labels. The tab label is never truncated (spec §11, "Characte…").
- [x] **Step 4: Widen the iPad rail.** At 1180 px the rail is the shell's `--shell-rail` column (56 px), which is what
      cuts "Characters". Measure the widest label at the rail's type ("Characters", "Schematic") in Chromium and set
      `--shell-rail` to fit it with the tab's padding; record the measured width and the value in the log.
- [x] **Step 5: Write and run the layout test** at 390 × 844 and 1180 × 820 with nine editors: no tab is outside the
      bar, every tab is at least 44 px tall, no rail label is cut (`scrollWidth <= clientWidth` on each `.label`), More
      opens a menu naming the rest, choosing Schematic from it opens Schematic and shows its tab. Run
      `pnpm --filter @automata/editor exec vitest run --project layout tests/browser/layout/suite/shell/rail-phone.test.ts`,
      then the whole `tests/browser/layout/suite` folder (the canvas column is narrower at 1180). Expected: PASS.
- [x] **Step 6: The journeys find editors under More.** `railHas(page, name)` finds the rail's tab or, when More holds
      it, More's item; `openFromRail(page, name)` presses the tab, or opens More and picks the item. Every journey that
      chooses an editor uses `openFromRail`. Run `complete-game-2d` and `complete-game-3d` with `--project editor-phone-chromium`.
      Expected: PASS (the `test.fail` journeys still fail for their reasons).
- [x] **Step 7: Commit** `feat(suite): the rail folds what does not fit under More`.

## Phase 2: a list that grows itself

### Task 5: Each editor's rows, and `ensureListed`

**Files:**

- Create: `packages/editor/src/shared/editor-list/editor-rows.ts`
- Modify: `packages/editor/src/entries/editor-list.ts` (export it)
- Test: `packages/editor/tests/unit/shared/editor-list/editor-rows.test.ts`

**Interfaces:**

- Produces: `editorRows(id: string): string | undefined` (the TOML rows, each with a one-sentence comment);
  `listGrowsBy(before: string, after: string): boolean` (true only when `after` loads, every table of `before` is in
  `after` unchanged and in order (`format`, each `[[file]]`, `[[check]]`, `[[gate]]`, `never`, `generated`), and every
  row `after` adds is exactly a row of `editorRows(id)` for some id: same `glob`, `editor`, `modes`, `gates`, `checks`
  and nothing else); `async ensureListed(workspace: Pick<SuiteWorkspace, 'read' | 'write'>, id: string): Promise<WriteResult | { ok: true; unchanged: true }>`.
  The list is never written by an editor so that the editors cannot widen their own access or add a check's command
  (`workspace-policy.ts:10-13`); `listGrowsBy` is the one exception, and the server (Task 6) and the page (Task 7) both
  use it.
  Rows (globs exactly): `tuner`: `content/controls.toml`, `content/tuning.toml`; `feel`: `content/feel/*.toml`;
  `audio`: `content/audio/*.toml`, `assets/music/*`; `writer`: `content/lines/*.toml`, `content/dialogue/*.toml`;
  `sequence`: `content/cutscenes/*.toml`; `schematic`: `content/systems/*.toml`, `content/nav/*.toml`,
  `content/puzzles/*.toml`. Every row `modes = ["edit"]`, `gates = []`; `checks = ["content"]` for tuner and
  schematic, `[]` for the rest (as the templates have them today).

- [x] **Step 1: Write the failing tests**: each id's rows load with `loadEditorList` once appended to a minimal list;
      `ensureListed` on a list lacking Feel appends exactly Feel's rows and writes once; on a list that has every Feel
      glob it writes nothing and returns `unchanged`; a list that names one of Audio's two globs gets only the other;
      an unknown id writes nothing; a game with no list gets none (nothing written, `unchanged`). `listGrowsBy`: Feel's
      rows appended → true; a row removed, edited or moved → false; an appended row with any other glob (`src/**`,
      `vite.config.ts`) or field → false; an appended `[[check]]`, `[[gate]]`, `never` or `generated` → false; text that
      does not load → false.
- [x] **Step 2: Run.** Expected: FAIL.
- [x] **Step 3: Implement.** Compare by `glob` and `editor` from `loadEditorList`; append text with one blank line
      before it; write with `expected: { mtime }` from the read. With no list, write nothing: the editors never start a
      list (such a game opens on the 2D page, which has no content editor).
- [x] **Step 4: Run.** Expected: PASS.
- [x] **Step 5: Commit** `feat(editor-list): each editor's rows, added when missing`.

### Task 6: The server lets the list grow and reads it again

**Files:**

- Modify: `packages/tools/src/features/editor/editor-policy.ts`, `packages/tools/src/features/editor/serve-editor.ts:86-120`,
  `:263-266`, `packages/tools/src/features/editor/checkout.ts:40-46` (the file list reads the same live policy)
- Test: `packages/tools/tests/unit/editor/editor-policy.test.ts`, `packages/tools/tests/unit/editor/serve-editor.test.ts`

**Interfaces:**

- Consumes: Task 5's `listGrowsBy` (from `@automata/editor/editor-list`, which the server already imports).
- Produces: `livePolicy(root: string, read: (path) => Promise<{ text: string; mtime: number } | undefined>): () => Promise<EditorPolicy>`
  (rebuilds when the list's mtime changes); `openCheckout(root, policy: () => Promise<EditorPolicy>)`.

- [x] **Step 1: Write the failing tests.** `serve-editor.test.ts`: a PUT of the list that only appends Feel's rows is
      written; a PUT that removes a row, or appends a row for `vite.config.ts`, or a `[[check]]`, is refused 403 with "The
      editors can only add to this game's list of editors."; after a list write (or a hand edit on disk), a PUT to a newly
      listed file succeeds without restarting and `/api/list` follows the new list; after a hand edit that removes a row,
      a PUT to that file is refused (Review Focus 3).
- [x] **Step 2: Run** `pnpm --filter @automata/tools exec vitest run tests/unit/editor`. Expected: FAIL.
- [x] **Step 3: Implement.** The file route and the checkout ask `await policy()` per request; a write to
      `content/editors.toml` is allowed when `listGrowsBy(current, body)`, regardless of `canWrite`, and never when there
      is no list. An explicit `options.policy` (tests) stays fixed.
- [x] **Step 4: Run.** Expected: PASS.
- [x] **Step 5: Commit** `feat(editor): the editor server lets a game's list grow and reads it again`.

### Task 7: Starting a file adds the editor to the game

**Files:**

- Modify: `extensions/editors/src/shared/content-session.svelte.ts` (`start`); the editor id into every
  `ContentSession` (Feel's and Audio's sessions, and each one Writer and Sequence make:
  `writer-session.svelte.ts:141-142`, `sequence-session.svelte.ts:177`, `:200`); Schematic's first Add, which starts its
  file without a `ContentSession` (`schematic-session.svelte.ts:579`); `extensions/editors/src/features/schematic/schematic-facts.ts`
  (delete `LIST_ROWS` and the `listed` check), `SchematicStart.svelte`; the Tuner's create (`tuner-session.ts:299`);
  `packages/editor/src/features/suite/shell/suite-session.ts` (hand editors the suite's raw `ensureListed`);
  `packages/editor/src/features/suite/shell/open-suite-ports.ts:59-68`, `packages/editor/src/features/suite/memory/sample-ports.ts:21-31`
  and `memory-workspace.ts:52-56` (the page's live list, below)
- Create: `extensions/editors/tests/unit/shared/content-session.test.ts`
- Test: `extensions/editors/tests/unit/schematic/*`, `packages/editor/tests/unit/suite/shell/Suite-tuner.test.ts`,
  `packages/editor/tests/unit/suite/shell/open-suite-ports.test.ts`

**Interfaces:**

- Consumes: Task 5's `ensureListed` and `listGrowsBy`.
- Produces: `SuitePorts.list?: { ensure(id: string): Promise<WriteResult | { ok: true; unchanged: true }> }`, filled by
  the suite from its raw ports (so the rows are not an undo step, spec §5); `ContentSession.start()` and Schematic's
  first Add call `ports.list?.ensure(editorId)` first and stop with its message on refusal.
- **The page's live list.** Today the page's ports class every path by the list read once when the page opened, and
  refuse a write that list calls read only; the list itself is `ALWAYS_NEVER`. So `ensureListed` through them is refused
  ("content/editors.toml is read only: never written by an editor") and the file Start writes next would be refused as
  unlisted (both seen on #508; plan audit PA1). `openSuitePorts` and `samplePorts` keep the loaded list in one place that
  `classify` reads; `createMemoryWorkspace` lets a write of `content/editors.toml` through when
  `listGrowsBy(current, text)` holds (and refuses it otherwise with spec §5's words) and, after it, replaces the loaded
  list, so the next write and `files()` are classed by the new list.

- [x] **Step 1: Write the failing tests.** `open-suite-ports.test.ts` (and the sample's): `ensureListed(ports.workspace,
      'feel')` writes the list; then `content/feel/feel.toml` is written through the same ports and `files('feel')` lists
      it; a list write that adds a `src/**` row is refused. A Feel session on a game whose list lacks Feel: `start()`
      writes the list once, then the file; Undo afterwards removes the file and leaves the list as written. Schematic's
      first Add on a list without Schematic adds its rows, then the file; its start page no longer shows TOML or "How to
      add it". The Tuner's Make one on a 2D game with no settings file writes `content/tuning.toml` (no refusal). A
      refused write of an unlisted file, on a start page, reads "This game's list of editors doesn't include Feel yet.
      Press Start to add it."; on an open file (the row removed by hand) "Feel can't save: this game's list of editors
      leaves Feel out." (map the write path's `policy` refusal for an unlisted path to these words, by editor label).
- [x] **Step 2: Run** `pnpm --filter @automata/editors exec vitest run tests/unit/shared tests/unit/schematic`,
      `pnpm --filter @automata/editor exec vitest run tests/unit/suite/shell/open-suite-ports.test.ts` and the Tuner test.
      Expected: FAIL.
- [x] **Step 3: Implement** as in Interfaces.
- [x] **Step 4: Run.** Expected: PASS.
- [x] **Step 5: Commit** `feat(editors): starting a file adds its editor to the game's list`.

## Phase 3: players, events and characters

### Task 8: An editor says when the game cannot play what it makes

**Files:**

- Create: `extensions/editors/src/shared/game-player.ts`, `extensions/editors/src/shared/ui/NoPlayer.svelte`
- Modify: each content editor's start page and status region (Feel, Audio, Writer, Sequence, Schematic);
  `schematic-facts.ts` (use `gameHasPlayer`)
- Test: `extensions/editors/tests/unit/shared/game-player.test.ts`, one DOM test per editor's start page

**Interfaces:**

- Produces: `PLAYERS: Readonly<Record<'feel' | 'audio' | 'writer' | 'sequence' | 'schematic', { pkg: string; first: string }>>`
  (spec §6's table: `first` is the editor's own first sentence, e.g. Audio's "Your game can't play sounds or music
  yet."); `gameHasPlayer(workspace: Pick<SuiteWorkspace, 'read'>, editor: keyof typeof PLAYERS): Promise<boolean>`;
  `noPlayerWords(editor): readonly [string, string]` returning exactly
  `[PLAYERS[editor].first, "Its code doesn't have the part that plays them. You can still make them here, and they'll show once it does."]`.

- [x] **Step 1: Write the failing tests**: the package under `dependencies`, `devDependencies` or `peerDependencies`
      → true; absent → false; no `package.json` or invalid JSON → true (Review Focus 4); each editor's start page without
      its player shows both sentences and still shows Start; with it, neither.
- [x] **Step 2: Run.** Expected: FAIL.
- [x] **Step 3: Implement.** Each session checks once on open and keeps the answer.
- [x] **Step 4: Run.** Expected: PASS.
- [x] **Step 5: Commit** `feat(editors): each editor says when the game cannot play what it makes`.

### Task 9: The content plugin writes the game's events

**Files:**

- Create: `packages/content/src/features/vite/event-ids.ts`
- Modify: `packages/content/src/features/vite/automata-content.ts`, `packages/editor/src/features/suite/shell/open-suite-ports.ts:62-68`
- Test: `packages/content/tests/unit/vite/event-ids.test.ts`, `packages/content/tests/unit/vite/automata-content.test.ts`,
  `packages/editor/tests/unit/suite/shell/open-suite-ports.test.ts`

**Interfaces:**

- Produces: `eventIds(sources: readonly { path: string; text: string }[]): string[]` (sorted, unique; ids from
  `defineEvent('<id>'` or `defineEvent("<id>"` in files ending `.event.ts`); the plugin writes
  `content/generated/events.json` as a JSON array of the ids (`["square.bumped"]`: `gameEvents` reads an array of ids
  or `{ id }` rows and nothing else, `game-events.ts:87-99`) on build start and on a change to an `.event.ts` file.
- Also: the served page reads it. `workspace.generated()` answers only paths the ports call generated, and
  `openSuitePorts` names none today (`open-suite-ports.ts:62-68`), so a served page never reads `content/generated/`
  (seen on #508; plan audit PA5). `openSuitePorts` passes `generated: (path) => path.startsWith('content/generated/')`.

- [x] **Step 1: Write the failing tests**: two event files give both ids sorted; a non-literal id is skipped; a file not
      ending `.event.ts` is ignored; the plugin, run on a fixture game, writes `["<id>", …]` (a JSON array of strings).
      In `packages/editor/tests/unit/suite/shell/open-suite-ports.test.ts`: served ports over a store holding
      `content/generated/events.json` give its text from `workspace.generated(...)`.
- [x] **Step 2: Run** `pnpm --filter @automata/content exec vitest run tests/unit/vite` and the editor's test. Expected:
      FAIL.
- [x] **Step 3: Implement.** Read files with the plugin's existing file helpers under `src/`, skipping
      `node_modules`.
- [x] **Step 4: Run** both, then the Tuner's journeys (`tuner-shows-the-game`, `tuner-after-levels`,
      `complete-game-2d`, `complete-game-3d` at iPad size): the served Tuner now reads `tuning-meta.json` too. Expected:
      PASS.
- [x] **Step 5: Commit** `feat(content): the content build lists the game's events for Feel and Audio`.

### Task 10: `StageCharacters` in core; Feel uses it

**Files:**

- Create: `packages/automata/src/features/render/stage-characters.ts`
- Modify: `packages/automata/src/features/render/renderer.ts` (`PixiStage.characters`, `PixiStage.useCharacters`),
  the framework's public entry (export the type), `extensions/feel/src/app/feel-stage.ts:107-160`
- Test: `packages/automata/tests/unit/render/stage-characters.test.ts`, `extensions/feel/tests/unit/app/feel-stage.test.ts`

**Interfaces:**

- Produces:

```ts
export interface StageCharacters {
  /** Where a word above a character sits, in `stage.ui`'s coordinates, or undefined when it has no view. */
  point(ref: number): { readonly x: number; readonly y: number } | undefined;
  /** Scales a character's view by x and y from the scale it rests at. */
  squash(ref: number, x: number, y: number): void;
  /** Puts a squashed character's scale back. */
  rest(ref: number): void;
  /** Holds these characters' poses until the next call. */
  hold(refs: ReadonlySet<number>): void;
}
```

`characters2d(consumer: RenderDeltaConsumer, ui: Container): StageCharacters`; `PixiStage.characters: StageCharacters`
(read each frame) and `PixiStage.useCharacters(characters: StageCharacters): void`. In 2D `point` is the view's own
position in `ui` (what Feel uses today, `feel-stage.ts:107-112`); Feel keeps its `WORD_ABOVE_PX` above it, in both kinds.

- [x] **Step 1: Write the failing tests.** `characters2d` over a consumer with one view: `point` is the view's global
      position in `ui`; `squash(ref, 1.2, 0.8)` then `rest(ref)` restores the original scale exactly; `hold` reaches the
      consumer. `feel-stage.test.ts`: with a stub `stage.characters`, a squash frame calls `squash`, the frame after calls
      `rest`, a freeze calls `hold`, a word is placed at `point(ref)` minus the existing offset; no read of
      `stage.consumer` remains (assert with a stage whose `consumer` getter throws).
- [x] **Step 2: Run** both files. Expected: FAIL.
- [x] **Step 3: Implement.** Move `feel-stage.ts`'s `squashed` map into `characters2d`. The 2D renderer sets
      `characters` to `characters2d(consumer, ui)` at creation.
- [x] **Step 4: Run** both, then `pnpm --filter @automata/feel test` and the 2D journeys'
      `complete-game-2d` (Feel's flash still shows). Expected: PASS.
- [x] **Step 5: Changeset** `patch` for `@automata/framework` and `@automata/feel`; then the API report steps from Global Constraints.
- [x] **Step 6: Commit** `feat(render): a stage port for characters, which Feel uses`.

### Task 11: The 3D renderer hands Feel its characters

**Files:**

- Create: `packages/3d/src/app/characters-3d.ts`
- Modify: `packages/3d/src/app/create-renderer.ts:149-200` (call `stage.useCharacters` in `mount`)
- Test: `packages/3d/tests/unit/renderer/characters-3d.test.ts`

**Interfaces:**

- Consumes: Task 10's `StageCharacters`, `PixiStage.useCharacters`.
- Produces: `characters3d(consumer: RenderDeltaConsumer<Container3D>, view: Pick<View3D, 'worldToScreen'>, ui: Container, height?: number): StageCharacters`
  (`height` defaults to the existing `PLAYER_HEIGHT`). `point` is `ui.toLocal(view.worldToScreen(head))`, where `head`
  is the view's world position raised by `height`; Pixi 3D's `View3D.worldToScreen` returns pixi global coordinates, or
  `null` behind the camera, which gives `undefined` (`vendor/pixi-3d` beta 2, `dist/scene/View3D.d.ts:970-1000`).
  There is no `view.camera.worldToScreen`.

- [x] **Step 1: Write the failing test** (a stub `worldToScreen`, no renderer): `point` asks `worldToScreen` for the
      character's position raised by `height` and returns it in `ui`'s coordinates; a `null` gives `undefined`; `squash`
      scales the `Container3D` on x and y from rest and `rest` restores it; `hold` reaches the 3D consumer.
- [x] **Step 2: Run** `pnpm --filter @automata/3d exec vitest run tests/unit/renderer/characters-3d.test.ts`. Expected: FAIL.
- [x] **Step 3: Implement**, and call `stage.useCharacters(characters3d(consumer, view, stage.ui))` in `mount`
      (`mount` runs before the game's `setup`, `create-renderer.ts:250-258`, and Feel reads `stage.characters` each frame
      anyway).
- [x] **Step 4: Run** the file and `pnpm --filter @automata/3d test`. Expected: PASS; no golden moves (none draws Feel).
- [x] **Step 5: Commit** `feat(3d): Feel squashes, freezes and labels 3D characters`.

## Phase 4: the 2D template plays every editor

### Task 12: The 2D square's speed is a setting

**Files:**

- Create: `packages/tools/src/shared/create-game/template-content/tuning.toml`
- Modify: `template-game.ts` (`SPEED` leaves `src/shared/constants.ts`; the sim's content becomes `{ level, tuning }`
  and the move system reads both from it), `template-level.ts` (`levelIn` reads `content.level`),
  `template-content/editors.toml` (Tuner rows from `editorRows('tuner')`)
- Test: `packages/tools/tests/unit/shared/create-game/template-content.test.ts`, `template.test.ts`

- [x] **Step 1: Write the failing tests**: a new 2D game has `content/tuning.toml` holding exactly
      `SPEED = { value = 2, min = 1, max = 4, step = 1, label = "Speed", feel = "How far the square moves each step.", unit = "pixels a step" }`
      (with a comment above it in the 3D file's style), which the compiler's tuning shape loads; its list contains the
      Tuner's rows of `editorRows('tuner')`; its `game.ts` passes `{ level, tuning }` as the sim's content.
- [x] **Step 2: Run** `pnpm --filter @automata/tools exec vitest run tests/unit/shared/create-game`. Expected: FAIL.
- [x] **Step 3: Implement.** The 2D sim's content today is the level itself (`levelIn(ctx.content)`,
      `template-game.ts:56`, `content: { ...defaultContent(), sim: LEVEL }`); make it `{ level, tuning }` as the 3D
      template's `PlayContent` is `{ room, tuning }` (`template-3d-game.ts:70-72`, its `read-room.ts` and
      `shared/tuning.ts`). Steps stay whole pixels.
- [x] **Step 4: Run** the unit tests, then typecheck and test a new game: make one with the journeys' `newGame`
      (`packages/editor/tests/e2e/harness/new-game.ts`) and run `node_modules/.bin/tsc -p .` and
      `node_modules/.bin/vitest run` in it. `create-game.integration.test.ts` does not: it checks `ruken.toml` and the
      itch zip only. Expected: PASS; record both commands in the log.
- [x] **Step 5: Commit** `feat(create-game): a new 2D game's speed is a setting the Tuner edits`.

### Task 13: The 2D template has a keeper, a cutscene and a guard

**Files:**

- Create: `packages/tools/src/shared/create-game/template-story.ts` (the story feature's files for 2D),
  `packages/tools/src/shared/create-game/story-gate.ts`, template content `lines/keeper.toml`, `dialogue/keeper.toml`,
  `cutscenes/look.toml`, `systems/guard.toml`, `nav/guard.toml`, `words/en.json` if narrative needs it (copy the shape
  from `examples/2d-story/content/`)
- Modify: `template-game.ts` (`game.ts`: extensions, sim plugins, cutscene stage, camera), `template-level.ts` (the
  level gets a `keeper` and a `guard`, named), `template-project.ts` (dependencies: `@automata/narrative`,
  `@automata/cutscenes`, `@automata/systems`, `@automata/nav`, `@automata/puzzle`, `@automata/places`,
  `@automata/level-2d`), `template-content/editors.toml`, `create-game.ts` (asks the gate)
- Modify: `packages/editor/tests/e2e/journeys/complete-game-2d.test.ts` (the three marked journeys)
- Test: `template.test.ts`, `packages/tools/tests/unit/shared/create-game/story-gate.test.ts`

**Interfaces:**

- Consumes: `examples/2d-story/src/features/story/*` and `src/app/story-sim.ts`, `story-camera.ts` (port, trimmed: one
  keeper, one conversation, one cutscene, one guard), `level2dPlaces` (`@automata/level-2d/sim`), `cutsceneStage2d`.
- Produces: `STORY_FILES: readonly TemplateFile[]`; the conversation's last choice is "Show me", which plays `look`;
  `storyAvailable(env?, from?): boolean` in the shape of `threeDAvailable` (`three-d-gate.ts`): true in this
  repository's workspace (the narrative package is found walking up from `from`) or when `AF_BETA_STORY` is exactly
  `"1"`.
- **Why the gate.** Six of the story's packages are private (`narrative`, `cutscenes`, `systems`, `nav`, `places`,
  `level-2d`; only `puzzle` is published). Outside this workspace the template asks `^<tools version>` of each
  (`template-file.ts:29`), so a game made with the published tools could not install, and the stranger's journey
  (`tooling/consumer-smoke/tests/e2e/stranger.test.ts:88-115`) would fail. Without the gate `create-game` writes
  today's 2D game plus Task 12's settings file, its list naming what that game plays (Feel, Audio, Schematic as today,
  and the Tuner). The list is composed in `template-content.ts`: the static file, then Writer's and Sequence's rows when
  the gate is open. The journeys' `newGame` runs the repository's own `automata`, so the gate is open there.

- [x] **Step 1: Write the failing journeys.** Replace the three `test.fail` blocks in `complete-game-2d.test.ts` with:
      (a) in Writer, change the keeper's first line to `Hello from Writer.`; Play; walk to the keeper; expect
      `game.getByText('Hello from Writer.')` visible. (b) In Sequence, change `look`'s caption to `The keeper waves.`;
      Play; walk to the keeper; choose "Show me"; expect the caption visible. (c) In Schematic, set the guard's walking
      speed to its most; Play; after 3 s of game time the guard's position (read from the canvas by his colour,
      `boxOf`) is further along than in a run at the starting speed (record both).
- [x] **Step 2: Run** `pnpm --filter @automata/editor exec playwright test -c playwright.journeys.config.ts complete-game-2d --project editor-ipad-chromium`.
      Expected: the three new journeys FAIL (no keeper).
- [x] **Step 3: Write the failing unit tests** in `template.test.ts`: with the story (the gate open), a new 2D game has
      every content file above, its `package.json` has every player of `PLAYERS`, its list every `editorRows` row of
      the five content editors and the Tuner, and its level names `keeper` and `guard`; with the gate shut, it has none
      of the story's files or packages and no `@automata/*` dependency that is private (read each workspace package's
      `private`). `story-gate.test.ts` in the shape of `three-d-gate.test.ts`. Run; expected FAIL.
- [x] **Step 4: Implement.** Keep every template file under 600 lines; the story code is `src/features/story/` in the
      new game, with a comment at its top saying what is code (walking up starts the talk; "Show me" plays the cutscene)
      and what is content (the words, the scene, the guard's route).
- [x] **Step 5: Run** the unit tests; typecheck and test a new game as in Task 12 step 4 (`tsc -p .`, `vitest run`,
      the only gate that reads the story's code); then the journeys at iPad and phone sizes. Expected: PASS.
- [x] **Step 6: Commit** `feat(create-game): a new 2D game plays what Writer, Sequence and Schematic make`.

## Phase 5: 3D

### Task 14: Cutscenes in a 3D game

**Files:**

- Create: `extensions/cutscenes/src/features/stage-3d/cutscene-stage-3d.ts`, `extensions/cutscenes/src/entries/stage-3d.ts`,
  `extensions/sectors/src/shared/sim/sector-anchors.ts`
- Modify: `extensions/cutscenes/package.json` (`"./stage-3d"` export), `extensions/sectors/src/entries/sim.ts`,
  `examples/3d/cutscenes/cutscenes-door-and-lamp.ts` (use the entry)
- Test: `extensions/cutscenes/tests/unit/stage-3d/cutscene-stage-3d.test.ts`, `extensions/sectors/tests/unit/shared/sector-anchors.test.ts`

**Interfaces:**

- Produces: `showScene3d(target: { camera: { set(shot: CameraFrame): void }; pieces?: (scene: SceneState) => void; lamps?: (levels: SceneState['lamps']) => void }): (scene: SceneState) => void`
  (writes one director state: the camera as the director gives it, `{ pos, look, fov }`, then doors and lamps);
  `cutsceneStage3d(options: { scripts: Readonly<Record<string, PlacedScript>>; show: (scene: SceneState) => void; tickHz?: number }): PixiStageHooks`;
  `sectorAnchors(level: AfSector2): (name: string) => { x: number; z: number } | undefined` (`actor:<cast id>`).
  `CameraFrame` and `SceneState` are the director's (`@automata/cutscenes/director`).
- **How it knows a scene plays.** The 2D stage reads `CutsceneState` through `LevelSceneHooks.draw(sim, …)`
  (`cutscene-stage-2d.ts:99-101`); a renderer hook gets only `StepResult` (tick, events, render; `packages/sim/src/shared/world/sim.ts:69-76`).
  So `cutsceneStage3d` follows the sim's own events in `apply(result)`: `cutscene.started` (`{ id, start, end }`,
  `cutscene.event.ts:11-14`) makes a director for `scripts[id]`, `cutscene.ended` drops it, and each step it calls
  `show(director.stateAt((result.tick - start) / tickHz))`. `reset` drops it. The caption needs nothing: it is the
  cutscenes extension's own `hud.overlay` slot in either kind.
- **Who wins the camera.** The game returns the stage from `createPixi3dRenderer`'s `scene` hook. Its hooks run after
  the follow camera's (`packages/3d/src/app/create-renderer.ts:250-258`), so the scene's camera wins while it plays and
  the follow camera takes the camera back after `cutscene.ended`.

- [x] **Step 1: Write the failing tests**: `cutsceneStage3d` given a step whose events hold `cutscene.started` for a
      script with a camera key calls `show` with the director's state at that tick (its `camera` is `{ pos, look, fov }`);
      later steps advance it by `tickHz`; after `cutscene.ended`, or with no scene started, `show` is not called;
      `showScene3d` writes the camera frame, calls `pieces` with the scene and `lamps` with its lamps. `sectorAnchors`
      answers a cast place's position and `undefined` for an unknown name.
- [x] **Step 2: Run** both. Expected: FAIL.
- [x] **Step 3: Implement** `showScene3d` by lifting the example's view code (`cutscenes-door-and-lamp.ts:86-96`). The
      example keeps its own clock (its sim has no cutscene) and calls `showScene3d` instead of its copy.
- [x] **Step 4: Run** both files, `pnpm --filter @automata/cutscenes test`, `pnpm --filter @automata/sectors test`, and typecheck the example (`pnpm typecheck`). Expected: PASS.
- [x] **Step 5: Commit** `feat(cutscenes): a 3D stage for cutscenes`.

### Task 15: Sequence reads a 3D level

**Files:**

- Modify: `extensions/editors/src/features/sequence/sequence-names.ts:80-110`, `plan-view.ts:31-60` (delete
  `NO_WALLS_WORDS`), `key-fields.ts` (lamps, doors, props as name pickers)
- Test: `extensions/editors/tests/unit/sequence/plan-view.test.ts`, `sequence-editor.test.ts`

**Interfaces:**

- Produces: `wallsOfSectors(level: AfSector2): Segment[]` (one segment per consecutive corner pair of each sector, in
  metres); `sequence-names` gathers from `content/levels/*.af-sector.json` people (cast ids), lamps, doors and props by
  id, parsed with `@automata/3d/level`'s `readLevel`.

- [x] **Step 1: Write the failing tests**: a two-sector fixture gives its eight walls; its cast, lamps, doors and props
      are offered by name; the preview of a 3D game no longer shows "Walls show for 2D levels only, for now."; a lamp key
      offers the level's lamps in a picker instead of an id box.
- [x] **Step 2: Run** `pnpm --filter @automata/editors exec vitest run tests/unit/sequence`. Expected: FAIL.
- [x] **Step 3: Implement.**
- [x] **Step 4: Run.** Expected: PASS.
- [x] **Step 5: Commit** `feat(sequence): Sequence reads a 3D level's rooms, people, lamps, doors and props`.

### Task 16: Feel and Audio in a new 3D game

**Files:**

- Create: `packages/tools/src/shared/create-game/template-feel-audio.ts` (the one source both templates use for
  `src/app/feel-audio.ts`, taking the game's size), 3D template content `feel/feel.toml` (a flash on `wick.bumped`) and
  `audio/audio.toml` (a bump sound)
- Modify: `template-game.ts` (use `template-feel-audio.ts`), `template-3d-game.ts` (`renderer.setup`, `audio`, the
  Feel and Audio content kinds in `vite.config.ts`), `template-3d-wick.ts` (a `wick.bumped` event file; the move system
  emits it once when a move is blocked, in the shape of the 2D `square.bumped`), `template-3d-content/editors.toml`
  (Feel's and Audio's rows from `editorRows`), the 3D `package.json` template (`@automata/feel`, `@automata/audio-synth`)
- Modify: `packages/editor/tests/e2e/journeys/complete-game-3d.test.ts` (the Feel and Audio marked journeys)
- Test: `template-3d.test.ts`, `template.test.ts`

**Interfaces:**

- Consumes: Task 9 (the events list the page reads), Task 11 (`characters3d`).
- Produces: `FEEL_AUDIO_FILE(size): TemplateFile`; the event id `wick.bumped`.

- [x] **Step 1: Write the failing journeys**, replacing the Feel and Audio `test.fail` rail blocks with make-and-play
      ones: Feel (a flash on "Wick bumped", picked from "What happens in the game?" by its words, which proves Task 9 in
      play; Play; walk into a wall; `brightestSince` jumps), Audio (the bump's pitch to 880; `pitchesPlayed` has 880).
- [x] **Step 2: Run** `pnpm --filter @automata/editor exec playwright test -c playwright.journeys.config.ts complete-game-3d --project editor-ipad-chromium`.
      Expected: the two FAIL.
- [x] **Step 3: Write the failing unit tests**: the 3D template has both content files, Feel's and Audio's rows in its
      list, both players in its `package.json`, a `wick.bumped` event file; the 2D template's `feel-audio.ts` is
      byte-for-byte what it was, except where it names the size. Run; expected FAIL.
- [x] **Step 4: Implement.** The audit's step 8 wired the 2D file into a 3D game unchanged; keep it so.
- [x] **Step 5: Run** the unit tests; typecheck and test a new 3D game as in Task 12 step 4 (`newGame(BASE_3D, '3d')`);
      then the journeys at iPad and phone sizes. Expected: PASS.
- [x] **Step 6: Commit** `feat(create-game): a new 3D game plays what Feel and Audio make`.

### Task 17: The 3D story: a keeper, a cutscene and a guard

**Files:**

- Create: `packages/tools/src/shared/create-game/template-3d-story.ts`, 3D template content `lines/keeper.toml`,
  `dialogue/keeper.toml`, `cutscenes/look.toml`, `systems/guard.toml`, `nav/guard.toml`
- Modify: `template-3d-game.ts` (extensions, the story's sim plugin, `cutsceneStage3d` from the renderer's `scene`
  hook), `template-3d-room.ts` (the room's cast gains `keeper` and `guard`, figures from the base pair),
  `template-3d-content/editors.toml` (Writer's, Sequence's and Schematic's rows), the 3D `package.json` template
  (`@automata/narrative`, `-cutscenes`, `-systems`, `-nav`, `-puzzle`, `-places`, `-sectors`)
- Modify: `packages/editor/tests/e2e/journeys/complete-game-3d.test.ts` (the Writer, Sequence and Schematic marked
  journeys)
- Test: `template-3d.test.ts`

**Interfaces:**

- Consumes: Task 13's `template-story.ts` (the keeper, the conversation and `look`, with `sectorsPlaces` in place of
  `level2dPlaces` and Task 14's `sectorAnchors` in place of `levelAnchors`); `examples/3d-story`'s guard
  (`src/features/guard/*`, `src/app/story.ts`); Task 14's `cutsceneStage3d` and `showScene3d` (over the template's
  `View3D` camera).
- Produces: `STORY_3D_FILES: readonly TemplateFile[]`.
- No game has shown a conversation or a cutscene in 3D yet. The dialogue box and the caption need nothing new: both are
  `hud.overlay` slots, whatever the game's kind (`extensions/narrative/src/app/narrative.extension.ts:40-41`, the
  cutscenes extension's `caption-slot.ts`). A 3D game is made only where `@automata/3d` is (`three-d-gate.ts`), which
  holds the story's packages too, so no second gate.

- [x] **Step 1: Write the failing journeys**, replacing the Writer, Sequence and Schematic `test.fail` rail blocks with
      Task 13's (a), (b), (c) on the 3D game. The Levels 3D floor and the Publish marks stay.
- [x] **Step 2: Run** the `complete-game-3d` command of Task 16 step 2. Expected: the three FAIL.
- [x] **Step 3: Write the failing unit tests**: the 3D template has every story content file, every `editorRows` row of
      the five content editors and the Tuner in its list, every player of `PLAYERS` in its `package.json`, and the room's
      cast names `keeper` and `guard`. Run; expected FAIL.
- [x] **Step 4: Implement.** Every template file stays under 600 lines.
- [x] **Step 5: Run** the unit tests; typecheck and test a new 3D game as in Task 16 step 5; then the journeys at iPad
      and phone sizes. Expected: PASS.
- [x] **Step 6: Commit** `feat(create-game): a new 3D game plays what Writer, Sequence and Schematic make`.

## Phase 6: words, comments and the record

### Task 18: The words and the comments

**Files:**

- Modify: `extensions/editors/src/shared/ui/EventPicker.svelte:55` ("Something else" becomes "Another event (its name
  in the code)"; Feel and Audio share the picker); `packages/editor/src/features/suite/tuner/ui/ControlsSection.svelte:51`
  (today it shows nothing when `read` is `undefined`; it says "This game's controls are in its code."); every comment
  listed in the spec's §12
- Test: `extensions/editors/tests/unit/feel/feel-editor.test.ts` (the picker's words),
  `packages/editor/tests/unit/suite/shell/Suite-tuner.test.ts` (the controls sentence, on ports with no
  `content/controls.toml`), a DOM scan in `Suite.test.ts` that no page text contains `content/`, `.toml`, `@automata/`
  or `editors.toml`

- [x] **Step 1: Write the failing tests** (the picker's words; the controls sentence; the scan over Home, each start
      page and each refusal).
- [x] **Step 2: Run.** Expected: FAIL on the picker and the controls sentence.
- [x] **Step 3: Implement**; rewrite the §12 comments to say what the code does now.
- [x] **Step 4: Run** `pnpm check`. Expected: PASS.
- [x] **Step 5: Commit** `fix(editors): words a person can act on, and comments that match the code`.

### Task 19: Gates and the record

- [ ] **Step 1:** `pnpm format`, `pnpm check`, `pnpm test:unit:2d`, `pnpm test:browser:2d`,
      `pnpm --filter @automata/tools exec vitest run tests/unit/shared/create-game/create-game.integration.test.ts`, and both
      complete-game journeys at iPad and phone sizes in Chromium. Record each command and its result in the log below.
      The stranger's 2D journey runs as it does today (the gate keeps the published 2D game unchanged); record
      `stranger-3d.test.ts` as pending: it packs only `@automata/3d` beside the published packs and would need the story
      packages too, which is the apps work's call.
- [x] **Step 2:** Make a small game by hand in each kind, end to end (the Owner's audit rule): `automata create-game`,
      `automata editor`, change one thing in every editor, Play, and see each. Screens to
      `/mnt/project-files/refactor/2026-11-08-shared-editors-build-screens/`.
- [x] **Step 3:** Update `docs/refactor/progress.md` (shared editors: stage 4) and this plan's log. Leave WebKit,
      Firefox and the GPU runner's suites unchecked and say they are pending.
- [x] **Step 4: Commit** `docs(refactor): shared editors build record`.

## Log

(The build writes each task's outcome here: commit, commands run and their results, and anything left unchecked.)

### Build record, 2026-11-08 (branch `claude/project-thread-fxu792`, base `89db7336` = #508's head; 17 commits, 191 files)

Tasks 1 to 18 are done, one commit or more each (`git log 89db7336..HEAD`). Their checks, as run during the build: the
suite, editor-3d and editor-kit unit tests, the editor-rows and rail-fit layout tests (Chromium, mouse and touch),
`packages/tools` unit (create-game 114 pass), the made 2D and 3D games' own tests (3D: 22 pass) with `tsc -p .` clean, and
the complete-game journeys. Task 19's gates, with their results:

| Command | Result |
|---|---|
| `pnpm format` | clean |
| `pnpm check` (lint, typecheck, boundaries, style, knip, `test:unit` which includes `test:unit:2d`, changeset status) | every task green **except `check-changesets`**: `.changeset/stage-characters-3d.md` (commit `9a7127af`, not this build's) names the unpublished `@automata/3d`. Left for its owner; not edited here |
| `pnpm test:unit:2d` on its own | not run on its own; `pnpm check` runs the whole unit set, 2D included |
| `pnpm test:browser:2d` | **did not run to the end here**: the editor's `parity` and `layout` projects launch WebKit and Firefox, which are not installed in this container (`/opt/pw-browsers/webkit-2359`, `firefox-1543` missing), and `@automata/ui-screens` failed the same way. Pending on the Owner's Mac or the GPU runner |
| editor `layout`, `storage` and `canvas` projects in Chromium only | not run: the same config lists the other engines for them |
| `pnpm --filter @automata/tools exec vitest run tests/unit/shared/create-game/create-game.integration.test.ts` | 2 of 2 pass |
| `complete-game-2d` and `complete-game-3d` journeys, `editor-ipad-chromium` and `editor-phone-chromium` | 22 pass; the 2 expected failures per size are `test.fail` journeys that name known gaps (Levels 3D's Change materials changes only walls; Publish refuses a 3D game while Pixi 3D is a closed beta) |
| Made by hand, 2D and 3D, at iPad and phone sizes | a game from `create-game`, edited in every editor, played; 44 screenshots in `/mnt/project-files/refactor/2026-11-08-shared-editors-build-screens/` |

Not run, left unchecked on purpose: WebKit, Firefox, the GPU runner's browser, visual and journey suites, hosted CI.
`stranger-3d.test.ts` stays pending: it packs only `@automata/3d` beside the published packs and would need the story
packages too, which is the apps work's call. Known and untouched: `tests/browser/layout/suite/tuner/ui/controls.test.ts`
fails at the base commit (its list fixture has the invalid modes `["edit","ask"]`).

Final review: self-review (no subagent tool), by the author. No file is over 600 lines, no stray debugging, every new
published-package change has a patch changeset.

Rulings (the cost, if wrong, is named in each):

- T2: the rail-only `test.fail` journeys began passing once every editor was on the rail, so they were replaced by
  `test.fail` journeys that look for what the game will play, until tasks 13, 16 and 17 made them real. Cost: wording.
- T4: the phone rail's More is a Menu in a wrapper around the tablist (a button is not a tab); a hidden ruler row measures
  natural widths. Home's `.scroll` got `data-scroll-region` (it was an undeclared scroll region). Cost: a restyle.
- T5/T6: `livePolicy(read)` takes no root (the plan also passed one; nothing needs it).
- T13: the 2D cutscene is `gate` with the last choice "Show me the gate." (the example's), not `look`; the content is a
  byte copy of `examples/2d-story/content` and a test keeps them equal. No `@automata/places` dependency (nothing imports
  it). The Sequence journey points the caption at "Safe travels." instead of typing a new line. The Schematic journey
  compares the time the guard takes to reach his west half at the maximum patrol speed (the game clock slows with frame
  rate on a phone, so only a ratio compares across sizes). `createGame` resolves `story` (default `storyAvailable()`);
  the plain-template unit tests pass `story: false`. The editors-page test harness got `gameUrl` and `servedWith`.
- T16: Feel and Audio in the 3D game use the same `src/app/feel-audio.ts` as 2D; the 3D size moved to
  `src/shared/screen.ts`. The 3D Feel/Audio journey is one test, not two.
- T17: the 3D story has no gate of its own (the 3D game exists only where `@automata/3d` does); the answer is "Show me
  around." and the line `keeper.tour`. Wick is held by a `Hold` resource in the wick feature, not a Hero marker; Sectors'
  `InSector` is added to Wick by the story's load system. Keeper and guard are drawn from their own figure files through
  one `personView`; every character Schematic adds is drawn as the guard until the game gives it a figure. The main and
  Feel/Audio journeys walk Wick sideways (KeyD) because straight ahead is now the keeper. Characters picks "wick" by exact
  name. Sequence's `servedWith` waits for `"line":"keeper.farewell"`. Schematic's 3D journey times the guard's crossing.
- T18: the page that says the editor list cannot be read still names `content/editors.toml` and the key path (it has to
  say which file to fix); `content-editors.ts` and `suite-entries.ts` already said what the code does, so they are unchanged.
