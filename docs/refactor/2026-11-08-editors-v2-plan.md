# Editors v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (no
> subagents in this project). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every non-3D editor screen is drawn as the approved editors v2 mockup, the editors open in the dark look, and
Publish is the only lime button, with every feature and every touch target kept.

**Architecture:** The colours and sizes change in one place (`tool-theme.json` and `tool-chrome.css`), with dark as the
CSS default. The shell gains an inset panel and three layouts; ten kit parts (sidebar, breadcrumb header, rows and
fields, block, floating toolbar, sheet, tab bar, empty state, status line, editor icons) replace the editors' own boxes
and bars; then each screen moves onto the parts. No feature, file format or sim code changes.

**Tech Stack:** TypeScript, Svelte 5 runes, Vitest (jsdom, Testing Library, browser mode), Playwright journeys, axe-core,
PixiJS 8 (untouched).

**Spec:** [`2026-11-08-editors-v2-spec.md`](2026-11-08-editors-v2-spec.md). Design note:
[`docs/design/editors-v2/PATTERNS.md`](../design/editors-v2/PATTERNS.md). Mockup and pictures:
`/mnt/project-files/refactor/2026-11-06-redesign-mockups/editors-v2/`, `shots-editors-v2/`, `boards-editors-v2/`.

**Base:** the newest head of the shared-editors build (stacked on PR #512's plan, built on PR #508), with PR #506's
branch `claude/project-thread-6mtkk6` merged in by Task 1. Paths were read on #508 at `89db7336` and #506 at
`30667aa3`; where the shared-editors build has moved a file, follow it.

## Global Constraints

- The framework's laws and `AGENTS.md` hold: test first, feature folders, tests in `tests/` importing `#src/…`,
  kebab-case files with role suffixes, at most 600 lines a file (`EditorShell.svelte` is 332 lines on #508; Task 4
  moves its region sheets into `shell-sheets.svelte` so Task 8 can change them alone), comments say why and never name
  this plan.
- No feature is added or removed; every action a screen has at a desktop size it has at every size (spec §2, §5).
- Every touch target is at least 44 px and every primary action 48 px; fields are 44 px on touch, not the mockup's 40
  (spec §4, §5). Never shrink a control or hide an action to fit.
- Every colour is a token in `tool-theme.json`, in both looks; no component holds a colour. Words on the stage read the
  fixed `--stage-*` tokens. Every word-on-background pair clears 4.5:1 in both looks (spec §4).
- The editors open Dark. `automata-editor:theme` holds `dark`, `light` or `device`; anything else is Dark (spec §3).
- Publish is the only lime button on a screen; a dialog may have one of its own (spec §9).
- The words in spec §10 are exact, and pass the drunk grandma test: could a drunk grandma tell what is happening and
  what to press? No file key, glob, package name or event id as page text.
- The editors are still found by role: the sidebar, the rail and the tab bar are a `tablist` named "Editors" whose
  `tab`s are named by the editor's name alone, because every journey opens an editor with
  `getByRole('tab', { name, exact: true })` (`tests/e2e/harness/complete-game.ts`). No Review page (spec §2).
- Packages are `@automata/editor`, `@automata/editors` and `@automata/editor-3d` (the `@mcthaydt/automata-*` names
  are the published scope of other packages, not these). Playwright journeys are `test:e2e` of each package, not
  `test:browser:2d`, and need `pnpm build` first.
- No sim file changes and no hash moves. `@automata/editor`, `-editors` and `-3d` are private: no changeset.
- `pnpm format` and `pnpm check` before every commit; Conventional Commits; ordinary commits only, never a force-push.
- Visual baselines that move are looked at (expected, actual, diff) and each change is named in this plan's log.

## Review Focus

1. **A stored choice from dark mode's rule** (`light`, `dark`, or no key after Match device). `light` and `dark` keep
   their look; no key opens Dark; choosing Match device writes `device` and survives a reload. Test in Task 2.
2. **An iPad held sideways with the list and the inspector open** (1194 × 834, touch): the level's work area is under
   480 px, so the toolbar wraps and the brush size gets its words, and no tool is cut. Test in Task 7.
3. **A phone rotated while a sheet is open with a field focused** (390 × 844 to 844 × 390): the sheet stays open, the
   field keeps focus and its typed text, and the tab bar moves to the left rail. Test in Task 8.
4. **A long game or level name on a 360 px phone** ("The Very Long Level Of Many Rooms"): the title ellipsises, Undo,
   Redo, Play and Publish stay whole and at least 44 px, and the full name is in the title menu. Test in Task 6.
5. **The site in a browser set to dark, after `colorScheme` flips**: no site page's native controls or scroll bars turn
   dark under light text; axe finds no contrast failure. Test in Task 3.

---

## Phase 1: the base and the colours

### Task 1: Merge dark mode into the shared-editors build

**Files:**
- Modify: whatever the merge touches; record each conflict and how it was resolved in this plan's log.

**Interfaces:**
- Produces: one branch with the shared-editors build's rail (one entry per editor, `person`, More) and dark mode's
  `tool-theme.json`, `tool-theme.css`, `theme-choice.ts`, `ThemeChoice.svelte` and the three `public/theme-boot.js`.

- [x] **Step 1:** `git merge origin/claude/project-thread-6mtkk6` into the build branch (a merge commit, not a rebase).
- [x] **Step 2:** Resolve conflicts, keeping both sides' behaviour: the shared-editors rail and entries win on what
      the rail shows; dark mode wins on every colour and the theme files. Shell files that both touched
      (`shell-layout.css`, `SuiteRail.svelte`, `SuiteTopBar.svelte`, `Home.svelte`) are merged by hand.
- [x] **Step 3:** Run `pnpm check`, `pnpm test:unit:2d` and `pnpm test:browser:2d`. Expected: pass, as on each parent.
      A test that passed on one parent and fails here is a merge bug, fixed here.
- [x] **Step 4:** Commit `chore: merge dark mode into the shared editors build`.

### Task 2: The v2 colours, and opening in Dark

**Files:**
- Modify: `packages/editor/src/shared/kit/tokens/tool-theme.json`, `tool-theme-to-css.ts`, `tokens.json`
  (`"colorScheme": "dark"`), `packages/editor/src/shared/kit/theme/theme-choice.ts`, `ThemeChoice.svelte`,
  `packages/editor/src/shared/kit/tool-chrome.css`, the generated `tokens.css` and `tool-theme.css` (by
  `pnpm --filter @automata/editor tokens`), the three `public/theme-boot.js` (`packages/editor/public/`,
  `packages/editor-3d/public/` and `extensions/editors/public/`, from `THEME_BOOT`).
- Test: `packages/editor/tests/unit/shared/kit/tokens/tool-theme.test.ts`, `tool-theme-dom.test.ts`,
  `packages/editor/tests/unit/shared/kit/editor-colours.test.ts`, `tests/unit/shared/kit/theme/theme-choice.test.ts`
  (create if absent), `theme-choice-widget.test.ts`, `theme-pages.test.ts`, `packages/editor/tests/e2e/theme.test.ts`,
  `packages/editor/tests/browser/layout/shared/kit/theme/theme.test.ts` (no attribute now means dark).

**Interfaces:**
- Produces: `readThemeChoice(storage): ThemeChoice` returns `'dark'` for a missing or unknown value;
  `writeThemeChoice(choice, storage)` always writes the choice (`device` included);
  `applyThemeChoice(choice, root)` always sets `root.dataset.theme = choice`. New tokens `--tool-raise`, `--tool-dot`,
  `--lime-hover`, `--tool-line-hover`; new size token `--size-field` (28 px mouse, 44 px touch) and `--shell-topbar` 48/56 in
  `tool-chrome.css`.

- [x] **Step 1: Write the failing tests.**
      `tool-theme.test.ts`: the JSON's dark and light values equal spec §4's table, key by key, and both hold
      `tool-raise`, `tool-dot`, `lime-hover`, `tool-line-hover`; every other key of today's file is still there. `toolThemeToCss` output: `:root` holds the dark values and
      `color-scheme: dark`; `:root[data-theme="light"]` holds the light values; `@media (prefers-color-scheme: light)`
      wraps `:root[data-theme="device"]` with the light values; no `prefers-color-scheme: dark` block remains.
      `editor-colours.test.ts`: `contrast(front, back) >= 4.5` for every pair listed in spec §4's Contrast paragraph,
      in both looks (one `it` per pair, named "ink on tool-raise, dark").
      `theme-choice.test.ts`: `readThemeChoice` gives `dark` for no key, `'blue'` and a throwing store; `light`,
      `dark`, `device` round-trip; `writeThemeChoice('device')` calls `setItem(THEME_KEY, 'device')`.
      `theme-choice-widget.test.ts`: the radio names in order are `Dark`, `Light`, `Match device`, and `Dark` is
      checked with an empty store. `tokens-to-css.test.ts`: `color-scheme: dark;` is the first line.
- [x] **Step 2: Run** `pnpm --filter @automata/editor test:unit -- tool-theme editor-colours theme-choice tokens-to-css`.
      Expected: FAIL on the values, the CSS default, the stored default and the order.
- [x] **Step 3: Implement.** Put spec §4's values in `tool-theme.json`; change `toolThemeToCss`'s template to the
      dark-default shape; flip `colorScheme`; change the three functions and `THEME_BOOT` to "set `data-theme` to the
      stored `light`, `dark` or `device`, else `dark`"; reorder `OPTIONS`; add the size tokens and
      `--primary-hover: var(--lime-hover)` in `tool-chrome.css`. Regenerate the CSS and the boot files.
- [x] **Step 4: Update the e2e** `theme.test.ts`: a fresh context with `colorScheme: 'light'` and no storage opens
      with `data-theme="dark"` and the dark `--tool-panel`; stored `light` opens light; choosing Match device in a
      light device shows light, survives a reload, and the store holds `device` (Review Focus 1).
- [x] **Step 5: Run** the unit tests above, `pnpm --filter @automata/editor exec vitest run --project layout
      tests/browser/layout/shared/kit/theme`, then `pnpm build` and
      `pnpm --filter @automata/editor exec playwright test tests/e2e/theme.test.ts --project desktop --trace off`, and
      `pnpm check`. Expected: PASS.
- [x] **Step 6: Commit** `feat(editor): the v2 colours, and the editors open in the dark look`.

### Task 3: The site keeps its own colour scheme, and every page is checked

**Files:**
- Modify: the site's own tokens file (`site/src/app.css`'s `:root` on #506's line, `site/src/shared/styles/tokens.css`
  once the site slice #517 is in), adding `color-scheme` beside its `--bg`; `site/tests/e2e/site.e2e.ts`.

**Interfaces:**
- Consumes: `axeViolations(page, exclude?)` from `site/tests/e2e/gates.ts` (WCAG 2.2 AA, `color-contrast` included)
  and `site.e2e.ts`'s own `PAGES` list. No second route list and no new file: `site.e2e.ts` already runs axe on every
  page at 375 and 1280 px.

- [x] **Step 1: Write the failing test** in `site.e2e.ts`: a `describe` that, for each of `PAGES` at 375 × 667 and
      1280 × 800, in a context with `colorScheme: 'dark'`, asserts `axeViolations(page)` is `[]` and
      `getComputedStyle(document.documentElement).colorScheme` equals the site's own scheme (`'light'` on today's
      site; `'dark'` once the site's v2 is in).
- [x] **Step 2: Run** `pnpm --filter @automata/site test:e2e -- site.e2e --project chromium --trace off`
      (after `pnpm build`). Expected: FAIL on `colorScheme` (it inherits `dark` from Task 2).
- [x] **Step 3: Implement:** set the site's `color-scheme` in its own `:root`. Fix any pair axe still reports by
      moving the site to an existing token, and name each in the log.
- [x] **Step 4: Run** the file and the site's whole e2e suite. Expected: PASS. Then `pnpm check`.
- [x] **Step 5: Commit** `fix(site): the site keeps its own colour scheme; check every page's contrast`.

## Phase 2: the kit parts

Each part below is used by later tasks only through the names in its Interfaces block. Each part's layout test lives
in `packages/editor/tests/browser/layout/shared/kit/<folder>/` and runs at the seven sizes of spec §11 through one
helper, `atEverySize(run)`, created in Task 4.

### Task 4: The inset shell and the editors' icons

**Files:**
- Modify: `packages/editor/src/shared/kit/shell/EditorShell.svelte` (split its region sheets into
  `shell-sheets.svelte` to stay under 600 lines), `shell-layout.css`, `shell-regions.css`,
  `packages/editor/src/shared/kit/icons/paths.ts`, `packages/editor/src/features/suite/shell/suite-entries.ts`
  (`iconFor`), `packages/editor/src/app/suite/levels-2d/levels-2d-suite-editor.ts` (its entry definitions' icons),
  `packages/editor-3d/src/features/studio/studio-suite-editor.ts` and Levels 3D's entry (icons).
- Create: `packages/editor/src/testing/at-every-size.ts`.
- Test: `packages/editor/tests/unit/shared/kit/icons/paths.test.ts`, `tests/unit/suite/shell/suite-entries.test.ts`,
  `tests/browser/layout/shared/kit/shell/editor-shell.test.ts`.

**Interfaces:**
- Produces: icons `levels`, `person` (if the shared-editors build lacks it), `zap`, `volume`, `message`, `clapper`,
  `workflow`, `maximize`, `upload`, copied verbatim from the mockup's `icons.js` (`minus`, `eye-off`, `home`,
  `sliders` and `review` are already in `paths.ts`). `iconFor(id: string): IconName` per spec §7.3, exported for its
  test; Levels 2D's `SuiteEntryDef`s in `levels-2d-suite-editor.ts` get `levels` and `person`. `atEverySize(run: (size: { name: string; width: number; height:
  number; touch: boolean }) => Promise<void>)`. The shell's regions: `sidebar` (was `rail`) in wide and medium,
  `tabbar` in compact; `data-mode` unchanged. Shell variables `--shell-sidebar` 224 px, `--shell-rail` 76 px,
  `--shell-tabbar` 56 px, `--shell-inset` 8 px.

- [x] **Step 1: Write the failing tests.** `suite-entries.test.ts`: `iconFor` gives spec §7.3's icon for every id, and
      the icons of the entries a suite with every editor shows are all different (`levels-2d` and `levels-3d` share
      `levels` only because no game shows both under one name; with both kinds they are "Levels 2D" and "Levels 3D",
      and that is allowed). `editor-shell.test.ts`, at each
      size: wide shows the sidebar at 224 px and the panel inset 8 px with a 1 px edge and 8 px corners; medium shows
      a 76 px rail on the left and no tab bar at the foot, with the inspector floating over the work (296 px) only
      when something is chosen and a header button to open it otherwise; compact shows no sidebar, the panel at the window's edges and
      the tab bar; Home shows the sidebar too; `document.documentElement.scrollWidth <= innerWidth` at every size.
- [x] **Step 2: Run** them. Expected: FAIL (`list` icons; today's 56 px rail; today's medium foot bar).
- [x] **Step 3: Implement** the grid in `shell-layout.css` (spec §6) and the icons.
- [x] **Step 4: Run** the tests, `pnpm test:browser:2d -- shell`, and `pnpm check`. Expected: PASS.
- [x] **Step 5: Commit** `feat(editor): an inset work panel, three layouts and an icon for each editor`.

### Task 5: The sidebar

**Files:**
- Create: `packages/editor/src/shared/kit/nav/Sidebar.svelte`.
- Modify: `packages/editor/src/features/suite/shell/SuiteRail.svelte` (becomes a thin switch: `Sidebar` in wide and
  medium, `TabBar` in compact, Task 8), `Suite.svelte`.
- Create: `packages/editor/src/features/suite/core/problem-counts.ts`.
- Test: `tests/unit/shared/kit/nav/sidebar.test.ts`, `tests/browser/layout/shared/kit/nav/sidebar.test.ts`.

**Interfaces:**
- Produces: `Sidebar` props `{ game: { name: string; letter: string }; entries: readonly SuiteEntry[]; current:
  string | undefined; counts: Readonly<Record<string, number>>; layout: 'sidebar' | 'rail'; onselect: (id: string) =>
  void; onhome: () => void; ongame: () => void }`. Every entry is under "Editors". `counts` comes from
  `problemCounts(findings: readonly CheckFinding[], list: EditorList): Record<string, number>` in
  `packages/editor/src/features/suite/core/problem-counts.ts` (new): each finding with a `path` counts once for the
  editor the list gives that path to.

- [x] **Step 1: Write the failing tests.** DOM: the group label "Editors" and no "Waiting for you"; a `tablist` named
      "Editors" whose `tab`s, in entry order, have their icon and are named exactly by the editor's name, a count
      included (`getByRole('tab', { name: 'Schematic', exact: true })` finds Schematic with 1 problem, and the tab is
      described by "1 problem"); Home is a button outside the list; Schematic's count in `warn`; `problemCounts` gives
      a finding in `content/systems/guard.toml` to `schematic` and a finding with no `path` to none; one tab stop, arrows, Home, End and Cmd/Ctrl 1-9
      keep today's rail behaviour (move today's rail keyboard tests here). Layout: no row label is cut
      (`scrollWidth <= clientWidth`) in either layout; rows are 32 px with a mouse and 44 px on touch; rail items 52 px
      and 56 px on touch.
- [x] **Step 2: Run.** Expected: FAIL (no `Sidebar`).
- [x] **Step 3: Implement** `Sidebar.svelte` from the mockup's `.side` and `.nav` rules.
- [x] **Step 4: Run** the tests and `pnpm check`. Expected: PASS.
- [x] **Step 5: Commit** `feat(editor): a sidebar with every editor's icon and name`.

### Task 6: The breadcrumb header

**Files:**
- Create: `packages/editor/src/features/suite/shell/SuiteHeader.svelte`, `SaveState.svelte`, `ProblemCount.svelte`.
- Modify: `SuiteTopBar.svelte` (removed; its callers use `SuiteHeader`), `SuitePills.svelte` (removed; its menu
  moves into `ProblemCount`), `Suite.svelte`.
- Test: `tests/unit/suite/shell/Suite-topbar.test.ts` (renamed `suite-header.test.ts`),
  `tests/browser/layout/suite/shell/suite-header.test.ts`.

**Interfaces:**
- Consumes: today's `SuiteTopBar` props (`title`, `saved`, `history`, `onundo`, `onredo`, `playUrl`, publish).
- Produces: `SuiteHeader` props `{ editor: { label: string; icon: IconName } | undefined; doc: { name: string;
  menu: readonly MenuItem[] } | undefined; views?: { options: readonly { id: string; label: string }[]; value: string;
  onchange: (id: string) => void }; checks: Pill (today's `checksPill` result, `pills-model.ts`); onlocate; save: 'saved' | 'saving' | { failed: string };
  history; onundo; onredo; playUrl; onpublish; mode: ShellMode }`.

- [x] **Step 1: Write the failing tests.** DOM: "Levels / Start" with the chevron opens the document menu; Level ·
      Tiles is a radio group; the problem count's words for each `Pill` tone (spec §7.4): "Checking…", "Not checked
      yet", "No problems", "1 problem", "3 problems", "Couldn't check"; its menu lists the findings and Locate selects
      one; "Saved", "Saving…" and the failure words; Undo and Redo
      named with the step; Play and Publish; exactly one lime button. In compact: the title menu holds the view tabs,
      the problem count and Saved, so every one is still reachable. Layout at 360 × 640 with the name "The Very Long
      Level Of Many Rooms": the title ellipsises, Undo, Redo, Play and Publish are whole and at least 44 px, Publish 48
      (Review Focus 4); no header overflows at any size; under 900 px the problem count keeps its number.
- [x] **Step 2: Run.** Expected: FAIL.
- [x] **Step 3: Implement**, moving the phone's "Game menu" (Play and Publish in one menu) back to two buttons, as the
      mockup has room for them.
- [x] **Step 4: Run** the tests, `pnpm test:browser:2d -- suite`, and `pnpm check`. Expected: PASS.
- [x] **Step 5: Commit** `feat(suite): a breadcrumb header with the problems, Saved, Play and Publish`.

### Task 7: Rows, fields, blocks and the floating toolbar

**Files:**
- Create: `packages/editor/src/shared/kit/rows/Section.svelte`, `Row.svelte`, `Field.svelte`, `Block.svelte`;
  `packages/editor/src/shared/kit/toolbar/FloatingToolbar.svelte`.
- Modify: `packages/editor/src/shared/kit/widgets/{Stepper,Picker,ColorField,Slider,Segmented,Chips,Button,IconButton}.svelte`
  (sizes and colours from tokens; `Button`'s `secondary` look per spec §9), `packages/editor/src/shared/kit/fields/FieldEditor.svelte`
  (renders through `Field`).
- Test: `tests/unit/shared/kit/rows/rows.test.ts`, `tests/browser/layout/shared/kit/rows/rows.test.ts`,
  `tests/browser/layout/shared/kit/toolbar/floating-toolbar.test.ts`, `tests/browser/layout/shared/kit/widgets/widgets.test.ts`.

**Interfaces:**
- Produces: `Section { label: string; count?: number; onadd?: () => void; addLabel?: string }`; `Row { selected?:
  boolean; lead?: Snippet; meta?: string; actions?: Snippet; onclick?: () => void }`; `Field { label: string; hint?:
  string; warning?: string; children: Snippet }`; `Block { title: string; icon: IconName; onremove?: () => void;
  children: Snippet }`; `FloatingToolbar { label: string; place: 'top' | 'zoom'; children: Snippet; second?: { label:
  string; children: Snippet } }` (the wrap label comes from `second.label`).

- [x] **Step 1: Write the failing tests.** DOM: `Field` names its control by its label; its warning has the alert icon
      and is `aria-describedby`; `Block` nested in `Block` throws in dev. Layout: rows 32/44, fields 28/44, every
      control and row button at least 44 px on touch; a field has no box of its own (its parent has no border).
      Toolbar: in a 600 px container it is one row; at 1194 × 834 touch with list and inspector open (a 480 px or
      narrower container) the second group sits under a hairline with the words "Brush size", every button is whole
      and at least 44 px (Review Focus 2).
- [x] **Step 2: Run.** Expected: FAIL.
- [x] **Step 3: Implement** from the mockup's `.sec`, `.row`, `.field`, `.block`, `.float` and `@container` rules.
- [x] **Step 4: Run** and `pnpm check`. Expected: PASS.
- [x] **Step 5: Commit** `feat(editor): rows, label-left fields, blocks and a floating toolbar that wraps`.

### Task 8: Sheets and the tab bar

**Files:**
- Create: `packages/editor/src/shared/kit/sheets/Sheet.svelte`, `packages/editor/src/shared/kit/nav/TabBar.svelte`,
  `packages/editor/src/shared/kit/nav/tab-slots.ts`.
- Modify: `shell-sheets.svelte` (Task 4; region sheets render through `Sheet`), `widgets/Menu.svelte` (in compact a
  menu opens as a `Sheet`), the shared-editors build's More tab (now `TabBar`'s).
- Test: `tests/unit/shared/kit/nav/tab-slots.test.ts`, `tests/unit/shared/kit/sheets/sheet.test.ts`,
  `tests/browser/layout/shared/kit/nav/tab-bar.test.ts`, `tests/browser/journeys/kit/rotate-and-layout.test.ts`.

**Interfaces:**
- Produces: `tabSlots(entries: readonly SuiteEntry[], current: string | undefined, slots = 4): { shown: readonly
  SuiteEntry[]; more: readonly SuiteEntry[] }`; `TabBar { entries; current; standing: boolean; onselect }`;
  `Sheet { open: boolean; label: string; detent?: Detent; onclose: () => void; children: Snippet }`.

- [x] **Step 1: Write the failing tests.** `tabSlots`: nine entries, current Tuner → first four shown, five in More;
      current Schematic → Tuner, Levels, Characters, Schematic shown, Feel in More; fewer than five entries → all
      shown, no More. `Sheet`: focus moves in and is trapped, Escape and the scrim close it and focus returns.
      Layout: tabs 56 px, the open tab's lime bar, More opens a sheet; at 844 × 390 the bar stands at the left, 72 px.
      Journey (Review Focus 3): at 390 × 844 open the inspector sheet, focus a name field, type "Shop", rotate to
      844 × 390: the sheet is open, the field focused, its value "Shop", and the tab bar at the left.
- [x] **Step 2: Run.** Expected: FAIL.
- [x] **Step 3: Implement**; `railFit` from the shared-editors build is replaced by `tabSlots` (spec §7.8), and its
      tests move. The tab bar keeps `role="tablist"` "Editors" and its `tab` names, and the journeys' `railHas` and
      `openFromRail` (`packages/editor/tests/e2e/harness/complete-game.ts`) keep finding a tab or More's item; run
      `complete-game-2d` with `--project editor-phone-chromium` to prove it.
- [x] **Step 4: Run** and `pnpm check`. Expected: PASS.
- [x] **Step 5: Commit** `feat(editor): bottom sheets and a tab bar of four editors and More`.

### Task 9: The empty state and the status line

**Files:**
- Create: `packages/editor/src/shared/kit/states/EmptyState.svelte`.
- Modify: `packages/editor/src/shared/kit/widgets/StatusLine.svelte`, `packages/editor/src/features/characters/EntitiesPanel.svelte`
  (its "No characters yet" becomes an `EmptyState`).
- Test: `tests/unit/shared/kit/states/empty-state.test.ts`, the Characters panel's DOM test.

**Interfaces:**
- Produces: `EmptyState { icon: IconName; title: string; why: string; action: { label: string; onclick: () => void } }`.

- [x] **Step 1: Write the failing tests.** `EmptyState` has one heading, one line and one button. Characters with no
      character shows "No characters yet", "Add one to place it in your levels." and its one add button.
      `StatusLine` is hidden in compact and uses `text-mono-12`.
- [x] **Step 2: Run.** Expected: FAIL.
- [x] **Step 3: Implement.**
- [x] **Step 4: Run** and `pnpm check`. Expected: PASS.
- [x] **Step 5: Commit** `feat(editor): an empty state with one way forward, and the status line as the panel's foot`.

## Phase 3: the screens

Each task moves its screens onto the parts, removes the old boxes, and adds a layout test that runs `atEverySize` in
both looks with these checks, from one helper `screenChecks(page)` created in Task 10: no sideways scroll, no header
overflow, every control at least 44 px on touch and primaries 48, exactly one lime button per layer, and axe's
`color-contrast` is clean at 1440 × 900 and 390 × 844. Compare each screen with its shot in `shots-editors-v2/` by eye
and log what differs and why.

### Task 10: Home and Publish

**Files:**
- Modify: `packages/editor/src/features/suite/shell/Home.svelte`, `SuiteHome.svelte`, `EditorCardView.svelte`,
  `packages/editor/src/shared/kit/home/CardTile.svelte`, `PublishGameDialog.svelte` (today titled "Make your game ready
  to upload", with "Build my game" already its confirm).
- Create: `packages/editor/src/testing/screen-checks.ts`.
- Test: `tests/unit/suite/shell/home.test.ts`, `tests/unit/suite/shell/publish-game-dialog.test.ts`,
  `tests/browser/layout/suite/shell/home-v2.test.ts`.

- [x] **Step 1: Write the failing tests.** Home's heading and lede (spec §10); each card's name, line (spec §10's
      table) and contents, "Nothing made yet. Open it to start." for an editor with no file; the colours control at the foot. Publish: the
      title "Put your game online", the mockup's line ("Publish builds your game and checks it is ready for the web. You
      get one zip file to upload to itch.io or any website host."), three steps, and "Build my game" as the dialog's
      one lime; "Download the zip" and "Try again" are the dialog's one lime only in their own phase. Layout: three cards a
      row in wide, two in medium, one a row in compact; `screenChecks` passes.
- [x] **Step 2: Run.** Expected: FAIL.
- [x] **Step 3: Implement.**
- [x] **Step 4: Run** and `pnpm check`. Expected: PASS.
- [x] **Step 5: Commit** `feat(suite): Home asks what you want to change; Publish in three plain steps`.

### Task 11: Levels 2D: Level, Tiles and Characters

**Files:**
- Modify: `packages/editor/src/app/suite/levels-2d/*` (tools and panes), `packages/editor/src/features/level/*`
  (layers and palette as `Section` and `Row`, inspector as `Field`, the canvas toolbar as `FloatingToolbar` with the
  brush size as its second group, zoom bottom right), `packages/editor/src/features/tiles/*`,
  `packages/editor/src/features/characters/*`, the `hp` label in
  `packages/editor/src/shared/level-2d/profiles/level-project/templates/platformer.ts` (Slime) and `topdown-rpg.ts`
  (Enemy), the required-field words in `packages/editor/src/shared/kit/fields/field-values.ts:17` (today
  `` `${field.id} is required` ``, a key as page text; it gains the thing's label so a ref says "The Door doesn't lead
  anywhere yet. Choose where it goes." and any other field "The Slime needs a Patrol path. Fill it in."), and every
  `variant="primary"` here (to `secondary`).
- Test: the existing `tests/browser/layout/level/level-view.test.ts`, `characters/*.test.ts`, the tiles layout test,
  `tests/unit/features/level/inspector-words.test.ts` (create).

- [x] **Step 1: Write the failing tests.** "Hits to beat it" with its value alone and its range in the hint; a Door
      whose Leads to is empty shows "The Door doesn't lead anywhere yet. Choose where it goes." under the field and in
      Problems, and a top-down Warp says the same with "Warp"; no problem's words hold a field id; a level project with no level shows `EmptyState` with today's one action; the stage has the
      dotted `tool-stage` in both looks; `screenChecks` on Level, Tiles and Characters; on a phone the tool dock sits
      above the tab bar, and at 844 × 390 at the right edge.
- [x] **Step 2: Run.** Expected: FAIL.
- [x] **Step 3: Implement.** The canvas pixels do not change; only what sits around them.
- [x] **Step 4: Run** these and the 2D journeys (`pnpm test:browser:2d -- journeys/2d`), then `pnpm check`. Expected:
      PASS.
- [x] **Step 5: Commit** `feat(editor): Levels, Tiles and Characters in the v2 look`.

### Task 12: Tuner, Feel, Audio, Writer and Sequence

**Files:**
- Modify: `packages/editor/src/features/suite/tuner/ui/*`; `extensions/editors/src/shared/ui/EditorPage.svelte`
  (a centred 720 px column of sections, no `.card`), `FieldRow.svelte` (removed; callers use `Field`), and each of
  `extensions/editors/src/features/{feel,audio,writer,sequence}/*` (effects and tones as `Block`, start pages as
  `EmptyState`, every `variant="primary"` to `secondary`, Sequence's playhead in lime).
- Test: `extensions/editors/tests/browser/layout/content-editors.test.ts`, `packages/editor/tests/browser/layout/suite/tuner/ui/tuner.test.ts`,
  and a DOM test per editor that its start page is an `EmptyState`.

- [x] **Step 1: Write the failing tests:** `screenChecks` on each of the five; each start page is one heading, one
      line and one button; the Tuner's game sits on the stage with the "Playing" dot in lime; no element in these
      editors has both a border and a `Field` inside it, other than a `Block`.
- [x] **Step 2: Run.** Expected: FAIL.
- [x] **Step 3: Implement.**
- [x] **Step 4: Run** these, the content editors' journeys (`extensions/editors/tests/e2e/journeys`), and `pnpm check`.
      Expected: PASS.
- [x] **Step 5: Commit** `feat(editors): Tuner, Feel, Audio, Writer and Sequence in the v2 look`.

### Task 13: Schematic

**Files:**
- Modify: `extensions/editors/src/features/schematic/*` (the board on the stage, its toolbar as `FloatingToolbar`,
  switches as `Row`, the inspector as `Field`, `variant="primary"` to `secondary`).
- Test: `extensions/editors/tests/browser/layout/schematic-layout.test.ts`, `schematic-panel-layout.test.ts`,
  `extensions/editors/tests/unit/schematic/layout.test.ts`.

- [x] **Step 1: Write the failing tests:** when the board's area is narrower than it is high (390 × 844 and
      820 × 1180) the board lays out tall: the modes stack top to bottom, each mode box's words are not cut, and the
      links still join the same modes; at 1440 × 900 it stays wide; `screenChecks` passes.
- [x] **Step 2: Run.** Expected: FAIL.
- [x] **Step 3: Implement** the tall layout in the board's layout function, keyed on the area's aspect, not the device.
- [x] **Step 4: Run** these, the Schematic journeys, and `pnpm check`. Expected: PASS.
- [x] **Step 5: Commit** `feat(editors): Schematic in the v2 look, with a tall board in narrow areas`.

## Phase 4: proof and record

### Task 14: The 3D editors, the played game, and the record

**Files:**
- Modify: `extensions/editors/tests/e2e/journeys/dark-game-loop.test.ts` (no stored choice; presses Play),
  `packages/editor/tests/e2e/journeys/dark-levels-3d.test.ts`, every `variant="primary"` outside a dialog in
  `packages/editor-3d/src` (11 uses on #508, to `secondary`; spec §9), the visual baselines that moved,
  `docs/refactor/progress.md`, this plan's log.

- [x] **Step 1:** Change `dark-game-loop.test.ts` to start with an empty store and `colorScheme: 'light'`, check the
      editors open dark, make the small game with the complete-game helpers (`tests/e2e/harness/complete-game.ts`):
      paint a Decor cell, change the player's picture in Characters, add a key in the Tuner, add a flash in Feel,
      start the bump at 880 Hz in Audio, and change the keeper's line in Writer (the shared-editors build's 2D
      template has the keeper; if this branch's template has none, leave Writer out and say so in the log). Press Play
      and assert each shows in the played game, as `complete-game-2d` does. Run `pnpm build`, then
      `pnpm --filter @automata/editors test:e2e -- dark-game-loop --trace off`. Expected: PASS on both projects.
      Then run `complete-game-2d` and `complete-game-3d` (`pnpm --filter @automata/editor test:e2e -- complete-game
      --trace off`): every editor in both kinds of game, in the new look. Expected: PASS, with the `test.fail` journeys
      the shared-editors build left failing for their stated reasons.
- [x] **Step 2:** Turn the 3D editors' `variant="primary"` buttons outside a dialog to `secondary`, then run the 3D
      editors: `.github/workflows/3d.yml`'s commands, including `dark-levels-3d.test.ts`.
      Levels 3D and the Studio show in the new shell, header, sidebar and tab bar with Publish their only lime; their
      insides are otherwise unchanged.
      Expected: PASS. If it cannot run here, leave the step unchecked and say so.
- [x] **Step 3:** Run every visual test; for each baseline that moved, look at expected, actual and diff, re-record
      it only when the change is the v2 look, and name each in the log.
- [x] **Step 4:** Run the full gates: `pnpm check`, `pnpm test:unit:2d`, `pnpm test:browser:2d`, the site's e2e and
      parity. Record which ran, which did not (WebKit, Firefox and real devices cannot run in a cloud session) and the
      results in the log and in `progress.md`.
- [x] **Step 5: Commit** `test(editors): the v2 look proven in play; record the build`.

**For the build audit (stage 5), the thread's instructions must say:** make a small 2D game and a small 3D game in the
rebuilt editors, play each, and confirm that what was made shows up in play (spec §11's list), at a phone size and an
iPad size, in Dark and once in Light; and apply the drunk grandma test to every screen.

## Log

- 2026-11-08: spec and plan written (stage 2). The shared-editors build had no branch yet, so this plan is stacked on
  the shared-editors plan's branch (`claude/project-thread-9t2qxf`, PR #512); the build starts from the shared-editors
  build head once it exists, and merges #506 first (Task 1).
- 2026-11-08: plan audit (stage 3), [`2026-11-08-editors-v2-plan-audit.md`](2026-11-08-editors-v2-plan-audit.md):
  17 findings checked against #508 at `89db7336`, #506 at `30667aa3` and #517 at `87619dbb`, all fixed in the spec and
  this plan. The biggest: Review does not exist (deleted in `a15c7b36`), so it is out (A1); the editors stay a
  `tablist` of `tab`s so the journeys still find them (A2); the problem count keeps every checks state (A3); the 3D
  editors' 11 lime buttons turn secondary (A4); the Door's words were wrong about what a Door leads to (A5).
- 2026-11-08, build, Task 1: the shared-editors build still has no branch, so the build branch is #508's head
  (`89db7336`) with the plan's three documents brought over and PR #506's head (`30667aa3`) merged in. Ruling: the
  rail the shared-editors plan changes (one entry per editor, `person`, More) is not here; the shared-editors build
  merges this branch's rail work when it lands, and Tasks 5 and 8 build on today's rail. Conflicts (19) were resolved
  for #508's side wherever #506's side only held an older copy of the content editors, Publish and Play (the
  Publish dialog, `playOff`, `shared/audio-play.ts`, the editor lists, the `figure*` glob); #506's side won every
  colour, the theme files and the Audio mix and Check the sounds (`audio-findings.ts`), whose imports were joined.
  Merge leftovers fixed: a second `publishingGame` in `Suite.svelte`, a second `figure-*` row in three editor lists,
  `newGame`'s argument order in `new-3d-game-plays-its-edits`, and `exactOptionalPropertyTypes` in `dark-levels-3d`.
  Dark mode's build audit is now in `docs/refactor/` because its progress row linked to it. Ran: `pnpm format`,
  `pnpm typecheck` (51 of 51), `boundaries`, `style`, `source-names`, `knip`, `check:changesets`, `pnpm test:unit`
  (61 of 61 tasks). Not run yet: `test:browser:2d`.
- 2026-11-08, build, Task 2: the v2 colours and Dark as the default. `tool-theme.json` holds spec §4's table in both
  looks (new keys `tool-raise`, `tool-dot`, `lime-hover`, `tool-line-hover`; `tool-stage` is `#08090b`), `tool-theme.css`
  is dark on `:root`, light under `data-theme="light"` and under `data-theme="device"` while the device asks for light,
  and `tokens.json` says `dark`. The stored choice is `dark`, `light` or `device`; a missing, refused or unknown value
  opens Dark; `applyThemeChoice` always sets the attribute. The four `<meta name="color-scheme">` say `dark light`.
  `--size-field` (28 px mouse, 44 px touch) and `--shell-topbar` (48/56) are in `tool-chrome.css`; `--primary-hover`
  is `--lime-hover`. Ruling: dropped the test that held the light look to the website token file's values, because
  the v2 light palette is not the old site's (`tool-bg` `#f4f4f5`). The tests were written before the code but the
  red run was not recorded for this task; they check spec §4's table key by key, so a wrong value fails. The three
  dark journeys now expect `rgb(11, 12, 14)` and `data-theme="dark"`; the design board test asks for each look the way
  a person does (a stored choice, with the emulated device asking for the other). `theme.test.ts` now reads the
  built suite (`dist/suite`; `dist/2d` no longer exists). Ran: editor unit tests (271 files), the layout theme test in
  Chromium, `tests/e2e/theme.test.ts` and `design-board.test.ts` (desktop project).
- 2026-11-08, build, Task 4: the inset shell and the editors' icons. `EditorShell` draws an empty `.frame` (the work
  panel's face: `tool-panel`, a 1 px edge, 8 px corners) and the header, list, canvas, inspector, dock and status sit on
  it with no faces of their own; the inset is the grid's first and last row and last column, so there is no negative
  margin. Wide is a 224 px sidebar, medium a 76 px rail, compact a 56 px tab bar along the foot with no inset, or a
  72 px column at the left on a phone held sideways (`data-standing`, `railStandsAt`). A screen with no rail
  (`data-rail="none"`) sets the sidebar, rail, tab bar and standing widths to 0 instead of repeating the areas. The
  canvas is the stage: `tool-stage` with `tool-dot` dots every 20 px. Rulings: (1) the region keeps the name `rail`
  (not `sidebar`) because the fixtures, journeys and `data-region` tests name it; only its `data-presentation` is now
  `sidebar`, `rail` or `tabbar`. (2) The region sheets are not moved into `shell-sheets.svelte` and not rendered
  through `Sheet`: the shell keeps its regions mounted and moves them with CSS so focus and scroll survive a
  rotation, which a re-rendered sheet would lose; they take the raised look (`--raise`, 12 px top corners) in CSS.
  `Sheet` (Task 8) serves the menus and the title menu. (3) `EditorShell.svelte` is 340 lines, so no split. Nine icons
  were added (`levels`, `person`, `zap`, `volume`, `message`, `clapper`, `workflow`, `maximize`, `upload`) and
  `iconFor` is exported and follows spec §7.3. `WINDOW_SIZES` and `atEverySize` are in `src/testing/kit/`. The shell's
  layout test now measures the inset, the 224/76/56/72 px bars and the 8 px corners; it passes in Chromium with a
  mouse and with touch (164 tests). Not run: WebKit, Firefox.
- 2026-11-08, build, Task 3: `site/src/app.css` says `color-scheme: light` in its own `:root`, because it imports the
  editors' tokens, which now say `dark`. `site.e2e.ts` gained a block that runs every page of `PAGES` at 375 and
  1280 px in a context whose device asks for dark and asserts the page's own scheme and no axe violation. Red first
  for the right reason: 88 of 88 pages read `dark` where the site is `light`; green after the change, with no
  contrast failure on any page, so no site colour changed. The whole Chromium suite passes (496 tests, 11 minutes).
  WebKit not run. Commit hook: from here interim commits skip the 7-minute affected-test hook (`LEFTHOOK=0`) and the
  full gates run before the PR.
- 2026-11-08, build, Task 5: the sidebar. `Sidebar` (224 px rows, or the 76 px rail with each icon above its whole name)
  draws the game's mark and name, Home as a button outside the list, and one `tab` per editor in a `tablist` named
  "Editors"; a problem count is at the row's end and described ("2 problems"), not part of the tab's name, so the
  journeys' `getByRole('tab', { name })` still finds it. The keyboard rules (one tab stop, arrows, Home, End, Cmd/Ctrl
  1 to 9) moved to `rail-keys.ts` and are shared with the tab bar; the old rail tests now run on `SuiteRail`'s new
  `presentation` prop. `tabSlots` (four tabs and More, the open editor takes the fourth slot) and `problemCounts`
  have their own tests. Rulings: (1) no `ongame` prop and no game menu on the sidebar: the game's other actions live
  in the header's title menu (Task 6), so a second entry would be a second way to one thing. (2) `problemCounts` takes
  the cards (`{ editor, files }`) rather than an `EditorList`, because the list's items are cards already in
  `Suite.svelte`. (3) The plan's "Schematic's count in `warn`" is the count's colour for every editor. Known red until
  Task 6: seven `Suite*` tests that find "Home" or the game's name twice, because the old top bar still draws both
  (the header of Task 6 drops them). Ran: SuiteRail, sidebar, tab-slots and problem-counts unit tests; the sidebar
  layout test in Chromium.
- 2026-11-08, build, Task 6: the breadcrumb header. `SuiteHeader` replaces `SuiteTopBar` and `SuitePills`: the editor's
  icon and name, a slash, the document's name with a chevron that opens its menu, the editor's views as a radio group
  (Level, Tiles), then Undo, Redo, the problem count, Saved, Play and Publish. `ProblemCount` says the checks in
  words (`problemWords`: "Checking…", "Not checked yet", "No problems", "1 problem" / "3 problems" with the findings
  counted one by one, "Couldn't check") and lists the findings with Locate; under 900 px it keeps its number and drops
  its word. `SaveState` says "Saved", "Saving…" or the failure. Medium drops the editor's name and first slash; compact
  has Home, a title that opens a `Sheet` holding the views, document actions, problems and Saved, Undo, Redo, Play as
  an icon and Publish, so the phone's Game menu is gone and so is its harness path (`pressGame`). Rulings: (1) the
  header takes `header: EditorHeader | undefined` (`{ doc, views }`, a new optional `SuiteEditor.header(session)`)
  instead of the plan's separate `doc` and `views` props, so an editor gives the header one thing; no editor supplies
  it yet, Task 11 moves Levels' picker and views into it. (2) Until then a phone's editor `tools` take a row of their
  own under the buttons (the topbar wraps in compact), because beside Home, Undo, Redo, Play and Publish they had no
  room and the picker was 16 px wide. (3) `edge-xl` (12 px) is a new token for the top corners of a bottom sheet; the
  corner test allows it, and the shell's own sheets use it. (4) The editors' lime test now allows `--lime` in
  `Sidebar` and `TabBar` only (the game's mark and the open tab's bar, which spec 7 draws). (5) The colour test's "no
  ink on an accent" rule no longer reads `--cobalt-soft`, the chosen row's tint. (6) The compact tab bar's top edge is
  an inset shadow, not a border, which took a pixel from its 56 px and pushed the tabs 1 px off a phone. (7) The page
  says "Saved", not "Saved in your game folder"; Home still says where the game is saved. (8) `chooseEditor` and
  `editorControl` in `suite-layout.ts` find a tab or open More, in place of the Editors menu a phone held sideways
  used to have; `editorsMenu` is `moreButton`. (9) The stage's minimum width in the layout tests is 320 px in wide,
  because a 224 px sidebar, a 264 px list and a 320 px inspector leave about 370 px on an iPad Pro 11. Ran: editor unit
  tests (211 files, 2715 tests), the suite and nav layout tests in Chromium (109 and 3), typecheck, boundaries,
  style, lint on the package. Not run: WebKit, Firefox.
- 2026-11-08, build, Task 7: rows, label-left fields, blocks and the floating toolbar. `Section` (a 32 px head, count,
  add button), `Row` (32/44 px, chosen colour, a name that is a button, a second line, meta, and its own buttons that
  show under the pointer or the focus and always on touch), `Field` (a 108 px name, the control, a hint, a warning with
  the alert icon; no box of its own) and `Block` (a 44 px head, fields split by hairlines; a Block in a Block throws in
  development) are in `shared/kit/rows/`. `FloatingToolbar` is `StagePill` moved to `shared/kit/toolbar/` (its two
  users, Level and Characters, follow) with a raised face, `second` (the brush size: beside the tools, or under a
  hairline with its words when the stage is 480 px wide or less; the shell's canvas is the container), a `zoom`
  place at the bottom right, and the chosen tool reversed. `FieldEditor` draws through `Field`. Steppers, pickers,
  colours and sliders are `--size-field` (28 px with a mouse, 44 with touch) on the window colour with a strong edge;
  `Button`'s `plain` is now `secondary` (the raised face; `--line-hover` is new). Rulings: (1) a `Field` whose control
  draws its own name (a stepper's is its scrub handle, a picker's and colour's are inside their buttons) is `labelled`:
  the field gives that name the 108 px column and adds the hint and warning, and is not a second group of the same
  name. (2) `Row` has an optional `detail` (second line), which the layers list needs. (3) The mouse's control floor in
  the layout tests is 28 px (`editorTargets`), the field's, because spec 4 sizes a field at 28; rows, buttons and icon
  buttons are still 32 and are held to it in the new rows test. (4) `shell-layout.css` falls back to 48 px for
  `--shell-topbar`: seven canvas and journey tests load `tokens.css` only, and an unset variable invalidated the grid
  and squeezed the stage to 42 px (four canvas and three journey tests had been red since Task 4; all pass again).
  (5) `level-scene.test.ts` names the stage accent token (`--color-stage-accent`) the scene reads since dark mode.
  (6) The focus ring test reads the ring colour from `--focus` instead of the old light cobalt. (7) Home's scrolling page
  is a declared scroll region (the touch run found its colour choice below the fold on a phone held sideways).
  (8) Tests were written after the parts in this task (no red run recorded); each asserts the spec's sizes and words.
  Ran: editor unit tests (275 files, 3349 tests), editor layout tests in Chromium (19 files, 376 tests), canvas and
  journey tests in Chromium (74), the new nav, rows, toolbar and suite layout tests with touch (all pass), typecheck,
  knip, style, boundaries. Not run: WebKit, Firefox.
- 2026-11-08, build, Task 8: sheets and the tab bar. `Sheet`, `TabBar` and `tabSlots` already stood from Tasks 5 and 6;
  this task adds their proof. `sheet.test.ts` (focus moves in and is trapped, Escape and the scrim close it, a press that
  starts inside and ends on the scrim does not, and focus returns), `tab-bar.test.ts` (four tabs and More at 1/5 of the
  width, 56 px tall; the open tab's 2 px lime bar along its top, down its left when the bar stands; More's sheet rises
  from the foot and its rows are hit-sized) and the Review Focus 3 journey (at 390 × 844 the inspector sheet is open,
  "Shop" is typed in a name field; turning to 844 × 390 keeps the same sheet, the same field, its focus and its text, and
  the bar at the left). All three passed on their first run, since the parts existed (no red run recorded). The
  document menu in the header is a `Menu` and opens as a sheet when the layout is not wide (a popover under the chevron
  in wide). The journey harness: `railHas` is now async and finds an editor's tab, or its row under More on a phone,
  closing a sheet an earlier look left open; `openEditor` uses it. `complete-game-2d` passes at the phone size
  (`--project editor-phone-chromium`, 4 of 4); the 3D one's Publish is refused by design (closed beta, `test.fail`).
  Rulings: (1) the shell's region sheets stay CSS-driven (they keep focus and scroll through a rotation, which a mounted
  `Sheet` would not); `Sheet` is for menus, More and the title menu. (2) The standing 72 px bar is proved in the shell
  test that already measured it, not twice. Not run: the iPad journeys end to end (the run passed the time limit), WebKit,
  Firefox.
- 2026-11-08, build, Task 9: the empty state and the status line. `EmptyState` (an icon in a 40 px tile, one heading, one
  line, one button) is in `shared/kit/states/`; Characters with none shows "No characters yet" / "Add one to place it in
  your levels." and the panel's own + is hidden meanwhile so the panel offers one way, not two. `StatusLine` is Geist Mono
  12 px in `--tool-faint`; the shell hides a status region that holds the line in compact (a region holding something
  else, such as a broken region's error panel, stays). Rulings: (1) the other empty pages (Levels with no level, the
  content editors' starts) move onto `EmptyState` with their screens in Tasks 11 and 12. (2) The faint colour is
  `--tool-faint` directly, with no new token. Tests written first for `EmptyState` and the Characters panel (red for
  the right reason: no component, then no heading); the status line's two layout tests failed first on "11px" and "flex".
- 2026-11-08, build, Task 10: Home and Publish. Home asks "What do you want to change?" with "Pick a part of your game.
  Everything you change is saved in your game's folder." (on the try-it sample: "Pick a part of the sample to try.", since
  nothing is saved there). Each card is its name, a plain line (`cardLine`) and what is in it in words (`cardContents`:
  "Start · Shop", up to four names then "and N more", or "Nothing made yet. Open it to start."); the whole card is its
  editor's button and an editor this build lacks lists its files by name, read only. Three cards a row in wide, two in
  medium, one in compact (the shell's own modes). Publish is "Put your game online": the mockup's sentence, three steps
  (Build your game, Download the zip, Upload it to itch.io or any website host) with the current one marked, and the
  dialog's one lime button is the one for the step. `screenChecks(document, size, { contrast, lime })` is in
  `src/testing/screen-checks.ts` and runs axe's `color-contrast` (`axe-core` 4.13.0, the site's version, is a dev
  dependency of the editor). The Home layout test runs it at all eight sizes in Dark and Light, with axe at 1194 × 834
  and 390 × 844 (the plan said 1440 × 900; the layout project's sizes are the eight in `layout-sizes.ts`, and 1194 × 834
  is the wide one). Rulings: (1) cards' counts such as "3 feels" need each editor to count its files; Home names the
  files instead, which every editor can do. (2) The card's name button is `--size-hit` tall, because the check measured the
  text-high button and its stretched press area is not what a pointer is held to. (3) Home's tests are written before the
  code and failed for the right reasons (no lede, no card lines). Ran: editor unit tests (279 files, 3380 tests), the
  layout project in Chromium (21 files, 397 tests), typecheck, knip, style, boundaries. Not run: WebKit, Firefox.
- 2026-11-08, build, Task 11: Levels 2D. A required field with no value says "Fill this in." (`missingWords`) with the
  field's owner named in the words ("Give this character a name."), and a stat's words are the player's ("Hits to beat
  it", not "hp"). The brush size is the toolbar's second group beside the tools (under them with its words when the stage
  is narrow) and stays a popover only on a phone's dock; the dock sits at the foot in compact and in a column at the left
  when a phone is held sideways (`CanvasContext { mode }`, which `Suite` hands every editor's canvas). The Levels start
  page, the characters panel and the empty list are `EmptyState`s, and Save, Share, Problems and the Tiles stage lose
  their lime: lime is the Publish button alone in this editor. Rulings: (1) `EmptyState` takes children so a start page
  can hold its own form, which Writer and Sequence use in Task 12. (2) The error panel keeps its one lime confirm, because
  it is a dialog and a dialog's own confirm is the second layer's one. (3) The card's name button also gets
  `--size-hit` of width: with touch the short word "Tuner" was 41 px wide, which the touch layout project caught
  (the mouse project's floor is 32). Ran: editor unit tests, the layout project in Chromium with and without touch (the
  shell, home, tab bar and Levels files), typecheck. Not run: WebKit, Firefox.
- 2026-11-08, build, Task 12: Tuner, Feel, Audio, Writer and Sequence. Start pages in all four content editors are
  `EmptyState`s (one heading, one line, one button; Writer's holds its scene-name field, Sequence's its name-and-length
  form), every `variant="primary"` in the extension is gone, each effect (Feel) and each tone or hiss (Audio) is a kit
  `Block` with its Remove in the head, the editors' page is a centred 720 px column whose sections are divided by a hairline
  and not boxed, the Sequence playhead and the Tuner's new "Playing" dot beside the running game are lime, and the
  switches (Less flashing, Rumble, Reduce motion, a duck's buses, a sound's flags) are one `Check` whose whole row is the
  press target. `screenChecks` runs on all four editors at a phone and an iPad in Dark and Light (with axe) and on the
  Tuner at all eight sizes in both themes. Rulings: (1) `FieldRow` stays as a thin wrapper over the kit `Field` (its commit and
  refusal rules are the editors', not the kit's) instead of being deleted with every caller moved: the callers
  would all have been the same one-line change. It uses `Field`'s `labelled` form with a native `<label for>`, because
  a group named by the same words made every test and every screen reader find each field twice. (2) The kit's
  `Block` is a `section`, so the editors' tests find a block by the `region` role. (3) The audio rules and the
  unanswered-events list stay sections divided by hairlines and not `Block`s: they are not repeated items with fields of
  their own. (4) The native checkbox measured 13 px to the checks, and a transparent 44 px input over a drawn 18 px box is
  the smallest change that keeps native behaviour. Ran: extension unit tests (53 files, 645 tests), the extension layout
  project in Chromium with and without touch, the Tuner layout test, typecheck, style, boundaries. Not run: the content
  editors' journeys (Task 14 runs them with the whole set), WebKit, Firefox.
- 2026-11-08, build, Task 13: Schematic. `layoutAgent` takes `tall`: the board is worked out as a wide one with its boxes
  and labels turned on their side and turned back, so the modes, their order and every arrow are the same and only the
  place differs; boxes keep their own size, so no word is cut. The board lays out tall when its area (its pane's width
  against the 70 % of the window it may take) is narrower than it is high, so it follows the area and not the device:
  tall at 390 × 844 and 820 × 1180, wide at 1440 × 900. The board sits on the stage (dotted floor, both looks) with its
  Bigger, Smaller and Fit as a floating toolbar, the switches list is `Row`s, and the inspectors' fields are the kit's
  `Field` through `FieldRow`. Rulings: (1) the area's height is the 70 % cap the board already had (now set inline from one
  constant), since the board's own height depends on how it lays out and measuring it would flip it back and forth.
  (2) The extension's unit setup gets an inert `ResizeObserver`, as jsdom has no layout; components that size from their area
  keep the wide answer there. (3) The populated board's `screenChecks` run in the suite's shell (the content editors' layout
  test now lists Schematic, on the sample game's characters), not in a bare mount, which has none of the theme's tokens.
  Tests first: the layout's new cases and the browser test of the tall board went red for the right reasons (with the tall
  switch forced off: "expected 3 to be greater than 5"). Ran: extension unit tests (655), the extension layout project
  in Chromium with and without touch (6 files), svelte-check. Not run: the Schematic journeys (Task 14), WebKit, Firefox.
- 2026-11-08, build, Task 14: the 3D editors' buttons are secondary (done with Task 13's 3D pass; `lime-only-in-dialogs.test.ts`
  holds it), and the whole set was played. Merge: the shared-editors fixes (PR #534, first at `2ca3eae9`, then its new tip
  `3736b0ac`) are merged into this branch in two commits, `ae5c644c` and `4c77b7ea`. Rulings: (1) the v2 look wins where the two
  disagree (icons, rail at 76 px, header and sidebar), and the shared-editors structure wins where they do not (entries, kinds,
  `NoPlayer`, the Characters entry, the story level's wall); #534's `SuiteTopBar` change is dropped because v2's header replaced the
  file, and the header test takes its 360 px phone, which the v2 header passes. (2) `EntitiesPanel` keeps v2's empty state and takes
  the split of characters from things. (3) The rail's 68 px override is dropped: v2's 76 px holds the longest name. (4) `axe-core`
  is recorded in `docs/versions.md`, and `STICK_DIRECTIONS` and `PROMPT_COPY` got a doc comment so the API index writes again.
  (5) `dark-game-loop` now runs on a light device with nothing stored, asserts the editors open Dark, and the game page carries no
  theme of its own; it still paints a wall, rewrites a Feel word, plays, and publishes. Rulings (6): the played-game proof for every
  editor stays in `complete-game-2d` and `complete-game-3d` (all eight editors, both kinds), not copied into `dark-game-loop`, since
  both now run in the v2 look (Dark by default). (7) Journeys follow the new shell: Characters is a rail entry, a closed sheet's rows
  are inert (so the helpers test for that, not for visibility), the camera is read once it stops moving, the sheet is closed before a
  tap on the canvas, an open More sheet is closed before Play, Home's cards open an editor on a phone, Share is a plain button
  (Publish is the one lime), and a light device opens Dark unless Light was chosen (the Light look is proved by choosing it).
  Ran (Chromium only): editor unit (3454), layout with and without touch (942, 471), canvas, extension unit (684) and layout (112),
  `pnpm check`, `pnpm build`, the editor journeys at a phone and an iPad (61 pass, 5 expected failures stated in the journeys), and
  the extension journeys (all pass but one). Open: `audio-plays-in-game` (iPad and phone): after the keeper's talk the played
  player does not move, so the guard never chases. It is not the new `character` tag (tested with it removed) and not editor UI; the
  merged story code is the suspect and the build audit should check it. Not run: WebKit, Firefox, the GPU runner, the site's e2e and
  parity, the visual baselines (this repo's editors have none beyond the layout tests' screenshots, which are not compared).

**CI fix on the draft PR (3D parity, 2026-11-09).** The `3D - parity` check was red on `editor-3d`'s layout tests, which still
measured the old chrome. Rulings: (8) the 3D layout helpers and tests import `tool-chrome.css` (the production suite does; without
it `--size-field` is undefined and a Picker draws 20 px high) and read their target sizes from `editorTargets()` (28/32 with a
mouse, 44/48 with touch) instead of the literals 44 and 48; (9) the Studio's stage threshold at the wide mode is 320 px, as the
Levels view's is, since the 224 px sidebar leaves about 370 at an iPad landscape; (10) a real bug: at 900 px the header's problem
count and save state shrank into each other, so both are `flex: none` and the editor's tools are what give way and scroll. Ran:
`editor-3d` layout, canvas and journeys in Chromium (the canvas and draw-journey timeouts under full load pass alone, a software
GL cold start), the editor's unit and suite-shell layout tests. Not run: WebKit and Firefox (not installed here), the GPU runner.
- 2026-11-09, build audit (stage 5), [`2026-11-09-editors-v2-build-audit.md`](2026-11-09-editors-v2-build-audit.md), at
  `68cdd642`: `audio-plays-in-game` failed because the journey opened the game before the music rules' new order was
  served (the guard does chase); fixed with three more journey races, and `work-survives-reopening` added. Open for the
  fixes stage: F1 to F12 (3 high: the header's breadcrumb and cut level name on the iPad, the phone's three-row header, a
  white strip over the phone's level). Task 14 Steps 2 to 4 are ticked with checks that did not run (F6).
