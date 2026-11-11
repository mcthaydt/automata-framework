# @automata/ui-screens

Six ready-made screens for a game: **Title**, **Results**, **Loading**, **Error**, **Splash** and **Credits**. Core already ships the Paused and Settings
screens, so this package does not repeat them.

## Add it and use a screen

```sh
pnpm add @automata/ui-screens
```

```ts
import { TitleScreen } from '@automata/ui-screens/title'
import type { ScreensCopy } from '@automata/framework'
declare const words: ScreensCopy // your game's words, in the player's language
mount(TitleScreen, {
  target,
  props: { title: 'Moss Garden', copy: words.title, onPlay, extra: [{ id: 'credits', label: 'Credits' }], onAction },
})
```

Each screen has its own path: `@automata/ui-screens/title`, `/results`, `/loading`, `/error`, `/splash` and `/credits`. The
main path, `@automata/ui-screens`, has all six.

## The splash

The splash is not a screen your flow mounts: it is a step of the game's *opening*, which runs after the host is ready and
before the first screen, so it can never hold the host's ready signal back. It shows the studio's logo for 1.5 seconds,
or until the player presses a key, clicks or taps, and plays no sound.

```ts
import { defineGame } from '@automata/framework'
import { splashStep } from '@automata/ui-screens/splash'
import logo from './studio-logo.svg'

defineGame({
  // …
  opening: [splashStep({ logo: { src: logo, alt: 'Moss Studio' } })], // holdMs and copy are optional
})
```

The line under the logo ("Press any key or tap to skip") is translated into the six languages the framework ships; pass `copy`
to say something else. The opening order on a first run is: language, the photosensitivity warning, the splash, then the title.

## The credits

`CreditsPanel` is core's `Modal` around sections of names, drawn from a content file, with the links routed through the
host (`Hosting.openLink`): Ruken asks the player, a web page opens a new tab, the desktop opens the player's own browser. A
name with a link is a button only where the host grants `links` (add `'links'` to `hosting.wants` for Ruken); elsewhere it is
plain text. A link the host refuses is said politely under the list and the panel stays open. Credits are reached from the
title, as an action beside Play; core's Settings does not depend on this package.

```toml
# content/credits/credits.toml, listed in automata.content.ts as `creditsContent`
[[sections]]
title = "Game"
names = [{ name = "Ada Lovelace", role = "Design", url = "https://example.test/ada" }, { name = "Bo" }]
```

```ts
import { CreditsPanel, screensWords } from '@automata/ui-screens/credits'
mount(CreditsPanel, { target, props: { credits, copy: screensWords(locale).credits, onClose, hosting } })
```

A section's `title` and a name's `role` are words `automata words` translates (pass `text` to the panel to read the
translation); a `name` and a `url` are not. A link must be `https:`: the file is refused at compile time otherwise.

## Change a screen

Copy the screen's folder from `node_modules/@automata/ui-screens/src/features/<screen>/` into your game's `src/screens/` and
import your copy instead. Every screen is one folder that reaches only `@automata/framework` and `svelte`, so a copy works as it
is.

## What is core's, and what is this package's

Core (`@automata/framework`) already ships default Title, Paused and Settings screens, and the parts every screen is built from. A game
that is happy with the defaults needs nothing from this package. Title here is core's with a different set of buttons: Play, then any
actions the game names (Credits, Help), with no save slots. Results, Loading and Error are this package's only: core has no such screens.
It is for a game that wants these screens:

| Core keeps | This package gives you |
|---|---|
| The geometry (safe area, host strip, keyboard), 44 px and 48 px targets, the focus model, `ScreenFrame`, `ActionBar`, `Modal`, `ScrollList`, `ErrorPanel`, `LoaderOverlay`, `SettingsScreen` | The layout of each screen, the order and set of its actions, its copy slots, where it sits in your flow |
| The words' types (`ScreensCopy`) and the default English | Screens that take those words as props |
| Save slots on Title; the leaderboard, saves and reconnect step on Paused; every setting | Nothing: use core's default Title, Paused and Settings screens for those |

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
