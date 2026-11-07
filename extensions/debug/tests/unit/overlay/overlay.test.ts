import { describe, expect, it, vi } from 'vitest'
import { createOverlay } from '#src/features/overlay/overlay.ts'
import { Blank } from '#src/testing/blank.ts'

const panels = [
  { id: 'sim', title: 'Sim', component: Blank },
  { id: 'bus', title: 'Bus', component: Blank },
]

describe('the overlay controller', () => {
  it('starts closed on the first panel', () => {
    const o = createOverlay({ panels })
    expect(o.state()).toEqual({ open: false, tab: 'sim', paused: false })
  })
  it('opens and closes on the backquote key and closes on Escape', () => {
    const o = createOverlay({ panels })
    expect(o.key('`')).toBe(true)
    expect(o.state().open).toBe(true)
    expect(o.key('Escape')).toBe(true)
    expect(o.state().open).toBe(false)
  })
  it('lets every other key through, and Escape through when closed', () => {
    const o = createOverlay({ panels })
    expect(o.key('a')).toBe(false)
    expect(o.key('Escape')).toBe(false)
  })
  it('toggles on a three-finger tap and not on one or two', () => {
    const o = createOverlay({ panels })
    expect(o.touch(2)).toBe(false)
    expect(o.touch(3)).toBe(true)
    expect(o.state().open).toBe(true)
  })
  it('selects a tab by id and ignores an unknown id', () => {
    const o = createOverlay({ panels })
    o.select('bus')
    expect(o.state().tab).toBe('bus')
    o.select('nope')
    expect(o.state().tab).toBe('bus')
  })
  it('sends the pause toggle through the port and remembers it', () => {
    const setPaused = vi.fn()
    const o = createOverlay({ panels, setPaused })
    o.setPaused(true)
    expect(setPaused).toHaveBeenCalledWith(true)
    expect(o.state().paused).toBe(true)
  })
  it('tells listeners about each change and stops after unsubscribe', () => {
    const o = createOverlay({ panels })
    const seen: boolean[] = []
    const off = o.subscribe((s) => seen.push(s.open))
    o.toggle()
    off()
    o.toggle()
    expect(seen).toEqual([true])
  })
  it('has no tab when there are no panels', () => {
    expect(createOverlay({ panels: [] }).state().tab).toBeNull()
  })
})
