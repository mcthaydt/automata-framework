# How it works

A game made with Automata has two halves: the rules, which decide what happens, and everything around them, which
shows it, listens to the player and talks to wherever the game runs. This page is the tour of both, and of the four
packages they come in.

## The four packages

| Package | What it is for |
|---|---|
| `@mcthaydt/automata` | The one a game imports: `defineGame`, `startGame`, the screens, input, drawing, saves and the hosts |
| `@mcthaydt/automata-sim` | The rules: components, commands, systems and plugins, run one tick at a time |
| `@mcthaydt/automata-content` | Levels, settings and text, checked and turned into what the game loads |
| `@mcthaydt/automata-tools` | The `automata` command: make a game, open the editor, check and ship it |

[Make a game](/start) shows them working together. The [API reference](/api) lists every name each one exports.

## The rules run in ticks

The rules live in the sim. It is plain TypeScript and it moves in fixed steps called ticks, 60 a second by default.

- A **component** is a piece of data a thing holds, such as where it stands: `defineComponent('square', { x: 'f32', y: 'f32' })`.
- A **command** is what the player asked for this tick, such as "move left". Input turns key presses and taps into commands.
- A **system** runs every tick. It reads the commands and the components and writes new values.
- A **plugin** groups a feature's components, commands and systems so the game can add them in one line.

Only systems change the game while it runs. The screen, the input and the saves look at the sim; they never change it
behind its back.

## The same game every time

Given the same start, the same content and the same commands, the sim ends in exactly the same place, on every
browser and on Node. That is what lets a test replay a run, a save restore it, and a bug report be played back.

To keep that promise, the sim never reads the clock, the network, the page or `Math.random`. Random numbers come
from the sim's own seeded streams, and maths beyond the basics comes from `@mcthaydt/automata-sim/math`, so every
engine rounds the same way. `pnpm check` looks through the rule files for anything that would break this.

`sim.hash()` sums up the whole state in one short string. `sim.snapshot()` saves it and `sim.restore()` brings it
back. The tests compare hashes across Chromium, WebKit, Firefox and Node, and a hash that differs is a bug to find,
never a number to update.

## Drawing

A **view** says how a component looks: `rect({ w: 8, h: 8, color: 0xffc825 })` draws a yellow box wherever a square
stands. The game draws with PixiJS, on WebGL2 by default. The screen often refreshes faster than the sim ticks, so
between two ticks each view is drawn part of the way from where it was to where it is now. Movement stays smooth and
the rules stay in whole ticks.

## Around the rules

`startGame(game)` boots everything the rules do not own: the title, play and pause screens, the settings, keyboard,
touch and gamepad input, sound, saves and the frame loop. Each piece cleans up after itself when a screen closes or
the game restarts. Their timers run on a clock the tests can move by hand, so a test of a loading screen does not wait.

The screens are built for phones first. One owner measures the space the game has, including notches, the browser's
bars and the keyboard, and every screen lays itself out from it. Buttons stay at least 44 pixels tall.

## Where the game runs

The same game builds for four places, chosen when it is built: the open web, itch.io, Ruken and a desktop app made
with Tauri. Each has a small adapter that speaks to its host; nothing else in the game knows which one it is on.

The host decides what the game may do. When a host refuses saves, the game says progress won't be kept and goes on;
it never sneaks the save somewhere else. Each place has its own guide: [the web](./publish-to-web.md),
[itch.io](./publish-to-itch.md), [a desktop app](./publish-to-desktop.md) and [Ruken](./publish-to-ruken.md).

## Safe on any web host

Web hosts can forbid code that writes code, so no part of a game uses `eval` or `new Function`. A game's first import
is `@mcthaydt/automata/no-eval`, which sets PixiJS up to work without either. Before a build goes out, the `prepare`
step checks it for `eval`, secrets and anything else a public host refuses.
