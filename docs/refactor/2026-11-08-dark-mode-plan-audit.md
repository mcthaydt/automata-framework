# Dark mode: plan audit

Stage 2 of the dark mode pipeline, on the [spec](2026-11-08-dark-mode-spec.md) and [plan](2026-11-08-dark-mode-plan.md)
of PR #501. Read against the code on #498's branch (the base the plan names), with #497 (Schematic), #499 (Levels 3D)
and #500 (Audio's mix) checked for the files they add. Every finding below is fixed in the spec and plan in the same
commit as this file.

## Verdict

The plan is sound in shape: the editors already read tokens, so a second value per token plus one control is the right
size, and the tasks cover every editor, the approved look, contrast, screenshots, the drunk grandma test and a played
game. Three things would have broken in the build (H1 to H3), and six would have shipped a wrong colour or moved the
light look (M1 to M6). All are fixed.

## High

- **H1. `light-dark()` breaks the level canvas and older iPads.** The level canvas and the Home thumbnails resolve a
  project colour by `getPropertyValue('--color-…')` and parse a hex (`shared/level-2d/canvas/colors.ts`). A custom
  property holding `light-dark(a, b)` comes back as that text, so any themed token a script reads parses to the neutral
  grey; and `light-dark()` needs Safari 17.5, below which every field reading one turns transparent. Fixed: the
  generated CSS writes plain light values on `:root` and the dark values under `prefers-color-scheme: dark`
  (`:root:not([data-theme='light'])`) and `:root[data-theme='dark']` (spec §3.1, Task 1). The canvas palette
  (`--color-layer-*`, `--color-phase-*`) is never themed, with a test.
- **H2. The inline boot script is refused on the website.** The site serves the 2D editor's build at `/editor/app/`
  under `script-src 'self'` with no inline script (`site/src/shared/html/security-headers.ts`, `DEMO_POLICY`); the spec
  said the editors run under no CSP. The try-it editor would have flashed light and logged a violation. Fixed: the boot
  script is a classic file, `theme-boot.js`, in each package's Vite `public/`, loaded first in `<head>`; a test checks
  every copy equals `THEME_BOOT` and that no page has an inline script (spec §3.4, Task 3).
- **H3. The played-game check could not reach the editors it names.** Task 8 put the dark journey in `packages/editor`,
  whose suite page has no Writer; only `extensions/editors/suite.html` holds Levels 2D, the Tuner, Feel, Audio, Writer,
  Sequence and (with #497) Schematic. It also compared the game's canvas between two runs, which a running game does not
  hold still for. Fixed: the journey lives in `extensions/editors/tests/e2e/journeys/` on that harness, checks each
  edit shows in play and that the game's page is not themed, and Levels 3D is edited and played by hand on a copy of
  `base-3d` (spec §5.7, Task 8).

## Medium

- **M1. The cabinet changed colour in dark.** `--tool-stage` went `#0e1014` → `#0b0c0e`, but the cabinet shows through
  and around the level canvas, so Task 6's "identical pixels" would fail, and spec §4 said the cabinet is unchanged.
  Fixed: `#0e1014` in both looks (still darker than the dark field `#131417`), with a test.
- **M2. Words on the cabinet.** `WalkHud` sets `--color-text-primary` (ink) on an 80% `--color-bg-canvas` panel: 1.0:1 in
  light today, and the spec would have flipped it with the theme though it sits on the game. `StudioCanvas`,
  `StudioTimeline` and `WalkSticks` read the dim text on the cabinet too. Fixed: on the cabinet, words and edges read the
  fixed `--stage-ink`, `--stage-muted`, `--stage-line` (16.9:1 and 9.2:1 on `#0e1014`), with a scan rule and a contrast
  test (Task 2, Task 1).
- **M3. Feel's stage.** It draws its square in `getComputedStyle(canvas).color` on `--color-bg-field`, read once per
  replay: a chrome colour the spec listed as "the game", and stale after a change of look. Fixed: a small cabinet
  (`--charcoal`, `--stage-ink`), the same in both looks (Task 2).
- **M4. The lime hover lightened in dark.** `--primary-hover` mixes the lime with `--ink`, which turns light. Fixed: mix
  with `--on-lime` (the same value as `--ink` in light, so light does not move).
- **M5. Light would have moved through the shadows.** `--shadow` is `rgb(17 21 28 / 0.06)` today and the sheet's ring
  `0.1`; the plan pointed both at `--shadow-ink` (0.12) and `--line-strong`. Fixed: `--shadow-lift` and `--shadow-ring`
  tokens carry today's values.
- **M6. "Colours" on a Home of game cards.** A bare "Colours" beside the game's cards reads as the game's colours, and
  `Segmented` names its group only by `aria-label`, so the word was never on screen. Fixed (drunk grandma test): the
  visible label **Editor colours**, naming the radio group.

## Low

- **L1.** "Light does not move a pixel" contradicted Task 2, which on purpose gives the 3D pages and the content editors'
  suite the tool look in light. The constraint now names the pages it holds for.
- **L2.** The base: #500 (Audio's mix) adds components on #498, and #499 sits on another stack (#476 to #493), so the
  merge of the tops needs one merge-up pass before Task 1.
- **L3.** Task 6 compared the Tuner's live view, which is the game's own page in a frame and not there in the layout
  project. Moved to Task 8 (the game's page is not themed).
- **L4.** The control edge (`--tool-line-strong` on `--tool-panel`) is 1.48:1 in light today; the dark value (1.53:1)
  now has a test that it is at least the light one. Found, not fixed (out of scope, light must not move): the layer
  accent words in `Pill` (`--color-layer-*` as text) are 1.7:1 to 2.9:1 on white in light; in dark they are 5.8:1 to
  10:1.

## Checked and right

- Every path the plan edits or tests exists on #498 (and Schematic's and Audio's files on #497 and #500).
- The spec's dark values, computed from its table: every pair in §5.1 passes in both looks (closest: `--tool-faint` on
  `--tool-selected`, 4.73:1 dark, 4.55:1 light; `--on-accent` on `--cobalt` 8.0:1 dark).
- `Segmented` has the `track` look and a `set` edit event; the three packages are private (no changeset).
- The look: neutral chrome, one flat lime primary, 4/6/8 px corners, no pill (`editor-corners.test.ts` stays). DUEL stays
  the games' palette, in the game's pictures, as the approved mockup and the 2026-11-06 visual direction have it.
- Every editor is covered: suite shell, Levels 2D (Characters, Add tiles), Levels 3D (Plan, 3D, Walk), Studio, Tuner,
  Feel, Audio, Writer, Sequence, Schematic, Publish; Play is the game's own page and is not themed.

## Gates

Docs only: `pnpm format` ran on the three files. No code changed, so no unit, browser or journey suite was run.
