# ED2D.7a `level-project` repairs and the Checks view: TDD plan

- **Task:** ED2D.7a in [02](../../02-master-delivery-plan.md). [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §7 (`Profile.fix`), §8 (the Checks row), §9 (codes and the fixes they name), §12 (44 px targets), §15 G-g; mockup `checks` in `docs/design/editor-2d/`.
- **Lane:** editor-2d. **Depends on:** ED2D.4c4b (the inspector's Checks tab, merged). **Unblocks:** ED2D.7b (export is blocked while errors stand, and the Checks view is where they are fixed).
- **Status:** drafted 2026-10-31 on `claude/ed2d-7a-checks-view` from `origin/main` 6f1318b5. Owner, 2026-10-30: "Auto accept all spec and plans"; this plan is accepted once its review is done.
- **Progress:** 0 of 7 steps.

## Scope

**In:**

- **`Profile.fix` for `level-project`** (`profiles/level-project/project-fixes.ts`, `applyProjectFix(project, diagnostic)`), one returned project per finding, so the app applies it as one `History` step:
  - `remove` on `tileOutOfRange` (a tiles layer's cells or an auto layer's overrides whose tile is beyond the tileset; an objects layer's objects whose tile is) and on `cellValueUnknown` (IntGrid cells holding an undefined value): clears exactly those cells or drops those objects. Button: "Remove N stray tiles", "Remove N cells", "Remove N objects".
  - `move-inside` on `entityOutOfBounds`: clamps the instance's or object's anchor into `[0, w] × [0, h]`. Button: "Move inside".
  - `delete` on `unknownEntityDef` (new fix name on an existing code): removes the instance whose definition is gone. Button: "Delete anyway", since the instance's field values go with it.
  - A finding with no fix, an unknown fix, or a target that is gone throws `RangeError` (as `applyStageFix` does).
- **`choose-target` on `brokenRef`** is not a profile fix (`Profile.fix` takes no input): the Checks view opens a picker of the instances (and levels, for `$level`) the field's `to` allows and commits the choice through `setEntityField` as one step. `brokenRefTargets(project, diagnostic)` lists them.
- **The Checks view** (`ChecksView`, both profiles list `checks` → `ChecksView`): the diagnostics in the profile's order grouped Errors, Warnings, Info with counts; each row shows the message, the object it names (`slime-2 in moss-steps`, `Tileset terrain`) and its fix button when the profile has `fix` and the finding names one; **Locate** opens the Level view on the object (level, layer, the instance selected) for `level-project`, and for `floorfifty-stage` opens its first view. Each fix is one undo step; the list recomputes after every edit; an empty list says "No problems".
- **Locate** needs one new service: `ViewServices.locate(path)`, which `DocumentScreen` implements by switching to the profile's first view and handing it the path as `ViewProps.focus`; the Level view selects the level, layer and instance a path names (`levelFocus(project, path)`).

**Out, with owner:**

| What                                                      | Where                                       |
| --------------------------------------------------------- | ------------------------------------------- |
| Export dialog, blocking export on errors                  | ED2D.7b                                     |
| FloorFifty's Locate into its Compose/Course views by path | EDFF follow-up; Locate opens the first view |
| Choosing a ref target on the canvas                       | ED2D.6c                                     |
| WebKit iPad journeys                                      | ED2D.8                                      |

## Decisions (listed in the PR for the Owner's veto)

1. **One fix, one step:** `applyProjectFix` is pure and returns a new project; the view runs `history.apply(label, (project) => profile.fix(project, diagnostic, context))`, re-checked against the current state first so a stale finding is refused with its message and adds no step.
2. **`delete` is a new fix name** on `unknownEntityDef` (02 lists "Delete anyway"); nothing else in the checks changes.
3. **`choose-target` stays a name** the view handles itself, because a choice is an input `Profile.fix` cannot take; the profile's `fix` throws for it.
4. **`locate` and `focus`** are optional on `ViewServices`/`ViewProps`, so the existing views and their tests are untouched; a view that does not read `focus` ignores it.
5. **Grouping** keeps the profile's order inside each severity (the checks are already errors, then warnings, then info).

## Contract

```ts
// profiles/level-project/project-fixes.ts
export function applyProjectFix(
  project: Project,
  diagnostic: Diagnostic,
): Project;
export function brokenRefTargets(
  project: Project,
  diagnostic: Diagnostic,
): readonly { id: string; label: string; value: RefValue }[];

// app/checks/checks-model.ts
export function checkGroups(
  found: readonly Diagnostic[],
): readonly CheckGroup[]; // { severity, label, rows }
export function fixLabel(diagnostic: Diagnostic): string | undefined; // 'Remove 3 stray tiles', 'Move inside', …
export function objectLabel(path: string): string;

// app/level/level-focus.ts
export function levelFocus(
  project: Project,
  path: string,
): { level: string; layer?: string; item?: string } | undefined;
```

## Files

- **Create:** `profiles/level-project/project-fixes.ts` (+ test), `app/checks/checks-model.ts` (+ test), `app/checks/ChecksView.svelte`, `app/checks/CheckRow.svelte`, `app/checks/TargetDialog.svelte`, `app/checks/ChecksView.dom.test.ts`, `app/checks/checks-view.layout.test.ts`, `app/level/level-focus.ts` (+ test).
- **Modify:** `profiles/level-project/level-project.ts` (`fix`), `profiles/level-project/checks/levels.ts` (`delete` on `unknownEntityDef`, + its test), `app/views/view-props.ts` (`locate`, `focus`), `app/views/views.ts` (+ test), `app/document/DocumentScreen.svelte` (locate), `app/level/LevelView.svelte` and `level-session.ts` (start on the focus).

## Steps

1. [ ] **Fixes.** `project-fixes.test.ts`: `remove` clears exactly the stray tile cells (tiles and auto overrides), the undefined IntGrid cells and the objects beyond the tileset, and the finding is gone from `checkProject`; `move-inside` clamps an instance and an object; `delete` removes the unknown-definition instance; a missing target, no fix and `choose-target` throw `RangeError`. `level-project.ts` exposes `fix`.
2. [ ] **Targets.** `brokenRefTargets`: a door's `target` lists the instances of `door`, `checkpoint` and `player-start` across levels with their container; `$level` lists levels.
3. [ ] **Checks model.** `checkGroups`, `fixLabel` (`Remove 3 stray tiles` from the message count, `Move inside`, `Delete anyway`, `Choose target`), `objectLabel`.
4. [ ] **Focus.** `levelFocus` for an item, a layer, a level and a definition path (undefined); the Level session starts on it (level, layer, selected instance).
5. [ ] **View.** `ChecksView.dom.test.ts` mounted as the app mounts it: a seeded stray tile and an out-of-bounds slime show under Errors and Warnings with counts; "Remove 1 stray tile" and "Move inside" each make one undo step and the rows go; Locate opens the Level view with the slime selected; "Choose target" on a broken door lists targets and the pick is one step; the FloorFifty profile's Checks view lists its findings and its fixes work. `views.ts` maps `ChecksView`.
6. [ ] **Layout.** `checks-view.layout.test.ts` in Chromium, WebKit and Firefox at the eight sizes: no page scroll, rows and buttons at least 44 px, the list scrolls in its region.
7. [ ] **Review images** in `docs/evidence/owner-visual/2026-10-31-ed2d-7a-checks/` with a README.

## Gates

`pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm --filter @mcthaydt/automata-editor-2d test:parity`; `pnpm --filter @mcthaydt/automata-editor-2d build`. No changeset (editor-2d is private).

## Execution log

- 2026-10-31: plan drafted from the spec §7 to §9, 02's row and the existing checks (`levels.ts` names `remove` and `move-inside`, `links.ts` names `choose-target`; FloorFifty's `applyStageFix` is the model for the profile's `fix`).
