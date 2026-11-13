# Landing the Editors' New Look (v2) on `main`: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (no
> subagents: `AGENTS.md`). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Today's `main` gets the editors as they are meant to look and work: typed words that are saved, the v2 look
with its audit fixes, and one page that holds every editor, with nothing `main` has gained since 2026-11-08 lost.

**Architecture:** The closed stack shares history with `main`, so it is **merged, not ported**: three merges of three
chain tips (v2 `refs/pull/567/head`, the web chain `refs/pull/548/head`, the sync chain `refs/pull/564/head`), each
resolved by a written rule per file group, each followed by `main`'s gates. One small fix goes first by cherry-pick,
because it stops a loss of work that is on `main` today.

**Tech Stack:** TypeScript, Svelte 5, Vitest (unit in jsdom, layout in real Chromium), Playwright journeys, pnpm and
turbo, Biome (`pnpm format`; never Prettier).

**Spec:** There is no new spec. The plan argues from three documents, and executors read all three:
- the survey, [`../audits/2026-11-12-editors-v2-landing-survey.md`](../audits/2026-11-12-editors-v2-landing-survey.md)
  (every number here comes from it);
- the v2 spec and patterns, which arrive with Task 2's merge: `docs/refactor/2026-11-08-editors-v2-spec.md`,
  `docs/design/editors-v2/PATTERNS.md`, and the build audit `docs/refactor/2026-11-09-editors-v2-build-audit.md`
  (before the merge: `git show refs/remotes/pr/567:<path>`);
- the Owner, 2026-11-12: "restore them, desktop first, yes v2 is the look"; 2026-11-08: "GitHub sync is free on the
  web".

## The strategy, and why

**Merge the stack (strategy i), chain by chain. Do not port (ii).** Measured in the survey's section 2:

| Route | For v2 and everything under it (#508, #522, #534, #559, #562, #567) |
|---|---|
| Merge `refs/pull/567/head` into `main` | 51 conflicting files, 63 hunks; 480 files merge by themselves |
| Replay the own diffs onto `main` | 147 conflicts and 52 unappliable files across #522, #534 and v2, and #508's 776 files not counted |
| Mechanical renames first | Change nothing: the stack is already `@automata/*` and already in the `app/ features/ shared/` layout |

A merge also answers "nothing on `main` is lost" by construction: git keeps every `main` change that does not conflict,
and the 51 files are few enough to decide one by one against a written rule (Task 2). The "882 files" that argued for a
rebuild was a shallow clone's figure.

**Per pull request:**

| What | Route | Task |
|---|---|---|
| #544's phase 1 and #564's B1 (typed words) | cherry-pick three commits, then B1 by path | 1 |
| #508, #522, #534, #559, #562, #567 (v2 and what it stands on) | one merge of `refs/pull/567/head` | 2, 3, 4 |
| #532, #545, #548 (every editor, the sample kept, the fixes) | one merge of `refs/pull/548/head`; the `-tools` packing half is **not** taken | 6 |
| The site's try-it on every editor | written on `main`'s site (the file #532 edited is gone) | 7 |
| #544 phases 2 to 5, #560, #564 (games in the browser, GitHub sync) | one merge of `refs/pull/564/head`, after launch unless the Owner says otherwise | 8 to 11 |
| #531 (the paid app's first session) | not this plan: the paid app's own plan carries it across task by task (the re-audit's F5) | — |
| #523, #545, #560 (audits), #512, #519, #528, #536 (specs and plans) | their documents arrive inside the merges | — |

## Global Constraints

- **Every session starts with full history:** `git rev-parse --is-shallow-repository` prints `false`, or run
  `git fetch --unshallow origin` first. A shallow clone turns a 51-file merge into a 919-file one.
- **Fetch the tips by pull ref** (the coordinator has also restored them as branches: #567
  `claude/project-thread-9gzvdb`, #548 `claude/project-thread-dbrboz`, #564 `claude/project-thread-77gue8`; the pull
  refs are what GitHub keeps for good):
  `git fetch origin refs/pull/<n>/head:refs/remotes/pr/<n>` for 548, 564 and 567. Expected heads: `pr/567` `47391563`,
  `pr/548` `3c2c37f5`, `pr/564` `cc10fdfd`. Stop if one differs.
- **Never rebase, squash or force-push the merged history.** The merge commits are what let the next chain merge small.
  Merge to `main` with a merge commit, as `main` does today.
- **Do not reopen or change the closed pull requests.** Each task opens its own draft pull request.
- **Nothing on `main` is lost.** The "Kept from `main`" table below has a check per item; Task 3 runs all of them.
- **Responsive rules (`AGENTS.md`):** phone first; touch targets at least 44 px, primary actions 48 px, never shrunk or
  hidden to fit; focus and state kept through rotation, compact height and the on-screen keyboard; scrolling only in
  declared regions (`data-scroll-region`); behaviour proved by DOM tests, layout by real-browser tests, composition by
  journeys. v2 uses 28 and 32 px with a mouse and 44 and 48 px with touch, from `editorTargets()` in
  `packages/editor/src/testing/kit/targets.ts`: a test never writes those numbers itself.
- **Pictures.** The editors have no compared baselines. The recorded pictures are `site/static/previews/editor.webp`
  and `editor-640.webp`. They move only in a task that says so, after the Owner has seen the sheet (Task 5), and the
  session looks at expected, actual and diff and explains each change.
- **No hash, golden or md5 moves in this plan.** If one does, stop and investigate (`AGENTS.md` law 3).
- **Gates for every task:** `pnpm format`; `pnpm check` exit 0; the suites the task names. After a change to a published
  package's exports or doc comments: `pnpm build`, `pnpm api-report --update`, `pnpm api-index --write`, commit what
  they write. Changesets: published packages only (`@automata/tools`, `@automata/content`, `@automata/framework`,
  `@automata/audio-synth` in this plan), always `patch`; `@automata/editor`, `@automata/editor-3d`,
  `@automata/editors`, `narrative`, `cutscenes` and the site are private and get none.
- **The scope rename** (`@automata/*` to the Owner's organisation, `claude/scope-rename`, not on `origin` yet). Write
  package names only as plain `@automata/<name>` strings and import specifiers, never built from pieces, so the codemod
  follows. **Order is: merge first, codemod after.** The survey measured the reverse on #531: 29 conflicts became 445.
  **Tasks 2 to 4 merge before the rename** (the coordinator's ruling, 2026-11-12). Any branch of this plan that must
  cross the rename: merge the rename's **parent** commit, run the rename's codemod on the branch, commit, then merge the
  rename itself (both sides then made the same change).
- **The commit hook.** Since `4be1afc9` (#667) `main`'s pre-commit hook runs Biome on the staged files and the unit
  tests of every package that owns one. A commit, a merge commit included, is accepted only when those pass. Plan the
  commits so each one is green; never `--no-verify`.
- **What is on `main` when a task starts changes its conflicts.** Before Task 2 or Task 6, record which of
  `claude/editor-journeys-green`, `claude/pixi-3d-public` and Task 1 are on `main` (`git merge-base --is-ancestor`).
- **Stage files by path. No `--no-verify`.** If the pre-commit hook fails on something the task did not touch, record
  it in the log and fix or report it; do not skip the hook (two stack sessions did, and the plan does not repeat that).
- **Record:** tick steps here only when their checks pass; update the tracking table, the log at the end, and the row
  in [`../progress.md`](../progress.md) in the same session.

## Kept from `main`

Each is on `main` since the stack's merge-base and meets the stack in the same files. The check runs on the merged tree.

| # | On `main` (commit) | Check |
|---|---|---|
| K1 | Writer edits how a line is said; the box and the caption type it out (`6efc228d`) | `pnpm --filter @automata/editors exec vitest run --project unit tests/unit/writer/delivery-field.test.ts`; `pnpm --filter @automata/narrative exec vitest run --project unit tests/unit/box/dialogue-box.test.ts tests/unit/shared/delivery.test.ts`; `pnpm --filter @automata/cutscenes exec vitest run --project unit tests/unit/caption/caption.test.ts`: all pass, files byte-equal to `main`'s |
| K2 | Sequence previews a cutscene over a 3D level (`b302f205`) | `pnpm --filter @automata/editors exec vitest run --project unit tests/unit/sequence/plan-view-3d.test.ts` passes |
| K3 | `AudioPlay` and `humanize` live in `shared/`; no feature imports another (`4b285235`) | `pnpm boundaries` exit 0; `git grep -n "features/audio" -- extensions/editors/src/features/feel extensions/editors/src/features/sequence extensions/editors/src/features/writer` prints nothing |
| K4 | The suite Home is a declared scroll region (`ca2dc922`) | `grep -c 'data-scroll-region' packages/editor/src/features/suite/shell/Home.svelte` is at least 1 |
| K5 | A segmented option never shrinks under its words (`05d93b11`) | `grep -n 'flex: 1 0 auto' packages/editor/src/shared/kit/widgets/Segmented.svelte` finds it |
| K6 | The suite's toasts take a clock (`82a1924e`) | `grep -c 'createToasts({ clock })' packages/editor/src/features/suite/shell/Suite.svelte` is 1 and `grep -c 'clock: env.clock' packages/editor/src/features/suite/shell/boot.ts` is 1 (the commit's own unit test went with the change-set desk, `a15c7b36`) |
| K7 | A new game plays the level the editor saved, under any name (`fc1c6cff`) | `pnpm --filter @automata/tools exec vitest run tests/unit/shared/create-game/template.test.ts` passes, with `main`'s cases present |
| K8 | A tap lifts in the task that pressed it; 3D journey polls get 10 s (`4ebafaae`, `3a4b3bee`) | `pnpm --filter @automata/editor exec vitest run --project unit tests/unit/testing/kit/pointers.test.ts` passes |
| K9 | The builders fold and the shared polish (#645, #654, #661, #663) | `pnpm check` exit 0; `git diff --stat origin/main HEAD -- extensions/figures extensions/character-kit packages/automata/src/app/screens/settings` shows only what a listed resolution changed |
| K10 | Every test `main` changed in the editors since the merge-base (78 files) | `git diff --name-only origin/main HEAD -- $(git diff --name-only 30667aa3 origin/main -- packages/editor/tests packages/editor-3d/tests extensions/editors/tests)` lists only files the log names with a reason |
| K11 | A camera key at an anchor, and `main`'s 3D cutscene stage (`dcef7e11`) | `pnpm --filter @automata/cutscenes exec vitest run --project unit tests/unit/features/stage-3d.test.ts` passes; `git diff origin/main HEAD -- extensions/cutscenes/src/features/stage-3d/cutscene-stage-3d.ts` is empty |
| K12 | The HUD's inventory, examine box and keypad (`2f42eb75`) | `git diff origin/main HEAD -- extensions/narrative/src/features/box/DialogueBox.svelte` shows only v2's number-key guard; `pnpm --filter @automata/narrative exec vitest run --project unit` passes |
| K13 | A new game has button sounds, six languages and a font; its check cuts fonts first (`3aef5854`, `11ce6dd9`) | `pnpm --filter @automata/tools exec vitest run tests/unit/shared/create-game` passes with `main`'s cases present (`template-fonts.test.ts` among them); `grep -c 'uiSounds' packages/tools/src/shared/create-game/template-game.ts` is at least 1 |
| K14 | A built game ships the font licence; the content entries load under plain Node (`156126ae`, `551a11f2`) | `pnpm --filter @automata/content exec vitest run --project unit` passes; `grep -nE "from '\.{1,2}/[^']*[^s]'" packages/content/src/features/vite/*.ts` prints nothing (every relative import ends in `.ts`) |
| K15 | Every control sounds by default; the settings copy and its six languages (`f68d822e`, `f863ad00`, #645, #654) | `git diff origin/main HEAD -- packages/automata/src/app/screens/settings` is empty; `pnpm api-index` prints "0 undocumented" |
| K16 | The layout moves and the trunk's gates (`0aad7f3c`, `372fdc3f`, `dd5e651a`, `0d359357`, `1c17124c`, `9d3df71d`) | `pnpm boundaries`, `pnpm style` and `pnpm source-names` exit 0; no file under `packages/editor/src/features/suite/memory/` exists |

**The 59 files both sides changed that merge by themselves** (110 changed on both sides since `30667aa3`, 51 conflict)
are not decided by hand: git keeps `main`'s side and v2's side of each. Their proof is `pnpm check` and K10, not a
reading. A file among them that the merge breaks shows in typecheck or a unit test; fix it in Task 2's merge commit and
name it in the log.

## Review Focus

The inputs the stack's own tests do not exercise and a person will meet first. Each has its test in the task named.

1. **A tab closed while two fields with the same label hold typed words.** Each field gets its own words back, none
   goes to the other. Task 1 (journey `typed-words-fields`).
2. **The browser refuses or has no private storage** (private window, full disk). The saved line says the words are not
   kept, and nothing falls back to another store. Task 1 (unit test on `keep-storage` refused).
3. **Touch and a mouse on one device** (an iPad with a trackpad, a touch laptop). Targets are 44 and 48 px whenever a
   coarse pointer is present. Task 3 (layout test with touch on and a mouse pointer).
4. **Rotation and compact height with a field focused** (844 x 390, the keyboard up). The two-row phone header leaves
   the focused field on screen, focus stays, Play and Publish stay reachable. Task 3 (layout) and Task 4 (journey).
5. **Editors opened in any order on software WebGL.** After both 3D editors, a 2D level still draws. Task 6 (the
   stack's #548 tests, run in Chromium with SwiftShader).

## Where this plan meets the others

- **The 3D lane's Part C and the every-editor page. Ruled (the coordinator, 2026-11-12): this plan owns the page; Part C
  owns the package.**
  The page itself (`extensions/editors/src/app/suite/main.ts` with `editors3d` from `@automata/editor-3d/suite`) is
  already built and arrives with Task 2's merge; Task 6 makes it the page every game gets inside the workspace and gives
  it a sample with a file in every editor; Task 7 hosts it on the site. **No session builds a second page.** Part C then
  does only packaging: the built page moves out of `@automata/tools` into the editors' own package, `automata editor`
  resolves it from a pack, the refusal at `editor-command.ts:94` goes, the README, the size budget and the two journeys
  from packs. To keep that line clean, Task 6 takes **none** of #532's packing changes
  (`packages/tools/scripts/copy-editor.ts`, the pack budget, the release list): those files stay as `main` has them.
  Part C starts after Task 6 has merged.
  **What Part C can rely on once Task 6 has merged** (checked against its plan on `claude/ship-3d-plan` `c9c2b990`,
  tasks C1 to C3):
  - `pnpm --filter @automata/editors exec vite build` writes **one** page, `extensions/editors/dist/suite/index.html`,
    holding Levels 2D, Levels 3D, Characters (2D and 3D), the Tuner, Feel, Audio, Writer, Sequence and Schematic. A game
    sees those of its own kind. C1 plans two pages in the pack (`pages/suite-full` built by `packages/editor-3d` and
    `pages/content`); after Task 2 there is one, so C1 copies `dist/suite` to `pages/suite-full` and
    `pagePath('content')` is the same page or goes.
  - `pageFor(editorList: string | undefined, fullPageThere: boolean): 'suite-2d' | 'suite-full'` in
    `packages/tools/src/features/editor/page-for.ts`. `'suite-full'` is the page with every editor. C2 passes
    `fullPageThere` as `deps.editorsPage(root, 'suite-full') !== undefined`; inside the repository it stays the
    repository's own build (`deps.inRepository`).
  - The 2D suite (`packages/editor/dist/suite`) stays as it is and stays in `@automata/tools`, as Part C decided.
  - The sample game is `extensions/editors/src/app/suite/sample/`, kept in the browser's private storage.
  - **The hosted editor:** Task 7 here makes the site serve the page with every editor. C3's step 3 ("make the words
    agree with what is served") then has nothing to change; one of the two is dropped, and this plan proposes C3's.
- **Typed words are not in the v2 merge.** The fix is #544's phase 1, in the sync chain only (`refs/pull/564/head`), so
  it is its own first task (Task 1), and Task 8's later merge of that chain meets it as the same change.
- **The paid app** (`docs/refactor/2026-11-08-apps-plan.md`). Its task 1.1 (`SuiteHost`: Play and Publish belong to the
  host) edits `SuiteHeader.svelte` and `boot.ts`; 2.4 (Home and a header that fits a phone) builds on #567's two-row
  phone header; 6.2 (the Review row) adds a row to `kit/nav/Sidebar.svelte`: all three wait for **Task 4 merged**. Its
  2.1 (`apps/editor` imports the every-editor page) waits for **Task 6 merged**. The re-audit rewrote those tasks to
  `main`'s pre-v2 files (`SuiteTopBar`, `SuiteRail`); once Task 4 merges they go back to the v2 names. Its Rust half
  needs none of this and can start now.
- **`claude/editor-journeys-green`** (`dc1b2e96`: the harness links the generated game's packages, a press-play helper
  past the language chooser, `automata editor` prepares a fresh game's assets, `turbo.json`'s `dependsOn`, the "Play is
  off" message, the site's `check:launch`). Task 4 runs journeys, so it merges `main` after that branch has landed; the
  three files it meets and their rules are in Task 4 Step 1. If it lands before Task 2 starts, Task 2 meets them instead.
- **`claude/artifacts-on-failure`** (`9ce04390`): the 2D journeys job gets 60 minutes and uploads evidence only on
  failure. Nothing here conflicts with it; Task 4's hosted run uses it once it is on `main`.
- **`claude/pixi-3d-public`.** Task 7 puts Pixi 3D on the site, so it waits for that branch to merge. It changes 2 files
  in the editors' folders (the two `package.json`s), and three site scripts. It also touches `create-game`'s
  `template-3d.ts` and `template-project.ts`, `extensions/cutscenes/package.json` and the lockfile, all in Task 2's
  merge: if it lands first, Task 2 has one more conflict (`template-3d.ts`, measured). No other task waits on it.
- **The paid app's tasks** (above) wait for Task 4 (1.1, 2.4, 6.2) and Task 6 (2.1); none blocks this plan.
- **The site's copy (ship list 15).** Task 7 changes the build and the try-it's own words only. Home's two lines stay
  with the copy lane; this plan tells it when each becomes true (every editor: Task 7; sync: Task 11).

---

## MUST for launch

### Task 1: Typed words are saved

**Branch:** `claude/typed-words-saved`, from `main`. **Can start at once.** One session.

**Files:**
- Cherry-pick: `bd43773f`, `a6574d64`, `bb233f40` (from `pr/564`'s history; 52 files as they land).
- Create (from the picks): `packages/editor/src/shared/kit/widgets/typed-save.ts`, `typing-context.ts`;
  `packages/editor/src/shared/kit/storage/typing-drafts.ts`, `leave-guard.ts`, `save-line.ts`, `keep-storage.ts`;
  `packages/editor/src/entries/kit-typing.ts`; their tests under `packages/editor/tests/unit/shared/kit/`.
- Modify (conflicts expected, 12 files): `packages/editor/src/features/suite/shell/{Suite.svelte,open-suite-ports.ts,suite-session.ts}`,
  `packages/editor/src/shared/kit/ports/suite-ports.ts`, their two tests, `docs/refactor/{copy.md,progress.md}`,
  `packages/editor/src/features/characters/{AnimationSection,EntityInspector,FieldDefEditor}.svelte`,
  `packages/editor/src/features/tiles/RuleInspector.svelte`.
- Cherry-pick fourth: `4c855dfa4` (the saved line shortens with an ellipsis on a short top bar; without it the line
  pushes the 3D studio's Dock off a phone and the editor's `suite-edit` and `suite-levels` layout tests and the 3D
  editor's studio layout test fail: the commit's own body).
- B1 and B5 by path, from `322c578d` (#564's fix commit, which also holds sync: take only these):
  - B1, drafts keyed by the field's place: `packages/editor/src/shared/kit/widgets/field-position.ts` (new),
    `packages/editor/src/shared/kit/widgets/typed-save.ts` (`draftKey` may be a function),
    `packages/editor/src/shared/kit/storage/typing-drafts.ts`, `packages/editor/src/shared/kit/ports/suite-editor.ts`
    (`draftView` only), `packages/editor/src/entries/kit-typing.ts`,
    `extensions/editors/src/shared/ui/{FieldRow,WordsField}.svelte`,
    `extensions/editors/src/features/{audio,feel,schematic,sequence,writer}/*-suite-editor.ts`; in `Suite.svelte` only
    the `drafts.place = () => …draftView…` block; tests `packages/editor/tests/unit/shared/kit/widgets/{field-position,typed-save}.test.ts`,
    `packages/editor/tests/unit/shared/kit/storage/typing-drafts.test.ts`; the journey
    `extensions/editors/tests/e2e/journeys/typed-words-fields.test.ts` with `tests/e2e/harness/web-editing.ts`.
  - B5, the saved line whole on a phone: `SuiteTopBar.svelte`, `packages/editor/src/shared/kit/shell/{EditorShell.svelte,shell-regions.css}`
    (`topbarRows`), in `Suite.svelte` the `lineBelow` lines, `packages/editor/src/testing/suite/suite-layout.ts` (not
    its `sync`, `game`, `gameKey`, `where` fields), the layout test
    `packages/editor/tests/browser/layout/suite/shell/suite-save-line.test.ts` (its GitHub states removed).
  - **Not** sync: `holdWhile`, `retry`, `pulledPaths` in `Suite.svelte` and `main.ts`, `web-games/`, `kit/sync/`,
    `sync-conflict-words.ts`, `trouble-words.ts`, `two-devices.ts`, `web-sync-*.test.ts`.
- Test: `packages/editor/tests/unit/shared/kit/fields/FieldEditor.test.ts`.

**Interfaces:**
- Produces: `typedSave` in `kit/widgets/typed-save.ts` (writes 500 ms after the last key, on leaving the field, when the
  page hides); drafts keyed by the field's place in its editor, not its label; the saved line's words from
  `kit/storage/save-line.ts`. Task 2 re-homes the saved line from `SuiteTopBar.svelte` into v2's `SaveState.svelte`.

- [ ] **Step 1: Write the failing test.** In `FieldEditor.test.ts`, replace the case "commits text on Enter and on
  blur, not on each key" with:

```ts
it('saves typed words without leaving the field', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const { oncommit } = mount({ id: 'music', type: 'text', label: 'Music' }, 'Keeper')
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await user.click(screen.getByRole('textbox', { name: 'Music' }))
  await user.keyboard(' of the gate')
  expect(oncommit).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(500)
  expect(oncommit).toHaveBeenLastCalledWith('Keeper of the gate')
})

it('saves typed words when the page is hidden before the wait is over', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const { oncommit } = mount({ id: 'music', type: 'text', label: 'Music' }, 'Keeper')
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await user.click(screen.getByRole('textbox', { name: 'Music' }))
  await user.keyboard('s')
  window.dispatchEvent(new Event('pagehide'))
  expect(oncommit).toHaveBeenLastCalledWith('Keepers')
})
```

- [ ] **Step 2: Run it and see it fail for the right reason.**
  Run: `pnpm --filter @automata/editor exec vitest run --project unit tests/unit/shared/kit/fields/FieldEditor.test.ts`
  Expected: both fail with `expected "vi.fn()" to be called …` and `Number of calls: 0` (the survey's reproduction).
- [ ] **Step 3: Cherry-pick the four commits, one at a time**, resolving after each:
  `git cherry-pick -x bd43773f`, then `a6574d64`, then `bb233f40`, then `4c855dfa4`. Expected conflicts: 8, 0, 4, and
  for the fourth `docs/refactor/progress.md` and `SuiteTopBar.svelte` (the picks' saved line meets `main`'s bar: keep
  `main`'s bar and the pick's ellipsis rule). Each pick is committed only when the hook passes (Global
  Constraints); if a pick alone cannot pass it, use `--no-commit` for that pick and the next and commit them together.
  Rule for every conflict: keep `main`'s structure and
  add the pick's typed-save wiring to it; in the two docs take `main`'s text and add the pick's new lines under it. If
  the pick's own `FieldEditor.test.ts` cases cover Step 1's two, keep the pick's and drop the duplicates.
- [ ] **Step 4: Apply B1 and B5.** `git show 322c578d -- <the whole-file B1 and B5 paths above> | git apply --3way`;
  for `Suite.svelte`, `main.ts` and `suite-layout.ts` copy only the named lines by hand. `git checkout 322c578d --
  packages/editor/src/shared/kit/widgets/field-position.ts packages/editor/tests/unit/shared/kit/widgets/field-position.test.ts
  extensions/editors/tests/e2e/journeys/typed-words-fields.test.ts extensions/editors/tests/e2e/harness/web-editing.ts`.
  Remove from those files any import of a sync or `web-games` module (they arrive in Task 8). Check:
  `git grep -nE "kit/sync|web-games|holdWhile" -- packages/editor/src extensions/editors/src` prints nothing.
- [ ] **Step 5: Add the refused-storage test** (Review Focus 2) to
  `packages/editor/tests/unit/shared/kit/storage/keep-storage.test.ts`: with a storage whose `persist()` resolves
  `false` and whose write throws, the saved line reads the "not kept" words from `save-line.ts` and no other store is
  written. Run it red against a stub that swallows the error, then green.
- [ ] **Step 6: Unit suites.** `pnpm --filter @automata/editor exec vitest run --project unit` and
  `pnpm --filter @automata/editors exec vitest run --project unit`. Expected: all pass.
- [ ] **Step 6b: Layout suites in Chromium, with a mouse and with touch** (the saved line is new on a phone's top bar):
  `pnpm --filter @automata/editor exec vitest run --project layout --project storage --browser.name=chromium`,
  `pnpm --filter @automata/editors exec vitest run --project layout --browser.name=chromium`,
  `pnpm --filter @automata/editor-3d exec vitest run --project layout --browser.name=chromium`. Expected: all pass,
  `suite-save-line`, `suite-edit`, `suite-levels` and the studio's layout test among them.
- [ ] **Step 7: Journeys, Chromium, phone and iPad.** `pnpm --filter @automata/editors exec vite build`, then
  `pnpm --filter @automata/editors exec playwright test -c playwright.journeys.config.ts typed-words`.
  Expected: `typed-words-kept` and `typed-words-fields` pass at both sizes. If the journeys' harness on `main` is still
  red for the cause `claude/editor-journeys-green` fixes, say so in the log and leave this step unticked.
- [ ] **Step 8: Gates.** `pnpm format`; `pnpm check` (exit 0); `pnpm build`; `pnpm api-report --update`;
  `pnpm api-index --write`. No changeset (`@automata/editor` and `@automata/editors` are private).
- [ ] **Step 9: Commit by path, push, open a draft pull request.** Title:
  `fix(editors): typed words are saved as they are typed`.

**Done means:** Step 1's tests pass; a line typed in Writer, Feel, the Tuner, a Stepper, a colour hex, and the
Characters and Tiles text fields survives a reload and a closed tab in the journeys; `pnpm check` exit 0.

### Task 2: Merge the v2 tip and resolve it

**Branch:** `claude/editors-v2-landing`, from `main`. **Can start at once**, beside Task 1. One session, two allowed
(the audit's A14). Before Step 2 record what is on `main` (Global Constraints): the conflict count depends on it.

**Where Task 1 meets this branch** (measured: the v2 tip merged onto `main` plus Task 1's picks): `SuiteTopBar.svelte`
(v2 deletes it: it stays deleted), `suite-session.ts`, `suite-ports.ts`, `FieldEditor.svelte`, `FieldRow.svelte`,
`editor-list/write-path.ts`, and `Suite.svelte` and `open-suite-ports.ts`, which conflict anyway. Rule: Task 1's
typed-save wiring is kept inside v2's fields; the saved line's words and states move into v2's `SaveState.svelte`;
Task 1's `topbarRows`/`lineBelow` (B5) go with `SuiteTopBar.svelte`, and `suite-save-line.test.ts` is changed to v2's
header (the line whole at 360 and 390 px, Redo on screen). Whichever of the two merges second does this.

**Files:** `git merge --no-ff refs/remotes/pr/567` touches about 530 files. On `main` `7b6ce6ac` 51 conflict (63 hunks).
Add `harness/new-game.ts`, `harness/run-editor.ts` and `turbo.json` if `claude/editor-journeys-green` is on `main`
(rules under Task 4 Step 1); `create-game/template-3d.ts` if `claude/pixi-3d-public` is (take `main`'s `@pixi/3d`
version and v2's template content); the files above if Task 1 is.

**Rules that hold everywhere:**
- **R1 import paths.** `main` moved files since 2026-11-08 (`0aad7f3c`, `372fdc3f`: `features/suite/memory/*` to
  `shared/kit/ports/memory/` or `features/suite/shell/`, `shared/level-2d/model/edit-history` to
  `shared/level-2d/editor/`, `profiles` to `shared/level-2d/profiles/`, `features/share/share-model` to
  `shared/level-2d/share/`, `humanize` to `extensions/editors/src/shared/humanize.ts`). An import conflict takes
  `main`'s paths, and each import v2 adds is re-pointed to where `main` keeps that file. Relative imports end in `.ts`
  where `main`'s file does. Three files merge clean and still import old paths: `app/suite/levels-2d/levels-2d-header.ts`,
  `levels-2d-home-names.ts`, `features/level/level-picker-model.ts`: fix them the same way.
- **R2 doc comments.** A conflict only in a comment takes `main`'s (its doc comments feed `pnpm api-index`).
- **R3 removed on `main` stays removed.** Ask, the change-set desk and Tuner locks (`a15c7b36`, `8227f52e`) do not come
  back with v2's markup.
- **R4 v2's look, `main`'s behaviour.** In editor UI, v2's markup and classes win and every behaviour `main` added is
  re-added inside them (the K-list names each).
- **R5 generated files are regenerated**, never merged: take `main`'s now, Task 3 rewrites them.

**The 51 files, one by one** (`main` = what `main` changed since the merge-base; v2 = what the stack changed):

| File | `main` | v2 | Result |
|---|---|---|---|
| `.changeset/runner-port-offset.md` (DU) | deleted (released) | edited | stays deleted |
| `agents/automata/skills/automata-api/reference/api.md` | regenerated 26 times | regenerated | R5 |
| `docs/cheatsheet.md` | regenerated | regenerated | R5 |
| `docs/refactor/progress.md`, `docs/status.md` | the trunk's record | v2's and shared-editors' sections | `main`'s text whole; v2's sections appended under it, unchanged |
| `examples/3d/characterkit/characterkit-wardrobe.ts`, `examples/3d/wardrobe/wardrobe.extension.ts` | comment: "the figure generator" (`0d359357`) | comment: "figures" | R2 |
| `extensions/cutscenes/package.json` | adds `./testing/door-and-lamp` export | adds the `./stage-3d` entry | both exports |
| `extensions/cutscenes/src/entries/stage-3d.ts`, `features/stage-3d/cutscene-stage-3d.ts` (AA) | its own 3D stage, `cutsceneStage3d({ camera, pieces, actor, fade, sound?, restore? })` (`dcef7e11`) | a different one, `cutsceneStage3d({ scripts, show, tickHz? })` returning `PixiStageHooks`, and `showScene3d` (`4e396803`, C1 `2ca3eae9`) | `main`'s file as it is (K11). v2's two functions go to a new `features/stage-3d/stage-hooks-3d.ts` as `cutsceneHooks3d` (options `CutsceneHooks3dOptions`) and `showScene3d` (`SceneTarget`); the entry exports both sets. Rename v2's users: `packages/tools/src/shared/create-game/template-3d-game.ts` lines 70 and 168 (a template string: no typecheck sees it), `examples/3d/cutscenes/cutscenes-door-and-lamp.ts`, v2's test, moved to `tests/unit/stage-3d/stage-hooks-3d.test.ts` |
| `extensions/cutscenes/src/shared/lint.ts` | a camera key at an anchor is dropped with the actors when the script does not settle | warns when a 2D level's character starts a cutscene away from where the editor put it | both: `main`'s `play` line, then v2's warning block |
| `extensions/editors/src/features/audio/audio-session.svelte.ts`, `extensions/editors/src/shared/audio-play.ts` (AA) | `AudioPlay` moved to `shared/audio-play.ts` (`053b40fe`, `cf3439e5`) | the same move, its own words | `main`'s file and import; v2's comment dropped (K3) |
| `extensions/editors/src/features/writer/{WriterPanel.svelte,dialogue-model.ts,writer-model.ts,writer-session.svelte.ts}` | `humanize` from `shared/humanize.ts` | `humanize` from `shared/id-words.ts` (v2's copy of the same move); `gameHasPlayer` added | `main`'s import, v2's `gameHasPlayer` import kept; after the last importer, delete `extensions/editors/src/shared/id-words.ts`. The markup merged by itself: K1 checks the delivery field is still there |
| `extensions/editors/src/features/sequence/{plan-view.ts,sequence-names.ts}` | Sequence over a 3D level: portals, a door's wall in two pieces, the pickers (`b302f205`, 2026-11-11) | an earlier build of the same (`186abf44`, 2026-11-08) and the shared-editors fixes | `main`'s code (K2); v2's other additions in `sequence-names.ts` (the C-fixes' names) kept where they do not duplicate it. v2's `tests/unit/sequence/plan-view.test.ts` and `sequence-editor.test.ts` cases that assert the older walls are changed to `main`'s behaviour, one log line each |
| `extensions/editors/src/features/sequence/sequence-session.svelte.ts` | `humanize` import | `gameHasPlayer`, list rows | as Writer |
| `extensions/editors/src/features/sequence/SequencePreview.svelte` | the "Show over" level select | v2's layout | R4: v2's layout with `main`'s select inside it |
| `extensions/narrative/src/features/box/DialogueBox.svelte` | `LineBox` and the typed-out reveal (`6efc228d`), the HUD (`2f42eb75`) | a number pressed while a menu on top has the keyboard is the menu's (`a6a50231`) | `main`'s markup and reveal; v2's three guard lines added inside `main`'s key handler, `reveal.done` kept (K1, K12) |
| `extensions/narrative/src/features/box/dialogue-box.ts` and `tests/unit/box/dialogue-box.test.ts` | the speaker read aloud when the game has no words for it, `lineId`, `delivery` | no name shown when none is given | `main`'s (K1); v2's test case for "no id" is changed to `main`'s read-aloud name |
| `packages/automata/src/app/screens/settings/{SettingsScreen.svelte,settings-copy.ts}` | sounds by default, doc comments (`f68d822e`, `f863ad00`) | comment only | R2 (K15) |
| `packages/content/src/features/vite/automata-content.ts` and its test | `.ts` on every relative import (plain Node, `551a11f2`), the font licence (`156126ae`), HMR test waits | the build lists the game's events (`627e99c6`: `event-ids.ts`) | `main`'s imports plus `import { isEventFile, writeEventIds } from './event-ids.ts'`; in the test, both sets of `node:fs` and `node:path` names (K14) |
| `packages/content/src/shared/controls/controls.schema.ts` | doc comment | doc comment | R2 |
| `packages/content/src/shared/level-2d/picture-of.ts` | doc comment on `Picture` | `StillPicture` (and an animated picture beside it, `0c4fb673`) | v2's types with `main`'s doc comment on the type that keeps the name `Picture`; `pnpm api-report` shows the change (a published package: say it in Task 3's changeset) |
| `packages/editor/src/app/suite/levels-2d/Levels2dTools.svelte` | R1 paths; `LevelPicker`, `Segmented` (try-it sample) | v2's header moves the picker and views into the breadcrumb | v2's (R4), `main`'s paths (R1); the sample's level template stays reachable (K16) |
| `packages/editor/src/features/suite/shell/Home.svelte` | `data-scroll-region` (`ca2dc922`) | the lede, one card per entry | v2's (R4) with `data-scroll-region` (K4) |
| `packages/editor/src/features/suite/shell/Suite.svelte` | the toasts' `clock` (`82a1924e`), R1 paths | `EditorHeader`, `playOff`, `reread`, the header | v2's (R4); `clock` in `Props` and `createToasts({ clock })` (K6); `reread` once |
| `packages/editor/src/features/suite/shell/{open-suite-ports.ts,sample-ports.ts}`, `packages/editor/src/shared/kit/ports/memory/memory-workspace.ts`, `packages/editor/src/testing/suite/suite-layout.ts`, `packages/editor/tests/unit/suite/shell/open-suite-ports.test.ts` | R1 moves | `createLiveList`, `listGrowsBy`, `editorRows` | R1: `main`'s paths, v2's new imports re-pointed |
| `packages/editor/src/shared/kit/ports/memory/live-list.ts` (UA) | — (git placed v2's new file in `main`'s moved folder) | new | `git add` at that path; its two importers (`sample-ports.ts`, `open-suite-ports.ts`) import it from there |
| `packages/editor/src/shared/kit/ports/suite-editor.ts` | doc comment | `HeaderItem`, `EditorHeader` | both: v2's two types, `main`'s comment on `SuiteUndo` (no `EDS-D19`: `pnpm style` refuses plan citations) |
| `packages/editor/tests/browser/canvas/shared/level-2d/canvas/level-scene.test.ts` | reads `--color-stage-grid` (`1c17124c`) | reads `--color-border-strong` | `main`'s token if v2's `tokens.json` still has it, else v2's; the test passes in Chromium |
| `packages/editor/tests/e2e/journeys/dark-levels-3d.test.ts` | the light context passes a viewport only when there is one (`9d3df71d`) | its own version | `main`'s line, v2's other changes |
| `packages/editor/tests/unit/app/suite/levels-2d/{Levels2dStatus,levels-2d-header,levels-2d-home-names}.test.ts` (UA) | `main` moved the folder | new tests | `git add` at `main`'s path; imports by `#src/…` |
| `packages/tools/src/shared/create-game/template.ts` | `templateFilesOf` | `withStory` | both |
| `packages/tools/src/shared/create-game/template-game.ts` | `uiSounds` and the generated `feel-audio.ts` with button sounds (`3aef5854`) | `tuningOf`, the story's content | both: one import line `import { audio, feelOnStage, uiSounds } from './feel-audio.ts'` plus `tuningOf`; the generated `feel-audio.ts` is `main`'s with v2's additions (K13) |
| `packages/tools/src/shared/create-game/template-level.ts` | `startLevelId`: the level the world places, under any name (`fc1c6cff`) | the Tuner's speed, the story | both (K7) |
| `packages/tools/src/shared/create-game/template-project.ts` | `fonts` scripts (`11ce6dd9`), `targetScripts` | `editor: 'automata editor'` | both |
| `packages/tools/tests/unit/shared/create-game/template.test.ts` | the three commits' cases | v2's cases | every case of both |
| `site/src/app.css` | only imports now; the site is dark (`site/src/shared/styles/tokens.css`) | `color-scheme: light` and its comment | `main`'s whole; v2's two lines are not taken (they answered a light site) |

**Interfaces:**
- Consumes: Task 1's typed-save and saved line if Task 1 has merged.
- Produces: `main`'s tree with `SuiteHeader.svelte`, `SaveState.svelte`, `ProblemCount.svelte`,
  `kit/nav/{Sidebar,TabBar}.svelte`, `kit/rows/{Row,Field,Section,Block}.svelte`, `kit/sheets/Sheet.svelte`,
  `kit/states/EmptyState.svelte`, `kit/toolbar/FloatingToolbar.svelte`; no `SuiteTopBar.svelte` or `SuitePills.svelte`;
  the every-editor page in `extensions/editors/src/app/suite/main.ts`; `@automata/cutscenes/stage-3d` exporting
  `cutsceneStage3d` (`main`'s) and `cutsceneHooks3d` with `showScene3d` (v2's).

- [ ] **Step 1: The check that is red on `main`.**
  Run: `test -f packages/editor/src/features/suite/shell/SuiteHeader.svelte && test -f packages/editor/src/shared/kit/nav/Sidebar.svelte && grep -q "editor-3d/suite" extensions/editors/src/app/suite/main.ts; echo $?`
  Expected on `main`: `1`.
- [ ] **Step 2: Merge.** `git config rerere.enabled true && git config merge.renameLimit 20000 && git merge --no-ff --no-commit refs/remotes/pr/567`.
  Expected: `git status --porcelain | grep -cE '^(UU|AA|DU|UD|AU|UA|DD) '` prints 51, or the count the header gives
  for what is on `main`. If it prints several hundred, the clone is shallow: stop and unshallow.
- [ ] **Step 3: Resolve by the table, in this order, checking the count after each** (`git diff --name-only
  --diff-filter=U | wc -l`; measured on `7b6ce6ac`): (a) R5, docs, the changeset and the R2 comment-only files
  (`controls.schema.ts` among them): 51 to 41; (b) the R1 import files, the four UA files, the four Writer files,
  `sequence-session`, `audio-session`, `audio-play`: to 25; (c) `create-game` (5) and the rest of `packages/content`
  (3): to 17; (d) `plan-view`, `sequence-names`, `SequencePreview`, narrative (3), cutscenes (4, the stage last): to 7;
  (e) `Suite`, `Home`, `Levels2dTools`, `suite-editor`, `level-scene.test`, `dark-levels-3d.test`, `site/src/app.css`:
  to 0. One log line per file whose result is not simply one side.
- [ ] **Step 4: Lockfile.** `pnpm install` (not `--frozen-lockfile`); stage `pnpm-lock.yaml`.
- [ ] **Step 5: Make the tree green before the commit** (the hook refuses a red one): `pnpm typecheck`; fix what it
  names (R1's three clean-merged files first); then
  `pnpm --filter @automata/editor exec vitest run --project unit` (the tip alone: 3,471 pass),
  `pnpm --filter @automata/editors exec vitest run --project unit` (685),
  `pnpm --filter @automata/editor-3d exec vitest run --project unit` (2,259),
  `pnpm --filter @automata/tools exec vitest run tests/unit/shared/create-game` and
  `pnpm --filter @automata/cutscenes exec vitest run --project unit`. Expected: all pass, with at least those counts
  plus `main`'s newer tests. `git grep -n "cutsceneStage3d(" -- packages/tools/src` prints nothing.
- [ ] **Step 6: Commit the merge**, staged by path (`git add` of the resolved files; `git status` shows nothing
  unstaged), with the default message plus a body listing the rules taken and the fixes made inside it. The hook runs
  Biome and the unit tests of every package staged; expected: it passes. If it fails, fix and commit again; never
  `--no-verify`.
- [ ] **Step 7: Step 1's check prints `0`.** Push the branch. No pull request yet (Task 4 opens it).
- [ ] **If the session must stop before Step 6:** write the open list and each decided file's rule into the log, push
  nothing of the half-merge, and say so. The next session repeats Step 2 (with `rerere` the same machine replays the
  resolutions; a new container does not have them, so the log is what carries over).

**Done means:** the merge is committed with no conflict marker (`git grep -n '^<<<<<<<\|^>>>>>>>' -- . ':!docs'` prints
nothing), typecheck exit 0, Step 5's suites green, the log has a line per hand-decided file.

### Task 3: v2 on `main`'s gates

**Branch:** `claude/editors-v2-landing` (continues). After Task 2. One session.

**Files:**
- Modify: `packages/editor/tests/browser/layout/suite/shell/suite-header.test.ts` (the one test red on the tip).
- Create: `packages/editor/tests/browser/layout/suite/shell/suite-header-compact.test.ts` (Review Focus 3 and 4).
- Regenerate: `tooling/api-report/reports/*.api.md`, `docs/cheatsheet.md`, the agent's `api.md`.
- Whatever `pnpm boundaries`, `pnpm style`, `pnpm knip` and `check-changesets` name.

- [ ] **Step 1: The header test.** `suite-header.test.ts` > "The header at ipad-pro-11-portrait (834 x 1194) > has
  Play, Publish, Undo, Redo and the problems whole…" fails on the tip with `Error: no Not checked yet`, with a mouse
  and with touch. Run it and see that failure. #567's F5 shows no problem count under 900 px when there is nothing to
  count, so the test is what is wrong: under 900 px it expects Play, Publish, Undo and Redo whole and **no** problem
  count; at 900 px and over it expects the count. Add the case F5 must not break: with one problem in the fixture, the
  count shows "1" whole at 834 px and its accessible name is the words ("1 problem"). Make those changes; run:
  `pnpm --filter @automata/editor exec vitest run --project layout --browser.name=chromium tests/browser/layout/suite/shell/suite-header.test.ts`.
  Expected: 36 of 36 pass, plus the new case at each size (measured on the tip: 34 of 36 before the change).
- [ ] **Step 2: Write the failing compact and mixed-pointer tests** in `suite-header-compact.test.ts`, using
  `atEverySize` and `editorTargets()` from `#src/testing/kit/`:

```ts
// At 844 x 390 with touch, a Writer line focused:
expect(document.activeElement).toBe(lineBox)                       // focus is kept
expect(wholeOnScreen(lineBox)).toBe(true)                          // the header's rows do not cover the field
expect(heightOf(play)).toBeGreaterThanOrEqual(targets.primary)     // 48 with touch
expect(heightOf(undo)).toBeGreaterThanOrEqual(targets.control)     // 44 with touch
// With touch on and a mouse pointer moved over the header:
expect(editorTargets().control).toBe(44)                           // a coarse pointer present keeps touch sizes
```

  Run it. If it passes at once, make it red by asserting the opposite once, to prove it measures; then keep it. If it
  fails on the product, fix the product (never the 44 and 48), and say so in the log.
- [ ] **Step 3: `pnpm check`.** Fix each failing part in its own commit: `lint`, `typecheck`, `boundaries` (features
  import only themselves and `shared/`), `style` (600 lines a file, tests import `#src/…`, no plan citations in
  comments, the `--tokens` rule over `packages/editor/src/shared/kit` and `packages/editor-3d/src`), `source-names`,
  `knip`, `test:unit`, `check:changesets` (each of the stack's changesets names a published package and is `patch`;
  delete any that names a private one, as #534's H2 did). Expected at the end: exit 0.
- [ ] **Step 4: Build and reports.** `pnpm build`; `pnpm api-report --update`; `pnpm api-index --write`;
  `pnpm agent-skills`. Commit what they write. Expected: `pnpm api-index` prints "0 undocumented".
- [ ] **Step 5: Layout suites in Chromium, with a mouse and with touch.**
  `pnpm --filter @automata/editor exec vitest run --project layout --project storage --browser.name=chromium`
  (the tip: 966 of 968; expected now: all), `pnpm --filter @automata/editors exec vitest run --project layout --browser.name=chromium`
  (116), `pnpm --filter @automata/editor-3d exec vitest run --project layout --browser.name=chromium`.
- [ ] **Step 6: Run every check in "Kept from `main`"**, K1 to K16, and paste each result into the log.
- [ ] **Step 6b: The site still looks like itself.** v2 changes `@automata/editor/tokens.css` (it opens Dark, adds
  `--edge-xl`), which the site imports first. `pnpm --filter @automata/site build`, then `check:site`, and the site's unit suite pass;
  if the site has a visual suite, run it in Chromium and look at any diff (expected: none, the site sets its own
  colours after the kit's).
- [ ] **Step 7: `pnpm format`, commit by path, push.**

**Done means:** `pnpm check` exit 0; the three layout suites green in Chromium; K1 to K16 pass; reports regenerated.
WebKit, Firefox and the GPU runner are not run here: the log says so, and hosted CI on the draft pull request (Task 4)
runs parity and the 2D journeys.

### Task 4: v2's journeys, and the pull request

**Branch:** `claude/editors-v2-landing` (continues). After Task 3 **and after `claude/editor-journeys-green` is on
`main`** (merge `main` first). One session.

**Files:**
- Modify: journeys only where the merge changed what they drive
  (`packages/editor/tests/e2e/journeys/`, `extensions/editors/tests/e2e/journeys/`).
- Create: `packages/editor/tests/e2e/journeys/rotation-keeps-the-field.test.ts` (Review Focus 4).

- [ ] **Step 1: Merge `main`.** Expected (measured on `claude/editor-journeys-green` `dc1b2e96`): three files
  conflict, and the same three if that branch was already on `main` when Task 2 ran (then Task 2 resolved them by these
  rules and this step meets nothing):
  - `turbo.json`: `@automata/editor#test:e2e`'s `dependsOn` is `["build", "@automata/tools#build",
    "@automata/editor-3d#build", "@automata/editors#build"]` (the branch added the third, v2 the fourth).
  - `packages/editor/tests/e2e/harness/run-editor.ts`: the branch's file whole (it waits for `Press Ctrl+C to stop.`,
    reads `playOff`, fails at once when Play is off); v2's changes to it, if any remain, are added beside.
  - `packages/editor/tests/e2e/harness/new-game.ts`: the branch's linking of the generated game's packages
    (`link-game-packages.ts`) and its `press-play.ts` use; v2's `openRoom` and `chooseView` helpers added unchanged.
  The four journeys both sides touched (`animation-plays-in-game`, `paint-shows-in-game`, `story-in-play`,
  `whole-game-loop`) and `game-runner.ts` merge by themselves: run them in Step 3, and name any that fails.
- [ ] **Step 2: Write the failing journey** `rotation-keeps-the-field`: on the phone project, open Writer on a new 2D
  game, focus the keeper's line, type "Mind the step", rotate (`page.setViewportSize({ width: 844, height: 390 })`),
  and expect the line box to still be the focused element, to hold "Mind the step", and to be in the viewport; rotate
  back and expect the same; then Play, and the keeper says "Mind the step". Then the on-screen keyboard: at 390 x 844
  focus the line and shrink the visual viewport to 390 x 500 (the harness's keyboard helper if `main` has one, else
  `page.setViewportSize` to 390 x 500 with the comment saying it stands for the keyboard); the line stays in view and
  Play and Publish stay reachable (in the header or one tap away), at least 48 px with touch. Run it; fix the product if
  it fails.
- [ ] **Step 3: Build, then the journeys in Chromium at phone (390 x 844) and iPad (820 x 1180).**
  `pnpm build`; `pnpm --filter @automata/editors exec vite build`;
  `pnpm --filter @automata/editor exec playwright test -c playwright.journeys.config.ts --project editor-ipad-chromium --project editor-phone-chromium --trace off`;
  the same in `extensions/editors`. Expected: every journey passes except those marked `test.fail` with a stated reason
  (floor materials; Publish of a 3D game while Pixi 3D is closed). List each `test.fail` in the log. A journey that
  fails once and passes alone is recorded as a flake with its name, not ignored.
- [ ] **Step 4: Gates again** (`pnpm format`, `pnpm check`).
- [ ] **Step 5: Open the draft pull request** `feat(editors): the editors' new look (v2) on main`. The body: the
  survey's graph, the resolution rules, K1 to K16's results, what ran and what did not (WebKit, Firefox, the GPU runner,
  a real phone), and #567's open F3 ("look at the phone's level once on a real device"). It merges with a merge commit
  after the Owner has seen the sheet (Task 5) and CI is green.

**Done means:** the journeys green in Chromium at both sizes; the draft pull request open with CI's result recorded;
nothing merged by this session.

### Task 5: The sheet the Owner looks at

**Branch:** `claude/editors-v2-sheet`, from `claude/editors-v2-landing` after Task 3. Can run beside Task 4. One
session.

**Files:**
- Create: `packages/editor/tests/slow/v2-sheet.test.ts` (a Playwright script run by hand; the folder `tests/slow/` is
  new in this package and is not in any gate) and `docs/superpowers/audits/2026-11-12-editors-v2-sheet/` (`index.md` and the pictures).

**The sheet.** Every picture at `deviceScaleFactor: 2`, WebP, the folder under 8 MB.

| Screens | Sizes | Looks |
|---|---|---|
| Home; Levels 2D (the level, Tiles, the level menu open); Characters; the Tuner; Feel; Audio; Writer; Sequence; Schematic; Levels 3D (Plan and 3D); Characters 3D; the Publish dialog; an empty state; the phone's "More" tab | phone 390 x 844 (touch), iPad 820 x 1180 (touch), desktop 1440 x 900 (mouse); Home and Levels 2D also at 844 x 390 | Dark (the default) for all; Light for Home, Levels 2D and Writer |
| **Before and after, side by side:** Home, Levels 2D, Writer, Levels 3D | phone and desktop | `main` at the commit Task 2 merged (its first parent) beside the branch |

- [ ] **Step 1: Write the script** so that each picture waits on readiness (the canvas drew, fonts loaded: the
  journeys' own waits), never on a sleep. It opens a new 2D story game and a new 3D game made by `create-game`.
- [ ] **Step 2: Run it on `main` for the "before" set and on the branch for the rest.**
- [ ] **Step 3: Look at every picture.** Write `index.md`: each picture, and under the before-and-after pairs one line
  per visible change. Anything that looks wrong (cut words, a control under 44 px on a touch size, the white strip of
  F3) is listed at the top under "For the Owner", not fixed here. Read each screen's words once with the drunk-grandma
  question (`AGENTS.md`: could she tell what is happening and what to press?) and list any that fail it the same way.
- [ ] **Step 4: Compare the site's two recorded pictures** (`site/static/previews/editor.webp`, `editor-640.webp`)
  with the new look: show old, new and the difference side by side in `index.md`. **Do not replace them.** They move in
  Task 7, after the Owner's yes.
- [ ] **Step 5: Commit by path, push, link the folder from Task 4's pull request.**

**Done means:** the folder is on the branch, the Owner has a link, and the log records the Owner's answer when it
comes. Until then the site's pictures do not move.

### Task 6: One page for every game, and a sample that is kept

**Branch:** `claude/every-editor-page`, from `main` after Task 4 has merged. One session.

**Files:** `git merge --no-ff refs/remotes/pr/548`. Against today's `main` it conflicts in 76 files; after v2 is in,
what is left is about the 8 it has with the v2 tip plus its own 34 (the survey lists them).

| Group | Rule |
|---|---|
| `packages/tools/scripts/copy-editor.ts`, the pack budget in `tooling/consumer-smoke`, `tooling/release` lists, `.github/workflows/site.yml`, `package.json` scripts | **`main`'s.** Packing is Part C's |
| `packages/tools/src/features/editor/{editor-command,editor-args}.ts`, `page-for.ts` (deleted by #532) | Keep `page-for.ts`. Change it so the every-editor page is served to **every** game whenever that page can be resolved (inside the workspace), whatever the game's list names; when it cannot (a packed `-tools` today), `main`'s behaviour and message stay until Part C |
| `extensions/editors/src/app/suite/{main.ts,sample-game.ts,sample/*}`, `open-content-suite.ts` | #548's: the sample has a file in every editor and is kept in the browser's private storage; `loadPixi3dFirst`; on top of v2's look |
| `site/src/features/editor/*`, `site/tests/**` | Not taken (the folder is gone on `main`); Task 7 |
| `docs/guides/editor.md`, the `--app` message | #548's H1 words, checked against what `page-for.ts` now does |
| Everything else | As Task 2's rules: v2's look wins, the newer behaviour is kept |

**Interfaces:**
- Produces: `pageFor(editorList: string | undefined, fullPageThere: boolean): EditorPage` in `page-for.ts`, where
  `EditorPage` stays `'suite-2d' | 'suite-full'` (today it takes the list alone and gives `'suite-full'` only when the
  list names a 3D or content editor). `editor-command.ts` passes whether `extensions/editors/dist/suite/index.html`
  can be resolved. `extensions/editors/dist/suite` is the built every-editor page: the one Task 7 hosts, the paid app's
  2.1 imports and Part C packs.

- [ ] **Step 1: Write the failing test** in `packages/tools/tests/unit/editor/page-for.test.ts`:

```ts
const levelsOnly = '[[file]]\neditor = "levels-2d"\npath = "levels/start.level.json"\n'

it('gives a game whose list names only Levels the page with every editor, when that page is there', () => {
  expect(pageFor(levelsOnly, true)).toBe('suite-full')
})
it('keeps the 2D suite when the page with every editor cannot be found', () => {
  expect(pageFor(levelsOnly, false)).toBe('suite-2d')
})
```

  Write `levelsOnly` in the list format `loadEditorList` reads (the file's other cases show it). Run it: the first
  fails after Task 2's merge with `expected 'suite-2d' to be 'suite-full'`.
- [ ] **Step 2: Merge and resolve by the table.** Expected conflict count: record it; it is not 76.
- [ ] **Step 3: `pnpm install`; typecheck; the unit suites of `tools`, `editor`, `editors`, `editor-3d`.**
- [ ] **Step 4: The sample is kept.** #532's unit test "an edit is lost on reload" (red on `main`, green here) and the
  layout tests of `extensions/editors` in Chromium: every editor on the rail (Levels, Levels 3D, Characters 2D,
  Characters 3D, the Tuner, Feel, Audio, Writer, Sequence, Schematic), none missing, at 390 px with "More".
- [ ] **Step 5: Any order, software WebGL** (Review Focus 5): #548's tests for H3 and H4 pass in Chromium here
  (SwiftShader): after both 3D editors, a new 2D level draws; going to and from Characters 3D ten times does not freeze.
- [ ] **Step 6: Journeys** `complete-game-2d`, `complete-game-3d`, `new-game-checks`, `work-survives-reopening` at
  phone and iPad in Chromium.
- [ ] **Step 7: Gates** (`pnpm format`, `pnpm check`, `pnpm build`, the reports; a `patch` changeset for
  `@automata/tools` saying `automata editor` opens one page with every editor inside a checkout). Draft pull request.

**Done means:** inside the repository `automata editor` on any new 2D or 3D game opens one page with every editor of
that kind of game; the sample survives a reload; `@automata/tools` packs to the same size as before (print
`pnpm --filter @automata/tools pack --dry-run`'s size before and after into the log); `pnpm check` exit 0.

### Task 7: The site's try-it opens every editor

**Branch:** `claude/site-try-every-editor`, from `main` after Task 6 **and after `claude/pixi-3d-public` has merged**
(the site may not carry the closed beta). After the Owner's yes on the sheet for Step 5. One session.

**Files:**
- Modify: `site/scripts/build-demos.ts` (`copyEditor`, lines 96 to 104: copy `extensions/editors/dist/suite`, not
  `packages/editor/dist/suite`), `site/scripts/site-checks/pages.ts`, `site/src/shared/html/security-headers.ts` and
  `site/scripts/write-headers.ts` only if the page needs a header it lacks, the closed-beta scan, the try-it's own
  words in `site/src/shared/editor-link.ts`.
- Create: `site/tests/e2e/editor-try.e2e.ts` (on `main`'s site layout; #532's and #548's test of that name is the
  model).
- Replace, only after the Owner's yes: `site/static/previews/editor.webp`, `editor-640.webp`.

- [ ] **Step 1: Write the failing journey** `editor-try.e2e.ts`: open `/editor/app` on the built site; the rail names
  every editor; a platformer level draws; a Writer edit survives a reload and a closed and reopened browser; the page
  loads with no CSP violation in the console. Run it on `main`: fails at "the rail names every editor".
- [ ] **Step 2: Change `copyEditor`** and the checks beside it; build the site; the journey passes.
- [ ] **Step 3: The site's gates:** `pnpm --filter @automata/site check:launch`, `check:site`, its unit and e2e suites.
- [ ] **Step 4: Tell the copy lane** (a line in the log and the pull request): Home's "Every editor, for 2D and 3D
  games" is true once this deploys.
- [ ] **Step 5: The two recorded pictures**, only with the Owner's yes recorded in Task 5's log: replace them from the
  sheet's Home or Levels picture; show expected, actual and diff in the pull request and explain each change.
- [ ] **Step 6: Gates, draft pull request.** No deploy (the Owner's).

**Done means:** the built site's try-it shows every editor and keeps the sample; the launch checks pass; the pictures
moved only if the Owner said yes.

## AFTER launch (or MUST, if the Owner keeps Home's sync line: decision D5)

Sync is its own group. The survey found the cheaper honest route: **merge the sync tip** (85 files against today's
`main`, 12 against the v2 tip) rather than rebuild it. It still needs the Owner's GitHub app, Cloudflare settings and
approved Privacy and Terms words before it can be called done, which is why it is not in the launch's MUST.

### Task 8: Merge the sync tip

**Branch:** `claude/web-games-and-sync`, from `main` after Tasks 1, 4 and 6 have merged. One session.

- [ ] **Step 1:** the red check on `main`: `test -d packages/editor/src/shared/kit/sync && test -d packages/editor/src/features/web-games; echo $?` prints `1`.
- [ ] **Step 2:** `git merge --no-ff --no-commit refs/remotes/pr/564`. Record the conflict count. Rules: Task 1's files
  are already there (the same commits, cherry-picked): take the branch's side where they differ only by Task 1's
  resolutions, and keep Task 1's resolutions; the saved and sync lines live in v2's `SaveState.svelte`;
  `site/**` is not taken (Task 10); `docs/refactor/copy.md` takes both.
- [ ] **Step 3:** `pnpm install`; typecheck; the editor and editors unit suites (the tip alone: 3,504 in 292 files).
- [ ] **Step 4:** push. **Done means:** merged, no markers, typecheck and unit green.

### Task 9: Sync on `main`'s gates, with a fake GitHub

**Branch:** `claude/web-games-and-sync` (continues). One session.

- [ ] `pnpm check` exit 0 (the tip had `pnpm style` red with 9 findings and `pnpm format` red on 5 site files: fix).
- [ ] Layout in Chromium: Your games at 360 and 390 px (never run on the stack: write it first, red), the saved line
  under the header at 360 and 390 px with every status line (#564's B5).
- [ ] Journeys at phone and iPad: `web-game-kept`, `typed-words-kept`, `typed-words-fields`, `web-sync-typing`,
  `web-sync-two-devices`. B4 (a draft typed in a view that is not open) stays open and is written in the log.
- [ ] `pnpm build`, the reports. Draft pull request. **Done means:** all of the above green; nothing against real
  GitHub.

### Task 10: The sign-in function on `main`'s site

**Branch:** `claude/site-github-sign-in`, from `main` after Task 9. One session.

- [ ] Carry `site/functions/api/github/[[route]].ts` and its tests from `pr/564` onto `main`'s site (`git checkout
  refs/remotes/pr/564 -- site/functions site/tests/unit/sign-in`), then fit `security-headers.ts`, `check-site.ts`
  and the Privacy page by hand: those three conflict because `main`'s site moved.
- [ ] The function stores and logs nothing; the token stays in page memory: its unit tests say so and pass.
- [ ] Privacy and Terms words stay drafts behind a flag until the Owner approves them.
- [ ] **Done means:** `check:site` and the site's unit suite green; no deploy.

### Task 11: Against the real GitHub and Cloudflare

**Owner first, then one session.** The Owner creates the GitHub OAuth app and sets the Cloudflare secrets (section 12
of `docs/refactor/2026-11-08-sign-in-sync-spec.md`, which arrives with Task 8). Then a session writes
`site/tests/slow/github-sign-in.test.ts` (run by hand: sign in, keep a game on GitHub, get it in a second browser,
change it on both, choose "Keep both"), runs it, and records the result. **Done means:** that test has passed once with
the Owner's accounts; the copy lane is told Home's sync line is true once deployed.

---

## Tracking

| # | Task | Branch | Needs | Sessions | Launch | State | % |
|---|---|---|---|---|---|---|---|
| 0 | Survey and plan | `claude/editors-v2-landing-plan` | — | 1 | — | Done 2026-11-12 | 100% |
| 1 | Typed words are saved | `claude/typed-words-saved` | — | 1 | MUST | Not started | 0% |
| 2 | Merge the v2 tip and resolve | `claude/editors-v2-landing` | — | 1 to 2 | MUST | Not started | 0% |
| 3 | v2 on `main`'s gates | `claude/editors-v2-landing` | 2 | 1 | MUST | Not started | 0% |
| 4 | v2's journeys, the pull request | `claude/editors-v2-landing` | 3, `editor-journeys-green` on `main` | 1 | MUST | Not started | 0% |
| 5 | The Owner's sheet | `claude/editors-v2-sheet` | 3 | 1 | MUST | Not started | 0% |
| 6 | One page for every game, the sample kept | `claude/every-editor-page` | 4 merged | 1 | MUST | Not started | 0% |
| 7 | The site's try-it opens every editor | `claude/site-try-every-editor` | 6, `pixi-3d-public` on `main`, the Owner's yes for the pictures | 1 | MUST | Not started | 0% |
| 8 | Merge the sync tip | `claude/web-games-and-sync` | 1, 4, 6 merged | 1 | AFTER (D5) | Not started | 0% |
| 9 | Sync on the gates, fake GitHub | `claude/web-games-and-sync` | 8 | 1 | AFTER (D5) | Not started | 0% |
| 10 | The sign-in function on the site | `claude/site-github-sign-in` | 9 | 1 | AFTER (D5) | Not started | 0% |
| 11 | Real GitHub and Cloudflare | `claude/site-github-sign-in` | 10, the Owner's accounts | 1 | AFTER (D5) | Not started | 0% |

**MUST for launch: 7 sessions (Tasks 1 to 7), 0 of 7 done, 0%.** Allow 9: Task 2's merge and Task 3's gates are the two
that can run over, because nobody has yet seen the merged tree typecheck.
**Critical path:** Task 2, 3, 4 (draft pull request), the Owner's merge of it, 6, 7. Task 1 runs beside Task 2 (and
merges first if it can); Task 5 runs beside Task 4; Task 7 also waits on `claude/pixi-3d-public`. **AFTER: 4 sessions and the Owner's
accounts.** The whole plan: 1 of 12 rows done (the plan itself), 8%.

**Can start at once:** Task 1 and Task 2, side by side. Nothing else in this plan waits on the scope rename, but Tasks
2 to 4 should merge before it runs.

## Only the Owner

1. **Look at the sheet (Task 5) and say yes or what to change.** The site's two recorded pictures of the editor move
   only after that. Recommended: yes to the look as #567 left it, with any change as a follow-up task, not a blocker.
2. **Look at a level in Levels 2D once on a real phone** (#567's F3: a white strip in headless phone captures that no
   element covers; never seen on a device).
3. **D5, sync at launch or after.** Recommended: after. Home's line "Sign in with GitHub to keep your games in sync"
   comes off or says "soon" for launch (the copy lane), and Tasks 8 to 11 follow. Choosing "at launch" adds 4 sessions
   and item 4.
4. **For sync:** the GitHub OAuth app, the Cloudflare secrets, and the Privacy and Terms words.
5. **WebKit, Firefox and the GPU runner** for the merged editors: no session in the stack or here ran them.
6. **Merging each pull request, and deleting the restored branches** once their content is on `main` (after Task 6:
   `claude/complete-game-journeys`, `-fxu792`, `-q3zxgn`, `-szjdbh`; after Task 9: `-nkdoj4`; `-hvpv4a` when the paid
   app's plan has carried #531 across).

## For the coordinator

- **The tips are restored as branches** (2026-11-12, the coordinator); the plan uses the pull refs, which point at
  the same commits.
- **The paid-app re-audit's B1 and "do not revive #544" were sized on a shallow clone** (the coordinator's ruling 4;
  for that audit's owner, not edited on `claude/paid-app-plan-reaudit`). The correction, in words that can be pasted:
  "B1: the base branches are restored (2026-11-12) and v2 reaches `main` through the v2 landing plan's Tasks 2 to 4;
  tasks 1.1, 2.4 and 6.2 go back to v2's files (`SuiteHeader.svelte`, `kit/nav/Sidebar.svelte`) once its Task 4 has
  merged, and 2.1 waits for its Task 6. F6: the sync tip (#564) conflicts with `main` in 85 files on full history, not
  882, and in 12 against the v2 tip; #544 is landed by merging #564 after launch (that plan's Tasks 8 to 11), not
  rebuilt. Recommendation 3 is that plan's Task 1."
- **The 3D lane's Part C, on `claude/ship-3d-plan` `c9c2b990`, still differs from this plan** (the audit's A9): it
  starts after B10 and `editor-journeys-green`, not after Task 6; C1 copies `packages/editor-3d`'s `dist/suite` and
  tells a maker to build `@automata/editor-3d`, where after Task 2 the page with every editor is
  `extensions/editors/dist/suite` (the v2 tip's `editor-command.ts:59` already maps `'suite-full'` there); C3 Step 3
  changes the site's words to the 2D suite, where Task 7 serves every editor. Those three lines change on that branch.
- **The rename's order:** merge `main` first, run the codemod after (the survey's measurement on #531).
- **The every-editor page:** this plan's Tasks 2, 6 and 7; Part C packs it and does not build one.

## Log

| Date | Session | Task | What happened | Commit |
|---|---|---|---|---|
| 2026-11-12 | plan audit | all | Audited on `fdae6f18`, `main` `7b6ce6ac`, full history: the trial merges reproduce (51/63, 76/113, 85/130). Fixed: Task 2 reordered for the commit hook and given a per-file table; the 3D stage, Sequence, `DialogueBox` and `site/src/app.css` rules; Task 1's B1 and B5 paths, `4c855dfa4`, its layout step; K6's deleted test, K11 to K16; Task 4's harness merge; the keyboard and drunk-grandma checks. See [`../audits/2026-11-12-editors-v2-landing-plan-audit.md`](../audits/2026-11-12-editors-v2-landing-plan-audit.md) | this branch |
