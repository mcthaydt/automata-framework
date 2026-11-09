// audio-sound: a chime that plays when something happens
//
// Shows: `sounds` maps a sim event to a sound. The first tap or key unlocks audio (browsers allow
//   sound only after a gesture); from then on each Chime event the sim emits plays chime.wav.
// Controls: tap or press any key to unlock sound
// Packages: @mcthaydt/automata, zod
// Difficulty: ★☆☆☆
// Tier: core
// Golden: 180
import {
  defineComponent,
  defineEvent,
  defineGame,
  definePlugin,
  defineSystem,
  rect,
} from '@mcthaydt/automata'
import { z } from 'zod'

// A synthesized chime (resources/sounds/PROVENANCE.md).
const chime = new URL('../resources/sounds/chime.wav', import.meta.url).href

const Bell = defineComponent('bell', { x: 'f32', y: 'f32', angle: 'f32' })
const Chime = defineEvent('chime', z.object({}))

// The bell rings once a second (every 60 ticks) and swings back to rest in between.
const ring = defineSystem('ring', (ctx) => {
  const ringing = ctx.tick % 60 === 0
  if (ringing) ctx.emit(Chime, {})
  for (const bell of ctx.query(Bell)) {
    const { angle } = bell.get(Bell)
    bell.set(Bell, { angle: ringing ? 0.6 : angle * 0.9 })
  }
})

const bells = definePlugin({ name: 'bells', defs: [Bell, Chime, ring] })

export default defineGame({
  id: 'audio-sound',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [bells],
    seed: 1,
    setup: (sim) => {
      sim.spawn([[Bell, { x: 160, y: 90, angle: 0 }]])
    },
  },
  views: { [Bell.id]: rect({ w: 32, h: 40, color: 0xffc825, anchor: { x: 0.5, y: 0 } }) },
  sounds: { [Chime.id]: chime },
})
