# Editor and site visual direction: slightly rounded, flat, quiet (2026-11-06)

Status: drafted and built on its own draft PR, stacked on PR #420. Accepted under the Owner's standing rule
(2026-10-31: "Reminder that everything is auto approved and accepted, do not wait on me to do any approvals").

## Why

The Owner, 2026-11-06: "Run the editors through the better taste skills, don't change the site yet, but I do want to
see what it'd look like; it looks a bit unprofessional and I HATE rounded buttons."

Later the same day the Owner named the skill ("https://github.com/Leonxlnx/taste-skill okay slightly rounded", "I want
you to actually use the skill btw, install it") and picked site option C, "Lime, flat". The skill (tasteskill 2.5,
`design-taste-frontend`) was installed in the session and loaded. Its rules that apply to a tool UI were followed:
the developer-tool radius scale (`sharp`, 4/6/8 px), one button pair (one filled primary per view, one secondary
look), never a gradient, ghost or shadowed button, and its button motion (hover steps up 1 px, a press sinks 1 px and
scales .985, fine pointers only). Its landing-page rules (one section per screen, photographs, effects) do not apply
to editors. The editors take option C's primary too, so the site and the editors are one system.

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
| Slightly rounded, one scale | new `--edge-sm` 4px (controls, buttons, chips, inputs), `--edge-md` 6px (panels), `--edge-lg` 8px (cards, dialogs, sheets); every `border-radius` in `packages/editor/src` | 8 to 26 px radii and 999 px pills | the scale above, `0` for a squared side |
| Only dots stay round | `SourcesPanel` status dot, `DefinitionPreview` dots | 50% | 50% (listed in the test) |
| One flat primary | `Button` `primary`; new `--primary` (lime), `--primary-ink`, `--primary-edge` (ink), `--primary-hover` (lime 14% toward ink) | chartreuse pill with a glow | flat chartreuse panel with a 1 px ink edge, weight 600, no glow |
| Flat controls | `Button` `plain`, inputs, chips, menus | frosted `--glass` | `--paper` with a `--line-strong` hairline, hover `--surface` with an ink edge |
| Destructive reads as such | `Button` `danger` | ink on a red wash | `--bad` text on the red wash |
| Buttons answer the pointer | `Button` | 1 px press translate | hover up 1 px, press down 1 px and .985; fine pointer and no reduced motion only |
| Toolbars recede | `IconButton` | bordered circle | borderless; hairline and `--surface` on hover; pressed stays cobalt |
| Choices without a block of colour | `Segmented` | solid cobalt chosen segment | paper tile with an inset ink hairline on a `--surface` track |
| Shadows are a hairline lift | `--shadow`, `--shadow-sheet` (editor-only) | soft 8 to 24 px blur | 2 px, and a 1 px ring plus 32 px for sheets |
| No site decoration | `--color-bg-raised` alias | `--glass` | `--paper` |

Cobalt stays the selection and focus colour, so "where am I" and "what is chosen" read the same everywhere.

## Guard

`packages/editor/tests/unit/shared/kit/editor-corners.test.ts` reads the `<style>` of every editor component and fails
on any corner off the `--edge-*` scale (bar the listed dots), and on any use of the site's `--glass`, `--glow`,
`--lime*`, `--flutes*` or `--curtain`. New screens built in phase 12 inherit the rule through it.

## Drunk grandma check

- The one thing to press on a screen is the only lime block: Save, New level, Ship. Nothing else competes.
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
- `site-c/`: the site mockups (below).

Checks on the branch: editor unit (all), `layout (chromium)` (all), `svelte-check`. WebKit and Firefox layout runs are
not runnable in cloud sessions and are pending on the Owner's machine.

## Site: option C, picked

The Owner, 2026-11-06, approving the plan ("Let's do that"): the mockups decide the direction, then phase 18 builds it
with the site visual audit's fixes (`refactor/2026-11-06-site-visual-audit.md`). Of three options (A ink, B cobalt,
C lime flat) the Owner picked **C. Lime, flat**.

Option C, as mocked (`site-c/opt-c-lime.css` in the shared folder, injected into the running site for the pictures
only; no site file changed): the site's radii on the same scale (`--radius-sm` 4px, `--radius` 6px, `--radius-lg`
8px, `--pill` 4px); a flat lime primary with an ink edge and the skill's hover and press; one secondary look (Search
and the migration links take the plain button); no glass, glow, flutes or curtain; the lime logo mark and live LED
kept. Plus the audit's shared-layout fixes: **M1** 44 px footer, "On this page", Copy, demo controls, hero text link
and logo; **M2** code never breaks inside a word; **M4** a solid phone menu; **L1** no `⌘K` on touch; **L3** no
floating vertical label. M3, H4, H5, M6 and copy are page structure and stay in phases 18 to 20.

The skill's own checker (`consistency.mjs`, home page, 1440 and 390, `--page software`) ran on today's site and on
option C (reports beside the pictures). Option C clears `button-contrast` and the page-wide `button-styles` (4 button
looks today, 2 in option C). One screen still has 3 looks because the demo's "Play here. No setup needed." caption is
drawn like a button; phase 18 should make it plain text. The checker's other FAILs (one section per screen, section
heights, container edges, scroll-linked, captions) come from its landing-page rules and the page structure, not the
look. They are input for 18.2's Home rewrite, not part of this change. `check.mjs` could not run: it expects the
skill's own page skeleton (`main > section > .wrap`).

Pictures: shared folder `refactor/2026-11-06-visual-direction/site-c/`, each "Now" beside "C": `home`, `start`,
`docs_quick-start`, `examples`, `editors`, `showcase` at `--desktop` and `--phone`, plus `menu-open--phone` and
`code--phone`.

## For the site, later

The site change is option C's CSS turned into real edits of `site/src/app.css` and the
shared tokens (`--radius*` and `--pill` onto the 4/6/8 scale, the flat primary), which also updates
`packages/editor/tests/fixtures/tokens/site-root.css`. It belongs to the site's phase 18.0 (the shared layout).

## The dark look (2026-11-08)

The Owner asked for a dark mode ("I can't imagine working in that for hours"). The editors follow the device and have one
control on each Home, "Editor colours: Light · Dark · Match device", remembered in the browser. The colours are tokens with
a value for each look (`tool-theme.json`, written out as plain values, not `light-dark()`, because the level canvas reads
them as text); the light values are today's. Anything drawn over the game, the level canvas, the Feel cabinet, Walk's HUD
and the Studio's marks, uses fixed on-stage tokens, so the game's pictures keep their colours in both looks. Design:
[the spec](2026-11-08-dark-mode-spec.md); how it was built and checked: [the plan](2026-11-08-dark-mode-plan.md).

