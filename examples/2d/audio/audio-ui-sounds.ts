// audio-ui-sounds: Buttons that sound, a Back that sounds different, one that stays silent
//
// Shows: `uiSounds` maps the interface's sound names to files and every control sounds `press` with no wiring. A control
//   marked `data-sfx="back"` (Cancel, Close) sounds `back`, one marked `data-sfx="none"` (Mute) makes none, and focus
//   moving ticks softly. The sounds play on the interface bus, under its volume and mute. The page notes each name it
//   plays in `window.__uiSounds`.
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

type Name = keyof typeof sounds
const page = window as unknown as { __uiSounds?: string[] }
const heard: string[] = page.__uiSounds ?? []
page.__uiSounds = heard

export default defineGame({
  id: 'audio-ui-sounds',
  size: { width: 320, height: 180 },
  sim: { plugins: [] },
  // One function that plays a name: it notes the name, then plays the file the name maps to (a game whose sounds are
  // cues in its own mixer would start the cue here). A plain map of names to files needs no function at all.
  uiSounds: (name) => {
    heard.push(name)
    const file = sounds[name as Name]
    if (file !== undefined) void new Audio(file).play().catch(() => undefined)
  },
  draw: (ctx) => {
    ctx.rect(0, 0, ctx.width, ctx.height, 0x3b303c)
  },
})
