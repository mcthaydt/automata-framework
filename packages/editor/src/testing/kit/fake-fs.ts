import type { DirectoryLike, FileHandleLike, WritableLike } from '../../shared/kit/storage/handle-store'

/**
 * An in-memory directory tree that behaves like the origin private file system and like a picked folder, for the
 * renderer-free tests. It keeps the browser's habits that
 * matter to the adapters: a missing entry is a `NotFoundError`, a file where a directory is wanted is a
 * `TypeMismatchError`, a writable changes nothing until `close`, and `lastModified` is set on `close`.
 */

type FakeCall = 'write' | 'close' | 'getFile' | 'entries'

export interface FakeFsControls {
  /** The next call of this kind throws `error`; after that the call works again. */
  failNext(call: FakeCall, error: unknown): void
  /** How many writables were aborted, i.e. writes that did not reach the file. */
  readonly aborts: number
}

export type FakeOpfs = DirectoryLike & { readonly controls: FakeFsControls }

export type PermissionState = 'granted' | 'prompt' | 'denied'

export interface FakeFolder extends FakeOpfs {
  /** What `queryPermission` reports. */
  permission: PermissionState
  /** What `requestPermission` turns it into (a prompt the person answers); `denied` by default. */
  answerToPrompt: PermissionState
  queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
  requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
}

/** The error a browser throws, with the name the adapters look at. */
export function domError(name: string, message: string = name): Error {
  return new DOMException(message, name)
}

interface FileNode {
  readonly kind: 'file'
  data: Uint8Array
  lastModified: number
}

interface DirNode {
  readonly kind: 'directory'
  readonly children: Map<string, FileNode | DirNode>
}

interface Shared {
  now(): number
  failures: Map<FakeCall, unknown[]>
  aborts: number
}

function take(shared: Shared, call: FakeCall): void {
  const queued = shared.failures.get(call)
  if (queued !== undefined && queued.length > 0) throw queued.shift()
}

function fileHandle(shared: Shared, name: string, node: FileNode): FileHandleLike {
  return {
    kind: 'file',
    name,
    async getFile() {
      take(shared, 'getFile')
      const data = node.data.slice()
      return {
        lastModified: node.lastModified,
        size: data.byteLength,
        arrayBuffer: async () => data.buffer,
      }
    },
    async createWritable(): Promise<WritableLike> {
      const chunks: Uint8Array[] = []
      let open = true
      return {
        async write(data) {
          if (!open) throw domError('InvalidStateError', 'The writable is closed.')
          take(shared, 'write')
          chunks.push(data.slice())
        },
        async close() {
          if (!open) throw domError('InvalidStateError', 'The writable is closed.')
          take(shared, 'close')
          open = false
          const bytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0))
          let at = 0
          for (const chunk of chunks) {
            bytes.set(chunk, at)
            at += chunk.byteLength
          }
          node.data = bytes
          node.lastModified = shared.now()
        },
        async abort() {
          if (!open) return
          open = false
          shared.aborts += 1
        },
      }
    },
  }
}

function directoryHandle(shared: Shared, name: string, node: DirNode): DirectoryLike {
  const handle: DirectoryLike = {
    kind: 'directory',
    name,
    async getDirectoryHandle(childName, options) {
      let child = node.children.get(childName)
      if (child === undefined) {
        if (options?.create !== true) throw domError('NotFoundError', `${childName} was not found.`)
        child = { kind: 'directory', children: new Map() }
        node.children.set(childName, child)
      }
      if (child.kind !== 'directory') throw domError('TypeMismatchError', `${childName} is a file.`)
      return directoryHandle(shared, childName, child)
    },
    async getFileHandle(childName, options) {
      let child = node.children.get(childName)
      if (child === undefined) {
        if (options?.create !== true) throw domError('NotFoundError', `${childName} was not found.`)
        child = { kind: 'file', data: new Uint8Array(), lastModified: shared.now() }
        node.children.set(childName, child)
      }
      if (child.kind !== 'file') throw domError('TypeMismatchError', `${childName} is a directory.`)
      return fileHandle(shared, childName, child)
    },
    async removeEntry(childName, options) {
      const child = node.children.get(childName)
      if (child === undefined) throw domError('NotFoundError', `${childName} was not found.`)
      if (child.kind === 'directory' && child.children.size > 0 && options?.recursive !== true) {
        throw domError('InvalidModificationError', `${childName} is not empty.`)
      }
      node.children.delete(childName)
    },
    entries() {
      return (async function* () {
        take(shared, 'entries')
        for (const [childName, child] of [...node.children]) yield [childName, { kind: child.kind }] as const
      })()
    },
  }
  return handle
}

/** A new, empty tree. Every `lastModified` comes from `now` (default: a counter, so no two writes share one). */
export function createFakeOpfs(options: { now?: () => number } = {}): FakeOpfs {
  let tick = 1_700_000_000_000
  const shared: Shared = { now: options.now ?? (() => tick++), failures: new Map(), aborts: 0 }
  const root = directoryHandle(shared, '', { kind: 'directory', children: new Map() })
  const controls: FakeFsControls = {
    failNext(call, error) {
      shared.failures.set(call, [...(shared.failures.get(call) ?? []), error])
    },
    get aborts() {
      return shared.aborts
    },
  }
  return Object.assign(root, { controls })
}

/** Like `createFakeOpfs`, with the permission calls of a handle the person picked. */
export function createFakeFolder(
  options: { now?: () => number; permission?: PermissionState } = {},
): FakeFolder {
  const opfs = createFakeOpfs(options)
  const folder = Object.assign(opfs, {
    permission: options.permission ?? 'granted',
    answerToPrompt: 'denied' as PermissionState,
    async queryPermission() {
      return folder.permission
    },
    async requestPermission() {
      if (folder.permission === 'prompt') folder.permission = folder.answerToPrompt
      return folder.permission
    },
  })
  return folder
}
