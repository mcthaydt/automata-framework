import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseArgs, runCli } from '#src/app/cli.ts'
import { ALIAS_NOTICE, runShipAlias } from '#src/app/ship-alias.ts'
import { PLUS_REPOSITORY } from '#src/features/add/add-args.ts'
import { AddError, type AddResult, type RunAddOptions } from '#src/features/add/run-add.ts'
import type { BuildResult } from '#src/features/build/run-build.ts'
import type { CheckReport } from '#src/shared/check/check-report.ts'
import { CheckToolError } from '#src/shared/check/csp-probe.ts'
import type { RunCheckOptions } from '#src/shared/check/run-check.ts'

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

    it('builds only for the targets --targets names', async () => {
      const code = await runCli([testDir, '--id', 'web-game', '--targets', 'web,itch'], {
        stdout: () => {},
        stderr: () => {},
      })
      expect(code).toBe(0)
      const scripts = Object.keys(JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf8')).scripts)
      expect(scripts.filter((name) => name.startsWith('build:'))).toEqual(['build:web', 'build:itch'])
    })

    it('refuses an unknown target with exit code 1, naming it and the four allowed, and writes nothing', async () => {
      let stderr = ''
      const code = await runCli([testDir, '--targets', 'steam'], {
        stdout: () => {},
        stderr: (msg) => {
          stderr += msg
        },
      })
      expect(code).toBe(1)
      expect(stderr).toContain('unknown target "steam"')
      expect(stderr).toContain('web, itch, ruken, tauri')
      expect(existsSync(testDir)).toBe(false)
    })

    it('documents --targets and its default in the usage', async () => {
      let stdout = ''
      await runCli(['--help'], { stdout: (msg) => (stdout += msg), stderr: () => {} })
      expect(stdout).toContain('--targets <list>')
      expect(stdout).toContain('default: web,itch,ruken,tauri')
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

  // FR.3: `automata build [dir] [--debug]` runs the game's vite build; exit 0 built, 1 vite failed, 2 it could not run.
  describe('build', () => {
    async function runBuildCli(
      args: string[],
      result: BuildResult | CheckToolError = { exitCode: 0, tail: 'built' },
    ) {
      let stdout = ''
      let stderr = ''
      const calls: { gameDir: string; debug: boolean }[] = []
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
        async () => ({ ok: true, steps: [] }),
        async () => {
          throw new Error('add is not part of build')
        },
        async (options) => {
          calls.push(options)
          if (result instanceof CheckToolError) throw result
          return result
        },
      )
      return { code, stdout, stderr, calls }
    }

    it('builds the working folder for release by default', async () => {
      const { code, calls } = await runBuildCli(['build'])
      expect(code).toBe(0)
      expect(calls).toEqual([{ gameDir: process.cwd(), debug: false }])
    })

    it('builds the folder given with the debug constant on for --debug', async () => {
      const { code, calls } = await runBuildCli(['build', 'games/x', '--debug'])
      expect(code).toBe(0)
      expect(calls).toEqual([{ gameDir: join(process.cwd(), 'games/x'), debug: true }])
    })

    it('is exit 1, with the tail of vite’s output, when the build fails', async () => {
      const { code, stderr } = await runBuildCli(['build'], { exitCode: 1, tail: 'error: no entry' })
      expect(code).toBe(1)
      expect(stderr).toContain('error: no entry')
    })

    it('is exit 2 when vite could not run, and says why', async () => {
      const missing = new CheckToolError({
        kind: 'missing',
        tool: 'vite',
        detail: 'install it: npm install --save-dev vite',
      })
      const { code, stderr } = await runBuildCli(['build'], missing)
      expect(code).toBe(2)
      expect(stderr).toContain('vite not found; install it: npm install --save-dev vite')
    })

    it('is exit 2 with the usage for an unknown option', async () => {
      const { code, stderr, calls } = await runBuildCli(['build', '--target', 'web'])
      expect(code).toBe(2)
      expect(stderr).toContain('unknown option --target')
      expect(stderr).toContain('automata build [dir] [--debug]')
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

  // The one bin (spec 3.2): `automata ship <cmd>` is the ship lane; `automata-ship` stays for one release.
  describe('ship', () => {
    const noOtherCommand = async (): Promise<never> => {
      throw new Error('not part of ship')
    }
    async function runShipCli(args: string[], exit = 0) {
      const calls: string[][] = []
      let stdout = ''
      const code = await runCli(
        args,
        {
          stdout: (msg) => {
            stdout += msg
          },
          stderr: () => undefined,
        },
        noOtherCommand,
        noOtherCommand,
        noOtherCommand,
        async (shipArgs) => {
          calls.push([...shipArgs])
          return exit
        },
      )
      return { code, calls, stdout }
    }

    it('hands everything after `ship` to the ship lane and returns its exit code', async () => {
      const { code, calls } = await runShipCli(['ship', 'prepare', '--dist', 'dist', '--target', 'itch'], 2)
      expect(calls).toEqual([['prepare', '--dist', 'dist', '--target', 'itch']])
      expect(code).toBe(2)
    })

    it('the help names `automata ship`', async () => {
      const { stdout } = await runShipCli(['--help'])
      expect(stdout).toContain('automata ship <command>')
    })

    it('the old name prints that it is going away, then runs the same lane with the same arguments', async () => {
      const calls: string[][] = []
      let stderr = ''
      const code = await runShipAlias(
        ['publish', '--dist', 'dist'],
        (msg) => {
          stderr += msg
        },
        async (args) => {
          calls.push([...args])
          return 0
        },
      )
      expect(stderr).toBe(`${ALIAS_NOTICE}\n`)
      expect(ALIAS_NOTICE).toBe(
        'automata-ship is now "automata ship". This name goes away in the next release.',
      )
      expect(calls).toEqual([['publish', '--dist', 'dist']])
      expect(code).toBe(0)
    })
  })

  // Inside the workspace, `automata` is `src/app/bin.ts` run by Node itself (a game's CI runs `automata ship prepare`
  // this way). Node resolves no extensionless import, so a command must not load the editor suite's sources until
  // `automata editor` asks for them.
  it('runs from source, as the workspace bin, without loading the editor suite', () => {
    const run = spawnSync(process.execPath, ['src/app/bin.ts', '--help'], { encoding: 'utf8' })
    expect(run.stderr).not.toContain('ERR_MODULE_NOT_FOUND')
    expect(run.status).toBe(0)
  })
})
