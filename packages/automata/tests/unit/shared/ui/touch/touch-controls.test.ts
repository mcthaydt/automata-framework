import { describe, expect, it } from 'vitest'
import {
  nearestTarget,
  PointerLatch,
  STICKY_MARGIN_PX,
  StickyPointers,
  shownButtons,
} from '#src/shared/ui/touch/touch-controls.ts'

// The touch buttons' bookkeeping (M4 spec §4.4), as behavior over string actions: the multi-touch cases drive the latch itself.

const rig = () => {
  const held = new Set<string>()
  const changes: [string, boolean][] = []
  const latch = new PointerLatch((action, active) => {
    changes.push([action, active])
    if (active) held.add(action)
    else held.delete(action)
  })
  return { latch, pointers: new StickyPointers(latch), held, changes }
}

describe('multi-touch', () => {
  it('holds two actions from two fingers at once', () => {
    const { latch, held } = rig()
    latch.press('left', 1)
    latch.press('drop', 2)
    expect([...held]).toEqual(['left', 'drop'])
  })

  it('keeps an action held until its last finger lifts', () => {
    const { latch, held } = rig()
    latch.press('left', 1)
    latch.press('left', 2)
    latch.release('left', 1)
    expect(latch.isHeld('left')).toBe(true)
    latch.release('left', 2)
    expect(held.size).toBe(0)
    expect(latch.isHeld('left')).toBe(false)
  })

  it('ignores a release for a finger that was never down', () => {
    const { latch, held } = rig()
    latch.press('right', 1)
    latch.release('right', 99)
    expect([...held]).toEqual(['right'])
  })

  it('reports only real changes', () => {
    const { latch, changes } = rig()
    latch.press('left', 1)
    latch.press('left', 2)
    latch.release('left', 2)
    latch.release('left', 1)
    expect(changes).toEqual([
      ['left', true],
      ['left', false],
    ])
  })

  it('releases everything held, reporting each action once', () => {
    const { latch, changes } = rig()
    latch.press('left', 1)
    latch.press('left', 2)
    latch.press('drop', 3)
    changes.length = 0
    latch.releaseAll()
    expect(changes).toEqual([
      ['left', false],
      ['drop', false],
    ])
    latch.releaseAll()
    expect(changes).toHaveLength(2)
  })
})

const box = (left: number, top: number, size = 60) => ({ left, top, right: left + size, bottom: top + size })
const LAYOUT = [
  { action: 'left', rect: box(16, 700) },
  { action: 'right', rect: box(88, 700) },
  { action: 'drop', rect: box(300, 700) },
]

describe('sticky buttons', () => {
  it('resolves a point on a button to that button', () => {
    expect(nearestTarget(40, 720, LAYOUT)).toBe('left')
  })

  it('resolves a near miss to the nearest button within the margin', () => {
    expect(STICKY_MARGIN_PX).toBe(24)
    expect(nearestTarget(40, 700 - (STICKY_MARGIN_PX - 4), LAYOUT)).toBe('left')
    expect(nearestTarget(83, 720, LAYOUT)).toBe('right') // in the gap, nearer right
    expect(nearestTarget(372, 720, LAYOUT)).toBe('drop')
  })

  it('ignores a touch beyond the margin', () => {
    expect(nearestTarget(40, 700 - STICKY_MARGIN_PX - 1, LAYOUT)).toBeUndefined()
    expect(nearestTarget(200, 720, LAYOUT)).toBeUndefined()
  })

  it('takes a margin of its own', () => {
    expect(nearestTarget(40, 690, LAYOUT, 5)).toBeUndefined()
  })

  it('slides a held thumb from one button to the next', () => {
    const { pointers, held } = rig()
    expect(pointers.down(1, 'left')).toBe(true)
    pointers.move(1, 'right')
    expect([...held]).toEqual(['right'])
    pointers.up(1)
    expect(held.size).toBe(0)
  })

  it('presses nothing for a finger on no button', () => {
    const { pointers, held } = rig()
    expect(pointers.down(1, undefined)).toBe(false)
    pointers.move(1, 'left')
    expect(held.size).toBe(0)
  })

  it('keeps what a thumb holds when it slides off everything', () => {
    const { pointers, held } = rig()
    pointers.down(1, 'left')
    pointers.move(1, undefined)
    expect([...held]).toEqual(['left'])
  })

  it('keeps a button held while another finger slides off it', () => {
    const { pointers, held } = rig()
    pointers.down(1, 'left')
    pointers.down(2, 'left')
    pointers.move(2, 'right')
    expect([...held].sort()).toEqual(['left', 'right'])
  })

  it('releases every finger at once', () => {
    const { pointers, held } = rig()
    pointers.down(1, 'left')
    pointers.down(2, 'drop')
    pointers.releaseAll()
    expect(held.size).toBe(0)
    pointers.up(1)
    expect(held.size).toBe(0)
  })
})

// The reduced set (M4 spec §4.9, §6): where one row cannot hold every button at the primary size, only the required
// ones show; a target is never shrunk. A game that marks none required keeps all of them, wrapping as before.
describe('shownButtons', () => {
  const buttons = [
    { action: 'left', required: true },
    { action: 'right', required: true },
    { action: 'emote' },
  ]

  it('shows every button while one row holds them', () => {
    expect(shownButtons(buttons, true).map((button) => button.action)).toEqual(['left', 'right', 'emote'])
  })

  it('shows only the required ones when it does not', () => {
    expect(shownButtons(buttons, false).map((button) => button.action)).toEqual(['left', 'right'])
  })

  it('keeps every button when none is required', () => {
    const none = [{ action: 'left' }, { action: 'right' }]
    expect(shownButtons(none, false)).toEqual(none)
  })
})
