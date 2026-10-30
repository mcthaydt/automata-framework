import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PLUS_REPOSITORY } from './add/add-args.ts'
import { AddError, type AddResult, type RunAddOptions } from './add/run-add.ts'
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

    it('a usage error is exit 2 and runs nothing', async () => {
      const { code, stderr, calls } = await runCheckCli(['check', '--bogus'])
      expect(code).toBe(2)
      expect(stderr).toContain('unknown option --bogus')
      expect(calls).toEqual([])
    })
  })

  describe('add', () => {
    const added = (report: CheckReport): AddResult => ({
      kit: 'results-screen',
      tag: 'core-v0.0.2',
      files: ['src/ui/results.screen.ts', 'content/ui/results.toml'],
      report,
    })
    const passing: CheckReport = {
      ok: true,
      steps: [{ name: 'boundaries', ok: true, ms: 2, findings: [], toolError: false }],
    }

    async function runAddCli(args: string[], outcome: AddResult | AddError) {
      let stdout = ''
      let stderr = ''
      const calls: RunAddOptions[] = []
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
        async () => {
          throw new Error('automata add runs its own check')
        },
        async (options) => {
          calls.push(options)
          return outcome
        },
      )
      return { code, stdout, stderr, calls }
    }

    it('adds the kit to the game folder, lists the files and prints the check that followed', async () => {
      const { code, stdout, stderr, calls } = await runAddCli(
        ['add', 'results-screen', '--dir', 'games/x', '--force'],
        added(passing),
      )
      expect(calls).toEqual([
        {
          kit: 'results-screen',
          gameDir: join(process.cwd(), 'games/x'),
          repo: PLUS_REPOSITORY,
          force: true,
        },
      ])
      expect(stdout).toBe(
        'Added results-screen from core-v0.0.2:\n  src/ui/results.screen.ts\n  content/ui/results.toml\n' +
          'pass  boundaries (2 ms)\nautomata check: 0 findings\n',
      )
      expect(stderr).toBe('')
      expect(code).toBe(0)
    })

    it('is exit 1 when the added kit fails automata check, and says the files stay', async () => {
      const failing: CheckReport = {
        ok: false,
        steps: [
          {
            name: 'typecheck',
            ok: false,
            ms: 2,
            toolError: false,
            findings: [{ file: 'src/ui/results.screen.ts', line: 1, col: 1, rule: 'TS2322', message: 'bad' }],
          },
        ],
      }
      const { code, stdout, calls } = await runAddCli(['add', 'results-screen'], added(failing))
      expect(calls[0]).toMatchObject({ gameDir: process.cwd(), repo: PLUS_REPOSITORY, force: false })
      expect(stdout).toContain('FAIL  typecheck (2 ms)')
      expect(stdout).toContain(
        'The kit is in place and automata check did not pass: fix what it reports, or remove the files listed above.',
      )
      expect(code).toBe(1)
    })

    it('is exit 2 when a check step could not run after the add, and says the files stay', async () => {
      const toolMissing: CheckReport = {
        ok: false,
        steps: [
          {
            name: 'typecheck',
            ok: false,
            ms: 2,
            toolError: true,
            findings: [{ file: '', line: 0, col: 0, rule: 'tool-missing', message: 'tsc was not found' }],
          },
        ],
      }
      const { code, stdout, stderr } = await runAddCli(['add', 'results-screen'], added(toolMissing))
      expect(stdout).toContain(
        'Added results-screen from core-v0.0.2:\n  src/ui/results.screen.ts\n  content/ui/results.toml\n',
      )
      expect(stdout).toContain('FAIL  typecheck (2 ms)')
      expect(stdout).toContain(
        'The kit is in place and automata check did not pass: fix what it reports, or remove the files listed above.',
      )
      expect(stderr).toBe('')
      expect(code).toBe(2)
    })

    it('the help says exit 2 is either nothing added or added with a check step that could not run', async () => {
      let stdout = ''
      const code = await runCli(['--help'], {
        stdout: (msg) => {
          stdout += msg
        },
        stderr: () => {},
      })
      expect(code).toBe(0)
      expect(stdout).toContain(
        '(exit 0 added and checked, 1 added and check found problems, 2 either not added (no access, unknown kit,\n' +
          'core version, collision, or a failed copy, which is undone) or added and a check step could not run,\n' +
          'in which case the kit stays in place).',
      )
    })

    it('a failure is exit 2 with its message', async () => {
      const error = new AddError({ reason: 'no-access', message: 'cannot read the repository' })
      const { code, stdout, stderr } = await runAddCli(
        ['add', 'lobby', '--repo', 'file:///tmp/plus.git'],
        error,
      )
      expect(stderr).toBe('Error: cannot read the repository\n')
      expect(stdout).toBe('')
      expect(code).toBe(2)
    })

    it('an unexpected crash is exit 2 with its message, never exit 1 (which means the check failed)', async () => {
      let stderr = ''
      const code = await runCli(
        ['add', 'lobby'],
        {
          stdout: () => {},
          stderr: (msg) => {
            stderr += msg
          },
        },
        async () => {
          throw new Error('automata add runs its own check')
        },
        async () => {
          throw new Error("EACCES: permission denied, lstat '/game/src'")
        },
      )
      expect(stderr).toBe("Error: EACCES: permission denied, lstat '/game/src'\n")
      expect(code).toBe(2)
    })

    it('a usage error is exit 2, shows the usage and adds nothing', async () => {
      const { code, stderr, calls } = await runAddCli(['add'], added(passing))
      expect(code).toBe(2)
      expect(stderr).toContain('Error: a kit name is required')
      expect(stderr).toContain('automata add <kit> [--dir <game>] [--repo <url>] [--force]')
      expect(calls).toEqual([])
    })
  })
})
