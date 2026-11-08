import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { runCli } from '#src/app/cli.ts'
import type { Git } from '#src/shared/create-game/start-history.ts'
import { parseCliArgs } from '#src/shared/ship/cli-args.ts'

// What a game author can run. The command holds the five things they need, and anything else says so and shows the
// help instead of being taken for a folder name to make a game in (`automata add` once did exactly that).

async function cli(args: string[], threeD?: boolean, git?: Git) {
  let stdout = ''
  let stderr = ''
  const code = await runCli(
    args,
    { stdout: (msg) => (stdout += msg), stderr: (msg) => (stderr += msg) },
    undefined,
    undefined,
    undefined,
    threeD,
    git,
  )
  return { code, stdout, stderr }
}

describe('the commands', () => {
  it('--help names create-game, check, build, editor and ship, and nothing that left', async () => {
    const { code, stdout } = await cli(['--help'])
    expect(code).toBe(0)
    for (const command of ['create-game', 'check', 'build', 'editor', 'ship']) {
      expect(stdout).toContain(`  ${command}`)
    }
    expect(stdout).not.toMatch(/\badd\b|deploy-dev|test-remote/)
  })

  it.each(['add', 'deploy-dev', 'test-remote', 'my-game'])(
    '%s is an unknown command: exit 2, the help, no folder made',
    async (word) => {
      const { code, stdout, stderr } = await cli([word, 'kit'])
      expect(code).toBe(2)
      expect(stderr).toContain(`Unknown command "${word}".`)
      expect(stderr).toContain('Usage: automata <command>')
      expect(stdout).toBe('')
    },
  )

  it('no command at all shows the help', async () => {
    const { code, stdout } = await cli([])
    expect(code).toBe(0)
    expect(stdout).toContain('Usage: automata <command>')
  })

  it.each(['deploy-dev', 'test-remote'])('automata ship %s is an unknown ship command', (word) => {
    expect(parseCliArgs([word])).toEqual({ command: 'usage', problem: `unknown command: ${word}` })
  })
})

describe('create-game --template', () => {
  it('lists 3d in its help only where the 3D package is found', async () => {
    expect((await cli(['create-game', '--help'], true)).stdout).toContain('--template <2d|3d>')
    const without = (await cli(['create-game', '--help'], false)).stdout
    expect(without).not.toContain('3d')
    expect(without).not.toContain('--template')
  })

  it('refuses 3d without the package, in the sentence the spec gives, with exit 1', async () => {
    const target = join(tmpdir(), 'af-never-made-3d')
    const { code, stderr } = await cli(['create-game', target, '--template', '3d'], false)
    expect(code).toBe(1)
    expect(existsSync(target)).toBe(false)
    expect(stderr).toContain(
      '3D games need a package that is not public yet. For now, make a 2D game: leave out --template.',
    )
  })

  it('refuses a template it does not know, naming the allowed ones', async () => {
    const target = join(tmpdir(), 'af-never-made-4d')
    const { code, stderr } = await cli(['create-game', target, '--template', '4d'], true)
    expect(code).toBe(1)
    expect(existsSync(target)).toBe(false)
    expect(stderr).toContain('--template: unknown template "4d" (allowed: 2d, 3d)')
  })
})

describe('create-game and git', () => {
  const folders: string[] = []
  afterAll(() => {
    for (const folder of folders) rmSync(folder, { recursive: true, force: true })
  })

  /** A new folder to make a game in, and the git commands a run asked for (what a fake git answers is `answer`). */
  async function make(
    extra: string[],
    answer: (args: readonly string[]) => { code: number } | 'missing' = (args) =>
      args[0] === 'rev-parse' ? { code: 128 } : { code: 0 },
  ) {
    const base = mkdtempSync(join(tmpdir(), 'af-create-git-'))
    folders.push(base)
    const calls: string[][] = []
    const git: Git = async (_cwd, args) => {
      calls.push([...args])
      return answer(args)
    }
    const result = await cli(['create-game', join(base, 'my-game'), ...extra], false, git)
    return { ...result, calls }
  }

  it('makes a repository with a first commit named for the game', async () => {
    const { code, calls } = await make([])
    expect(code).toBe(0)
    expect(calls).toEqual([
      ['rev-parse', '--is-inside-work-tree'],
      ['init'],
      ['add', '-A'],
      ['commit', '-m', 'Start My Game'],
    ])
  })

  it('--no-git makes none', async () => {
    const { code, calls } = await make(['--no-git'])
    expect(code).toBe(0)
    expect(calls).toEqual([])
  })

  it('leaves a game inside someone else’s repository alone', async () => {
    const { code, calls } = await make([], () => ({ code: 0 }))
    expect(code).toBe(0)
    expect(calls).toEqual([['rev-parse', '--is-inside-work-tree']])
  })

  it('without git it says so and the game is still made', async () => {
    const { code, stdout } = await make([], () => 'missing')
    expect(code).toBe(0)
    expect(stdout).toContain('Created "My Game"')
    expect(stdout).toContain("Git isn't installed, so the game has no history yet.")
  })

  it('a commit that fails leaves the repository and says how to commit', async () => {
    const { code, stdout } = await make([], (args) =>
      args[0] === 'commit' ? { code: 128 } : args[0] === 'rev-parse' ? { code: 128 } : { code: 0 },
    )
    expect(code).toBe(0)
    expect(stdout).toContain('To save this first version: git add -A && git commit -m "Start"')
  })

  it('--no-git is in the help', async () => {
    expect((await cli(['create-game', '--help'])).stdout).toContain('--no-git')
  })
})
