// The in-memory fakes of the suite ports, each run through its port's contract, and the wiring of `createMemoryPorts`.
// The workspace contract runs where the editor list's policy lives (editor-suite's core, `memory-workspace.test.ts`
// there), so here the workspace gets a small hand-written policy for its fake-only cases.
import { describe, expect, test } from 'vitest'
import type { UnlistedFile, WorkspaceFile } from '#src/shared/kit/ports/suite-ports.ts'
import { describeAskProvider } from '#src/testing/ports/ask-contract.ts'
import { describeChangeSet } from '#src/testing/ports/change-set-contract.ts'
import {
  CHECK_FINDING,
  CHECK_MEASURE,
  describeChecksRunner,
  type ScenarioCheck,
} from '#src/testing/ports/checks-contract.ts'
import { describeGates } from '#src/testing/ports/gates-contract.ts'
import {
  createMemoryChangeSet,
  createMemoryChecks,
  createMemoryGates,
  createMemoryPorts,
  createMemoryWorkspace,
  createScriptedAsk,
  type MemoryCheck,
} from '#src/testing/ports/index.ts'

describeChangeSet('memory', () => ({ changeSet: createMemoryChangeSet(), edit: async () => undefined }))

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

describeAskProvider(
  'scripted',
  (script) =>
    createScriptedAsk((request, limits) => {
      const answer = script(request, limits)
      if (answer instanceof Error) throw answer
      return answer
    }).provider,
)

describe('memory change set', () => {
  test('names branches as the adventure source does, from the base it was given', async () => {
    const changeSet = createMemoryChangeSet({ base: 'trunk' })
    await changeSet.begin('Bay: arrival timing!')
    expect(await changeSet.current()).toEqual({
      title: 'Bay: arrival timing!',
      branch: 'edit/bay-arrival-timing',
      base: 'trunk',
    })
  })

  test('ship gives a draft PR only when gh is there; the compare link carries the draft', async () => {
    const without = createMemoryChangeSet({ remote: 'https://github.com/owner/game' })
    await without.begin('Faster')
    expect(await without.ship({ title: 'Tuning: faster', body: 'Lens 28 → 30.' })).toEqual({
      branch: 'edit/faster',
      pushed: true,
      compareUrl:
        'https://github.com/owner/game/compare/main...edit/faster?expand=1&title=Tuning%3A%20faster&body=Lens%2028%20%E2%86%92%2030.',
    })
    const withGh = createMemoryChangeSet({ gh: true })
    await withGh.begin('Faster')
    expect((await withGh.ship({ title: 'x', body: '' })).pr).toMatch(/\/pull\/\d+$/)
  })

  test('the token cap is 200 000 unless given', async () => {
    const changeSet = createMemoryChangeSet()
    await changeSet.begin('A')
    expect((await changeSet.list())[0]?.tokens).toEqual({ used: 0, cap: 200_000 })
    const capped = createMemoryChangeSet({ tokenCap: 500 })
    await capped.begin('B')
    expect((await capped.list())[0]?.tokens.cap).toBe(500)
  })
})

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

  test('without a change set nothing it created can be removed', async () => {
    const workspace = await createMemoryWorkspace({ classify })
    const created = await workspace.write(POSE, 'name = "wave"\n', 'absent')
    if (!created.ok) throw new Error('the create should go through')
    expect(await workspace.remove(POSE, { mtime: created.mtime })).toMatchObject({
      ok: false,
      reason: 'policy',
    })
  })
})

describe('createMemoryPorts', () => {
  test('wires the workspace, the change set, checks, gates and Ask over one journal', async () => {
    const memory = await createMemoryPorts({
      classify,
      gates: { 'S-G1': { name: 'Scene blockout', decision: 'open' } },
      ask: () => ({ summary: 'Faster', text: 'MAX_MOVE_SPEED = 7.5\n', tokens: 300 }),
    })
    const { workspace, changeSet, gates, ask, checks } = memory.ports
    if (changeSet === undefined || ask === undefined || gates === undefined)
      throw new Error('every port is there')
    expect(checks.declared()).toEqual([])
    expect(await gates.states(['S-G1'])).toMatchObject([{ decision: 'open' }])

    await changeSet.begin('A wave pose')
    await workspace.write(POSE, 'name = "wave"\n', 'absent')
    const request = { prompt: 'p', path: 'content/tuning.toml', scope: [], document: '', budget: 1000 }
    await ask.propose(request)
    await ask.propose(request)
    expect(await changeSet.list()).toEqual([
      expect.objectContaining({ created: [POSE], tokens: { used: 600, cap: 200_000 } }),
    ])
    expect(memory.ask?.calls).toEqual([request, request])
  })

  test('the Ask spends through ChangeSet.spend, so the cap the person raised stays put', async () => {
    const memory = await createMemoryPorts({ classify, ask: () => ({ summary: 's', text: '', tokens: 40 }) })
    const { changeSet, ask } = memory.ports
    await changeSet?.begin('A')
    await changeSet?.raiseCap(250_000)
    await ask?.propose({ prompt: 'p', path: 'a', scope: [], document: '', budget: 100 })
    expect((await changeSet?.list())?.[0]?.tokens).toEqual({ used: 40, cap: 250_000 })
  })

  test('without a change set or an assistant, those ports are absent: the features are off', async () => {
    const { ports } = await createMemoryPorts({ classify, changeSet: false })
    expect(ports.changeSet).toBeUndefined()
    expect(ports.ask).toBeUndefined()
    expect(ports.gates).toBeUndefined()
    expect(await ports.workspace.write(POSE, 'x = 1\n', 'absent')).toMatchObject({ ok: true })
  })

  test('tokens an Ask uses with no change set open are not counted against a later one', async () => {
    const { ports } = await createMemoryPorts({
      classify,
      ask: () => ({ summary: 's', text: '', tokens: 50 }),
    })
    await ports.ask?.propose({ prompt: 'p', path: 'a', scope: [], document: '', budget: 100 })
    await ports.changeSet?.begin('Later')
    expect((await ports.changeSet?.list())?.[0]?.tokens.used).toBe(0)
  })
})
