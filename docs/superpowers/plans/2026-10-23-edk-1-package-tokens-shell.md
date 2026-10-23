# EDK.1 The editor-kit package, tokens and responsive shell: TDD plan

- **Task:** EDK.1 in [02](../../02-master-delivery-plan.md). [Editor kit spec](../specs/2026-10-23-editor-kit-design.md) §4.1 (tokens), §4.2 (`EditorShell`), §7 (sizes), §8 (tests); decisions EDK-D1 to EDK-D3, EDK-D6; acceptance EK-g.
- **Lane:** editor-kit. **Depends on:** EDK.0 (drafted, in PR #93; this PR stacks on it for `docs/design/editor-kit/tokens.json`).
- **Status:** In progress 2026-10-23.
- **Progress:** 5 of 7 steps (1 scaffold, 2 `tokensToCss`, 3 `tokens.css`, fonts and quality tests, 4 shell rules, 5 `EditorShell` behavior in jsdom). Deviations are listed under Execution record.

## Sources

- **AF on `main` (`1fa4acc`):** `packages/ui` is the pattern: `src/geometry/{form-factor,height-tier,geometry,geometry-owner.svelte}.ts` (the one geometry owner, EDK-D3), `src/layout/ScreenFrame.svelte` (a screen that reads the owner's insets and `data-scroll-region`), `src/testing/layout-contract.ts` and `settle.ts` (published as `@mcthaydt/automata-ui/testing`: `publishConditions`, `checkLayout`, `byTestId`, `settleLayout`), and `packages/testing` (`REFERENCE_SIZES`, `VARIANTS`, `mountFixture`, the finders for clipped, overlapping, small and unreachable controls). The vitest setup (`unit` in jsdom, `layout` in real browsers) is copied from `packages/ui/vitest.config.ts`.
- **The mockups (PR #93):** `docs/design/editor-2d/` for the region sizes (top bar 52, rail 56, panel 264, inspector 320, dock 148, tab bar 64, drawer 300 to 320) and `docs/design/editor-kit/tokens.json` for the tokens.
- **Fonts:** `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono` 5.3.0 (OFL-1.1; Emberwick already uses `@fontsource` packages). `deps:new` reviews them.

## Scope

**In:** the package; `tokens.css` generated from `tokens.json` and a drift test; font CSS; the pure shell rules (mode, dock placement, which regions may be open); `EditorShell.svelte` with every region as a snippet, drawers and detent sheets that open by tap and keyboard; the layout contract at the sizes in spec §7.

**Out, with owner:**

| What | Where |
|---|---|
| Dragging a sheet's handle between detents, two-finger undo | EDK.3 (the gesture layer); here the handle is a 44 px button that steps peek, half, full |
| Widgets inside regions (stepper, list, tabs, dialog) | EDK.4 |
| Storage and the status line's saved state | EDK.5 (the `status` region exists and takes any snippet) |
| WebKit and Firefox layout runs, iPad profiles | EDK.6, and a `test-request` on the bus for the Mac (Chromium is run here) |

## Spec corrections found while planning

Both were made in PR #93 (`c64b61e`) before this plan, because the spec must say what is built:

1. The mockups draw the destinations as a 64 px tab bar below `wide`, not a 56 px rail beside the canvas. The `rail` snippet is told its `orientation`.
2. The geometry owner's `short` tier is 600 px or less, so an iPad mini in landscape (1133×744) keeps its dock. The "dock hidden until summoned" rule applies to windows such as 900×600.

## Contract

### `src/shell/shell-mode.ts` (create; pure, no Svelte)

```ts
export type ShellMode = 'wide' | 'medium' | 'compact'
export type DockPlacement = 'inline' | 'sheet'
export type Detent = 'peek' | 'half' | 'full'
export type ShellRegion = 'panel' | 'inspector' | 'dock'

/** desktop → wide, tablet-portrait → medium, phone-portrait and phone-landscape → compact. */
export function shellModeOf(formFactor: FormFactor): ShellMode
/** inline only when wide and the height tier is not short or compact. */
export function dockPlacementOf(mode: ShellMode, tier: HeightTier): DockPlacement
/** What the dock does when the editor leaves `dockOpen` unset: open when inline and in `medium` (a peek), closed otherwise. */
export function defaultDockOpen(mode: ShellMode, tier: HeightTier): boolean
export const DETENTS: readonly Detent[]               // peek, half, full
export function nextDetent(detent: Detent): Detent    // peek → half → full → peek
/** A CSS length for the sheet's height, resolved against its grid area: peek is the region's own strip (dock: 148 + the 44 handle, others 96), half is 50% and full 92%. */
export function detentLength(region: ShellRegion, detent: Detent): string
```

### `src/shell/shell-open.ts` (create; pure)

```ts
export interface OpenState { readonly panel: boolean; readonly inspector: boolean; readonly dock: boolean }
/** In `compact` one sheet is open at a time: the region that just opened wins and the others close. Other modes return `next` unchanged. */
export function reconcileOpen(mode: ShellMode, previous: OpenState, next: OpenState): OpenState
```

### `src/tokens/tokens-to-css.ts` (create; pure)

`tokensToCss(tokens: EditorTokens): string` renders `:root { ... }` from `docs/design/editor-kit/tokens.json`: `--color-<group>-<name>`, `--space-<n>`, `--radius-<name>`, `--size-hit`, `--size-primary`, `--font-sans`, `--font-mono` (with a system fallback stack) and, per ramp entry, `--text-<name>` as a `font` shorthand (`400 13px / 18px var(--font-sans)`) and `--text-<name>-tracking`. `color-scheme: dark` is set. The file `src/tokens.css` is that output, written by `scripts/generate-tokens.ts` (`pnpm --filter @mcthaydt/automata-editor-kit tokens`).

### `EditorShell.svelte` (create)

```ts
interface Props {
  geometry: GeometryState                           // from @mcthaydt/automata-ui's createGeometryOwner
  topbar: Snippet
  canvas: Snippet
  rail?: Snippet<[{ orientation: 'vertical' | 'horizontal' }]>
  panel?: Snippet
  inspector?: Snippet
  dock?: Snippet
  status?: Snippet
  sheets?: Snippet                                  // dialogs and toasts, rendered last, above everything
  panelOpen?: boolean                               // $bindable, default false; a drawer in medium, a sheet in compact
  inspectorOpen?: boolean                           // $bindable, default false
  dockOpen?: boolean | undefined                    // $bindable, default `defaultDockOpen(mode, tier)`
  testId?: string
}
```

Markup contract (what tests and the 2D editor rely on): one root `[data-editor-shell][data-mode="wide|medium|compact"][data-dock="inline|sheet"]`; one wrapper per region with `data-region="topbar|rail|panel|canvas|inspector|dock|status"`, always in the DOM in the same order; closed drawers and sheets carry `inert` and `data-open="false"` and are hidden with `visibility`, never `display: none`; open sheets carry `data-detent`; each sheet has a `button[data-sheet-handle]` at least 44 px high with `aria-label` "Resize panel" and `aria-expanded`. The canvas wrapper sets `touch-action: none` and `overscroll-behavior: none`, and declares no scroll. Panel, inspector and dock bodies declare `data-scroll-region`. CSS lives in the component, built from `tokens.css` variables.

## Steps (each: failing test first, confirm the reason, minimal change, verify)

| # | Step | Test file and what fails first | Verify |
|---|---|---|---|
| 1 | Package scaffold: `package.json` (private, name `@mcthaydt/automata-editor-kit`, svelte exports as `ui`, deps `@mcthaydt/automata-ui` and `@fontsource/*`), `tsconfig.json`, `svelte.config.js`, `biome.json`, `vitest.config.ts` (`unit` jsdom, `layout` Chromium only here), `vitest-setup.ts`, `README.md`, `src/index.ts`; `pnpm install` | `src/index.test.ts`: "exports the shell and the token path" fails with module not found | `pnpm --filter … test:unit` runs and passes |
| 2 | `tokensToCss` | `tokens-to-css.test.ts`: colours become `--color-bg-app: #111214`; space, radius, size; every ramp entry has the shorthand and tracking; unknown group throws | unit |
| 3 | Generated `tokens.css`, drift and quality | `tokens.test.ts`: file equals `tokensToCss(tokens.json)` (message says to run the `tokens` script); `--size-hit` is 44 and `--size-primary` 48; text-primary on bg-app ≥ 7:1, text-dim on bg-surface ≥ 4.5:1, accent-ink on accent-default ≥ 4.5:1 | unit; `fonts.css` imports weights 400/500/600 (sans also 700) |
| 4 | Shell rules | `shell-mode.test.ts`, `shell-open.test.ts`: every row of spec §4.2 and §7 (1194×834 wide inline, 834×1194 medium sheet, 1133×744 wide inline, 900×600 wide sheet closed, 390×844 compact); detent cycle and heights; `compact` opening inspector closes panel | unit |
| 5 | `EditorShell.svelte` behaviour (jsdom) | `editor-shell.test.ts`: regions and attributes per mode; closed drawer is `inert`; handle button steps the detent and sets `aria-expanded`; compact keeps one sheet open (bound props follow); **a mode change keeps the same canvas element and keeps focus in a field inside it** (identity, `document.activeElement`) | unit |
| 6 | Layout contract (real Chromium) | `editor-shell.layout.test.ts` with `ShellFixture.svelte`: at 1194×834, 834×1194, 1133×744, 1366×1024, 744×1133, 900×600, 390×844, 844×390 and with the keyboard variant on 834×1194: `checkLayout` reports no clipped, overlapping, small (< 44) or unreachable controls, no document scroll, the canvas region box is what the grid says, and rotating 1194×834 → 834×1194 keeps the focused field | `pnpm --filter … test:layout` (Chromium); WebKit and Firefox via a `test-request` |
| 7 | Gates and records | `pnpm format`, `pnpm check`; `pnpm deps:new --base origin/main`; knip entry if it flags the testing fixtures; 02 and 03 updated from the evidence | report selected, omitted and pending |

## Acceptance (kit spec EK-g, partial)

Layout contract passes at the sizes in step 6 in Chromium. Pending and listed for the Owner or the Orchestrator: WebKit and Firefox layout, iPad Safari manual check, visual acceptance of the shell against the Figma frames.

## Risks

- **Moving regions with CSS only.** Drawers and sheets are the same elements as the inline panel and inspector, positioned `fixed` with transforms in `medium` and `compact`. If a browser resets scroll on a `position` change, step 6 shows it (the test scrolls a panel, changes the size, and reads `scrollTop`).
- **`@fontsource` in jsdom.** CSS imports are ignored by Vitest's `css: true` only for the files it parses; if the font files fail to resolve, `fonts.css` stays out of the unit project and is covered by the layout project.

## Execution record

- **Steps 1 to 3 (done 2026-10-23).** `pnpm install` needed the registry for the new package's dependency metadata (`--offline` has no cache for it); the lockfile gained only the `packages/editor-kit` importer and the two `@fontsource` entries. The first red was `src/index.test.ts` failing to resolve `./index` (module not found, as planned). The entry test asserted exports that do not exist before steps 2 and 4, so it was removed and `src/index.ts` starts empty; the exports test returns in step 5 with the real exports. The first real red of the package is `tokens-to-css.test.ts` ("Failed to resolve import ./tokens-to-css").
- **Deviation: CSS is written in Biome's format.** `pnpm format` rewrote the first generated `tokens.css` (double quotes, spaces around the slash of `font`) and the drift test failed. The generator now emits that format, so the file is already formatted and the drift test and `pnpm format` agree. `fonts.css` uses double quotes for the same reason.
- **Deviation: `@types/node` added as a dev dependency** (24.19.1, like the other packages) and `allowImportingTsExtensions`, because `scripts/generate-tokens.ts` and the token tests read files; the script runs under Node's type stripping like `ui`'s `build/finish-dist.ts`.
- **`svelte-check` prints "no svelte input files" until step 5 adds `EditorShell.svelte`;** with `--fail-on-warnings` the package typecheck is red until then, and is run again in step 5.
- **Step 4 (done 2026-10-23).** `shell-mode.test.ts` and `shell-open.test.ts` failed first on the missing modules. The size table in the test classifies each window with the geometry owner's own `classifyFormFactor` and `classifyHeightTier` (imported from `@mcthaydt/automata-ui`), so the shell rules and the owner cannot disagree about what 900 × 600 or 1133 × 744 is. One test was wrong, not the code: "none newly opened" started from a closed `previous`, which makes all three newly opened; it now starts from all three open.
- **Step 5 (done 2026-10-23).** `editor-shell.test.ts` failed first on the missing `EditorShell.svelte`; 58 unit tests pass and `svelte-check --fail-on-warnings` is clean, so the package typecheck is green again.
  - **Deviation: `detentHeight(region, detent, available)` became `detentLength(region, detent)`,** a CSS length (`min(96px, 100%)`, `50%`, `92%`). Sheets sit in the canvas's grid cell, where a percentage resolves against that cell, so a rotation or a keyboard needs no measuring and there is no first frame at height 0. The dock's peek is 148 plus a 44 px handle (192), not 148 plus 20: the handle is a touch target and must be 44 px high (AGENTS.md), so it sits in flow above the content instead of overlapping it. The kit spec §4.2 line "peek 96" stays right for the panel and inspector.
  - **Regions in the DOM:** drawers and sheets are siblings placed in the canvas's grid cell (`grid-area: canvas`) and moved with `transform`; the root is `position: fixed` and pads by the geometry owner's insets, so the shell needs no `fixed` children and no safe-area math of its own. The rail snippet's wrapper carries `data-presentation="rail"` (wide) or `"tabbar"` (below wide).
  - **jsdom and `inert`:** Svelte sets `inert` as a property; a browser reflects it to the attribute, jsdom does not. The unit tests assert the property; the layout tests (step 6) assert the attribute in Chromium.
  - **Not covered by jsdom, left for step 6:** real focus, real scroll positions and every pixel of layout. The jsdom focus test proves the shell does not remount the canvas; it cannot prove the browser keeps focus through a CSS grid change.
