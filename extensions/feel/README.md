# Feel

The small things that make a hit land: a shake, a freeze for a moment, a flash, a squash, a word that pops. They are
written as data in `feel.toml`, and the player can turn them down or off. Feel only changes what is drawn. The game's
simulation never sees it, so its hash is the same with or without it.

It is free and MIT licensed. It is optional: a game that does not add it loses nothing.

## Turn it on

```ts
import { feelExtension } from '@automata/feel'

export default defineGame({ extensions: [feelExtension] })
```

Then write a `feel.toml` that says which game events get which effects, and read the result each frame from
`createFeel`.

## What you get

- **A `feel` content kind** for the table of effects.
- **`createFeel`**: hears the sim's events and answers each one when the picture reaches that moment, never before. It
  gives back plain data for each frame (how much to shake, where to squash) for your renderer to use.
- **Settings the player can change.** Reduced motion is respected from the very next frame.
