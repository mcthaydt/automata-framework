import { isAbsolute, relative, resolve, sep } from 'node:path'
import { type FileError, Files } from '@mcthaydt/automata-node'
import { canonicalJson, hex64, utf8, xxhash64 } from '@mcthaydt/automata-sim/hash'
import { Effect } from 'effect'
import type { StageContext, StageDef } from './pipeline.ts'

// The stage cache (The Last Light's runner, `inputHash` and `isCurrent`): a stage is skipped when the hash of its
// inputs and params is unchanged and its outputs exist, so a run can stop after any paid stage and resume past it.
// Hashes are XXH64 from the sim's hash entry, the framework's one hash, rather than node:crypto.

/** A stage path made absolute: relative paths are inside the target folder. */
export const resolveIn = (dir: string, path: string): string => (isAbsolute(path) ? path : resolve(dir, path))

/** A path as records and messages show it: from the target folder with `/`, or absolute when outside it. */
export function relativeTo(dir: string, path: string): string {
  const rel = relative(dir, path)
  const outside = rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)
  return (outside ? path : rel).split(sep).join('/')
}

/**
 * The files a stage path stands for, absolute and sorted: the file itself, or every file below a folder. Empty when
 * nothing is there. `Files` cannot tell a file from a folder, so a path that exists but does not read as text is
 * listed as a folder.
 */
export const filesAt = (path: string): Effect.Effect<readonly string[], never, Files> =>
  Effect.gen(function* () {
    const files = yield* Files
    if (!(yield* files.exists(path))) return []
    const asFile = yield* Effect.either(files.readText(path))
    if (asFile._tag === 'Right') return [path]
    const below = yield* Effect.orElseSucceed(files.listFiles(path), (): readonly string[] => [])
    return below.map((name) => resolve(path, name))
  })

const xxh = (text: string): string => hex64(xxhash64(utf8(text)))

/**
 * XXH64 over `path\0hash(content)\n` for every file of every input (inputs in sorted order, files sorted below each)
 * and then `params\0` with the canonical JSON of the stage's params (`null` without any). `null` when a required
 * input has no file: the stage cannot run.
 *
 * Content is read through `Files.readText`, so a binary input is hashed from its UTF-8 decoding (plan D7: core's
 * `Files` needs `readBytes` before stages with binary inputs rely on the cache).
 */
export const inputHash = (
  stage: StageDef,
  ctx: StageContext,
): Effect.Effect<string | null, FileError, Files> =>
  Effect.gen(function* () {
    const files = yield* Files
    const inputs = (stage.inputs?.(ctx) ?? []).map((path) => resolveIn(ctx.dir, path)).sort()
    let text = ''
    for (const input of inputs) {
      const found = yield* filesAt(input)
      if (found.length === 0) return null
      for (const file of found) text += `${relativeTo(ctx.dir, file)}\0${xxh(yield* files.readText(file))}\n`
    }
    text += `params\0${canonicalJson(stage.params?.(ctx) ?? null)}`
    return xxh(text)
  })

/** The paths (as given) that have no file: a missing file or an empty folder. */
export const missingPaths = (dir: string, paths: readonly string[]): Effect.Effect<string[], never, Files> =>
  Effect.filter(paths, (path) => Effect.map(filesAt(resolveIn(dir, path)), (found) => found.length === 0))
