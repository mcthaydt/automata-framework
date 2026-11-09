// Who gets motion. The answer is read once after the page is live and again when the visitor changes the setting, so
// asking for less motion mid-visit takes effect without a reload.
export const REDUCE = '(prefers-reduced-motion: reduce)'
export const FINE_POINTER = '(hover: hover) and (pointer: fine)'

interface NetworkInformation {
  saveData?: boolean
}

/** False for a visitor who asked for less motion or is saving data: they are sent no motion code at all. */
export function wantsMotion(win: Window): boolean {
  if (win.matchMedia(REDUCE).matches) return false
  const connection = (win.navigator as Navigator & { connection?: NetworkInformation }).connection
  return connection?.saveData !== true
}

/** The playground is a game with its own input: a wheel there must reach the game, not be smoothed. */
export function smoothScrollAllowed(pathname: string): boolean {
  return !/^\/examples\/[^/]+\/?$/.test(pathname)
}

/** Wheel smoothing is for a mouse or trackpad. A touch screen keeps its own, better, momentum. */
export function wantsSmoothScroll(win: Window, pathname: string): boolean {
  return wantsMotion(win) && win.matchMedia(FINE_POINTER).matches && smoothScrollAllowed(pathname)
}

export function onReduceChange(win: Window, listener: (reduce: boolean) => void): () => void {
  const query = win.matchMedia(REDUCE)
  const handle = (event: { matches: boolean }) => listener(event.matches)
  query.addEventListener('change', handle)
  return () => query.removeEventListener('change', handle)
}
