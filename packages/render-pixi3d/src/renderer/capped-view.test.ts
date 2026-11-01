import { describe, expect, it } from 'vitest'
import { cappedViewSize } from './capped-view.js'

describe('cappedViewSize: the size the 3D view draws at under a height cap (G3-x)', () => {
  it('keeps a screen no taller than the cap at its own size', () => {
    expect(cappedViewSize({ width: 640, height: 360 }, 360)).toEqual({ width: 640, height: 360 })
    expect(cappedViewSize({ width: 320, height: 180 }, 360)).toEqual({ width: 320, height: 180 })
  })

  it('scales a taller screen down to the cap, keeping its aspect', () => {
    // A Pixel 7 held landscape: 915 x 412 CSS px.
    expect(cappedViewSize({ width: 915, height: 412 }, 360)).toEqual({ width: 800, height: 360 })
    // Desktop 1280 x 720 halves.
    expect(cappedViewSize({ width: 1280, height: 720 }, 360)).toEqual({ width: 640, height: 360 })
    // Portrait: the height is still the cap.
    expect(cappedViewSize({ width: 412, height: 915 }, 360)).toEqual({ width: 162, height: 360 })
  })

  it('rounds to whole pixels and never goes below one', () => {
    expect(cappedViewSize({ width: 1, height: 10000 }, 360)).toEqual({ width: 1, height: 360 })
    expect(cappedViewSize({ width: 0, height: 0 }, 360)).toEqual({ width: 1, height: 1 })
    expect(cappedViewSize({ width: 100.6, height: 50.4 }, 360)).toEqual({ width: 101, height: 50 })
  })
})
