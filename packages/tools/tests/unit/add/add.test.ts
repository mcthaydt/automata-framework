import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { Effect, Either, Layer } from 'effect'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { KitSourceLive } from '#src/features/add/kit-source.ts'
import { type AddError, type AddResult, runAdd } from '#src/features/add/run-add.ts'
import type { CheckReport } from '#src/features/check/check-report.ts'
import { ProcessRunnerLive } from '../../../src/shared/node/process-runner.ts'

// Test 9 of the PRODUCT.5 plan's 5d: the live git port against a real repository with two core tags, read
// through a file:// URL, so the tag rule (P5-D6) and the shallow clone run as they will against Automata Plus.

/** The test's own git calls: no signing, a fixed author, and none of the GIT_* variables of a calling hook. */
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')))
const git = (cwd: string, ...args: string[]): void => {
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Automata Test',
      '-c',
      'user.email=test@example.invalid',
      '-c',
      'commit.gpgsign=false',
      '-c',
      'tag.gpgsign=false',
      '-c',
      'init.defaultBranch=main',
      ...args,
    ],
    { cwd, env, stdio: 'pipe' },
  )
}

function write(root: string, files: Record<string, string>): void {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
}

const kit = JSON.stringify({
  name: 'results-screen',
  requires: { core: '>=0.0.1' },
  files: [{ from: 'results.toml', to: 'content/ui/results.toml' }],
})

let scratch: string
let repo: string
let game: string
const savedGitVariables: Record<string, string | undefined> = {}

beforeAll(() => {
  // The live port starts git with this process's environment; a hook's GIT_DIR would point it at another repository.
  for (const key of Object.keys(process.env).filter((name) => name.startsWith('GIT_'))) {
    savedGitVariables[key] = process.env[key]
    delete process.env[key]
  }
  scratch = mkdtempSync(join(tmpdir(), 'automata-add-integration-'))
  const work = join(scratch, 'work')
  mkdirSync(work)
  git(work, 'init', '--quiet')
  write(work, {
    'README.md': '# Plus\n',
    'results-screen/kit.json': kit,
    'results-screen/results.toml': 'kit = 1\n',
  })
  git(work, 'add', '.')
  git(work, 'commit', '--quiet', '-m', 'kits for core 0.0.1')
  git(work, 'tag', 'core-v0.0.1')
  write(work, { 'results-screen/results.toml': 'kit = 2\n' })
  git(work, 'commit', '--quiet', '-am', 'kits for core 0.0.2')
  git(work, 'tag', 'core-v0.0.2')
  git(scratch, 'clone', '--quiet', '--bare', work, 'plus.git')
  repo = `file://${join(scratch, 'plus.git')}`
})

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true })
  for (const [key, value] of Object.entries(savedGitVariables))
    if (value !== undefined) process.env[key] = value
})

beforeEach(() => {
  game = mkdtempSync(join(scratch, 'game-'))
})

const passing: CheckReport = {
  ok: true,
  steps: [{ name: 'boundaries', ok: true, ms: 1, findings: [], toolError: false }],
}

async function addWithCore(version: string, from: string = repo): Promise<AddResult | AddError> {
  write(game, {
    'node_modules/@mcthaydt/automata/package.json': JSON.stringify({ name: '@mcthaydt/automata', version }),
  })
  const program = runAdd({ kit: 'results-screen', gameDir: game, repo: from, force: false }, () =>
    Effect.succeed(passing),
  )
  const result = await Effect.runPromise(
    Effect.either(Effect.provide(program, Layer.provide(KitSourceLive, ProcessRunnerLive))),
  )
  return Either.isRight(result) ? result.right : result.left
}

const copied = (): string => readFileSync(join(game, 'content/ui/results.toml'), 'utf8')

describe('automata add against a real git repository', () => {
  it('installed core 0.0.2 gets the kit at core-v0.0.2', async () => {
    expect(await addWithCore('0.0.2')).toMatchObject({
      tag: 'core-v0.0.2',
      files: ['content/ui/results.toml'],
    })
    expect(copied()).toBe('kit = 2\n')
  })

  it('installed core 0.0.3 gets the newest tag below it, core-v0.0.2', async () => {
    expect(await addWithCore('0.0.3')).toMatchObject({ tag: 'core-v0.0.2' })
    expect(copied()).toBe('kit = 2\n')
  })

  it('installed core 0.0.1 gets core-v0.0.1, not the newer kit', async () => {
    expect(await addWithCore('0.0.1')).toMatchObject({ tag: 'core-v0.0.1' })
    expect(copied()).toBe('kit = 1\n')
  })

  it('installed core 0.0.0 is older than every tag: an error naming the tags', async () => {
    const outcome = await addWithCore('0.0.0')
    expect(outcome).toMatchObject({
      reason: 'no-tag',
      message: "there are no kits for core 0.0.0: the repository's core tags are core-v0.0.1, core-v0.0.2",
    })
  })

  it("a repository git cannot read is the access message with git's own words", async () => {
    const missing = `file://${join(scratch, 'not-there.git')}`
    const outcome = await addWithCore('0.0.2', missing)
    expect(outcome).toMatchObject({ reason: 'no-access' })
    expect((outcome as AddError).message).toContain(`cannot read ${missing}: fatal:`)
    expect((outcome as AddError).message).toContain('does not appear to be a git repository')
  })
})
