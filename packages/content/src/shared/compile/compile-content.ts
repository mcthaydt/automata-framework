// The compiler for Node. Extracted from FloorFifty packages/content/src/compiler.ts (122a220).
//
// Reads, parses, checks and assembles, and writes nothing. The checks and the assembly are `compile-tree.ts`,
// which runs in a page too; this is the Effect shell around them: it checks the Paraglide options, reads the
// folder, and fails with a typed error. Writing is `buildContent`'s job (write-outputs.ts).
//
// Changed from FloorFifty: the kinds are the game's registered schemas, the hash is one XXH64 over the
// canonical data, and the result is an Effect that fails with a typed error.

import { Effect } from 'effect'
import { type ParaglideOptions, paraglideProblems } from '../locale/compile-messages'
import {
  type CompiledContent,
  type CompileOptions,
  compileOptionProblems,
  compileTree,
  DEFAULT_OUT_DIR,
  type MessageLocation,
  OUTPUT_LIST,
  outDirOf,
} from './compile-tree'
import { ContentCompileFailed, InvalidContentConfig } from './errors'
import { readSources } from './read-sources'

export { type CompiledContent, DEFAULT_OUT_DIR, type MessageLocation, OUTPUT_LIST, outDirOf }

/**
 * What the content compiler is given: the project root, the registered kinds, and optionally tunables,
 * invariants, flow capabilities, generators, an output folder and Paraglide.
 */
export interface ContentOptions extends CompileOptions {
  /** The project root; content is read from `<root>/content`. */
  readonly root: string
  /** Compile the catalogs with Paraglide on each build. Absent: no Paraglide output. */
  readonly paraglide?: ParaglideOptions | undefined
}

/** Mistakes in the game's code, found before any file is read. */
function optionProblems(options: ContentOptions): string[] {
  const problems = compileOptionProblems(options)
  if (options.paraglide !== undefined)
    problems.push(...paraglideProblems(options.paraglide, outDirOf(options)))
  return problems
}

/** Compiles `<root>/content` in memory. Writes nothing. */
export const compileContent = (
  options: ContentOptions,
): Effect.Effect<CompiledContent, ContentCompileFailed | InvalidContentConfig> =>
  Effect.gen(function* () {
    const problems = optionProblems(options)
    if (problems.length > 0) return yield* new InvalidContentConfig({ message: problems.join('; ') })
    const tree = yield* readSources(options.root, options.schemas)
    const outcome = compileTree(tree, options)
    if (outcome.ok) return outcome.content
    if (outcome.configProblems.length > 0)
      return yield* new InvalidContentConfig({ message: outcome.configProblems.join('; ') })
    return yield* new ContentCompileFailed({ diagnostics: outcome.diagnostics })
  })
