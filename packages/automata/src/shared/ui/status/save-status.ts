// The SaveStatus indicator's contract. The first seven states are the SDK's `SavesStatus`, typed here
// because ui does not depend on the host; `no-grant` is AF's own: the game was not given the saves grant, so nothing it
// does is kept.

/** What the host says about the player's saves, or that there is no grant. */
export type SaveStatusState =
  | 'checking'
  | 'syncing'
  | 'saved'
  | 'offline-queued'
  | 'retry'
  | 'conflict'
  | 'recovered'
  | 'no-grant'

/** One line per state, in the game's language (each a message key). */
export type SaveStatusCopy = { readonly [State in SaveStatusState]: string }

/** How much a state asks of the player's notice. `info` states are working; the others carry a glyph beside the words. */
export type SaveStatusTone = 'info' | 'success' | 'warning'

/** `conflict` points the player at the host's own question, so it is a warning, not an error. */
export const SAVE_STATUS_TONES: { readonly [State in SaveStatusState]: SaveStatusTone } = {
  checking: 'info',
  syncing: 'info',
  saved: 'success',
  'offline-queued': 'warning',
  retry: 'warning',
  conflict: 'warning',
  recovered: 'success',
  'no-grant': 'warning',
}
