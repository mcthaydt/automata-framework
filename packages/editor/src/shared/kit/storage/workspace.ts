// Where an editor keeps things: the document store, the journal for autosaves and the export sink, opened from OPFS
// when the browser has it and from memory when it does not.
import { createDownloadStore, type DownloadEnv, type DownloadStore } from './download-store'
import { createOpfsStore, type DirectoryLike } from './handle-store'
import { createHttpStore } from './http-store'
import { createMemoryStore } from './memory-store'
import { classifyStorageError, type ProjectStore } from './project-store'
import { createPublishClient, type PublishClient } from './publish-client'

export interface Workspace {
  /** Where documents live: an OPFS directory, or memory when OPFS cannot be used. */
  readonly store: ProjectStore
  /** Where autosaves live, apart from `store` so a listing of the workspace never shows them. */
  readonly journal: ProjectStore
  /** Export: download, share sheet, clipboard. Always available. */
  readonly exports: DownloadStore
  /** False when nothing is kept on this device; the status line then shows `device` and Export is promoted. */
  readonly persistent: boolean
  /** Why OPFS is not used, when `persistent` is false. */
  readonly reason: string | undefined
  /** True when `store` is a game checkout served by `automata editor`, not this browser's storage; Home says so. */
  readonly served?: boolean
  /** On a served checkout, the game's name in words ("Emberwick"), as the server gives it; Home shows it as the source. */
  readonly game?: string | undefined
}

export interface WorkspaceEnv {
  /** The browser's `navigator.storage`; hand in `{}` for a browser without OPFS. */
  readonly storage?: { getDirectory?: () => Promise<DirectoryLike> }
  readonly download?: DownloadEnv
}

const PROBE = 'probe.txt'

/**
 * Opens the editor's default storage: an OPFS workspace with a journal beside it. The browser
 * saying it has OPFS is not enough (an old Safari private window opens it and then refuses every write), so a probe
 * file is written, read back and removed first. Any failure, at any step, gives the fallback instead of an error:
 * memory stores, `persistent: false` and the reason, so the person sees "Not saved on this device" and Export is the
 * way to keep their work (EK-f).
 */
export async function openWorkspace(env: WorkspaceEnv = {}): Promise<Workspace> {
  const exports = createDownloadStore(env.download)
  const storage = env.storage ?? (typeof navigator === 'undefined' ? undefined : navigator.storage)
  const getDirectory = storage?.getDirectory?.bind(storage)
  if (getDirectory === undefined) return fallback(exports, 'This browser has no private file storage (OPFS).')
  try {
    const store = await createOpfsStore({ directory: 'workspace', getRoot: getDirectory })
    const journal = await createOpfsStore({ directory: 'journal', getRoot: getDirectory })
    const written = await journal.write(PROBE, 'probe')
    if (!written.ok) throw new Error(written.message)
    if ((await journal.read(PROBE)) === undefined)
      throw new Error('A file written to private storage could not be read.')
    await journal.remove(PROBE)
    return { store, journal, exports, persistent: true, reason: undefined }
  } catch (error) {
    return fallback(exports, `Private file storage is unavailable: ${classifyStorageError(error).message}`)
  }
}

function fallback(exports: DownloadStore, reason: string): Workspace {
  return { store: createMemoryStore(), journal: createMemoryStore(), exports, persistent: false, reason }
}

export interface ServedWorkspaceEnv {
  /** The page's origin (`location.origin`). */
  readonly origin: string
  /** The page's query string (`location.search`): a served editor opened by its address carries `?token=`. */
  readonly search: string
  readonly fetch?: typeof fetch | undefined
  /** Keeps the token for the tab's session, so a reload needs no token in the address. */
  readonly sessionStorage?:
    | { getItem(key: string): string | null; setItem(key: string, value: string): void }
    | undefined
  readonly storage?: WorkspaceEnv['storage']
  readonly download?: DownloadEnv
}

const TOKEN_KEY = 'automata-editor-token'

/** The checkout `automata editor` serves, and what its ping says about the game. */
export interface ServedStore {
  readonly store: ProjectStore
  /** The game's name in words ("Emberwick"), from a server that sends one. */
  readonly game: string | undefined
  /** The game's page, which `automata editor` runs beside the editor: Play opens it and the Tuner shows it. */
  readonly gameUrl: string | undefined
  /** Builds the game into a zip to upload, from a server that can; none from one that cannot. */
  readonly publish: PublishClient | undefined
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * The game's page as this browser can reach it. The server names it on its own computer (`localhost`); a tablet that
 * opened the editor over the network (`automata editor --lan`) reaches the same game at the computer's address, which
 * is the host it opened the editor on.
 */
function reachableFrom(gameUrl: string, origin: string): string {
  const game = new URL(gameUrl)
  const page = new URL(origin)
  if (!LOOPBACK_HOSTS.has(game.hostname) || LOOPBACK_HOSTS.has(page.hostname)) return game.href
  game.hostname = page.hostname
  return game.href
}

/**
 * The checkout of an editor served by `automata editor`, over HTTP: the page asks its own origin whether it is an editor
 * server, and answers `undefined` when it is not (a static host, a dev server). A token given in the address is kept
 * for the tab's session, so a reload needs none. The ping's `game` (the game's name in words) and `gameUrl` (its dev page) come back beside the store. The 2D editor and the suite both open the checkout through this.
 */
export async function openServedStore(
  env: Pick<ServedWorkspaceEnv, 'origin' | 'search' | 'fetch' | 'sessionStorage'>,
): Promise<ServedStore | undefined> {
  const fetchFn = env.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  let game: string | undefined
  let gameUrl: string | undefined
  let publishes = false
  try {
    const ping = await fetchFn(`${env.origin}/api/ping`)
    const body: unknown = await ping.json()
    if (typeof body !== 'object' || body === null || !('automata' in body) || body.automata !== 'editor')
      return undefined
    if ('game' in body && typeof body.game === 'string' && body.game !== '') game = body.game
    if ('gameUrl' in body && typeof body.gameUrl === 'string' && URL.canParse(body.gameUrl))
      gameUrl = reachableFrom(body.gameUrl, env.origin)
    publishes = 'publish' in body && body.publish === true
  } catch {
    return undefined
  }
  const given = new URLSearchParams(env.search).get('token') ?? undefined
  if (given !== undefined) env.sessionStorage?.setItem(TOKEN_KEY, given)
  const token = given ?? env.sessionStorage?.getItem(TOKEN_KEY) ?? undefined
  return {
    store: createHttpStore({ base: env.origin, token, fetch: fetchFn }),
    game,
    gameUrl,
    publish: publishes ? createPublishClient({ base: env.origin, token, fetch: fetchFn }) : undefined,
  }
}

/**
 * The workspace of an editor served by `automata editor`: the checkout over HTTP (`openServedStore`), or `undefined`
 * when the page is not served by it, so the caller opens `openWorkspace()` as before. The autosave journal stays in
 * this browser, beside the editor, never in the checkout.
 */
export async function openServedWorkspace(env: ServedWorkspaceEnv): Promise<Workspace | undefined> {
  const served = await openServedStore(env)
  if (served === undefined) return undefined
  const local = await openWorkspace({
    ...(env.storage === undefined ? {} : { storage: env.storage }),
    ...(env.download === undefined ? {} : { download: env.download }),
  })
  return {
    store: served.store,
    journal: local.journal,
    exports: local.exports,
    persistent: true,
    reason: undefined,
    served: true,
    game: served.game,
  }
}
