# Audio synth

Sound effects, background beds and music made by the computer from a few numbers, so a game ships no sound files. A
table says "when this happens, play that", and the synth plays it through the game's own audio buses.

It is free and MIT licensed. It is optional: a game that does not add it loses nothing.

## Turn it on

```ts
import { audioSynthExtension } from '@automata/audio-synth'

export default defineGame({ extensions: [audioSynthExtension] })
```

Then write the audio table in your content and start the player with `createAudioSynth`.

## What you get

- **An `audio` content kind** for cues, beds and music slots.
- **`createAudioSynth`**: answers each sim event when the picture reaches it, once. It never writes to the sim.
- **Build-time tools** (`@automata/audio-synth/render` and `/measure`, for Node): render every cue to a WAV file and
  check its loudness and clicks before you ship.
- **`@automata/audio-synth/browser`**: the same cues rendered in a page.
