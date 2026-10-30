import { chmod, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import type { CheckDef } from '@mcthaydt/automata-editor-kit/ports'
import {
  CHECK_FINDING,
  CHECK_MEASURE,
  type CheckBehaviour,
  describeChecksRunner,
  type ScenarioCheck,
} from '@mcthaydt/automata-editor-kit/ports/testing'
import { afterAll, describe, expect, test } from 'vitest'
import { createArgvChecks } from './argv-checks'

const made: string[] = []
afterAll(async () => {
  for (const dir of made) await rm(dir, { recursive: true, force: true })
})

async function temporary(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  made.push(dir)
  return dir
}

/**
 * A stand-in `automata` on PATH: `automata check <id>` behaves as the scenario says for that id, so the runner runs
 * the list's argv as written. `candidate` reads the candidate folder the runner names in AUTOMATA_CANDIDATES.
 */
async function fakeAutomata(
  behaviours: Readonly<Record<string, CheckBehaviour | 'automata-json' | 'args'>>,
): Promise<string> {
  const bin = await temporary('af-fake-automata-')
  const script = [
    '#!/usr/bin/env node',
    "const { readFileSync } = require('node:fs')",
    "const { join } = require('node:path')",
    `const behaviours = ${JSON.stringify(behaviours)}`,
    `const finding = ${JSON.stringify(CHECK_FINDING)}`,
    `const measure = ${JSON.stringify(CHECK_MEASURE)}`,
    'const id = process.argv[3]',
    'const behaviour = behaviours[id]',
    "if (behaviour === 'pass' || behaviour === 'join') process.exit(0)",
    "if (behaviour === 'fail') { console.log(JSON.stringify({ findings: [finding] })); process.exit(1) }",
    "if (behaviour === 'crash') throw new Error('the check broke')",
    "if (behaviour === 'measure') { console.log(JSON.stringify({ measure })); process.exit(0) }",
    "if (behaviour === 'wait') setTimeout(() => {}, 60000)",
    "if (behaviour === 'automata-json') { console.log(JSON.stringify({ ok: false, steps: [{ name: 'boundaries', ok: false, ms: 3, findings: [{ file: 'src/systems.ts', line: 4, col: 2, rule: 'no-date', message: 'Date in the sim' }] }] })); process.exit(1) }",
    "if (behaviour === 'candidate') {",
    "  const text = readFileSync(join(process.env.AUTOMATA_CANDIDATES, 'content/tuning.toml'), 'utf8')",
    "  if (!text.includes('TODO')) process.exit(0)",
    "  console.log(JSON.stringify({ findings: [{ path: 'content/tuning.toml', severity: 'error', message: 'a TODO' }] }))",
    '  process.exit(1)',
    '}',
    "if (behaviour === 'args') { console.log(JSON.stringify({ findings: [{ severity: 'warning', message: process.argv.slice(4).join(' ') }] })); process.exit(0) }",
  ].join('\n')
  await writeFile(join(bin, 'automata'), script)
  await chmod(join(bin, 'automata'), 0o755)
  return bin
}

const withBin = (bin: string) => ({ ...process.env, PATH: `${bin}${delimiter}${process.env.PATH ?? ''}` })

describeChecksRunner('argv', async (scenario: readonly ScenarioCheck[]) => {
  const bin = await fakeAutomata(Object.fromEntries(scenario.map((check) => [check.id, check.behaviour])))
  const checks = scenario.map(({ behaviour: _, ...def }): CheckDef => def)
  return createArgvChecks({ root: await temporary('af-game-'), checks, env: withBin(bin) })
})

const def = (id: string, run: string[]): CheckDef => ({ id, when: 'after', run, joins: [], measure: false })

describe('the argv checks runner', () => {
  test("automata check's JSON gives its findings with the file, line and column", async () => {
    const bin = await fakeAutomata({ game: 'automata-json' })
    const checks = createArgvChecks({
      root: await temporary('af-game-'),
      checks: [def('game', ['automata', 'check', 'game', '--json'])],
      env: withBin(bin),
    })
    const [result] = await (await checks.run({ checks: ['game'] })).result()
    expect(result).toMatchObject({
      status: 'fail',
      findings: [
        {
          path: 'src/systems.ts',
          line: 4,
          column: 2,
          severity: 'error',
          message: 'no-date: Date in the sim',
        },
      ],
    })
  })

  test('{path} and {scene} come from the candidate, and a warning alone is a warn', async () => {
    const bin = await fakeAutomata({ scene: 'args' })
    const checks = createArgvChecks({
      root: await temporary('af-game-'),
      checks: [def('scene', ['automata', 'check', 'scene', '{scene}', '{path}'])],
      sceneOf: (path) => /^content\/scenes\/([^/]+)\//.exec(path)?.[1],
      env: withBin(bin),
    })
    const run = await checks.run({
      checks: ['scene'],
      candidates: [{ path: 'content/scenes/bay/level.json', text: '{}' }],
    })
    const [result] = await run.result()
    expect(result).toMatchObject({
      status: 'warn',
      findings: [{ message: 'bay content/scenes/bay/level.json' }],
    })
  })

  test('a check that needs {scene} with no file to give it is an error that says so', async () => {
    const checks = createArgvChecks({
      root: await temporary('af-game-'),
      checks: [def('scene', ['automata', 'check', 'scene', '{scene}'])],
    })
    const [result] = await (await checks.run({ checks: ['scene'] })).result()
    expect(result).toMatchObject({ status: 'error' })
    expect(result?.output).toMatch(/needs a file/)
  })

  test('a command that is not there is an error with the reason', async () => {
    const checks = createArgvChecks({
      root: await temporary('af-game-'),
      checks: [def('gone', ['automata-no-such-command'])],
    })
    const [result] = await (await checks.run({ checks: ['gone'] })).result()
    expect(result).toMatchObject({ status: 'error' })
    expect(result?.output).toMatch(/ENOENT/)
  })

  test('a candidate outside the game root is refused, and the candidates folder is gone afterwards', async () => {
    const bin = await fakeAutomata({ 'no-todo': 'candidate' })
    const before = (await readdir(tmpdir())).filter((name) => name.startsWith('af-candidates-'))
    const checks = createArgvChecks({
      root: await temporary('af-game-'),
      checks: [def('no-todo', ['automata', 'check', 'no-todo'])],
      env: withBin(bin),
    })
    const [outside] = await (
      await checks.run({ checks: ['no-todo'], candidates: [{ path: '../escape.toml', text: '' }] })
    ).result()
    expect(outside).toMatchObject({ status: 'error' })
    expect(outside?.output).toMatch(/outside the game/)
    await (
      await checks.run({
        checks: ['no-todo'],
        candidates: [{ path: 'content/tuning.toml', text: 'A = 1\n' }],
      })
    ).result()
    const after = (await readdir(tmpdir())).filter((name) => name.startsWith('af-candidates-'))
    expect(after.sort()).toEqual(before.sort())
  })
})
