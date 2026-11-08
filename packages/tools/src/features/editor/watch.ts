import { type FSWatcher, watch } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { inOwnedFolder, mtimeOf } from './checkout.ts'
import type { EditorPolicy } from './editor-policy.ts'

// `GET /api/watch`: the files that change under the checkout, one event each, for an editor open on one of them. The
// editor's own writes come back too; it tells them from another process's by the mtime it was given (`ProjectStore.watch`).

/** One changed file: its path from the checkout, and its modified time, or null when it was removed. */
export interface FileChange {
  readonly path: string
  readonly mtime: number | null
}

/** Collapses an editor's write burst (a truncate and a write are two events) into one event per file. */
export const WATCH_DEBOUNCE_MS = 100

/** What the server needs of the watcher: a way to listen, and a way to stop. */
export interface Watcher {
  /** Calls `listener` for each change under the checkout the policy lets the editor read; returns how to stop. */
  subscribe(listener: (change: FileChange) => void): () => void
  close(): void
}

/**
 * Watches `root` (a real path) with one recursive `fs.watch` shared by every listener, started with the first and
 * stopped with the last. A path the policy would not let the editor read is not reported, so the stream shows the
 * editor nothing it could not fetch.
 */
export function openWatcher(root: string, policy: EditorPolicy, debounceMs: number): Watcher {
  const listeners = new Set<(change: FileChange) => void>()
  const pending = new Map<string, ReturnType<typeof setTimeout>>()
  let watcher: FSWatcher | undefined

  const report = async (path: string): Promise<void> => {
    pending.delete(path)
    const info = await stat(join(root, path)).catch(() => undefined)
    const change: FileChange = { path, mtime: info?.isFile() === true ? mtimeOf(info) : null }
    // A folder that appeared or went has no mtime of its own to report; its files report themselves.
    if (info !== undefined && !info.isFile()) return
    for (const listener of listeners) listener(change)
  }

  const onEvent = (_event: string, name: string | Buffer | null): void => {
    if (name === null) return
    const path = name.toString().replaceAll('\\', '/')
    if (inOwnedFolder(path) || !policy.canRead(path)) return
    const waiting = pending.get(path)
    if (waiting !== undefined) clearTimeout(waiting)
    pending.set(
      path,
      setTimeout(() => void report(path), debounceMs),
    )
  }

  const stop = (): void => {
    watcher?.close()
    watcher = undefined
    for (const timer of pending.values()) clearTimeout(timer)
    pending.clear()
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      watcher ??= watch(root, { recursive: true }, onEvent)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) stop()
      }
    },
    close() {
      listeners.clear()
      stop()
    },
  }
}
