import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseArgs, USAGE } from './cli.ts'
import { BEGIN, END } from './overrides.ts'
import { AF_REPOSITORY } from './sync-core.ts'

// `pnpm core:sync [--repository <url or path>]`: the framework comes from GitHub unless a local clone is named,
// which is how a sync is proved against a checkout on the same machine.

const cli = fileURLToPath(new URL('./cli.ts', import.meta.url))

describe('parseArgs', () => {
  it('fetches from the framework repository on GitHub by default', () => {
    expect(parseArgs([], '/work')).toEqual({ repository: AF_REPOSITORY })
  })

  it('takes a URL as it is', () => {
    for (const url of [
      'https://example.invalid/af.git',
      'ssh://git@example.invalid/af.git',
      'file:///srv/af',
    ]) {
      expect(parseArgs(['--repository', url], '/work')).toEqual({ repository: url })
    }
  })

  it('takes a scp-style ssh address as it is', () => {
    expect(parseArgs(['--repository', 'git@github.com:mcthaydt/automata-framework.git'], '/work')).toEqual({
      repository: 'git@github.com:mcthaydt/automata-framework.git',
    })
  })

  // git runs in .core/af, so a relative path would be read from there.
  it('makes a local path absolute from where the command ran', () => {
    expect(parseArgs(['--repository', '../automata-framework'], '/work/plus')).toEqual({
      repository: resolve('/work/plus', '../automata-framework'),
    })
  })

  it('needs a value after --repository', () => {
    expect(() => parseArgs(['--repository'], '/work')).toThrow(`--repository needs a value\n${USAGE}`)
  })

  // The value goes to `git fetch` as its repository, and git would read a value that starts with "-" as one of its
  // own options (`--upload-pack=<command>` runs a command). The scp-style test lets `--upload-pack=cmd@x:y` through.
  it('rejects a value that git would read as an option', () => {
    for (const value of ['--upload-pack=touch@x:y', '-c', '--force']) {
      expect(() => parseArgs(['--repository', value], '/work')).toThrow(
        `--repository must not start with "-": ${value}\n${USAGE}`,
      )
    }
  })

  it('rejects anything else', () => {
    expect(() => parseArgs(['--force'], '/work')).toThrow(`unknown argument --force\n${USAGE}`)
  })
})

describe('the command', () => {
  it('exits 2 with the usage on a bad argument, before it touches anything', () => {
    const result = spawnSync(process.execPath, [cli, '--force'], { encoding: 'utf8' })
    expect(result.status).toBe(2)
    expect(result.stderr).toContain(`core:sync: unknown argument --force\n${USAGE}`)
  })
})

// The command finds the Plus root two folders above itself, so a copy of tooling/core in a temporary folder syncs
// that folder and never this checkout. The sync fails there before it builds anything.
describe('the command, from a temporary Plus root', () => {
  let root: string
  beforeEach(() => {
    // The real path: Node runs a script from its real path, and macOS's temporary folder is behind a link.
    root = realpathSync(mkdtempSync(join(tmpdir(), 'plus-cli-')))
    const tooling = join(root, 'tooling', 'core')
    mkdirSync(tooling, { recursive: true })
    const here = dirname(cli)
    for (const file of readdirSync(here).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts')))
      copyFileSync(join(here, file), join(tooling, file))
    writeFileSync(join(root, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const command = (args: readonly string[], env: NodeJS.ProcessEnv = process.env) =>
    spawnSync(process.execPath, [join(root, 'tooling', 'core', 'cli.ts'), ...args], {
      cwd: root,
      encoding: 'utf8',
      env,
    })

  it('exits 1 and says why when the sync fails', () => {
    const result = command([])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`core:sync: ${join(root, 'core.ref')} is missing`)
  })

  // pnpm runs a script from the workspace root and names the folder it was started in as INIT_CWD.
  it('reads a relative --repository from the folder pnpm was started in', () => {
    writeFileSync(join(root, 'core.ref'), `${'c'.repeat(40)}\n`)
    writeFileSync(join(root, 'pnpm-workspace.yaml'), `${BEGIN}\n${END}\n`)
    const started = join(root, 'started-here')
    const result = command(['--repository', 'framework'], { ...process.env, INIT_CWD: started })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`from ${join(started, 'framework')}: `)
  })
})
