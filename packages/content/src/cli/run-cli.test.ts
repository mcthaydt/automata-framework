// The command line. Ports FloorFifty packages/content/bin/content.ts's behavior (122a220) as tests of
// `runCli`, plus one run of the real bin to prove it starts under Node.

import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { copyFixture } from '../testing/fixture-game'
import { runCli } from './run-cli'

const FIXTURE_GAME = join(import.meta.dirname, '../testing/fixture-game.ts')

const GUIDE = '# Authoring\n\n<!-- BEGIN GENERATED TUNABLES -->\n<!-- END GENERATED TUNABLES -->\n'

/** The fixture game as a project: its content plus an `automata.content.ts` and a guide. */
function project(config = ''): string {
  const root = copyFixture('valid')
  writeFileSync(
    join(root, 'automata.content.ts'),
    config ||
      [
        `import { CATALOG, CHARACTER, FLOW, INVARIANTS, SONG, STAGE, TUNABLES } from '${FIXTURE_GAME}'`,
        'export default {',
        '  schemas: [CHARACTER, SONG, STAGE, CATALOG],',
        '  tunables: TUNABLES,',
        '  invariants: INVARIANTS,',
        '  flow: FLOW,',
        "  guide: 'docs/authoring.md',",
        '}',
        '',
      ].join('\n'),
  )
  mkdirSync(join(root, 'docs'))
  writeFileSync(join(root, 'docs/authoring.md'), GUIDE)
  return root
}

async function cli(root: string, ...argv: string[]): Promise<{ code: number; out: string[]; err: string[] }> {
  const out: string[] = []
  const err: string[] = []
  const code = await runCli(argv, root, { out: (line) => out.push(line), err: (line) => err.push(line) })
  return { code, out, err }
}

const generated = (root: string, file = 'content.json'): string => join(root, 'content/generated', file)

// 90 s budgets: the shared af-linux runner is slow under load (2026-10-16: this package's render-types file took
// 70.7 s). The root test:unit default is the same 90 s; packages/ship's workflows test pins both.
describe('runCli', () => {
  it('check exits 0 and writes nothing', async () => {
    const root = project()
    const result = await cli(root, 'check')
    expect(result.code).toBe(0)
    expect(result.out).toEqual([expect.stringMatching(/^content [0-9a-f]{16}$/)])
    expect(existsSync(join(root, 'content/generated'))).toBe(false)
  }, 90_000)

  it('check prints a warning for a skipped file and still exits 0', async () => {
    const root = project()
    writeFileSync(join(root, 'content/songs/night-run.TOML'), 'title = "x"\n')
    const result = await cli(root, 'check')
    expect(result.code).toBe(0)
    expect(result.err).toEqual([
      'warning content/songs/night-run.TOML:1:1  skippedFile: this file is not read; items are named like dusk-run.toml',
    ])
  }, 90_000)

  it('check exits 1 and prints every diagnostic', async () => {
    const root = project()
    const song = join(root, 'content/songs/dusk-run.toml')
    writeFileSync(song, `${readFileSync(song, 'utf8')}tempoDrift = 3\n`)
    const result = await cli(root, 'check')
    expect(result.code).toBe(1)
    expect(result.err).toEqual([
      'content/songs/dusk-run.toml:8:1  tempoDrift  unknownField: unknown field: tempoDrift',
    ])
  }, 90_000)

  it('build writes the outputs, and check --verify-artifact accepts them', async () => {
    const root = project()
    expect((await cli(root, 'build')).code).toBe(0)
    expect(existsSync(generated(root))).toBe(true)
    expect((await cli(root, 'docs')).code).toBe(0)
    expect(await cli(root, 'check', '--verify-artifact')).toEqual({
      code: 0,
      out: [expect.stringMatching(/^content [0-9a-f]{16}$/)],
      err: [],
    })
  }, 90_000)

  it('check --verify-artifact fails after a hand edit', async () => {
    const root = project()
    await cli(root, 'build')
    await cli(root, 'docs')
    writeFileSync(generated(root), readFileSync(generated(root), 'utf8').replace('Dusk Run', 'Dusk Walk'))
    const result = await cli(root, 'check', '--verify-artifact')
    expect(result.code).toBe(1)
    expect(result.err).toEqual([
      'content/generated/content.json:1:1  staleArtifact: content/generated/content.json does not match content/; run automata-content build',
    ])
  }, 90_000)

  it('docs rewrites the tunable table, and verify catches a stale one', async () => {
    const root = project()
    await cli(root, 'build')
    expect((await cli(root, 'docs')).code).toBe(0)
    const guide = readFileSync(join(root, 'docs/authoring.md'), 'utf8')
    expect(guide).toContain('| `GRAVITY` | float | -1200 to -100 | -275 |')

    writeFileSync(join(root, 'docs/authoring.md'), GUIDE)
    const result = await cli(root, 'check', '--verify-artifact')
    expect(result.code).toBe(1)
    expect(result.err).toEqual([
      'docs/authoring.md:1:1  staleArtifact: the tunable table in docs/authoring.md is out of date; run automata-content docs',
    ])
  }, 90_000)

  it.each([[['watch']], [['build', '--verify-artifact']], [[]]])(
    'exits 2 with usage for %j',
    async (argv) => {
      const result = await cli(project(), ...argv)
      expect(result.code).toBe(2)
      expect(result.err).toEqual([
        'usage: automata-content <check [--verify-artifact] | build | docs [guide.md]>',
      ])
    },
    30_000,
  )

  it('exits 2 without a config file', async () => {
    const root = copyFixture('valid')
    const result = await cli(root, 'check')
    expect(result.code).toBe(2)
    expect(result.err).toEqual([`no automata.content.ts in ${root}`])
  })

  it('exits 2 for an invalid config', async () => {
    const root = project(`import { SONG } from '${FIXTURE_GAME}'\nexport default { schemas: [SONG, SONG] }\n`)
    const result = await cli(root, 'check')
    expect(result.code).toBe(2)
    expect(result.err).toEqual(['automata.content.ts: kind "song" is registered twice'])
  }, 90_000)
})

describe('the automata-content bin', () => {
  // Audit of PR #8: the bin found its own files through a URL's `pathname`, which spells a space `%20`.
  it('runs from a package path and a project path with spaces', () => {
    const copy = join(mkdtempSync(join(tmpdir(), 'content-bin-')), 'package with spaces')
    cpSync(join(import.meta.dirname, '..'), join(copy, 'src'), { recursive: true })
    symlinkSync(join(import.meta.dirname, '../../node_modules'), join(copy, 'node_modules'))
    const root = join(mkdtempSync(join(tmpdir(), 'content-project-')), 'my game')
    cpSync(project(), root, { recursive: true })
    const stdout = execFileSync(process.execPath, [join(copy, 'src/cli/main.ts'), 'check'], {
      cwd: root,
      encoding: 'utf8',
    })
    expect(stdout).toMatch(/^content [0-9a-f]{16}\n$/)
  }, 90_000)

  it('runs under Node', () => {
    const root = project()
    const main = join(import.meta.dirname, 'main.ts')
    const stdout = execFileSync(process.execPath, [main, 'check'], { cwd: root, encoding: 'utf8' })
    expect(stdout).toMatch(/^content [0-9a-f]{16}\n$/)
  }, 90_000)
})
