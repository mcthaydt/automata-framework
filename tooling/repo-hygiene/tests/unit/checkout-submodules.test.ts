import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// The step every CI job runs before `pnpm install`. The self-hosted runners keep their work folders, so a submodule an
// earlier job left at another commit must go back to the pinned one; with no token the checkout is emptied, so the
// install says plainly that the submodule is missing instead of building from a stale copy. Real git, local remotes.

const SCRIPT = fileURLToPath(new URL('../../../../.github/scripts/checkout-submodules.sh', import.meta.url))

const git = (cwd: string, ...args: string[]): string =>
  execFileSync(
    'git',
    ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'protocol.file.allow=always', ...args],
    {
      cwd,
      encoding: 'utf8',
    },
  ).trim()

describe('the checkout-submodules step', () => {
  let root = ''
  let work = ''
  let pinned = ''
  let newer = ''

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'af-submodules-'))
    const remote = join(root, 'remote')
    mkdirSync(remote)
    git(remote, 'init', '-q', '-b', 'main')
    writeFileSync(join(remote, 'old.txt'), 'pinned\n')
    git(remote, 'add', '.')
    git(remote, 'commit', '-q', '-m', 'pinned')
    pinned = git(remote, 'rev-parse', 'HEAD')
    writeFileSync(join(remote, 'features.txt'), 'newer\n')
    git(remote, 'add', '.')
    git(remote, 'commit', '-q', '-m', 'newer')
    newer = git(remote, 'rev-parse', 'HEAD')
    git(remote, 'checkout', '-q', pinned)

    work = join(root, 'work')
    mkdirSync(work)
    git(work, 'init', '-q', '-b', 'main')
    git(work, 'submodule', 'add', '-q', remote, 'vendor/Private')
    git(work, 'commit', '-q', '-m', 'pin the submodule')
    // The runner's leftover: the submodule checked out at a newer commit than the pin.
    git(join(work, 'vendor/Private'), 'fetch', '-q', 'origin', 'main')
    git(join(work, 'vendor/Private'), 'checkout', '-q', newer)
  })

  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const run = (token: string): { status: number | null; output: string } => {
    const result = spawnSync('bash', [SCRIPT], {
      cwd: work,
      encoding: 'utf8',
      env: {
        ...process.env,
        SUBMODULES_TOKEN: token,
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'protocol.file.allow',
        GIT_CONFIG_VALUE_0: 'always',
      },
    })
    return { status: result.status, output: `${result.stdout}${result.stderr}` }
  }

  it('puts a stale submodule back on the pinned commit when it has the token', () => {
    expect(git(join(work, 'vendor/Private'), 'rev-parse', 'HEAD')).toBe(newer)
    expect(run('secret').status).toBe(0)
    expect(git(join(work, 'vendor/Private'), 'rev-parse', 'HEAD')).toBe(pinned)
    expect(existsSync(join(work, 'vendor/Private/features.txt'))).toBe(false)
    expect(existsSync(join(work, 'vendor/Private/old.txt'))).toBe(true)
  })

  it('empties the submodule and says so when there is no token, so no job builds from a stale copy', () => {
    const { status, output } = run('')
    expect(status).toBe(0)
    expect(output).toContain('SUBMODULES_TOKEN is not available')
    expect(readdirSync(join(work, 'vendor/Private'))).toEqual([])
  })
})
