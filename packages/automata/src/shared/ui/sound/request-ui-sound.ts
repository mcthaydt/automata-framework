/** The event `requestUiSound` sends; it bubbles to the root `installUiSounds` listens on. */
export const REQUEST_EVENT = 'automata-sfx'

/**
 * Asks for a sound from inside a component that has no press behind it (an error arriving, a panel opening). The
 * request bubbles to the root `installUiSounds` listens on. `open` and `close` also quiet the focus ticks for 400 ms,
 * since the panel moving focus is part of the opening. It lives in `shared/` so the shared panels can ask; the
 * listener that plays the sounds is the audio feature's.
 */
export function requestUiSound(from: Element, name: string): void {
  from.dispatchEvent(new CustomEvent(REQUEST_EVENT, { bubbles: true, detail: name }))
}
