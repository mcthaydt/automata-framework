// The generator hook (A0+A1 spec §5): a generator turns compiled content into extra files beside the
// artifact. The built-in outputs (types, messages, tuning metadata, flow graph, Ruken fields) are generators
// too, so a game's own generator gets exactly what they get. Generators are pure: data in, files and
// diagnostics out. Writing is the compiler's job.

import type { SimPartition } from '../compile/sim-partition'
import type { Diagnostic } from '../diagnostics/diagnostic'
import type { MessageCatalog } from '../locale/messages'
import type { ContentSchemaDef } from '../schema/content-schema'
import type { TuningMeta } from '../tuning/check-tuning'

/** The compiled content as it is written to `content.json` and hashed. */
export type ContentData = Readonly<Record<string, unknown>>

/**
 * Everything a generator is given: the compiled content and its hash, the sim partition, the registered
 * schemas, the message catalog and the tuning metadata.
 */
export interface GeneratorInput {
  readonly data: ContentData
  readonly hash: string
  /** The sim partition and its hash (M2.2), so a generator never re-derives it from `schemas`. */
  readonly sim: SimPartition
  readonly schemas: readonly ContentSchemaDef[]
  readonly messages: MessageCatalog
  readonly tuning: TuningMeta
}

/** What a generator returns: files to write and diagnostics to report. Both are optional. */
export interface GeneratorOutput {
  /** Path relative to the output folder → the file's exact text. */
  readonly files?: Readonly<Record<string, string>>
  readonly diagnostics?: readonly Diagnostic[]
}

/**
 * A generator: a unique name and a pure `generate` that turns compiled content into extra files. Create one
 * with `defineContentGenerator`.
 */
export interface ContentGenerator {
  readonly name: string
  generate(input: GeneratorInput): GeneratorOutput
}

/**
 * Defines a generator by name and `generate` function. Generators do no I/O: the compiler writes their files.
 * A generator that throws, repeats another's name, returns a path outside the output folder or writes a file
 * another generator wrote is reported as `InvalidContentConfig`.
 */
export function defineContentGenerator(
  name: string,
  generate: (input: GeneratorInput) => GeneratorOutput,
): ContentGenerator {
  return Object.freeze({ name, generate })
}

/** A relative, `/`-separated path that stays inside the output folder. */
function isInsideOutput(path: string): boolean {
  if (path === '' || path.startsWith('/') || path.includes('\\')) return false
  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
}

export interface GeneratorRun {
  /** In generator order, then each generator's own file order. */
  readonly files: ReadonlyMap<string, string>
  readonly diagnostics: Diagnostic[]
  /** Mistakes in the game's generator code (a clash, an escape, a throw); reported as `InvalidContentConfig`. */
  readonly configProblems: string[]
}

export function runGenerators(generators: readonly ContentGenerator[], input: GeneratorInput): GeneratorRun {
  const files = new Map<string, string>()
  const writers = new Map<string, string>()
  const diagnostics: Diagnostic[] = []
  const configProblems: string[] = []
  const names = new Set<string>()

  for (const generator of generators) {
    if (names.has(generator.name)) {
      configProblems.push(`generator "${generator.name}" is registered twice`)
      continue
    }
    names.add(generator.name)
    let output: GeneratorOutput
    try {
      output = generator.generate(input)
    } catch (error) {
      // The content passed every check, so a throw is a bug in the generator: the game's code, not its content.
      const reason = error instanceof Error ? error.message : String(error)
      configProblems.push(`generator "${generator.name}" threw: ${reason}`)
      continue
    }
    diagnostics.push(...(output.diagnostics ?? []))
    for (const [path, text] of Object.entries(output.files ?? {})) {
      if (!isInsideOutput(path)) {
        configProblems.push(`generator "${generator.name}" writes ${path}, outside the output folder`)
        continue
      }
      const writer = writers.get(path)
      if (writer !== undefined) {
        configProblems.push(`generators "${writer}" and "${generator.name}" both write ${path}`)
        continue
      }
      writers.set(path, generator.name)
      files.set(path, text)
    }
  }
  return { files, diagnostics, configProblems }
}
