import { describe, expect, it } from 'vitest'
import { CameraDragTracker, type DragPointer } from './camera-drag-tracker.js'

// The camera drag (M4 spec §16.3.2; M3 spec §4.2, §7): one pointer turns the camera one to one, a finger or pen on
// its primary contact or a mouse on its secondary button. Fed samples directly: no DOM, no clock.

const TOUCH = { pointerType: 'touch', button: 0 }
const PEN = { pointerType: 'pen', button: 0 }
const MOUSE_PRIMARY = { pointerType: 'mouse', button: 0 }
const MOUSE_SECONDARY = { pointerType: 'mouse', button: 2 }

const recording = () => {
  const sent: [number, DragPointer][] = []
  const tracker = new CameraDragTracker({ drag: (dx, pointer) => sent.push([dx, pointer]) })
  return { sent, tracker }
}

describe('CameraDragTracker', () => {
  it('sends a touch drag’s horizontal pixels as they come, with no dead zone (A-a)', () => {
    const { sent, tracker } = recording()
    expect(tracker.down(1, 100, TOUCH)).toBe(true)
    expect(tracker.dragging).toBe(true)
    tracker.move(1, 130)
    tracker.move(1, 120)
    tracker.move(1, 121)
    expect(sent).toEqual([
      [30, 'touch'],
      [-10, 'touch'],
      [1, 'touch'],
    ])
  })

  it('treats a pen as a finger', () => {
    const { sent, tracker } = recording()
    expect(tracker.down(4, 0, PEN)).toBe(true)
    tracker.move(4, 5)
    expect(sent).toEqual([[5, 'touch']])
  })

  it('drags with the mouse’s secondary button only (A-b)', () => {
    const { sent, tracker } = recording()
    expect(tracker.down(1, 50, MOUSE_PRIMARY)).toBe(false)
    tracker.move(1, 80)
    expect(sent).toEqual([])
    expect(tracker.down(1, 50, MOUSE_SECONDARY)).toBe(true)
    tracker.move(1, 40)
    expect(sent).toEqual([[-10, 'mouse']])
  })

  it('never starts a finger on anything but its primary contact', () => {
    const { tracker } = recording()
    expect(tracker.down(1, 0, { pointerType: 'touch', button: 2 })).toBe(false)
    expect(tracker.dragging).toBe(false)
  })

  it('ignores a second finger, which never takes over the drag (A-c)', () => {
    const { sent, tracker } = recording()
    tracker.down(1, 100, TOUCH)
    expect(tracker.down(2, 300, TOUCH)).toBe(false)
    tracker.move(2, 340)
    tracker.move(1, 110)
    tracker.up(1)
    expect(tracker.dragging).toBe(false)
    tracker.move(2, 380)
    expect(sent).toEqual([[10, 'touch']])
    expect(tracker.down(2, 380, TOUCH)).toBe(true)
    tracker.move(2, 390)
    expect(sent).toEqual([
      [10, 'touch'],
      [10, 'touch'],
    ])
  })

  it('sends nothing for a move that does not change x', () => {
    const { sent, tracker } = recording()
    tracker.down(1, 100, TOUCH)
    tracker.move(1, 100)
    expect(sent).toEqual([])
  })

  it('ends on cancel, and the next contact starts a new drag (A-g)', () => {
    const { sent, tracker } = recording()
    tracker.down(1, 100, TOUCH)
    tracker.move(1, 120)
    tracker.cancel()
    expect(tracker.dragging).toBe(false)
    tracker.move(1, 150)
    expect(tracker.down(3, 10, TOUCH)).toBe(true)
    tracker.move(3, 15)
    expect(sent).toEqual([
      [20, 'touch'],
      [5, 'touch'],
    ])
  })

  it('ignores the lift of a pointer that was not dragging', () => {
    const { tracker } = recording()
    tracker.down(1, 100, TOUCH)
    tracker.up(2)
    expect(tracker.dragging).toBe(true)
  })

  // A lost pointerup (alt-tab, an OS gesture, a swallowed mouseup) must not leave a drag stuck: the same pointer
  // pressing again starts afresh from where it is now (review of #204).
  it('restarts when the dragging pointer goes down again, from where it is now', () => {
    const { sent, tracker } = recording()
    tracker.down(1, 100, MOUSE_SECONDARY)
    tracker.move(1, 110)
    expect(tracker.down(1, 400, MOUSE_SECONDARY)).toBe(true)
    tracker.move(1, 405)
    expect(sent).toEqual([
      [10, 'mouse'],
      [5, 'mouse'],
    ])
  })

  it('ends the drag when the dragging pointer goes down again in a way that cannot drag', () => {
    const { tracker } = recording()
    tracker.down(1, 100, MOUSE_SECONDARY)
    expect(tracker.down(1, 100, MOUSE_PRIMARY)).toBe(false)
    expect(tracker.dragging).toBe(false)
  })
})
