import { describe, expect, it } from 'vitest'
import { runCli } from '#src/app/cli.ts'

// What a first-time game author reads. The first screen is short and names what to do; each command's own help says
// what it does in plain words. Plan IDs, internal constants, exit-code paragraphs and package names do not belong in
// any of it (Y1, Y2).

async function help(args: string[]): Promise<string> {
  let stdout = ''
  const code = await runCli(args, { stdout: (msg) => (stdout += msg), stderr: () => {} })
  expect(code, args.join(' ')).toBe(0)
  return stdout
}

const COMMANDS: readonly (readonly string[])[] = [
  ['create-game', '--help'],
  ['check', '--help'],
  ['build', '--help'],
  ['editor', '--help'],
  ['ship', '--help'],
]

// Matched in any help: a decision or milestone ID, an internal constant, an exit-code paragraph, a package name.
const NOT_IN_HELP: readonly [string, RegExp][] = [
  ['a decision ID (D-1)', /\bD-\d/],
  ['a milestone ID (M3)', /\bM\d+\b/],
  ['an internal constant', /__[A-Z_]+__/],
  ['an exit-code paragraph', /exit 0/i],
  ['a package name', /@[a-z-]+\/[a-z-]+/],
]

describe('automata --help', () => {
  it('is at most eight lines and names every command', async () => {
    const text = await help(['--help'])
    expect(text.trimEnd().split('\n').length).toBeLessThanOrEqual(8)
    for (const command of ['create-game', 'check', 'build', 'editor', 'ship']) expect(text).toContain(command)
  })

  it('names the four steps: make a game, build it, check it, publish it', async () => {
    const text = (await help(['--help'])).toLowerCase()
    for (const word of ['make', 'build', 'check', 'publish']) expect(text).toContain(word)
  })

  it('says where the rest is', async () => {
    expect(await help(['--help'])).toContain('Run automata <command> --help for more.')
  })

  it('has no ruken.toml on the first screen', async () => {
    expect(await help(['--help'])).not.toContain('ruken.toml')
  })
})

describe.each([[['--help']], ...COMMANDS.map((args) => [args])])('automata %s', (args) => {
  it.each(NOT_IN_HELP)('has no %s', async (_what, pattern) => {
    expect(await help([...args])).not.toMatch(pattern)
  })
})

describe('each command’s own help', () => {
  it('starts with how to run it', async () => {
    for (const args of COMMANDS) {
      expect(await help([...args]), args.join(' ')).toMatch(new RegExp(`^Usage: automata ${args[0]}`))
    }
  })

  it('create-game names its options and the default targets', async () => {
    const text = await help(['create-game', '--help'])
    for (const option of ['--id', '--title', '--targets']) expect(text).toContain(option)
    expect(text).toContain('default: web,itch; also tauri, ruken')
  })

  it('check names each of its steps and its options', async () => {
    const text = (await help(['check', '--help'])).replace(/\s+/g, ' ')
    const steps = ['boundaries', 'typecheck', 'tests', 'boards', 'orientation', 'inputs']
    for (const word of [
      ...steps,
      'no-eval',
      'secrets',
      'data-urls',
      '--csp',
      '--sim-only',
      '--fail-fast',
      '--json',
    ]) {
      expect(text).toContain(word)
    }
  })

  it('build says what --debug does', async () => {
    expect(await help(['build', '--help'])).toContain('--debug')
  })

  it('ship asks for a target and names the four', async () => {
    const text = await help(['ship', '--help'])
    expect(text).toContain('Every command names its target.')
    for (const target of ['web', 'itch', 'tauri', 'ruken']) expect(text).toContain(target)
  })
})
