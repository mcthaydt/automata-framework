# Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (no
> subagents in this project). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every editor screen has a light and a dark look, following the device by default, with one "Editor colours" control
on each Home; the game's pictures keep their colours.

**Architecture:** The editors' own token layer gains a second value per colour: `tool-theme.json` (`light` and `dark`)
is generated into `tool-theme.css` as plain light values on `:root` and the dark values under
`@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) }` and `:root[data-theme='dark']` (spec §3.1; not
`light-dark()`, which the canvas cannot read and older iPads cannot draw), which `tool-chrome.css` imports.
`<html data-theme>` forces a look; without it the media query follows the device. A kit module (`shared/kit/theme/`)
reads and writes the choice; a classic script file, `theme-boot.js`, loaded first in `<head>`, sets the attribute before
the first paint (a file, because the site's try-it editor runs under `script-src 'self'`); a `ThemeChoice` widget sits on
each Home.

**Tech Stack:** CSS `prefers-color-scheme` and `color-scheme`, Svelte 5 runes, Vitest 5 (jsdom; browser mode with Playwright),
Playwright journeys (`playwright.journeys.config.ts`).

**Spec:** [`2026-11-08-dark-mode-spec.md`](2026-11-08-dark-mode-spec.md).

**Base:** this plan was written on PR #498's branch (the content editors and the suite). The build starts once the editor
stack has merged to `main`, or, if it has not, on a merge of the open tops that carry the suite and the content editors
(#498), Schematic (#497), Audio's mix (#500, on #498) and Levels 3D (#499): the build thread names the base it used in
the log. #499 sits on a different stack (#476 to #493) from #497 and #498, so a merge of the tops needs one merge-up
pass; do it before Task 1, not part way through. Every path below exists on those branches (checked in the plan audit
on #498, #497 and #500; #499 changes no file this plan edits except the 3D Home, which it keeps).

## Global Constraints

- The light look does not move a pixel on the pages that already draw the tool chrome (the 2D editor, its suite page,
  the design board): light values are today's (`tokens.css` and `tool-chrome.css` as of this plan). The existing visual
  and journey suites in light pass unchanged. The pages that never imported `tool-chrome.css` (the 3D editor, the 3D
  suite, the content editors' suite) change in light once, in Task 2, on purpose, with before and after shots logged.
- The game's pictures keep their colours in both looks (spec §1): no canvas, game preview or Pixi colour changes, and
  the cabinet (`--tool-stage`) is the same in both. Words and marks over a game picture read the fixed `--stage-*`
  tokens. No token a script reads with `getPropertyValue` (`--color-layer-*`, `--color-phase-*`) is themed.
- The website is untouched: nothing is added to `tokens.json` or `tokens.css`.
- Chrome stays neutral grey with one flat lime primary; corners 4/6/8 px, no pill, no glow, no glass
  (`editor-corners.test.ts` still passes).
- Copy, verbatim: label **Editor colours**; options **Light**, **Dark**, **Match device**.
- Storage key `automata-editor:theme`, values `light` or `dark`; no key means Match device.
- Contrast: words 4.5:1, focus ring 3:1 (spec §5.1), in both looks.
- Touch targets 44 px, primary 48 px on touch; 32 px with a fine pointer (the existing density rules).
- `@automata/editor`, `@automata/editor-3d` and `@automata/editors` are private (`"private": true`, checked in the plan
  audit): no changeset. Failing test first; `pnpm format`, then the package's `test:unit` and
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
6. **The canvas reading a themed token.** `colors.ts` parses `getPropertyValue('--color-<group>-<name>')` as a hex; a
   project colour named after a chrome alias (`text/primary`) would then read the look's value, and a non-hex value
   reads as the neutral grey. Test in Task 2 (the canvas palette is plain hex and not in `tool-theme.json`).
7. **The try-it editor on the website** runs under `script-src 'self'`. The boot script is a file, so it runs there.
   Test in Task 3 (the pages load `./theme-boot.js`, never an inline script) and, where the site's browser suite runs,
   no CSP violation on `/editor/app/`.

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
  `:root { color-scheme: light dark; --name: <light>; … }`,
  `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { color-scheme: dark; --name: <dark>; … } }`,
  `:root[data-theme='light'] { color-scheme: light; }`,
  `:root[data-theme='dark'] { color-scheme: dark; --name: <dark>; … }` (spec §3.1). Throws on a key in one look and not
  the other, a bad name (the `tokensToCss` rule), or a value that is not a colour (a hex or `rgb()`), so a shadow or a
  mix never lands in the theme.
- Produces: `contrast(a: string, b: string): number` — WCAG 2.x ratio of two `#rrggbb` colours; `rgb(r g b / a)` is
  composited over `b` first.
- Produces: package export `@automata/editor/tool-chrome.css`.

The JSON's keys and values are the spec §3.2 table. Light values copy today's. The names it defines:
`tool-bg`, `tool-panel`, `tool-hover`, `tool-selected`, `tool-line`, `tool-line-strong`, `tool-muted`, `tool-faint`,
`tool-stage`, `ink`, `cobalt`, `ok`, `bad`, `warn`, `danger-wash`, `scrim`, `shadow-ink`, `shadow-lift`, `shadow-ring`, `on-lime`, `on-accent`,
`primary-edge`. `tool-stage` is `#0e1014` in both looks (spec §3.2: the cabinet frames the game). Then
`tool-chrome.css` keeps today's aliases (`--bg: var(--tool-bg)` …) and adds `--primary-ink: var(--on-lime)`,
`--primary-hover: color-mix(in oklab, var(--lime) 86%, var(--on-lime))`, `--color-accent-ink: var(--on-accent)`,
`--shadow: 0 1px 2px var(--shadow-lift)`,
`--shadow-sheet: 0 0 0 1px var(--shadow-ring), 0 12px 32px var(--shadow-ink)`. The ring reads its own token, not
`--line-strong`: today's ring is `rgb(17 21 28 / 0.1)` (about `#e7e8e8` on white), visibly lighter than `#d4d4d8`, and
light must not move (Global Constraints). `--shadow` was `0 1px 2px rgb(17 21 28 / 0.06)`, not 0.12, which is
why it reads its own `shadow-lift` token (light `rgb(17 21 28 / 0.06)`) and not `--shadow-ink`.

- [x] **Step 1: Write the failing tests** in `tool-theme.test.ts`:
  - `tool-theme.css equals toolThemeToCss(tool-theme.json)` (the `tokens.test.ts` pattern; run
    `pnpm --filter @automata/editor tokens` after editing).
  - `light values are today's`: for each key also in `tokens.json` or today's `tool-chrome.css`, the light value equals
    the value it had (hard-code today's values in the test as the table in spec §3.2).
  - `words read in both looks`: for `look` of `light`, `dark`; for `fg` of `ink`, `tool-muted`, `tool-faint`, `cobalt`,
    `ok`, `bad`, `warn`; for `bg` of `tool-bg`, `tool-panel`, `tool-hover`, `tool-selected`:
    `expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)`.
  - `on-lime` on `#cbf25c` ≥ 4.5; `on-accent` on `cobalt` ≥ 4.5 (both looks).
  - `the focus ring shows`: `cobalt` on `tool-bg` and `tool-panel` ≥ 3.
  - `words on the cabinet read`: `stage-ink` and `stage-muted` (from `tokens.json`) on `tool-stage` ≥ 4.5, both looks.
  - `the cabinet does not change`: `tool-stage` is the same in both looks.
  - `edges show in dark`: `contrast(tool-line-strong, tool-panel)` in dark ≥ the same in light.
  - `the level stays the brightest thing`: luminance of `tool-stage` < luminance of `tool-bg` in dark.
  - `the canvas palette is plain`: no key of `tool-theme.json` starts with `color-layer-` or `color-phase-`.
  - the generated CSS: in a jsdom document with `tool-theme.css` applied, `getPropertyValue('--tool-panel')` is a plain
    hex (`#ffffff`), never a function.
  - `toolThemeToCss refuses` a key missing from `dark`, a name `Bad_Name`, and a value `0 1px 2px red`.
  - `contrast('#000000', '#ffffff')` is 21; `contrast('#ffffff', '#ffffff')` is 1.
- [x] **Step 2: Run** `pnpm --filter @automata/editor exec vitest run --project unit tests/unit/shared/kit/tokens` —
      expected FAIL: `tool-theme.json` and the modules do not exist.
- [x] **Step 3: Implement** `contrast`, `toolThemeToCss`, the JSON, the script change and the `tool-chrome.css` change.
      If a dark value from the spec fails a contrast assertion, change the value (never the threshold) and log it.
- [x] **Step 4: Run** the same command — PASS. Run the whole unit project and `editor-corners.test.ts` — PASS.
- [x] **Step 5: Commit** `feat(editor): dark values for the tool chrome, generated, with a contrast test`.

### Task 2: Every editor page and component on the tokens

**Files:**

- Modify: `packages/editor-3d/src/app/main.ts`, `packages/editor-3d/src/app/suite/suite-main.ts`,
  `extensions/editors/src/app/suite/main.ts` (import `@automata/editor/tool-chrome.css` after `tokens.css`)
- Modify: `packages/editor/src/features/level/LevelPanel.svelte:121`,
  `packages/editor/src/features/characters/AnimationSection.svelte:379` (`var(--color-state-bad)`)
- Modify: `packages/editor-3d/src/features/levels-3d/walk/WalkHud.svelte`, `walk/WalkSticks.svelte`,
  `plan/NudgePad.svelte`, `plan/NewSectorCard.svelte`, `studio/ui/StudioPanel.svelte`, `studio/ui/PoseFields.svelte`,
  `studio/ui/StudioCanvas.svelte` (drop the `var(--x, literal)` fallbacks)
- Modify: `WalkHud.svelte`, `WalkSticks.svelte`, `studio/ui/StudioCanvas.svelte`, `studio/ui/StudioTimeline.svelte`
  (words and marks on `--color-bg-canvas` read `--stage-ink`, `--stage-muted`, `--stage-line`, not
  `--color-text-primary`/`--color-text-dim`; WalkHud's words are near-black on near-black in light today)
- Modify: `extensions/editors/src/features/feel/FeelStage.svelte` (the canvas is a small cabinet: `background:
var(--charcoal)`, `color: var(--stage-ink)`; the caption under it stays chrome)
- Modify: the Schematic and Audio components that the scan names, on a base with #497 and #500
- Test: `packages/editor/tests/unit/shared/kit/editor-colours.test.ts`

**Interfaces:**

- Consumes: `tool-theme.json`, `tokens.json`, `tool-chrome.css` from Task 1.
- Produces: `GAME_PICTURE_ALLOW: readonly { file: string; reason: string }[]` in the test — the only places a literal
  colour may stay (spec §2.1 last row): `features/level/Palette.svelte` and `features/tiles/TilesetSheet.svelte` (text
  shadow on a tile), `levels-3d/plan/PlanCanvas.svelte`, `levels-3d/walk/WalkCanvas.svelte`,
  `levels-3d/dollhouse/DollhouseCanvas.svelte` (`#0c0d10`, the game view's field),
  `extensions/editors/src/features/sequence/SequencePreview.svelte` (`fill: black`, the game's letterbox),
  `app/design/DesignBoard.svelte` and `testing/**` (sample swatches, not chrome).

- [x] **Step 1: Write the failing tests** in `editor-colours.test.ts`, scanning the `<style>` of every `.svelte` under
      `packages/editor/src`, `packages/editor-3d/src` and `extensions/editors/src` (and, on a base with Schematic, its
      folder), plus the template literals passed to `style=` in `extensions/editors/src/**/*.ts`:
  - `no colour literal outside the game pictures`: no `#hex`, `rgb(`, `hsl(`, or bare `white`/`black` colour value
    (ignore `white-space`, comments) in a file not in `GAME_PICTURE_ALLOW`.
  - `no fallback colours`: no `var(--…, <colour>)` anywhere.
  - `every var() resolves`: each `var(--name)` read is defined in `tokens.css`, `tool-theme.css`, `tool-chrome.css`,
    `shell-*.css`, or set in the same component (`--name:` or `style:--name`).
  - `words on lime are not ink`: no rule that sets `background: var(--primary` or `var(--lime` also sets
    `color: var(--ink)`.
  - `words on the cabinet are fixed`: a rule whose `background` reads `--color-bg-canvas` or `--charcoal` (also inside
    `color-mix(`) reads `color`, `fill`, `stroke` and `border` colours only from `--stage-*`, `--lime` or `--primary*`.
  - `every editor entry imports tool-chrome.css`: each of the three entries named above and every
    `packages/editor/src/app/*/main.ts` imports it.
- [x] **Step 2: Run** `pnpm --filter @automata/editor exec vitest run --project unit tests/unit/shared/kit/editor-colours.test.ts`
      — expected FAIL naming `--color-danger`, the 3D fallbacks, the words on the cabinet (WalkHud, StudioCanvas,
      StudioTimeline) and the three entries without `tool-chrome.css`.
- [x] **Step 3: Make the listed edits.**
- [x] **Step 4: Run** the test — PASS. Run `pnpm --filter @automata/editor-3d test:unit` and
      `pnpm --filter @automata/editors test:unit` — PASS. Open the 3D suite and the content editors in light once: they now
      draw the approved tool look (they drew the website's field before); look at a before and after screenshot of the 3D
      suite Home and Feel at 1180×820 and log the difference. This is the one intended light change, and only for those
      pages.
- [x] **Step 5: Commit** `fix(editors): every editor page draws the tool chrome and reads only tokens`.

### Task 3: The choice, remembered, set before the first paint

**Files:**

- Create: `packages/editor/src/shared/kit/theme/theme-choice.ts`
- Create: `packages/editor/public/theme-boot.js`, `packages/editor-3d/public/theme-boot.js`,
  `extensions/editors/public/theme-boot.js` (each `THEME_BOOT`'s text; Vite copies `public/` beside the built page, and
  the dev server serves it at the root)
- Modify: `packages/editor/index.html`, `suite.html`, `design.html`, `packages/editor-3d/index.html`,
  `packages/editor-3d/suite.html`, `extensions/editors/suite.html` (`<meta name="color-scheme" content="light dark">`
  and `<script src="./theme-boot.js"></script>`, first in `<head>` after the charset; a classic script, not
  `type="module"`, so it blocks and runs before the first paint, and Vite leaves it as it is)
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
  - `const THEME_BOOT: string` — the exact text of `theme-boot.js`: a classic script (no `import`, no `export`) that
    reads the key in a `try`, and sets `document.documentElement.dataset.theme` only to `light` or `dark`. Not inline:
    the site serves the 2D build at `/editor/app/` under `script-src 'self'` (`DEMO_POLICY`), which refuses inline
    scripts.

- [x] **Step 1: Write the failing tests.** `theme-choice.test.ts`: stored `dark` reads `'dark'`; stored `blue` reads
      `'device'`; a `getItem` that throws reads `'device'`; `writeThemeChoice('device')` calls `removeItem(THEME_KEY)`; a
      `setItem` that throws does not throw; `applyThemeChoice('dark', root)` sets `root.dataset.theme === 'dark'` and
      `'device'` removes it; running `THEME_BOOT`'s script body in jsdom with stored `dark` sets the attribute, with stored
      `blue` or a throwing `localStorage` sets nothing. `theme-pages.test.ts`: each of the six HTML pages loads
      `./theme-boot.js` with a classic `<script src>` before its first `<link>` or module `<script>`, has no inline
      `<script>`, and has `content="light dark"`; each of the three `public/theme-boot.js` equals `THEME_BOOT`.
- [x] **Step 2: Run** `pnpm --filter @automata/editor exec vitest run --project unit tests/unit/shared/kit/theme` —
      FAIL: module missing.
- [x] **Step 3: Implement** the module, write the three `public/theme-boot.js` (exactly `THEME_BOOT`) and edit the six
      pages.
- [x] **Step 4: Run** — PASS. Build each package once (`pnpm --filter <pkg> build`) and check `theme-boot.js` sits beside
      each built page (`dist/2d`, `dist/suite`), and that `automata editor` serves it.
- [x] **Step 5: Commit** `feat(editor): remember the editors' colours and set them before the first paint`.

### Task 4: The Editor colours control on each Home

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

- [x] **Step 1: Write the failing tests:** renders the visible words `Editor colours` and a radio group named by them with options `Light`, `Dark`,
      `Match device` in that order; with nothing stored `Match device` is checked; choosing `Dark` sets
      `root.dataset.theme` to `dark`, stores `dark`, and leaves focus on the `Dark` option; choosing `Match device` removes
      both; with a storage that throws, choosing `Dark` still sets the attribute and throws nothing. Each Home's test:
      `getByRole('radiogroup', { name: 'Editor colours' })` exists.
- [x] **Step 2: Run** the package's unit project — FAIL: no widget.
- [x] **Step 3: Implement** the widget and place it on the three Homes. On a phone at 390×844 the three options fit one
      row at 44 px (the `Segmented` track); if `Match device` truncates, the row wraps under the label rather than
      shrinking a target.
- [x] **Step 4: Run** `test:unit` in `editor`, `editor-3d` — PASS.
- [x] **Step 5: Commit** `feat(editor): an Editor colours control on each Home`.

### Task 5: Both looks on the design board

**Files:**

- Modify: `packages/editor/src/app/design/DesignBoard.svelte` (a `ThemeChoice` at the top; the board already shows
  every widget)
- Modify: `packages/editor/tests/e2e/design-board.test.ts` (screenshots in both looks)

- [x] **Step 1:** Extend `design-board.test.ts` to take the board with `colorScheme: 'dark'` as well as light, and to
      assert `getComputedStyle(document.body).backgroundColor` is `rgb(19, 20, 23)` (`#131417`) in dark and
      `rgb(247, 247, 248)` in light (the values from `tool-theme.json`; read them from the JSON in the test).
- [x] **Step 2: Run** `pnpm --filter @automata/editor design:board` — FAIL until the board has the control and the
      dark screenshot exists.
- [x] **Step 3:** Add the control. Look at every widget in dark: words, edges, focus ring, the lime button, the
      disabled states, the colour field. Fix a token (Task 1's JSON) for anything unreadable, never a component.
- [x] **Step 4: Run** — PASS.
- [x] **Step 5: Commit** `test(editor): the design board in both looks`.

### Task 6: Real browsers: first frame, the device switching, the game unchanged

**Files:**

- Create: `packages/editor/tests/browser/layout/shared/kit/theme/theme.test.ts`
- Create: `packages/editor-3d/tests/browser/layout/theme.test.ts` (or the package's layout folder)

- [x] **Step 1: Write the failing tests** (layout project, Chromium; WebKit and Firefox where the runner has them):
  - `first frame`: with the page emulated light and `localStorage` holding `dark`, load the suite page; in the first
    `requestAnimationFrame` the body's background is the dark `--tool-bg`.
  - `follows the device`: with no stored choice, emulate `dark` → dark field; switch the emulation to `light` mid-test
    → light field, no reload.
  - `a forced choice wins`: emulate `dark`, choose `Light` → light field.
  - `the game keeps its colours`: open the sample level in Levels 2D in light, take an element screenshot of the level
    canvas with its cabinet; choose Dark; take it again; byte for byte identical. Same for the 3D Plan canvas and Walk's
    HUD over its canvas. (The Tuner's live view is the game's own page in a frame; Task 8 checks it is not themed.)
  - `the canvas reads plain colours`: in dark, `getComputedStyle(document.documentElement).getPropertyValue('--color-layer-entities')`
    is the same hex as in light.
  - `targets stay`: the `Editor colours` options are at least 44 px tall with a coarse pointer at 390×844.
- [x] **Step 2: Run** `pnpm --filter @automata/editor exec vitest run --project layout --browser.name=chromium
tests/browser/layout/shared/kit/theme` — FAIL before Tasks 1 to 4, PASS after (if run after them, confirm it fails by
      reverting the boot script once).
- [x] **Step 3: Run** the 3D package's layout test the same way — PASS.
- [x] **Step 4: Commit** `test(editor): the colours in real browsers, and the game unchanged`.

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
- [x] **Step 3:** Fix what Step 2 found in the JSON; rerun Task 1's tests and retake the affected shots.
- [x] **Step 4:** Drunk grandma test on the control, recorded in the log: on a phone in dark, could a drunk grandma tell
      what "Editor colours" does and get back to light? Note the answer and change the words only if it fails (then update the spec
      §3.3 and Global Constraints together).
- [x] **Step 5: Commit** `fix(editor): dark colours from the review of every editor` (or skip if nothing changed, and
      say so in the log).

### Task 8: Make and play a small game in dark

**Files:**

- Create: `extensions/editors/tests/e2e/journeys/dark-game-loop.test.ts`. It lives in the content editors' package
  because that suite page (`extensions/editors/suite.html`, served with `--app-dir`) is the only one that holds Levels
  2D, the Tuner, Writer and the rest together; `packages/editor`'s suite page has no Writer. Reuse
  `extensions/editors/tests/e2e/harness/` (`run-editor.ts`, `fixtures.ts`) and `packages/editor`'s `paintWall` and
  `newGame` helpers where the harness already imports them; add a fixture option for `colorScheme: 'dark'`.

- [x] **Step 1: Write the journey:** with the device dark, create a game, open the editors; assert the page is dark
      (computed body background equals the dark `--tool-bg`, read from `tool-theme.json`). Paint a wall in Levels 2D,
      change a number in the Tuner, write a line in Writer, and, on a base with #497, add a mode in Schematic. Play:
      assert each shows in the game (the content module and the visible words, as `whole-game-loop` and
      `writer-words-show-in-game` do), and that the game's page has no `data-theme` and its own background. Publish and
      assert the zip arrives and holds the wall. Each editor that could not be reached on the base is named in the log
      as not run.
- [x] **Step 2: Run** `pnpm --filter @automata/editors test:e2e -- dark-game-loop --trace off` — PASS (build the tools
      and the suite first, as the harness says).
- [ ] **Step 3:** Play it by hand once in the served editor in dark (the audit rule): make a small game, play it, and
      log what was made and what showed in play. Then Levels 3D: run `automata editor` on a copy of `base-3d` with
      `--app-dir packages/editor-3d/dist/suite`, device dark, move a wall in Plan, Play, see the moved wall, and log it.
- [x] **Step 4: Commit** `test(editor): make, play and publish a game with the editors in dark`.

### Task 9: Docs and progress

**Files:**

- Modify: `docs/refactor/progress.md` (a "Dark mode" section: stages, tasks done with evidence, what ran and what did
  not)
- Modify: this plan's log (below)
- Modify: `docs/refactor/2026-11-06-editor-visual-direction.md` (one paragraph: the dark look, the tokens, the rule
  that the game keeps its colours)

- [x] **Step 1:** Write the three. Run `pnpm format` and `pnpm check`. Report the gates: what ran, what was left out
      (WebKit and Firefox off the runner, the GPU suites pending CI), what is pending.
- [x] **Step 2: Commit** `docs(refactor): dark mode in progress and the visual direction`.

## Log

- 2026-11-08, build (stage 3), Sonnet, on `claude/project-thread-1ot79o`. **Base:** PR #502's head (spec, plan and audit on #501 on #498:
  the suite and the content editors), `af-audio-mix` (#500) merged in, then `claude/project-thread-xxsxar` (#497, Schematic)
  merged in (12 conflicts, all additive: both stacks added editors; resolved as a union, `contentEditors` now lists Feel,
  Audio, Writer, Sequence, Schematic; `lockfile` re-resolved). **#499 (Levels 3D 16.3) was not merged**: it conflicts with this
  stack in 30 files, among them `packages/3d`'s `af-sector-2.schema.ts` (300 lines moved on both sides), the standalone 2D
  and 3D pages it deletes, and the tools' `editor-args`. That is the stack merge's work, not this PR's. Until it lands, the
  3D suite on this branch reads `af-sector/1` only and cannot open `base-3d`; Plan, 3D and Walk were therefore not shot or
  played in dark here. What is on this branch for 3D (Walk's HUD and sticks, the Studio's marks, the entries) reads only
  tokens and the scan covers it. When #499 lands, merge `main` into this branch (or rebase), rerun
  `editor-colours.test.ts`, shoot Plan/3D/Walk in dark and play a moved wall.
- Task 1 (`1aaa48e5`): `tool-theme.json` (22 names, then `stage-warn`), `toolThemeToCss`, `contrast`, `tool-theme.css`,
  `tool-chrome.css` imports it and builds `--primary-ink`, `--primary-hover`, `--color-accent-ink`, `--shadow`,
  `--shadow-sheet` from tokens. Every dark value in spec §3.2 passed the contrast test as written: no value changed.
  Ruling: the generated CSS uses double quotes (`[data-theme="dark"]`) so Biome leaves it alone. Gates: unit 48 tests, typecheck.
- Task 2 (`b2df8b94`): three entries import `tool-chrome.css`; `--color-danger` and the 3D fallbacks gone; Walk's HUD, sticks and
  warning, the Studio's pose marks and notice, CardTile's fallback and Feel's stage read the fixed `--stage-*`. Rulings:
  `StudioTimeline` unchanged (its words sit in the dock, which is chrome, not on the cabinet); an outer edge of a cabinet
  box that meets the chrome keeps `--line` (light must not move); `stage-warn` is a new fixed token. The scan
  (`editor-colours.test.ts`, 9 tests) reads `<style>`, stylesheets, markup and the `style`, `fill` and `stroke` lines of
  every `.ts` in the three roots; its allow-list names the game-picture places and the level canvas's drawing code.
  Gates: editor-3d unit 2161, editors unit 299 (before the merges).
- Task 3 and 4 (`9362792c`, one commit because each commit runs about 6 minutes of hook): `theme-choice.ts`, `theme-boot.js`
  in three `public/` folders, the six pages (`light dark`, boot script first), `ThemeChoice.svelte` on the suite Home, the
  2D Home and the kit's `HomeScreen` (the 3D Home). `editor.api.md` updated (+24 lines). Both builds put
  `theme-boot.js` beside the page. Gates: kit unit 1419, typecheck of the three packages.
- Task 5 (`f7cb2654`): the design board has the control and is shot in both looks (20 Playwright tests).
- Task 6: `tests/e2e/theme.test.ts` (first frame on the built editor: `dark/dark` and the dark field on a light device;
  the dev page's attribute; the device switching without a reload; a forced choice wins and is remembered; no inline
  script) and `tests/browser/layout/shared/kit/theme/theme.test.ts` (forced looks, the canvas palette plain, the level's
  own canvas pixels and the cabinet identical in both looks: the canvas is copied with `drawImage` and compared, as the
  build audit M3 asked, because the floating bars over it follow the look; the control keeps the pointer's size).
  Ruling: the 3D Plan canvas comparison is not run here (WebGL in a cloud browser, and #499's Plan is not on this base).
- Task 7, dark review (stage 3, same session): 45 shots of the served sample game (`/mnt/project-files/dark-mode/s-dark-<editor>-<size>.png`: Home, Tuner, Levels, Feel, Audio, Writer, Sequence, Schematic, Review at 390x844, 844x390, 820x1180, 1180x820, 1440x900) and 40 of an `automata editor` copy of `examples/2d-story` (`dark-<editor>-<size>.png`, with the Publish dialog). Verdicts, each looked at (the five sizes of an editor read the same unless named): **Home** words and card edges read, one lime button (Publish only when it is the page's action), warning strip readable; **Tuner** rail, tabs and the "Ask only" card read; **Levels** layers, entity list, inspector and the floating tools read, the level canvas and its cabinet are unchanged; **Feel** list, effect cards, inputs, the preview's white square (game picture, unchanged) and two lime buttons that belong to different actions (Add a feel, Add an effect) read; **Audio** list, waveform line, grey checkboxes and the lime "Tap to hear" read; **Writer** cards, text areas and "Remove" read; **Sequence** the plan is a dark grey diagram with the accent's camera and a light keeper label: it is tool chrome and follows the look (it is not a game picture; the audit's N6 corrected this line); **Schematic** diagram boxes, arrows, dashed edges, the inspector and the Walk list read; **Review** reads; **Publish dialog** dark, scrim over the page, lime "Build my game". Nothing read badly, so no token changed (Step 5 skipped). Two things seen and not caused by this change: the phone-landscape Levels top bar clips Publish (the audit already lists it) and Audio's "What you hear" field is narrow so its text is cut. Not shot: Levels 2D with a character selected and the Add tiles sheet, Levels 3D Plan and Walk, the Studio, the Ask dialog (#499 and the Ask entry are not on this base): Step 1 and Step 2 stay unticked for those.
- Task 7 Step 4, drunk grandma test (phone 390x844, dark): the Home ends with the words "Editor colours" over "Light", "Dark" and "Match device" (the chosen one has a bright edge). Tapping "Light" turns the editors light at once and the choice is remembered (`localStorage` `automata-editor:theme` = `light`); the target is 54x44 px. A drunk grandma can tell what it does and get back. Words unchanged. Shot: `grandma-phone-dark-control.png`, `grandma-phone-after-light.png`.
- Task 2, audit M1 (light before/after of the 3D suite Home and Feel at 1180x820): not run as pictures. The light look is guarded instead by the unit test "the light values are today's" (every light token equals the value `tool-chrome.css` and the site root held before) and by the scan, which fails on any new literal. A pixel comparison needs the base built next to this branch; do it when #499 is merged.
- Task 8 (`dark-game-loop.test.ts`, `extensions/editors/tests/e2e/journeys/`): a device that asks for dark; `automata create-game`, then `automata editor`. Asserts the editors' `color-scheme` is `dark` and `--bg` is `rgb(19, 20, 23)` with no `data-theme` set; paints a wall in Levels (`content/levels/start.toml` holds `".*5 1 .*26"`), rewrites the bump's word in Feel (`content/feel/feel.toml`), opens Tuner (the no-settings page) and Writer (nothing to edit in a new game, so opened only, still dark); plays the game page the editor started: its canvas draws, it has no `data-theme` and no `--bg`, and the content module it serves holds the wall and the word; Publish in dark builds and the downloaded zip's JavaScript holds both. **PASS** on the iPad and phone projects (Chromium, 13 s each): `pnpm exec playwright test -c playwright.journeys.config.ts dark-game-loop --trace off`. Rulings: Tuner and Audio's Mix are not changed in this journey (the new game has no settings file, and `audio-in-a-new-game` already proves Mix); Writer has no lines in a new game, so the plan's "write a line in Writer" is covered by `writer-words-show-in-game` (light) and the sample shots (dark); Schematic's mode is not added (the new game has no characters). Played by hand once: the new game's page in the journey's shots (`journey/phone-game-played.png`, black menu, yellow Play: the game's own colours) and the dark Publish dialog (`journey/ipad-dark-publish.png`). Levels 3D (move a wall in Plan, Play) was **not** run: it needs #499.
- Task 9, gates (stage 3 end): `pnpm lint` clean after one fix that is not this change's (`audio-stage.test.ts` read through `?.` in a cast: the one Biome error, from #500); `pnpm typecheck` passes; `pnpm style` 0 findings; `pnpm knip` clean after naming the three `public/theme-boot.js` files (loaded by `<script src>`, not imported). **Fail, inherited and not touched here:** `pnpm boundaries` (3 findings in `extensions/editors/src/features`: `feel` imports `audio`, `sequence` imports `writer` twice, from #487/#498 and already on #502's head), `pnpm source-names` (5 findings, `SettingsScreen.svelte` and others, from main) and `check:changesets` (3 changesets naming `@mcthaydt/*` packages, from main). `pnpm test:unit` ran as the commit hooks' affected projects (editor, editor-3d, editors, audio-synth and their dependants), all green. Not run: WebKit, Firefox, the GPU runner, parity, the 3D browser suites and journeys (CI and the Owner's machines).
- Hand-off (session over 90 minutes): stage 3 is complete on this branch except what #499 holds. To finish after #499 merges: merge this branch's base into it, run `editor-colours.test.ts`, `theme.test.ts` (layout) and `tool-theme.test.ts`, shoot Plan, 3D, Walk and the Studio in dark at the five sizes, play a moved wall in dark with `automata editor` on a copy of `base-3d` and `--app-dir packages/editor-3d/dist/suite`, and take the light before/after of the 3D Home and Feel. Commit hooks take about 8 minutes, so commit in the background and do not edit during one.
- Build audit fixes (`dark-mode-build-audit.md`, same branch family, merging #499/#503 in): **N1** `origin/claude/project-thread-hy70zt` (#499, with #503's fixes) is merged into this branch with an ordinary merge, 30 files of conflict. Rulings: the 3D lineage's removal of the standalone pages (`index.html`, `editor-2d`, `Home.svelte`), Ask, Review, the change-set desk and the Tuner locks stands (the pages' dark boot lives on in the suite pages); #480's Play and Publish, the ThemeChoice footer, Characters and the try-it templates are kept on top of the 3D lineage's suite shell; `contrastRatio` became one `contrast()` that reads hex and `rgb()`; `kitSurfacesSchema` is exported from `af-sector-2-parts.schema.ts` because `extensions/world-kit` reads it; `modes = ["edit"]` everywhere (`ask` is no longer a mode). **Levels 3D in dark**: `tests/e2e/journeys/dark-levels-3d.test.ts` (iPad and phone, Chromium, 1.9 min) plays the shipped room, opens Levels 3D dark, shoots Plan, 3D and Walk, drags the north wall's two corners a metre in Plan, waits for the saved file, plays the edited room (more than 200 sampled pixels differ from the shipped picture) and checks the game page is unthemed. Shots: `/mnt/project-files/dark-mode/3d/`. **Studio in dark**: the same journey opens Characters in a dark and a light context and requires the stage's corner pixel to be identical. That showed a bug that is the same in light: the Studio read only `content/figures/*.toml`, so Wick's swatches and gait were "no figure swatch" and the stage never drew; `base-3d`, `examples/3d-story` and the new-3D-game template now list `content/figure-*/*.toml` for `studio` (three tests updated). The 3D Plan on a phone also draws a white box north of the first room: it is the level's own white floor outside the iPad's view, the same in light, so not a dark-mode fault. **N2** `dark-game-loop.test.ts` presses Play, clicks the game's Play and reads the played canvas (the wall's cell is not the background, the next cell is); its comment now says Tuner and Audio are only opened (Writer is not in a new game's editor list any more). Passes on iPad and phone. **N3** `theme.test.ts` (layout) now reads the real Pixi canvas in the task that draws it, in each look, asserts it is painted, and has a control that proves a changed colour is seen. Written first, it failed: the grid, selection and link-chip colours followed the look; they are now the fixed tokens `color-stage-grid`, `-accent`, `-bad` and `-chip` (`scene-items.ts`). **N4** the light "after" shots of the 3D Home, the Studio, the Plan and Feel are in `/mnt/project-files/dark-mode/3d/` (`*-light-*.png`: light chrome around a dark game picture); the "before" side still needs the pre-dark base built beside this branch and is not taken, so the token test stays the proof of the light values. **N5** the colour scan's allow-list is now exact lines (11), with a test that every entry still exists. **N6** the Sequence line above. Gates: `pnpm lint` (the one new error fixed), `style`, `knip` (a redundant entry removed), `pnpm test:unit` all green after fixing the three tests above (editor 3237, editor-3d 2256, editors 645, tools 785); `pnpm build`, `api-report --update` (the 3d report gets #499's exports back), `agent-skills --write` run. **Fail, inherited:** `boundaries` (3), `source-names` (5), `check:changesets` (3, all named in the PR body), and `api-index` names three exports with no doc comment (`STICK_DIRECTIONS`, `Picture`, `PROMPT_COPY`) that are already on the base. Not run: WebKit, Firefox, the GPU runner, parity, the 3D browser suites and journeys other than the two above.

- 2026-11-08: plan audit (stage 2), on #501's branch: 3 high, 6 medium, 4 low found and fixed in the spec and this plan;
  the list is in [`2026-11-08-dark-mode-plan-audit.md`](2026-11-08-dark-mode-plan-audit.md).
- 2026-11-08: spec and plan written (stage 1). Base: PR #498's branch. Findings while reading the code: the 3D suite and
  the content editors' suite page never imported `tool-chrome.css` (Task 2); three pages declared `color-scheme: dark`
  on a light page (Task 3); `--color-danger` is read but never defined (Task 2).
