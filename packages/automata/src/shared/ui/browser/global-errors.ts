/**
 * The last line of defence.
 *
 * An error nothing else caught is reported by its class alone -- never its
 * message or stack, which can hold a name or a room code -- and the caller
 * shows the recovery panel with Reload. A known, recoverable failure keeps
 * its own panel; this is for the rest.
 */

const installed = new WeakSet<Window>()

const classOf = (value: unknown): string => (value instanceof Error ? value.name : typeof value)

/** Installs once per window; a second call is a no-op. Returns the uninstall. */
export function installGlobalErrorHandlers(
  win: Window,
  onFatal: (errorClass: string) => void,
  /**
   * A promise nobody awaited that rejected. The game goes on -- a cue that
   * failed to fetch must not end a race -- so it is heard apart from `onFatal`.
   */
  onRejection: (errorClass: string) => void = () => undefined,
): () => void {
  if (installed.has(win)) return () => undefined
  installed.add(win)
  // An ErrorEvent with no error object is the browser's own notice -- a
  // ResizeObserver loop, a cross-origin "Script error.", an extension -- and
  // never a failure of the game.
  const onError = (event: ErrorEvent): void => {
    if (event.error === null || event.error === undefined) return
    onFatal(classOf(event.error))
  }
  const onUnhandled = (event: PromiseRejectionEvent): void => onRejection(classOf(event.reason))
  win.addEventListener('error', onError)
  win.addEventListener('unhandledrejection', onUnhandled)
  return () => {
    win.removeEventListener('error', onError)
    win.removeEventListener('unhandledrejection', onUnhandled)
    installed.delete(win)
  }
}
