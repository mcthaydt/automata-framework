# Settings and Pause redo: AF beside FloorFifty

For the Desk first (Owner standing rule, 2026-10-18): every AF screen beside the matching FloorFifty one, at the same size. Layout and function are matched; the look is AF's own.

- **FloorFifty** (`floorfifty/`) at `a28dc44`: `PauseOverlay.svelte` (with `SettingsPanel.svelte` inside), `LandscapeGate.svelte` and `RotateHint.svelte`. Mounted on their own in FloorFifty's client (its styles, its settings store, its viewport tracker), over a stand-in gradient for the race. The band is the whole viewport, where a race would letterbox it.
- **AF** (`af/`) from this branch: `core/input-rebind`, built and served standalone; play, Escape, then Settings and its Controls tab. Touch sizes run as a mobile browser (coarse pointer).
- Sizes: 390x844, 844x390, 780x270, 820x1180 (touch) and 1280x720 (desktop).

| Screen | AF | FloorFifty |
|---|---|---|
| Paused | `af/af-paused-<size>.png` | `floorfifty/ff-paused-<size>.png` |
| Settings tab | `af/af-settings-<size>.png` | `floorfifty/ff-settings-<size>.png` |
| Controls tab | `af/af-controls-<size>.png` | `floorfifty/ff-controls-<size>.png` |
| Fullscreen gate (Android 844x390, 780x270; iPhone 844x390) | `../2026-10-18/m4-7-gate-*.png` | `floorfifty/ff-gate-*.png` |
| Rotate hint (412x915) | `../2026-10-18/m4-7-rotate-hint-phone-412x915.png` | `floorfifty/ff-rotate-hint-phone-412x915.png` |

## What matches

- Pause: a dialog over the dimmed game, titled Paused, Resume first and focused, one column on an upright phone and two across from a 340 px dialog; Settings; leaving asks first. Escape steps back one level. It keeps its compact width on a short band, as FloorFifty's does.
- Settings: the same dialog, two tabs (Settings, Controls), the section scrolling under them in one list that counts what is below; groups two across on a wide dialog; live apply, no Apply button; a 44 px Close.
- Controls: a section per device, the one in use first and marked, actions beside their inputs; Reset at the end (AF rebinds, as M4.4; FloorFifty only lists).
- Fullscreen gate: same structure, words and single primary action.

## Where AF differs, and why

- **Back under Settings on short bands.** FloorFifty draws "← Back" under its settings at every size; at 780x270 its own row lands on the list. AF draws it on tall bands and leaves it out on short and compact ones, where the dialog's Close, named Back, does the same (FloorFifty's Settings from its title has only the Close). Without this, AF's layout contract fails under TV scale at 667x375 and 780x270.
- **Tabs beside the title on a wide dialog.** FloorFifty's tabs sit under the title and a status line; AF moves them beside the title from a 480 px dialog so a 270 px band keeps a row of the list.
- **Settings has no Audio or Language group yet:** M5.4 (next) and the endonyms follow-up add them into these groups. Pause has no Mute until M5.4.
- **Rotate hint, for the Desk:** FloorFifty's is a dismissible toast for a game that plays both ways ("Turn your phone for a bigger view", OK). AF's, per the approved M4 spec §4.9, is a blocking cover over a paused game locked to one orientation. Matching FloorFifty's function would change the spec; not changed here.
- **Touch rows** say "Tap" per action; FloorFifty shows a picture guide of its own swipe steering, which is game content.
