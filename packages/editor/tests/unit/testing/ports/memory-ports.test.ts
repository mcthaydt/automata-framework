// The in-memory fakes of the suite ports, each run through its port's contract, and the wiring of `createMemoryPorts`.
// The workspace contract runs where the editor list's policy lives (editor-suite's core, `memory-workspace.test.ts`
// there), so here the workspace gets a small hand-written policy for its fake-only cases.
import { describe, expect, test } from 'vitest'
import type { UnlistedFile, WorkspaceFile } from '#src/shared/kit/ports/suite-ports.ts'
import {
  CHECK_FINDING,
  CHECK_MEASURE,
  describeChecksRunner,
  type ScenarioCheck,
} from '#src/testing/ports/checks-contract.ts'
import { describeGates } from '#src/testing/ports/gates-contract.ts'
import {
  createMemoryChecks,
  createMemoryGates,
  createMemoryPorts,
  createMemoryWorkspace,
  type MemoryCheck,
} from '#src/testing/ports/index.ts'

const POSE = 'content/figures/poses/wave.toml'

/** A hand policy: poses are the Studio's, `content/locked.toml` is read only, anything else has no row. */
function classify(path: string): WorkspaceFile | UnlistedFile {
  const row = { path, gates: [], checks: ['content'], modes: ['edit'] } as const
  if (path.startsWith('content/figures/poses/')) return { ...row, editor: 'studio', writable: true }
  if (path === 'content/locked.toml')
    return { ...row, editor: 'tuner', writable: false, why: 'locked for the test' }
  return { path, writable: false, why: 'no row' }
}

/** The scenario's behaviours as fake checks. */
function memoryCheck({ behaviour, ...def }: ScenarioCheck): MemoryCheck {
  const passed = { status: 'pass', findings: [], output: `${def.id}: ok` } as const
  switch (behaviour) {
    case 'pass':
      return { ...def, respond: () => passed }
    case 'fail':
      return {
        ...def,
        respond: () => ({ status: 'fail', findings: [CHECK_FINDING], output: CHECK_FINDING.message }),
      }
    case 'crash':
      return {
        ...def,
        respond: () => {
          throw new Error('the check crashed')
        },
      }
    case 'candidate':
      return {
        ...def,
        respond: ({ candidates }) => {
          const todo = candidates.filter((candidate) => candidate.text.includes('TODO'))
          if (todo.length === 0) return passed
          return {
            status: 'fail',
            findings: todo.map(({ path }) => ({ path, severity: 'error', message: 'a TODO is left' })),
            output: 'a TODO is left',
          }
        },
      }
    case 'measure':
      return { ...def, respond: () => ({ ...passed, measure: CHECK_MEASURE }) }
    case 'join':
      return { ...def, respond: () => ({ ...passed, joined: def.joins }) }
    case 'wait':
      return { ...def, respond: () => new Promise(() => undefined) }
  }
}

describeChecksRunner('memory', (scenario) => createMemoryChecks(scenario.map(memoryCheck)))

describeGates('memory', (records) => createMemoryGates(records))

describe('memory checks', () => {
  test('give a check that respects the abort signal its cancellation', async () => {
    let aborted = false
    const checks = createMemoryChecks([
      {
        id: 'slow',
        when: 'after',
        run: [],
        joins: [],
        measure: false,
        respond: ({ signal }) =>
          new Promise((_, reject) => {
            signal.addEventListener('abort', () => {
              aborted = true
              reject(new Error('stopped'))
            })
          }),
      },
    ])
    const run = await checks.run({ checks: ['slow'] })
    run.cancel()
    expect(await run.result()).toEqual([expect.objectContaining({ status: 'error', output: 'cancelled' })])
    expect(aborted).toBe(true)
  })
})

describe('memory workspace', () => {
  test('lists only files a row names, refuses read-only and unlisted writes with the reason', async () => {
    const workspace = await createMemoryWorkspace({
      files: { 'content/locked.toml': 'a = 1\n', 'README.md': '#\n' },
      classify,
    })
    expect((await workspace.files()).map((file) => file.path)).toEqual(['content/locked.toml'])
    const locked = await workspace.write('content/locked.toml', 'a = 2\n', 'absent')
    expect(locked).toMatchObject({
      ok: false,
      reason: 'policy',
      message: expect.stringContaining('locked for the test'),
    })
    expect(await workspace.write('README.md', 'x\n', 'absent')).toMatchObject({ ok: false, reason: 'policy' })
  })

  test('removes only what it created, at the mtime it made', async () => {
    const workspace = await createMemoryWorkspace({
      classify,
      files: { 'content/figures/poses/old.toml': 'x = 1\n' },
    })
    const created = await workspace.write(POSE, 'name = "wave"\n', 'absent')
    if (!created.ok) throw new Error('the create should go through')
    const old = await workspace.read('content/figures/poses/old.toml')
    expect(
      await workspace.remove('content/figures/poses/old.toml', { mtime: old?.mtime ?? 0 }),
    ).toMatchObject({
      ok: false,
      reason: 'policy',
    })
    expect(await workspace.remove(POSE, { mtime: created.mtime })).toMatchObject({ ok: true })
  })
})

describe('createMemoryPorts', () => {
  test('wires the workspace, the checks and the gates', async () => {
    const memory = await createMemoryPorts({
      classify,
      gates: { 'S-G1': { name: 'Scene blockout', decision: 'open' } },
    })
    const { workspace, gates, checks } = memory.ports
    if (gates === undefined) throw new Error('every port is there')
    expect(checks.declared()).toEqual([])
    expect(await gates.states(['S-G1'])).toMatchObject([{ decision: 'open' }])
    expect(await workspace.write(POSE, 'name = "wave"\n', 'absent')).toMatchObject({ ok: true })
  })

  test('a port left out is the feature off', async () => {
    const { ports } = await createMemoryPorts({ classify })
    expect(ports.gates).toBeUndefined()
  })
})
