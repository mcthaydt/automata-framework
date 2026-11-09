// Wet ground's reflections on a real WebGL2 context: a lit box mirrors in the street under the rain a step or two down its
// ramp, a plain one does not, and dry ground mirrors nothing. WebGPU parity is the GPU runner's.
import '#src/entries/no-eval.ts'
import { afterEach, describe, expect, it } from 'vitest'
import { GlowEffect } from '#src/features/look/passes/glow-effect.ts'
import { RainEffect } from '#src/features/look/passes/rain-effect.ts'
import { ReflectEffect } from '#src/features/look/passes/reflect-effect.ts'
import { timeOfDay } from '#src/shared/time-of-day/time-of-day.ts'
import { colourAt, DUEL, drawn, passOf, pixels, SIZE, shot, startSky } from './sky-support.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null

let open: { dispose(): void } | undefined
afterEach(() => {
  open?.dispose()
  open = undefined
  document.body.replaceChildren()
})

const wet = timeOfDay('night', { scene: { rain: { density: 1, colour: '#88d6ff' } } })

async function street(time = wet) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const made = await startSky(host, { ground: true, time })
  open = made
  const renderer = made.renderer
  passOf(renderer, GlowEffect).enabled = false
  return renderer
}

describe.runIf(hasWebGL2)('the look’s wet reflections on WebGL2', () => {
  it('mirrors a lit box on the wet street in DUEL colours, and not a plain one', async () => {
    const renderer = await street()
    // The rain would add streaks of its own, so only the reflection is switched.
    passOf(renderer, RainEffect).enabled = false
    const reflect = passOf(renderer, ReflectEffect)
    reflect.enabled = false
    const dry = shot(renderer)
    reflect.enabled = true
    const mirrored = shot(renderer)
    const changed = drawn(dry, mirrored)
    expect(changed.length).toBeGreaterThan(20)
    expect(changed.every((i) => DUEL.has(colourAt(mirrored, i)))).toBe(true)
    // The lit box stands on the left and the plain one on the right: only the left of the frame mirrors anything.
    expect(changed.every((i) => i % SIZE.width < SIZE.width / 2)).toBe(true)
  })

  it('draws the reflection on the ground, below the box that makes it', async () => {
    const renderer = await street()
    passOf(renderer, RainEffect).enabled = false
    const reflect = passOf(renderer, ReflectEffect)
    reflect.enabled = false
    const dry = shot(renderer)
    reflect.enabled = true
    const rows = drawn(dry, shot(renderer)).map((i) => Math.floor(i / SIZE.width))
    // The box is above the ground's line at its feet; the reflection is under it on screen.
    expect(Math.min(...rows)).toBeGreaterThan(SIZE.height / 2 - 5)
  })

  it('ripples with the clock: the water moves a texel', async () => {
    const renderer = await street()
    passOf(renderer, RainEffect).enabled = false
    const a = shot(renderer)
    // The clock runs on the frames drawn: two long frames carry it past a few ripple steps.
    for (let i = 0; i < 2; i++) renderer.draw({ alpha: 1, frameMs: 700, paused: false })
    expect(drawn(a, pixels(renderer)).length).toBeGreaterThan(0)
  })

  it('has no reflections pass where it does not rain, and the street is as it was', async () => {
    const renderer = await street(timeOfDay('night'))
    expect(() => passOf(renderer, ReflectEffect)).toThrow()
    expect(renderer.view.passes.map((p) => p.constructor.name)).not.toContain('RainEffect')
  })
})
