import { describe, expect, it } from 'vitest'
import { railFit } from '#src/features/suite/shell/rail-fit.ts'

// The phone's tab bar keeps every tab at its size and folds the ones that do not fit under a last tab, More.
const nine = Array.from({ length: 9 }, () => 60)

describe('railFit', () => {
  it('shows everything and no More when every tab fits', () => {
    expect(railFit([60, 60, 60], 390, undefined, 56)).toEqual({ shown: [0, 1, 2], more: [] })
    expect(railFit([60, 60, 60, 60, 60, 60], 360, undefined, 56)).toEqual({
      shown: [0, 1, 2, 3, 4, 5],
      more: [],
    })
  })

  it('folds the tabs that do not fit under More, which keeps its own room', () => {
    // 390 - 56 for More leaves room for five 60 px tabs.
    expect(railFit(nine, 390, undefined, 56)).toEqual({ shown: [0, 1, 2, 3, 4], more: [5, 6, 7, 8] })
  })

  it('always shows the open editor: it takes the room of the last tab that would have been shown', () => {
    expect(railFit(nine, 390, 8, 56)).toEqual({ shown: [0, 1, 2, 3, 8], more: [4, 5, 6, 7] })
  })

  it('does not drop the open editor when it is wider than the tab it replaces', () => {
    const widths = [60, 60, 60, 60, 60, 60, 60, 60, 120]
    const fit = railFit(widths, 390, 8, 56)
    expect(fit.shown).toContain(8)
    const used = fit.shown.reduce((sum, index) => sum + (widths[index] ?? 0), 0)
    expect(used).toBeLessThanOrEqual(390 - 56)
  })

  it('keeps an open editor in its place in the order', () => {
    expect(railFit(nine, 390, 2, 56).shown).toEqual([0, 1, 2, 3, 4])
  })

  it('never shows fewer than one tab', () => {
    expect(railFit(nine, 40, undefined, 56)).toEqual({ shown: [0], more: [1, 2, 3, 4, 5, 6, 7, 8] })
  })

  it('shows everything when there is no layout to measure (no room)', () => {
    expect(railFit(nine, 0, undefined, 0)).toEqual({ shown: [0, 1, 2, 3, 4, 5, 6, 7, 8], more: [] })
  })

  it('has nothing to fold for no tabs', () => {
    expect(railFit([], 390, undefined, 56)).toEqual({ shown: [], more: [] })
  })
})
