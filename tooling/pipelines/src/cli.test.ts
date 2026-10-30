import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The bin as a person or an agent starts it: Node runs src/cli.ts from source, with stdin closed, so a prompt would
// fail rather than hang.
const bin = fileURLToPath(new URL('./cli.ts', import.meta.url))
const pipe = (...args: string[]) =>
  spawnSync(process.execPath, [bin, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
  })

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
})
