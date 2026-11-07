/**
 * Puts the game's sound to sleep while nobody can see it.
 *
 * Locking a phone left a game's music playing. A hidden page is the signal
 * every browser gives for that, a backgrounded tab and a switched-away app
 * alike; `pagehide` and `freeze` cover the browsers that pause a page without
 * reporting it hidden first. The render loop needs nothing here: browsers
 * already stop animation frames for a hidden page.
 *
 * A window that only loses focus stays awake. The page is still in view --
 * a second monitor, a chat app over the corner -- and an online game goes on
 * whether the player is clicked into it or not, so its sound does too.
 *
 * Waking and sleeping on Ruken's `lifecycle` belongs to the runtime, over
 * `Hosting` (M1.5); this module is the browser half only.
 *
 * Every gesture also asks the sound to come back from an interruption the
 * page was never told about: a call or Siri on a phone suspends the graph
 * while the page stays visible, and only a gesture may resume it.
 */

export type Sleeper = {
  sleep(): Promise<void>
  wake(): Promise<void>
  /** Resumes a graph the system suspended; for example an `AudioContext` the system suspended. */
  resumeOnGesture?(): Promise<void>
}

/** The events a browser may count as the gesture that lets sound resume. */
const GESTURES = ['pointerup', 'touchend', 'keydown'] as const

/**
 * Puts a game's sound to sleep while its page is hidden and wakes it when the page shows again; a pointer,
 * touch or key gesture also asks sound the system suspended to resume. A window that only loses focus stays
 * awake. Returns a function that removes the listeners.
 */
export function sleepWhenHidden(doc: Document, sleeper: Sleeper, win: Window = window): () => void {
  const sleep = (): void => void sleeper.sleep().catch(() => undefined)
  const wake = (): void => void sleeper.wake().catch(() => undefined)
  const onVisibility = (): void => (doc.visibilityState === 'hidden' ? sleep() : wake())
  const onGesture = (): void => void sleeper.resumeOnGesture?.().catch(() => undefined)

  doc.addEventListener('visibilitychange', onVisibility)
  doc.addEventListener('freeze', sleep)
  doc.addEventListener('resume', onVisibility)
  win.addEventListener('pagehide', sleep)
  win.addEventListener('pageshow', onVisibility)
  // Capture, so a control that stops propagation still counts as the gesture.
  for (const type of GESTURES) win.addEventListener(type, onGesture, true)
  return () => {
    doc.removeEventListener('visibilitychange', onVisibility)
    doc.removeEventListener('freeze', sleep)
    doc.removeEventListener('resume', onVisibility)
    win.removeEventListener('pagehide', sleep)
    win.removeEventListener('pageshow', onVisibility)
    for (const type of GESTURES) win.removeEventListener(type, onGesture, true)
  }
}
