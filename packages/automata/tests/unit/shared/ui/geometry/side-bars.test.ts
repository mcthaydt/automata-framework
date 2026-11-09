import { describe, expect, it } from 'vitest'
import {
  clearSideBars,
  publishedSideBarRoom,
  publishSideBars,
  TOUCH_BAR_GAP,
} from '#src/shared/ui/geometry/side-bars.ts'

// The letterbox's side bars, published on the root for the touch buttons that stand in them. A button stands in a bar
// only where the bar, less the safe area beside it, holds the button and a gap each side.

const root = (): HTMLElement => document.createElement('div')

describe('side bars', () => {
  it('publishes what the letterbox made, and reads back the room both bars share', () => {
    const el = root()
    publishSideBars(el, { left: 84, right: 85 })
    expect(el.style.getPropertyValue('--af-bar-left')).toBe('84px')
    expect(publishedSideBarRoom(el)).toBe(84)
  })

  it('takes the safe area and the host strip out of the room', () => {
    const el = root()
    el.style.setProperty('--af-inset-left', '44px')
    publishSideBars(el, { left: 84, right: 84 })
    expect(publishedSideBarRoom(el)).toBe(40)
  })

  it('is no room when nothing was published, or the bars were cleared', () => {
    const el = root()
    expect(publishedSideBarRoom(el)).toBe(0)
    publishSideBars(el, { left: 90, right: 90 })
    clearSideBars(el)
    expect(publishedSideBarRoom(el)).toBe(0)
  })

  it('names the gap kept each side of a button', () => {
    expect(TOUCH_BAR_GAP).toBe(8)
  })
})
