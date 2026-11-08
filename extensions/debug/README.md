# Debug

A panel you open while you play, to see what the game is doing: the simulation, the audio, the feel, the network. It is
for development. Press the backquote key (or tap with three fingers) to open it, and Escape to close it.

It is free and MIT licensed. It is optional: a game that does not add it loses nothing.

## Turn it on

Add it only in development builds, so a release leaves it out:

```ts
import { debugExtension } from '@automata/debug'

export default defineGame({ extensions: __AUTOMATA_DEBUG__ ? [debugExtension] : [] })
```

## What you get

- **An overlay** drawn in `hud.overlay`, with a tab for each panel. Opening it pauses nothing; its Pause button pauses
  the game.
- **Panels for the sim, audio, feel and net** (`shippedPanels`), and `createOverlay` to make your own.
- **`@automata/debug/vite`**: the build plugin that switches `__AUTOMATA_DEBUG__` on for dev and `--debug` builds.
