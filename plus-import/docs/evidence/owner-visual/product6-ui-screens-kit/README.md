# PRODUCT.6 review images: the UI and screen kit (`kits/ui-screens`)

Eighteen new images, all of new screens (nothing here replaces an existing golden or screenshot): six screens at three sizes, rendered
by the kit's own components with core's production CSS in headless Chromium, English, at rest (`rest` variant, scale 1).

| Size | Why |
|---|---|
| `iphone-14` (390 x 844) | phone portrait |
| `galaxy-chrome-landscape` (780 x 270) | the tightest reference size |
| `desktop-720p` (1280 x 720) | desktop |

Screens: `title`, `pause`, `settings`, `results`, `loading`, `error`. File names are `<screen>-<size>.png`.

Regenerate: `VITE_REVIEW_IMAGES=<absolute folder> pnpm --filter @mcthaydt/automata-kit-ui-screens test:layout` (the test that writes them
is skipped unless that variable is set, so a normal run changes nothing).

## What to look at

- **Results** shows rows in the order given, the highlighted row outlined, a "+N more" mark where the list scrolls, and the actions
  pinned at the foot (`results-galaxy-chrome-landscape.png` shows the scroll case).
- **Pause** and **Settings** are core's dialog (Modal) with core's words and sections; the kit only composes them.
- **Loading** and **Error** carry no art: the frame and core's overlay and panel only. A game puts its own art behind them.

## Two defects found by looking, fixed before these images

1. The error screen's title sat under core's opaque error panel and was never visible. The screen now carries no title of its own.
2. The loading screen's title was dimmed by core's overlay scrim. The frame now sits above the scrim, so the title reads in full.

## Not covered by these images

The `xx-long` pseudo-locale, every variant (keyboard, host strip, TV scale) and WebKit and Firefox are covered by the layout contract
(`pnpm test:layout`: 1650 tests across the three engines, all passing), not by pictures. Real-device testing stays the Owner's.
