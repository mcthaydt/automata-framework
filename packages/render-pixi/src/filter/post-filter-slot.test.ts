import type { Filter } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { createPostFilterSlot } from '../index.js'

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
