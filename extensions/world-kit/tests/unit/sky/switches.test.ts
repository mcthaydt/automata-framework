// The world kit's passes each have their own switch: with no options the kit gives stars and glow (and nothing else), and a pass
// the game did not ask for never joins. The order is the source's, `SKY_PASS_NAMES`'s.
import { describe, expect, it } from 'vitest'
import { SKY_PASS_NAMES, skyLookPasses } from '#src/features/sky/sky-passes.ts'

const names = (options?: Parameters<typeof skyLookPasses>[0]): string[] =>
  skyLookPasses(options).map((pass) => pass.name)

describe('skyLookPasses: every pass behind its switch', () => {
  it('with no options gives stars and glow, in that order, and nothing else', () => {
    expect(names()).toEqual([SKY_PASS_NAMES.stars, SKY_PASS_NAMES.glow])
  })

  it('with stars and glow off, and nothing else asked for, gives none', () => {
    expect(names({ stars: false, glow: false })).toEqual([])
  })

  it('stars off takes out exactly the stars, and glow off exactly the glow', () => {
    expect(names({ stars: false })).toEqual([SKY_PASS_NAMES.glow])
    expect(names({ glow: false })).toEqual([SKY_PASS_NAMES.stars])
  })

  it.each([
    ['reflect', { reflect: {} }, SKY_PASS_NAMES.reflect],
    ['shafts', { shafts: {} }, SKY_PASS_NAMES.shafts],
    ['particles', { particles: {} }, SKY_PASS_NAMES.particles],
    ['rain', { rain: {} }, SKY_PASS_NAMES.rain],
  ] as const)('%s adds exactly its own pass', (_, on, added) => {
    const base = names({ stars: false, glow: false })
    expect(names({ stars: false, glow: false, ...on })).toEqual([...base, added])
  })

  it('a pass given false stays out', () => {
    expect(
      names({ stars: false, glow: false, reflect: false, shafts: false, particles: false, rain: false }),
    ).toEqual([])
  })

  it('with every pass on they come in the order of SKY_PASS_NAMES', () => {
    expect(names({ reflect: {}, shafts: {}, particles: {}, rain: {} })).toEqual([
      SKY_PASS_NAMES.stars,
      SKY_PASS_NAMES.reflect,
      SKY_PASS_NAMES.glow,
      SKY_PASS_NAMES.shafts,
      SKY_PASS_NAMES.particles,
      SKY_PASS_NAMES.rain,
    ])
  })
})
