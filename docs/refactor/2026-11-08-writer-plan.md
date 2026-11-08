# Writer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (no
> subagents in this project). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Writer edits a scene's lines and conversations as a script, saves each line's words in the line, and shows
every problem in words.

**Architecture:** A narrative change first (`words` on a line, `wordsOf`), then `extensions/editors/src/features/writer`
on the shared `ContentSession`: one session per scene holding its lines file and its dialogue file, pure model
functions that turn content into script rows and return `ContentEdit`s, and Svelte regions.

**Tech Stack:** Svelte 5 runes, Vitest 5 (jsdom, Testing Library), Zod 4, `@automata/narrative`, `@automata/content`
schema helpers, the kit's content documents.

**Spec:** [`2026-11-08-writer-spec.md`](2026-11-08-writer-spec.md), with the shared
[`2026-11-08-content-editors-spec.md`](2026-11-08-content-editors-spec.md).

## Global Constraints

- The content editors plan's constraints hold (no "Plus", core never imports this package, feature folders, tests in
  `tests/`, 600 lines a file, drunk grandma copy, 44/48 px targets, span-preserving edits, test first).
- No key on screen: `say`, `next`, `choices`, `stance`, `when`, `kind`, a line id or a locale key never appears as
  page text (a DOM test scans for them). The words for a kind are the spec's section 3.
- Writer never reorders a lines file; new lines go at the end (spec section 4).
- `@automata/narrative` is published: its change gets a `patch` changeset, and `pnpm build`, `pnpm api-report --update`
  and `pnpm api-index --write` after its exports change.
- Dialogue lint runs in Node through the checks port; the page never imports `@automata/narrative/tools`.

## Review Focus

1. **Renaming a part that many choices lead to.** Every `next`, every choice's `next` and `start` follow in one undo
   step. Test in Task 4.
2. **Two lines whose first words are the same.** Ids stay unique (`shop.welcome_in`, `shop.welcome_in_2`). Test in
   Task 2.
3. **A line still said elsewhere** (a conversation or a cutscene caption) is removed only after the person confirms the
   named places. Test in Task 3.
4. **A conversation with a loop** (a part that leads back to an earlier one). Reading order and the map terminate; the
   loop is drawn as an arrow back. Test in Task 4.
5. **A translated game.** Changing words leaves `content/messages/<lang>.json` alone; the status line says
   "Translations of this line are now out of date." Test in Task 3.

---

### Task 1: Words in the line (narrative)

**Files:**
- Modify: `extensions/narrative/src/shared/sim/lines.schema.ts`, `extensions/narrative/src/shared/narrative.content.ts`,
  `extensions/narrative/src/entries/index.ts`
- Create: `extensions/narrative/src/shared/words.ts`
- Test: `extensions/narrative/tests/unit/words.test.ts`; `.changeset/narrative-words.md`

**Interfaces:**
- Produces: `LineRecord.words?: string`; the `lines` content kind marks it `localized()`;
  `wordsOf(lines: readonly LineRecord[], translation?: Readonly<Record<string, string>>, keyOf?: (line: LineRecord,
  index: number) => string): ReadonlyMap<string, string>` (text key to words; a translated message wins when present).

- [ ] **Step 1: Write the failing tests.** Compiling a fixture game with a lines file whose line has `words` puts the
  words in `generated/messages/en.json` under that line's message key; `wordsOf` maps `shop.welcome_in` to the words,
  and to the translation when given; a line with no `words` is absent from the map; `lineSchema.parse` keeps `words` as
  a string.
- [ ] **Step 2: Run** `pnpm --filter @automata/narrative test:unit words`; fail on the missing field.
- [ ] **Step 3: Implement.** The content kind's schema is `lineSchema` extended with `words: localized().optional()`.
- [ ] **Step 4: Run**; pass. Run `pnpm build`, `pnpm api-report --update`, `pnpm api-index --write`.
- [ ] **Step 5: Commit** `feat(narrative): a line keeps its words, translatable` with the changeset.

### Task 2: The script model

**Files:**
- Create: `extensions/editors/src/features/writer/writer-model.ts`, `writer-words.ts` (the kind and problem words)
- Test: `extensions/editors/tests/unit/writer/writer-model.test.ts`

**Interfaces:**
- Produces: `interface ScriptLine { readonly index: number; readonly id: string; readonly who: string; readonly words:
  string | undefined; readonly kind: string }` (the kind in words); `scriptLines(file: LinesFile, people: Canon['people']
  | undefined): ScriptLine[]`; `newLineId(scene: string, words: string, taken: ReadonlySet<string>): string`;
  `addLineEdit(file: LinesFile | undefined, line: { id: string; kind: LineKind; speaker?: string; words: string }):
  ContentEdit` (sets `text` to `id`); `wordsEdit(index: number, before: string | undefined, words: string): ContentEdit`;
  `KIND_WORDS: Record<LineKind, string>`.

- [ ] **Step 1: Write the failing tests.** `newLineId('shop', 'Welcome in. Mind the step.', new Set())` is
  `shop.welcome_in_mind_the`; with that taken, `…_2`; at most 40 characters after the scene. `addLineEdit` on a missing
  file inserts `lines = [{…}]`, else appends. `KIND_WORDS.dialogue` is `Said in a conversation`, `bark` `Called out`,
  `caption` `On screen in a cutscene`, `examine` `Read when you look at something`.
- [ ] **Step 2–4: Run, implement, run.**
- [ ] **Step 5: Commit** `feat(editors): Writer's script model`.

### Task 3: The scene session and the Lines page

**Files:**
- Create: `writer-session.svelte.ts`, `writer-suite-editor.ts`, `WriterPanel.svelte`, `WriterCanvas.svelte`,
  `WriterLines.svelte`, `WriterRegions.svelte` under `features/writer`
- Modify: `extensions/editors/src/app/suite/content-editors.ts`, `sample/editors.toml`, add `sample/lines.toml`,
  `sample/dialogue.toml`
- Test: `extensions/editors/tests/unit/writer/writer-editor.test.ts`

**Interfaces:**
- Consumes: `openTomlSession`, `ContentSession`, `undoOf`, `askOf`, `problemWords`.
- Produces: `createWriter(): SuiteEditor<WriterSession>` (id `writer`, label `Writer`); `WriterSession` holds `lines:
  ContentSession<LinesFile, number>` and `dialogue: ContentSession<DialogueFile, string>` for the chosen scene, and
  `scene: string`; `saidBy(lineId): string[]` (the conversations and cutscenes that say it, in words).

- [ ] **Step 1: Write the failing DOM tests.** The start page ("This scene has no lines yet." / **Write the first
  line**); add a line without typing a key; edit words; removing a line said by a conversation asks "The conversation
  Shopkeeper still says this line." and removes only on **Remove anyway**; a game with `content/messages/fr.json` shows
  "Translations of this line are now out of date." after a change and leaves that file's text identical; no key text
  on the page.
- [ ] **Step 2–4: Run, implement, run.** Undo joins both files' histories in the order they were written.
- [ ] **Step 5: Commit** `feat(editors): Writer's lines`.

### Task 4: Conversations as a branching script, and the map

**Files:**
- Create: `dialogue-model.ts`, `dialogue-map.ts`, `WriterConversation.svelte`, `WriterMap.svelte`
- Test: `tests/unit/writer/dialogue-model.test.ts`, `tests/unit/writer/dialogue-map.test.ts`, `writer-editor.test.ts`

**Interfaces:**
- Produces: `readingOrder(graph: DialogueGraph): string[]` (start, then breadth first, then unreachable parts last);
  `partWords(id: string): string` (`browsing` → `Browsing`); `choiceEdits` (add, remove, set `next`, set `stance`
  within the canon range, set and unset a remembered fact); `renamePartEdits(fileIndex, graph, from, to): ContentEdit[]`;
  `conditionWords(cond: Cond, names): string` and edits for `when`; `layoutConversation(graph): { boxes, arrows }`
  (rows by distance from the start, arrows back drawn as loops).

- [ ] **Step 1: Write the failing tests** for each, with Review Focus 1 and 4 included, and condition words: `{ has:
  'key' }` → `the player has the key`, `{ fact: 'trust', atLeast: 2 }` → `trust is at least 2`, `{ not: … }` →
  `not (…)`, `{ any: [...] }` → `any of (…)`.
- [ ] **Step 2–4: Run, implement, run.** DOM: add a choice to "A new part…", set Standing "Warmer +1", Remembers.
- [ ] **Step 5: Commit** `feat(editors): Writer's conversations`.

### Task 5: Problems in words, and Play it

**Files:**
- Create: `writer-problems.ts`, `WriterPlay.svelte`
- Test: `tests/unit/writer/writer-problems.test.ts`, `writer-editor.test.ts`

**Interfaces:**
- Produces: `structureProblems(graph: DialogueGraph, lines: LinesFile): { part: string; words: string }[]` (unreachable,
  no way out, missing line) computed in the page from the file; the narrative pipeline's findings arrive through the
  checks port as an `after` check and are shown with `problemWords`. `playStep(graph, at, facts, choice?)` for Play it.

- [ ] **Step 1: Write the failing tests:** the spec section 3.4 sentences, exactly; Play it walks start → choice →
  next and stops at a part with no way out with "The end."
- [ ] **Step 2–4: Run, implement, run.**
- [ ] **Step 5: Commit** `feat(editors): Writer says what is wrong and plays a conversation through`.

### Task 6: Layout, template, proof and records

- [ ] Chromium layout test at 390×844 and 820×1180 (map beside or toggled, nothing under 44 px, the words field in view
  with the on-screen keyboard emulated by a shorter viewport).
- [ ] Add Writer's rows to the create-game template `editors.toml` (`content/lines/*.toml`,
  `content/dialogue/*.toml`), beside the other editors' rows and content-in-play's `controls.toml` row.
- [ ] Screens to the project files; `pnpm format`, the package's `test:unit` and `typecheck`, `pnpm boundaries`.
- [ ] Log entry below; a line in `docs/refactor/progress.md`; say what did not run.

## Log

(Each session records what it did here, with evidence.)
