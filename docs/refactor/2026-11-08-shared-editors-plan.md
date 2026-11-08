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
[`2026-11-08-shared-editors-audit.md`](2026-11-08-shared-editors-audit.md).

**Base:** the build branches from PR #508 (`claude/complete-game-journeys`), or from the newest stack head that holds
it. Every path below was read there at `89db7336`.

## Global Constraints

- The framework's laws and `AGENTS.md` hold: test first, feature folders, tests in `tests/` importing `#src/…`,
  kebab-case files with role suffixes, at most 600 lines a file, comments say why and never name this plan.
- No page gains or loses an editor in this plan. What the web page, the published tools and the site carry is the
  apps work's (spec §2). Every rule here works on "the editors this page registers".
- Copy passes the drunk grandma test. The exact words are the spec's §6 and §11; a DOM test asserts each.
- Touch targets 44 px, primary actions 48 px. Never shrink a tab or hide an action to fit (spec §4).
- No file key, glob, package name or event id as page text, except Feel's "Another event (its name in the code)" box.
- Behaviour is code, content is files: the templates' story code starts conversations and cutscenes; the editors only
  edit files.
- Published packages touched get a `patch` changeset: of those here, `@automata/framework` (Task 10), `@automata/feel`
  (Task 10), `@automata/content` (Task 9) and `@automata/tools` (Tasks 6, 12, 13, 16). `@automata/editor`, `-editors`,
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
  `packages/editor-3d/src/features/studio/studio-suite-editor.ts`, the Levels 3D suite editor (`grep -rn "id: 'levels-3d'" packages/editor-3d/src`)
- Test: `packages/editor/tests/unit/suite/shell/suite-entries.test.ts`, `packages/editor/tests/unit/suite/shell/SuiteRail.test.ts`

**Interfaces:**

- Produces: `type EditorKind = '2d' | '3d'`; `SuiteEditor.kind?: EditorKind`; `gameKinds(listed: readonly string[] | undefined): ReadonlySet<EditorKind>`;
  `suiteEntries(editors: readonly Named[], listed?: readonly string[]): SuiteEntry[]` (same signature, new rule);
  `SuiteEntry.kind?: EditorKind`. `Named` gains `kind`.

- [ ] **Step 1: Write the failing tests** in `suite-entries.test.ts`:

```ts
const tuner = { id: "tuner", label: "Tuner" };
const l2 = { id: "levels-2d", label: "Levels", kind: "2d" as const };
const l3 = { id: "levels-3d", label: "Levels 3D", kind: "3d" as const };
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
```

(`Characters 2D` joins this list in Task 2.)

- [ ] **Step 2: Run** `pnpm --filter @automata/editor exec vitest run tests/unit/suite/shell/suite-entries.test.ts`.
      Expected: FAIL, unlisted `feel` missing from the first two.
- [ ] **Step 3: Implement.** `gameKinds`: `'2d'` if `listed` has `levels-2d`, `'3d'` if `levels-3d`; neither or
      `undefined` gives both. `suiteEntries` keeps an editor when it has no `kind` or its kind is in `gameKinds(listed)`.
      `editorLabel` appends " 2D"/" 3D" to any editor with a `kind` when the game has both kinds (replacing the
      `levels-…` special case; "Levels" stays the one-kind name for both level editors). Set `kind` on Levels 2D (`'2d'`),
      Levels 3D and the Studio (`'3d'`). Rewrite the comments at `suite-entries.ts:40` and `Suite.svelte:84` to the rule.
- [ ] **Step 4: Run** the test file and `SuiteRail.test.ts`. Expected: PASS. Fix any `Suite*.test.ts` that asserted the
      old filter by asserting the new rule instead.
- [ ] **Step 5: Commit** `feat(suite): the rail shows every editor of the game's kinds`.

### Task 2: A rail entry can open a view; Characters leaves Levels 2D's tabs

**Files:**

- Modify: `packages/editor/src/shared/kit/ports/suite-editor.ts`, `suite-entries.ts`, `Suite.svelte` (the `target`
  derivation at `:93` and the open effect at `:106`), `packages/editor/src/features/suite/shell/home-model.ts`,
  `packages/editor/src/app/suite/levels-2d/levels-2d-suite-editor.ts`, `Levels2dTools.svelte:21-27`,
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
  `'characters'`, so Tiles survives a trip away and back).

- [ ] **Step 1: Write the failing tests.** In `suite-entries.test.ts`: a 2D game's entries are
      `['tuner', 'levels-2d', 'characters-2d', 'feel']`, `characters-2d`'s `editors` is `['levels-2d']` and its `view`
      `'characters'`; with both kinds the labels include `'Characters 2D'` right after `'Levels 2D'`. In
      `Suite-levels.test.ts`: pressing the rail's "Characters" shows the Characters panel and Levels' tabs read
      `Level, Tiles` only; pressing "Levels" shows the level; a change made in Characters, then the top bar's Undo, puts
      the definition back and the Undo button's label named that step (Review Focus 2). In `home-model.test.ts`: a 2D
      list gives a "Characters" card after "Levels" with the level project's rows.
- [ ] **Step 2: Run** the three files. Expected: FAIL (no `characters-2d`).
- [ ] **Step 3: Implement.** `suiteEntries` expands an editor with `entries` into one `SuiteEntry` per def
      (`editors: [editor.id]`, `view`, the def's `kind`), each filtered by kind. `Suite.svelte`: `target` matches a card by
      `entry.editors` as now; before `mounted` draws, call `editor.showView?.(session, entry.view)` when the entry has a
      view (an `$effect` on `entry` and the session). `homeOf` gives each extra entry its own card with the editor's files.
      Drop `characters` from `Levels2dTools.svelte`'s `VIEWS`.
- [ ] **Step 4: Update the 2D journey.** In `complete-game-2d.test.ts`, the player start's picture is now changed from
      the rail: `await railHas(page, 'Characters').click()` replaces the Levels view tab step; nothing else in the journey
      changes.
- [ ] **Step 5: Run** the unit files, then `pnpm --filter @automata/editor exec playwright test -c playwright.journeys.config.ts complete-game-2d
--project editor-ipad-chromium`. Expected: PASS (the five `test.fail` journeys still fail for their reasons).
- [ ] **Step 6: Commit** `feat(suite): Characters is its own rail entry in 2D games`.

### Task 3: Home cards for every editor, and their words

**Files:**

- Modify: `home-model.ts`, `packages/editor/src/features/suite/shell/EditorCardView.svelte`
- Test: `home-model.test.ts`, `packages/editor/tests/unit/suite/shell/Suite.test.ts`

**Interfaces:**

- Consumes: Task 1's rule; Task 2's entries.
- Produces: `homeOf(load, files, suite)` returns a card for every rail entry (listed or not), in rail order, then the
  listed editors this page lacks; an unlisted card has `files: []`, `installed: true`.

- [ ] **Step 1: Write the failing tests.** A 2D list naming only `levels-2d` gives cards for every 2D-kind and kindless
      editor the page registers; the Feel card has `files: []`. In `Suite.test.ts`: the Feel card shows the title "Feel"
      once (no "Feel / Feel") and the line "Nothing made yet. Open it to start."; pressing it opens Feel on its start
      page.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** in `homeOf` from `suiteEntries(suite.editors, listed)`; the card component drops the
      repeated subtitle and shows the spec §11 line when `rows` is empty.
- [ ] **Step 4: Run** the files and `Suite*.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(suite): Home has a card for every editor on the rail`.

### Task 4: The phone rail fits nine editors

**Files:**

- Modify: `packages/editor/src/features/suite/shell/SuiteRail.svelte`
- Create: `packages/editor/src/features/suite/shell/rail-fit.ts`
- Test: `packages/editor/tests/unit/suite/shell/rail-fit.test.ts`, `packages/editor/tests/browser/layout/suite/shell/rail-phone.layout.test.ts`

**Interfaces:**

- Produces: `railFit(widths: readonly number[], room: number, open: number | undefined, moreWidth: number): { shown: number[]; more: number[] }`
  (indexes into the entries).

- [ ] **Step 1: Write the failing unit tests**: all fit → `more` empty; nine 60 px tabs in 390 with a 56 px More →
      `shown` is the first five and `more` the rest; the open editor at index 8 → `shown` is `[0,1,2,3,8]`, `more`
      `[4,5,6,7]` (Review Focus 5); never fewer than one shown tab.
- [ ] **Step 2: Run.** Expected: FAIL (no module).
- [ ] **Step 3: Implement `railFit`** (greedy left to right, reserving More's width once anything overflows; the open
      one takes the last shown slot). `SuiteRail.svelte` measures each tab's natural width once (a hidden measuring row)
      and the bar's width with a `ResizeObserver`, renders `shown`, then a "More" tab (44 px tall, the `Menu` widget) with
      `more`'s labels. The tab label is never truncated (spec §11, "Characte…").
- [ ] **Step 4: Write and run the layout test** at 390 × 844 and 1180 × 820 with nine editors: no tab is outside the
      bar, every tab is at least 44 px tall, More opens a menu naming the rest, choosing Schematic from it opens Schematic
      and shows its tab. Run `pnpm --filter @automata/editor exec vitest run --project layout tests/browser/layout/suite/shell/rail-phone.layout.test.ts`.
      Expected: PASS.
- [ ] **Step 5: Commit** `feat(suite): the rail folds what does not fit under More`.

## Phase 2: a list that grows itself

### Task 5: Each editor's rows, and `ensureListed`

**Files:**

- Create: `packages/editor/src/shared/editor-list/editor-rows.ts`
- Modify: `packages/editor/src/entries/editor-list.ts` (export it)
- Test: `packages/editor/tests/unit/shared/editor-list/editor-rows.test.ts`

**Interfaces:**

- Produces: `editorRows(id: string): string | undefined` (the TOML rows, each with a one-sentence comment);
  `async ensureListed(workspace: Pick<SuiteWorkspace, 'read' | 'write'>, id: string): Promise<WriteResult | { ok: true; unchanged: true }>`.
  Rows (globs exactly): `tuner`: `content/controls.toml`, `content/tuning.toml`; `feel`: `content/feel/*.toml`;
  `audio`: `content/audio/*.toml`, `assets/music/*`; `writer`: `content/lines/*.toml`, `content/dialogue/*.toml`;
  `sequence`: `content/cutscenes/*.toml`; `schematic`: `content/systems/*.toml`, `content/nav/*.toml`,
  `content/puzzles/*.toml`. Every row `modes = ["edit"]`, `gates = []`; `checks = ["content"]` for tuner and
  schematic, `[]` for the rest (as the templates have them today).

- [ ] **Step 1: Write the failing tests**: each id's rows load with `loadEditorList` once appended to a minimal list;
      `ensureListed` on a list lacking Feel appends exactly Feel's rows and writes once; on a list that has every Feel
      glob it writes nothing and returns `unchanged`; a list that names one of Audio's two globs gets only the other;
      an unknown id writes nothing.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Compare by `glob` and `editor` from `loadEditorList`; append text with one blank line
      before it; write with `expected: { mtime }` from the read (or `'absent'` when there is no list, starting it with
      `format = "af-editors/1"`).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(editor-list): each editor's rows, added when missing`.

### Task 6: The server lets the list grow and reads it again

**Files:**

- Modify: `packages/tools/src/features/editor/editor-policy.ts`, `packages/tools/src/features/editor/serve-editor.ts:86-120`,
  `:263-266`
- Test: `packages/tools/tests/unit/editor/editor-policy.test.ts`, `packages/tools/tests/unit/editor/serve-editor.test.ts`

**Interfaces:**

- Produces: `listGrows(before: string | undefined, after: string): boolean` (after loads, and before's rows are its
  first rows, unchanged and in order); `livePolicy(root: string, read: (path) => Promise<{ text: string; mtime: number } | undefined>): () => Promise<EditorPolicy>`
  (rebuilds when the list's mtime changes).

- [ ] **Step 1: Write the failing tests.** `listGrows`: appending a row → true; removing, editing or reordering a row →
      false; text that does not load → false. `serve-editor.test.ts`: a PUT of the list that only appends is written; a PUT
      that removes a row is refused 403 with "The editors can only add to this game's list of editors."; after a list
      write (or a hand edit on disk), a PUT to a newly listed file succeeds without restarting; after a hand edit that
      removes a row, a PUT to that file is refused (Review Focus 3).
- [ ] **Step 2: Run** `pnpm --filter @automata/tools exec vitest run tests/unit/editor`. Expected: FAIL.
- [ ] **Step 3: Implement.** The file route asks `await policy()` per request; a write to `content/editors.toml` is
      allowed when `listGrows(current, body)`, regardless of `canWrite`. An explicit `options.policy` (tests) stays fixed.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(editor): the editor server lets a game's list grow and reads it again`.

### Task 7: Starting a file adds the editor to the game

**Files:**

- Modify: `extensions/editors/src/shared/content-session.svelte.ts` (`start`), the five content editors' session
  constructors (pass their id), `extensions/editors/src/features/schematic/schematic-facts.ts` (delete `LIST_ROWS` and
  the `listed` check), `SchematicStart.svelte`, the Tuner's Make one (`grep -rn "Make one" packages/editor/src/features/suite/tuner`),
  `packages/editor/src/features/suite/shell/suite-session.ts` (hand editors the suite's raw `ensureListed`)
- Test: `extensions/editors/tests/unit/shared/content-session.test.ts`, `extensions/editors/tests/unit/schematic/*`,
  `packages/editor/tests/unit/suite/shell/Suite-tuner.test.ts`

**Interfaces:**

- Consumes: Task 5's `ensureListed`.
- Produces: `SuitePorts.list?: { ensure(id: string): Promise<WriteResult | { ok: true; unchanged: true }> }`, filled by
  the suite from its raw ports (so the rows are not an undo step, spec §5); `ContentSession.start()` calls
  `ports.list?.ensure(editorId)` first and stops with its message on refusal.

- [ ] **Step 1: Write the failing tests.** A Feel session on a game whose list lacks Feel: `start()` writes the list
      once, then the file; Undo afterwards removes the file and leaves the list as written. Schematic's start page no
      longer shows TOML or "How to add it". The Tuner's Make one on a new 2D game writes `content/tuning.toml` (no
      refusal). A refused write of an unlisted file reads "This game's list of editors doesn't include Feel yet. Press
      Start to add it." (map the write path's `policy` refusal for an unlisted path to these words, by editor label).
- [ ] **Step 2: Run** `pnpm --filter @automata/editors exec vitest run tests/unit/shared tests/unit/schematic` and the
      Tuner test. Expected: FAIL.
- [ ] **Step 3: Implement** as in Interfaces.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(editors): starting a file adds its editor to the game's list`.

## Phase 3: players, events and characters

### Task 8: An editor says when the game cannot play what it makes

**Files:**

- Create: `extensions/editors/src/shared/game-player.ts`, `extensions/editors/src/shared/ui/NoPlayer.svelte`
- Modify: each content editor's start page and status region (Feel, Audio, Writer, Sequence, Schematic);
  `schematic-facts.ts` (use `gameHasPlayer`)
- Test: `extensions/editors/tests/unit/shared/game-player.test.ts`, one DOM test per editor's start page

**Interfaces:**

- Produces: `PLAYERS: Readonly<Record<'feel' | 'audio' | 'writer' | 'sequence' | 'schematic', { pkg: string; plays: string }>>`
  (spec §6's table); `gameHasPlayer(workspace: Pick<SuiteWorkspace, 'read'>, editor: keyof typeof PLAYERS): Promise<boolean>`;
  `noPlayerWords(editor): readonly [string, string]` returning exactly
  `["Your game can't show <plays> yet.", "Its code doesn't have the part that plays them. Games made with a new copy of the tools have it."]`.

- [ ] **Step 1: Write the failing tests**: the package under `dependencies`, `devDependencies` or `peerDependencies`
      → true; absent → false; no `package.json` or invalid JSON → true (Review Focus 4); each editor's start page without
      its player shows both sentences and still shows Start; with it, neither.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Each session checks once on open and keeps the answer.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(editors): each editor says when the game cannot play what it makes`.

### Task 9: The content plugin writes the game's events

**Files:**

- Create: `packages/content/src/features/vite/event-ids.ts`
- Modify: `packages/content/src/features/vite/automata-content.ts`
- Test: `packages/content/tests/unit/vite/event-ids.test.ts`, `packages/content/tests/unit/vite/automata-content.test.ts`

**Interfaces:**

- Produces: `eventIds(sources: readonly { path: string; text: string }[]): string[]` (sorted, unique; ids from
  `defineEvent('<id>'` or `defineEvent("<id>"` in files ending `.event.ts`); the plugin writes
  `content/generated/events.json` as `{ "events": [...] }` on build start and on a change to an `.event.ts` file.

- [ ] **Step 1: Write the failing tests**: two event files give both ids sorted; a non-literal id is skipped; a file not
      ending `.event.ts` is ignored; the plugin, run on a fixture game, writes the JSON that
      `extensions/editors/src/shared/game-events.ts` reads (assert the shape it parses).
- [ ] **Step 2: Run** `pnpm --filter @automata/content exec vitest run tests/unit/vite`. Expected: FAIL.
- [ ] **Step 3: Implement.** Read files with the plugin's existing file helpers under `src/`, skipping
      `node_modules`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(content): the content build lists the game's events for Feel and Audio`.

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
  /** The top of a character, in `stage.ui`'s coordinates, or undefined when it has no view. */
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
(read each frame) and `PixiStage.useCharacters(characters: StageCharacters): void`.

- [ ] **Step 1: Write the failing tests.** `characters2d` over a consumer with one view: `point` is the view's global
      position in `ui`; `squash(ref, 1.2, 0.8)` then `rest(ref)` restores the original scale exactly; `hold` reaches the
      consumer. `feel-stage.test.ts`: with a stub `stage.characters`, a squash frame calls `squash`, the frame after calls
      `rest`, a freeze calls `hold`, a word is placed at `point(ref)` minus the existing offset; no read of
      `stage.consumer` remains (assert with a stage whose `consumer` getter throws).
- [ ] **Step 2: Run** both files. Expected: FAIL.
- [ ] **Step 3: Implement.** Move `feel-stage.ts`'s `squashed` map into `characters2d`. The 2D renderer sets
      `characters` to `characters2d(consumer, ui)` at creation.
- [ ] **Step 4: Run** both, then `pnpm --filter @automata/feel test` and the 2D journeys'
      `complete-game-2d` (Feel's flash still shows). Expected: PASS.
- [ ] **Step 5: Changeset** `patch` for `@automata/framework` and `@automata/feel`; then the API report steps from Global Constraints.
- [ ] **Step 6: Commit** `feat(render): a stage port for characters, which Feel uses`.

### Task 11: The 3D renderer hands Feel its characters

**Files:**

- Create: `packages/3d/src/app/characters-3d.ts`
- Modify: `packages/3d/src/app/create-renderer.ts:149-200` (call `stage.useCharacters` in `mount`)
- Test: `packages/3d/tests/unit/renderer/characters-3d.test.ts`

**Interfaces:**

- Consumes: Task 10's `StageCharacters`, `PixiStage.useCharacters`.
- Produces: `characters3d(consumer: RenderDeltaConsumer<Container3D>, view: View3D, ui: Container, height?: number): StageCharacters`
  (`height` defaults to the existing `PLAYER_HEIGHT`).

- [ ] **Step 1: Write the failing test**: a character at the view's centre projects to the ui centre (within one pixel)
      through `view.camera.worldToScreen`, with `y` above its feet by `height`; `squash` scales the `Container3D` on x and
      y from rest and `rest` restores it; `hold` reaches the 3D consumer.
- [ ] **Step 2: Run** `pnpm --filter @automata/3d exec vitest run tests/unit/renderer/characters-3d.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, and call `stage.useCharacters(characters3d(consumer, view, stage.ui))` in `mount`.
- [ ] **Step 4: Run** the file and `pnpm --filter @automata/3d test`. Expected: PASS; no golden moves (none draws Feel).
- [ ] **Step 5: Commit** `feat(3d): Feel squashes, freezes and labels 3D characters`.

## Phase 4: the 2D template plays every editor

### Task 12: The 2D square's speed is a setting

**Files:**

- Create: `packages/tools/src/shared/create-game/template-content/tuning.toml`
- Modify: `template-game.ts` (`SPEED` leaves `src/shared/constants.ts`; the move system reads it from `ctx.content`),
  `template-content/editors.toml` (Tuner rows from `editorRows('tuner')`)
- Test: `packages/tools/tests/unit/shared/create-game/template-content.test.ts`, `template.test.ts`

- [ ] **Step 1: Write the failing tests**: a new 2D game has `content/tuning.toml` with `speed = 2` under the
      compiler's tuning shape; its list contains every glob of `editorRows(id)` for `tuner`, `feel`, `audio`, `writer`,
      `sequence`, `schematic`; the generated game's unit tests pass (`create-game.integration.test.ts` already runs them).
- [ ] **Step 2: Run** `pnpm --filter @automata/tools exec vitest run tests/unit/shared/create-game`. Expected: FAIL.
- [ ] **Step 3: Implement.** Read the tuning shape from the compiler's built-in `tuning.toml`
      (`packages/content/src/shared/compile/read-sources.ts:20`) and how `games/base-3d` reads it; the square's sim reads
      `ctx.content` as the 3D template's `PlayContent` does (`template-3d-game.ts:72`).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(create-game): a new 2D game's speed is a setting the Tuner edits`.

### Task 13: The 2D template has a keeper, a cutscene and a guard

**Files:**

- Create: `packages/tools/src/shared/create-game/template-story.ts` (the story feature's files for 2D), template
  content `lines/keeper.toml`, `dialogue/keeper.toml`, `cutscenes/look.toml`, `systems/guard.toml`, `nav/guard.toml`,
  `words/en.json` if narrative needs it (copy the shape from `examples/2d-story/content/`)
- Modify: `template-game.ts` (`game.ts`: extensions, sim plugins, cutscene stage, camera), `template-level.ts` (the
  level gets a `keeper` and a `guard`, named), `template-project.ts` (dependencies: `@automata/narrative`,
  `@automata/cutscenes`, `@automata/systems`, `@automata/nav`, `@automata/puzzle`, `@automata/places`,
  `@automata/level-2d`), `template-content/editors.toml`
- Modify: `packages/editor/tests/e2e/journeys/complete-game-2d.test.ts` (the three marked journeys)
- Test: `template.test.ts`, `create-game.integration.test.ts`

**Interfaces:**

- Consumes: `examples/2d-story/src/features/story/*` (port, trimmed: one keeper, one conversation, one cutscene, one
  guard), `level2dPlaces` (`@automata/level-2d/sim`), `cutsceneStage2d`.
- Produces: `STORY_FILES: readonly TemplateFile[]`; the conversation's last choice is "Show me", which plays `look`.

- [ ] **Step 1: Write the failing journeys.** Replace the three `test.fail` blocks in `complete-game-2d.test.ts` with:
      (a) in Writer, change the keeper's first line to `Hello from Writer.`; Play; walk to the keeper; expect
      `game.getByText('Hello from Writer.')` visible. (b) In Sequence, change `look`'s caption to `The keeper waves.`;
      Play; walk to the keeper; choose "Show me"; expect the caption visible. (c) In Schematic, set the guard's walking
      speed to its most; Play; after 3 s of game time the guard's position (read from the canvas by his colour,
      `boxOf`) is further along than in a run at the starting speed (record both).
- [ ] **Step 2: Run** `pnpm --filter @automata/editor exec playwright test -c playwright.journeys.config.ts complete-game-2d --project editor-ipad-chromium`.
      Expected: the three new journeys FAIL (no keeper).
- [ ] **Step 3: Write the failing unit tests** in `template.test.ts`: a new 2D game has every content file above; its
      `package.json` has every player of `PLAYERS`; its level names `keeper` and `guard`. Run; expected FAIL.
- [ ] **Step 4: Implement.** Keep every template file under 600 lines; the story code is `src/features/story/` in the
      new game, with a comment at its top saying what is code (walking up starts the talk; "Show me" plays the cutscene)
      and what is content (the words, the scene, the guard's route).
- [ ] **Step 5: Run** the unit tests, the integration test (the new game builds, typechecks and passes its own tests),
      then the journeys at iPad and phone sizes. Expected: PASS.
- [ ] **Step 6: Commit** `feat(create-game): a new 2D game plays what Writer, Sequence and Schematic make`.

## Phase 5: 3D

### Task 14: Cutscenes in a 3D game

**Files:**

- Create: `extensions/cutscenes/src/features/stage-3d/cutscene-stage-3d.ts`, `extensions/cutscenes/src/entries/stage-3d.ts`,
  `extensions/sectors/src/shared/sim/sector-anchors.ts`
- Modify: `extensions/cutscenes/package.json` (`"./stage-3d"` export), `extensions/sectors/src/entries/sim.ts`,
  `examples/3d/cutscenes/cutscenes-door-and-lamp.ts` (use the entry)
- Test: `extensions/cutscenes/tests/unit/stage-3d/cutscene-stage-3d.test.ts`, `extensions/sectors/tests/unit/shared/sector-anchors.test.ts`

**Interfaces:**

- Produces: `cutsceneStage3d(options: { scripts: Readonly<Record<string, PlacedScript>>; camera: { set(pose: { x: number; y: number; z: number; yaw: number; pitch: number }): void }; pieces?: (doors: Readonly<Record<string, number>>) => void; lamps?: (levels: Readonly<Record<string, number>>) => void }): PixiStageHooks`;
  `sectorAnchors(level: AfSector2): (name: string) => { x: number; z: number } | undefined` (`actor:<cast id>`).

- [ ] **Step 1: Write the failing tests**: a script with a camera key moves the camera to the director's pose at that
      tick; a door key calls `pieces` with its opening; a lamp key calls `lamps`; no script running → no calls.
      `sectorAnchors` answers a cast place's position and `undefined` for an unknown name.
- [ ] **Step 2: Run** both. Expected: FAIL.
- [ ] **Step 3: Implement** by lifting the example's view code; the caption uses the existing caption feature. The
      example then imports the entry and loses its copy.
- [ ] **Step 4: Run** both files, `pnpm --filter @automata/cutscenes test`, `pnpm --filter @automata/sectors test`, and typecheck the example (`pnpm typecheck`). Expected: PASS.
- [ ] **Step 5: Commit** `feat(cutscenes): a 3D stage for cutscenes`.

### Task 15: Sequence reads a 3D level

**Files:**

- Modify: `extensions/editors/src/features/sequence/sequence-names.ts:80-110`, `plan-view.ts:31-60` (delete
  `NO_WALLS_WORDS`), `key-fields.ts` (lamps, doors, props as name pickers)
- Test: `extensions/editors/tests/unit/sequence/plan-view.test.ts`, `sequence-editor.test.ts`

**Interfaces:**

- Produces: `wallsOfSectors(level: AfSector2): Segment[]` (one segment per consecutive corner pair of each sector, in
  metres); `sequence-names` gathers from `content/levels/*.af-sector.json` people (cast ids), lamps, doors and props by
  id, parsed with `@automata/3d/level`'s `readLevel`.

- [ ] **Step 1: Write the failing tests**: a two-sector fixture gives its eight walls; its cast, lamps, doors and props
      are offered by name; the preview of a 3D game no longer shows "Walls show for 2D levels only, for now."; a lamp key
      offers the level's lamps in a picker instead of an id box.
- [ ] **Step 2: Run** `pnpm --filter @automata/editors exec vitest run tests/unit/sequence`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(sequence): Sequence reads a 3D level's rooms, people, lamps, doors and props`.

### Task 16: The 3D template plays every editor

**Files:**

- Create: `packages/tools/src/shared/create-game/template-feel-audio.ts` (the one source both templates use for
  `src/app/feel-audio.ts`, taking the game's size), `template-3d-story.ts`, 3D template content `feel/feel.toml`,
  `audio/audio.toml`, `lines/keeper.toml`, `dialogue/keeper.toml`, `cutscenes/look.toml`, `systems/guard.toml`,
  `nav/guard.toml`
- Modify: `template-game.ts` (use `template-feel-audio.ts`), `template-3d-game.ts` (`wick.bumped`, `renderer.setup`,
  `audio`, extensions, `cutsceneStage3d`), `template-3d-wick.ts` (emit `wick.bumped` once when a move is blocked),
  `template-3d-room.ts` (cast `keeper` and `guard` from the base pair), `template-3d-content/editors.toml`, the 3D
  `package.json` template; the Tuner's Controls part in a game with no controls file says "This game's controls are in
  its code." (`packages/editor/src/features/suite/tuner`)
- Modify: `packages/editor/tests/e2e/journeys/complete-game-3d.test.ts` (the five marked rail journeys)
- Test: `template-3d.test.ts`, `create-game.integration.test.ts`, `Suite-tuner.test.ts`

- [ ] **Step 1: Write the failing journeys**, replacing the five `test.fail` rail blocks with make-and-play ones:
      Feel (a flash on `wick.bumped`, picked from the event list by its words; Play; walk into a wall;
      `brightestSince` jumps), Audio (the bump's pitch to 880; `pitchesPlayed` has 880), Writer, Sequence and Schematic as
      Task 13's (a), (b), (c) on the 3D game. The Levels 3D floor and the Publish marks stay.
- [ ] **Step 2: Run** `pnpm --filter @automata/editor exec playwright test -c playwright.journeys.config.ts complete-game-3d --project editor-ipad-chromium`.
      Expected: the five FAIL.
- [ ] **Step 3: Write the failing unit tests**: the 3D template has every content file, every `editorRows` glob in its
      list, every player in its `package.json`, a `wick.bumped` event file; the Tuner test asserts the controls sentence.
      Run; expected FAIL.
- [ ] **Step 4: Implement.** The 2D template's `feel-audio.ts` output is byte-for-byte what it was, except where it
      names the size (assert in `template.test.ts`).
- [ ] **Step 5: Run** unit, integration and the journeys at iPad and phone sizes. Expected: PASS.
- [ ] **Step 6: Commit** `feat(create-game): a new 3D game plays what every editor makes`.

## Phase 6: words, comments and the record

### Task 17: The words and the comments

**Files:**

- Modify: Feel's event picker ("Another event (its name in the code)"), every comment listed in the spec's §12
- Test: `extensions/editors/tests/unit/feel/*` (the picker's words), a DOM scan in `Suite.test.ts` that no page text
  contains `content/`, `.toml`, `@automata/` or `editors.toml`

- [ ] **Step 1: Write the failing tests** (the picker's words; the scan over Home, each start page and each refusal).
- [ ] **Step 2: Run.** Expected: FAIL on the picker.
- [ ] **Step 3: Implement**; rewrite the §12 comments to say what the code does now.
- [ ] **Step 4: Run** `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit** `fix(editors): words a person can act on, and comments that match the code`.

### Task 18: Gates and the record

- [ ] **Step 1:** `pnpm format`, `pnpm check`, `pnpm test:unit:2d`, `pnpm test:browser:2d`, and both complete-game
      journeys at iPad and phone sizes in Chromium. Record each command and its result in the log below.
- [ ] **Step 2:** Make a small game by hand in each kind, end to end (the Owner's audit rule): `automata create-game`,
      `automata editor`, change one thing in every editor, Play, and see each. Screens to
      `/mnt/project-files/refactor/2026-11-08-shared-editors-build-screens/`.
- [ ] **Step 3:** Update `docs/refactor/progress.md` (shared editors: stage 4) and this plan's log. Leave WebKit,
      Firefox and the GPU runner's suites unchecked and say they are pending.
- [ ] **Step 4: Commit** `docs(refactor): shared editors build record`.

## Log

(The build writes each task's outcome here: commit, commands run and their results, and anything left unchecked.)
