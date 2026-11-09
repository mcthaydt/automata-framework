// A web game kept on GitHub: the sync loop over the REST engine, with the signed-in person's token. It pulls when the game
// opens, commits an edit ten seconds after the last one and pushes it; `status` is the line for the top of the editors and
// `onPulled` tells the page which files a pull changed, so what is open can be read again. The page's clock, timers and
// visibility are handed in; nothing here touches the page.
import type { ProjectStore } from '../storage/project-store'
import { createRestEngine } from './rest-engine'
import { type SyncHandle, startSync, type Timers, type Visibility } from './sync-loop'
import type { WebGitHubSession } from './web-sign-in'

export interface WebSyncDeps {
  readonly fetch: typeof fetch
  readonly session: WebGitHubSession
  /** The game's own files. Writes made on this store by the sync (a pull) are not edits; hand in the raw store. */
  readonly store: ProjectStore
  /** `owner/name`. */
  readonly repo: string
  readonly timers: Timers
  readonly visibility: Visibility
  now?: () => number
  /** Anything unexpected the sync met; the line then says the game is not on GitHub yet. */
  onError?: (error: unknown) => void
}

export interface WebSync extends SyncHandle {
  /** Told which files a pull changed. Returns a way to stop being told. */
  onPulled(listener: (paths: readonly string[]) => void): () => void
}

export function startWebSync(deps: WebSyncDeps): WebSync {
  const listeners = new Set<(paths: readonly string[]) => void>()
  const engine = createRestEngine({
    fetch: deps.fetch,
    token: () => deps.session.token(),
    store: deps.store,
    repo: deps.repo,
    ...(deps.now === undefined ? {} : { now: deps.now }),
  })
  const handle = startSync({
    engine,
    store: {
      notifyChanged(paths) {
        for (const listener of [...listeners]) listener(paths)
      },
    },
    timers: deps.timers,
    visibility: deps.visibility,
    // A token that could not be had while the person is not known to be signed out is a network that failed.
    isSignedIn: async () => (await deps.session.token()) !== undefined || deps.session.signedIn !== false,
    ...(deps.now === undefined ? {} : { now: deps.now }),
    ...(deps.onError === undefined ? {} : { onError: deps.onError }),
  })
  return {
    ...handle,
    onPulled(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
