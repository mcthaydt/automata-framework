import { afterEach, describe, expect, it, vi } from 'vitest'
import { interceptBackGesture, sendBack } from '#src/shared/ui/focus/back-gesture.ts'
import { padKeyEvents } from '#src/shared/ui/focus/focus-nav.ts'

// The history key is `afBackGuard`.

let release: (() => void) | undefined
afterEach(() => {
  release?.()
  release = undefined
  document.body.innerHTML = ''
  // Back to an entry with no guard, as a fresh page load would be.
  window.history.replaceState(null, '')
})

const guarded = (): boolean =>
  (window.history.state as { afBackGuard?: boolean } | null)?.afBackGuard === true

/** What the browser does on a back swipe once it has stepped off the guard. */
function swipeBack(): void {
  window.history.replaceState(null, '')
  window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
}

describe('interceptBackGesture', () => {
  it("arms on the player's first tap, never before it", () => {
    release = interceptBackGesture(window, () => true)
    expect(guarded()).toBe(false)
    window.dispatchEvent(new PointerEvent('pointerup'))
    expect(guarded()).toBe(true)
  })

  it('arms once however many taps follow', () => {
    const push = vi.spyOn(window.history, 'pushState')
    release = interceptBackGesture(window, () => true)
    window.dispatchEvent(new PointerEvent('pointerup'))
    window.dispatchEvent(new PointerEvent('pointerup'))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(push).toHaveBeenCalledTimes(1)
    push.mockRestore()
  })

  it("turns a back swipe into the game's Back and stays on the page, armed again", () => {
    const onBack = vi.fn(() => true)
    const back = vi.spyOn(window.history, 'back')
    release = interceptBackGesture(window, onBack)
    window.dispatchEvent(new PointerEvent('pointerup'))
    swipeBack()
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(back).not.toHaveBeenCalled()
    expect(guarded()).toBe(true)
    back.mockRestore()
  })

  it('lets the swipe leave the page when the game has nothing to go back to', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined)
    release = interceptBackGesture(window, () => false)
    window.dispatchEvent(new PointerEvent('pointerup'))
    swipeBack()
    expect(back).toHaveBeenCalledTimes(1)
    expect(guarded()).toBe(false)
    back.mockRestore()
  })

  it('ignores a forward step back onto the guard', () => {
    const onBack = vi.fn(() => true)
    release = interceptBackGesture(window, onBack)
    window.dispatchEvent(new PopStateEvent('popstate', { state: { afBackGuard: true } }))
    expect(onBack).not.toHaveBeenCalled()
  })
})

describe('sendBack', () => {
  it('reaches an open dialog even when a tap left focus on the body', () => {
    document.body.innerHTML = `<div role="dialog" aria-modal="true"></div>`
    const dialog = document.querySelector('div') as HTMLElement
    const seen = vi.fn((event: Event) => event.preventDefault())
    dialog.addEventListener('keydown', seen)
    expect(sendBack(document)).toBe(true)
    expect(seen).toHaveBeenCalledTimes(1)
    expect((seen.mock.calls[0]?.[0] as KeyboardEvent | undefined)?.key).toBe('Escape')
  })

  it("is not a keyboard press, so the controls taught stay the player's", () => {
    let event: Event | undefined
    window.addEventListener('keydown', (e) => (event = e), { once: true })
    sendBack(document)
    expect(event !== undefined && padKeyEvents.has(event)).toBe(true)
  })

  it('passes over a dialog that is leaving (inert) to the one beneath it', () => {
    document.body.innerHTML = `<div role="dialog" aria-modal="true" id="under"></div><div inert><div role="dialog" aria-modal="true" id="leaving"></div></div>`
    const under = vi.fn((event: Event) => event.preventDefault())
    const leaving = vi.fn()
    ;(document.getElementById('under') as HTMLElement).addEventListener('keydown', under)
    ;(document.getElementById('leaving') as HTMLElement).addEventListener('keydown', leaving)
    expect(sendBack(document)).toBe(true)
    expect(under).toHaveBeenCalledTimes(1)
    expect(leaving).not.toHaveBeenCalled()
  })

  it('reports an Escape nothing handled', () => {
    expect(sendBack(document)).toBe(false)
  })
})
