// The look's glow on a real WebGL2 context: whole steps round what is bright, and nothing else changes.
import '#src/entries/no-eval.ts'
import { afterEach, describe, expect, it } from 'vitest'
import { GlowEffect } from '#src/features/look/passes/glow-effect.ts'
import { RainEffect } from '#src/features/look/passes/rain-effect.ts'
import { colourAt, DUEL, drawn, passOf, SIZE, shot, startSky } from './sky-support.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null

let open: { dispose(): void } | undefined
afterEach(() => {
  open?.dispose()
  open = undefined
  document.body.replaceChildren()
})

describe.runIf(hasWebGL2)('the look’s glow on WebGL2', () => {
  it('rings what glows in whole steps, and nothing else changes', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const made = await startSky(host, { big: true, glowing: true })
    open = made
    const renderer = made.renderer
    const glow = passOf(renderer, GlowEffect)
    glow.enabled = false
    const without = shot(renderer)
    glow.enabled = true
    const withGlow = shot(renderer)
    const rings = drawn(without, withGlow)
    expect(rings.length).toBeGreaterThan(10)
    const luma = (px: Uint8Array, i: number): number =>
      (0.2126 * (px[i * 4] ?? 0) + 0.7152 * (px[i * 4 + 1] ?? 0) + 0.0722 * (px[i * 4 + 2] ?? 0)) / 255
    const bright = new Set<number>()
    for (let i = 0; i < without.length / 4; i++) if (luma(without, i) >= 0.85) bright.add(i)
    const near = (i: number): boolean => {
      const [x, y] = [i % SIZE.width, Math.floor(i / SIZE.width)]
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) if (bright.has((y + dy) * SIZE.width + x + dx)) return true
      return false
    }
    // Every pixel the glow changed is a DUEL colour, a step lighter than it was, within three pixels of something bright.
    expect(rings.filter((i) => !DUEL.has(colourAt(withGlow, i)))).toEqual([])
    expect(rings.filter((i) => luma(withGlow, i) < luma(without, i))).toEqual([])
    expect(rings.filter((i) => !near(i))).toEqual([])
    expect(() => passOf(renderer, RainEffect)).toThrow()
  })

  it('does not bloom what is only bright: a white ball that does not glow has no ring', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const made = await startSky(host, { big: true })
    open = made
    const glow = passOf(made.renderer, GlowEffect)
    glow.enabled = false
    const without = shot(made.renderer)
    glow.enabled = true
    expect(drawn(without, shot(made.renderer))).toEqual([])
  })
})
