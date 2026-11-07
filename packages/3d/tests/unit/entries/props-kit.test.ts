// The ./props-kit entry: what an extension that makes props needs (mesh primitives, the maths under them, the
// generator contract and its registry, and the room's plan), every name the core one and not a second copy.
import { describe, expect, it } from 'vitest'
import * as kit from '#src/entries/props-kit.ts'
import { propGenerator } from '#src/features/world/props/prop-generator-registry.ts'

describe('./props-kit', () => {
  it('hands over the primitives a prop is built from', () => {
    const whole = kit.merge(kit.box([0, 0, 0], [1, 1, 1]), kit.cylinder([2, 0, 0], 0.2, 1))
    expect(whole.positions.length).toBeGreaterThan(0)
    for (const fn of [kit.rbox, kit.rod, kit.cone, kit.blob, kit.quad, kit.tube, kit.limb, kit.placed])
      expect(fn).toBeTypeOf('function')
  })
  it('registers a generator under a new kind, in the one registry core reads', () => {
    kit.registerPropGenerator('props-kit-probe', () => ({ pieces: [] }))
    expect(propGenerator('props-kit-probe')).toBeTypeOf('function')
    expect(() => kit.registerPropGenerator('box', () => ({ pieces: [] }))).toThrow(kit.RegistryClash)
  })
  it('gives a seeded stream that repeats', () => {
    const a = kit.stream(7)
    const b = kit.stream(7)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('builds a level into pieces without the renderer, so a tool can check what a kit made', () => {
    const level = { format: 'af-sector/2', name: 't', sectors: [] } as const
    expect(kit.buildWorld(level, { swatches: {} }).pieces).toEqual([])
  })
  it('hands over the room plan the dresser reads', () => {
    for (const fn of [
      kit.ringsOf,
      kit.cornersOf,
      kit.inside,
      kit.heightAt,
      kit.segments,
      kit.signedArea,
      kit.inward,
    ])
      expect(fn).toBeTypeOf('function')
    expect(kit.resolveProp({ use: 'nope' }, { swatches: {} })).toEqual({ code: 'unknown-prop', name: 'nope' })
  })
})
