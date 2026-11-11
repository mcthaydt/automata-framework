// An anchor becomes the CSS that puts a piece there, from the framework's layout variables and no breakpoints of its own.
import { describe, expect, it } from 'vitest'
import { placeStyle } from '#src/features/layout/place.ts'

describe('placeStyle', () => {
  it('pins a corner to two edges, a gutter in from each', () => {
    const style = placeStyle('top-left')
    expect(style).toContain('top: var(--af-gutter, 16px)')
    expect(style).toContain('left: var(--af-gutter, 16px)')
    expect(style).not.toContain('right')
  })

  it('centres along the edge it is not pinned to', () => {
    const style = placeStyle('bottom')
    expect(style).toContain('bottom: var(--af-gutter, 16px)')
    expect(style).toContain('left: 50%')
    expect(style).toContain('translateX(-50%)')
  })

  it('centres both ways for the centre', () => {
    const style = placeStyle('centre')
    expect(style).toContain('top: 50%')
    expect(style).toContain('left: 50%')
    expect(style).toContain('translate(-50%, -50%)')
  })

  it('caps the width at the declared width and never past the screen', () => {
    expect(placeStyle('top', 320)).toContain('max-width: min(320px, calc(100% - 2 * var(--af-gutter, 16px)))')
    expect(placeStyle('top')).toContain('max-width: calc(100% - 2 * var(--af-gutter, 16px))')
  })

  it('knows all nine places', () => {
    for (const anchor of [
      'top-left',
      'top',
      'top-right',
      'left',
      'centre',
      'right',
      'bottom-left',
      'bottom',
      'bottom-right',
    ] as const)
      expect(placeStyle(anchor)).toContain('position: absolute')
  })
})
