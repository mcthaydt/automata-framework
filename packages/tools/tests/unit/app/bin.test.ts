import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseArgs, runCli } from '#src/app/cli.ts'
import { runShip } from '#src/app/ship-cli.ts'
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

    it('parses the options', () => {
      const parsed = parseArgs(['my-dir', '--id', 'custom-id', '--title', 'Custom Title'])
      expect(parsed.targetDir).toBe('my-dir')
      expect(parsed.id).toBe('custom-id')
      expect(parsed.title).toBe('Custom Title')
    })

    it('parses --link-workspace, off unless given', () => {
      expect(parseArgs(['my-dir']).linkWorkspace).toBe(false)
      expect(parseArgs(['my-dir', '--link-workspace']).linkWorkspace).toBe(true)
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
      // It says what it made and the next three commands, so the first run needs no README.
      expect(stdout).toBe(
        `Created "My CLI Game" in ${testDir}.\nNext: cd ${testDir} && pnpm install && pnpm dev\n`,
      )
      expect(existsSync(join(testDir, 'package.json'))).toBe(true)
    })

    it('returns exit code 1 on missing target dir', async () => {
      let stderr = ''
      const code = await runCli(['create-game'], {
        stdout: () => {},
        stderr: (msg) => {
          stderr += msg
        },
      })

      expect(code).toBe(1)
      expect(stderr).toContain('Error: name a folder for the game, like: automata create-game my-game')
    })

    it('returns exit code 1 on invalid id', async () => {
      let stderr = ''
      const code = await runCli(['create-game', testDir, '--id', 'INVALID_ID'], {
        stdout: () => {},
        stderr: (msg) => {
          stderr += msg
        },
      })

      expect(code).toBe(1)
      expect(stderr).toContain(
        'Error: "INVALID_ID" can\'t be a game id. Use lowercase letters, digits and hyphens, like my-game.',
      )
    })

    it('builds only for the targets --targets names', async () => {
      const code = await runCli(['create-game', testDir, '--id', 'web-game', '--targets', 'web,itch'], {
        stdout: () => {},
        stderr: () => {},
      })
      expect(code).toBe(0)
      const scripts = Object.keys(JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf8')).scripts)
      expect(scripts.filter((name) => name.startsWith('build:'))).toEqual(['build:web', 'build:itch'])
    })

    it('refuses an unknown target with exit code 1, naming it and the four allowed, and writes nothing', async () => {
      let stderr = ''
      const code = await runCli(['create-game', testDir, '--targets', 'steam'], {
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
      await runCli(['create-game', '--help'], { stdout: (msg) => (stdout += msg), stderr: () => {} })
      expect(stdout).toContain('--targets <list>')
      expect(stdout).toContain('default: web,itch; also tauri, ruken')
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
      const { code, stdout, calls } = await runCheckCli(['check', '--help'])
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
      expect(stderr).toContain('Usage: automata build')
      expect(calls).toEqual([])
    })
  })

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

    it('the first screen names `ship`', async () => {
      const { stdout } = await runShipCli(['--help'])
      expect(stdout).toContain('ship <command>')
    })

    it('prints the usage on stdout and exits 0 for `ship --help`', async () => {
      let stdout = ''
      let stderr = ''
      const write = (target: 'stdout' | 'stderr') =>
        vi.spyOn(process[target], 'write').mockImplementation((chunk) => {
          if (target === 'stdout') stdout += String(chunk)
          else stderr += String(chunk)
          return true
        })
      const spies = [write('stdout'), write('stderr')]
      try {
        expect(await runShip(['--help'])).toBe(0)
      } finally {
        for (const spy of spies) spy.mockRestore()
      }
      expect(stdout).toContain('automata ship prepare')
      expect(stderr).toBe('')
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
