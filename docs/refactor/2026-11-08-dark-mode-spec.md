# Dark mode for the editors

The Owner, 2026-11-08: "Also, do a dark mode for the editors, I can't imagine working in that for hours."

## 1. What this is

A second look for every editor screen: the suite (Home, the rail, the top bar, Ask, Publish, Export and Import), Levels
2D (with Characters and Add tiles), Levels 3D (Plan, 3D, Walk), the Studio, the Tuner, Feel, Audio, Writer, Sequence and
Schematic, and the standalone 2D and 3D editor pages. It is a full theme, not a darker panel here and there.

- **By default the editors follow the device.** A phone, an iPad or a Mac set to dark gets dark; set to light gets light.
- **One control changes it**, on each Home: "Colours: Light · Dark · Match device". The choice is remembered in this
  browser and applies to every editor page on the same address.
- **The game never changes colour.** Every canvas or preview that shows the game (the level, the 3D views, Walk, the
  Studio stage, the Tuner's live split, Feel's stage, Sequence's preview, Schematic's watch, the Home cards' level
  pictures) draws exactly the same pixels in both looks. Only the chrome around it changes. The game's own pages (Play,
  a published build) are not editors and are untouched.
- **The website is untouched.** It shares `tokens.css` with the editors; the dark look lives only in the editors' own
  layer (`tool-chrome.css`), which the website does not import.

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

| Where                                                                                                                                                                                                    | What                                                                                                                                                                                       | Fix                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `editor-3d` `main.ts` and `suite-main.ts`, `extensions/editors` `suite/main.ts`                                                                                                                          | They import `tokens.css` and `suite.css` but not `tool-chrome.css`, so the full suite, Levels 3D, the Studio and the content editors draw the website's field, not the approved tool look. | Every editor page imports `tool-chrome.css` (exported as `@automata/editor/tool-chrome.css`). |
| `editor-3d/index.html`, `editor-3d/suite.html`, `extensions/editors/suite.html`                                                                                                                          | `<meta name="color-scheme" content="dark">` on a light page, so form controls and scroll bars can draw dark on light.                                                                      | Every editor page says `light dark`.                                                          |
| `LevelPanel.svelte`, `AnimationSection.svelte`                                                                                                                                                           | `var(--color-danger, #b91c1c)`: `--color-danger` is not a token, so the fallback always wins.                                                                                              | Read `--color-state-bad`.                                                                     |
| `WalkHud`, `WalkSticks`, `PoseFields`, `StudioCanvas`, `NudgePad`, `NewSectorCard`, `StudioPanel`                                                                                                        | `var(--token, #literal)` fallbacks to the old dark 3D look.                                                                                                                                | Drop the fallbacks; the token is always defined.                                              |
| `--primary-ink`, `--primary-edge`, `--color-accent-ink`                                                                                                                                                  | Defined as `var(--ink)` or `--stage-ink`; in dark `--ink` turns light, which would put light words on lime.                                                                                | New fixed tokens for words on a colour (§3.2).                                                |
| `Palette.svelte`, `TilesetSheet.svelte` text shadows, `SequencePreview` `fill: black`, the `#0c0d10` canvas fields in Plan, 3D and Walk, `plan-colors.ts`, `dollhouse-paint.ts`, the Studio's `0x14161a` | Drawn on or inside a game picture.                                                                                                                                                         | Stay as they are: the game keeps its colours (§1).                                            |

## 3. The look

### 3.1 How it is chosen

`<html>` carries the choice: no attribute follows the device; `data-theme="light"` or `data-theme="dark"` forces one.
The colours use CSS `light-dark()`, so each token is written once with both values:

```css
:root {
  color-scheme: light dark;
  --tool-panel: light-dark(#ffffff, #1b1c20);
}
:root[data-theme="light"] {
  color-scheme: light;
}
:root[data-theme="dark"] {
  color-scheme: dark;
}
```

`color-scheme` also turns the browser's own parts (scroll bars, the colour picker, date and number fields, the caret)
dark. `light-dark()` works in Chromium 123, Safari 17.5 and Firefox 120, all older than the engines the editors are
tested in. A shadow is not a colour, so shadows read a colour token (`--shadow-ink`) rather than holding one.

### 3.2 The tokens

The source is a new `packages/editor/src/shared/kit/tokens/tool-theme.json`, `{ light: {…}, dark: {…} }`, with the same
keys in both. `generate-tokens.ts` writes it to `tool-theme.css` as `light-dark()` pairs, with the same `--check` that
guards `tokens.css`. `tool-chrome.css` imports it first and keeps the density rules. Light values are today's, so the light
look does not move a pixel.

| Token                                  | Light (today)                     | Dark                              | Read as                                                                                   |
| -------------------------------------- | --------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------- |
| `--tool-bg` → `--bg`                   | `#f7f7f8`                         | `#131417`                         | the app field                                                                             |
| `--tool-panel` → `--paper`             | `#ffffff`                         | `#1b1c20`                         | panels, sheets, fields, dialogs                                                           |
| `--tool-hover` → `--surface`           | `#f2f2f4`                         | `#24252a`                         | hover, tracks                                                                             |
| `--tool-selected` → `--cobalt-soft`    | `#eceef8`                         | `#262b45`                         | the selection wash                                                                        |
| `--tool-line` → `--line`               | `#e7e7ea`                         | `#2a2b31`                         | hairlines                                                                                 |
| `--tool-line-strong` → `--line-strong` | `#d4d4d8`                         | `#3a3b42`                         | control edges                                                                             |
| `--tool-muted` → `--muted`             | `#5f5f6a`                         | `#a1a1aa`                         | quiet words                                                                               |
| `--tool-faint`                         | `#6b6b76`                         | `#9696a0`                         | the quietest words                                                                        |
| `--tool-stage` → `--charcoal`          | `#0e1014`                         | `#0b0c0e`                         | the cabinet round the level, darker than the field so the level stays the brightest thing |
| `--ink`                                | `#11151c`                         | `#ececef`                         | words                                                                                     |
| `--cobalt` (accent, focus, links)      | `#1d278a`                         | `#9aa5ff`                         | the accent                                                                                |
| `--ok` / `--bad` / `--warn`            | `#1e6b34` / `#b42318` / `#8a5300` | `#5cc27a` / `#ff8a7a` / `#f0b450` | states                                                                                    |
| `--danger-wash`                        | `rgb(180 35 24 / 0.08)`           | `rgb(255 138 122 / 0.12)`         | a refused row                                                                             |
| `--scrim`                              | `rgb(17 21 28 / 0.32)`            | `rgb(0 0 0 / 0.55)`               | behind a dialog                                                                           |
| `--shadow-ink` (new)                   | `rgb(17 21 28 / 0.12)`            | `rgb(0 0 0 / 0.5)`                | `--shadow`, `--shadow-sheet`                                                              |
| `--on-lime` (new)                      | `#11151c`                         | `#11151c`                         | words on the lime primary: `--primary-ink`                                                |
| `--on-accent` (new)                    | `#eef1fb`                         | `#11151c`                         | words on the accent: `--color-accent-ink`                                                 |
| `--primary-edge`                       | `#11151c`                         | `#cbf25c`                         | the lime button's 1 px edge (ink on light, its own lime on dark)                          |

The lime primary (`#cbf25c`) is the same in both: one flat lime button per screen, 4/6/8 px corners, no pill, no glow, no
glass (the 2026-11-06 visual direction). The chrome stays neutral grey, as the approved mockup is. DUEL is the games'
palette; it stays where it is, in the game's pictures, and is not used for chrome in either look.

These values are a starting point. The contrast test (§5) decides: a value that fails it changes, and the change is
recorded in the plan's log.

### 3.3 The control

A `ThemeChoice` kit widget: the kit's `Segmented` in its `track` look, label **Colours**, options **Light**, **Dark**,
**Match device**, chosen one shown as today's setting tile. It sits at the foot of each Home (the suite's, Levels 2D's
standalone Home, Levels 3D's standalone Home), under the game's cards, so it is found where every session starts and is
never in the way of work. It is 44 px tall on touch and 32 with a mouse like every control. Choosing applies at once,
with no reload and no flash, and keeps focus on the control.

Drunk grandma test for the copy: "Colours" says what changes; "Light" and "Dark" say what you get; "Match device" says
it does what the phone or computer does. Rejected: "Theme" (jargon), "Auto" and "System" (auto what? which system?),
icons alone (a sun and a moon are not obvious on a 44 px tile, and the kit has neither).

### 3.4 Remembering it

`localStorage['automata-editor:theme']` holds `light` or `dark`; no key means Match device. It is a per-visitor
convenience (like `stored-last-opened.ts`): every access is in a `try`, and a refused store means "Match device" this
session. It is not game state and is never written to the game folder. The key is the same on every editor page, so the
choice holds across the 2D, 3D and suite pages served from one address.

To keep the first frame right, each editor HTML page sets the attribute before anything paints, with one small classic
script in `<head>` (the editor server sends no Content-Security-Policy). Its text is one exported string,
`THEME_BOOT`; a unit test checks every editor page carries it verbatim, so the pages cannot drift.

## 4. Each editor

Every editor reads the kit's tokens, so the change per editor is checking, not drawing. What each must hold:

- **Suite shell**: rail, top bar, Home cards, Ask, Publish, Ship, Export and Import, diff view, problems list, toasts.
- **Levels 2D**: layers, palette, inspector, Characters, Add tiles' sheet; the level canvas and the cabinet unchanged.
- **Levels 3D**: tool rail, layers, inspector, the Plan/3D/Walk switch, Walk's HUD and sticks; the Plan, 3D and Walk
  canvases unchanged (they are already a dark game view).
- **Studio**: panel, timeline, pose fields; the stage unchanged.
- **Tuner**: rows and cards; the live split's game unchanged.
- **Feel, Audio, Writer, Sequence**: their lists, fields and inline styles; Feel's stage and Sequence's preview unchanged.
- **Schematic**: the state diagram, lists, switch list, watch pane. The diagram's lines and boxes are chrome and follow
  the theme; the watch's game view does not.
- **The design board** (`design.html`) shows both looks side by side, so a reviewer sees every widget in each.

## 5. Checks

1. **Contrast, from the token file** (unit). For each look: words (`--ink`, `--muted`, `--tool-faint`, `--cobalt`,
   `--ok`, `--bad`, `--warn`) at least 4.5:1 on `--tool-bg`, `--tool-panel`, `--tool-hover` and `--tool-selected`;
   `--on-lime` 4.5:1 on lime; `--on-accent` 4.5:1 on `--cobalt`; the focus ring (`--focus`) 3:1 on bg and panel; the
   cabinet darker than the field. Light must pass too; the test reads `tool-theme.json`, so it is the values that
   ship.
2. **No stray colours** (unit, source scan, the `editor-corners.test.ts` pattern). No colour literal and no
   `var(--x, literal)` fallback in an editor component's `<style>` or an `extensions/editors` inline style, except an
   allow-list of game-picture places from §2.1. Every `var(--…)` an editor reads is a token, an alias or a local
   property the component sets.
3. **Every page the same** (unit). Each editor HTML page has `color-scheme` `light dark` and `THEME_BOOT`; each editor
   entry imports `tool-chrome.css`.
4. **The choice** (DOM). `ThemeChoice` writes and clears the key, sets and removes `data-theme`, survives a refused
   store, and its words are the §3.3 words verbatim.
5. **Real browsers** (layout, Chromium on the GPU runner, WebKit and Firefox where they run). With the device emulated
   dark and light, and with each forced choice: the computed `--paper` and body colour are the expected ones; the
   first paint after a reload with a stored `dark` on a light device is dark (read in the first `requestAnimationFrame`);
   the level canvas pixels are identical in both looks.
6. **Screenshots** at 390×844, 844×390, 820×1180, 1180×820 and 1440×900, of the suite Home, Levels 2D, Levels 3D Plan,
   the Tuner, Feel, Audio, Writer, Sequence and Schematic, in dark. Looked at, not trusted (AGENTS.md): each one is
   checked for unreadable words, invisible edges and a light box left behind, and saved to
   `/mnt/project-files/dark-mode/`.
7. **Make and play a small game in dark** (served journey, the 2026-11-08 audit rule). With the device dark: create a
   game, open Levels 2D, paint tiles and place a character, change a number in the Tuner, write a line in Writer, Play,
   see what was made in the game with the same pixels as in light, Publish the zip. A step that could not run is named
   and left unchecked.

## 6. Open choices

None needing the Owner. The control's place (each Home, not the top bar) and its words follow the essential-only and
drunk grandma rules; if the Owner wants it reachable from inside an editor too, that is a one-line move of the same
widget into the top bar's overflow later.
