import { describe, expect, test, vi } from 'vitest'
import { createTestClock } from '../testing/test-clock'
import { createToasts, type Toast } from './toasts'

function setup() {
  const clock = createTestClock()
  const toasts = createToasts({ clock })
  return { clock, toasts }
}

describe('createToasts', () => {
  test('push returns an id, fills in the defaults and tells subscribers', () => {
    const { toasts } = setup()
    const seen: (readonly Toast[])[] = []
    const stop = toasts.subscribe((items) => seen.push(items))
    const id = toasts.push({ message: 'Layer added' })
    expect(seen.map((items) => items.length)).toEqual([0, 1])
    expect(toasts.items).toEqual([{ id, kind: 'info', message: 'Layer added', duration: 5000 }])
    stop()
    toasts.push({ message: 'Ignored by the stopped subscriber' })
    expect(seen).toHaveLength(2)
  })

  test('ids are unique', () => {
    const { toasts } = setup()
    expect(toasts.push({ message: 'a' })).not.toBe(toasts.push({ message: 'a' }))
  })

  test('a toast expires after 5 s, or 8 s when it has an action', () => {
    const { clock, toasts } = setup()
    toasts.push({ message: 'Plain' })
    toasts.push({ message: 'Undoable', action: { label: 'Undo', run: () => {} } })
    clock.advance(4999)
    expect(toasts.items.map((t) => t.message)).toEqual(['Plain', 'Undoable'])
    clock.advance(1)
    expect(toasts.items.map((t) => t.message)).toEqual(['Undoable'])
    clock.advance(2999)
    expect(toasts.items).toHaveLength(1)
    clock.advance(1)
    expect(toasts.items).toHaveLength(0)
  })

  test('a duration of 0 never expires, and an explicit duration wins', () => {
    const { clock, toasts } = setup()
    toasts.push({ message: 'Sticky', duration: 0 })
    toasts.push({ message: 'Short', duration: 1000 })
    clock.advance(1000)
    expect(toasts.items.map((t) => t.message)).toEqual(['Sticky'])
    clock.advance(60 * 60 * 1000)
    expect(toasts.items).toHaveLength(1)
  })

  test('the fourth toast drops the oldest and stops its timer', () => {
    const { clock, toasts } = setup()
    const clear = vi.spyOn(clock, 'clearTimer')
    toasts.push({ message: 'one' })
    toasts.push({ message: 'two' })
    toasts.push({ message: 'three' })
    expect(clear).not.toHaveBeenCalled()
    toasts.push({ message: 'four' })
    expect(toasts.items.map((t) => t.message)).toEqual(['two', 'three', 'four'])
    expect(clear).toHaveBeenCalledTimes(1)
  })

  test('dismiss removes one toast and stops its timer; an unknown id does nothing', () => {
    const { clock, toasts } = setup()
    const clear = vi.spyOn(clock, 'clearTimer')
    const first = toasts.push({ message: 'first' })
    toasts.push({ message: 'second' })
    toasts.dismiss('nope')
    expect(toasts.items).toHaveLength(2)
    expect(clear).not.toHaveBeenCalled()
    toasts.dismiss(first)
    expect(toasts.items.map((t) => t.message)).toEqual(['second'])
    expect(clear).toHaveBeenCalledTimes(1)
  })

  test('a sticky toast has no timer to stop', () => {
    const { clock, toasts } = setup()
    const clear = vi.spyOn(clock, 'clearTimer')
    toasts.dismiss(toasts.push({ message: 'Sticky', duration: 0 }))
    expect(clear).not.toHaveBeenCalled()
  })

  test('activate runs the action once and dismisses the toast', () => {
    const { toasts } = setup()
    const run = vi.fn()
    const id = toasts.push({ message: 'Deleted', action: { label: 'Undo', run } })
    toasts.activate(id)
    expect(run).toHaveBeenCalledTimes(1)
    expect(toasts.items).toHaveLength(0)
    toasts.activate(id)
    expect(run).toHaveBeenCalledTimes(1)
  })

  test('subscribers see each change as a new array, never a mutated one', () => {
    const { toasts } = setup()
    const before = toasts.items
    toasts.push({ message: 'x' })
    expect(toasts.items).not.toBe(before)
    expect(before).toHaveLength(0)
  })
})
