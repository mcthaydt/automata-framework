import type { AppFs, AppFsEntry } from '#src/features/app-store/app-fs.ts'

/** An AppFs held in memory, with a clock the test moves, standing in for Tauri's file system plugin. */
export interface FakeAppFs extends AppFs {
  /** The bytes at an absolute path, as the folder would hold them. */
  bytes(path: string): Uint8Array | undefined
  now: number
  /** Every write that reached the folder, in order. */
  readonly writes: string[]
}

export function fakeAppFs(files: Map<string, { data: Uint8Array; mtime: number }> = new Map()): FakeAppFs {
  const fs: FakeAppFs = {
    now: 1000,
    writes: [],
    bytes: (path) => files.get(path)?.data.slice(),
    async list(folder): Promise<AppFsEntry[]> {
      return [...files]
        .filter(([path]) => path.startsWith(`${folder}/`))
        .map(([path, file]) => ({ path, size: file.data.byteLength, mtime: file.mtime }))
    },
    async read(path) {
      return files.get(path)?.data.slice()
    },
    async write(path, data) {
      fs.now += 1
      files.set(path, { data: data.slice(), mtime: fs.now })
      fs.writes.push(path)
      return { mtime: fs.now }
    },
    async remove(path) {
      files.delete(path)
    },
  }
  return fs
}
