// The `automata-content` command.
// `check` compiles and writes nothing, `build` also writes the outputs, `docs` regenerates the
// tunable table in the authoring guide, and `check --verify-artifact` is the repository gate that proves the
// committed outputs and the guide still describe the TOML.
//
// Watching is the Vite plugin's job. Exit codes: 0 clean, 1 content problems (every one
// printed), 2 a usage, config or write error.
//
// `assets` builds the atlases named in `content/atlases.toml` into `<outDir>/atlases/` and the font
// subsets named in `content/fonts.toml` into `<outDir>/fonts/`. It is its own command because it reads image and
// font files the content compile never touches, and its outputs are binary.
//
// Options come from `automata.content.ts` in the working directory (its default export, `ContentConfig`)
// for now; one `automata.config.ts` may replace it. It is loaded through Vite's module runner, so it can be
// TypeScript and import the game's schemas the way the game's own code does.

import { join } from 'node:path'
import { Effect, Either } from 'effect'
import { normalizePath, runnerImport } from 'vite'
import { ATLASES_FOLDER, FONTS_FOLDER } from '../../shared/assets/asset-outputs'
import { buildAtlases } from '../../shared/assets/build-atlases'
import { buildFonts } from '../../shared/assets/build-fonts'
import {
  type CompiledContent,
  type ContentOptions,
  compileContent,
  outDirOf,
} from '../../shared/compile/compile-content'
import type {
  ContentCompileFailed,
  ContentWriteFailed,
  InvalidContentConfig,
} from '../../shared/compile/errors'
import { buildContent, verifyContent } from '../../shared/compile/write-outputs'
import { type Diagnostic, formatDiagnostic } from '../../shared/diagnostics/diagnostic'
import { readTextIfPresent, writeFileAtomically } from '../../shared/files/content-files'
import type { TuningMeta } from '../../shared/tuning/check-tuning'
import { withTuningTable } from '../../shared/tuning/tuning-table'

/** The default export of `automata.content.ts`. */
export type ContentConfig = Omit<ContentOptions, 'root'> & {
  /** The authoring guide whose tunable table `docs` writes and `--verify-artifact` checks. */
  readonly guide?: string | undefined
}

export interface CliIo {
  readonly out: (line: string) => void
  readonly err: (line: string) => void
}

export const CONFIG_FILE = 'automata.content.ts'
const USAGE = 'usage: automata-content <check [--verify-artifact] | build | docs [guide.md] | assets>'
const VERIFY_FLAG = '--verify-artifact'

const consoleIo: CliIo = {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
}

type Command =
  | { readonly name: 'check'; readonly verify: boolean }
  | { readonly name: 'build' }
  | { readonly name: 'docs'; readonly guide: string | undefined }
  | { readonly name: 'assets' }

function parseArgs(argv: readonly string[]): Command | undefined {
  const [name, ...rest] = argv
  if (name === 'check' && rest.every((arg) => arg === VERIFY_FLAG) && rest.length <= 1) {
    return { name, verify: rest.length === 1 }
  }
  if ((name === 'build' || name === 'assets') && rest.length === 0) return { name }
  if (name === 'docs' && rest.length <= 1 && !rest.some((arg) => arg.startsWith('--'))) {
    return { name, guide: rest[0] }
  }
  return undefined
}

async function loadConfig(cwd: string): Promise<{ config: ContentConfig } | { problem: string }> {
  const path = join(cwd, CONFIG_FILE)
  const exists = await Effect.runPromise(Effect.either(readTextIfPresent(path)))
  if (Either.isLeft(exists) || exists.right === undefined) return { problem: `no ${CONFIG_FILE} in ${cwd}` }
  try {
    const { module } = await runnerImport<{ default?: unknown }>(normalizePath(path), {
      root: cwd,
      configFile: false,
      logLevel: 'silent',
    })
    const config = module.default
    if (typeof config !== 'object' || config === null || !Array.isArray((config as ContentConfig).schemas)) {
      return { problem: `${CONFIG_FILE} must export default { schemas: [...] }` }
    }
    return { config: config as ContentConfig }
  } catch (error) {
    return {
      problem: `${CONFIG_FILE} could not be loaded: ${error instanceof Error ? error.message : error}`,
    }
  }
}

type Failure = ContentCompileFailed | InvalidContentConfig | ContentWriteFailed

/** Prints a failed program's reason and gives its exit code. */
function reportFailure(failure: Failure, io: CliIo): number {
  switch (failure._tag) {
    case 'ContentCompileFailed':
      for (const diagnostic of failure.diagnostics) io.err(formatDiagnostic(diagnostic))
      return 1
    case 'InvalidContentConfig':
      io.err(`${CONFIG_FILE}: ${failure.message}`)
      return 2
    case 'ContentWriteFailed':
      io.err(`could not write ${failure.path}: ${String(failure.cause)}`)
      return 2
  }
}

const staleGuide = (file: string, message: string): Diagnostic => ({
  code: 'staleArtifact',
  file,
  line: 1,
  column: 1,
  keyPath: '',
  message,
})

const tuningMetaOf = (compiled: CompiledContent): TuningMeta =>
  JSON.parse(compiled.files.get('tuning-meta.json') ?? '{}') as TuningMeta

/** The guide's problems: missing, without markers, or with a table that differs from the tuning. */
async function verifyGuide(cwd: string, guide: string, meta: TuningMeta): Promise<Diagnostic[]> {
  const read = await Effect.runPromise(Effect.either(readTextIfPresent(join(cwd, guide))))
  const text = Either.isRight(read) ? read.right : undefined
  if (text === undefined) return [staleGuide(guide, `${guide} is missing; run automata-content docs`)]
  const next = withTuningTable(text, meta)
  if (next === undefined) return [staleGuide(guide, `${guide} has no generated-table markers`)]
  if (next !== text) {
    return [staleGuide(guide, `the tunable table in ${guide} is out of date; run automata-content docs`)]
  }
  return []
}

/**
 * Builds the atlases and the font subsets, then writes each output file whole, atlases to `<outDir>/atlases`
 * and fonts to `<outDir>/fonts`. Nothing is written when either build has a problem.
 */
async function writeAssets(options: ContentOptions, io: CliIo): Promise<number> {
  const atlases = await Effect.runPromise(Effect.either(buildAtlases(options.root)))
  if (Either.isLeft(atlases)) return reportFailure(atlases.left, io)
  const fonts = await Effect.runPromise(Effect.either(buildFonts(options)))
  if (Either.isLeft(fonts)) return reportFailure(fonts.left, io)
  const outDir = outDirOf(options)
  const outputs = [
    ...[...atlases.right.files].map(([file, bytes]) => [join(outDir, ATLASES_FOLDER, file), bytes] as const),
    ...[...fonts.right.files].map(([file, bytes]) => [join(outDir, FONTS_FOLDER, file), bytes] as const),
  ]
  for (const [path, bytes] of outputs) {
    const written = await Effect.runPromise(
      Effect.either(writeFileAtomically(join(options.root, path), bytes)),
    )
    if (Either.isLeft(written)) {
      io.err(`could not write ${path}: ${String(written.left.cause)}`)
      return 2
    }
  }
  io.out(`atlases ${atlases.right.files.size} files, fonts ${fonts.right.files.size} files`)
  return 0
}

/** Runs one command in `cwd` and gives its exit code. */
export async function runCli(argv: readonly string[], cwd: string, io: CliIo = consoleIo): Promise<number> {
  const command = parseArgs(argv)
  if (command === undefined) {
    io.err(USAGE)
    return 2
  }
  const loaded = await loadConfig(cwd)
  if ('problem' in loaded) {
    io.err(loaded.problem)
    return 2
  }
  const { guide: configGuide, ...rest } = loaded.config
  const options: ContentOptions = { ...rest, root: cwd }

  if (command.name === 'assets') return writeAssets(options, io)

  const program = command.name === 'build' ? buildContent(options) : compileContent(options)
  const compiled = await Effect.runPromise(Effect.either(program))
  if (Either.isLeft(compiled)) return reportFailure(compiled.left, io)
  for (const warning of compiled.right.warnings) io.err(`warning ${formatDiagnostic(warning)}`)

  if (command.name === 'docs') {
    const guide = command.guide ?? configGuide
    if (guide === undefined) {
      io.err(`docs needs a guide: pass its path or set guide in ${CONFIG_FILE}`)
      return 2
    }
    const read = await Effect.runPromise(Effect.either(readTextIfPresent(join(cwd, guide))))
    const text = Either.isRight(read) ? read.right : undefined
    const next = text === undefined ? undefined : withTuningTable(text, tuningMetaOf(compiled.right))
    if (next === undefined) {
      io.err(`${guide} must exist and hold the generated-table markers`)
      return 1
    }
    if (next !== text) {
      const written = await Effect.runPromise(Effect.either(writeFileAtomically(join(cwd, guide), next)))
      if (Either.isLeft(written)) {
        io.err(`could not write ${guide}: ${String(written.left.cause)}`)
        return 2
      }
    }
    return 0
  }

  if (command.name === 'check' && command.verify) {
    // Both gates are reported before the exit code is chosen, so one run names everything that is stale.
    const verified = await Effect.runPromise(Effect.either(verifyContent(options)))
    const diagnostics: Diagnostic[] = []
    if (Either.isLeft(verified)) {
      if (verified.left._tag !== 'ContentCompileFailed') return reportFailure(verified.left, io)
      diagnostics.push(...verified.left.diagnostics)
    }
    if (configGuide !== undefined)
      diagnostics.push(...(await verifyGuide(cwd, configGuide, tuningMetaOf(compiled.right))))
    for (const diagnostic of diagnostics) io.err(formatDiagnostic(diagnostic))
    if (diagnostics.length > 0) return 1
  }

  io.out(`content ${compiled.right.hash}`)
  return 0
}
