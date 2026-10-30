import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseArgs, runCli } from './bin.ts'
import type { CheckReport } from './check/check-report.ts'
import type { RunCheckOptions } from './check/run-check.ts'

describe('bin cli', () => {
  const testDir = join(process.cwd(), 'scratch-cli-test-game')

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('parseArgs', () => {
    it('parses target directory with default id and title', () => {
      const parsed = parseArgs(['my-test-game'])
      expect(parsed.targetDir).toBe('my-test-game')
      expect(parsed.id).toBeUndefined()
      expect(parsed.title).toBeUndefined()
      expect(parsed.help).toBe(false)
    })

    it('parses subcommand create-game and options', () => {
      const parsed = parseArgs(['create-game', 'my-dir', '--id', 'custom-id', '--title', 'Custom Title'])
      expect(parsed.targetDir).toBe('my-dir')
      expect(parsed.id).toBe('custom-id')
      expect(parsed.title).toBe('Custom Title')
    })

    it('detects help flags', () => {
      expect(parseArgs(['--help']).help).toBe(true)
      expect(parseArgs(['-h']).help).toBe(true)
    })
  })

  describe('runCli', () => {
    it('scaffolds game when given valid arguments', async () => {
      let stdout = ''
      let stderr = ''
      const code = await runCli(['create-game', testDir, '--id', 'my-cli-game', '--title', 'My CLI Game'], {
        stdout: (msg) => {
          stdout += msg
        },
        stderr: (msg) => {
          stderr += msg
        },
      })

      expect(code).toBe(0)
      expect(stderr).toBe('')
      expect(stdout).toContain('Created game "My CLI Game" (my-cli-game)')
      expect(existsSync(join(testDir, 'package.json'))).toBe(true)
    })

    it('returns exit code 1 on missing target dir', async () => {
      let stderr = ''
      const code = await runCli([], {
        stdout: () => {},
        stderr: (msg) => {
          stderr += msg
        },
      })

      expect(code).toBe(1)
      expect(stderr).toContain('target directory is required')
    })

    it('returns exit code 1 on invalid id', async () => {
      let stderr = ''
      const code = await runCli([testDir, '--id', 'INVALID_ID'], {
        stdout: () => {},
        stderr: (msg) => {
          stderr += msg
        },
      })

      expect(code).toBe(1)
      expect(stderr).toContain('Invalid game id')
    })
  })

  describe('check', () => {
    const report: CheckReport = {
      ok: false,
      steps: [
        {
          name: 'boundaries',
          ok: false,
          ms: 4,
          toolError: false,
          findings: [{ file: 'src/sim/a.ts', line: 1, col: 1, rule: 'import', message: 'no effect' }],
        },
      ],
    }

    async function runCheckCli(args: string[], result: CheckReport = report) {
      let stdout = ''
      let stderr = ''
      const calls: RunCheckOptions[] = []
      const code = await runCli(
        args,
        {
          stdout: (msg) => {
            stdout += msg
          },
          stderr: (msg) => {
            stderr += msg
          },
        },
        async (options) => {
          calls.push(options)
          return result
        },
      )
      return { code, stdout, stderr, calls }
    }

    it('runs the check in the given folder and prints only the JSON with --json', async () => {
      const { code, stdout, calls } = await runCheckCli([
        'check',
        'games/x',
        '--json',
        '--csp',
        '--fail-fast',
      ])
      expect(calls).toEqual([
        { gameDir: join(process.cwd(), 'games/x'), simOnly: false, csp: true, failFast: true },
      ])
      expect(JSON.parse(stdout)).toEqual({
        ok: false,
        steps: [{ name: 'boundaries', ok: false, ms: 4, findings: report.steps[0]?.findings }],
      })
      expect(code).toBe(1)
    })

    it('prints a readable report without --json and exits 0 on a pass', async () => {
      const passing: CheckReport = {
        ok: true,
        steps: [{ name: 'typecheck', ok: true, ms: 3, findings: [], toolError: false }],
      }
      const { code, stdout, calls } = await runCheckCli(['check', '--sim-only'], passing)
      expect(calls[0]).toMatchObject({ gameDir: process.cwd(), simOnly: true, csp: false })
      expect(stdout).toContain('pass  typecheck (3 ms)')
      expect(code).toBe(0)
    })

    it("the help names each of check's steps", async () => {
      const { code, stdout, calls } = await runCheckCli(['--help'])
      expect(code).toBe(0)
      expect(calls).toEqual([])
      const help = stdout.replace(/\s+/g, ' ')
      const steps = ['boundaries', 'typecheck', 'tests', 'boards', 'orientation', 'inputs', 'no-eval']
      for (const step of [...steps, 'secrets', 'data-urls', '--csp']) expect(help).toContain(step)
    })

    it('a usage error is exit 2 and runs nothing', async () => {
      const { code, stderr, calls } = await runCheckCli(['check', '--bogus'])
      expect(code).toBe(2)
      expect(stderr).toContain('unknown option --bogus')
      expect(calls).toEqual([])
    })
  })
})
