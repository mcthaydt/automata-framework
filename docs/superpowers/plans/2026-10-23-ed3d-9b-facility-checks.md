# ED3D.9b Facility checks (the facility file alone): TDD plan

- **Task:** ED3D.9, second part (headless). [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §5.3 flow 6 and flow 7 (checks after every committed step), §6 (World: "join invalid"), §11 (facility file invalid) and acceptance case ED3-i, second half ("joins checks re-run"). The checks of a `facility.json` that need nothing but the facility: every name a wing, phase, join or lock uses resolves, and the lists agree with each other. Pure functions over a `Facility`; no Svelte, DOM, Pixi or clock.
- **Lane:** editor-3d. **Depends on:** ED3D.9a (draft PR #178: `facility-selection.ts`, the join and lock rules in `facility-edits.ts`) and ED3D.2's `CheckResult`. Branch `claude/project-thread-39g5i1-ed3d-9b` is cut from the 9a branch, so the PR targets that branch.
- **Status:** Drafted 2026-10-23 19:40 UTC by the lane's successor thread, on the standing go-ahead to keep building while the stacks wait (hub overnight mode, bus 0850). Not reviewed; spec review (ED3D.0) is still open. The choices below are the agent's and vetoable. Steps are ticked only when their checks pass.
- **Progress:** 4 of 4 steps. Implemented and locally checked; not CI verified, not Owner accepted.

## Why this task exists

ED3D.9a's edits refuse what the facility file alone can judge, one edit at a time. A facility can also be wrong without any edit of ours: a hand-written file, a phase renamed in one list and not another, a wing moved. Spec flow 7 says the checks run after every committed step and the pill shows what is wrong; ED3-i says the joins checks re-run after a wing move. This task writes the facility's checks once, so the World view's controller (ED3D.9c) only runs them and shows `CheckResult`s the way the Plan's checks panel does.

## Sources, read at these commits

- **AF (`claude/project-thread-39g5i1-ed3d-9a`, on `main` 9514d52f):** `format/facility.schema.ts`, `checks/check.ts` (`CheckResult`, `checkResult`, `place`, `Locator`), `model/facility-edits.ts` (the side, lock and id rules this task lifts into `checks/`), `model/facility-selection.ts`, the shipped `testing/fixtures/facility.json` (recorded from The Last Light at 92e6704).
- **Data facts read from the shipped file** (what the rules must accept): a phase's `exit.to` is the *scene* of the next phase (`clinic`, `bay`, `clinic-dawn`), not a phase id; a phase's `doors` keys are lock ids and each such lock lists that phase (`all.staff` is in P0, P1 and P3); a lock with a `door` member (`p0.supply`) is listed in `doors` of its phases; a wing's `differences` keys are phases the wing runs; the P3 yard is both a room and a seen room; the street's start and end are each the side of exactly one join.

## Scope

**In:** `src/checks/facility/facility-rules.ts` (the join-side, lock and same-side rules, shared with the edits), `src/checks/facility/facility-checks.ts` (`facilityChecks`), their tests, the package entry exports, and `model/facility-edits.ts` using the shared rules (its own tests stay as they are).

**Out, with where each goes:**

| What | Where |
|---|---|
| A join's two sides line up in the world once the wings' offsets are applied; a side's `door`, `opening` or `wall` exists in the level it names; a lock's `at` exists in the level | ED3D.9b part 2. Needs the rooms' geometry from several levels and Last Light's own lint (`scripts/pipeline/facility-lib.ts`), which is not vendored; written from that source's tests once a copy is in the repo, not guessed here |
| Running the checks after each committed step, the pill, Locate in the World view | ED3D.9c (the same debounced runner shape as the Plan's checks panel, ED3D.10a) |
| A check that throws becoming an `error` result | the runner (ED3D.9c); these functions read plain arrays the schema already guaranteed and have no throwing path |

## Decisions this plan makes (each vetoable by the Owner through the Orchestrator)

1. **The rules are shared, not copied.** An edit refuses with the same sentence a check reports. The join-side, same-side and lock rules move to `checks/facility/facility-rules.ts` (layer `checks`, which `model` already imports); `facility-edits.ts` imports them. A check prefixes the member: `join clinicDoor: side a: no phase P9`.
2. **Seven results, in this order:** `facility-ids`, `facility-wings`, `facility-phases`, `facility-joins`, `facility-locks`, `facility-street` (all `error`) and `facility-notes` (`warning`: probably wrong, but the game may still run). A `CheckResult` has one severity, so the lints that are not references live in the one warning result.
3. **Severity.** An error is a name that resolves to nothing, or two lists that disagree about the same fact, or a join/lock the edits would have refused. A warning is a lint: a wing's `differences` for a phase it does not run, a room listed twice, a lock with a `door` that its phase's `doors` do not list, a street end that is the side of two joins.
4. **Locators** are World selection ids (`wing:bay`, `phase:P2`, `join:exit`, `lock:p0.cabinet`) made with `place`, so a file with a strange id still reports the problem, without a place. No `at` point: the World view frames a card, not a point. The street has no selection id, so its problems have no locator.
5. **Duplicate ids** are one problem per repeated id (`wing bay is listed 2 times`); the locator is the id's selection (both members have it).
6. **The World selection writer moves to `checks/check.ts`,** beside `sectorSelection` and `wallSelection`, because the checks name places and `checks` may not import `model`. `model/facility-selection.ts` keeps the reader (`parseFacilitySelection`), as `model/selection-ref.ts` does for levels; the public names do not change.

## Contract

```
packages/editor-3d/src/checks/facility/facility-rules.ts    joinSideProblem, sameJoinSide, lockProblem
packages/editor-3d/src/checks/facility/facility-checks.ts   facilityChecks, FacilityResults
packages/editor-3d/src/checks/check.ts                      (modified) gains facilitySelection, FacilitySelectionKind
packages/editor-3d/src/model/facility-selection.ts          (modified) keeps parseFacilitySelection only
packages/editor-3d/src/model/facility-edits.ts              (modified) imports the rules and the writer
packages/editor-3d/src/index.ts                             the public entry gains facilityChecks
```

```ts
// facility-rules.ts
/** What is wrong with one side of a join, judged from the facility alone; the sentence has no member in it. */
export function joinSideProblem(facility: Facility, side: JoinSide): string | undefined
/** True when two sides are the same place (two street ends, or one phase, room and door / opening / wall). */
export function sameJoinSide(a: JoinSide, b: JoinSide): boolean
/** What is wrong with a lock's phases and place, judged from the facility alone. */
export function lockProblem(facility: Facility, lock: FacilityLock): string | undefined

// facility-checks.ts
export type FacilityResults = readonly [ids: CheckResult, wings: CheckResult, phases: CheckResult, joins: CheckResult, locks: CheckResult, street: CheckResult, notes: CheckResult]
export function facilityChecks(facility: Facility): FacilityResults
```

## Steps

Tests use the shipped facility (`facility.json` through `facilityCodec.parse`) and, for each rule, one change to it that breaks exactly that rule: the shipped facility has no problem in any result; each seeded change has the problem named, in the result named, with the locator named, and nothing else.

- [x] **1. The shared rules** (`checks/facility/facility-rules.test.ts`; `checks/facility/facility-rules.ts`; `model/facility-edits.ts` imports them).
  - *Red, by case:* `joinSideProblem`: a street side is fine; no phase `P9`; a room the phase does not list (`phase P3 has no room attic`); the P3 yard (a room and a seen room) is fine; a wall that is not a whole number from 0; a door or an opening with no name, spaces only included; a door, an opening and a wall of the shipped rooms are fine. `sameJoinSide`: two street starts are the same, a start and an end are not; one phase and room with the same wall, door or opening are the same; a different wall, door name, opening name, room or phase is not; a door and an opening of one name are not. `lockProblem`: no phase, a missing phase (the first one named), a blank place, an empty list, a list with a blank entry; the shipped locks are fine.
  - *Expected failure:* the module is missing.
  - *Done:* 2026-10-23. `facility-rules.ts` (`joinSideProblem`, `sameJoinSide`, `lockProblem`; 22 tests), the edits import it (their 32 tests unchanged and green). The World selection writer moved to `checks/check.ts` (decision 6), and `testing/shipped-facility.ts` holds the shipped facility for the new tests. Hand mutation: 29 runs, then the 6 key mutants again after the pairs test was made to vary the phase and the room for each kind of side; all killed.
- [x] **2. `facility-ids`, `facility-wings`, `facility-phases`** (`checks/facility/facility-checks.test.ts`; `checks/facility/facility-checks.ts`).
  - *Red, by case:* the shipped facility is `ok` in every result. Ids: a wing, join, phase or lock id used twice or more (`wing bay is listed 2 times`), two phases that run one scene (`scene clinic is run by 2 phases: P0, P1`). Wings: runs a phase the facility does not have; its reference is not one of its phases (`wing clinic's reference phase P2 is not one of its phases`); lists a phase that runs in another wing (`wing clinic lists phase P2, which runs in wing bay`). Phases: runs in a wing the facility does not have; is not listed by its own wing; sees a room that is not one of its rooms; leaves for a scene no phase runs (a phase with `exit: null` is fine); names in `doors` a lock the facility does not have; names in `doors` a lock that is not a lock of that phase. Each problem has the locator of the member it is about; an id that cannot be a selection id (`a:b`) gives the problem with no locator.
  - *Expected failure:* `facilityChecks` is missing.
  - *Done:* 2026-10-23. `facilityChecks` with the first three results real and the other four empty until step 3. 25 tests passed on the first run of the implementation, since the seeded cases name every problem in every result. Hand mutation: 32 runs, 4 that were SKIPped for formatting rerun, 4 flip-the-condition mutants added; all killed.
- [x] **3. `facility-joins`, `facility-locks`, `facility-street`, `facility-notes`** (the same files).
  - *Red, by case:* joins: a join with a bad side is reported as `join exit: side a: no phase P9` (and `side b`), a join of two equal sides as `join exit: a join needs two different sides`; locks: `lock p0.cabinet: a lock needs at least one phase`, `no phase P9`, `a lock needs a place: ...`; street: a path of fewer than two points, a clearance that is not more than 0 (no locator); notes (severity `warning`): a wing's `differences` for a phase it does not run, a room listed twice in a phase, a lock with a `door` that a phase of it does not list in `doors`, a street end that is the side of two joins, on either side of either join (`the street start is the side of 2 joins: shutter, second`; the locator is the first join and `related` holds the others).
  - *Expected failure:* the results are `ok` for every broken case.
  - *Done:* 2026-10-23. The other four results. 42 tests in `facility-checks.test.ts` in all. Hand mutation: 39 runs; 5 survivors (a join that is both wrong and the same on both sides, a path of exactly two points, a lock with a door on a phase that does not exist, the street's end and either side of a join) each got a test and were killed on the rerun. One test found a real bug while it was being written: `lock.id in phase.doors` took a lock called `constructor` for a listed door, so it is `Object.hasOwn` now.
- [x] **4. Entry, ED3-i, gates and records.**
  - *Red, by case:* `facilityChecks` is exported from the package entry (asserted in `index.test.ts`); **ED3-i, second half, what the file can say:** after each edit the 9a tests accept (move the bay by 0.5 m, add a join, replace a join, remove a join, add and replace a lock) `facilityChecks` of the new facility has no error and no warning the shipped facility did not have, so the edits and the checks agree.
  - *Run in order:* `pnpm format`, `pnpm docs:stack`, `pnpm check`, `pnpm build`, `pnpm api-index`, `pnpm cheatsheet`, `pnpm agent-skills --write` then `pnpm agent-skills`, `pnpm api-report`; hand mutation over each step's logic, listed on its step; `purity.test.ts` holds for `checks`.
  - *Records:* master plan (02), continuation prompt (03) and the spec's task table in the docs follow-up PR once the lines merge; nothing ticked in 02 from this PR.
  - *Done:* 2026-10-23. `facilityChecks` and `FacilityResults` are exported (asserted in `index.test.ts`; the three rules and `shippedFacility` asserted internal). `model/facility-edits-checks.test.ts` (3 tests): after each of eight edits the 9a tests accept, the checks have nothing to report, and each refused join and lock, put into the file anyway, is reported with the edit's own sentence prefixed by the member. Locally on Node 24.21, from the worktree root: `pnpm format`, `pnpm docs:stack`, `pnpm check` (35 tasks), `pnpm build`, `pnpm api-index` (0 undocumented), `pnpm cheatsheet`, `pnpm agent-skills --write` then plain (current), `pnpm api-report` (0 breaks, 0 undeclared; editor-3d is private, so no changeset and nothing generated changed); the editor-3d suite is 1,062 tests in 57 files; `purity.test.ts` holds for `checks`. Not CI verified (CI runs on the Owner's Macs), not Owner accepted.

## Mutations

Hand mutation per step with `mutate.py` (`/mnt/project-files/ed3d/mutate.py`), run from `packages/editor-3d`, the module's own test file as the filter (`facility-rules.ts` with its tests and the edits' tests).

| Step | Target | Runs | Result |
|---|---|---|---|
| 1 | `facility-rules.ts` | 29, then 6 again | all killed (the first run left one: a side key without the phase, for the opening) |
| 2 | `facility-checks.ts` (ids, wings, phases) | 32 + 4 + 4 | all killed |
| 3 | `facility-checks.ts` (joins, locks, street, notes) | 39, then 5 again | all killed after tests for the 5 survivors |

No equivalent survivor is left in this task.

## Verification

Local, Node 24: the package's tests and `pnpm check`. No browser or GPU suite is selected (no DOM, no painting, no sim code).

## Risks

| Risk | Mitigation |
|---|---|
| A rule here rejects a facility the game accepts (the sentences are ours, not Last Light's lint) | the shipped file passes every result (step 2 first case); the data facts above are read from it, and the one rule it cannot show (an `exit.to` that is a scene, not a phase id) is a decision the Owner can veto; the lints that are not references are warnings |
| The edits and the checks drift apart | decision 1: one module holds the rules; step 4 runs the checks over every result the 9a edits accept |
| The alignment lint is left undone for good | stated as ED3D.9b part 2 above and in the 9a plan; the bus note says so, so the hub can send the source |
