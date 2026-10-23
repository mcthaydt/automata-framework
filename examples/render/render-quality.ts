// render-quality: switch the graphics quality tier while squares drift across the field
//
// Shows: stage.setQuality() changes the tier at run time: it caps the canvas resolution (low 1, medium 1.5,
//   high 2) and leaves out post filters registered with a higher minTier. The world and HUD draw through the
//   fixed-resolution composite, so pixel art stays whole-pixel at every tier.
// Controls: 1 low, 2 medium, 3 high
// Packages: @mcthaydt/automata
// Difficulty: ★★☆☆
// Tier: core
import { defineComponent, defineGame, definePlugin, defineSystem, rect } from '@mcthaydt/automata'

const Drift = defineComponent('drift', { x: 'f32', y: 'f32', vx: 'f32' })

// Each square drifts right and wraps, so the tier's effect on the edges shows while it moves.
const drift = defineSystem('drift', (ctx) => {
  for (const square of ctx.query(Drift)) {
    const { x, y, vx } = square.get(Drift)
    square.set(Drift, { x: x + vx > 324 ? -4 : x + vx, y, vx })
  }
})

const squares = definePlugin({ name: 'squares', defs: [Drift, drift] })

const TIER_KEYS = { Digit1: 'low', Digit2: 'medium', Digit3: 'high' } as const

// What the HUD reads from the stage that setup receives.
let stage:
  | { readonly quality: string; readonly app: { readonly renderer: { readonly resolution: number } } }
  | undefined

export default defineGame({
  id: 'render-quality',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [squares],
    seed: 1,
    setup: (sim) => {
      for (let row = 0; row < 5; row += 1)
        sim.spawn([[Drift, { x: row * 60, y: 40 + row * 24, vx: 0.5 + row * 0.25 }]])
    },
  },
  views: { [Drift.id]: rect({ w: 12, h: 12, color: 0xf9c22b }) },
  renderer: {
    // The tier is presentation: it never reaches the sim, so the keys go straight to the stage.
    setup: (pixi) => {
      stage = pixi
      const pick = (event: KeyboardEvent): void => {
        // Pixi drops the renderer when the game is torn down; the listener then removes itself.
        if (!pixi.app.renderer) {
          window.removeEventListener('keydown', pick)
          return
        }
        const tier = TIER_KEYS[event.code as keyof typeof TIER_KEYS]
        if (tier !== undefined) pixi.setQuality(tier)
      }
      window.addEventListener('keydown', pick)
    },
  },
  draw: (ctx) => {
    if (stage === undefined) return
    ctx.rect(4, 4, 168, 14, 0x2e222f)
    ctx.text(`quality ${stage.quality}   resolution ${stage.app.renderer.resolution}`, 8, 7, {
      color: 0xffffff,
      size: 8,
    })
  },
})
