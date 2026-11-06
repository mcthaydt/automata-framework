import { describe, expect, test } from 'vitest'
import { changeSetPill, checksPill, gatesPill } from '#src/features/suite/core/pills-model.ts'
import { changedPaths, reopenedGates } from '#src/features/suite/core/reopened-gates.ts'
import type { ChangeSetCheck, GateState, WorkspaceFile } from '#src/shared/kit/ports/suite-ports.ts'

describe('the change-set pill', () => {
  test('without the port it says edits save to the workspace; with none open it says so', () => {
    expect(changeSetPill({ port: false })).toMatchObject({
      tone: 'neutral',
      label: 'Saving to the workspace',
      count: 0,
    })
    expect(changeSetPill({ port: true })).toMatchObject({ tone: 'neutral', label: 'No change set', count: 0 })
  })

  test('an open one shows its title and counts its files, which are its items', () => {
    const pill = changeSetPill({ port: true, open: { title: 'Faster', files: ['a.toml', 'b.toml'] } })
    expect(pill).toMatchObject({ tone: 'neutral', label: 'Faster', count: 2, icon: 'change-set' })
    expect(pill.items.map((item) => item.label)).toEqual(['a.toml', 'b.toml'])
  })
})

const run = (
  check: string,
  status: ChangeSetCheck['status'],
  extra: Partial<ChangeSetCheck> = {},
): ChangeSetCheck => ({
  check,
  status,
  findings: [],
  ...extra,
})

describe('the checks pill', () => {
  test('idle with no run, running while checks run', () => {
    expect(checksPill({ running: false, checks: [] })).toMatchObject({
      tone: 'neutral',
      label: 'No checks run',
      count: 0,
    })
    expect(checksPill({ running: true, checks: [run('lint', 'pass')] })).toMatchObject({
      tone: 'running',
      label: 'Checks running',
    })
  })

  test('the worst status wins: pass, warn, error and fail', () => {
    expect(checksPill({ running: false, checks: [run('a', 'pass'), run('b', 'pass')] })).toMatchObject({
      tone: 'pass',
      label: 'Checks pass',
      count: 2,
    })
    expect(checksPill({ running: false, checks: [run('a', 'pass'), run('b', 'warn')] })).toMatchObject({
      tone: 'warn',
      label: 'b warns',
      count: 1,
    })
    expect(checksPill({ running: false, checks: [run('a', 'error'), run('b', 'warn')] })).toMatchObject({
      tone: 'error',
      label: 'a could not run',
    })
  })

  test('an after check failing is red with the failing check first and its finding for Locate (EDS-h)', () => {
    const finding = { path: 'content/tuning.toml', line: 2, severity: 'error' as const, message: 'too fast' }
    const pill = checksPill({
      running: false,
      checks: [run('fair', 'pass'), run('lint', 'fail', { findings: [finding] }), run('speed', 'fail')],
    })
    expect(pill).toMatchObject({ tone: 'fail', label: 'lint failed', count: 2, icon: 'checks' })
    expect(pill.items.map((item) => [item.id, item.tone])).toEqual([
      ['lint', 'fail'],
      ['speed', 'fail'],
      ['fair', 'pass'],
    ])
    expect(pill.items[0]?.finding).toEqual(finding)
  })

  test('a measure check shows its measures before and after', () => {
    const before = [{ id: 'gap', label: 'Widest gap', value: 3, threshold: 4, ok: true }]
    const after = [{ id: 'gap', label: 'Widest gap', value: 5, threshold: 4, ok: false }]
    const [item] = checksPill({ running: false, checks: [run('fair', 'warn', { before, after })] }).items
    expect(item?.measures).toEqual([{ label: 'Widest gap', before: 3, after: 5, ok: false }])
  })
})

const file = (path: string, gates: string[]): WorkspaceFile => ({
  path,
  editor: 'tuner',
  gates,
  checks: [],
  modes: ['edit'],
  writable: true,
})
const STATES: GateState[] = [
  {
    id: 'g-feel',
    name: 'Feel',
    decision: 'approved',
    decidedAt: '2026-10-20',
    url: 'https://example.com/g-feel',
  },
  { id: 'g-speed', name: 'Speed', decision: 'open', url: 'https://example.com/g-speed' },
]

describe('the gates pill', () => {
  test('without the port, or when the records do not read, it says gates are not readable', () => {
    expect(gatesPill({ reopened: ['g-feel'], states: undefined })).toMatchObject({
      tone: 'warn',
      label: 'Gates not readable',
    })
    expect(gatesPill({ reopened: ['g-feel'], states: { error: 'no gates.json' } })).toMatchObject({
      label: 'Gates not readable',
      detail: 'no gates.json',
    })
  })

  test('nothing reopened reads "No gates" (EDS-b)', () => {
    expect(gatesPill({ reopened: [], states: [] })).toMatchObject({
      tone: 'neutral',
      label: 'No gates',
      count: 0,
    })
  })

  test('two reopened gates list their recorded decisions and links, and undo clears them (EDS-i)', () => {
    const files = [file('a.toml', ['g-feel']), file('b.toml', ['g-speed'])]
    const writes = [
      { path: 'a.toml', before: '1', after: '2' },
      { path: 'b.toml', before: '1', after: '2' },
    ]
    const pill = gatesPill({ reopened: reopenedGates(files, changedPaths(writes)), states: STATES })
    expect(pill).toMatchObject({ tone: 'warn', label: '2 gates reopened', count: 2, icon: 'gates' })
    expect(pill.items).toEqual([
      {
        id: 'g-feel',
        label: 'Feel',
        detail: 'approved 2026-10-20',
        tone: 'warn',
        href: 'https://example.com/g-feel',
      },
      { id: 'g-speed', label: 'Speed', detail: 'open', tone: 'warn', href: 'https://example.com/g-speed' },
    ])
    const undone = [
      ...writes,
      { path: 'a.toml', before: '2', after: '1' },
      { path: 'b.toml', before: '2', after: '1' },
    ]
    expect(gatesPill({ reopened: reopenedGates(files, changedPaths(undone)), states: STATES }).label).toBe(
      'No gates',
    )
  })

  test('a reopened gate with no record reads "state unknown"', () => {
    const pill = gatesPill({ reopened: ['g-new'], states: [] })
    expect(pill).toMatchObject({ label: '1 gate reopened' })
    expect(pill.items[0]).toMatchObject({ id: 'g-new', label: 'g-new', detail: 'state unknown' })
  })
})
