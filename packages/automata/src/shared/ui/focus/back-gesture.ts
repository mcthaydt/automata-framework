/**
 * The system back gesture as the game's Back.
 *
 * Android's edge swipe, iOS Safari's edge swipe, a mouse's back button and a
 * trackpad's sideways swipe all step the browser's history, and a page cannot
 * turn any of them off. With nothing in history but the game, one swipe meant
 * to close Settings left the site. So the game keeps one entry of its own on
 * top: a back step lands off it, and the game reads that as Back -- the same
 * Escape a keyboard and a controller's B send -- and puts the entry back.
 *
 * Where the game has nothing to go back to, the swipe leaves as it always did:
 * a player must never be unable to swipe out of the site.
 *
 * The entry is added only inside a tap or a key press. Chrome skips, on back,
 * history entries a page added without the player's activation, so one added
 * at load would be stepped over and the swipe would leave anyway.
 *
 * From FloorFifty `apps/client/src/ui/back-gesture.ts` at `ac72660`; the history
 * key is `afBackGuard`. Standalone only: hosted, the host owns system
 * back (Ruken request R-2), so the default screens do not install it there.
 */

import { padKeyEvents } from './focus-nav'

const GUARD = 'afBackGuard'

const isGuard = (state: unknown): boolean =>
  typeof state === 'object' && state !== null && (state as Record<string, unknown>)[GUARD] === true

/**
 * Sends Back as an Escape to wherever a dialog would hear it, and reports
 * whether anything took it. A tap on a dialog's backdrop leaves focus on the
 * body, where the dialog's own Escape listener never hears a key, so an open
 * dialog is sent it directly.
 */
export function sendBack(doc: Document): boolean {
  // The topmost dialog still open: one leaving is inert, and must not catch a Back meant for what replaced it.
  const dialog = [...doc.querySelectorAll<HTMLElement>('[aria-modal="true"]')]
    .filter((each) => each.closest('[inert]') === null)
    .at(-1)
  const focused =
    doc.activeElement instanceof HTMLElement && doc.activeElement !== doc.body ? doc.activeElement : undefined
  const target = dialog !== undefined && !dialog.contains(focused ?? null) ? dialog : (focused ?? doc.body)
  const event = new KeyboardEvent('keydown', {
    key: 'Escape',
    code: 'Escape',
    bubbles: true,
    cancelable: true,
  })
  // Not a keyboard: the input-method tracker must not switch the taught controls.
  padKeyEvents.add(event)
  target.dispatchEvent(event)
  return event.defaultPrevented
}

/**
 * Holds the game's history entry and turns a back step off it into `onBack`.
 * `onBack` answers whether the game went back; `false` lets the step leave.
 */
export function interceptBackGesture(win: Window, onBack: () => boolean): () => void {
  const arm = (): void => {
    if (!isGuard(win.history.state)) win.history.pushState({ [GUARD]: true }, '')
  }
  // The events that carry the player's activation. Escape does not carry it.
  const onActivation = (event: Event): void => {
    if (event instanceof KeyboardEvent && event.key === 'Escape') return
    arm()
  }
  const onPopState = (event: PopStateEvent): void => {
    // A forward step back onto the entry: nothing to do.
    if (isGuard(event.state)) return
    if (onBack()) arm()
    else win.history.back()
  }
  win.addEventListener('pointerup', onActivation, { capture: true })
  win.addEventListener('keydown', onActivation, { capture: true })
  win.addEventListener('popstate', onPopState)
  return () => {
    win.removeEventListener('pointerup', onActivation, { capture: true })
    win.removeEventListener('keydown', onActivation, { capture: true })
    win.removeEventListener('popstate', onPopState)
  }
}
