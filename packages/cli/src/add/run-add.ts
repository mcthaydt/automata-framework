import { mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import type { TaggedErrorClass } from '@mcthaydt/automata-node'
import { Data, Effect, type Scope } from 'effect'
import { compare, maxSatisfying, satisfies, valid } from 'semver'
import { type CheckReport, exitCodeFor } from '../check/check-report.ts'
import { type KitManifest, kitManifestSchema } from './kit-manifest.schema.ts'
import { KitSource, type KitSourceError } from './kit-source.ts'
import { entryKind, type Placement, placeFiles } from './place-files.ts'

// `automata add <kit>` (PRODUCT spec §9, PRODUCT.5 plan 5d): read the installed core version, clone the Plus
// repository at the matching `core-v<version>` tag (P5-D6), check the kit before touching the game, copy its files
// as one change, then run `automata check`. The add itself runs nothing from the kit, but the check after it runs
// the kit's tests and loads any config the kit adds (a `vite.config.ts`, say): once copied, a kit is trusted code.
// The path rules in `kit-manifest.schema.ts` keep a kit out of `.git` and `node_modules`; they are not a sandbox.

export interface RunAddOptions {
  readonly kit: string
  /** Absolute path of the game folder. */
  readonly gameDir: string
  /** The kit repository, as `git clone` takes it. */
  readonly repo: string
  /** Replace files the game already has. */
  readonly force: boolean
}

export interface AddResult {
  readonly kit: string
  /** The repository tag the kit was copied from. */
  readonly tag: string
  /** The files written, relative to the game folder, in the kit's order. */
  readonly files: readonly string[]
  /** `automata check` on the game after the copy. */
  readonly report: CheckReport
}

/**
 * Why `automata add` stopped. Every one is exit 2 and leaves the game folder as it was; only if undoing a failed
 * copy itself fails does `copy-failed` name the paths it could not put back.
 */
export type AddFailure =
  | 'no-core'
  | 'no-access'
  | 'no-tag'
  | 'unknown-kit'
  | 'bad-manifest'
  | 'core-too-old'
  | 'missing-file'
  | 'collision'
  | 'copy-failed'

const AddErrorBase: TaggedErrorClass<'AddError', { readonly reason: AddFailure; readonly message: string }> =
  Data.TaggedError('AddError')

export class AddError extends AddErrorBase {}

/**
 * 0 added and checked, 1 added and `automata check` found problems, 2 either not added (an `AddError`, with the
 * game folder as it was) or added and a check step could not run (`exitCodeFor`), in which case the kit stays.
 */
export function addExitCode(outcome: AddResult | AddError): 0 | 1 | 2 {
  return outcome instanceof AddError ? 2 : exitCodeFor(outcome.report)
}

const fail = (reason: AddFailure, message: string): Effect.Effect<never, AddError> =>
  Effect.fail(new AddError({ reason, message }))

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

const CORE_PACKAGE = join('node_modules', '@mcthaydt', 'automata', 'package.json')

/** The game's installed `@mcthaydt/automata` version: the core the kit has to match. */
function installedCore(gameDir: string): Effect.Effect<string, AddError> {
  const path = join(gameDir, CORE_PACKAGE)
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return fail(
      'no-core',
      `${path} was not found: install @mcthaydt/automata in the game, then run automata add again`,
    )
  }
  let version: unknown
  try {
    version = (JSON.parse(text) as { version?: unknown }).version
  } catch {
    version = undefined
  }
  // `valid` returns the version without build metadata (`1.0.0+abc` is `1.0.0`), which semver never orders by.
  const parsed = typeof version === 'string' ? valid(version) : null
  return parsed === null ? fail('no-core', `${path} does not name a version`) : Effect.succeed(parsed)
}

const noAccess = (error: KitSourceError): AddError =>
  new AddError({
    reason: 'no-access',
    message:
      `cannot read ${error.repo}: ${error.detail}\n` +
      'Automata Plus kits need read access to the repository, which comes with a purchase. ' +
      `Check that \`git ls-remote ${error.repo}\` works with your git credentials.`,
  })

const TAG_PREFIX = 'core-v'

/**
 * P5-D6: the repository tags `core-v<version>` for each core version its kits were tested against; the kit
 * comes from the greatest such tag at or below the installed core. Pre-release cores (`1.0.0-rc.1`) count.
 */
function coreTagFor(tags: readonly string[], installed: string): Effect.Effect<string, AddError> {
  const versions = tags
    .filter((tag) => tag.startsWith(TAG_PREFIX))
    .map((tag) => tag.slice(TAG_PREFIX.length))
    .filter((version) => valid(version) === version)
    .sort(compare)
  const chosen = maxSatisfying(versions, `<=${installed}`, { includePrerelease: true })
  if (chosen !== null) return Effect.succeed(`${TAG_PREFIX}${chosen}`)
  const tagged = versions.map((version) => `${TAG_PREFIX}${version}`).join(', ')
  return fail(
    'no-tag',
    `there are no kits for core ${installed}: ${versions.length === 0 ? 'the repository has no core-v<version> tags' : `the repository's core tags are ${tagged}`}`,
  )
}

/** Every folder of the clone with a `kit.json`, sorted: what an unknown kit name is told. */
function kitsIn(cloneDir: string): string[] {
  return readdirSync(cloneDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entryKind(join(cloneDir, entry.name, 'kit.json')) === 'file')
    .map((entry) => entry.name)
    .sort()
}

function readKit(cloneDir: string, kit: string, tag: string): Effect.Effect<KitManifest, AddError> {
  const where = `${kit}/kit.json at ${tag}`
  if (entryKind(join(cloneDir, kit, 'kit.json')) !== 'file') {
    const kits = kitsIn(cloneDir)
    return fail(
      'unknown-kit',
      `there is no kit "${kit}" at ${tag}; ${kits.length === 0 ? 'the repository has no kits there' : `the kits are: ${kits.join(', ')}`}`,
    )
  }
  let json: unknown
  try {
    json = JSON.parse(readFileSync(join(cloneDir, kit, 'kit.json'), 'utf8'))
  } catch (error) {
    return fail('bad-manifest', `${where} is not valid JSON: ${messageOf(error)}`)
  }
  const parsed = kitManifestSchema.safeParse(json)
  if (parsed.success)
    return parsed.data.name === kit
      ? Effect.succeed(parsed.data)
      : fail('bad-manifest', `${where} names the kit "${parsed.data.name}", not "${kit}"`)
  const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`)
  return fail('bad-manifest', `${where} is not a valid kit: ${problems.join('; ')}`)
}

/**
 * Each kit file as a staged source. A source must be a plain file inside the kit's own folder once links are
 * resolved: git checks links out as links, and a link (or a linked folder) would copy a file from outside the kit,
 * such as the buyer's own credentials, into the game.
 */
function stagedSources(
  cloneDir: string,
  manifest: KitManifest,
  kit: string,
): Effect.Effect<Placement[], AddError> {
  const kitFolder = `${join(realpathSync(cloneDir), kit)}${sep}`
  const placements: Placement[] = []
  for (const file of manifest.files) {
    const source = join(cloneDir, kit, file.from)
    let inside = false
    if (entryKind(source) === 'file') {
      try {
        inside = realpathSync(source).startsWith(kitFolder)
      } catch {
        inside = false
      }
    }
    if (!inside)
      return fail('missing-file', `kit "${kit}" lists ${file.from}, which is not a file in the kit`)
    placements.push({ source, destination: file.to })
  }
  return Effect.succeed(placements)
}

/** Without `--force` the game's own files win; with it, only plain files are replaced (never a folder or link). */
function refuseCollisions(
  gameDir: string,
  manifest: KitManifest,
  force: boolean,
): Effect.Effect<void, AddError> {
  const taken = manifest.files
    .map((file) => file.to)
    .filter((to) => entryKind(join(gameDir, to)) !== 'missing')
  const list = (paths: readonly string[]): string => paths.map((path) => `  ${path}`).join('\n')
  if (!force && taken.length > 0)
    return fail(
      'collision',
      `the game already has ${taken.length} of the kit's files:\n${list(taken)}\nRun automata add again with --force to replace them.`,
    )
  const notFiles = taken.filter((to) => entryKind(join(gameDir, to)) === 'other')
  if (notFiles.length > 0)
    return fail(
      'collision',
      `these destinations are not files, so --force does not replace them:\n${list(notFiles)}`,
    )
  return Effect.void
}

function copyIntoGame(
  gameDir: string,
  placements: readonly Placement[],
  backupDir: string,
): Effect.Effect<void, AddError> {
  return Effect.suspend(() => {
    const outcome = placeFiles(gameDir, placements, backupDir)
    if (outcome.ok) return Effect.void
    const restored =
      outcome.notRestored.length === 0
        ? 'the game folder was put back as it was'
        : `these could not be put back: ${outcome.notRestored.join(', ')}`
    return fail('copy-failed', `could not copy ${outcome.failed}: ${outcome.cause}; ${restored}`)
  })
}

/** A temporary folder for the clone and the backups, removed when the copy is done or has failed. */
const temporaryFolder: Effect.Effect<string, AddError, Scope.Scope> = Effect.acquireRelease(
  Effect.try({
    try: () => mkdtempSync(join(tmpdir(), 'automata-add-kit-')),
    catch: (error) =>
      new AddError({
        reason: 'copy-failed',
        message: `could not make a temporary folder: ${messageOf(error)}`,
      }),
  }),
  (folder) => Effect.sync(() => rmSync(folder, { recursive: true, force: true })),
)

/**
 * Adds a kit to a game, then runs `checkGame` (`automata check` in the CLI) once in the game folder. Every check
 * of the kit (its tag, manifest, `requires.core`, sources and destinations) happens before the first file is
 * written, and a failure while copying puts the game folder back as it was.
 */
export function runAdd<R>(
  options: RunAddOptions,
  checkGame: (gameDir: string) => Effect.Effect<CheckReport, never, R>,
): Effect.Effect<AddResult, AddError, KitSource | R> {
  return Effect.gen(function* () {
    const source = yield* KitSource
    const installed = yield* installedCore(options.gameDir)
    const tags = yield* Effect.mapError(source.tags(options.repo), noAccess)
    const tag = yield* coreTagFor(tags, installed)
    const files = yield* Effect.scoped(
      Effect.gen(function* () {
        const temporary = yield* temporaryFolder
        const cloneDir = join(temporary, 'repository')
        yield* Effect.mapError(source.clone(options.repo, tag, cloneDir), noAccess)
        const manifest = yield* readKit(cloneDir, options.kit, tag)
        if (!satisfies(installed, manifest.requires.core, { includePrerelease: true }))
          return yield* fail(
            'core-too-old',
            `kit "${options.kit}" needs core ${manifest.requires.core} and this game has ${installed}: update @mcthaydt/automata, then run automata add again`,
          )
        const placements = yield* stagedSources(cloneDir, manifest, options.kit)
        yield* refuseCollisions(options.gameDir, manifest, options.force)
        yield* copyIntoGame(options.gameDir, placements, join(temporary, 'backup'))
        return manifest.files.map((file) => file.to)
      }),
    )
    const report = yield* checkGame(options.gameDir)
    return { kit: options.kit, tag, files, report }
  })
}
