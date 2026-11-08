import { describe, expect, test } from 'vitest'
import { EDITOR_LIST_PATH, loadEditorList, workspaceFile } from '#src/features/suite/core/index.ts'
import type { MemoryCheck } from '#src/features/suite/memory/memory-checks.ts'
import { createMemoryPorts } from '#src/features/suite/memory/memory-ports.ts'
import { createSuiteSession } from '#src/features/suite/shell/suite-session.ts'

const TUNING = 'content/tuning.toml'
const LIST = `format = "af-editors/1"
[[file]]
glob = "${TUNING}"
editor = "tuner"
modes = ["edit"]
gates = []
checks = ["no-nines", "after-check"]

[[check]]
id = "no-nines"
when = "before"
run = ["no-nines"]

[[check]]
id = "after-check"
when = "after"
run = ["after-check"]
`
const FILES = {
  [EDITOR_LIST_PATH]: LIST,
  [TUNING]: 'MAX_MOVE_SPEED = 356.0\n',
}

/** A check that fails any file with a 9 in it, so a write can be refused before it is made. */
const NO_NINES: MemoryCheck = {
  id: 'no-nines',
  when: 'before',
  run: ['no-nines'],
  joins: [],
  measure: false,
  respond: ({ candidates }) =>
    candidates.some((candidate) => candidate.text.includes('9'))
      ? { status: 'fail', findings: [{ path: TUNING, severity: 'error', message: 'no nines' }], output: '' }
      : { status: 'pass', findings: [], output: '' },
}

function loadedList() {
  const load = loadEditorList(LIST)
  if (!load.ok) throw new Error('fixture list does not load')
  return load.list
}

async function setup(checks: readonly MemoryCheck[] = []) {
  const load = loadEditorList(LIST)
  if (!load.ok) throw new Error('fixture list does not load')
  const memory = await createMemoryPorts({
    files: FILES,
    classify: (path) => workspaceFile(load.list, path),
    checks,
  })
  return { ...memory, session: createSuiteSession(memory.ports) }
}

describe('the session behind the suite’s editors', () => {
  test('an editor’s write goes through the write path: written once, and Undo takes it back', async () => {
    const { session, ports } = await setup()
    const mine = session.portsFor('tuner')
    expect(await mine.workspace.write(TUNING, 'MAX_MOVE_SPEED = 400.0\n', { mtime: 0 })).toMatchObject({
      ok: true,
    })
    expect((await ports.workspace.read(TUNING))?.text).toBe('MAX_MOVE_SPEED = 400.0\n')
    expect(session.writePath.undoLabel('tuner')).toBe('Edit')
    expect(await session.undo('tuner')).toMatchObject({ written: true })
    expect((await ports.workspace.read(TUNING))?.text).toBe('MAX_MOVE_SPEED = 356.0\n')
  })

  test('a before check that fails refuses the write, in the check’s words', async () => {
    const { session, ports } = await setup([NO_NINES])
    const result = await session
      .portsFor('tuner')
      .workspace.write(TUNING, 'MAX_MOVE_SPEED = 999.0\n', { mtime: 0 })
    expect(result).toMatchObject({ ok: false, reason: 'policy', message: 'no nines' })
    expect((await ports.workspace.read(TUNING))?.text).toBe('MAX_MOVE_SPEED = 356.0\n')
  })

  test('the checks pill starts quiet and shows the latest run of each check', async () => {
    const { session } = await setup([
      {
        ...NO_NINES,
        id: 'after-check',
        when: 'after',
        respond: () => ({ status: 'pass', findings: [], output: '' }),
      },
    ])
    expect(session.pills().map((pill) => [pill.icon, pill.tone])).toEqual([['checks', 'neutral']])
    const outcome = await session.writePath.write(TUNING, 'MAX_MOVE_SPEED = 400.0\n', 'Edit', 'tuner')
    await session.follow(outcome)
    const [pill] = session.pills()
    expect(pill).toMatchObject({ icon: 'checks', tone: 'pass', label: 'Checks pass' })
  })

  test('an editor lists itself through the suite’s raw ports, so the rows are not an undo step', async () => {
    const memory = await createMemoryPorts({
      files: FILES,
      classify: (path) => workspaceFile(loadedList(), path),
      listChanged: () => undefined,
    })
    const session = createSuiteSession(memory.ports)
    const mine = session.portsFor('feel')
    expect(await mine.list?.ensure('feel')).toMatchObject({ ok: true })
    expect((await memory.ports.workspace.read(EDITOR_LIST_PATH))?.text).toContain('content/feel/*.toml')
    expect(session.writePath.undoLabel('feel')).toBeUndefined()
    // A second ask has nothing to add.
    expect(await mine.list?.ensure('feel')).toEqual({ ok: true, unchanged: true })
  })

  test('listeners hear each change to the pill', async () => {
    const { session } = await setup()
    let heard = 0
    session.subscribe(() => heard++)
    await session.portsFor('tuner').workspace.write(TUNING, 'MAX_MOVE_SPEED = 400.0\n', { mtime: 0 })
    expect(heard).toBeGreaterThan(0)
  })
})
