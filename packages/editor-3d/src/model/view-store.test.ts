import { describe, expect, it, vi } from 'vitest'
import { createViewStore, initialView, thingLayer } from './view-store'

describe('the view store', () => {
  it('starts in Plan on the sectors layer, nothing hidden or locked, a half metre grid that snaps', () => {
    expect(createViewStore().state).toEqual({
      mode: 'plan',
      layer: 'sectors',
      hidden: [],
      locked: [],
      camera: { x: 0, z: 0, zoom: 1 },
      grid: { step: 0.5, snap: true },
    })
    expect(createViewStore().state).toEqual(initialView)
  })

  it('starts from what it is given, over the initial view', () => {
    const store = createViewStore({ mode: 'split', grid: { step: 0.25, snap: false } })
    expect(store.state.mode).toBe('split')
    expect(store.state.grid).toEqual({ step: 0.25, snap: false })
    expect(store.state.layer).toBe('sectors')
  })

  it('changes the members it is told to and tells the subscribers once', () => {
    const store = createViewStore()
    const heard = vi.fn()
    store.subscribe(heard)
    store.set({ mode: 'walk', layer: 'walls' })
    expect(store.state).toMatchObject({ mode: 'walk', layer: 'walls', hidden: [] })
    expect(heard).toHaveBeenCalledTimes(1)
    expect(heard).toHaveBeenCalledWith(store.state)
  })

  it('tells nobody about a set that changes nothing', () => {
    const store = createViewStore()
    const heard = vi.fn()
    store.subscribe(heard)
    const before = store.state
    store.set({ mode: 'plan', camera: { x: 0, z: 0, zoom: 1 }, hidden: [] })
    expect(store.state).toBe(before)
    expect(heard).not.toHaveBeenCalled()
  })

  it('hides and locks layers on two lists of their own, and toggles each back', () => {
    const store = createViewStore()
    store.toggle('hidden', 'walls')
    expect(store.state.hidden).toEqual(['walls'])
    expect(store.state.locked).toEqual([])
    store.toggle('locked', 'things:crate')
    store.toggle('hidden', 'sectors')
    expect(store.state.hidden).toEqual(['walls', 'sectors'])
    expect(store.state.locked).toEqual(['things:crate'])
    store.toggle('hidden', 'walls')
    expect(store.state.hidden).toEqual(['sectors'])
  })

  it('sees a list that got shorter or longer as a change', () => {
    const store = createViewStore({ hidden: ['walls', 'sectors'] })
    const heard = vi.fn()
    store.subscribe(heard)
    store.set({ hidden: ['walls'] })
    expect(store.state.hidden).toEqual(['walls'])
    store.set({ hidden: ['walls', 'sectors'] })
    expect(store.state.hidden).toEqual(['walls', 'sectors'])
    expect(heard).toHaveBeenCalledTimes(2)
  })

  it('stops telling a subscriber that unsubscribed', () => {
    const store = createViewStore()
    const heard = vi.fn()
    const stop = store.subscribe(heard)
    stop()
    store.set({ mode: 'world' })
    expect(heard).not.toHaveBeenCalled()
  })

  it('keeps a state that a subscriber was handed unchanged by later sets', () => {
    const store = createViewStore()
    const seen = store.state
    store.set({ camera: { x: 2, z: 3, zoom: 2 } })
    expect(seen.camera).toEqual({ x: 0, z: 0, zoom: 1 })
  })
})

describe('thingLayer', () => {
  it('names the sub-layer of a definition under the Things layer', () => {
    expect(thingLayer('crate')).toBe('things:crate')
  })
})
