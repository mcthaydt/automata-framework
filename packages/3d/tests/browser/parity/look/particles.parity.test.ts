// Particles on a real WebGL2 context: an ember emitter lets off one-pixel sparks that rise a step at a time, in DUEL
// colours, and a wall nearer the camera hides them. WebGPU parity is the GPU runner's.
import '#src/entries/no-eval.ts'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '#src/features/look/look.ts'
import { GlowEffect } from '#src/features/look/passes/glow-effect.ts'
import type { EmitterPlace } from '#src/shared/level/af-sector-2.schema.ts'
import { colourAt, DUEL, drawn, passOf, pixels, shot, startSky } from './sky-support.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null

let open: { dispose(): void } | undefined
afterEach(() => {
  open?.dispose()
  open = undefined
  document.body.replaceChildren()
})

/** Embers lifting off beside the ball, with a wall behind them. */
const embers: EmitterPlace = { kind: 'ember', at: [1.8, 0.2, 1] }

async function scene(extra: Parameters<typeof startSky>[1] = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const made = await startSky(host, { big: true, ...extra })
  open = made
  passOf(made.renderer, GlowEffect).enabled = false
  return made.renderer
}

describe.runIf(hasWebGL2)('the look’s particles on WebGL2', () => {
  it('lets embers off as DUEL pixels, and none without the emitter', async () => {
    const bare = shot(await scene())
    open?.dispose()
    document.body.replaceChildren()
    const lit = shot(await scene({ emitters: [embers] }))
    const changed = drawn(bare, lit)
    expect(changed.length).toBeGreaterThan(0)
    // Five sparks of at most a pixel: a handful of pixels, not a fill.
    expect(changed.length).toBeLessThan(40)
    expect(
      changed.filter((i) => !DUEL.has(colourAt(lit, i))).map((i) => colourAt(lit, i).toString(16)),
    ).toEqual([])
  })

  it('moves them as the clock runs, a pixel at a time', async () => {
    const renderer = await scene({ emitters: [embers] })
    const first = shot(renderer)
    for (let i = 0; i < 3; i++) renderer.draw({ alpha: 1, frameMs: 300, paused: false })
    expect(drawn(first, pixels(renderer)).length).toBeGreaterThan(0)
  })

  it('stands still while the game is paused', async () => {
    const renderer = await scene({ emitters: [embers] })
    const first = shot(renderer)
    for (let i = 0; i < 3; i++) renderer.draw({ alpha: 1, frameMs: 300, paused: true })
    expect(drawn(first, pixels(renderer))).toEqual([])
  })

  it('hides behind a wall nearer the camera', async () => {
    const bare = shot(await scene({ near: true }))
    open?.dispose()
    document.body.replaceChildren()
    const behind = shot(await scene({ near: true, emitters: [embers] }))
    expect(drawn(bare, behind)).toEqual([])
  })

  it('shows nothing when the look’s particles switch is off', async () => {
    const off = { ...DEFAULT_LOOK, switches: { ...DEFAULT_LOOK.switches, particles: false } }
    const bare = shot(await scene({ look: off }))
    open?.dispose()
    document.body.replaceChildren()
    expect(drawn(bare, shot(await scene({ look: off, emitters: [embers] })))).toEqual([])
  })
})
