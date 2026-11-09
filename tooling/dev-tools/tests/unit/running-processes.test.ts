import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { pidsInside, runningProcesses } from '#src/running-processes.ts'
import { type FakeAnswer, fakeProcessRunner } from '#src/testing/fake-process-runner.ts'

const LSOF = [
  'p10',
  'n/',
  'p11',
  'n/repo/wt/a',
  'p12',
  'n/repo/wt/a/packages/x',
  'p13',
  'n/repo/wt/ab',
  '',
].join('\n')

const table = (answer: FakeAnswer) => {
  const fake = fakeProcessRunner(() => answer)
  return { fake, table: Effect.runSync(runningProcesses().pipe(Effect.provide(fake.layer))) }
}

describe('runningProcesses', () => {
  it('asks lsof for every process working folder', () => {
    const { fake } = table({ stdout: LSOF })
    expect(fake.lines()).toEqual(['lsof -w -d cwd -Fpn'])
  })

  it('finds the processes whose working folder is the path or below it, not a sibling with the same prefix', () => {
    const { table: found } = table({ stdout: LSOF })
    expect(pidsInside(found, '/repo/wt/a')).toEqual([11, 12])
    expect(pidsInside(found, '/repo/wt/ab')).toEqual([13])
    expect(pidsInside(found, '/repo/wt/c')).toEqual([])
  })

  it('cannot tell when lsof is missing', () => {
    const { table: found } = table('not-found')
    expect(found).toEqual({ kind: 'unknown', reason: 'lsof could not be started' })
    expect(pidsInside(found, '/repo/wt/a')).toBeNull()
  })

  it('cannot tell when lsof fails without listing anything', () => {
    const { table: found } = table({ exitCode: 1, stdout: '', stderr: 'lsof: boom' })
    expect(found).toEqual({ kind: 'unknown', reason: 'lsof exited 1: lsof: boom' })
  })
})
