# Editors v2: what 2026 editors share, and what we take (2026-11-08)

The Owner asked for the editors' whole look to be redesigned, inspired by the same research as the approved site Home v2,
and not only as a dark mode. This note goes with the mockup in `editors-v2/` and the pictures in `shots-editors-v2/` and
`boards-editors-v2/`. It is a design for approval, not a plan.

**Sources:**

- Screenshots of these apps' own pages and product shots, taken in Chromium on 2026-11-08 (the cloud browser could reach
  them this time):
  - Linear (app, sidebar, sheets);
  - Cursor and Zed (status line, panels);
  - the Vercel dashboard and its Geist system (buttons, inputs, menus, colours);
  - Supabase, Railway, Raycast, Framer and Rive;
  - tldraw and Excalidraw on a desktop and a phone.
- GDevelop and Construct, as the game-editor look we are moving away from (grey boxes, many colours, tiny icons).
- The approved site v2 (`site-home-v2.html`, `PATTERNS-2026.md`) for the palette, the type and the one lime button.
- The approved first redesign (`editor-level.html`, `AUDIT.md` E1 to E11) for the three layouts and the phone rules.
- Today's editors, from the shared-editors build and dark mode (PRs #504 and #506).

## What is wrong with today's editors

- Six editors share one list icon in the rail.
- Every field sits in its own bordered box, inside a bordered card.
- Several lime buttons on one screen, so none of them reads as the one to press.
- On a phone, the header cuts Publish off and shows a white box, and the toolbar is cut off.
- Empty Levels and Review pages have no way forward.
- Home cards repeat the editor's name ("Feel / Feel") instead of saying what it changes.

## The patterns, and where v2 uses them

| Pattern | Seen in | v2 |
| --- | --- | --- |
| **The work is one inset panel** on a darker window | Linear, Vercel, Cursor | The sidebar sits on the window colour. Lists, work and inspector share one panel with 8 px corners and hairline dividers. |
| **A sidebar with an icon and the whole name** for each place, under sentence-case group labels | Linear, Vercel, Supabase | Home, then "Editors" (all eight, in the suite's order) and "Waiting for you" (Review). Each editor has its own icon. Schematic shows its problem count. |
| **A breadcrumb header that holds the state and the two actions** | Linear, Vercel, Framer | "Levels / Start ▾" opens the level menu. Then come Undo and Redo, the problem count, Saved, Play and Publish. |
| **One primary button per screen** | Geist; 9 of the 11 sites in `PATTERNS-2026.md` | Publish is the only lime button. Lime also marks what is happening now: the Sequence playhead, the "Playing" dot and the current tab on a phone. Switches use a white track, not lime. |
| **Rows, not boxes; labels on the left** | Linear, Zed, Geist inputs | List rows are 32 px with a mouse and 44 px on touch. Each property is a label on the left and its control on the right. Sections are split by hairlines, not cards. |
| **Floating tools on a canvas** | tldraw, Excalidraw, Figma | Tools float top centre and zoom floats bottom right. On a phone the tools sit in a dock at the bottom, and on a phone held sideways they stand at the right edge. In a narrow work area, the brush size moves to a labelled second row. |
| **A status line in mono** | Zed, Cursor | It shows the file, plain counts ("6 lines · 2 speakers") and the state ("No problems"). It is hidden on phones. |
| **The work sits on a quiet canvas of its own** | tldraw, Rive, Framer | Every picture of the game sits on a dark dotted stage, in both looks, so the game's colours never shift. |
| **An empty page offers one way forward** | Linear, Vercel | Review says "Nothing waiting for you", why it is empty, and "Back to Home". |
| **Cards say what each place is for** | Vercel, Supabase, Railway | Home: "What do you want to change?" Each card has a plain line ("Draw the places your game happens in") and what is in it ("Start · Shop"). |
| **Problems are shown where they are** | Cursor, Zed | There is a count in the header, a badge in the sidebar, a Problems section in the inspector, and a warning under the field it concerns. |
| **On a phone: a title menu, a tab bar, sheets** | Linear (sheets), tldraw and Excalidraw on a phone | The tab bar shows four editors plus More, with the current editor swapped in. Lists, settings and menus open as bottom sheets. |
| **The light look changes colours only** | Linear, Vercel | Light is the same layout with other tokens. The game stage stays dark. |

Every non-3D screen is mocked at every size: Home, Level, Tiles, Characters, Tuner, Feel, Audio, Writer, Sequence,
Schematic and Review.

- **Content.** It comes from the real 2D story sample: its layers, its eight things to paint with, the Shop
  conversation, the Opening cutscene and the Guard.
- **Layouts.** There are three, chosen by window size and not by device:
  - **wide**, 1180 px and up;
  - **medium**, 761 to 1179 px, at least 521 px high;
  - **compact**, 760 px or less, or 520 px high or less.
- **Schematic's board** turns tall when its area is narrow (a phone or an upright iPad), so the modes stay readable
  instead of shrinking.

## What we leave out on purpose

- **A ⌘K command menu.** Linear, Vercel and Raycast have one, but every action here already has a place, and the editors
  carry only essential features.
- **A game preview on Home.** Play is one tap away in the header.
- **Presence, avatars and comments.** There is one author per game.
- **An AI chat panel.** Work from a coding agent comes in through Review, where the person says yes or no.
- **Tours and tooltips that explain the layout.** If a screen needs a tour, the screen is wrong.

## What changes in code (for the plan, not done here)

- **The tokens.** They come from site v2, and the radii stay 4, 6 and 8 px:

  | Token | Values |
  | --- | --- |
  | Surfaces | `--bg #0b0c0e`, `--panel #111316`, `--raise #181b20`, `--hover #1b1e23`, `--selected #1c2333` |
  | Lines | `--line #22252b`, `--line-strong #33373e` |
  | Text | `--ink #f2f3f5`, `--muted #a6abb3`, `--faint #8f959e` (each 4.5:1 or more on panel, raise and selected) |
  | Colours | `--accent #8ea2ff`, `--lime #cbf25c` on `--lime-ink #11151c`, `--warn #f5b14c`, `--bad #ff7a6e`, `--ok #6fd08c` |
  | Stage | `--stage #08090b`, `--dot #1d2026` |

- **Sizes.**
  - With a mouse: rows and controls 32 px, fields 28 px, the header 48 px.
  - On touch: rows, controls and every button at least 44 px, fields 40 px, the header 56 px.
  - Type: Geist 13/18 for the interface, Geist Mono for numbers, paths and the status line.
- **`packages/editor/src/shared/kit/tokens/tokens.json` says `colorScheme: "light"`.**
  - The editors would open dark by default, with Light, Dark and Match device on Home. Dark mode's `tool-theme.json`
    (PR #504) already holds both sets of tokens.
  - The site's `tokens.css` imports the shared tokens. The site is dark first now too, so the two agree, but the plan
    must check every site page's contrast after the change.
- **Kit parts the build adds or changes:**
  - the inset shell;
  - the sidebar with an icon for each editor;
  - the breadcrumb header;
  - row and field parts in place of boxed cards;
  - the floating toolbar, with its wrap for narrow areas;
  - sheets;
  - the tab bar;
  - one empty-state part.

## The drunk grandma test

- Every screen has one lime button, and it is the same button everywhere (Publish).
- **Copy rewritten:**

  | Was | Now |
  | --- | --- |
  | Hit points: 3 of 9 | Hits to beat it: 3 |
  | No Checkpoint yet (while a checkpoint was drawn) | The Door doesn't lead anywhere yet. Choose the level it opens. |
  | – 1 + (in a narrow toolbar) | Brush size – 1 + |
  | An empty Review page | Nothing waiting for you, why, and Back to Home |
  | Publish's checklist | Put your game online, in three plain steps, then "Build my game" |

- Phones keep every action that a desktop has. Nothing is hidden to make a screen fit. Items move into the title menu,
  sheets or a second row instead.

## What was checked, and what was not

- Each screen was rendered in Playwright's Chromium at these sizes:
  - 1440 × 900 and 1024 × 768;
  - 1194 × 834 and 820 × 1180, with touch;
  - 390 × 844, 844 × 390 and 360 × 640, with touch.
- Each screen was also rendered with something chosen, the menu open, the list sheet open, the Publish dialog open, and in
  the light look.
- **Every render passed:** no sideways scroll, no header overflow, every control at least 44 px on touch, and no console
  errors. Some of these held only after fixes found by these checks: touch sizes, the Schematic board on narrow screens,
  the phone header and the light text colour.
- **48 pictures at 2× are in `shots-editors-v2/`.**
- **Not proven by pictures:**
  - focus, hit testing, the keyboard, keeping state through rotation, and real devices;
  - WebKit and Firefox.

  These belong to the build's DOM, layout and journey tests.
- **The build's audit must also make a small game in the rebuilt editors, play it, and confirm that what was made shows
  up in play.** That is the project rule for every audit.

## Still to settle

- **The Owner's approval of this look** before any plan is written.
- **The default look when the editors first open.** Recommended: Dark, to match the site and these pictures. People who
  prefer Light, or Match device, change it once on Home.
