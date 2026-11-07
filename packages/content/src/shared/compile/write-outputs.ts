// Writing the outputs, and checking committed ones. Extracted from FloorFifty packages/content/src/build.ts
// and compiler.ts `verifyArtifact` (122a220).
//
// `buildContent` is the only code that replaces generated files, and it replaces each atomically, so a
// reader never sees a half-written file. A failed compile writes nothing at all, which is what lets the dev
// server keep serving the last good content through a broken save.
//
// `verifyContent` is the repository gate: it rebuilds in memory and compares every output byte for byte.
// A missing, hand-edited or reformatted file is the same answer, `staleArtifact`, because the remedy is the
// same one command.

import { join } from 'node:path'
import { Effect } from 'effect'
import type { Diagnostic } from '../diagnostics/diagnostic'
import { pathKind, readTextIfPresent, removeFile, writeFileAtomically } from '../files/content-files'
import { compileMessages } from '../locale/compile-messages'
import {
  type CompiledContent,
  type ContentOptions,
  compileContent,
  OUTPUT_LIST,
  outDirOf,
} from './compile-content'
import { ContentCompileFailed, ContentWriteFailed, type InvalidContentConfig } from './errors'

/**
 * The outputs the last build listed in `outputs.txt` that this compile no longer produces. Only listed
 * files count, so a file someone else put in the output folder is never removed or reported. The list is
 * written with `/` only and relative to the folder, so an entry that could leave it is ignored: one with
 * `..`, any backslash (`..\x` on Windows), or an absolute start (`/x`, `C:/x`). A checkout that turned the
 * line endings into CRLF still reads as one entry per line.
 */
const insideOutDir = (file: string): boolean =>
  file !== '' &&
  !file.includes('\\') &&
  !file.startsWith('/') &&
  !/^[A-Za-z]:/.test(file) &&
  !file.split('/').includes('..')

const noLongerProduced = (outDir: string, compiled: CompiledContent): Effect.Effect<string[]> =>
  readTextIfPresent(join(outDir, OUTPUT_LIST)).pipe(
    Effect.orElseSucceed(() => undefined),
    Effect.map((list) =>
      (list ?? '').split(/\r?\n/).filter((file) => insideOutDir(file) && !compiled.files.has(file)),
    ),
  )

/** Compiles, writes every output under the output folder, then removes the outputs it no longer produces. */
export const buildContent = (
  options: ContentOptions,
): Effect.Effect<CompiledContent, ContentCompileFailed | InvalidContentConfig | ContentWriteFailed> =>
  Effect.gen(function* () {
    const compiled = yield* compileContent(options)
    const outDir = join(options.root, outDirOf(options))
    const leftovers = yield* noLongerProduced(outDir, compiled)
    for (const [file, text] of compiled.files) {
      const path = join(outDir, file)
      yield* writeFileAtomically(path, text).pipe(
        Effect.mapError((error) => new ContentWriteFailed({ path, cause: error.cause })),
      )
    }
    for (const file of leftovers) {
      const path = join(outDir, file)
      yield* removeFile(path).pipe(
        Effect.mapError((error) => new ContentWriteFailed({ path, cause: error.cause })),
      )
    }
    // After the outputs, so a failed Paraglide compile leaves the checked content written.
    if (options.paraglide !== undefined) {
      yield* compileMessages({ root: options.root, ...compiled, paraglide: options.paraglide })
    }
    return compiled
  })

const stale = (file: string, message: string): Diagnostic => ({
  code: 'staleArtifact',
  file,
  line: 1,
  column: 1,
  keyPath: '',
  message,
})

/** Fails with `staleArtifact` for each committed output that differs from a fresh compile. */
export const verifyContent = (
  options: ContentOptions,
): Effect.Effect<void, ContentCompileFailed | InvalidContentConfig> =>
  Effect.gen(function* () {
    const compiled = yield* compileContent(options)
    const outDir = outDirOf(options)
    const diagnostics: Diagnostic[] = []
    for (const [file, text] of compiled.files) {
      const label = `${outDir}/${file}`
      const committed = yield* readTextIfPresent(join(options.root, outDir, file)).pipe(
        Effect.orElseSucceed(() => undefined),
      )
      if (committed === undefined) {
        diagnostics.push(stale(label, `${label} is missing; run automata-content build`))
      } else if (committed !== text) {
        diagnostics.push(stale(label, `${label} does not match content/; run automata-content build`))
      }
    }
    for (const file of yield* noLongerProduced(join(options.root, outDir), compiled)) {
      const label = `${outDir}/${file}`
      const kind = yield* pathKind(join(options.root, outDir, file)).pipe(
        Effect.orElseSucceed(() => undefined),
      )
      if (kind !== undefined) {
        diagnostics.push(stale(label, `${label} is no longer produced; run automata-content build`))
      }
    }
    if (diagnostics.length > 0) return yield* new ContentCompileFailed({ diagnostics })
  })
