import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The bin as a person or an agent starts it: Node runs src/cli.ts from source, with stdin closed, so a prompt would
// fail rather than hang.
const bin = fileURLToPath(new URL('./cli.ts', import.meta.url))
// The agent variables are removed so the tests run as a person whoever runs them; the agent case sets one.
const personEnv = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => name !== 'CLAUDECODE' && name !== 'AUTOMATA_AGENT'),
)
const pipeWith = (env: NodeJS.ProcessEnv, ...args: string[]) =>
  spawnSync(process.execPath, [bin, ...args], {
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
  })
const pipe = (...args: string[]) => pipeWith(personEnv, ...args)

describe('the automata-pipe bin', () => {
  it('prints the usage and exits 0', () => {
    const out = pipe('--help')
    expect([out.status, out.stderr]).toEqual([0, ''])
    expect(out.stdout).toMatch(/^usage: automata-pipe <pipeline> <command> <target>/)
    expect(out.stdout).toMatch(/^ {2}character {1}not implemented yet$/m)
  })

  it('exits 2 with one JSON object for a pipeline not built yet', () => {
    const out = pipe('props', 'status', 'nowhere', '--json')
    expect(out.status).toBe(2)
    expect(out.stdout.trimEnd().split('\n')).toHaveLength(1)
    expect(JSON.parse(out.stdout)).toEqual({
      ok: false,
      pipeline: 'props',
      command: 'status',
      exit: 2,
      error: 'props: not implemented',
    })
  })

  it('exits 1 with the error on stderr for an unknown pipeline', () => {
    const out = pipe('nine', 'run', 'x')
    expect([out.status, out.stdout, out.stderr]).toEqual([1, '', "unknown pipeline 'nine'; see --help\n"])
  })

  it("refuses an agent's approve with exit 4 before the registry is read, and logs it", () => {
    const cwd = mkdtempSync(join(tmpdir(), 'pipe-bin-'))
    try {
      const run = (env: NodeJS.ProcessEnv) =>
        spawnSync(process.execPath, [bin, 'props', 'approve', 'wren', 'G6', '--json'], {
          cwd,
          encoding: 'utf8',
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 60_000,
        })
      const agent = run({ ...personEnv, CLAUDECODE: '1' })
      expect(agent.status).toBe(4)
      expect(JSON.parse(agent.stdout)).toMatchObject({ exit: 4, command: 'approve' })
      const line = JSON.parse(readFileSync(join(cwd, 'docs/pipeline-audit.jsonl'), 'utf8'))
      expect(line).toMatchObject({
        tool: 'automata-pipe approve',
        ok: false,
        args: { target: 'wren', gate: 'G6' },
      })
      expect(run(personEnv).status).toBe(2)
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })
})
