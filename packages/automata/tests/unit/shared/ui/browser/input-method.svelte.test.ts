import { describe, expect, it } from 'vitest'
import { InputMethodTracker } from '#src/shared/ui/browser/input-method.svelte.ts'

describe('the last input method', () => {
  it('follows the most recent device', () => {
    const tracker = new InputMethodTracker()
    const detach = tracker.attach(document)
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }))
    expect(tracker.method).toBe('keyboard')
    document.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch' }))
    expect(tracker.method).toBe('touch')
    tracker.note('gamepad')
    expect(tracker.method).toBe('gamepad')
    detach()
  })

  it('ignores a mouse, which says nothing about the controls to teach', () => {
    const tracker = new InputMethodTracker()
    const detach = tracker.attach(document)
    tracker.note('gamepad')
    document.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse' }))
    expect(tracker.method).toBe('gamepad')
    detach()
  })
})

describe("a controller's Back", () => {
  it('is not taken for a keyboard press, though it arrives as Escape', async () => {
    const { FocusNavigator } = await import('#src/shared/ui/focus/focus-nav.ts')
    const tracker = new InputMethodTracker()
    const detach = tracker.attach(window)
    tracker.note('gamepad')

    new FocusNavigator().back()

    expect(tracker.method).toBe('gamepad')
    detach()
  })
})
