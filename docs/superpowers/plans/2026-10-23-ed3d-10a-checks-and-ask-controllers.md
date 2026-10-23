# ED3D.10a Checks panel and Ask controllers, and the three ports: TDD plan

- **Task:** ED3D.10, first part (headless). [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §4.4 (ports), §5.3 flow 7 (Check) and flow 8 (Ask), §7 (the checks and the Locate action), §9 (the checks pill) and acceptance case ED3-j. The types of the `ChangeSet`, `Generator` and `AskProvider` ports, a checks-panel controller (debounced runs after committed steps, the pill's counts, Locate) and an Ask controller (a proposal applied to a copy, its check results, Accept disabled while it has errors). Plain TypeScript: no Svelte, DOM, Pixi or clock.
- **Lane:** editor-3d. **Depends on:** ED3D.2 (merged: `checks`), ED3D.3 (merged: `LevelEditor`, `Edit`, `ViewStore`) and the kit's `History` and `Selection` (merged). It does not wait on the view stack: nothing here touches the Plan view, a tool or a pointer. Branch `claude/project-thread-39g5i1-ed3d-10a` is cut from `main` (9514d52f), so the PR targets `main`.
- **Status:** Drafted 2026-10-23 18:50 UTC by the lane's successor thread, on the standing go-ahead to keep building while the stacks wait (hub overnight mode, bus 0850). Not reviewed; spec review (ED3D.0) is still open. The choices below are the agent's and vetoable. Steps are ticked only when their checks pass.
- **Progress:** 3 of 6 steps.

## Why this task exists

Two pieces of the editor are about what the level *says* rather than what a tool does to it: the problems list (flow 7) and the Ask (flow 8). Both have rules that are easy to get subtly wrong in a Svelte component: when the checks run (after a committed step, not on every pointer move of a drag), what the pill counts, what Locate does with a problem whose room has since gone, and, for the Ask, that a proposal applies to a *copy*, that Accept is off while the copy has errors, and that a proposal made for a level the person has since edited must not be accepted over their edits. This task puts those rules in two small controllers with tests, so the panel (ED3D.10b, on the Svelte shell of ED3D.5b) only paints them.

## Sources, read at these commits

- **AF (`main` at 9514d52f):** `checks/check.ts` (`CheckResult`, `Problem`, `Locator`, `Severity`), `profile/level-profile.ts` (`checks(doc, context)`, `geometry`, `sectors`; `parse` from `FileCodec`), `model/level-editor.ts` (`run`, `begin`, `level`, `history`, `selection`, `view`), `model/edit.ts` (`Edit`, `ok`, `refuse`), `model/selection-ref.ts` (`parseSelection`), `model/view-store.ts` (`camera`), the kit's `history/history.ts` (`revision` moves on apply, undo, redo and commit, and not on a transaction's live updates) and `selection/selection.ts`.
- **Spec:** §4.4 for the port shapes, §5.3 flows 7 and 8, §7's last paragraph ("run by the game" rows and the generate command stay with the panel, ED3D.10b).

## Scope

**In:** `src/ports/ports.ts` (types), `src/app/checks-panel-controller.ts`, `src/app/ask-controller.ts` and their tests, `src/testing/fake-ask.ts` (a scripted provider for the tests), the purity test's layer list gains `ports` and `app`, the package entry exports them.

**Out, with where each goes:**

| What | Where |
|---|---|
| The checks pill, the problems list, the Locate buttons, the "run by the game" rows and the generate command | ED3D.10b (Svelte, on ED3D.5b's shell) |
| Painting the ghost on the plan (an overlay of the proposal's geometry in the tint of its change) | ED3D.5b / ED3D.10b: a view concern. The controller hands over the proposal's geometry and which sectors changed |
| Using `ChangeSet` and `Generator`: recording the saved files on the branch, running the generate command after a save | ED3D.10b with the Save and Ship flow (§5.3 flow 9). Here they are types only, so the Ask and the save flow share one definition |
| A real `AskProvider`, a prompt history, streaming a proposal, several proposals to choose from | not asked for. AF ships no provider (spec §4.4); the Last Light server brings its own |
| Checks of `facility.json` (the World view) | ED3D.9, which adds its own results to the same list |
| Running the checks off the main thread | not needed at the size of a level; the debounce keeps them off the pointer path (flow 7) |

## Decisions this plan makes (each vetoable by the Owner through the Orchestrator)

1. **Ports are types in `src/ports/ports.ts`, and AF ships none.** A missing port is "feature off" and never an error (spec §4.4): the Ask controller's `available` is false without a provider and `ask` does nothing. `ChangeSet` and `Generator` are the spec's, unchanged.
2. **`AskProvider.propose` gets the level it must change.** The spec's three arguments (`prompt`, `scope`, `budget`) are kept, in that order, with a fourth, `document`: the live level printed as JSON. Without it a provider reading the file on disk would propose against the last save, and accepting would then replace the person's unsaved edits. `scope` is the selection's ids (`readonly string[]`, data a provider across a process boundary can carry) and not the kit's `Selection` object.
3. **A `Proposal` is `{ summary, text, tokens }`.** `text` is the whole level as the file would read after the change; the editor reads it with the profile's own codec, so a proposal gets exactly the schema checks a file gets and there is no second diff language. The diff the person judges is the ghost's: which sectors were added, changed and removed, and the check results. A `text` the codec refuses is a failed ask that says why (the first issue's path and message). `tokens` over the budget is a failed ask, and a proposal that changes nothing is one too.
4. **The checks run on committed levels, after a pause.** The panel runs once when it is made, and again `delayMs` (default 250) after the history's `revision` moves (an edit, an undo, a redo, a commit): not on a transaction's live updates, so a drag does not run them. The run reads the level as it was at that step, not the live one, so the pill never describes a drag in flight. Another step before the pause ends restarts it. The timer is injected (`schedule(delayMs, run)` returning a way to cancel it): the app layer owns no clock.
5. **The pill counts problems, not checks.** `errors` is the number of problems in failing checks of severity `error`, `warnings` likewise; `pending` is true while a run waits for the pause, so the panel can dim numbers that describe an earlier step.
6. **Locate selects and centres.** It replaces the selection with the locator's id and moves the plan camera's centre to the locator's point (else the middle of the sector, or of the wall, the id names), keeping the zoom and the mode. A locator whose room or wall is gone from the level (the result is one step old) is refused with a sentence and changes nothing. An entity locator is selected, and framed only when it carries a point (the entity model arrives with ED3D.7).
7. **One Ask at a time; the ghost dies with the level it was made for.** `ask` while a request is out does nothing. A proposal that arrives after `reject` is ignored. A ghost is dropped, with a sentence, when the level changes under it (an edit, an undo, a redo), and a proposal that arrives for a level that has since changed is dropped the same way: Accept can never apply over edits the proposal did not see.
8. **Accept is disabled while the ghost has check errors** (spec flow 8, ED3-j): `canAccept` is false, and `accept()` refuses with the first error's sentence. A warning does not disable it. Accept is one `editor.run` of one edit labelled `Ask: <summary>`, so it is one undo step and refuses while another step is open.
9. **The ghost carries its own geometry,** built once with the profile (`undefined` when the profile cannot build the proposal; the `expand` check says why), so the painter has nothing to catch.

## Contract

```
packages/editor-3d/src/ports/ports.ts                    ChangeSet, Generator, AskProvider, Proposal
packages/editor-3d/src/app/checks-panel-controller.ts    createChecksPanel, ChecksPanel, ChecksPanelView, ChecksPanelOptions, Scheduler, LocateResult
packages/editor-3d/src/app/ask-controller.ts             createAsk, Ask, AskView, AskGhost, AskOptions, AcceptResult
packages/editor-3d/src/testing/fake-ask.ts               fakeAskProvider (tests only)
packages/editor-3d/src/index.ts                          the public entry gains all of these
```

```ts
// ports.ts
export interface ChangeSet {
  current(): Promise<{ title: string; branch: string } | undefined>
  begin(title: string): Promise<void>
  record(files: string[]): Promise<void>
}
export interface Generator { command: string; run(): Promise<{ ok: boolean; log: string }> }
export interface Proposal {
  /** One sentence for the person: what the change does. It is the undo label's text. */
  readonly summary: string
  /** The whole level as the file would read after the change. */
  readonly text: string
  /** The tokens the proposal used. */
  readonly tokens: number
}
export interface AskProvider {
  propose(prompt: string, scope: readonly string[], budget: number, document: string): Promise<Proposal>
}

// checks-panel-controller.ts
/** Calls `run` after `delayMs`; the returned function cancels the call. */
export type Scheduler = (delayMs: number, run: () => void) => () => void
export interface ChecksPanelOptions {
  readonly schedule: Scheduler
  readonly delayMs?: number | undefined          // 250
  readonly context?: ProfileContext | undefined   // what the profile's checks may be told (Last Light's puzzle hotspots)
}
export interface ChecksPanelView {
  readonly results: readonly CheckResult[]
  readonly errors: number
  readonly warnings: number
  readonly pending: boolean
}
export type LocateResult = { readonly ok: true } | { readonly ok: false; readonly reason: string }
export interface ChecksPanel {
  readonly view: ChecksPanelView
  subscribe(run: () => void): () => void
  /** Runs the checks now, on the level as last committed, and drops the run that was waiting. */
  run(): void
  locate(place: Locator | undefined): LocateResult
  dispose(): void
}
export function createChecksPanel<D>(editor: LevelEditor<D>, options: ChecksPanelOptions): ChecksPanel

// ask-controller.ts
export interface AskOptions {
  readonly provider?: AskProvider | undefined
  /** The tokens a proposal may use; it goes to the provider and a proposal over it is refused. */
  readonly budget: number
  readonly context?: ProfileContext | undefined
}
export interface AskGhost<D> {
  readonly summary: string
  readonly tokens: number
  readonly level: D
  readonly geometry: Geometry | undefined
  readonly sectors: { readonly added: readonly string[]; readonly changed: readonly string[]; readonly removed: readonly string[] }
  readonly checks: readonly CheckResult[]
  readonly errors: number
  readonly warnings: number
  readonly canAccept: boolean
}
export interface AskView<D> {
  readonly available: boolean
  readonly status: 'idle' | 'asking' | 'ghost' | 'failed'
  /** The prompt of the request in flight, the ghost, or the failure. */
  readonly prompt: string | undefined
  readonly ghost: AskGhost<D> | undefined
  /** Why a request ended with nothing to show (status `failed`). */
  readonly message: string | undefined
}
export type AcceptResult = { readonly ok: true } | { readonly ok: false; readonly reason: string }
export interface Ask<D> {
  readonly view: AskView<D>
  subscribe(run: () => void): () => void
  ask(prompt: string): Promise<void>
  accept(): AcceptResult
  /** Drops the ghost or the failure, or stops waiting for a proposal; one that arrives later is ignored. */
  reject(): void
  dispose(): void
}
export function createAsk<D>(editor: LevelEditor<D>, options: AskOptions): Ask<D>
```

## Steps

Tests use the depot (`depot.af-sector`: the hall from (0, 0) to (8, 6) and the dock from (8, 0) to (14, 6), joined by a portal along x = 8) and the Last Light toy level for what that profile says. A *broken* depot has the hall's ceiling below its floor (the `heights` check fails and locates `sector:hall`). A fake scheduler keeps its calls and runs them on `flush()`; the fake provider answers with a script and records what it was asked.

- [x] **1. The ports and the purity guard** (`purity.test.ts`; `ports/ports.ts`).
  - *Red, by case:* the purity test's layer list gains `ports`; `testing/fake-ask.ts` builds a provider typed as `AskProvider` that records `prompt`, `scope`, `budget` and `document` and answers with a scripted `Proposal`, a rejection or a pending promise the test settles itself.
  - *Expected failure:* the purity case for `src/ports` fails (the directory is missing); the fake does not compile (`AskProvider` is not exported).
  - *Done 2026-10-23:* red as expected (the purity case for `src/ports` found no files; `tsc` could not find `../ports/ports`), then green: `ports/ports.ts` holds the spec's `ChangeSet` and `Generator` unchanged and `AskProvider.propose(prompt, scope, budget, document)` with `Proposal { summary, text, tokens }`; `testing/fake-ask.ts` has `fakeAskProvider(respond)` (records `prompt`, `scope`, `budget` and `document`; a throw in the script is a provider that throws) and `deferred()`. Deviation: none.
- [x] **2. The checks panel runs after committed steps** (`app/checks-panel-controller.test.ts`; `app/checks-panel-controller.ts`).
  - *Red, by case:* the view at creation holds the profile's own results for the level (`afSectorProfile.checks(depot)`), `pending` false, the counts of the broken depot (one `heights` problem is one error); a committed `editor.run` sets `pending` and schedules one run with the default delay (250) and with `delayMs`; the results stay those of the earlier step until the run fires, then they are the new step's and `pending` is false; a second step before the pause cancels the first call and runs once, on the latest level; a session's live runs schedule nothing, its commit schedules one, its cancel none; an undo and a redo schedule a run; a step that leaves the level as it was schedules nothing; `run()` runs now on the level as last committed (a session's live level is not read), drops the waiting call and clears `pending`; warnings count apart from errors and a passing check counts nothing (a profile that returns scripted results); the context option reaches the profile's `checks`; subscribers are told when `pending` flips and when the results change, and not when nothing did; `dispose` cancels the waiting call, stops following the editor and tells nobody after.
  - *Expected failure:* the module is missing.
  - *Done 2026-10-23:* red (the module is missing), then green on the first run (18 tests). `createChecksPanel(editor, { schedule, delayMs?, context? })` reads the level as the history's `revision` last moved (`committed`), so a drag's live updates never reach it; a revision that moves drops the waiting call, schedules one and shows the earlier results as `pending`; the call refreshes, `run()` refreshes now; the view is the same object, and nobody is told, when nothing differs; the counts are problems by severity. Deviation: none.
- [x] **3. Locate** (the same files).
  - *Red, by case:* a sector locator selects it and centres the plan camera on the middle of its corners, keeping zoom, mode and layer; a wall locator centres on the wall's midpoint (the last wall of the outline closes on the first corner); a locator with a point centres on the point whatever the id names; an entity locator is selected and the camera stays when it has no point and moves when it has; a sector that is no longer in the level is refused with `dock is not in the level any more` (a wall of it the same), a corner past the end of the outline with `wall 9 of hall is not in the level any more`, and the selection and camera stay; no locator is refused with `that problem has no place in the level`; an id that is no selection id is refused naming it; the locators of the two real `heights` problems on the broken depot locate the hall and the portal wall end to end.
  - *Expected failure:* `locate` is not a function.
  - *Done 2026-10-23:* red (8 cases, `locate` is not a function), then green (27 tests in the file in the end, `tsc` and biome clean, the purity test holds for `app` too, which the list now names). `locate(place)` parses the selection id with `parseSelection`, finds the sector in `profile.sectors.list(editor.level)`, centres on the locator's point else on the middle of the box around the sector's corners or the two corners of the wall (the last wall closes on corner 0), selects the id and moves only the camera's `x` and `z`. An entity id is selected and framed by its point alone. Deviation: none.
- [ ] **4. The Ask makes a ghost** (`app/ask-controller.test.ts`; `app/ask-controller.ts`).
  - *Red, by case:* without a provider `available` is false and `ask` calls nothing and changes nothing; with one the view starts `idle`, available; `ask` goes `asking` at once with the prompt, then to `ghost` when the proposal arrives; the provider is given the trimmed prompt, the selection's ids as they were, the budget and the live level printed as JSON; the ghost holds the summary, the tokens, the proposal's level (parsed by the profile), the sectors added, changed and removed by id (a moved corner is `changed`; a dock dropped is `removed`; a new room `added`), the proposal's check results with the counts, its geometry, and `canAccept`; a proposal whose checks fail (the hall's ceiling below its floor) has `canAccept` false and `errors` 1; a proposal with only warnings can be accepted (a profile that returns scripted results); a second `ask` while one is out calls the provider once; an empty prompt fails with `say what you want changed` without calling the provider; a provider that rejects, with an `Error` or with a string, fails with `the assistant failed: <message>`; tokens over the budget fail with the numbers; a `text` that is not JSON, and one the schema refuses (a sector with no id), fail with the codec's first issue and its path; a proposal that is the level as it stands fails with `the proposal changes nothing`; the Last Light toy level through its own profile; a profile that cannot build the proposal has `geometry` undefined and still a ghost.
  - *Expected failure:* the module is missing.
  - *Done:*
- [ ] **5. Accept, reject and the stale ghost** (the same files).
  - *Red, by case:* `accept` applies the proposal as one undo step labelled `Ask: <summary>` (one `undo` restores the level and the label shows in `undoLabel`), clears the ghost and goes `idle`; `accept` with errors refuses with the first error's sentence, changes nothing and keeps the ghost; `accept` with no ghost refuses; `accept` while another step is open refuses with the history's sentence and keeps the ghost; `reject` drops a ghost, dismisses a failure and, while a request is out, returns to `idle` and ignores the proposal that arrives later (the ghost never appears, subscribers hear nothing more); an `ask` after a `reject` works; a new `ask` replaces a ghost; an edit, an undo and a redo of the level while the ghost shows drop it, to `failed` with `the level changed, so the proposal no longer applies; ask again`; a proposal that arrives after the level changed fails the same way; the accept's own change does not drop anything; `dispose` stops following the editor, ignores a late proposal and tells nobody after.
  - *Expected failure:* `accept` and `reject` are not functions.
  - *Done:*
- [ ] **6. Entry, gates and records.**
  - *Run in order:* the package entry exports the ports' types, both controllers and their views (asserted in `index.test.ts`, with the fake provider staying out); `pnpm format`, `pnpm docs:stack`, `pnpm check`, `pnpm build`, `pnpm api-index`, `pnpm cheatsheet`, `pnpm agent-skills --write` then `pnpm agent-skills`, `pnpm api-report`; hand mutation over each step's logic, listed on its step; `purity.test.ts` holds for `ports` and `app`.
  - *Records:* master plan (02), continuation prompt (03) and the spec's task table in the docs follow-up PR once the lines merge; nothing ticked in 02 from this PR.
  - *Done:*

## Mutations

Hand mutation per step with `mutate.py` (`/mnt/project-files/ed3d/mutate.py`), run from `packages/editor-3d`, the controller's own test file as the filter. To be listed when the steps are done.

## Verification

Local, Node 24: the package's tests and `pnpm check`. No browser or GPU suite is selected (no DOM, no painting, no sim code). Whether the debounce feels right on a drag of a large level, and whether Accept's refusal sentence is clear to a person, are judged on the built editor (ED3D.11, ED3D.12).

## Risks

| Risk | Mitigation |
|---|---|
| Accepting a proposal replaces edits the person made after asking | decision 7: the ghost is dropped when the level changes, the proposal is made against the live level (decision 2), and Accept is one undo step |
| The checks pill describes a half-made drag | decision 4: only committed levels are checked, tested for a session's live runs |
| A late answer shows a ghost after the person gave up | decision 7: a request counter, tested with a promise the test settles after `reject` and after `dispose` |
| The provider port is shaped for a server that does not exist yet | the port is a type with a fake; the Last Light server adapts to it, and the one reversible choice (decision 2, the `document` argument) is the only departure from the spec's sketch |
| A pull request from `main` and the view stack both edit `index.ts` and the purity list | the edits are one export block and one list line each; the merge-up resolves them by keeping both |
