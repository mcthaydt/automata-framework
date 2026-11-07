# @automata/ui-screens

Six ready-made screens for a game: **Title**, **Pause**, **Settings**, **Results**, **Loading** and **Error**.

## Add it and use a screen

```sh
pnpm add @automata/ui-screens
```

```ts
import { PauseScreen } from '@automata/ui-screens/pause'
import type { ScreensCopy } from '@automata/framework'
declare const words: ScreensCopy // your game's words, in the player's language
mount(PauseScreen, { target, props: { copy: words.paused, muted, onResume, onQuit, onSettings, onMute } })
```

Each screen has its own path: `@automata/ui-screens/title`, `/pause`, `/settings`, `/results`, `/loading` and `/error`. The
main path, `@automata/ui-screens`, has all six.

## Change a screen

Copy the screen's folder from `node_modules/@automata/ui-screens/src/features/<screen>/` into your game's `src/screens/` and
import your copy instead. Every screen is one folder that reaches only `@automata/framework` and `svelte`, so a copy works as it
is.

## What is core's, and what is this package's

Core (`@automata/framework`) already ships default Title, Paused and Settings screens, and the parts every screen is built from. A game
that is happy with the defaults needs nothing from this package. It is for a game that wants these screens:

| Core keeps | This package gives you |
|---|---|
| The geometry (safe area, host strip, keyboard), 44 px and 48 px targets, the focus model, `ScreenFrame`, `ActionBar`, `Modal`, `ScrollList`, `ErrorPanel`, `LoaderOverlay`, `SettingsScreen` | The layout of each screen, the order and set of its actions, its copy slots, where it sits in your flow |
| The words' types (`ScreensCopy`) and the default English | Screens that take those words as props |
| Save slots, the leaderboard and the changed-elsewhere step on Title and Pause | Nothing: use core's default screens for those, or copy them from core |

Keep using the core parts. A screen that draws its own buttons or frame loses the layout guarantees below.

## Wiring

Each screen takes its words and callbacks as props; your flow mounts it. The words are the shape of core's `ScreensCopy`, so the
game's own `copy.screens` (or your translation of it) feeds them.

`ResultsScreen` takes the rows in the order to show them; it never ranks, sorts or picks a winner, so whatever decides the order
(the sim, a server's standings) stays the one place that does. Give each secondary action a `shortLabel`: on a narrow screen in a
language with long words, three or more actions need the short form to stay on one row.

## What is tested

Each screen has behaviour tests (jsdom) and a layout contract in real Chromium, WebKit and Firefox at every reference size and
variant, in English and the `xx-long` pseudo-locale: no document scroll, whole 44 px targets (48 px primaries), nothing off screen or
under the host's strip, every essential action visible and hit-testable. The layout tests stay in this package. After you edit a
screen, run the same contract in your game with `@automata/framework/testing`.

The screens also pass core's rule for screens (no `{@html}`, no platform chrome: a password field, the host's name, sign-in or
payment words).
