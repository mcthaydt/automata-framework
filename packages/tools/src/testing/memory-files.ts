import { Effect, Layer } from 'effect'
import { FileError } from '../shared/node/errors.ts'
import { Files } from '../shared/node/files.ts'

// An in-memory `Files` for tests of the tools that read and write a game's files: a map from path to text, and the
// layer that serves it. Writes land in the map, so a test reads back what the tool wrote.

/** The map a test fills and reads, and the layer that serves it. */
export interface MemoryFiles {
  readonly files: Map<string, string>
  readonly layer: Layer.Layer<Files>
}

/** `Files` over a map of path to text. A path is a file when it is a key, and a folder when a key is below it. */
export function memoryFiles(initial: Readonly<Record<string, string>> = {}): MemoryFiles {
  const files = new Map(Object.entries(initial))
  const below = (dir: string): string[] => [...files.keys()].filter((path) => path.startsWith(`${dir}/`))
  const readText = (path: string) =>
    files.has(path)
      ? Effect.succeed(files.get(path) as string)
      : Effect.fail(new FileError({ path, cause: 'missing' }))
  const layer = Layer.succeed(Files, {
    readText,
    readBytes: (path) => Effect.map(readText(path), (text) => new TextEncoder().encode(text)),
    writeText: (path, text) => Effect.sync(() => void files.set(path, text)),
    exists: (path) => Effect.succeed(files.has(path) || below(path).length > 0),
    listFiles: (dir) =>
      Effect.succeed(
        below(dir)
          .map((path) => path.slice(dir.length + 1))
          .sort(),
      ),
    remove: (path) => Effect.sync(() => void files.delete(path)),
  })
  return { files, layer }
}
