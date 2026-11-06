// The store of a served game checkout: the kit's `ProjectStore` over HTTP to the server the
// command starts, so the editor in a tablet's browser reads and writes the developer's own files. The server holds the
// rules (the editor list's allowlist, a token off the loopback) and the mtime guard; this side sends the guard and sorts
// the answers into the kit's reasons: 409 `conflict`, 403 `policy`, 401 `denied`, anything else `io`.
//
// The protocol is four routes under `/api`: `GET list?prefix=` (JSON entries), `GET file?path=` (bytes; 404 is no file),
// `PUT file?path=&expected=<mtime>|absent` (the body is the bytes; the answer is `{ mtime }`) and `DELETE file?path=`.
import {
  type ProjectStore,
  StorageError,
  type StorageFailure,
  type StoredEntry,
  toBytes,
  type WriteResult,
} from './project-store'
import { assertStorePath, assertStorePrefix } from './store-path'

export interface HttpStoreOptions {
  /** The server's origin, such as `http://192.168.1.20:4173`; a trailing slash is ignored. */
  readonly base: string
  /** Sent as a bearer when the server asks for one (it does off the loopback). */
  readonly token?: string | undefined
  /** `fetch`, replaceable in tests. */
  readonly fetch?: typeof fetch | undefined
}

/** The reason a refusal status stands for. */
function reasonOf(status: number): StorageFailure {
  if (status === 403) return 'policy'
  if (status === 401) return 'denied'
  return 'io'
}

async function messageOf(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string')
      return body.message
  } catch {
    // A body that is not JSON says nothing more than the status.
  }
  return `the server answered ${response.status}`
}

export function createHttpStore(options: HttpStoreOptions): ProjectStore {
  const base = options.base.replace(/\/+$/, '')
  const fetchFn = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  const headers: Record<string, string> =
    options.token === undefined ? {} : { authorization: `Bearer ${options.token}` }

  /** A request, or a StorageError for a network failure. */
  async function send(url: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await fetchFn(`${base}${url}`, { ...init, headers: { ...headers, ...init.headers } })
    } catch (error) {
      throw new StorageError('io', error instanceof Error ? error.message : String(error))
    }
  }

  async function refused(response: Response): Promise<StorageError> {
    return new StorageError(reasonOf(response.status), await messageOf(response))
  }

  return {
    kind: 'http',

    async list(prefix = '') {
      assertStorePrefix(prefix)
      const response = await send(`/api/list?prefix=${encodeURIComponent(prefix)}`)
      if (!response.ok) throw await refused(response)
      return (await response.json()) as StoredEntry[]
    },

    async read(path) {
      assertStorePath(path)
      const response = await send(`/api/file?path=${encodeURIComponent(path)}`)
      if (response.status === 404) return undefined
      if (!response.ok) throw await refused(response)
      return new Uint8Array(await response.arrayBuffer())
    },

    async write(path, data, expected): Promise<WriteResult> {
      assertStorePath(path)
      const guard =
        expected === undefined ? '' : `&expected=${expected === 'absent' ? 'absent' : expected.mtime}`
      let response: Response
      try {
        response = await send(`/api/file?path=${encodeURIComponent(path)}${guard}`, {
          method: 'PUT',
          body: toBytes(data) as BodyInit,
        })
      } catch (error) {
        const failed = error as StorageError
        return { ok: false, reason: failed.reason, message: failed.message }
      }
      if (response.ok) return { ok: true, mtime: ((await response.json()) as { mtime: number }).mtime }
      const message = await messageOf(response)
      return { ok: false, reason: response.status === 409 ? 'conflict' : reasonOf(response.status), message }
    },

    async remove(path) {
      assertStorePath(path)
      const response = await send(`/api/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
      if (!response.ok && response.status !== 404) throw await refused(response)
    },
  }
}
