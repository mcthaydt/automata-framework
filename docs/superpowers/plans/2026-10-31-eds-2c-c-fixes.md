# EDS.2c-c Touch targets, the toast and count agreement: TDD plan

- **Task:** EDS.2c-c in [02](../../02-master-delivery-plan.md) (row added by #302). The follow-ups recorded on #290 (EDS.2c-b) by the coordinator's visual acceptance, the #275 toast follow-up, and the "1 cell use tiles" grammar fix in the 2D editor's checks. [Editor suite spec](../specs/2026-10-30-editor-suite-design.md) §9 (`review-desk`, `interchange`), §10 (sizes, 44 px targets); [editor kit spec](../specs/2026-10-23-editor-kit-design.md) §4.6 (toasts); AGENTS.md "Responsive UI".
- **Lane:** editors. **Depends on:** EDS.2c-b (#290, merged). **Unblocks:** nothing directly; clears the EDS.2c review notes.
- **Status:** Drafted 2026-10-31. Accepted under the Owner's "Auto accept all spec and plans" (2026-10-30) once reviewed.
- **Progress:** 5 of 6 steps.

## Scope

**In:**

1. Import's file chooser: the browser's native "Choose File" control is under 44 px. It becomes a kit `Button` ("Choose a file") that opens a visually hidden `<input type="file">`.
2. The Review desk's gate links ("Feel record", "Speed record") are text links under 44 px, and on a phone they wrap onto their own line with uneven spacing between gates. Each gate becomes one row (name and state, then the link) that wraps as a unit, with the link a kit-sized 44 px control and one gap between rows.
3. The toast covers the bottom rail on a phone (#275). The kit's `EditorShell` measures its foot (the tab bar and the status line) and hands it to its `sheets` as `--shell-foot`; `ToastRegion` sits that far above the bottom. The suite renders its toasts through `sheets`, so they clear the rail. Every editor that puts its toasts in `sheets` gets the same.
4. Count agreement in the 2D editor's checks: "1 cell use tiles", "1 cell hold a value", "1 object use tiles" become "uses", "holds", "uses" for one.

**Out:** other toast placement (the keyboard; the toast already sits in the layout viewport); the editors' own Home screens (they already use `sheets`; any change they see is the lift above their status line, covered by the kit test).

## Interfaces

**Consumed:** `EditorShell` (`sheets`, `status`, `rail`), `ToastRegion`, `createToasts`, `Button` from `@mcthaydt/automata-editor-kit`; `plural` from `editor-2d/.../checks/diagnostics.ts`.

**Produced (all private packages; no published API changes):**

- `EditorShell`: its `sheets` render inside a `display: contents` wrapper carrying `--shell-foot` (px): the tab bar's height when the rail is a tab bar, plus the status line's height. 0 px when neither is at the foot.
- `ToastRegion`: `bottom: calc(max(var(--space-4), safe-area-bottom) + var(--shell-foot, 0px))`. Outside a shell it sits where it did.
- `ShellFixture`: an optional `toast` prop that shows one toast through `sheets` (testing only).
- `diagnostics.ts`: `agree(count, one, many): string`, the verb for a count.

## Steps

Each step: write the test, run it and see it fail for the stated reason, make the minimal change, see it pass.

- [x] **1. This plan.** Committed first.
- [x] **2. Count agreement.** `levels.test.ts`: a 1-cell tiles case expecting `/1 cell uses tiles/`, a 1-cell IntGrid case expecting `/1 cell holds a value/`, a 1-object case expecting `/1 object uses tiles/`, and the existing 2-cell case tightened to `/2 cells use tiles/`. Fails: "1 cell use tiles". Fix: `agree()` in `diagnostics.ts`, used by the three messages in `levels.ts`.
  `pnpm --filter @mcthaydt/automata-editor-2d exec vitest run src/profiles/level-project/checks/levels.test.ts`
- [x] **3. The file chooser.** `InterchangeDialog.dom.test.ts`: in Import, a "Choose a file" button exists; clicking it clicks the hidden file input; a chosen file fills "Document to import". Fails: no such button. `suite-ship.layout.test.ts`: the "Choose a file" button is at least 44 px tall and wide at every §10 size. Fix: the hidden input and a kit `Button`.
  `pnpm --filter @mcthaydt/automata-editor-suite exec vitest run src/shell/InterchangeDialog.dom.test.ts` and the layout project for `suite-ship.layout.test.ts`.
- [x] **4. The gate rows.** `suite-ship.layout.test.ts`: in the Review desk, each gate's record link is at least 44 px tall and wide, and the space between consecutive gate rows is the same. Fails on the link width or the spacing at phone sizes (recorded in the log). Fix: each gate `li` is a wrapping flex row with one gap; the link is a 44 px bordered control.
- [x] **5. The toast clears the foot.** `editor-shell.layout.test.ts`: with a toast shown through `sheets`, at every size the toast's bottom is at or above the top of the tab bar (compact, medium) and of the status line. Fails at phone sizes: the toast overlaps the tab bar. Fix: `--shell-foot` in `EditorShell`, the lift in `ToastRegion`. Then `suite.layout.test.ts` (or `suite-ship`): the suite's toast at phone portrait does not overlap the rail. Fails: the suite renders `ToastRegion` outside `sheets`. Fix: move it into `sheets`.
  `pnpm --filter @mcthaydt/automata-editor-kit exec vitest run --project layout src/shell/editor-shell.layout.test.ts` .
- [ ] **6. Gates and review images.** Review images for the changed screens in `docs/evidence/owner-visual/2026-10-31-eds-2c-c/` with a README.

## Gates

- `pnpm format`; `TURBO_FORCE=true pnpm check`.
- `test:layout` for editor-kit and editor-suite (Chromium, WebKit, Firefox); `test:parity` for editor-kit, editor-2d, editor-suite (the kit's shell CSS is shared by every editor).
- No published package changes: no changeset, no api-report change expected (`pnpm api-report` confirms).

## Execution log

- 2026-10-31: plan drafted from the #290 visual-acceptance comment and the previous lane's handoff.
- Step 2: the three new expectations failed with the old wording ("1 cell use tiles", "1 object use tiles", "1 cell hold a value"); with `agree()` the checks folder passes 57 of 57.
- Step 3: the DOM test failed with no "Choose a file" button; passes with a kit `Button` that clicks a visually hidden `<input type="file">` (kept in the page, `tabindex=-1`, `aria-hidden`, so the button is the one control). The layout check (44 px at every §10 size) was added with the fix and passes in Chromium, WebKit and Firefox.
- Step 4: with `data-gate` on each row, the layout check failed at every size and in every browser on the gap between gate rows (0 px; the rows touched). The record links already measured 44 px tall (an `inline-flex` with `min-height`), but read as a line of text; they are now bordered 44 px controls like the kit's plain button. `suite-ship.layout.test.ts` passes 72 of 72.
- Step 5: the kit's new check failed at all 8 sizes in all 3 browsers (wide: the toast over the status line, e.g. 818 > 806.5 at iPad Pro 11 landscape; medium and compact: over the tab bar). `EditorShell` measures the tab bar's and the status line's heights with a `ResizeObserver` (a first try with `bind:offsetHeight` broke every jsdom test that mounts the shell, as jsdom has no `ResizeObserver`; the observer is now skipped when there is none, and the kit's unit tests pass 1336 of 1336) and hands their sum to `sheets` as `--shell-foot` through a `display: contents` wrapper; `ToastRegion` adds it to its bottom. 24 of 24 pass. The suite's check then failed at the 4 tablet-portrait and phone sizes (1178 > 1130.5 at iPad Pro 11 portrait; 374 > 326.5 at phone landscape) because the suite drew `ToastRegion` outside the shell; moved into `sheets`, `suite-ship.layout.test.ts` passes 96 of 96. Deviation: the wide case also lifts the toast above a status line, which the plan named; the editors' own screens (editor-2d, editor-3d, the kit's Home) already put their toasts in `sheets` and get the same lift.
- Step 5, knock-on: editor-3d's `boot.dom.test.ts` journey (ED3D.5d) failed ("renderer called 0 times") because its `ResizeObserver` stub kept only the last observer it was given, which became the shell's. The stub now runs every observer it was given, like a real one; the assertion is unchanged and passes (6 of 6). In the affected-packages unit run, editor-2d's `TilesetsView.dom.test.ts` "shows every tile, toggles the selection and makes a tag of it" failed once at 6048 ms under load (the timing the coordinator noted); alone it passes 9 of 9, twice.
