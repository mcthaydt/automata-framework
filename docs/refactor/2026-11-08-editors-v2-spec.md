# Editors v2: the editors' new look, spec

The Owner, 2026-11-08: the editors' whole look is redesigned after the approved site v2, "not even just the dark mode,
the entire aesthetic". On 2026-11-08 at 18:45 UTC the Owner approved the editors v2 mockup on its decision card with
**"Approve, open in Dark"**: the editors open in the dark look, and Light and Match device stay on Home. This replaces
dark mode's rule (PRs #504 and #506) that the editors follow the device until a person chooses.

This is stage 2 (spec and plan) of the editors v2 pipeline. The plan is
[`2026-11-08-editors-v2-plan.md`](2026-11-08-editors-v2-plan.md).

**The picture.** The approved design lives in the project's shared folder,
`/mnt/project-files/refactor/2026-11-06-redesign-mockups/`:

- `editors-v2/`: a static mockup of the non-3D screens (its Review screen is not built: section 2). Open `index.html?s=<screen>`, with `&selected`, `&picker`,
  `&sheet=list`, `&publish` or `&light` (its `README.md`). Its `editors.css` is the reference for every size and colour
  below; where this spec and that file differ, this spec wins (section 5 names each difference).
- `shots-editors-v2/` (48 pictures at 2x) and `boards-editors-v2/` (overview, desktop, tablet, phone, states).
- `PATTERNS-EDITORS-2026.md`, the design note. A copy is checked in at
  [`docs/design/editors-v2/PATTERNS.md`](../design/editors-v2/PATTERNS.md), so the build has it with the code.

**The baseline.** Two lines of work meet here, and neither holds the other yet:

- the shared-editors build (spec [`2026-11-08-shared-editors-spec.md`](2026-11-08-shared-editors-spec.md), built on
  PR #508, `claude/complete-game-journeys`), which gives the rail one entry per editor, Characters on the rail in both
  kinds, the `person` icon, and the phone tab bar's More (its Task 4);
- dark mode, PR #504 and its fixes PR #506 (`claude/project-thread-6mtkk6`, with Levels 3D merged in), which gives
  `tool-theme.json`, `tool-theme.css`, `theme-choice.ts`, `ThemeChoice.svelte` and `public/theme-boot.js` in each
  editor page.

The build starts from the newest head of the shared-editors build and merges #506's branch into it first (plan Task 1).
Paths below were read on #508 at `89db7336` and on #506 at `30667aa3`.

## 1. What changes, in one paragraph

The editors keep every feature and every file they write. What changes is how they are drawn and laid out: the site v2
palette and type; one inset work panel on a darker window; a sidebar with an icon and the whole name of each editor; a
breadcrumb header that holds where you are, Undo, Redo, the problem count, Saved, Play and Publish; rows and label-left
fields in place of boxed cards; floating canvas tools; a dark dotted stage under every picture of the game; bottom
sheets and a tab bar on a phone; and an empty state with one way forward. Publish is the only lime button. The editors
open in the dark look.

## 2. What is not in this plan

- **No feature is added or removed.** Every action a screen has today stays, at every size. Left out on purpose, as the
  design note says: a command menu (Cmd-K), a game preview on Home, presence and comments, an AI chat panel, tours and
  layout tooltips.
- **The 3D editors' insides.** Levels 3D (with Walk) and the Studio take the new shell, header, sidebar, tab bar and
  tokens, because they are drawn inside the same suite shell. Their own panels, plan and dollhouse are not redrawn here, except that their
  `variant="primary"` buttons outside a dialog become secondary (section 9), or the one-lime rule fails on their screens;
  they must not break, and `.github/workflows/3d.yml` proves it (plan Task 14).
- **Review.** The mockup draws a Review page under "Waiting for you". The suite has no Review: it was deleted with the
  change-set desk (`a15c7b36`, "the change-set desk, Tuner locks and the ask mode are gone"), on both bases. Building
  it again is a feature, so it is not in this plan: no "Waiting for you" group, no Review row, card, tab or empty
  page. The `review` icon stays in the kit, unused by the suite. (Plan audit A1; the Owner may ask for it later.)
- **The game's pictures.** Canvases keep their pixels; only the stage around them changes (section 6).
- **The site's own look.** The site is not redrawn. Because the site imports the editor kit's `tokens.css`, it must stay
  legible after the token change; section 8 says how that is proved.
- **Which editors the web page carries.** That is the apps work's (the apps audit's D1). Every rule here works on "the
  editors this page registers".

## 3. Opening in Dark

- **The first look is Dark.** A person who has never chosen sees the dark look, whatever the device says.
- **The control stays on each Home**, with the same visible label, "Editor colours", and the options in this order:
  **Dark · Light · Match device**. Dark is first because it is what a person sees until they change it.
- **What is remembered.** `automata-editor:theme` (`THEME_KEY`, unchanged) holds `dark`, `light` or `device`. A missing
  key, a refused store or any other value means Dark. Match device is now written as `device`, where today it removes
  the key, because a missing key now means Dark. Someone who picked Match device under dark mode's rule has no key and
  so opens in Dark once; they choose Match device again, which is then kept. That is the Owner's new default, and the
  plan's log says so.
- **The page attribute.** `<html data-theme>` holds the choice: `dark`, `light` or `device`. With no attribute (a page
  whose boot script did not run) the page is dark.
- **The CSS default is dark.** `tool-theme.css` puts the dark values under `:root` with `color-scheme: dark`; the light
  values under `:root[data-theme="light"]`; and the light values again under `:root[data-theme="device"]` inside
  `@media (prefers-color-scheme: light)`. Values stay plain colours, not `light-dark()`, for the same reason as today:
  the level canvas reads `--color-layer-*` and the stage colours with `getPropertyValue`, and older iPads.
- **The boot file.** Each `public/theme-boot.js` (the 2D page, the suite and the 3D page) sets `data-theme` to the
  stored choice, or to `dark`, before the first paint. It stays a file, because the site serves the 2D editor under
  `script-src 'self'`. The test that pins every copy to `THEME_BOOT` stays.
- **`tokens.json` says `"colorScheme": "dark"`.** It is the generated `tokens.css`'s `color-scheme`, which every editor
  page and the site import. The editors agree with it; section 8 covers the site.

## 4. The tokens

The palette is site v2's. Radii stay 4, 6 and 8 px (`--edge-sm`, `--edge-md`, `--edge-lg`). Every colour lives in
`packages/editor/src/shared/kit/tokens/tool-theme.json`, in both looks, and `tool-chrome.css` maps it onto the names the
kit reads. New names are added to `tool-theme.json`; no component holds a colour.

| Token (in `tool-theme.json`) | Dark | Light | What it is |
| --- | --- | --- | --- |
| `tool-bg` | `#0b0c0e` | `#f4f4f5` | the window, behind the sidebar and the inset panel |
| `tool-panel` | `#111316` | `#ffffff` | the inset work panel |
| `tool-raise` (new) | `#181b20` | `#f7f7f8` | a raised control, a floating toolbar, a menu, a sheet, a dialog |
| `tool-hover` | `#1b1e23` | `#f0f0f2` | a row under the pointer |
| `tool-selected` | `#1c2333` | `#eceef8` | the chosen row |
| `tool-line` | `#22252b` | `#e7e7ea` | hairlines |
| `tool-line-strong` | `#33373e` | `#d4d4d8` | a field's edge, a raised control's edge |
| `ink` | `#f2f3f5` | `#18181b` | words |
| `tool-muted` | `#a6abb3` | `#5f5f6a` | labels, quiet words |
| `tool-faint` | `#8f959e` | `#6b6b76` | counts, hints, the status line |
| `cobalt` (the accent) | `#8ea2ff` | `#1d278a` | focus ring, links, chosen marks |
| `warn` | `#f5b14c` | `#8a5300` | a problem |
| `bad` | `#ff7a6e` | `#b42318` | what destroys |
| `ok` | `#6fd08c` | `#1e6b34` | all clear |
| `lime-hover` (new) | `#d8f77d` | `#d8f77d` | the Publish button under the pointer |
| `on-lime` | `#11151c` | `#11151c` | words on lime |
| `tool-stage` | `#08090b` | `#08090b` | the stage under every picture of the game, the same in both looks |
| `tool-dot` (new) | `#1d2026` | `#1d2026` | the stage's dots, every 20 px |

| `tool-line-hover` (new) | `#4a4f58` | `#a1a1aa` | a secondary button's edge under the pointer (the mockup's raw colours, made a token) |

Every other key `tool-theme.json` holds today (`stage-warn`, `danger-wash`, `scrim`, `shadow-ink`, `shadow-ring`,
`shadow-lift`, `on-accent`, `primary-edge`) stays, with today's values unless this table names it. `tool-stage` moves
from `#0e1014` to `#08090b`, so baselines that show the stage move once (plan Task 14 names them).

`--lime` stays `#cbf25c` in `tokens.json`. Light keeps a 1 px ink edge on Publish (`primary-edge`), as the mockup does;
dark has none (`primary-edge` = the lime).

**Contrast.** Every pair of words on a background the editors draw clears 4.5:1, in both looks: `ink`, `tool-muted` and
`tool-faint` on `tool-panel`, `tool-raise`, `tool-hover` and `tool-selected`; `warn`, `bad`, `ok` and `cobalt` on
`tool-panel` and `tool-raise`; `on-lime` on `lime` and on `lime-hover`; `tool-faint` on `tool-bg` (the sidebar's group
labels). Words on the stage read the fixed `--stage-*` tokens (dark mode's rule, kept). A unit test computes every pair
with the kit's `contrast()`. Measured for this spec: every pair clears 4.5:1; the closest is `tool-faint` on
`tool-selected` in light, 4.55:1, so neither may move without the test.

**Sizes.** The density stays in `tool-chrome.css`, chosen by pointer as today (a fine pointer that hovers; any coarse
pointer wins):

| Size | Mouse | Touch |
| --- | --- | --- |
| a list row, a control, an icon button (`--size-hit`) | 32 px | 44 px |
| a field (`--size-field`, new) | 28 px | **44 px** |
| a primary button (`--size-primary`) | 32 px | 48 px |
| the header (`--shell-topbar`) | 48 px | 56 px |
| a tab in the tab bar | - | 56 px |
| the status line | 28 px | hidden in compact |

Type: Geist 13/18 for the interface, Geist Mono 12 (`text-mono-12`) for numbers, paths and the status line, headings Geist 600 at 15, 20
and 24 px. Geist is already the kit's font (`fonts.css`).

## 5. Where this spec differs from the mockup

The mockup is a picture; these are the rules it broke, and this spec wins:

- **Fields on touch are 44 px, not 40.** Every touch target is at least 44 px (AGENTS.md).
- **Chips a person taps are 44 px on touch**, not 32. A chip that only shows a count may stay 24 px with a mouse and
  32 px on touch, because it is not a target.
- **The light look's Publish edge is a token** (`primary-edge`), not a per-look override in a component.
- **Problems and Saved are in the title menu on a phone**, not dropped. The mockup hides them in compact; a phone keeps
  every action and every state (section 7).

## 6. The layout

Three layouts, chosen by the window and not the device, with the breakpoints `shell-mode.ts` already has
(`WIDE_MIN_WIDTH` 1180, `COMPACT_MAX_WIDTH` 760, `COMPACT_MAX_HEIGHT` 520, read from the size before the keyboard).

- **Wide (1180 px and up).** The window colour holds a 224 px sidebar on the left. Beside it, inset 8 px from the top,
  right and bottom, the work panel: `tool-panel`, a 1 px `tool-line` edge, 8 px corners. The panel's rows are the
  header, the body and the 28 px status line. The body is the editor's list (264 px), its work, and its inspector
  (320 px, docked), split by hairlines.
- **Medium (761 to 1179 px, at least 521 px high).** The sidebar folds to a 76 px rail on the left: each editor's icon
  above its whole name at 11/12 px, 52 px tall (56 on touch). No name is cut. The list stays beside the work; the
  inspector floats over the work's bottom right (296 px wide, `tool-raise`, 8 px corners) when something is chosen,
  and is a button in the header otherwise. Today's medium tab bar along the foot goes; the rail replaces it.
- **Compact (760 px or less wide, or 520 px or less high).** No sidebar. The panel fills the window with no inset. The
  header is the Home button, the title menu, Undo, Redo, Play (icon) and Publish. The list and the inspector open as
  bottom sheets. A tab bar sits along the foot (56 px). The status line is hidden.
- **A phone held sideways** (520 px or less high and 561 px or more wide): the tab bar stands as a 72 px rail on the
  left, so the work keeps its height, and a canvas's tool dock stands at the right edge.
- **The stage.** Every picture of the game (the level, the tile sheet, a character, the Tuner's game, the Writer's and
  Sequence's previews, the Schematic board) sits on `tool-stage` with `tool-dot` dots every 20 px, in both looks, so the
  game's colours never shift. The level keeps its own background colour inside the stage.
- **Schematic's board turns tall** when its area is narrower than it is high (a phone, an upright iPad), so its modes
  stay readable instead of shrinking. The modes' order and links do not change.

## 7. The kit parts

Each is one part in the kit (`packages/editor/src/shared/kit/`), used by every editor; no editor draws its own version.
Where a part replaces an existing one, the old one goes in the same task.

1. **The inset shell.** `EditorShell.svelte` and `shell-layout.css` lay out the window: the sidebar region, then the
   inset panel with the header, body and status rows (section 6). The shell keeps its regions, sheets, detents and
   `data-*` attributes; the rail region becomes the sidebar region in wide and medium and the tab bar in compact.
2. **The sidebar.** `Sidebar.svelte`: the game's mark (its first letter, with a 3 px lime foot) and name, which opens
   the game menu; Home; and a sentence-case group label "Editors" over every editor the page registers, in the suite's
   order. Each row is the editor's own icon and its whole name, 32 px (44 on touch). A count of the editor's problems
   sits at the row's end in `warn` when it has any: the check findings whose `path` the editor list gives to that
   editor (the lookup Locate uses). The editors are still a `tablist` named "Editors" of `tab`s named by the editor's
   name alone (the count is `aria-hidden`, and the tab is described by "1 problem"), because every journey opens an
   editor with `getByRole('tab', { name, exact: true })`; Home is a button outside the list. It keeps today's rail
   keyboard rules (one tab stop, arrows, Home, End, Cmd or Ctrl with 1 to 9). In medium it is the 76 px rail. Home
   shows the sidebar too (today Home has no rail, `data-rail="none"`).
3. **An icon for each editor**, by id: Home `home`, `tuner` `sliders`, `levels-2d` and `levels-3d` `levels`,
   `characters-2d` and `studio` `person`, `feel` `zap`, `audio` `volume`, `writer` `message`, `sequence` `clapper`,
   `schematic` `workflow`, all Lucide (ISC), copied from the mockup's `icons.js`. No two editors of one game share an
   icon. Levels 2D's two rail entries carry their icons in their entry definitions (the shared-editors build's
   `SuiteEntryDef.icon`, today `grid` and `person`), so those definitions change too, not only `iconFor`.
4. **The breadcrumb header.** `SuiteHeader.svelte`, replacing the middle of `SuiteTopBar.svelte`: the editor's icon and
   name, a slash, then the open document's name with a chevron ("Levels / Start ▾"), which opens the document menu
   (today's level picker and the editor's document actions). Then the editor's view tabs, if it has any (Levels: Level ·
   Tiles), as a segmented control. Then, on the right: Undo and Redo (named with the step, as today), the problem count, Saved (a tick and "Saved", or "Saving…", or the failure in
   words), Play (secondary) and Publish (the lime). In medium the editor's name and the first slash drop; under 900 px
   the problem count keeps its number and icon and drops its word. In compact the header is section 6's, and the title
   menu holds the view tabs, the problem count, Saved and the document actions, so none is lost. Today's pills
   (`SuitePills.svelte`) become the problem count and its menu. The count reads today's checks model (`checksPill`
   in `pills-model.ts`), so it keeps every state the pill has, in these words: checks running, "Checking…"; none run
   yet, "Not checked yet"; passed, "No problems" in `tool-muted`; warnings or failures, "1 problem" / "3 problems" in
   `warn` (the findings counted); a check that could not run, "Couldn't check" in `warn`. Its menu lists the findings
   with Locate, as the pill's popover does today.
5. **Rows and fields.** `Section.svelte` (a 32 px head of muted 12 px words, an optional count in mono and an optional
   add button, hairlines between sections), `Row.svelte` (32 px, 44 on touch, 6 px corners, hover and chosen colours,
   optional leading swatch or icon, trailing meta, and row buttons that show on hover with a mouse and always on touch,
   at 44 px), and `Field.svelte` (a label on the left at 108 px, its control on the right, an optional hint under it,
   and an optional warning under it in `warn` with the alert icon). A field's control is the kit's existing widget
   (Stepper, Picker, ColorField, Slider, a switch), restyled to 28 px (44 on touch) with a 1 px `tool-line-strong`
   edge and `tool-bg` inside. **No field sits in its own bordered box.** A repeated item (one effect in a feel, one
   tone in a sound) is one `Block.svelte`: a 44 px head with its icon, name and Remove, then its fields split by
   hairlines. A block never holds a block. `extensions/editors/src/shared/ui/FieldRow.svelte` and the `.card` style
   in `EditorPage.svelte` go.
6. **The floating toolbar.** `FloatingToolbar.svelte`: a row of icon buttons on `tool-raise` with a `tool-line-strong`
   edge, 8 px corners and a soft shadow, placed top centre on a canvas; the chosen tool is `ink` on `tool-bg` reversed.
   A second one holds zoom, bottom right. When its container is 480 px wide or less, a group marked as the toolbar's
   second row (the brush size) moves under a hairline and gains its label: **"Brush size – 1 +"**. In compact the
   tools sit in a dock above the tab bar; on a phone held sideways, at the right edge, standing.
7. **Sheets.** `Sheet.svelte`: a bottom sheet on `tool-raise` with 12 px top corners, a grabber, the scrim
   (`--scrim`), a focus trap, Escape and a tap on the scrim to close, at most 72 % of the window's height, and the
   bottom safe area. The shell's region sheets (the list and the inspector, with today's peek, half and full detents),
   the title menu and every menu opened in compact use it.
8. **The tab bar.** `TabBar.svelte`, in compact: four editors and More, each its icon over its name, 56 px. The first
   four in the suite's order are shown, and the open editor takes the fourth slot when it would be under More (the
   shared-editors rule, now with four slots). The open tab is `ink` with a 2 px lime bar at its top (at its left when
   it stands sideways). More opens a sheet of the rest by name. The tabs keep the `tab` role and
   their names, and More's items are found by the journeys' `openFromRail` (shared-editors Task 4).
9. **The empty state.** `EmptyState.svelte`: an icon in a 40 px tile, a title, one line on why it is empty, and one
   action. Levels with no level, every content editor's start page and Characters with no character use it, each with
   today's one action ("Start a feel file", and so on) and today's words for why it is empty (Characters: "No
   characters yet" / "Add one to place it in your levels.").
10. **The status line.** `StatusLine.svelte` becomes the panel's foot in Geist Mono 12 px, `tool-faint`: the file,
    plain counts ("32 × 18 tiles of 16 px", "6 lines · 2 speakers") and the state, with warnings in `warn`. Hidden in
    compact; nothing that is only there is needed to act.

## 8. The site

The site (`site/`) imports `@automata/editor/tokens.css` (`site/src/app.css`, and `site/src/shared/styles/tokens.css`
on the site slice's branch, PR #517). Changing `colorScheme` changes the `color-scheme` the site inherits, which moves
the colour of its native controls, scroll bars and form fields.

- **The site says its own `color-scheme`** in its own tokens file (`site/src/app.css`'s `:root` on #506;
  `site/src/shared/styles/tokens.css` on the site slice's #517, which already sets the site's `--bg` and `--panel`), next to its own `--bg` and `--panel`, so a change to
  the editors' default never moves the site by accident. Its value is whatever the site's look is when this lands
  (light on today's site; dark once the site slice's dark v2 is in).
- **Every site page's contrast is checked** after the change. `site/tests/e2e/site.e2e.ts` already runs axe at WCAG
  2.2 AA (`axeViolations`, `color-contrast` included) on every page of its `PAGES` list at 375 and 1280 px wide; the
  build adds the same pass in a context whose device asks for dark, and asserts the page's computed `color-scheme` is
  the site's own. It uses `PAGES`, not a second route list, so a page added later is checked too. The try-it editor at
  `/editor/app/` is an editor page and opens Dark like the others; the check covers it.
- No site page's colours are changed to pass, except where the check finds a pair that fails, and each such change is
  named in the plan's log.

## 9. One lime button

- **On every screen, Publish is the only lime button.** Every other `variant="primary"` in the editors becomes the
  secondary look (`tool-raise`, `tool-line-strong` edge, `tool-line-hover` under the pointer): "Add an effect", "Start a feel file", "Add this line" and the
  rest (63 `variant="primary"` uses on #508 at `89db7336`: 22 in `packages/editor`, 30 in `extensions/editors`
  and 11 in `packages/editor-3d`). Sequence's Play becomes secondary
  too.
- **Lime also marks what is happening now**, never a button: the Sequence playhead, the "Playing" dot on the Tuner's
  game, and the open tab's bar on a phone. A switch's on track is `ink`, not lime.
- **A dialog is its own layer.** While a dialog is open, its one confirm may be lime ("Build my game" in Publish) and
  the screen behind it sits under the scrim. A test counts lime buttons per layer.

## 10. The words

The drunk grandma test: could a drunk grandma tell what is happening and what to press? These words are fixed, and a
DOM test asserts each:

| Where | Was | Now |
| --- | --- | --- |
| Home's heading | (the game's name) | **What do you want to change?** / Pick a part of your game. Everything you change is saved in your game's folder. |
| Home's cards | the editor's name twice ("Feel / Feel") | its name, a plain line, and what is in it (the table below) |
| A Leads to field with no target (a Door, a Warp), under the field and in Problems | `target is required` | **The Door doesn't lead anywhere yet. Choose where it goes.** (the thing's own name) |
| Any other required field left empty | `<field id> is required` | **The Slime needs a Patrol path. Fill it in.** (the thing's name and the field's label) |
| A character's health (the `hp` field label in the platformer template's Slime and the top-down template's Enemy; the field shows its value alone, its range in the hint) | Hit points: 3 of 9 | **Hits to beat it: 3** |
| The narrow toolbar | – 1 + | **Brush size – 1 +** |
| Publish | a checklist | **Put your game online**, three plain steps, then **Build my game** |
| The colours control | Light · Dark · Match device | **Dark · Light · Match device** |

Home's card lines, from the mockup:

| Card | Line |
| --- | --- |
| Tuner | Speeds, jumps and the keys that play it, tried while you play. |
| Levels | Draw the places your game happens in. |
| Characters | What each person and thing looks like. |
| Feel | Shakes, freezes and flashes when something happens. |
| Audio | Sounds and music, and when each one plays. |
| Writer | What people say to each other. |
| Sequence | Cutscenes: who moves, what shows and when. |
| Schematic | How characters behave: where they walk, what they notice. |

A card's second line names what is in it from the game (for example "Start · Shop", "3 feels"), or the shared-editors
build's "Nothing made yet. Open it to start." when the editor has no file (its Task 3 test asserts those words; the
mockup's "Nothing waiting." is not used). No file key, glob, package name or event id is page text, except where the shared-editors spec
already allows it.

## 11. What proves it

A screenshot proves none of focus, hit testing or a journey (AGENTS.md). So:

- **DOM tests** (jsdom): each kit part's roles, names and keyboard rules; the theme default; the words in section 10;
  the tab bar's four slots and More; one lime per layer.
- **Layout tests** (real browser, Vitest browser mode): every screen at seven sizes (1440 × 900; 1024 × 768;
  1194 × 834 and 820 × 1180 with touch; 390 × 844, 844 × 390 and 360 × 640 with touch), in both looks: no sideways
  scroll; no header overflow; every control at least 44 px on touch and primary 48; no sidebar or tab label cut; focus
  kept through a rotation and the keyboard; the toolbar wraps at 480 px.
- **Contrast:** the token unit test (section 4), and axe's `color-contrast` on every editor screen in both looks at
  1440 × 900 and 390 × 844.
- **Journeys:** the existing editor journeys pass in the new look; the dark played-game journey
  (`extensions/editors/tests/e2e/journeys/dark-game-loop.test.ts`) opens with no stored choice, so it now proves the
  default; and it presses Play. `complete-game-2d` and `complete-game-3d` pass in the new look, so every editor is
  proven in both kinds of game.
- **Visual baselines** that move are looked at (expected, actual, diff) and each change is named in the plan's log.
- **The build audit makes a small game in the rebuilt editors, plays it, and confirms that what was made shows up in
  play** (project rule). A new 2D game: paint tiles in Levels, change the player's picture in Characters, change a
  key or the speed in the Tuner, add a flash in Feel, change a sound in Audio, and change the keeper's line in Writer
  (the shared-editors build's 2D template has the keeper); then press Play and see or hear each one. And a new 3D game:
  a wall's material in Levels 3D, Wick's height in Characters, the walking speed in the Tuner and a flash in Feel
  (every editor works in both kinds). On a phone size and an iPad size, in the dark look and once in the light look.

## 12. Gates

- `pnpm check`, `pnpm test:unit:2d` and `pnpm test:browser:2d` on every commit that touches code; the site's e2e
  (`site/tests/e2e`) for section 8; `.github/workflows/3d.yml` for the 3D editors (section 2). Parity is unaffected:
  nothing here touches the sim, and no hash may move.
- `@automata/editor`, `-editors` and `-3d` are private: no changeset. If a published package's exports move (none
  should), the AGENTS.md steps apply.
- WebKit, Firefox and real devices cannot run in a cloud session; the build says which it did not run.
