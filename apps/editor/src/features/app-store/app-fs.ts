// The four calls the app's store needs of the device's file system. In the app they are Tauri's file system plugin
// (`src/shared/tauri/`); in tests, a map. Paths are absolute, `/`-separated.

/** One file below a folder: its absolute path, size in bytes and modified time in epoch milliseconds. */
export interface AppFsEntry {
  readonly path: string
  readonly size: number
  readonly mtime: number
}

export interface AppFs {
  /** Every file below `folder`, at any depth. A folder that is not there lists nothing. */
  list(folder: string): Promise<AppFsEntry[]>
  /** The file's bytes, or `undefined` when there is no such file. */
  read(path: string): Promise<Uint8Array | undefined>
  /** Replaces the file (making its folders), and settles only once the bytes are on the device. Gives the new mtime. */
  write(path: string, data: Uint8Array): Promise<{ readonly mtime: number }>
  /** Deletes the file; a file that is not there is not an error. */
  remove(path: string): Promise<void>
}
