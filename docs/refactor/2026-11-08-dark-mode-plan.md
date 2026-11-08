# Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (no
> subagents in this project). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every editor screen has a light and a dark look, following the device by default, with one "Colours" control
on each Home; the game's pictures keep their colours.

**Architecture:** The editors' own token layer gains a second value per colour: `tool-theme.json` (`light` and `dark`)
is generated into `tool-theme.css` as `light-dark()` pairs, which `tool-chrome.css` imports. `<html data-theme>` forces a
look; without it `color-scheme: light dark` follows the device. A kit module (`shared/kit/theme/`) reads and writes the
choice; a classic `<head>` script sets the attribute before the first paint; a `ThemeChoice` widget sits on each Home.

**Tech Stack:** CSS `light-dark()` and `color-scheme`, Svelte 5 runes, Vitest 5 (jsdom; browser mode with Playwright),
Playwright journeys (`playwright.journeys.config.ts`).

**Spec:** [`2026-11-08-dark-mode-spec.md`](2026-11-08-dark-mode-spec.md).

**Base:** this plan was written on PR #498's branch (the content editors and the suite). The build starts once the editor
stack has merged to `main`, or, if it has not, on a merge of the open tops that carry the suite and the content editors
(#498), Schematic (#497) and Levels 3D (#499): the build thread names the base it used in the log. Every path below exists
on those branches.

## Global Constraints

- The light look does not move a pixel: light values are today's (`tokens.css` and `tool-chrome.css` as of this plan).
  The existing visual and journey suites in light pass unchanged.
- The game's pictures keep their colours in both looks (spec §1): no canvas, game preview or Pixi colour changes.
- The website is untouched: nothing is added to `tokens.json` or `tokens.css`.
- Chrome stays neutral grey with one flat lime primary; corners 4/6/8 px, no pill, no glow, no glass
  (`editor-corners.test.ts` still passes).
- Copy, verbatim: label **Colours**; options **Light**, **Dark**, **Match device**.
- Storage key `automata-editor:theme`, values `light` or `dark`; no key means Match device.
- Contrast: words 4.5:1, focus ring 3:1 (spec §5.1), in both looks.
- Touch targets 44 px, primary 48 px on touch; 32 px with a fine pointer (the existing density rules).
- The three packages are private: no changeset. Failing test first; `pnpm format`, then the package's `test:unit` and
  `typecheck`, before each commit. Conventional Commits.
- Every audit of this work makes and plays a small game in the editors in dark (the Owner's 2026-11-08 audit rule).

## Review Focus

1. **A stored choice on a device set the other way.** A Mac in light with `dark` stored opens dark on the first frame,
   with no light flash. Test in Task 3 (unit, the boot script) and Task 6 (browser, first frame).
2. **Storage refused** (Safari private mode, blocked site data). The page opens in Match device, the control still
   changes the look for this visit, nothing throws. Test in Task 3.
3. **The OS switches while the editor is open** in Match device. The look follows at once without a reload, because
   nothing is cached in script. Test in Task 6 (emulated colour scheme changed mid-test).
4. **Words on a colour.** The lime Publish button and a cobalt-filled chip keep dark words in dark (`--on-lime`,
   `--on-accent`), never `--ink`. Test in Task 1 (contrast) and Task 2 (no `--ink` on a primary fill).
5. **A component reading a token that does not exist** (today's `--color-danger`). It silently uses the fallback, which
   is wrong in one look. Test in Task 2 (every `var()` resolves).

---

### Task 1: The dark tokens, generated, with the contrast test

**Files:**

- Create: `packages/editor/src/shared/kit/tokens/tool-theme.json`
- Create: `packages/editor/src/shared/kit/tokens/tool-theme-to-css.ts`
- Create (generated): `packages/editor/src/shared/kit/tool-theme.css`
- Create: `packages/editor/src/shared/kit/tokens/contrast.ts`
- Modify: `packages/editor/scripts/generate-tokens.ts` (also writes and checks `tool-theme.css`)
- Modify: `packages/editor/src/shared/kit/tool-chrome.css` (imports `./tool-theme.css` first; the colour aliases move
  into the theme; the density rules stay)
- Modify: `packages/editor/src/shared/kit/tokens/editor-tokens.ts` (drop the "light only" note; add `ToolTheme`)
- Modify: `packages/editor/package.json` (export `./tool-chrome.css`)
- Test: `packages/editor/tests/unit/shared/kit/tokens/tool-theme.test.ts`

**Interfaces:**

- Produces: `interface ToolTheme { readonly light: Readonly<Record<string, string>>; readonly dark:
Readonly<Record<string, string>> }` in `editor-tokens.ts`.
- Produces: `toolThemeToCss(theme: ToolTheme): string` — a do-not-edit header, then
  `:root { color-scheme: light dark; --name: light-dark(<light>, <dark>); … }`,
  `:root[data-theme='light'] { color-scheme: light; }`, `:root[data-theme='dark'] { color-scheme: dark; }`. Throws on a
  key in one look and not the other, a bad name (the `tokensToCss` rule), or a value that is not a colour (a hex or
  `rgb()`): `light-dark()` takes colours only.
- Produces: `contrast(a: string, b: string): number` — WCAG 2.x ratio of two `#rrggbb` colours; `rgb(r g b / a)` is
  composited over `b` first.
- Produces: package export `@automata/editor/tool-chrome.css`.

The JSON's keys and values are the spec §3.2 table. Light values copy today's. The names it defines:
`tool-bg`, `tool-panel`, `tool-hover`, `tool-selected`, `tool-line`, `tool-line-strong`, `tool-muted`, `tool-faint`,
`tool-stage`, `ink`, `cobalt`, `ok`, `bad`, `warn`, `danger-wash`, `scrim`, `shadow-ink`, `on-lime`, `on-accent`,
`primary-edge`. Then `tool-chrome.css` keeps today's aliases (`--bg: var(--tool-bg)` …) and adds
`--primary-ink: var(--on-lime)`, `--color-accent-ink: var(--on-accent)`, `--shadow: 0 1px 2px var(--shadow-ink)`,
`--shadow-sheet: 0 0 0 1px var(--line-strong), 0 12px 32px var(--shadow-ink)`. In light, `--shadow-sheet`'s ring was
`rgb(17 21 28 / 0.1)`; if that differs visibly from `--line-strong` on the design board, keep a `shadow-ring` token for it
instead — light must not move (Global Constraints).

- [ ] **Step 1: Write the failing tests** in `tool-theme.test.ts`:
  - `tool-theme.css equals toolThemeToCss(tool-theme.json)` (the `tokens.test.ts` pattern; run
    `pnpm --filter @automata/editor tokens` after editing).
  - `light values are today's`: for each key also in `tokens.json` or today's `tool-chrome.css`, the light value equals
    the value it had (hard-code today's values in the test as the table in spec §3.2).
  - `words read in both looks`: for `look` of `light`, `dark`; for `fg` of `ink`, `tool-muted`, `tool-faint`, `cobalt`,
    `ok`, `bad`, `warn`; for `bg` of `tool-bg`, `tool-panel`, `tool-hover`, `tool-selected`:
    `expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)`.
  - `on-lime` on `#cbf25c` ≥ 4.5; `on-accent` on `cobalt` ≥ 4.5 (both looks).
  - `the focus ring shows`: `cobalt` on `tool-bg` and `tool-panel` ≥ 3.
  - `the level stays the brightest thing`: luminance of `tool-stage` < luminance of `tool-bg` in dark.
  - `toolThemeToCss refuses` a key missing from `dark`, a name `Bad_Name`, and a value `0 1px 2px red`.
  - `contrast('#000000', '#ffffff')` is 21; `contrast('#ffffff', '#ffffff')` is 1.
- [ ] **Step 2: Run** `pnpm --filter @automata/editor exec vitest run --project unit tests/unit/shared/kit/tokens` —
      expected FAIL: `tool-theme.json` and the modules do not exist.
- [ ] **Step 3: Implement** `contrast`, `toolThemeToCss`, the JSON, the script change and the `tool-chrome.css` change.
      If a dark value from the spec fails a contrast assertion, change the value (never the threshold) and log it.
- [ ] **Step 4: Run** the same command — PASS. Run the whole unit project and `editor-corners.test.ts` — PASS.
- [ ] **Step 5: Commit** `feat(editor): dark values for the tool chrome, generated, with a contrast test`.

### Task 2: Every editor page and component on the tokens

**Files:**

- Modify: `packages/editor-3d/src/app/main.ts`, `packages/editor-3d/src/app/suite/suite-main.ts`,
  `extensions/editors/src/app/suite/main.ts` (import `@automata/editor/tool-chrome.css` after `tokens.css`)
- Modify: `packages/editor/src/features/level/LevelPanel.svelte:121`,
  `packages/editor/src/features/characters/AnimationSection.svelte:379` (`var(--color-state-bad)`)
- Modify: `packages/editor-3d/src/features/levels-3d/walk/WalkHud.svelte`, `walk/WalkSticks.svelte`,
  `plan/NudgePad.svelte`, `plan/NewSectorCard.svelte`, `studio/ui/StudioPanel.svelte`, `studio/ui/PoseFields.svelte`,
  `studio/ui/StudioCanvas.svelte` (drop the `var(--x, literal)` fallbacks)
- Test: `packages/editor/tests/unit/shared/kit/editor-colours.test.ts`

**Interfaces:**

- Consumes: `tool-theme.json`, `tokens.json`, `tool-chrome.css` from Task 1.
- Produces: `GAME_PICTURE_ALLOW: readonly { file: string; reason: string }[]` in the test — the only places a literal
  colour may stay (spec §2.1 last row): `features/level/Palette.svelte` and `features/tiles/TilesetSheet.svelte` (text
  shadow on a tile), `levels-3d/plan/PlanCanvas.svelte`, `levels-3d/walk/WalkCanvas.svelte`,
  `levels-3d/dollhouse/DollhouseCanvas.svelte` (`#0c0d10`, the game view's field),
  `extensions/editors/src/features/sequence/SequencePreview.svelte` (`fill: black`, the game's letterbox),
  `app/design/DesignBoard.svelte` and `testing/**` (sample swatches, not chrome).

- [ ] **Step 1: Write the failing tests** in `editor-colours.test.ts`, scanning the `<style>` of every `.svelte` under
      `packages/editor/src`, `packages/editor-3d/src` and `extensions/editors/src` (and, on a base with Schematic, its
      folder), plus the template literals passed to `style=` in `extensions/editors/src/**/*.ts`:
  - `no colour literal outside the game pictures`: no `#hex`, `rgb(`, `hsl(`, or bare `white`/`black` colour value
    (ignore `white-space`, comments) in a file not in `GAME_PICTURE_ALLOW`.
  - `no fallback colours`: no `var(--…, <colour>)` anywhere.
  - `every var() resolves`: each `var(--name)` read is defined in `tokens.css`, `tool-theme.css`, `tool-chrome.css`,
    `shell-*.css`, or set in the same component (`--name:` or `style:--name`).
  - `words on lime are not ink`: no rule that sets `background: var(--primary` or `var(--lime` also sets
    `color: var(--ink)`.
  - `every editor entry imports tool-chrome.css`: each of the three entries named above and every
    `packages/editor/src/app/*/main.ts` imports it.
- [ ] **Step 2: Run** `pnpm --filter @automata/editor exec vitest run --project unit tests/unit/shared/kit/editor-colours.test.ts`
      — expected FAIL naming `--color-danger`, the 3D fallbacks and the three entries without `tool-chrome.css`.
- [ ] **Step 3: Make the listed edits.**
- [ ] **Step 4: Run** the test — PASS. Run `pnpm --filter @automata/editor-3d test:unit` and
      `pnpm --filter @automata/editors test:unit` — PASS. Open the 3D suite and the content editors in light once: they now
      draw the approved tool look (they drew the website's field before); look at a before and after screenshot of the 3D
      suite Home and Feel at 1180×820 and log the difference. This is the one intended light change, and only for those
      pages.
- [ ] **Step 5: Commit** `fix(editors): every editor page draws the tool chrome and reads only tokens`.

### Task 3: The choice, remembered, set before the first paint

**Files:**

- Create: `packages/editor/src/shared/kit/theme/theme-choice.ts`
- Modify: `packages/editor/index.html`, `suite.html`, `design.html`, `packages/editor-3d/index.html`,
  `packages/editor-3d/suite.html`, `extensions/editors/suite.html` (`<meta name="color-scheme" content="light dark">`
  and the boot script, first in `<head>` after the charset)
- Modify: `packages/editor/src/entries/kit-core.ts` (export the module)
- Test: `packages/editor/tests/unit/shared/kit/theme/theme-choice.test.ts`,
  `packages/editor/tests/unit/shared/kit/theme/theme-pages.test.ts`

**Interfaces:**

- Produces, in `theme-choice.ts`:
  - `type ThemeChoice = 'light' | 'dark' | 'device'`
  - `const THEME_KEY = 'automata-editor:theme'`
  - `readThemeChoice(storage: () => Pick<Storage, 'getItem'> | undefined): ThemeChoice` — `'light'`/`'dark'` when
    stored, else `'device'`; a throw or any other value is `'device'`.
  - `writeThemeChoice(choice: ThemeChoice, storage: () => Pick<Storage, 'setItem' | 'removeItem'> | undefined): void` —
    `'device'` removes the key; a throw is swallowed.
  - `applyThemeChoice(choice: ThemeChoice, root: HTMLElement): void` — sets `data-theme` to the choice, or removes it for
    `'device'`.
  - `const THEME_BOOT: string` — the exact `<script>…</script>` text: a classic script that reads the key in a
    `try`, and sets `document.documentElement.dataset.theme` only to `light` or `dark`.

- [ ] **Step 1: Write the failing tests.** `theme-choice.test.ts`: stored `dark` reads `'dark'`; stored `blue` reads
      `'device'`; a `getItem` that throws reads `'device'`; `writeThemeChoice('device')` calls `removeItem(THEME_KEY)`; a
      `setItem` that throws does not throw; `applyThemeChoice('dark', root)` sets `root.dataset.theme === 'dark'` and
      `'device'` removes it; running `THEME_BOOT`'s script body in jsdom with stored `dark` sets the attribute, with stored
      `blue` or a throwing `localStorage` sets nothing. `theme-pages.test.ts`: each of the six HTML pages contains
      `THEME_BOOT` verbatim before its first `<link>` or module `<script>`, and `content="light dark"`.
- [ ] **Step 2: Run** `pnpm --filter @automata/editor exec vitest run --project unit tests/unit/shared/kit/theme` —
      FAIL: module missing.
- [ ] **Step 3: Implement** the module and edit the six pages (paste `THEME_BOOT` exactly).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(editor): remember the editors' colours and set them before the first paint`.

### Task 4: The Colours control on each Home

**Files:**

- Create: `packages/editor/src/shared/kit/theme/ThemeChoice.svelte`
- Modify: `packages/editor/src/entries/kit.ts` (export `ThemeChoice`)
- Modify: `packages/editor/src/features/suite/shell/SuiteHome.svelte`,
  `packages/editor/src/features/home/Home.svelte` (Levels 2D's standalone Home),
  `packages/editor-3d/src/features/levels-3d/home/Home.svelte` (the widget at the foot, under the cards)
- Test: `packages/editor/tests/unit/shared/kit/theme/theme-choice-widget.test.ts`,
  the existing Home DOM tests of the three Homes (one assertion each that the control is there)

**Interfaces:**

- Consumes: Task 3's functions; the kit's `Segmented` (`look="track"`).
- Produces: `ThemeChoice.svelte` with props `{ storage?: () => Storage | undefined; root?: HTMLElement }` (defaults
  `() => globalThis.localStorage` in a `try` and `document.documentElement`, injectable for tests). It reads the choice
  once on mount, and on a `set` edit event writes and applies it.

- [ ] **Step 1: Write the failing tests:** renders a radio group named `Colours` with options `Light`, `Dark`,
      `Match device` in that order; with nothing stored `Match device` is checked; choosing `Dark` sets
      `root.dataset.theme` to `dark`, stores `dark`, and leaves focus on the `Dark` option; choosing `Match device` removes
      both; with a storage that throws, choosing `Dark` still sets the attribute and throws nothing. Each Home's test:
      `getByRole('radiogroup', { name: 'Colours' })` exists.
- [ ] **Step 2: Run** the package's unit project — FAIL: no widget.
- [ ] **Step 3: Implement** the widget and place it on the three Homes. On a phone at 390×844 the three options fit one
      row at 44 px (the `Segmented` track); if `Match device` truncates, the row wraps under the label rather than
      shrinking a target.
- [ ] **Step 4: Run** `test:unit` in `editor`, `editor-3d` — PASS.
- [ ] **Step 5: Commit** `feat(editor): a Colours control on each Home`.

### Task 5: Both looks on the design board

**Files:**

- Modify: `packages/editor/src/app/design/DesignBoard.svelte` (a `ThemeChoice` at the top; the board already shows
  every widget)
- Modify: `packages/editor/tests/e2e/design-board.test.ts` (screenshots in both looks)

- [ ] **Step 1:** Extend `design-board.test.ts` to take the board with `colorScheme: 'dark'` as well as light, and to
      assert `getComputedStyle(document.body).backgroundColor` is `rgb(19, 20, 23)` (`#131417`) in dark and
      `rgb(247, 247, 248)` in light (the values from `tool-theme.json`; read them from the JSON in the test).
- [ ] **Step 2: Run** `pnpm --filter @automata/editor design:board` — FAIL until the board has the control and the
      dark screenshot exists.
- [ ] **Step 3:** Add the control. Look at every widget in dark: words, edges, focus ring, the lime button, the
      disabled states, the colour field. Fix a token (Task 1's JSON) for anything unreadable, never a component.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `test(editor): the design board in both looks`.

### Task 6: Real browsers: first frame, the device switching, the game unchanged

**Files:**

- Create: `packages/editor/tests/browser/layout/shared/kit/theme/theme.test.ts`
- Create: `packages/editor-3d/tests/browser/layout/theme.test.ts` (or the package's layout folder)

- [ ] **Step 1: Write the failing tests** (layout project, Chromium; WebKit and Firefox where the runner has them):
  - `first frame`: with the page emulated light and `localStorage` holding `dark`, load the suite page; in the first
    `requestAnimationFrame` the body's background is the dark `--tool-bg`.
  - `follows the device`: with no stored choice, emulate `dark` → dark field; switch the emulation to `light` mid-test
    → light field, no reload.
  - `a forced choice wins`: emulate `dark`, choose `Light` → light field.
  - `the game keeps its colours`: open the sample level in Levels 2D in light, read the level canvas's pixels; choose
    Dark; read them again; identical. Same for the 3D Plan canvas and the Tuner's live view.
  - `targets stay`: the `Colours` options are at least 44 px tall with a coarse pointer at 390×844.
- [ ] **Step 2: Run** `pnpm --filter @automata/editor exec vitest run --project layout --browser.name=chromium
tests/browser/layout/shared/kit/theme` — FAIL before Tasks 1 to 4, PASS after (if run after them, confirm it fails by
      reverting the boot script once).
- [ ] **Step 3: Run** the 3D package's layout test the same way — PASS.
- [ ] **Step 4: Commit** `test(editor): the colours in real browsers, and the game unchanged`.

### Task 7: Every editor in dark, looked at

**Files:**

- Modify: only `tool-theme.json` (and its generated CSS) for any colour that reads badly; a component only if Task 2's
  scan missed it, with the scan widened in the same commit.
- Output: `/mnt/project-files/dark-mode/<editor>-<size>.png`

- [ ] **Step 1:** With `colorScheme: 'dark'`, take screenshots at 390×844, 844×390, 820×1180, 1180×820 and 1440×900
      (deviceScaleFactor 2) of: suite Home, Levels 2D (with a character selected and the Add tiles sheet open), Levels 3D
      Plan and Walk, the Studio, the Tuner, Feel, Audio, Writer, Sequence, Schematic, the Publish dialog and the Ask dialog.
- [ ] **Step 2:** Look at each one (AGENTS.md: a screenshot is looked at, not trusted). For each: are all words
      readable, are control edges visible, is any light box left, is the game picture unchanged, is there exactly one lime
      button. Write a one-line verdict per screenshot in the plan log.
- [ ] **Step 3:** Fix what Step 2 found in the JSON; rerun Task 1's tests and retake the affected shots.
- [ ] **Step 4:** Drunk grandma test on the control, recorded in the log: on a phone in dark, could a drunk grandma tell
      what "Colours" does and get back to light? Note the answer and change the words only if it fails (then update the spec
      §3.3 and Global Constraints together).
- [ ] **Step 5: Commit** `fix(editor): dark colours from the review of every editor` (or skip if nothing changed, and
      say so in the log).

### Task 8: Make and play a small game in dark

**Files:**

- Create: `packages/editor/tests/e2e/journeys/dark-game-loop.test.ts` (the `whole-game-loop.test.ts` journey, run with
  `colorScheme: 'dark'`)

- [ ] **Step 1: Write the journey** reusing `whole-game-loop.test.ts`'s helpers: with the device dark, create a game,
      open Levels 2D, paint tiles and place a character, change a number in the Tuner, write a line in Writer (on a base that
      has the content editors in the served suite; otherwise name the step as not run), Play, assert what was made shows in
      the game and that the game page's canvas pixels match the same journey's light run, then Publish and assert the zip
      arrives. Assert the editor pages had `color-scheme` dark (computed body background equals the dark `--tool-bg`).
- [ ] **Step 2: Run** `pnpm --filter @automata/editor test:e2e -- dark-game-loop --trace off` — PASS.
- [ ] **Step 3:** Play it by hand once in the served editor in dark (the audit rule), and log what was made and what
      showed in play.
- [ ] **Step 4: Commit** `test(editor): make, play and publish a game with the editors in dark`.

### Task 9: Docs and progress

**Files:**

- Modify: `docs/refactor/progress.md` (a "Dark mode" section: stages, tasks done with evidence, what ran and what did
  not)
- Modify: this plan's log (below)
- Modify: `docs/refactor/2026-11-06-editor-visual-direction.md` (one paragraph: the dark look, the tokens, the rule
  that the game keeps its colours)

- [ ] **Step 1:** Write the three. Run `pnpm format` and `pnpm check`. Report the gates: what ran, what was left out
      (WebKit and Firefox off the runner, the GPU suites pending CI), what is pending.
- [ ] **Step 2: Commit** `docs(refactor): dark mode in progress and the visual direction`.

## Log

- 2026-11-08: spec and plan written (stage 1). Base: PR #498's branch. Findings while reading the code: the 3D suite and
  the content editors' suite page never imported `tool-chrome.css` (Task 2); three pages declared `color-scheme: dark`
  on a light page (Task 3); `--color-danger` is read but never defined (Task 2).
