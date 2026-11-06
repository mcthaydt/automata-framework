# Editor visual direction: square, flat, quiet (2026-11-06)

Status: drafted and built on its own draft PR, stacked on PR #420. Accepted under the Owner's standing rule
(2026-10-31: "Reminder that everything is auto approved and accepted, do not wait on me to do any approvals").

## Why

The Owner, 2026-11-06: "Run the editors through the better taste skills, don't change the site yet, but I do want to
see what it'd look like; it looks a bit unprofessional and I HATE rounded buttons."

The design-taste skill the site was linted with earlier is not installed in cloud sessions, so this applies the same
standard by hand: a professional, restrained tool look. The editors are tools; the content (the level, the tiles, the
game) should be the loudest thing on screen, and the chrome should recede.

## Scope

- **Changes:** every non-3D editor in `packages/editor` (the kit, Levels 2D, the suite shell, the Tuner).
- **Does not change:** the website. The site and the editor share `tokens.json`; every token the site reads
  (`--radius*`, `--pill`, `--glass`, `--lime*`, `--glow`, `--flutes*`, `--curtain`) keeps its value, which the existing
  `defines every custom property the website's :root defined` test proves. The site gets mockups only (below).
- **Does not change:** editor-3d. It still reads `--radius-md` and the other shared names, which keep their values.
- **No layout or behaviour change.** Hit targets stay 44 px and primary actions 48 px; no control is added or removed.
  View structure (rail, switcher, sheets) stays the build thread's job in phase 12.

## The rules

| Rule | Token or component | Before | After |
| --- | --- | --- | --- |
| Square corners everywhere | new `--edge: 0px`; every `border-radius` in `packages/editor/src` | 8 to 26 px radii and 999 px pills | `var(--edge)` |
| Only dots stay round | `SourcesPanel` status dot, `DefinitionPreview` dots | 50% | 50% (listed in the test) |
| One quiet primary | `Button` `primary`; new `--primary`, `--primary-ink`, `--primary-hover` | chartreuse panel with a glow | ink panel, paper text, weight 600 |
| Flat controls | `Button` `plain`, inputs, chips, menus | frosted `--glass` | `--paper` with a `--line-strong` hairline, hover `--surface` with an ink edge |
| Destructive reads as such | `Button` `danger` | ink on a red wash | `--bad` text on the red wash |
| Toolbars recede | `IconButton` | bordered circle | borderless square; hairline and `--surface` on hover; pressed stays cobalt |
| Choices without a block of colour | `Segmented` | solid cobalt chosen segment | paper tile with an inset ink hairline on a `--surface` track |
| No bounce | `Button` | 1 px press translate | none |
| Shadows are a hairline lift | `--shadow`, `--shadow-sheet` (editor-only) | soft 8 to 24 px blur | 2 px, and a 1 px ring plus 32 px for sheets |
| No site decoration | `--color-bg-raised` alias | `--glass` | `--paper` |

Cobalt stays the selection and focus colour, so "where am I" and "what is chosen" read the same everywhere.

## Guard

`packages/editor/tests/unit/shared/kit/square-corners.test.ts` reads the `<style>` of every editor component and fails
on any corner that is not `var(--edge)` (bar the listed dots), and on any use of the site's `--glass`, `--glow`,
`--lime*`, `--flutes*` or `--curtain`. New screens built in phase 12 inherit the rule through it.

## Drunk grandma check

- The one thing to press on a screen is the only solid dark block: Save, New level, Ship. Nothing else competes.
- Delete is red text, so it never looks like the safe choice.
- The chosen tool is outlined in ink and the rest are grey: you can tell which one you are holding at a glance.
- No copy changed.

## Evidence

Before/after pairs (left "Now", right "Proposed"), in the project's shared folder
`refactor/2026-11-06-visual-direction/`:

- `editor/kit-board--*.jpg`: the design board (`pnpm --filter @mcthaydt/automata-editor design:board`) at desktop and
  phone, with and without its dialog.
- `editor/editor-home--*`, `editor-new--*`, `editor-level--*`, `suite--*`: the real Levels 2D Home, its New level step,
  a fresh platformer level and the suite home, at desktop, iPad landscape and phone.
- `site/*--desktop.jpg`, `site/*--phone.jpg`: **mockups only** of Home, Start, Quick start, Examples, Editors and
  Showcase. They are the running site with `site/mockup-override.css` injected into the screenshot; no site file
  changed. The override squares every corner, turns the primary button ink (paper on the dark demo stage), drops the
  glow and the fluted textures, and keeps the lime logo mark and the live LED as the one accent.

Checks on the branch: editor unit (all), `layout (chromium)` (all), `svelte-check`. WebKit and Firefox layout runs are
not runnable in cloud sessions and are pending on the Owner's machine.

## For the site, later

If the Owner likes the mockups, the site change is the override turned into real edits of `site/src/app.css` and the
shared tokens (`--radius*` and `--pill` to 0, the primary to ink), which also updates
`packages/editor/tests/fixtures/tokens/site-root.css`. It belongs to the site's phase 18.0 (the shared layout).
