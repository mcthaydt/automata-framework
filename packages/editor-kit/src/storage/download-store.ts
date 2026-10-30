import { classifyStorageError, type ProjectStore, toBytes, type WriteResult } from './project-store'
import { assertStorePath, assertStorePrefix } from './store-path'

// The write-only store (kit spec §4.7): where Export goes when nothing can be kept on the device. A write is a
// browser download; on a tablet the share sheet is the way a file leaves, so that is a separate call; text can also
// be copied. Nothing is ever read back.

export interface DownloadFile {
  readonly name: string
  readonly type: string
  readonly data: Uint8Array<ArrayBuffer>
}

export interface DownloadEnv {
  now(): number
  /** Starts a browser download of the file. */
  download(file: DownloadFile): void
  /** Opens the share sheet with the file. Absent when the platform cannot share files. */
  share?: ((file: DownloadFile) => Promise<void>) | undefined
  /** Puts text on the clipboard. Absent when there is no clipboard. */
  copyText?: ((text: string) => Promise<void>) | undefined
}

export interface DownloadStore extends ProjectStore {
  readonly kind: 'download'
  /** Whether `share` can open a share sheet here. */
  readonly canShare: boolean
  /** Opens the share sheet. A dismissed sheet is `{ ok: false, reason: 'denied', message: 'Export cancelled' }`. */
  share(path: string, data: Uint8Array | string): Promise<WriteResult>
  copyText(text: string): Promise<WriteResult>
}

const TYPES: Readonly<Record<string, string>> = {
  json: 'application/json',
  toml: 'application/toml',
  txt: 'text/plain',
  md: 'text/markdown',
}

function fileFor(path: string, data: Uint8Array | string): DownloadFile {
  assertStorePath(path)
  const name = path.slice(path.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  const type = (dot > 0 ? TYPES[name.slice(dot + 1).toLowerCase()] : undefined) ?? 'application/octet-stream'
  return { name, type, data: toBytes(data) }
}

function failure(error: unknown): WriteResult {
  const { reason, message } = classifyStorageError(error)
  return { ok: false, reason, message }
}

export function createDownloadStore(env: DownloadEnv = browserDownloadEnv()): DownloadStore {
  const done = (): WriteResult => ({ ok: true, mtime: env.now() })
  return {
    kind: 'download',
    canShare: env.share !== undefined,

    async list(prefix = '') {
      assertStorePrefix(prefix)
      return []
    },
    async read(path) {
      assertStorePath(path)
      return undefined
    },
    async remove(path) {
      assertStorePath(path)
    },

    async write(path, data) {
      const file = fileFor(path, data)
      try {
        env.download(file)
        return done()
      } catch (error) {
        return failure(error)
      }
    },

    async share(path, data) {
      const file = fileFor(path, data)
      if (env.share === undefined)
        return { ok: false, reason: 'io', message: 'Sharing files is not available here.' }
      try {
        await env.share(file)
        return done()
      } catch (error) {
        if (isAbort(error)) return { ok: false, reason: 'denied', message: 'Export cancelled' }
        return failure(error)
      }
    },

    async copyText(text) {
      if (env.copyText === undefined)
        return { ok: false, reason: 'io', message: 'The clipboard is not available here.' }
      try {
        await env.copyText(text)
        return done()
      } catch (error) {
        return failure(error)
      }
    },
  }
}

function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
}

/** The parts of the page the browser environment touches, so a test can hand in its own. */
export interface BrowserPage {
  readonly document: Document
  readonly urls: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>
  readonly navigator: {
    share?: ((data: ShareData) => Promise<void>) | undefined
    canShare?: ((data: ShareData) => boolean) | undefined
    clipboard?: { writeText(text: string): Promise<void> } | undefined
  }
  setTimer(run: () => void, ms: number): void
  now(): number
}

/** How long a download's object URL stays valid; the browser has started reading it long before this. */
const REVOKE_AFTER_MS = 30_000

/** The real page: an anchor click for a download, `navigator.share` for the share sheet, the async clipboard. */
export function browserDownloadEnv(page: BrowserPage = currentPage()): DownloadEnv {
  const asFile = (file: DownloadFile): File => new File([file.data], file.name, { type: file.type })
  const probe = new File([], 'probe.txt', { type: 'text/plain' })
  // Every platform method is called on its own object: WebKit's throw when detached ("Can only call
  // Navigator.canShare on instances of Navigator").
  const { navigator } = page
  const { share } = navigator
  const clipboard = navigator.clipboard
  const canShareFiles = share !== undefined && navigator.canShare?.({ files: [probe] }) === true
  return {
    now: () => page.now(),
    download(file) {
      const url = page.urls.createObjectURL(new Blob([file.data], { type: file.type }))
      const link = page.document.createElement('a')
      link.href = url
      link.download = file.name
      link.style.display = 'none'
      page.document.body.append(link)
      link.click()
      link.remove()
      page.setTimer(() => page.urls.revokeObjectURL(url), REVOKE_AFTER_MS)
    },
    ...(canShareFiles
      ? { share: (file: DownloadFile) => share.call(navigator, { files: [asFile(file)] }) }
      : {}),
    ...(clipboard === undefined ? {} : { copyText: (text: string) => clipboard.writeText(text) }),
  }
}

function currentPage(): BrowserPage {
  return {
    document,
    urls: URL,
    navigator,
    setTimer: (run, ms) => {
      setTimeout(run, ms)
    },
    now: () => Date.now(),
  }
}
