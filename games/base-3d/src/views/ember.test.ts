// The ember's look (art direction spec §2): a glowing core that pulses and turns, its own light (so a taken ember's
// light goes with it) and a halo; the goal is larger and gold, with a column of light and sparks rising from it.
import { Q16 } from '@mcthaydt/automata-render-pixi3d/sim'
import { type Container3D, type Mesh3D, ParticleContainer3D, type PhongMaterial, PointLight } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { EMBER_LOOK, emberView, GOAL_LOOK, pulse, turn } from './ember.ts'
import { colour } from './palette.ts'

const viewOf = (goal: boolean, clock = () => 0) => {
  const view = emberView(clock)(
    { sid: 1, components: { ember: { x: 3 * Q16, z: 14 * Q16, goal } } },
    'ember',
    undefined as never,
    undefined,
  )
  if (view === undefined) throw new Error('no view')
  return view
}
const descendants = (node: Container3D): Container3D[] =>
  (node.children as Container3D[]).flatMap((child) => [child, ...descendants(child)])

describe('the ember look', () => {
  it('pulses within 1 ± 0.14 and turns steadily', () => {
    for (let tenth = 0; tenth < 100; tenth++) {
      const scale = pulse(tenth / 10, 1.3)
      expect(scale).toBeGreaterThanOrEqual(0.86)
      expect(scale).toBeLessThanOrEqual(1.14)
    }
    expect(turn(2)).toBe(3)
  })

  it('makes the goal larger, gold, brighter and the only one with a column of light', () => {
    expect(GOAL_LOOK.size).toBeGreaterThan(EMBER_LOOK.size)
    expect(GOAL_LOOK.core).toBe('spark')
    expect(EMBER_LOOK.core).toBe('ember')
    expect(GOAL_LOOK.light.range).toBeGreaterThan(EMBER_LOOK.light.range)
    expect(GOAL_LOOK.column).toBeGreaterThan(3)
    expect(EMBER_LOOK.column).toBe(0)
  })
})

describe('emberView', () => {
  it('stands at the ember, with a glowing core and its own light in the ember colour', () => {
    const view = viewOf(false)
    expect(view.container.position.x).toBe(3)
    expect(view.container.position.z).toBe(14)
    const all = descendants(view.container)
    const lights = all.filter((n): n is PointLight => n instanceof PointLight)
    expect(lights).toHaveLength(1)
    const core = all.find((n) => n.label === 'ember:core') as Mesh3D
    expect((core.material as PhongMaterial).emissive).toBeDefined()
    expect(all.some((n) => n instanceof ParticleContainer3D)).toBe(true)
    expect(colour(EMBER_LOOK.core)).toBe(0xffa214)
  })

  it('gives the goal sparks that rise over time', () => {
    let now = 0
    const view = viewOf(true, () => now)
    const sparks = descendants(view.container).find((n) => n.label === 'ember:sparks') as ParticleContainer3D
    expect(sparks.capacity).toBeGreaterThanOrEqual(12)
    const before = Array.from(sparks.data.f32.slice(0, 32))
    now = 0.4
    view.update?.({}, undefined, 1)
    expect(Array.from(sparks.data.f32.slice(0, 32))).not.toEqual(before)
  })

  it('draws nothing for a row without an ember', () => {
    expect(
      emberView(() => 0)({ sid: 2, components: {} }, 'ember', undefined as never, undefined),
    ).toBeUndefined()
  })
})
