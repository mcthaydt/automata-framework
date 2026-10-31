import { createDownloadStore, type DownloadEnv, type DownloadStore } from './download-store'
import { createOpfsStore, type DirectoryLike } from './handle-store'
import { createHttpStore } from './http-store'
import { createMemoryStore } from './memory-store'
import { classifyStorageError, type ProjectStore } from './project-store'

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
}

export interface WorkspaceEnv {
  /** The browser's `navigator.storage`; hand in `{}` for a browser without OPFS. */
  readonly storage?: { getDirectory?: () => Promise<DirectoryLike> }
  readonly download?: DownloadEnv
}

const PROBE = 'probe.txt'

/**
 * Opens the editor's default storage (kit spec §4.7, §6): an OPFS workspace with a journal beside it. The browser
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

/**
 * The workspace of an editor served by `automata editor` (ED3D.14): the checkout over HTTP. The page asks its own origin
 * whether it is an editor server, and answers `undefined` when it is not (a static host, a dev server), so the caller
 * opens `openWorkspace()` as before. The autosave journal stays in this browser, beside the editor, never in the checkout.
 */
export async function openServedWorkspace(env: ServedWorkspaceEnv): Promise<Workspace | undefined> {
  const fetchFn = env.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  try {
    const ping = await fetchFn(`${env.origin}/api/ping`)
    const body: unknown = await ping.json()
    if (typeof body !== 'object' || body === null || !('automata' in body) || body.automata !== 'editor')
      return undefined
  } catch {
    return undefined
  }
  const given = new URLSearchParams(env.search).get('token') ?? undefined
  if (given !== undefined) env.sessionStorage?.setItem(TOKEN_KEY, given)
  const token = given ?? env.sessionStorage?.getItem(TOKEN_KEY) ?? undefined
  const local = await openWorkspace({
    ...(env.storage === undefined ? {} : { storage: env.storage }),
    ...(env.download === undefined ? {} : { download: env.download }),
  })
  return {
    store: createHttpStore({ base: env.origin, token, fetch: fetchFn }),
    journal: local.journal,
    exports: local.exports,
    persistent: true,
    reason: undefined,
  }
}
