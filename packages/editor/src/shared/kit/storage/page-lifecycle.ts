// When the page goes away the autosave debounce must not hold the last edits back: a tab that is closed, swiped
// away on a tablet or put in the back-forward cache gets no later chance to write. `visibilitychange` to hidden is
// the one event every mobile browser fires reliably; `pagehide` covers a desktop close and the bfcache.

/** The part of `Document` that `flushOnHide` uses, so tests need no DOM. */
export interface LifecycleDocument {
  readonly visibilityState: string
  addEventListener(type: 'visibilitychange', run: () => void): void
  removeEventListener(type: 'visibilitychange', run: () => void): void
}

/** The part of `Window` that `flushOnHide` uses. */
export interface LifecycleWindow {
  addEventListener(type: 'pagehide', run: () => void): void
  removeEventListener(type: 'pagehide', run: () => void): void
}

/** Writes the autosave journal as the page hides. Returns a way to stop listening. */
export function flushOnHide(
  session: { flush(): Promise<void> },
  env: { readonly document: LifecycleDocument; readonly window: LifecycleWindow },
): () => void {
  // The session reports a failed write as a problem, so there is nobody to tell here.
  const flush = (): void => {
    session.flush().catch(() => undefined)
  }
  const onVisibility = (): void => {
    if (env.document.visibilityState === 'hidden') flush()
  }
  env.document.addEventListener('visibilitychange', onVisibility)
  env.window.addEventListener('pagehide', flush)
  return () => {
    env.document.removeEventListener('visibilitychange', onVisibility)
    env.window.removeEventListener('pagehide', flush)
  }
}
