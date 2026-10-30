import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { Effect, Either, Layer } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CheckReport } from '../check/check-report.ts'
import { KitSource, KitSourceError } from './kit-source.ts'
import { type AddError, type AddResult, addExitCode, type RunAddOptions, runAdd } from './run-add.ts'

const REPO = 'https://github.com/mcthaydt/automata-plus.git'

/** A repository's files at one tag: path -> text, or `{ link }` for a symbolic link. */
type Tree = Record<string, string | { readonly link: string }>

interface FakeRepository {
  readonly tags: Record<string, Tree>
  /** Fails `tags` (or `clone`) the way git does when the buyer has no access. */
  readonly tagsError?: string
  readonly cloneError?: string
  readonly cloned: string[]
  /** The folders the clones were written to, so a test can see they were removed. */
  readonly clonedInto: string[]
}

const kitJson = (requires: string, files: readonly { from: string; to: string }[]): string =>
  JSON.stringify({ name: 'results-screen', requires: { core: requires }, files })

const RESULTS_KIT: Tree = {
  'README.md': '# Automata Plus\n',
  'results-screen/kit.json': kitJson('>=0.0.1', [
    { from: 'results.screen.ts', to: 'src/ui/results.screen.ts' },
    { from: 'results.toml', to: 'content/ui/results.toml' },
  ]),
  'results-screen/results.screen.ts': 'export const results = 1\n',
  'results-screen/results.toml': 'title = "Results"\n',
  'lobby/kit.json': JSON.stringify({ name: 'lobby', requires: { core: '>=0.0.1' }, files: [] }),
}

function fakeRepository(
  overrides: Partial<Omit<FakeRepository, 'cloned' | 'clonedInto'>> = {},
): FakeRepository {
  return { tags: { 'core-v0.0.2': RESULTS_KIT, 'v9.9.9': {} }, ...overrides, cloned: [], clonedInto: [] }
}

function writeTree(root: string, tree: Tree): void {
  for (const [path, entry] of Object.entries(tree)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    if (typeof entry === 'string') writeFileSync(join(root, path), entry)
    else symlinkSync(entry.link, join(root, path))
  }
}

function kitSource(repository: FakeRepository): Layer.Layer<KitSource> {
  return Layer.succeed(KitSource, {
    tags: (repo) =>
      repository.tagsError === undefined
        ? Effect.succeed(Object.keys(repository.tags))
        : Effect.fail(new KitSourceError({ repo, detail: repository.tagsError })),
    clone: (repo, tag, into) =>
      Effect.suspend(() => {
        if (repository.cloneError !== undefined)
          return Effect.fail(new KitSourceError({ repo, detail: repository.cloneError }))
        repository.cloned.push(tag)
        repository.clonedInto.push(into)
        const tree = repository.tags[tag]
        if (tree === undefined) return Effect.fail(new KitSourceError({ repo, detail: `no tag ${tag}` }))
        mkdirSync(into)
        writeTree(into, tree)
        return Effect.void
      }),
  })
}

/** Every entry below `dir` (folders too) and each file's bytes, so "nothing changed" means exactly that. */
function snapshot(dir: string): Record<string, string> {
  const entries: Record<string, string> = {}
  for (const name of readdirSync(dir, { recursive: true }) as string[]) {
    const path = join(dir, name)
    const stat = lstatSync(path)
    entries[name] = stat.isFile() ? readFileSync(path, 'base64') : stat.isDirectory() ? '<dir>' : '<other>'
  }
  return entries
}

const passing: CheckReport = {
  ok: true,
  steps: [{ name: 'boundaries', ok: true, ms: 1, findings: [], toolError: false }],
}
const failing: CheckReport = {
  ok: false,
  steps: [
    {
      name: 'typecheck',
      ok: false,
      ms: 1,
      toolError: false,
      findings: [{ file: 'src/ui/results.screen.ts', line: 1, col: 1, rule: 'TS2322', message: 'bad' }],
    },
  ],
}

let game: string

beforeEach(() => {
  game = mkdtempSync(join(tmpdir(), 'automata-add-game-'))
  writeTree(game, {
    'node_modules/@mcthaydt/automata/package.json': JSON.stringify({
      name: '@mcthaydt/automata',
      version: '0.0.2',
    }),
    'src/main.ts': 'import "./game.ts"\n',
    'content/ui/title.toml': 'title = "Title"\n',
  })
})

afterEach(() => {
  rmSync(game, { recursive: true, force: true })
})

interface Run {
  readonly outcome: AddResult | AddError
  readonly code: 0 | 1 | 2
  /** The folders `automata check` ran in, and whether the kit's first file was there by then. */
  readonly checks: { readonly gameDir: string; readonly kitFileThere: boolean }[]
}

async function add(
  repository: FakeRepository,
  options: Partial<RunAddOptions> = {},
  report: CheckReport = passing,
): Promise<Run> {
  const checks: { gameDir: string; kitFileThere: boolean }[] = []
  const check = (gameDir: string) =>
    Effect.sync(() => {
      checks.push({ gameDir, kitFileThere: existsSync(join(gameDir, 'src/ui/results.screen.ts')) })
      return report
    })
  const program = runAdd(
    { kit: 'results-screen', gameDir: game, repo: REPO, force: false, ...options },
    check,
  )
  const result = await Effect.runPromise(Effect.either(Effect.provide(program, kitSource(repository))))
  const outcome = Either.isRight(result) ? result.right : result.left
  return { outcome, code: addExitCode(outcome), checks }
}

const errorOf = (run: Run): AddError => {
  if (!('reason' in run.outcome)) throw new Error(`expected a failure, got ${JSON.stringify(run.outcome)}`)
  return run.outcome
}

describe('runAdd', () => {
  it('needs the installed core and names the file it looked for', async () => {
    rmSync(join(game, 'node_modules'), { recursive: true })
    const before = snapshot(game)
    const run = await add(fakeRepository())
    expect(errorOf(run).reason).toBe('no-core')
    expect(errorOf(run).message).toContain(join(game, 'node_modules/@mcthaydt/automata/package.json'))
    expect(run.code).toBe(2)
    expect(snapshot(game)).toEqual(before)
  })

  const notFound = 'remote: Repository not found.\nfatal: repository not found'
  const denied =
    'git@github.com: Permission denied (publickey).\nfatal: Could not read from remote repository.'
  it.each([
    ['listing tags', { tagsError: notFound }, notFound],
    ['cloning', { cloneError: denied }, denied],
  ])(
    'without access (failing while %s) gives the access message, exit 2, and changes no file',
    async (_, failure, detail) => {
      const before = snapshot(game)
      const run = await add(fakeRepository(failure))
      const error = errorOf(run)
      expect(error.reason).toBe('no-access')
      expect(error.message).toContain(`cannot read ${REPO}`)
      expect(error.message).toContain(detail)
      expect(error.message).toContain(
        'Automata Plus kits need read access to the repository, which comes with a purchase',
      )
      expect(run.code).toBe(2)
      expect(run.checks).toEqual([])
      expect(snapshot(game)).toEqual(before)
    },
  )

  it('an unknown kit lists the kits the repository has at that tag', async () => {
    const before = snapshot(game)
    const run = await add(fakeRepository(), { kit: 'pause-screen' })
    expect(errorOf(run).reason).toBe('unknown-kit')
    expect(errorOf(run).message).toBe(
      'there is no kit "pause-screen" at core-v0.0.2; the kits are: lobby, results-screen',
    )
    expect(run.code).toBe(2)
    expect(snapshot(game)).toEqual(before)
  })

  it('a kit that needs a newer core fails before copying, naming both versions', async () => {
    const tree = {
      ...RESULTS_KIT,
      'results-screen/kit.json': kitJson('>=0.0.3', [
        { from: 'results.toml', to: 'content/ui/results.toml' },
      ]),
    }
    const before = snapshot(game)
    const run = await add(fakeRepository({ tags: { 'core-v0.0.2': tree } }))
    expect(errorOf(run).reason).toBe('core-too-old')
    expect(errorOf(run).message).toBe(
      'kit "results-screen" needs core >=0.0.3 and this game has 0.0.2: update @mcthaydt/automata, then run automata add again',
    )
    expect(run.code).toBe(2)
    expect(snapshot(game)).toEqual(before)
  })

  it('a kit.json that is not valid names the kit and the problem', async () => {
    const tree = {
      ...RESULTS_KIT,
      'results-screen/kit.json': kitJson('>=0.0.1', [{ from: 'results.toml', to: '../outside.toml' }]),
    }
    const run = await add(fakeRepository({ tags: { 'core-v0.0.2': tree } }))
    expect(errorOf(run).reason).toBe('bad-manifest')
    expect(errorOf(run).message).toBe(
      'results-screen/kit.json at core-v0.0.2 is not a valid kit: files.0.to must be a relative path inside the folder, with / between names and no . or .. parts',
    )
    const notJson = await add(
      fakeRepository({ tags: { 'core-v0.0.2': { ...RESULTS_KIT, 'results-screen/kit.json': '{' } } }),
    )
    expect(errorOf(notJson).reason).toBe('bad-manifest')
    expect(errorOf(notJson).message).toContain('results-screen/kit.json at core-v0.0.2 is not valid JSON')
  })

  it('refuses a kit file that is missing or is a link, so a kit cannot copy a file from outside itself', async () => {
    const missing = { ...RESULTS_KIT }
    delete missing['results-screen/results.toml']
    const run = await add(fakeRepository({ tags: { 'core-v0.0.2': missing } }))
    expect(errorOf(run).reason).toBe('missing-file')
    expect(errorOf(run).message).toBe(
      'kit "results-screen" lists results.toml, which is not a file in the kit',
    )

    const before = snapshot(game)
    const linked = { ...RESULTS_KIT, 'results-screen/results.toml': { link: join(game, 'src/main.ts') } }
    const link = await add(fakeRepository({ tags: { 'core-v0.0.2': linked } }))
    expect(errorOf(link).reason).toBe('missing-file')
    expect(snapshot(game)).toEqual(before)

    const linkedFolder = {
      ...RESULTS_KIT,
      'results-screen/kit.json': kitJson('>=0.0.1', [{ from: 'assets/main.ts', to: 'src/ui/main.ts' }]),
      'results-screen/assets': { link: join(game, 'src') },
    }
    const throughFolder = await add(fakeRepository({ tags: { 'core-v0.0.2': linkedFolder } }))
    expect(errorOf(throughFolder).message).toBe(
      'kit "results-screen" lists assets/main.ts, which is not a file in the kit',
    )
    expect(snapshot(game)).toEqual(before)

    const folder = {
      ...RESULTS_KIT,
      'results-screen/kit.json': kitJson('>=0.0.1', [{ from: 'assets', to: 'src/ui/assets' }]),
      'results-screen/assets/a.png': 'png',
    }
    const notAFile = await add(fakeRepository({ tags: { 'core-v0.0.2': folder } }))
    expect(errorOf(notAFile).message).toBe(
      'kit "results-screen" lists assets, which is not a file in the kit',
    )
    expect(snapshot(game)).toEqual(before)
  })

  it('refuses to overwrite files the game has, lists them and writes nothing; --force replaces them', async () => {
    writeTree(game, { 'content/ui/results.toml': 'title = "Mine"\n' })
    const before = snapshot(game)
    const run = await add(fakeRepository())
    expect(errorOf(run).reason).toBe('collision')
    expect(errorOf(run).message).toBe(
      "the game already has 1 of the kit's files:\n  content/ui/results.toml\nRun automata add again with --force to replace them.",
    )
    expect(run.code).toBe(2)
    expect(snapshot(game)).toEqual(before)

    const forced = await add(fakeRepository(), { force: true })
    expect(forced.code).toBe(0)
    expect(readFileSync(join(game, 'content/ui/results.toml'), 'utf8')).toBe('title = "Results"\n')
  })

  it('--force still refuses to replace a folder or a link', async () => {
    mkdirSync(join(game, 'content/ui/results.toml'), { recursive: true })
    const before = snapshot(game)
    const run = await add(fakeRepository(), { force: true })
    expect(errorOf(run).reason).toBe('collision')
    expect(errorOf(run).message).toBe(
      'these destinations are not files, so --force does not replace them:\n  content/ui/results.toml',
    )
    expect(snapshot(game)).toEqual(before)
  })

  it('a failure while copying the second file puts the game folder back as it was', async () => {
    // `content` is a file, so the second file's folder cannot be made: a real failure after the first copy.
    rmSync(join(game, 'content'), { recursive: true })
    writeFileSync(join(game, 'content'), 'not a folder\n')
    const before = snapshot(game)
    const run = await add(fakeRepository())
    expect(errorOf(run).reason).toBe('copy-failed')
    expect(errorOf(run).message).toMatch(
      /^could not copy content\/ui\/results\.toml: .+; the game folder was put back as it was$/,
    )
    expect(run.code).toBe(2)
    expect(run.checks).toEqual([])
    expect(snapshot(game)).toEqual(before)
    expect(existsSync(join(game, 'src/ui'))).toBe(false)
  })

  it('a failure while replacing with --force restores the replaced file', async () => {
    writeTree(game, { 'src/ui/results.screen.ts': 'export const mine = 1\n' })
    rmSync(join(game, 'content'), { recursive: true })
    writeFileSync(join(game, 'content'), 'not a folder\n')
    const before = snapshot(game)
    const run = await add(fakeRepository(), { force: true })
    expect(errorOf(run).reason).toBe('copy-failed')
    expect(snapshot(game)).toEqual(before)
  })

  it('copies the files, then runs automata check once in the game, whose report decides exit 0 or 1', async () => {
    const run = await add(fakeRepository())
    expect(run.outcome).toEqual({
      kit: 'results-screen',
      tag: 'core-v0.0.2',
      files: ['src/ui/results.screen.ts', 'content/ui/results.toml'],
      report: passing,
    })
    expect(run.code).toBe(0)
    expect(run.checks).toEqual([{ gameDir: game, kitFileThere: true }])
    expect(readFileSync(join(game, 'src/ui/results.screen.ts'), 'utf8')).toBe('export const results = 1\n')
    expect(readFileSync(join(game, 'content/ui/results.toml'), 'utf8')).toBe('title = "Results"\n')
    expect(readFileSync(join(game, 'content/ui/title.toml'), 'utf8')).toBe('title = "Title"\n')

    rmSync(join(game, 'src/ui'), { recursive: true })
    rmSync(join(game, 'content/ui/results.toml'))
    const failed = await add(fakeRepository(), {}, failing)
    expect(failed.code).toBe(1)
    expect(failed.checks).toHaveLength(1)
    expect(existsSync(join(game, 'src/ui/results.screen.ts'))).toBe(true)
  })

  it('a repository without core-v tags has no kits for any core', async () => {
    const run = await add(fakeRepository({ tags: { main: RESULTS_KIT, 'v1.0.0': RESULTS_KIT } }))
    expect(errorOf(run)).toMatchObject({
      reason: 'no-tag',
      message: 'there are no kits for core 0.0.2: the repository has no core-v<version> tags',
    })
    expect(run.code).toBe(2)
  })

  it('clones the newest core tag at or below the installed core, and removes its clone', async () => {
    const repository = fakeRepository({
      tags: { 'core-v0.0.1': {}, 'core-v0.0.2': RESULTS_KIT, 'core-v0.0.3': {}, 'core-v0.0.10': {} },
    })
    await add(repository)
    expect(repository.cloned).toEqual(['core-v0.0.2'])
    // The clone's own temporary folder, not a listing of tmpdir: other test files add kits at the same time.
    const temporary = dirname(repository.clonedInto[0] as string)
    expect(temporary.startsWith(join(tmpdir(), 'automata-add-kit-'))).toBe(true)
    expect(existsSync(temporary)).toBe(false)
  })
})
