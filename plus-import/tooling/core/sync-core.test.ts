import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BEGIN, END } from './overrides.ts'
import { type Git, gitEnv, liveGit, type Shell, syncCore } from './sync-core.ts'

// Test 3 (PRODUCT.5e): `pnpm core:sync` with fakes for git and the shell, in a real temporary Plus folder. It
// skips the framework work when .core/packs/packs.json already records core.ref, runs the four commands in order
// otherwise, and writes the overrides only after every command succeeded.

const COMMIT = 'b7ef19d978d4751eaf08d1374dcfbcf2459d8c2b'
const OTHER = 'c'.repeat(40)
const REPOSITORY = 'https://example.invalid/automata-framework.git'
const PACKED = [
  '@mcthaydt/automata-physics',
  '@mcthaydt/automata-sector-format',
  '@mcthaydt/automata-sim',
  '@mcthaydt/evidence',
]
const WORKSPACE = ['packages:', '  - packages/*', BEGIN, END, ''].join('\n')

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'plus-sync-'))
  writeFileSync(join(root, 'core.ref'), `${COMMIT}\n`)
  writeFileSync(join(root, 'pnpm-workspace.yaml'), WORKSPACE)
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const packsDir = () => join(root, '.core', 'packs')
const afDir = () => join(root, '.core', 'af')
const workspace = () => readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8')

/** Writes what the framework's `pnpm packs --unpack` writes: one folder per pack and packs.json. */
function writePacks(out: string, sourceCommit: string, names: readonly string[] = PACKED): void {
  mkdirSync(out, { recursive: true })
  const packs = names.map((name) => {
    const dir = name.replace(/^@[^/]+\//, '')
    mkdirSync(join(out, dir), { recursive: true })
    writeFileSync(join(out, dir, 'package.json'), JSON.stringify({ name, version: '0.1.0' }))
    return { name, version: '0.1.0', file: `mcthaydt-${dir}-0.1.0.tgz`, sha256: 'a'.repeat(64), dir }
  })
  writeFileSync(join(out, 'packs.json'), JSON.stringify({ sourceCommit, packs }))
}

interface Fakes {
  readonly calls: string[]
  readonly git: Git
  readonly shell: Shell
}

/**
 * Records each call; `packs` writes packs.json as the framework would. `fail` names a call that throws;
 * `missing` names a pack folder that the packing leaves out.
 */
function fakes(options: { fail?: string; packsCommit?: string; missing?: string } = {}): Fakes {
  const calls: string[] = []
  const record = (call: string) => {
    calls.push(call)
    if (call === options.fail) throw new Error(`${call} failed`)
  }
  return {
    calls,
    git: {
      checkout(dir, repository, commit) {
        record(`git checkout ${dir} ${repository} ${commit}`)
      },
    },
    shell: {
      run(command, args, cwd) {
        record(`${command} ${args.join(' ')} @ ${cwd}`)
        if (args[0] !== 'packs') return
        writePacks(args[2] as string, options.packsCommit ?? COMMIT)
        if (options.missing !== undefined) rmSync(join(packsDir(), options.missing), { recursive: true })
      },
    },
  }
}

/** The four commands of a sync that builds, in order. */
const calls = () => [
  `git checkout ${afDir()} ${REPOSITORY} ${COMMIT}`,
  `pnpm install --frozen-lockfile --ignore-scripts @ ${afDir()}`,
  `pnpm build @ ${afDir()}`,
  `pnpm packs --out ${packsDir()} --unpack --extra @mcthaydt/automata-sector-format --extra @mcthaydt/evidence --source-commit ${COMMIT} @ ${afDir()}`,
]

const sync = (fake: Fakes) =>
  syncCore({ root, repository: REPOSITORY, git: fake.git, shell: fake.shell, log: () => {} })

describe('syncCore', () => {
  it('fetches the framework at core.ref, installs, builds and packs it, in that order', () => {
    const fake = fakes()
    const result = sync(fake)
    expect(fake.calls).toEqual(calls())
    expect(result).toEqual({ commit: COMMIT, built: true, packs: 4 })
  })

  it('then points every packed name at its folder', () => {
    sync(fakes())
    expect(workspace()).toContain("  '@mcthaydt/automata-sim': file:.core/packs/automata-sim\n")
    expect(workspace()).toContain("  '@mcthaydt/evidence': file:.core/packs/evidence\n")
    expect(workspace()).toContain(
      "  '@mcthaydt/automata-sector-format': file:.core/packs/automata-sector-format\n",
    )
  })

  it('skips the framework work when packs.json already records core.ref', () => {
    writePacks(packsDir(), COMMIT)
    const fake = fakes()
    expect(sync(fake)).toEqual({ commit: COMMIT, built: false, packs: 4 })
    expect(fake.calls).toEqual([])
  })

  // The names Plus has itself change without core.ref moving (5f adds physics), so a skipped sync still writes the
  // block from the packs.json it already has.
  it('still rewrites the overrides when it skips', () => {
    writePacks(packsDir(), COMMIT)
    sync(fakes())
    expect(workspace()).toContain("'@mcthaydt/automata-sim': file:.core/packs/automata-sim")
  })

  it('rebuilds when packs.json records another commit', () => {
    writePacks(packsDir(), OTHER)
    const fake = fakes()
    expect(sync(fake).built).toBe(true)
    expect(fake.calls).toEqual(calls())
  })

  it('rebuilds when packs.json cannot be read', () => {
    mkdirSync(packsDir(), { recursive: true })
    writeFileSync(join(packsDir(), 'packs.json'), '{')
    const fake = fakes()
    expect(sync(fake).built).toBe(true)
  })

  it.each([
    ['the fetch', 0],
    ['the install', 1],
    ['the build', 2],
    ['the pack', 3],
  ])('stops at a failing %s, before the overrides are written', (_case, index) => {
    const call = calls()[index] as string
    const fake = fakes({ fail: call })
    expect(() => sync(fake)).toThrow(`${call} failed`)
    expect(fake.calls).toEqual(calls().slice(0, index + 1))
    expect(workspace()).toBe(WORKSPACE)
  })

  it('refuses packs that record another commit than core.ref', () => {
    expect(() => sync(fakes({ packsCommit: OTHER }))).toThrow(
      `.core/packs/packs.json records ${OTHER}, but core.ref is ${COMMIT}`,
    )
    expect(workspace()).toBe(WORKSPACE)
  })

  it('refuses packs whose folder is missing and names it', () => {
    expect(() => sync(fakes({ missing: 'evidence' }))).toThrow(
      '.core/packs/evidence is missing (@mcthaydt/evidence)',
    )
    expect(workspace()).toBe(WORKSPACE)
  })

  it('never overrides a package Plus has in packages/', () => {
    mkdirSync(join(root, 'packages', 'physics'), { recursive: true })
    writeFileSync(
      join(root, 'packages', 'physics', 'package.json'),
      JSON.stringify({ name: '@mcthaydt/automata-physics' }),
    )
    sync(fakes())
    expect(workspace()).not.toContain('automata-physics')
    expect(workspace()).toContain("'@mcthaydt/automata-sim'")
  })

  it('fails before any command when core.ref is not a full commit', () => {
    writeFileSync(join(root, 'core.ref'), 'main\n')
    const fake = fakes()
    expect(() => sync(fake)).toThrow('core.ref must hold one full commit')
    expect(fake.calls).toEqual([])
  })

  it('fails before any command when core.ref is missing', () => {
    rmSync(join(root, 'core.ref'))
    const fake = fakes()
    expect(() => sync(fake)).toThrow(`${join(root, 'core.ref')} is missing`)
    expect(fake.calls).toEqual([])
  })

  it('fails before any command when pnpm-workspace.yaml has no block to write', () => {
    writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')
    const fake = fakes()
    expect(() => sync(fake)).toThrow(`pnpm-workspace.yaml has no "${BEGIN}" line`)
    expect(fake.calls).toEqual([])
  })
})

// A machine without access must fail at once: git otherwise waits on the terminal for a user name, and a CI job
// would hang until its timeout. Only a terminal shows the difference, so the environment is pinned here.
describe('gitEnv', () => {
  it('turns git prompts off and keeps the rest of the environment', () => {
    expect(gitEnv({ PATH: '/bin', GIT_TERMINAL_PROMPT: '1' })).toEqual({
      PATH: '/bin',
      GIT_TERMINAL_PROMPT: '0',
    })
  })
})

// The live git port against a real repository on disk: a fetch by commit (what GitHub serves for core.ref) into a
// folder that is new the first time and reused after.
describe('liveGit', () => {
  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], {
      cwd,
      encoding: 'utf8',
    }).trim()

  /** A repository on disk with two commits that each write a.txt: 'one', then 'two'. */
  function twoCommits(): { readonly source: string; readonly first: string; readonly second: string } {
    const source = join(root, 'source')
    mkdirSync(source)
    git(source, 'init', '-q')
    writeFileSync(join(source, 'a.txt'), 'one')
    git(source, 'add', '.')
    git(source, 'commit', '-q', '-m', 'one')
    const first = git(source, 'rev-parse', 'HEAD')
    writeFileSync(join(source, 'a.txt'), 'two')
    git(source, 'commit', '-q', '-am', 'two')
    return { source, first, second: git(source, 'rev-parse', 'HEAD') }
  }

  it('checks the commit out into a new folder, then again into the same folder', () => {
    const { source, first, second } = twoCommits()
    const target = join(root, '.core', 'af')
    liveGit.checkout(target, source, first)
    expect(git(target, 'rev-parse', 'HEAD')).toBe(first)
    expect(readFileSync(join(target, 'a.txt'), 'utf8')).toBe('one')
    liveGit.checkout(target, source, second)
    expect(git(target, 'rev-parse', 'HEAD')).toBe(second)
    expect(readFileSync(join(target, 'a.txt'), 'utf8')).toBe('two')
  })

  // The framework's history is long and only the one commit is built.
  it('fetches the one commit and none of its history', () => {
    const { source, second } = twoCommits()
    const target = join(root, '.core', 'af')
    liveGit.checkout(target, source, second)
    expect(git(target, 'rev-parse', '--is-shallow-repository')).toBe('true')
    expect(git(target, 'rev-list', '--count', 'HEAD')).toBe('1')
  })

  // An earlier install or build can leave a tracked file of .core/af changed; the next core.ref still checks out.
  it('checks the next commit out over a tracked file that changed in the folder', () => {
    const { source, first, second } = twoCommits()
    const target = join(root, '.core', 'af')
    liveGit.checkout(target, source, second)
    writeFileSync(join(target, 'a.txt'), 'changed by a build')
    liveGit.checkout(target, source, first)
    expect(git(target, 'rev-parse', 'HEAD')).toBe(first)
    expect(readFileSync(join(target, 'a.txt'), 'utf8')).toBe('one')
  })

  it('fails on a commit the repository does not have', () => {
    const source = join(root, 'source')
    mkdirSync(source)
    git(source, 'init', '-q')
    expect(() => liveGit.checkout(join(root, '.core', 'af'), source, OTHER)).toThrow(
      `git could not fetch ${OTHER} from ${source}`,
    )
    expect(existsSync(join(root, '.core', 'af', 'a.txt'))).toBe(false)
  })
})
