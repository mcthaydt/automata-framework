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
  If the rename reaches `main` while a task's branch is open: merge the commit **before** the rename, run the rename's
  codemod on the branch, commit, then merge the rename (both sides then made the same change). Task 2 to 4's branch
  should merge **before** the rename runs; if the rename is ready first, it waits for Task 4 or Task 2 has not started.
- **Stage files by path. No `--no-verify`.** If the pre-commit hook fails on something the task did not touch, record
  it in the log and fix or report it; do not skip the hook (two stack sessions did, and the plan does not repeat that).
- **Record:** tick steps here only when their checks pass; update the tracking table, the log at the end, and the row
  in [`../progress.md`](../progress.md) in the same session.

## Kept from `main`

Each is on `main` since the stack's merge-base and meets the stack in the same files. The check runs on the merged tree.

| # | On `main` (commit) | Check |
|---|---|---|
| K1 | Writer edits how a line is said; the box and the caption type it out (`6efc228d`) | `pnpm --filter @automata/editors exec vitest run --project unit tests/unit/writer/delivery-field.test.ts`; `pnpm --filter @automata/narrative exec vitest run tests/unit/box/dialogue-box.test.ts tests/unit/shared/delivery.test.ts`; `pnpm --filter @automata/cutscenes exec vitest run tests/unit/caption/caption.test.ts`: all pass, files byte-equal to `main`'s |
| K2 | Sequence previews a cutscene over a 3D level (`b302f205`) | `pnpm --filter @automata/editors exec vitest run --project unit tests/unit/sequence/plan-view-3d.test.ts` passes |
| K3 | `AudioPlay` and `humanize` live in `shared/`; no feature imports another (`4b285235`) | `pnpm boundaries` exit 0; `git grep -n "features/audio" -- extensions/editors/src/features/feel extensions/editors/src/features/sequence extensions/editors/src/features/writer` prints nothing |
| K4 | The suite Home is a declared scroll region (`ca2dc922`) | `grep -c 'data-scroll-region' packages/editor/src/features/suite/shell/Home.svelte` is at least 1 |
| K5 | A segmented option never shrinks under its words (`05d93b11`) | `grep -n 'flex: 1 0 auto' packages/editor/src/shared/kit/widgets/Segmented.svelte` finds it |
| K6 | The suite's toasts take a clock (`82a1924e`) | `pnpm --filter @automata/editor exec vitest run --project unit tests/unit/suite/shell/Suite-ship.test.ts` passes |
| K7 | A new game plays the level the editor saved, under any name (`fc1c6cff`) | `pnpm --filter @automata/tools exec vitest run tests/unit/shared/create-game/template.test.ts` passes, with `main`'s cases present |
| K8 | A tap lifts in the task that pressed it; 3D journey polls get 10 s (`4ebafaae`, `3a4b3bee`) | `pnpm --filter @automata/editor exec vitest run --project unit tests/unit/testing/kit/pointers.test.ts` passes |
| K9 | The builders fold and the shared polish (#645, #654, #661, #663) | `pnpm check` exit 0; `git diff --stat origin/main HEAD -- extensions/figures extensions/character-kit packages/automata/src/app/screens/settings` shows only what a listed resolution changed |
| K10 | Every test `main` changed in the editors since the merge-base (78 files) | `git diff --name-only origin/main HEAD -- $(git diff --name-only 30667aa3 origin/main -- packages/editor/tests packages/editor-3d/tests extensions/editors/tests)` lists only files the log names with a reason |

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

- **The 3D lane's Part C and the every-editor page. Proposal: this plan owns the page; Part C owns the package.**
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
- **`claude/editor-journeys-green`** (the 2D journeys' harness). Task 4 runs journeys, so it merges `main` after that
  branch has landed and does not touch `packages/editor/tests/e2e/harness/` beyond the merge's own resolution.
- **`claude/pixi-3d-public`.** Task 7 puts Pixi 3D on the site, so it waits for that branch to merge. It changes 2 files
  in the editors' folders; no other task waits on it.
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
- B1 by path from `pr/560..pr/564`: `packages/editor/src/shared/kit/storage/typing-drafts.ts`,
  `packages/editor/src/shared/kit/ports/suite-editor.ts`, `packages/editor/src/entries/kit-typing.ts`,
  `extensions/editors/src/shared/ui/{FieldRow,WordsField}.svelte`, the five `*-suite-editor.ts` files in
  `extensions/editors/src/features/`, and the journey `extensions/editors/tests/e2e/journeys/typed-words-fields.test.ts`
  with `tests/e2e/harness/web-editing.ts`. **Not** the sync words (`web-games/`, `kit/sync/`, `sync-conflict-words.ts`,
  `two-devices.ts`, `web-sync-*.test.ts`).
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
- [ ] **Step 3: Cherry-pick the three commits, one at a time**, resolving after each:
  `git cherry-pick -x bd43773f`, then `a6574d64`, then `bb233f40`. Rule for every conflict: keep `main`'s structure and
  add the pick's typed-save wiring to it; in the two docs take `main`'s text and add the pick's new lines under it. If
  the pick's own `FieldEditor.test.ts` cases cover Step 1's two, keep the pick's and drop the duplicates.
- [ ] **Step 4: Apply B1.** `git diff refs/remotes/pr/560 refs/remotes/pr/564 -- <the B1 paths above> | git apply --3way`;
  `git checkout refs/remotes/pr/564 -- extensions/editors/tests/e2e/journeys/typed-words-fields.test.ts extensions/editors/tests/e2e/harness/web-editing.ts`.
  Remove from those files any import of a sync or `web-games` module (they arrive in Task 8).
- [ ] **Step 5: Add the refused-storage test** (Review Focus 2) to
  `packages/editor/tests/unit/shared/kit/storage/keep-storage.test.ts`: with a storage whose `persist()` resolves
  `false` and whose write throws, the saved line reads the "not kept" words from `save-line.ts` and no other store is
  written. Run it red against a stub that swallows the error, then green.
- [ ] **Step 6: Unit suites.** `pnpm --filter @automata/editor exec vitest run --project unit` and
  `pnpm --filter @automata/editors exec vitest run --project unit`. Expected: all pass.
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

**Branch:** `claude/editors-v2-landing`, from `main`. **Can start at once**, beside Task 1. One session. Whichever of
Task 1 and this branch merges second resolves their meeting in `Suite.svelte`, `suite-session.ts`,
`open-suite-ports.ts`, `suite-ports.ts`, `SuiteTopBar.svelte` and `shell-regions.css` (the saved line goes into
`SaveState.svelte`; #564's own `Suite.svelte` and `EditorShell.svelte` changes show how).

**Files:** `git merge --no-ff refs/remotes/pr/567` touches about 530 files; 51 conflict. The groups and their rules:

| Group (files) | Rule |
|---|---|
| Generated: `agents/automata/skills/automata-api/reference/api.md`, `docs/cheatsheet.md` | Take `main`'s (`git checkout --ours`); Task 3 regenerates |
| `docs/refactor/progress.md`, `docs/status.md` | `main`'s text whole; append the stack's v2 and shared-editors sections under it, unchanged |
| `.changeset/runner-port-offset.md` (deleted on `main`) | Stay deleted |
| The shell: `Suite.svelte`, `Home.svelte`, `open-suite-ports.ts`, `sample-ports.ts`, `kit/ports/suite-editor.ts`, `kit/ports/memory/{memory-workspace,live-list}.ts`, `Levels2dTools.svelte`, `testing/suite/suite-layout.ts` | **v2's markup and classes win; `main`'s behaviour is re-added inside them.** `Home.svelte` keeps `data-scroll-region` (K4); `Suite.svelte` keeps the toasts' clock (K6) |
| Writer (4 files), `DialogueBox.svelte`, `dialogue-box.ts` and its test | v2's rows and fields; `main`'s delivery field (K1) is placed as a v2 `Field` in the line's `Row`. `dialogue-box.ts` and its test: `main`'s |
| Sequence (4 files), the 3D cutscene stage (`stage-3d.ts`, `cutscene-stage-3d.ts`, both sides added), `cutscenes/src/shared/lint.ts`, `cutscenes/package.json` | The stage: `main`'s file, plus #534's C1 (the stage writes the camera per frame, after the follow camera) if `main`'s lacks it: its unit test from `pr/567` decides. Sequence: v2's layout around `main`'s 3D preview (K2) |
| `extensions/editors/src/shared/audio-play.ts` (both added), `audio-session.svelte.ts` | `main`'s `shared/` home (K3); v2's styling only |
| `packages/content`: `automata-content.ts` and its test, `controls.schema.ts`, `picture-of.ts` | `main`'s, plus the stack's additions that its tests need (the build lists the game's events) |
| `packages/automata` settings screen and `settings-copy.ts` | `main`'s (the shared polish's six languages), plus the stack's one added setting if its test names it |
| `create-game`: `template.ts`, `template-game.ts`, `template-level.ts`, `template-project.ts`, `template.test.ts` | Both: `main`'s "plays the level the editor saved, under any name" (K7) and the stack's new-game content (a keeper, a cutscene, a guard, the `character` tag) |
| Tests: `level-scene.test.ts`, `dark-levels-3d.test.ts`, `open-suite-ports.test.ts`, three `levels-2d` unit tests (renamed against added) | The test follows its source file's resolution; `main`'s waits and token reads stay (K8, K10) |
| `examples/3d/characterkit/characterkit-wardrobe.ts`, `examples/3d/wardrobe/wardrobe.extension.ts` | `main`'s (the builders fold, K9) |
| `site/src/app.css` | `main`'s, plus v2's two added lines |

**Interfaces:**
- Consumes: Task 1's `SaveLine` words if Task 1 has merged.
- Produces: `main`'s tree with `SuiteHeader.svelte`, `SaveState.svelte`, `ProblemCount.svelte`,
  `kit/nav/{Sidebar,TabBar}.svelte`, `kit/rows/{Row,Field,Section,Block}.svelte`, `kit/sheets/Sheet.svelte`,
  `kit/states/EmptyState.svelte`, `kit/toolbar/FloatingToolbar.svelte`; no `SuiteTopBar.svelte` or `SuitePills.svelte`;
  the every-editor page in `extensions/editors/src/app/suite/main.ts`.

- [ ] **Step 1: The check that is red on `main`.**
  Run: `test -f packages/editor/src/features/suite/shell/SuiteHeader.svelte && test -f packages/editor/src/shared/kit/nav/Sidebar.svelte && grep -q "editor-3d/suite" extensions/editors/src/app/suite/main.ts; echo $?`
  Expected on `main`: `1`.
- [ ] **Step 2: Merge.** `git config merge.renameLimit 20000 && git merge --no-ff --no-commit refs/remotes/pr/567`.
  Expected: `git status --porcelain | grep -cE '^(UU|AA|DU|UD|AU|UA|DD) '` prints 51 (more, by the six files named
  above, if Task 1 merged first). If it prints several hundred, the clone is shallow: stop and unshallow.
- [ ] **Step 3: Resolve by the table**, group by group. After each group:
  `git diff --name-only --diff-filter=U | wc -l` goes down by the group's count. Write one log line per file whose
  resolution was not simply one side.
- [ ] **Step 4: Lockfile.** `pnpm install` (not `--frozen-lockfile`); stage `pnpm-lock.yaml`.
- [ ] **Step 5: Commit the merge** with the default message plus a body listing the groups and the rule taken.
- [ ] **Step 6: Typecheck.** `pnpm typecheck`. Fix what the merge broke (imports of `SuiteTopBar`, moved helpers,
  `main`'s newer types) in separate commits, each named for what it fixes.
- [ ] **Step 7: The three editor unit suites.**
  `pnpm --filter @automata/editor exec vitest run --project unit` (the tip alone: 3,471 pass),
  `pnpm --filter @automata/editors exec vitest run --project unit` (685), 
  `pnpm --filter @automata/editor-3d exec vitest run --project unit` (2,259). Expected: all pass, with at least those
  counts plus `main`'s newer tests.
- [ ] **Step 8: Step 1's check prints `0`.** Push the branch. No pull request yet (Task 4 opens it).

**Done means:** the merge is committed with no conflict marker (`git grep -n '^<<<<<<<\|^>>>>>>>' -- . ':!docs'` prints
nothing), typecheck exit 0, the three unit suites green, the log has a line per hand-decided file. If the session ends
before Step 7, the log says which suites are red and why.

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
  count; at 900 px and over it expects the count. Make that change; run:
  `pnpm --filter @automata/editor exec vitest run --project layout --browser.name=chromium tests/browser/layout/suite/shell/suite-header.test.ts`.
  Expected: 36 of 36 pass.
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
- [ ] **Step 6: Run every check in "Kept from `main`"**, K1 to K10, and paste each result into the log.
- [ ] **Step 7: `pnpm format`, commit by path, push.**

**Done means:** `pnpm check` exit 0; the three layout suites green in Chromium; K1 to K10 pass; reports regenerated.
WebKit, Firefox and the GPU runner are not run here: the log says so, and hosted CI on the draft pull request (Task 4)
runs parity and the 2D journeys.

### Task 4: v2's journeys, and the pull request

**Branch:** `claude/editors-v2-landing` (continues). After Task 3 **and after `claude/editor-journeys-green` is on
`main`** (merge `main` first). One session.

**Files:**
- Modify: journeys only where the merge changed what they drive
  (`packages/editor/tests/e2e/journeys/`, `extensions/editors/tests/e2e/journeys/`).
- Create: `packages/editor/tests/e2e/journeys/rotation-keeps-the-field.test.ts` (Review Focus 4).

- [ ] **Step 1: Merge `main`.** Expected: only the harness files meet; take `main`'s harness and re-apply v2's
  `openRoom` and `chooseView` helpers on top.
- [ ] **Step 2: Write the failing journey** `rotation-keeps-the-field`: on the phone project, open Writer on a new 2D
  game, focus the keeper's line, type "Mind the step", rotate (`page.setViewportSize({ width: 844, height: 390 })`),
  and expect the line box to still be the focused element, to hold "Mind the step", and to be in the viewport; rotate
  back and expect the same; then Play, and the keeper says "Mind the step". Run it; fix the product if it fails.
- [ ] **Step 3: Build, then the journeys in Chromium at phone (390 x 844) and iPad (820 x 1180).**
  `pnpm build`; `pnpm --filter @automata/editors exec vite build`;
  `pnpm --filter @automata/editor exec playwright test -c playwright.journeys.config.ts --project editor-ipad-chromium --project editor-phone-chromium --trace off`;
  the same in `extensions/editors`. Expected: every journey passes except those marked `test.fail` with a stated reason
  (floor materials; Publish of a 3D game while Pixi 3D is closed). List each `test.fail` in the log. A journey that
  fails once and passes alone is recorded as a flake with its name, not ignored.
- [ ] **Step 4: Gates again** (`pnpm format`, `pnpm check`).
- [ ] **Step 5: Open the draft pull request** `feat(editors): the editors' new look (v2) on main`. The body: the
  survey's graph, the resolution rules, K1 to K10's results, what ran and what did not (WebKit, Firefox, the GPU runner,
  a real phone), and #567's open F3 ("look at the phone's level once on a real device"). It merges with a merge commit
  after the Owner has seen the sheet (Task 5) and CI is green.

**Done means:** the journeys green in Chromium at both sizes; the draft pull request open with CI's result recorded;
nothing merged by this session.

### Task 5: The sheet the Owner looks at

**Branch:** `claude/editors-v2-sheet`, from `claude/editors-v2-landing` after Task 3. Can run beside Task 4. One
session.

**Files:**
- Create: `packages/editor/tests/slow/v2-sheet.test.ts` (a Playwright script run by hand; `tests/slow/` is not in any
  gate) and `docs/superpowers/audits/2026-11-12-editors-v2-sheet/` (`index.md` and the pictures).

**The sheet.** Every picture at `deviceScaleFactor: 2`, WebP, the folder under 8 MB.

| Screens | Sizes | Looks |
|---|---|---|
| Home; Levels 2D (the level, Tiles, the level menu open); Characters; the Tuner; Feel; Audio; Writer; Sequence; Schematic; Levels 3D (Plan and 3D); Characters 3D; the Publish dialog; an empty state; the phone's "More" tab | phone 390 x 844 (touch), iPad 820 x 1180 (touch), desktop 1440 x 900 (mouse); Home and Levels 2D also at 844 x 390 | Dark (the default) for all; Light for Home, Levels 2D and Writer |
| **Before and after, side by side:** Home, Levels 2D, Writer, Levels 3D | phone and desktop | `main` at `d401ec4d` beside the branch |

- [ ] **Step 1: Write the script** so that each picture waits on readiness (the canvas drew, fonts loaded: the
  journeys' own waits), never on a sleep. It opens a new 2D story game and a new 3D game made by `create-game`.
- [ ] **Step 2: Run it on `main` for the "before" set and on the branch for the rest.**
- [ ] **Step 3: Look at every picture.** Write `index.md`: each picture, and under the before-and-after pairs one line
  per visible change. Anything that looks wrong (cut words, a control under 44 px on a touch size, the white strip of
  F3) is listed at the top under "For the Owner", not fixed here.
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
| 2 | Merge the v2 tip and resolve | `claude/editors-v2-landing` | — | 1 | MUST | Not started | 0% |
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
that can run over, because nobody has yet seen the merged tree typecheck. **AFTER: 4 sessions and the Owner's
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
- **The paid-app re-audit's B1 and "do not revive #544" were sized on a shallow clone.** Its plan can go back to v2's
  file names after Task 4, and its sync phase can reuse Task 8's merge.
- **The rename's order:** merge `main` first, run the codemod after (the survey's measurement on #531).
- **The every-editor page:** this plan's Tasks 2, 6 and 7; Part C packs it and does not build one.

## Log

| Date | Session | Task | What happened | Commit |
|---|---|---|---|---|
| | | | | |
