import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

// The plugin's hook script, run as Claude Code runs it: the event JSON on stdin, CLAUDE_PROJECT_DIR set, and the
// project's own `automata` bin replaced by a fake that logs how it was called and replies with a canned report.

const SCRIPT = resolve(import.meta.dirname, '../../../../agents/automata/scripts/check.mjs')

const FAKE_AUTOMATA = `#!/usr/bin/env node
import { appendFileSync } from 'node:fs'
appendFileSync(process.env.FAKE_LOG, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }) + '\\n')
process.stdout.write(process.env.FAKE_STDOUT ?? '')
process.stderr.write(process.env.FAKE_STDERR ?? '')
process.exit(Number(process.env.FAKE_EXIT ?? '0'))
`

const FINDINGS = JSON.stringify({
  ok: false,
  steps: [
    {
      name: 'boundaries',
      ok: false,
      ms: 5,
      findings: [
        {
          file: 'src/features/jump/jump.system.ts',
          line: 1,
          col: 1,
          rule: 'import',
          message: 'import of "effect"',
        },
      ],
    },
  ],
})

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

interface Project {
  readonly root: string
  readonly dir: string
  readonly log: string
}

/** A temp project; `binAt` is where `node_modules/.bin/automata` goes, relative to `root` (`null` for none). */
function project(options: { binAt?: string | null; packageJson?: object; dir?: string } = {}): Project {
  // The real path: on macOS tmpdir() is under /tmp, a symlink to /private/tmp, and the hook reports process.cwd().
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'agent-hook-')))
  temps.push(root)
  const dir = join(root, options.dir ?? '.')
  mkdirSync(join(dir, 'src/features/jump'), { recursive: true })
  writeFileSync(join(dir, 'src/features/jump/jump.system.ts'), 'export const a = 1\n')
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(
      options.packageJson ?? { devDependencies: { '@automataframework/automata-tools': '0.0.2' } },
    ),
  )
  const binAt = options.binAt === undefined ? '.' : options.binAt
  if (binAt !== null) {
    const bin = join(root, binAt, 'node_modules/.bin/automata')
    mkdirSync(dirname(bin), { recursive: true })
    writeFileSync(bin, FAKE_AUTOMATA)
    chmodSync(bin, 0o755)
  }
  return { root, dir, log: join(tmpdir(), `agent-hook-log-${root.split(/[\\/]/).pop()}.jsonl`) }
}

interface HookRun {
  readonly status: number | null
  readonly stdout: string
  readonly stderr: string
  readonly calls: Array<{ args: string[]; cwd: string }>
}

function runHook(
  p: Project,
  mode: 'post-edit' | 'stop',
  event: object,
  reply: { exit?: number; stdout?: string; stderr?: string } = {},
): HookRun {
  const result = spawnSync(process.execPath, [SCRIPT, mode], {
    input: JSON.stringify(event),
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: p.dir,
      FAKE_LOG: p.log,
      FAKE_EXIT: String(reply.exit ?? 0),
      FAKE_STDOUT: reply.stdout ?? '',
      FAKE_STDERR: reply.stderr ?? '',
    },
  })
  const calls = existsSync(p.log)
    ? readFileSync(p.log, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as { args: string[]; cwd: string })
    : []
  rmSync(p.log, { force: true })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, calls }
}

const edit = (p: Project, file: string) => ({
  hook_event_name: 'PostToolUse',
  tool_name: 'Edit',
  cwd: p.dir,
  tool_input: { file_path: join(p.dir, file) },
})

const stop = (p: Project, active = false) => ({
  hook_event_name: 'Stop',
  cwd: p.dir,
  stop_hook_active: active,
})

/** Every file under `dir` with its contents, skipping the fake bin. */
function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (at: string) => {
    for (const name of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, name.name)
      if (name.isDirectory()) walk(path)
      else out[path] = readFileSync(path, 'utf8')
    }
  }
  walk(dir)
  return out
}

describe('the PostToolUse hook', () => {
  it('does nothing for an edit to a file that is not sim code', () => {
    const p = project()
    const run = runHook(p, 'post-edit', edit(p, 'src/render/view.ts'))
    expect(run.status).toBe(0)
    expect(run.calls).toEqual([])
  })

  it('runs automata check --sim-only --json in the project after a sim edit, and passes when it passes', () => {
    const p = project()
    const run = runHook(p, 'post-edit', edit(p, 'src/features/jump/jump.system.ts'), {
      stdout: '{"ok":true,"steps":[]}',
    })
    expect(run.status).toBe(0)
    expect(run.stderr).toBe('')
    expect(run.calls).toHaveLength(1)
    expect(run.calls[0]?.args).toEqual(['check', '--sim-only', '--json'])
    expect(run.calls[0]?.cwd).toBe(p.dir)
  })

  // A game laid out by feature: its sim files end in a sim role suffix, wherever they sit under src/. The base 3D game
  // still keeps its sim in role files (src/<role>.ts and src/<role>/) until its own slice moves it.
  it.each([
    'src/features/jump/jump.component.ts',
    'src/features/jump/jump.command.ts',
    'src/features/jump/jump.event.ts',
    'src/features/jump/jump.resource.ts',
    'src/features/jump/jump.plugin.ts',
    'src/shared/clock.system.ts',
    'src/systems.ts',
    'src/systems/x.ts',
    'src/resources.ts',
    'src/state.ts',
    'src/constants.ts',
    'src/components/a.ts',
    'src/commands.ts',
    'src/events.ts',
  ])('runs the sim-only check after an edit to %s', (file) => {
    const p = project()
    const run = runHook(p, 'post-edit', edit(p, file), { stdout: '{"ok":true,"steps":[]}' })
    expect(run.calls.map((call) => call.args)).toEqual([['check', '--sim-only', '--json']])
  })

  it.each([
    'src/views.ts',
    'src/main.ts',
    'src/screens/title.ts',
    'src/content/rooms.content.ts',
    'src/simulate.ts',
    'src/features/jump/jump.view.ts',
    'tests/unit/jump/jump.system.test.ts',
  ])('does nothing after an edit to %s', (file) => {
    const p = project()
    expect(runHook(p, 'post-edit', edit(p, file)).calls).toEqual([])
  })

  it('accepts a sim path relative to the project', () => {
    const p = project()
    const event = { ...edit(p, ''), tool_input: { file_path: 'src/features/jump/jump.system.ts' } }
    expect(runHook(p, 'post-edit', event).calls).toHaveLength(1)
  })

  it('blocks with the JSON findings on stderr when the check finds problems', () => {
    const p = project()
    const run = runHook(p, 'post-edit', edit(p, 'src/features/jump/jump.system.ts'), {
      exit: 1,
      stdout: FINDINGS,
    })
    expect(run.status).toBe(2)
    expect(run.stderr).toContain('automata check --sim-only --json found problems')
    expect(run.stderr).toContain(FINDINGS)
  })

  it('blocks when a check tool cannot run (exit 2)', () => {
    const p = project()
    const toolError = '{"ok":false,"steps":[{"name":"test","ok":false,"ms":1,"findings":[]}]}'
    const run = runHook(p, 'post-edit', edit(p, 'src/features/jump/jump.system.ts'), {
      exit: 2,
      stdout: toolError,
    })
    expect(run.status).toBe(2)
    expect(run.stderr).toContain('could not run')
    expect(run.stderr).toContain(toolError)
  })

  it("passes on the check's own output when it printed no report", () => {
    const p = project()
    const run = runHook(p, 'post-edit', edit(p, 'src/features/jump/jump.system.ts'), {
      exit: 1,
      stderr: 'Error: Cannot find module dist/bin.js',
    })
    expect(run.status).toBe(2)
    expect(run.stderr).toContain('Cannot find module dist/bin.js')
  })

  it('finds the bin in a parent folder (a workspace)', () => {
    const p = project({ dir: 'games/one', binAt: '.' })
    const run = runHook(p, 'post-edit', edit(p, 'src/features/jump/jump.system.ts'))
    expect(run.status).toBe(0)
    expect(run.calls).toHaveLength(1)
    expect(run.calls[0]?.cwd).toBe(p.dir)
  })
})

describe('the Stop hook', () => {
  it('runs the full automata check --json', () => {
    const p = project()
    const run = runHook(p, 'stop', stop(p), { stdout: '{"ok":true,"steps":[]}' })
    expect(run.status).toBe(0)
    expect(run.calls[0]?.args).toEqual(['check', '--json'])
  })

  it('blocks the end of the turn on findings', () => {
    const p = project()
    const run = runHook(p, 'stop', stop(p), { exit: 1, stdout: FINDINGS })
    expect(run.status).toBe(2)
    expect(run.stderr).toContain('automata check --json found problems')
  })

  it('blocks once per stop: with stop_hook_active it lets the turn end', () => {
    const p = project()
    const run = runHook(p, 'stop', stop(p, true), { exit: 1, stdout: FINDINGS })
    expect(run.status).toBe(0)
    expect(run.calls).toEqual([])
  })
})

describe('a project without the automata bin', () => {
  it('is left alone when it is not an Automata game', () => {
    const p = project({ binAt: null, packageJson: { dependencies: { react: '19.0.0' } } })
    const run = runHook(p, 'stop', stop(p))
    expect(run.status).toBe(0)
    expect(run.stderr).toBe('')
  })

  it('is blocked, naming the package to add, when it is an Automata game', () => {
    const p = project({
      binAt: null,
      packageJson: { dependencies: { '@automataframework/automata-sim': '0.0.2' } },
    })
    const run = runHook(p, 'post-edit', edit(p, 'src/features/jump/jump.system.ts'))
    expect(run.status).toBe(2)
    expect(run.stderr).toContain('@automataframework/automata-tools')
  })
})

it('never changes the project', () => {
  const p = project()
  const before = snapshot(p.root)
  runHook(p, 'post-edit', edit(p, 'src/features/jump/jump.system.ts'), { exit: 1, stdout: FINDINGS })
  runHook(p, 'stop', stop(p), { exit: 1, stdout: FINDINGS })
  expect(snapshot(p.root)).toEqual(before)
})
