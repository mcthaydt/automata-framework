import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseArgs, USAGE } from './cli.ts'
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
