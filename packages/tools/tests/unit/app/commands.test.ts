import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runCli } from '#src/app/cli.ts'
import { parseCliArgs } from '#src/shared/ship/cli-args.ts'

// What a game author can run. The command holds the five things they need, and anything else says so and shows the
// help instead of being taken for a folder name to make a game in (`automata add` once did exactly that).

async function cli(args: string[], threeD?: boolean) {
  let stdout = ''
  let stderr = ''
  const code = await runCli(
    args,
    { stdout: (msg) => (stdout += msg), stderr: (msg) => (stderr += msg) },
    undefined,
    undefined,
    undefined,
    threeD,
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
