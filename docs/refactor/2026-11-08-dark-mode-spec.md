# Dark mode for the editors

The Owner, 2026-11-08: "Also, do a dark mode for the editors, I can't imagine working in that for hours."

## 1. What this is

A second look for every editor screen: the suite (Home, the rail, the top bar, Ask, Publish, Export and Import), Levels
2D (with Characters and Add tiles), Levels 3D (Plan, 3D, Walk), the Studio, the Tuner, Feel, Audio, Writer, Sequence and
Schematic, and the standalone 2D and 3D editor pages. It is a full theme, not a darker panel here and there.

- **By default the editors follow the device.** A phone, an iPad or a Mac set to dark gets dark; set to light gets light.
- **One control changes it**, on each Home: "Editor colours: Light · Dark · Match device". The choice is remembered in this
  browser and applies to every editor page on the same address.
- **The game never changes colour.** Every canvas or preview that shows the game (the level, the 3D views, Walk, the
  Studio stage, the Tuner's live split, Feel's stage, Sequence's preview, Schematic's watch, the Home cards' level
  pictures) draws exactly the same pixels in both looks, and so does the cabinet round it (`--tool-stage`). Only the
  chrome around it changes. Anything drawn over a game picture (Walk's HUD and sticks, the Studio's markers, Feel's
  square) reads the fixed on-stage colours (§3.2), so it is the same in both looks too. The game's own pages (Play, a
  published build) are not editors and are untouched.
- **The website is untouched.** It shares `tokens.css` with the editors; the dark look lives only in the editors' own
  layer (`tool-chrome.css`), which the website does not import. The try-it editor the site serves at `/editor/app/` is
  the 2D editor's own build, so it is an editor and gets both looks; the site's own pages around it do not.

What it is not: no per-editor themes, no custom colours, no high-contrast mode, no schedule, no "dim" third look. Those are
not essential (the Owner, 2026-11-06: editors have only essential features).

## 2. What the code looks like today

The editors are almost entirely token-driven, which makes this small.

- `packages/editor/src/shared/kit/tokens/tokens.json` is the shared source; `scripts/generate-tokens.ts` writes
  `tokens.css` (`color-scheme: light`). The website imports it too.
- `packages/editor/src/shared/kit/tool-chrome.css` is the editors' own layer: it points the kit's names (`--bg`,
  `--paper`, `--surface`, `--line`, `--line-strong`, `--muted`, `--cobalt-soft`, `--charcoal`) at the neutral
  `--tool-*` tokens of the approved mockup, and sets the density (32 px rows with a mouse, 44/48 px on touch).
- Svelte components read tokens: no `white`, `black` or hex in any editor component's style except the cases in §2.1.
  Inline styles in `extensions/editors` read tokens only.

### 2.1 Places that do not follow the tokens yet

| Where | What | Fix |
| --- | --- | --- |
| `editor-3d` `main.ts` and `suite-main.ts`, `extensions/editors` `suite/main.ts` | They import `tokens.css` and `suite.css` but not `tool-chrome.css`, so the full suite, Levels 3D, the Studio and the content editors draw the website's field, not the approved tool look. | Every editor page imports `tool-chrome.css` (exported as `@automata/editor/tool-chrome.css`). |
| `editor-3d/index.html`, `editor-3d/suite.html`, `extensions/editors/suite.html` | `<meta name="color-scheme" content="dark">` on a light page, so form controls and scroll bars can draw dark on light. The editor pages in `packages/editor` say `light`. | Every editor page says `light dark`. |
| `WalkHud`, `WalkSticks`, `StudioCanvas`, `StudioTimeline`, `FeelStage` | Words and marks on the cabinet (`--color-bg-canvas`) read `--color-text-primary` and `--color-text-dim`: in light that is near-black ink on a near-black field (1.0:1 on Walk's HUD today), and in dark it would turn light. Feel's square is drawn in the field's text colour on `--color-bg-field`, read once per replay, so a change of look mid-play leaves it drawn in the old colour. | On the cabinet, words read the fixed `--stage-ink` and `--stage-muted`, edges `--stage-line` (§3.2). Feel's stage becomes a small cabinet (`--charcoal` field, `--stage-ink` square), the same in both looks. |
| `--primary-hover` | `color-mix(in oklab, var(--lime) 86%, var(--ink))`: in dark `--ink` turns light, so the hover would lighten the lime instead of darkening it. | Mix with `--on-lime` (§3.2), which is `--ink`'s light value, so light does not move. |
| `LevelPanel.svelte`, `AnimationSection.svelte` | `var(--color-danger, #b91c1c)`: `--color-danger` is not a token, so the fallback always wins. | Read `--color-state-bad`. |
| `WalkHud`, `WalkSticks`, `PoseFields`, `StudioCanvas`, `NudgePad`, `NewSectorCard`, `StudioPanel` | `var(--token, #literal)` fallbacks to the old dark 3D look. | Drop the fallbacks; the token is always defined. |
| `--primary-ink`, `--primary-edge`, `--color-accent-ink` | Defined as `var(--ink)` or `--stage-ink`; in dark `--ink` turns light, which would put light words on lime. | New fixed tokens for words on a colour (§3.2). |
| `Palette.svelte`, `TilesetSheet.svelte` text shadows, `SequencePreview` `fill: black`, the `#0c0d10` canvas fields in Plan, 3D and Walk, `plan-colors.ts`, `dollhouse-paint.ts`, the Studio's `0x14161a` | Drawn on or inside a game picture. | Stay as they are: the game keeps its colours (§1). |

## 3. The look

### 3.1 How it is chosen

`<html>` carries the choice: no attribute follows the device; `data-theme="light"` or `data-theme="dark"` forces one.
The generated stylesheet writes each token's light value plainly and its dark value twice, once for a device set to
dark and once for the forced choice:

```css
:root {
  color-scheme: light dark;
  --tool-panel: #ffffff;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --tool-panel: #1b1c20;
  }
}
:root[data-theme="light"] {
  color-scheme: light;
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --tool-panel: #1b1c20;
}
```

`color-scheme` also turns the browser's own parts (scroll bars, the colour picker, date and number fields, the caret)
dark. CSS `light-dark()` was the first draft and is not used, for two reasons found in the plan audit:

- **The canvas reads tokens as text.** The level canvas and the Home cards' thumbnails resolve a project colour such as
  `layer/entities` with `getComputedStyle(…).getPropertyValue('--color-layer-entities')` and parse a hex
  (`shared/level-2d/canvas/colors.ts`). A custom property holding `light-dark(…)` comes back as that text, unresolved,
  and parses to the neutral grey. With plain values per block, any token a script reads is a plain colour in both looks.
- **Older browsers.** `light-dark()` needs Safari 17.5 (iPadOS 17.5); on an older iPad every `var()` that held one
  would be invalid at computed-value time, leaving fields transparent. The media-query form works wherever the editors
  already do.

Tokens a script reads as text (the canvas palette `--color-layer-*` and `--color-phase-*`) are never themed: they are
the game's colours, the same in both looks. A shadow is not a colour, so shadows read a colour token (`--shadow-ink`)
rather than holding one.

### 3.2 The tokens

The source is a new `packages/editor/src/shared/kit/tokens/tool-theme.json`, `{ light: {…}, dark: {…} }`, with the same
keys in both. `generate-tokens.ts` writes it to `tool-theme.css` as `light-dark()` pairs, with the same `--check` that
guards `tokens.css`. `tool-chrome.css` imports it first and keeps the density rules. Light values are today's, so the light
look does not move a pixel on the pages that already draw the tool chrome (§2.1 names the pages that change in light
because they did not).

| Token | Light (today) | Dark | Read as |
| --- | --- | --- | --- |
| `--tool-bg` → `--bg` | `#f7f7f8` | `#131417` | the app field |
| `--tool-panel` → `--paper` | `#ffffff` | `#1b1c20` | panels, sheets, fields, dialogs |
| `--tool-hover` → `--surface` | `#f2f2f4` | `#24252a` | hover, tracks |
| `--tool-selected` → `--cobalt-soft` | `#eceef8` | `#262b45` | the selection wash |
| `--tool-line` → `--line` | `#e7e7ea` | `#2a2b31` | hairlines |
| `--tool-line-strong` → `--line-strong` | `#d4d4d8` | `#3a3b42` | control edges |
| `--tool-muted` → `--muted` | `#5f5f6a` | `#a1a1aa` | quiet words |
| `--tool-faint` | `#6b6b76` | `#9696a0` | the quietest words |
| `--tool-stage` → `--charcoal` | `#0e1014` | `#0e1014` | the cabinet round the level: the same in both looks, because it shows through the level canvas and frames every game picture (§1); still darker than the dark field (`#131417`) |
| `--ink` | `#11151c` | `#ececef` | words |
| `--cobalt` (accent, focus, links) | `#1d278a` | `#9aa5ff` | the accent |
| `--ok` / `--bad` / `--warn` | `#1e6b34` / `#b42318` / `#8a5300` | `#5cc27a` / `#ff8a7a` / `#f0b450` | states |
| `--danger-wash` | `rgb(180 35 24 / 0.08)` | `rgb(255 138 122 / 0.12)` | a refused row |
| `--scrim` | `rgb(17 21 28 / 0.32)` | `rgb(0 0 0 / 0.55)` | behind a dialog |
| `--shadow-ink` (new) | `rgb(17 21 28 / 0.12)` | `rgb(0 0 0 / 0.5)` | `--shadow-sheet`'s drop |
| `--shadow-ring` (new) | `rgb(17 21 28 / 0.1)` | `#3a3b42` | `--shadow-sheet`'s 1 px ring round a sheet or dialog |
| `--shadow-lift` (new) | `rgb(17 21 28 / 0.06)` | `rgb(0 0 0 / 0.4)` | `--shadow`, the hairline lift (today's 0.06, so light does not move) |
| `--on-lime` (new) | `#11151c` | `#11151c` | words on the lime primary: `--primary-ink` |
| `--on-accent` (new) | `#eef1fb` | `#11151c` | words on the accent: `--color-accent-ink` |
| `--primary-edge` | `#11151c` | `#cbf25c` | the lime button's 1 px edge (ink on light, its own lime on dark) |
| `--primary-hover` | `color-mix(in oklab, var(--lime) 86%, var(--on-lime))` | the same | the lime button on hover, a step darker in both looks (not a pair: it is defined in `tool-chrome.css` from the two tokens) |
| `--stage-ink` / `--stage-muted` / `--stage-line` (exist) | `#eef1fb` / `#aab2e0` / `rgb(255 255 255 / 0.14)` | the same | words, quiet words and edges on the cabinet, fixed: they sit on `--tool-stage`, which does not change |

The lime primary (`#cbf25c`) is the same in both: one flat lime button per screen, 4/6/8 px corners, no pill, no glow, no
glass (the 2026-11-06 visual direction). The chrome stays neutral grey, as the approved mockup is. DUEL is the games'
palette; it stays where it is, in the game's pictures, and is not used for chrome in either look.

These values are a starting point. The contrast test (§5) decides: a value that fails it changes, and the change is
recorded in the plan's log. The plan audit computed every pair in §5.1 from this table: all pass (the closest are
`--tool-faint` on `--tool-selected`, 4.73:1 in dark and 4.55:1 in light, and `--on-accent` on `--cobalt`, 8.0:1 in dark).

The chrome's control edge (`--tool-line-strong` on `--tool-panel`) is 1.48:1 in light today and 1.53:1 in dark. It is a
hairline beside a filled control, as the approved mockup draws it; the dark value must be at least as visible as the
light one, and no stronger edge is added (light does not move).

### 3.3 The control

A `ThemeChoice` kit widget: the kit's `Segmented` in its `track` look, label **Editor colours**, options **Light**, **Dark**,
**Match device**, chosen one shown as today's setting tile. The label is visible words above the track (the
`Segmented` itself names its radio group only with `aria-label`), and the radio group is named by it. It sits at the foot of each Home (the suite's, Levels 2D's
standalone Home, Levels 3D's standalone Home), under the game's cards, so it is found where every session starts and is
never in the way of work. It is 44 px tall on touch and 32 with a mouse like every control. Choosing applies at once,
with no reload and no flash, and keeps focus on the control.

Drunk grandma test for the copy: "Editor colours" says what changes and whose colours they are: on a Home full of the
game's cards, a bare "Colours" reads as the game's colours (the plan audit changed it); "Light" and "Dark" say what you get; "Match device" says
it does what the phone or computer does. Rejected: "Theme" (jargon), "Auto" and "System" (auto what? which system?),
icons alone (a sun and a moon are not obvious on a 44 px tile, and the kit has neither).

### 3.4 Remembering it

`localStorage['automata-editor:theme']` holds `light` or `dark`; no key means Match device. It is a per-visitor
convenience (like `stored-last-opened.ts`): every access is in a `try`, and a refused store means "Match device" this
session. It is not game state and is never written to the game folder. The key is the same on every editor page, so the
choice holds across the 2D, 3D and suite pages served from one address.

To keep the first frame right, each editor HTML page sets the attribute before anything paints, with one small classic
script loaded from a file in `<head>`: `<script src="./theme-boot.js"></script>`, before any stylesheet or module. It
is a file, not an inline script, because the site serves the 2D editor's build at `/editor/app/` under
`script-src 'self'` with no inline script (`site/src/shared/html/security-headers.ts`, `DEMO_POLICY`); an inline script
would be refused there and the try-it editor would flash light. The file's text is one exported string, `THEME_BOOT`;
each editor package keeps a copy in its Vite `public/` folder (so the build copies it beside the page), and a unit test
checks every copy equals `THEME_BOOT`, so the pages cannot drift.

The choice is read when a page opens. Another editor tab open at the same time picks up a change when it is next
opened; following it live across tabs is not essential.

## 4. Each editor

Every editor reads the kit's tokens, so the change per editor is checking, not drawing. What each must hold:

- **Suite shell**: rail, top bar, Home cards, Ask, Publish, Ship, Export and Import, diff view, problems list, toasts.
- **Levels 2D**: layers, palette, inspector, Characters, Add tiles' sheet; the level canvas and the cabinet unchanged.
- **Levels 3D**: tool rail, layers, inspector, the Plan/3D/Walk switch; the Plan, 3D and Walk canvases unchanged (they
  are already a dark game view), and Walk's HUD and sticks, which sit on them, in the fixed on-stage colours.
- **Studio**: panel, timeline, pose fields; the stage and the marks on it unchanged.
- **Tuner**: rows and cards; the live split's game unchanged.
- **Feel, Audio, Writer, Sequence**: their lists, fields and inline styles, Audio's mix and sound picture (#500); Feel's
  stage (a cabinet with the square in `--stage-ink`) and Sequence's preview unchanged.
- **Schematic** (#497, served in the content editors' suite): the state diagram, lists, switch list, inspectors, watch
  pane. The diagram's lines and boxes are chrome and follow the theme; the watch's game view does not.
- **Play and Publish**: the Publish dialog is suite chrome and follows the theme; Play opens the game's own page, which
  never changes.
- **The design board** (`design.html`) shows both looks side by side, so a reviewer sees every widget in each.

## 5. Checks

1. **Contrast, from the token file** (unit). For each look: words (`--ink`, `--muted`, `--tool-faint`, `--cobalt`,
   `--ok`, `--bad`, `--warn`) at least 4.5:1 on `--tool-bg`, `--tool-panel`, `--tool-hover` and `--tool-selected`;
   `--on-lime` 4.5:1 on lime; `--on-accent` 4.5:1 on `--cobalt`; the focus ring (`--focus`) 3:1 on bg and panel;
   `--stage-ink` and `--stage-muted` 4.5:1 on `--tool-stage`; the control edge in dark at least the light one's ratio;
   the cabinet darker than the field. Light must pass too; the test reads `tool-theme.json` and `tokens.json`, so it is
   the values that ship.
2. **No stray colours** (unit, source scan, the `editor-corners.test.ts` pattern). No colour literal and no
   `var(--x, literal)` fallback in an editor component's `<style>` or an `extensions/editors` inline style, except an
   allow-list of game-picture places from §2.1. Every `var(--…)` an editor reads is a token, an alias or a local
   property the component sets. A rule whose background is the cabinet (`--color-bg-canvas`, `--charcoal`) reads words
   and edges only from `--stage-*` or `--lime`. The canvas palette (`--color-layer-*`, `--color-phase-*`) is a plain
   hex and is not redefined by the theme.
3. **Every page the same** (unit). Each editor HTML page has `color-scheme` `light dark` and loads `./theme-boot.js`
   first in `<head>`; each package's `public/theme-boot.js` equals `THEME_BOOT`; each editor entry imports
   `tool-chrome.css`.
4. **The choice** (DOM). `ThemeChoice` writes and clears the key, sets and removes `data-theme`, survives a refused
   store, and its words are the §3.3 words verbatim.
5. **Real browsers** (layout, Chromium on the GPU runner, WebKit and Firefox where they run). With the device emulated
   dark and light, and with each forced choice: the computed `--paper` and body colour are the expected ones; the
   first paint after a reload with a stored `dark` on a light device is dark (read in the first `requestAnimationFrame`);
   the level canvas and the 3D Plan canvas, with the cabinet round them, are identical in both looks (an element
   screenshot of each, compared byte for byte).
6. **Screenshots** at 390×844, 844×390, 820×1180, 1180×820 and 1440×900, of the suite Home, Levels 2D, Levels 3D Plan,
   the Tuner, Feel, Audio, Writer, Sequence and Schematic, in dark. Looked at, not trusted (AGENTS.md): each one is
   checked for unreadable words, invisible edges and a light box left behind, and saved to
   `/mnt/project-files/dark-mode/`.
7. **Make and play a small game in dark** (served journey, the 2026-11-08 audit rule). In the content editors' suite
   (the one page that holds Levels 2D, the Tuner, Feel, Audio, Writer, Sequence and, with #497, Schematic), with the
   device dark: create a game, check the page is dark, paint tiles in Levels 2D, change a number in the Tuner, write a
   line in Writer, Play, see each of them in the game, and see the game's page is not themed (no `data-theme`, its own
   background); then Publish and get the zip. Levels 3D is a page of its own: a room edited there in dark on a copy of
   `base-3d` is played and seen, by hand, and logged. A step that could not run is named and left unchecked.

## 6. Open choices

None needing the Owner. The control's place (each Home, not the top bar) and its words follow the essential-only and
drunk grandma rules; if the Owner wants it reachable from inside an editor too, that is a one-line move of the same
widget into the top bar's overflow later.
