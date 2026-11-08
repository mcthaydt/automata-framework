// Reading the authored tree from disk. Extracted from FloorFifty packages/content/src/read-sources.ts (122a220).
//
// The only compile step that touches the disk. It reads every file the compiler may need into a list and
// hands it to `sourceTreeFrom` (source-tree.ts), which decides which are sources and what an author sees them
// called. Every file is labelled `content/...`, the path an author has open, so a fixture tree in a temp
// folder reports exactly what the real tree would.

import { join } from 'node:path'
import { Effect } from 'effect'
import type { Diagnostic } from '../diagnostics/diagnostic'
import { listFiles, readTextIfPresent } from '../files/content-files'
import type { ContentSchemaDef } from '../schema/content-schema'
import { CONTENT_FOLDER, isReadFile, type SourceTree, sourceTreeFrom } from './source-tree'

const reason = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))

const atFile = (file: string, message: string): Diagnostic => ({
  code: 'missingField',
  file,
  line: 1,
  column: 1,
  keyPath: '',
  message,
})

export const readSources = (root: string, schemas: readonly ContentSchemaDef[]): Effect.Effect<SourceTree> =>
  Effect.gen(function* () {
    const contentRoot = join(root, CONTENT_FOLDER)
    const diagnostics: Diagnostic[] = []
    const files = new Map<string, string>()

    const names = yield* listFiles(contentRoot).pipe(
      Effect.catchAll((error) => {
        diagnostics.push(atFile(CONTENT_FOLDER, `this folder could not be read: ${reason(error.cause)}`))
        return Effect.succeed([] as string[])
      }),
    )
    for (const name of names) {
      const file = `${CONTENT_FOLDER}/${name}`
      // A file that is not read is only named; its text may be a picture.
      if (!isReadFile(name)) {
        files.set(file, '')
        continue
      }
      const text = yield* readTextIfPresent(join(contentRoot, name)).pipe(
        Effect.catchAll((error) => {
          diagnostics.push(atFile(file, `this file could not be read: ${reason(error.cause)}`))
          return Effect.succeed(undefined)
        }),
      )
      if (text !== undefined) files.set(file, text)
    }

    const tree = sourceTreeFrom(files, schemas)
    return { ...tree, diagnostics: [...diagnostics, ...tree.diagnostics] }
  })
