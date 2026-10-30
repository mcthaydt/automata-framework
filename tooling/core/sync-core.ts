import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCoreRef } from './core-ref.ts'
import { plusPackageNames } from './manifest-rules.ts'
import { blockLines, type CorePacks, parsePacks, writeOverrides } from './overrides.ts'

// `pnpm core:sync` (PRODUCT.5, P5-D1): until core is on a registry, Plus builds it from the framework at the commit
// in core.ref and installs the packs. The framework is fetched into .core/af with the machine's own git
// credentials, installed, built and packed into .core/packs by its own core-packs tool, and then the overrides in
// pnpm-workspace.yaml point each core name at its folder. It runs before `pnpm install`, so it imports nothing but
// Node and the files next to it.

/** Where the framework comes from unless `--repository` says otherwise. */
export const AF_REPOSITORY = 'https://github.com/mcthaydt/automata-framework.git'
/** A private framework tool that Plus needs packed as well as the published packages (core-packs `--extra`). */
const EXTRAS = ['@mcthaydt/evidence']

export interface Git {
  /** Makes `dir` a checkout of `commit` from `repository`, creating it the first time. */
  checkout(dir: string, repository: string, commit: string): void
}

export interface Shell {
  /** Runs a command to completion; throws when it fails. */
  run(command: string, args: readonly string[], cwd: string): void
}

export interface SyncOptions {
  /** The Plus root. */
  readonly root: string
  readonly repository: string
  readonly git: Git
  readonly shell: Shell
  readonly log: (line: string) => void
}

export interface SyncResult {
  readonly commit: string
  /** False when .core/packs already held packs of core.ref and the framework work was skipped. */
  readonly built: boolean
  readonly packs: number
}

function readText(path: string): string {
  if (!existsSync(path)) throw new Error(`${path} is missing`)
  return readFileSync(path, 'utf8')
}

/** The packs already in .core/packs, or undefined when there are none or they cannot be read (then they are rebuilt). */
function recordedPacks(packsJson: string): CorePacks | undefined {
  try {
    return parsePacks(readFileSync(packsJson, 'utf8'))
  } catch {
    return undefined
  }
}

export function syncCore(options: SyncOptions): SyncResult {
  const commit = parseCoreRef(readText(join(options.root, 'core.ref')))
  const workspaceFile = join(options.root, 'pnpm-workspace.yaml')
  // Checked now rather than after a build of several minutes.
  blockLines(readText(workspaceFile))

  const afDir = join(options.root, '.core', 'af')
  const packsDir = join(options.root, '.core', 'packs')
  const packsJson = join(packsDir, 'packs.json')
  const built = recordedPacks(packsJson)?.sourceCommit !== commit
  if (built) {
    options.log(`core:sync: fetching the framework at ${commit} from ${options.repository}`)
    options.git.checkout(afDir, options.repository, commit)
    options.log('core:sync: installing, building and packing it')
    options.shell.run('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'], afDir)
    options.shell.run('pnpm', ['build'], afDir)
    const extras = EXTRAS.flatMap((name) => ['--extra', name])
    options.shell.run(
      'pnpm',
      ['packs', '--out', packsDir, '--unpack', ...extras, '--source-commit', commit],
      afDir,
    )
  } else {
    options.log(`core:sync: .core/packs already holds the packs of ${commit}`)
  }

  const packs = parsePacks(readText(packsJson))
  if (packs.sourceCommit !== commit)
    throw new Error(`.core/packs/packs.json records ${packs.sourceCommit}, but core.ref is ${commit}`)
  for (const pack of packs.packs) {
    if (!existsSync(join(packsDir, pack.dir, 'package.json')))
      throw new Error(`.core/packs/${pack.dir} is missing (${pack.name})`)
  }
  const yaml = readFileSync(workspaceFile, 'utf8')
  const written = writeOverrides(yaml, packs, plusPackageNames(options.root))
  if (written !== yaml) writeFileSync(workspaceFile, written)
  options.log(`core:sync: ${packs.packs.length} packs of ${commit}; pnpm-workspace.yaml points core at them`)
  return { commit, built, packs: packs.packs.length }
}

/** `base` with git's prompts off, so a machine without access fails at once instead of waiting for a user name. */
export const gitEnv = (base: NodeJS.ProcessEnv): NodeJS.ProcessEnv => ({ ...base, GIT_TERMINAL_PROMPT: '0' })

/** Git with the machine's own credentials (its credential helper), never a token from this repository. */
export const liveGit: Git = {
  checkout(dir, repository, commit) {
    const git = (args: readonly string[]): string =>
      execFileSync('git', [...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: gitEnv(process.env),
      })
    if (!existsSync(join(dir, '.git'))) {
      mkdirSync(dir, { recursive: true })
      git(['init', '-q', dir])
    }
    try {
      // A fetch by commit: GitHub serves any commit reachable from a branch, and nothing else moves the checkout.
      git(['-C', dir, 'fetch', '-q', '--depth', '1', '--no-tags', repository, commit])
    } catch (error) {
      const detail = (error as { stderr?: string }).stderr?.trim() ?? String(error)
      throw new Error(`git could not fetch ${commit} from ${repository}: ${detail}`)
    }
    git(['-C', dir, 'checkout', '-q', '--force', '--detach', commit])
  },
}

/** Runs a command with its output on this process's terminal, so a long build shows its progress. */
export const liveShell: Shell = {
  run(command, args, cwd) {
    execFileSync(command, [...args], { cwd, stdio: 'inherit' })
  },
}
