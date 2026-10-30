import { describe, expect, test } from 'vitest'
import type { CheckDef, CheckFinding, CheckMeasure, ChecksRunner } from '../suite-ports'

/**
 * How each check of the scenario behaves. An adapter builds a real check for each (the Node adapter, a small argv
 * command): `pass` passes; `fail` fails with `CHECK_FINDING`; `crash` throws or exits without a result; `candidate`
 * fails with a finding at the path when a candidate's text contains `TODO` and passes otherwise; `measure` passes
 * with `CHECK_MEASURE`; `join` passes and adds its `joins`; `wait` never finishes until it is cancelled.
 */
export type CheckBehaviour = 'pass' | 'fail' | 'crash' | 'candidate' | 'measure' | 'join' | 'wait'

export interface ScenarioCheck extends CheckDef {
  readonly behaviour: CheckBehaviour
}

export const CHECK_FINDING: CheckFinding = {
  path: 'content/tuning.toml',
  keyPath: 'MAX_MOVE_SPEED',
  line: 1,
  severity: 'error',
  message: 'MAX_MOVE_SPEED is over its bound',
}

export const CHECK_MEASURE: readonly CheckMeasure[] = [
  { id: 'fairness', label: 'Fairness', value: 0.5, threshold: 0.4, ok: true },
]

const check = (id: string, behaviour: CheckBehaviour, more: Partial<CheckDef> = {}): ScenarioCheck => ({
  id,
  when: 'after',
  run: ['automata', 'check', id],
  joins: [],
  measure: false,
  behaviour,
  ...more,
})

export const CHECKS_SCENARIO: readonly ScenarioCheck[] = [
  check('passes', 'pass'),
  check('fails', 'fail'),
  check('crashes', 'crash'),
  check('no-todo', 'candidate', { when: 'before' }),
  check('fairness', 'measure', { measure: true }),
  check('generate', 'join', { joins: ['content/generated/level.json'] }),
  check('waits', 'wait'),
]

const definition = ({ behaviour: _, ...def }: ScenarioCheck): CheckDef => def

/**
 * What every `ChecksRunner` promises (editor suite spec §4.3 and §7), run against the in-memory fake and, in EDS.1d,
 * the argv runner, built per test on `CHECKS_SCENARIO`.
 */
export function describeChecksRunner(
  name: string,
  make: (scenario: readonly ScenarioCheck[]) => Promise<ChecksRunner> | ChecksRunner,
): void {
  describe(`ChecksRunner contract: ${name}`, () => {
    const runner = () => make(CHECKS_SCENARIO)

    test('declares the checks of the list, with their phase, joins and measure', async () => {
      const checks = await runner()
      expect(checks.declared()).toEqual(CHECKS_SCENARIO.map(definition))
    })

    test('a passing check passes with no findings', async () => {
      const run = await (await runner()).run({ checks: ['passes'] })
      expect(await run.result()).toEqual([
        expect.objectContaining({ check: 'passes', status: 'pass', findings: [] }),
      ])
    })

    test('one result per check in request order; a failing check names its finding and the rest still run', async () => {
      const run = await (await runner()).run({ checks: ['fails', 'passes'] })
      const [failed, passed] = await run.result()
      expect(failed).toMatchObject({ check: 'fails', status: 'fail', findings: [CHECK_FINDING] })
      expect(passed).toMatchObject({ check: 'passes', status: 'pass' })
    })

    test('a check that crashes is an error with its output, and the others still run', async () => {
      const run = await (await runner()).run({ checks: ['crashes', 'passes'] })
      const [crashed, passed] = await run.result()
      expect(crashed).toMatchObject({ check: 'crashes', status: 'error' })
      expect(crashed?.output.length).toBeGreaterThan(0)
      expect(passed).toMatchObject({ status: 'pass' })
    })

    test('a check the list does not declare is an error that names it', async () => {
      const run = await (await runner()).run({ checks: ['nope'] })
      const [result] = await run.result()
      expect(result).toMatchObject({ check: 'nope', status: 'error' })
      expect(result?.output).toContain('nope')
    })

    test('a before check reads the candidate text instead of the file', async () => {
      const checks = await runner()
      const clean = await checks.run({
        checks: ['no-todo'],
        candidates: [{ path: 'content/tuning.toml', text: 'MAX_MOVE_SPEED = 7.5\n' }],
      })
      expect(await clean.result()).toEqual([expect.objectContaining({ status: 'pass' })])
      const dirty = await checks.run({
        checks: ['no-todo'],
        candidates: [{ path: 'content/tuning.toml', text: 'MAX_MOVE_SPEED = 7.5 # TODO\n' }],
      })
      const [result] = await dirty.result()
      expect(result).toMatchObject({ status: 'fail' })
      expect(result?.findings.map((finding) => finding.path)).toEqual(['content/tuning.toml'])
    })

    test('a measure check gives its rows', async () => {
      const run = await (await runner()).run({ checks: ['fairness'] })
      expect(await run.result()).toEqual([
        expect.objectContaining({ check: 'fairness', status: 'pass', measure: CHECK_MEASURE }),
      ])
    })

    test('a passing check with joins names the generated files it added', async () => {
      const run = await (await runner()).run({ checks: ['generate'] })
      expect(await run.result()).toEqual([
        expect.objectContaining({ status: 'pass', joined: ['content/generated/level.json'] }),
      ])
    })

    test('cancel ends what is still running as an error that says so; finished checks keep their results', async () => {
      const run = await (await runner()).run({ checks: ['passes', 'waits'] })
      run.cancel()
      const [passed, waited] = await run.result()
      expect(passed?.status === 'pass' || passed?.status === 'error').toBe(true)
      expect(waited).toMatchObject({ check: 'waits', status: 'error' })
      expect(waited?.output).toMatch(/cancel/i)
    })

    test('a newer run of a check replaces the one still running, which ends as an error', async () => {
      const checks = await runner()
      const first = await checks.run({ checks: ['waits'] })
      const second = await checks.run({ checks: ['waits', 'passes'] })
      expect(second.id).not.toBe(first.id)
      const [replaced] = await first.result()
      expect(replaced).toMatchObject({ check: 'waits', status: 'error' })
      expect(replaced?.output).toMatch(/replaced/i)
      second.cancel()
      const [, passed] = await second.result()
      expect(passed?.check).toBe('passes')
    })
  })
}
