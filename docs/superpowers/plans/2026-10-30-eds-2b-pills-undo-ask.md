# EDS.2b The suite's pills, Undo and the Ask diff dialog: TDD plan

- **Task:** EDS.2b in [02](../../02-master-delivery-plan.md). [Editor suite spec](../specs/2026-10-30-editor-suite-design.md) §4.3 (ports, the Ask split), §4.5 (the change-set journal), §5 flows 3 to 8, §7, §9 (`suite-home` pills, `ask-diff`), §10 (sizes; short tier: pills collapse to icons with counts), §11 (failure rows for Ask, checks, gates, undo, reload), §13 acceptance EDS-d to EDS-i and EDS-z, §14 row EDS.2b; EDS-D8 (two-phase checks), EDS-D9 (a proposal is one whole document), EDS-D18 (locks are session-only), EDS-D19 (Undo).
- **Lane:** editors. **Depends on:** EDS.2a (#268, merged), EDS.1b (ports and fakes, merged), EDS.1a (documents, merged). **Base:** ED3D.10a's headless Ask controller (`packages/editor-3d/src/app/ask-controller.ts`): its rule (a proposal is shown and accepted only over the document it was made for; an edit, undo or redo while it is in flight or on show drops it) and its shape (plain TypeScript, no Svelte, DOM or clock), rebuilt here over text, since the suite cannot import an editor's app. **Unblocks:** EDS.2c, EDS.3, EDS.4a, EDS.5a, EDS.9a.
- **Status:** Drafted 2026-10-30. Accepted under the Owner's "Auto accept all spec and plans" (2026-10-30) once reviewed. Not implemented.
- **Progress:** 3 of 10 steps.

## Scope

**In:**
- The write path every suite editor uses (flow 3 and 4): the first write with no change set asks for a title (`ChangeSet.begin`); the `before` checks run on the candidate text and a failure refuses the write with its findings (EDS-g); a pass writes through `SuiteWorkspace.write` (mtime guarded), records the file in the change set and the journal (before and after text), and starts the `after` checks. Without a `ChangeSet` port edits save to the workspace and nothing is journalled.
- The three top-bar pills: **change set** (none / its title and file count / "Saving to the workspace" without the port), **checks** (idle, running, pass, warn, fail, error; the failing check one tap away with Locate; measures before and after), **gates** (each reopened gate with its recorded decision and link, "No gates", "Gates not readable" without the port or on a read failure; never a control that records). In the `short` tier they collapse to icons with counts, never hidden.
- Reopened gates: a gate is reopened when the change set has a written file whose editor-list row names it; undoing every write to its files clears it (EDS-i).
- Undo (EDS-D19): the top bar's Undo and Redo, `Mod+Z` and `Mod+Shift+Z`, act on the active editor's document; an Ask diff is one step; Undo of a step whose file moved on is refused with the path and the step is kept (§11); starting or closing a change set clears every history.
- The Ask diff dialog (`ask-diff` frame): prompt, scope chip, diff, check results, token meter, Accept, Reject, Rewrite; states asking, passing, failing (Accept disabled, findings at their lines, Rewrite sends them), over budget, locked value (Accept refused with the key named, EDS-d), a proposal touching a `never` or generated path (refused, EDS-n), no provider (no Ask button), failed (the provider's reason). `Mod+K` opens it. Accept writes once and is one undo step (EDS-f); Reject leaves the document, history and journal untouched and the tokens stay counted.
- The journal grows to §4.5's shape: each write's before and after text, and the latest run per check id with before and after measures, so a reload restores the pills and measures (EDS-z); locks are cleared on reload with a toast.
- The EDS.2a review follow-ups: the README's `wide` row no longer says the columns collapse later; "Schematic" at the 56 px rail's edge is rechecked in this PR's images.

**Out (owner):** Ship, the Review desk, Export and Import and the import undo step (EDS.2c; EDS-z's import part lands there); the level editors' `./suite` entries (EDS.2d); the Tuner and its locks UI (EDS.4a: this PR takes locks as a set of key paths the editor reports); the scene picker (EDS.2c with the interchange dialogs, or EDS.2d, whichever needs scenes first); the Node adapter's own journal file beyond the schema change (EDS.1d-b).

## Decisions made here (defaults, listed for the Owner's veto)

1. **`SuiteEditor` gains two optional hooks** (kit `./ports`, `suite-editor.ts`; a contract change in the kit, which owns it, with the suite as its first consumer): `undo?(session): SuiteUndo` (`canUndo`, `canRedo`, `undoLabel`, `redoLabel`, `undo()`, `redo()`, `subscribe`) and `ask?(session): SuiteAskTarget` (`path`, `text()`, `scope()`, `locked()` as key paths, `accept(text, summary)` applied as one step). An editor without them has no Undo or Ask in the top bar, which is not an error (the "missing optional port is the feature off" rule).
2. **The `ChangeSet` port gains `note(checks)`** and `ChangeSetSummary` gains `writes` and `checks`, so the adapter owns the whole §4.5 journal and `list()` returns it; the memory fake, its contract test and the Node adapter (`git-change-set.ts`) follow in this PR. `CHANGE_SET_JOURNAL_FORMAT` becomes `af-change-set/2`; a `/1` journal reads as one with no writes or checks (a migration in the schema file).
3. **The diff is a line diff** (`core/text-diff.ts`, Myers over lines, unified hunks with three lines of context), shown with the `before` findings at their lines; no kit diff exists to reuse (`documents/json/patch.ts` patches JSON values, not text).
4. **A proposal over budget is refused before it is shown** (`tokens > budget`), and its tokens are still spent, as ED3D.10a does.
5. **Undo is the editor's;** the suite's write path adds a journal entry per write, and the top bar's Undo asks the editor to undo then writes the result through the same path (so an undo is checked and journalled like an edit, and a moved-on file refuses it).

## Interfaces

**Consumed:** `SuitePorts`, `SuiteWorkspace`, `ChangeSet`, `ChecksRunner`, `CheckRun`, `CheckResult`, `Gates`, `GateState`, `AskProvider`, `Proposal`, `WorkspaceFile` (`editor-kit/src/ports/suite-ports.ts`); the memory fakes and contract tests (`editor-kit/src/ports/testing/`); `SuiteEditor` (`suite-editor.ts`); `createHistory` (`editor-kit/src/history/history.ts`) for the fixture editor; `EditorShell`, `Button`, `Toasts` and the kit dialog; `changeSetJournalSchema` (`editor-suite/src/core`); `Suite.svelte`, `create-suite.ts`, `boot.ts` (EDS.2a).

**Produced (`packages/editor-suite`, private, except the kit additions in decisions 1 and 2):**
- `core/text-diff.ts`: `lineDiff(before, after) → Hunk[]`, `touchedLines(hunks)`.
- `core/reopened-gates.ts`: `reopenedGates(files: WorkspaceFile[], written: string[]) → string[]` (ids, sorted).
- `core/pills-model.ts`: `changeSetPill`, `checksPill`, `gatesPill` → `{ tone, label, count, items }` for the pills and their icon form.
- `core/write-path.ts`: `createWritePath(ports, clock-free hooks) → { write(path, text, label) → WriteOutcome, undo(), redo() }`; `WriteOutcome = { written } | { refused: 'checks', findings } | { refused: 'moved', path } | { refused: 'policy', why } | { cancelled }` (the title prompt cancelled).
- `core/ask-session.ts`: `createAskSession(target, ports, budget) → { state, ask(prompt), rewrite(), accept(), reject(), drop(), subscribe }`, states `idle | asking | shown{diff, checks, tokens, refusal?} | failed{reason}`.
- `shell/SuitePills.svelte`, `shell/AskDialog.svelte`, `shell/TitlePrompt.svelte`; `Suite.svelte` wires them, Undo, Redo and the shortcuts.
- `testing/fixture-editor.ts`: a `SuiteEditor` over one TOML document with `createHistory`, `undo` and `ask` hooks and a `locked` set, for the DOM and layout tests (no shipped editor has a session yet).

## Files

| File | What |
|---|---|
| `packages/editor-kit/src/ports/suite-editor.ts` + `ports-entry.test.ts` | decision 1's optional hooks; `pnpm api-report --update` |
| `packages/editor-kit/src/ports/suite-ports.ts`, `testing/memory-change-set.ts`, `testing/change-set-contract.ts` | decision 2: `note`, `writes`, `checks`; the contract test covers them |
| `packages/editor-suite/src/core/change-set-journal.schema.ts` + test | `/2` with writes and checks; `/1` migrates |
| `packages/editor-suite/src/node/git-change-set.ts` + test | the Node adapter keeps the new fields |
| `core/text-diff.ts`, `core/reopened-gates.ts`, `core/pills-model.ts`, `core/write-path.ts`, `core/ask-session.ts` + `.test.ts` each | the models, in Node |
| `testing/fixture-editor.ts` | the fixture editor |
| `shell/SuitePills.svelte` + `.dom.test.ts` | pills, icon form, Locate, gates read only |
| `shell/AskDialog.svelte` + `.dom.test.ts` | the `ask-diff` states |
| `shell/TitlePrompt.svelte` | the first write's title |
| `shell/Suite.svelte`, `Suite.dom.test.ts`, `suite.layout.test.ts` | wiring, journeys, the §10 sizes in three browsers |
| `docs/evidence/owner-visual/2026-10-30-eds-2b/` | review images and README |
| `docs/evidence/owner-visual/2026-10-30-eds-2a/README.md` | the review nit (done in step 1) |

## Steps

Each step: the test first, run it (`pnpm --filter @mcthaydt/automata-editor-suite exec vitest run <file>`, or the kit's) and see it fail for the named reason, then the code.

- [x] 1. **Plan** (this file), and the EDS.2a README nit.
- [x] 2. **Kit contract.** Fails: `undo`/`ask` not on `SuiteEditor` (type test), the change-set contract's `note` and `writes`/`checks` cases fail on the memory fake. Then the fake, the Node adapter and the journal schema (`/1` → `/2`).
- [x] 3. **Text diff and reopened gates.** Fails: no modules. Hunks for insert, delete, change, none; CRLF kept; a gate reopened by one of two files, cleared when both are unwritten.
- [ ] 4. **Write path.** Fails: no module. EDS-g (a `before` failure writes nothing and returns the findings); a pass writes once, records, journals before and after, starts `after` checks; no change set → the title prompt, cancelled → nothing written; no port → straight to the workspace; a `never` path refused; undo writes the old text and is refused with the path when the file moved on (EDS-aa's refusal half); begin and close clear histories.
- [ ] 5. **Ask session.** Fails: no module. EDS-d (locked key → refused with the key), EDS-e (a failing `before` finding at its line, Accept off, Rewrite sends the findings), EDS-f (one write, one step, undo restores byte for byte), EDS-n (a `never` target refused), over budget refused with tokens spent, an edit while asking drops the reply, the provider failing shows its reason, no provider → no session.
- [ ] 6. **Pills model.** Fails: no module. Each pill's states from §9/§11; EDS-h (an `after` failure is red with the check and Locate, nothing undone); EDS-i (two gates reopened with decisions and links, cleared by undo); measures before and after; icon form counts.
- [ ] 7. **SuitePills and AskDialog (jsdom).** Fails: no components. Each state renders; Accept disabled with a reason; the gate pill has links and no button that records; 44 px targets checked in step 9.
- [ ] 8. **Suite wired (jsdom).** Fails: no pills in the top bar. Journeys with the fixture editor and the memory ports: edit → title → written → pills; Ask → Accept → Undo; `Mod+Z`, `Mod+Shift+Z`, `Mod+K`; EDS-z (a reload over the same memory change set restores the pills and measures; locks cleared with a toast).
- [ ] 9. **Layout.** `suite.layout.test.ts` at the §10 sizes in Chromium, WebKit and Firefox: pills in the top bar at every size, icons with counts in the short tier, the Ask dialog's Accept and Reject reachable and 48 px, no page scroll.
- [ ] 10. **Review images** (`suite-pills-*`, `ask-diff-*` at 1194×834, 834×1194, 1133×744 and phone) with a README table; gates.

## Gates

`pnpm format`; `TURBO_FORCE=true pnpm check`; kit and suite `test:unit` and `test:layout` (three browsers); `pnpm build`, `pnpm api-report --update` (the kit's `./ports` changes), `pnpm api-index` (`pnpm cheatsheet` if stale), `pnpm agent-skills`; no changeset (editor-kit and the suite are both private); `pnpm changeset status --since=origin/main` and `node tooling/release/src/check-changesets.ts`.

## Execution log

- 2026-10-30, step 1: plan drafted from spec §4.3 to §14 and ED3D.10a's controller. The EDS.2a review's README nit is fixed (`docs/evidence/owner-visual/2026-10-30-eds-2a/README.md`, the `wide` row); the "Schematic" rail check moves to this PR's images (step 10).
- 2026-10-30, step 2: failing first: `ports-entry.test.ts` (typecheck: no `SuiteUndo`, `SuiteAskTarget`, `undo`, `ask`), three new `ChangeSet` contract cases on the memory fake (3 failed, 42 passed), and `change-set-journal.schema.test.ts` (2 failed). Then the hooks on `SuiteEditor`, `ChangeSet.note`, `ChangeSetWrite`/`ChangeSetCheck`, `writes`/`checks` on `ChangeSetSummary`, the memory fake, the git adapter and the journal at `af-change-set/2` with the `/1` migration in its schema file: kit ports 50 passed, suite `core` and `git-change-set` 99 passed (the git adapter runs the same contract), both typecheck. `pnpm api-report --update` rewrote the kit and suite reports. **Deviation:** decision 2 names only `note`; a write's text reaches the journal through `record(files, writes?)`, an optional second argument (a write's path is recorded too), since `record` is where the suite already hands the adapter its writes. The EDS.1d `path` on the ChecksRunner request is not folded in: nothing in this PR needs it.
- 2026-10-30, step 3: failing first (no modules), then `core/text-diff.ts` (Myers over lines, ends kept, three lines of context; 6 cases) and `core/reopened-gates.ts` (4 cases). `reopened-gates.ts` also gives `changedPaths(writes)`: a file counts as written while its latest text differs from its text before its first write, which is how undoing every write clears a gate (EDS-i). Suite `core` 88 passed; typecheck clean.
