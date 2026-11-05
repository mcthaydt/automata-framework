import type { Filter } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { createPostFilterSlot } from '#src/entries/from-render-pixi.ts'

// The post-filter slot (PRODUCT spec §2 F1, §5 "Post-processing"): several owners (an extension such as Plus
// `post-retro`, quality tiers, the game) each keep their own filters on the scene without overwriting another's.
// Filters are stand-ins: the slot only orders them; rendering them is the GPU parity suite's job.

const filter = (name: string) => ({ name }) as unknown as Filter
const names = (filters: Filter[] | null) =>
  filters === null ? null : filters.map((entry) => (entry as unknown as { name: string }).name)

describe('createPostFilterSlot', () => {
  it('composes every owner into the target by order, then id', () => {
    const target: { filters: Filter[] | null } = { filters: null }
    const slot = createPostFilterSlot(target)
    slot.set('retro', [filter('crt'), filter('dither')], 20)
    slot.set('quality', [filter('fxaa')], 10)
    slot.set('game', [filter('flash')], 20)
    expect(names(target.filters)).toEqual(['fxaa', 'flash', 'crt', 'dither'])
    expect(slot.ids).toEqual(['quality', 'game', 'retro'])
  })

  it('replaces an owner in place and clears the target when the last owner leaves', () => {
    const target: { filters: Filter[] | null } = { filters: null }
    const slot = createPostFilterSlot(target)
    slot.set('retro', [filter('crt')])
    slot.set('game', [filter('flash')], 5)
    const removeRetro = slot.set('retro', [filter('lcd')])
    expect(names(target.filters)).toEqual(['lcd', 'flash'])

    removeRetro()
    removeRetro()
    expect(names(target.filters)).toEqual(['flash'])
    slot.remove('game')
    expect(target.filters).toBeNull()
    expect(slot.ids).toEqual([])
  })

  it("does not let a stale remover take a newer owner's filters", () => {
    const target: { filters: Filter[] | null } = { filters: null }
    const slot = createPostFilterSlot(target)
    const removeFirst = slot.set('retro', [filter('crt')])
    slot.remove('retro')
    slot.set('retro', [filter('lcd')])
    removeFirst()
    expect(names(target.filters)).toEqual(['lcd'])
  })
})

// Quality tiers (M4 spec §4.11): an owner declares the lowest tier it runs at; a weak device drops optional passes,
// never the art direction (FloorFifty `quality.ts`: the palette lock stays at every tier).
describe('createPostFilterSlot at a quality tier', () => {
  it('leaves out an owner whose minTier is above the tier, and brings it back in its place', () => {
    const target: { filters: Filter[] | null } = { filters: null }
    const slot = createPostFilterSlot(target)
    slot.set('lock', [filter('palette-lock')], 30)
    slot.set('bloom', [filter('bloom')], 10, { minTier: 'medium' })
    slot.set('crt', [filter('crt')], 20, { minTier: 'high' })
    expect(slot.tier).toBe('high')
    expect(names(target.filters)).toEqual(['bloom', 'crt', 'palette-lock'])

    slot.setTier('medium')
    expect(names(target.filters)).toEqual(['bloom', 'palette-lock'])
    slot.setTier('low')
    expect(names(target.filters)).toEqual(['palette-lock'])
    expect(slot.ids).toEqual(['lock'])
    slot.setTier('high')
    expect(names(target.filters)).toEqual(['bloom', 'crt', 'palette-lock'])
  })

  it('keeps an owner set while its tier is off until the tier allows it', () => {
    const target: { filters: Filter[] | null } = { filters: null }
    const slot = createPostFilterSlot(target)
    slot.setTier('low')
    slot.set('bloom', [filter('bloom')], 0, { minTier: 'medium' })
    expect(target.filters).toBeNull()
    slot.setTier('medium')
    expect(names(target.filters)).toEqual(['bloom'])
  })
})
