// audio-ui-sounds: Buttons that sound, a Back that sounds different, one that stays silent
//
// Shows: `uiSounds` maps the interface's sound names to files and every control sounds `press` with no wiring. A control
//   marked `data-sfx="back"` (Cancel, Close) sounds `back`, one marked `data-sfx="none"` (Mute) makes none, and focus
//   moving ticks softly. The sounds play on the interface bus, under its volume and mute.
// Controls: tap or click any button; Tab moves focus
// Packages: @automata/framework
// Difficulty: ★☆☆☆
// Tier: core
import { defineGame } from '@automata/framework'

// Synthesized sounds (resources/sounds/PROVENANCE.md).
const sounds = {
  press: new URL('../resources/sounds/ui-press.wav', import.meta.url).href,
  back: new URL('../resources/sounds/ui-back.wav', import.meta.url).href,
  focus: new URL('../resources/sounds/ui-focus.wav', import.meta.url).href,
}

export default defineGame({
  id: 'audio-ui-sounds',
  size: { width: 320, height: 180 },
  sim: { plugins: [] },
  // Names to files, and nothing else: the framework plays them on the interface bus. (A game whose sounds are cues in its
  // own mixer gives one function that plays a name instead.)
  uiSounds: sounds,
  draw: (ctx) => {
    ctx.rect(0, 0, ctx.width, ctx.height, 0x3b303c)
  },
})
