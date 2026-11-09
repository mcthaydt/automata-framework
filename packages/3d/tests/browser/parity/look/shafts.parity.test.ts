// Light shafts on a real WebGL2 context: a spot lamp's cone shows as stepped, dithered light in the air above the street,
// only inside its reach, and only while the lamp is on. WebGPU parity is the GPU runner's.
import '#src/entries/no-eval.ts'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '#src/features/look/look.ts'
import { GlowEffect } from '#src/features/look/passes/glow-effect.ts'
import { type ShaftLamp, ShaftsEffect } from '#src/features/look/passes/shafts-effect.ts'
import { colourAt, DUEL, drawn, passOf, SIZE, shot, startSky } from './sky-support.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null

let open: { dispose(): void } | undefined
afterEach(() => {
  open?.dispose()
  open = undefined
  document.body.replaceChildren()
})

/** A lamp over the street's middle, shining straight down in a wide cone. */
const spot: ShaftLamp = {
  at: [0, 3, 0],
  aim: [0, -1, 0],
  cone: 80,
  range: 6,
  color: 0xffd59b,
  strength: 1,
}

async function street(look = DEFAULT_LOOK) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const made = await startSky(host, { ground: true, look })
  open = made
  passOf(made.renderer, GlowEffect).enabled = false
  return made.renderer
}

describe.runIf(hasWebGL2)('the look’s light shafts on WebGL2', () => {
  it('shows a spot lamp’s cone as stepped light in the air, in DUEL colours', async () => {
    const renderer = await street()
    const shafts = passOf(renderer, ShaftsEffect)
    shafts.enabled = false
    const bare = shot(renderer)
    shafts.enabled = true
    shafts.lamps([spot])
    const lit = shot(renderer)
    const changed = drawn(bare, lit)
    expect(changed.length).toBeGreaterThan(40)
    expect(changed.every((i) => DUEL.has(colourAt(lit, i)))).toBe(true)
    // It is a dither, not a fill: some pixels in the cone are left alone.
    const rows = changed.map((i) => Math.floor(i / SIZE.width))
    const box = (Math.max(...rows) - Math.min(...rows) + 1) * SIZE.width
    expect(changed.length).toBeLessThan(box)
  })

  it('keeps to the lamp’s reach: a lamp too far from the view lights none of it', async () => {
    const renderer = await street()
    const shafts = passOf(renderer, ShaftsEffect)
    shafts.enabled = false
    const bare = shot(renderer)
    shafts.enabled = true
    shafts.lamps([{ ...spot, at: [0, 3, -60] }])
    expect(drawn(bare, shot(renderer))).toEqual([])
  })

  it('shows nothing from a lamp that is off, or from no lamps', async () => {
    const renderer = await street()
    const shafts = passOf(renderer, ShaftsEffect)
    shafts.enabled = false
    const bare = shot(renderer)
    shafts.enabled = true
    shafts.lamps([{ ...spot, strength: 0 }])
    expect(drawn(bare, shot(renderer))).toEqual([])
    shafts.lamps([])
    expect(drawn(bare, shot(renderer))).toEqual([])
  })

  it('is not in the look when the shafts switch is off', async () => {
    const renderer = await street({ ...DEFAULT_LOOK, switches: { ...DEFAULT_LOOK.switches, shafts: false } })
    expect(() => passOf(renderer, ShaftsEffect)).toThrow()
  })
})
