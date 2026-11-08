// Where a browser has one, the "Leave site?" question is the last guard for words that are not on disk yet: it asks
// while a field holds typed text or a write is still running. (Safari on iPhone and iPad never asks; the typing
// drafts cover them.)

/** The part of `Window` the guard uses. */
export interface LeaveWindow {
  addEventListener(type: 'beforeunload', run: (event: BeforeUnloadEvent) => void): void
  removeEventListener(type: 'beforeunload', run: (event: BeforeUnloadEvent) => void): void
}

/** Asks the browser to ask before the page goes while `busy()` is true. Returns a way to stop. */
export function guardLeaving(window: LeaveWindow, busy: () => boolean): () => void {
  const onLeave = (event: BeforeUnloadEvent): void => {
    if (!busy()) return
    event.preventDefault()
    // Older browsers read the question from here; they show their own words whatever it holds.
    event.returnValue = ''
  }
  window.addEventListener('beforeunload', onLeave)
  return () => window.removeEventListener('beforeunload', onLeave)
}
