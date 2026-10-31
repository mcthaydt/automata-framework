# DX.2d default screens in English and xx-long

The default screens, captured in Chromium and WebKit from the layout test's fixtures (production CSS, device scale factor 1). Each is shown in English (`-en`) and in the `xx-long` pseudo-locale (`-xx-long`), where every word is about 40% longer, accented and bracketed. A word still in plain English in an `xx-long` image is one that bypassed the screens' copy. Files are named `<browser>-<size>-<screen>-<locale>.png`.

| Screen | What it shows |
| --- | --- |
| `title` | The title and Play (`copy.title.play`) |
| `title-saves` | The save slots (`copy.saves.slots`) in place of Play |
| `play` | The play screen: corner Pause (its label is `copy.play.pause`) and the touch row |
| `paused` | The paused menu: Paused, Resume, Mute, Settings, Quit to title (`copy.paused`) |
| `paused-board` | Paused with a twelve-row board (`copy.board`) |
| `paused-elsewhere` | The changed-elsewhere step (`copy.saves.changedElsewhere`) |

Sizes: 390x844 (phone portrait) and 780x270 (compact) for every screen, plus 375x667 at TV scale (1.333) for `play`. In that case the touch row used to go off both edges in `xx-long`. Now its long label wraps onto a second row (the ui `TouchControls` change).

## What to check

- No English word in the `xx-long` images, except the game's own data shown as English stand-ins in `-en` only. The layout contract fails on any such word (`screens.layout.test.ts`).
- Nothing is clipped, overlapping or off screen. The layout contract checks this at every reference size and variant, in Chromium, WebKit and Firefox (game parity: 1059 tests).
- The Settings screen isn't pictured: its fixture needs the whole runtime. Its words are covered by the DOM test that switches language on Settings and keeps focus.

## How they were made

A throwaway Vitest browser test (not committed) reused the layout test's fixtures and called `page.screenshot` for each screen, locale and size, in the `layout (chromium)` and `layout (webkit)` projects, on head 66fe89d.
