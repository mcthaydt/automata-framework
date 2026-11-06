import { describe, expect, test } from 'vitest'
import { placePopover } from '#src/shared/kit/widgets/popup-model.ts'

const viewport = { width: 1000, height: 800 }
const anchor = (left: number, top: number, width = 120, height = 44) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
})

describe('placePopover', () => {
  test('opens below the anchor, left-aligned, at least as wide as it', () => {
    const placed = placePopover(anchor(100, 100), { width: 200, height: 300 }, viewport)
    expect(placed).toEqual({ left: 100, top: 148, minWidth: 120, maxHeight: 644, above: false })
  })

  test('flips above when it does not fit below and there is more room above', () => {
    const placed = placePopover(anchor(100, 600), { width: 200, height: 300 }, viewport)
    expect(placed.above).toBe(true)
    // Its bottom edge sits one gap above the anchor's top.
    expect(placed.top + 300).toBe(596)
    expect(placed.maxHeight).toBe(588)
  })

  test('stays below, and scrolls, when neither side has room for all of it', () => {
    const placed = placePopover(anchor(100, 300), { width: 200, height: 900 }, viewport)
    expect(placed.above).toBe(false)
    expect(placed.top).toBe(348)
    expect(placed.maxHeight).toBe(444)
  })

  test('a flipped popover that is shorter than the room above hugs the anchor', () => {
    const placed = placePopover(anchor(100, 700), { width: 200, height: 120 }, viewport)
    expect(placed).toMatchObject({ above: true, top: 576, maxHeight: 688 })
  })

  test('keeps clear of the right edge', () => {
    const placed = placePopover(anchor(900, 100), { width: 240, height: 100 }, viewport)
    expect(placed.left).toBe(752)
  })

  test('keeps clear of the left edge when it is wider than the room', () => {
    const placed = placePopover(anchor(-20, 100), { width: 240, height: 100 }, { width: 200, height: 800 })
    expect(placed.left).toBe(8)
  })

  test('the gap and the margin can be changed', () => {
    const placed = placePopover(anchor(0, 0), { width: 50, height: 50 }, viewport, { gap: 10, margin: 20 })
    expect(placed).toMatchObject({ left: 20, top: 54, maxHeight: 726 })
  })
})
