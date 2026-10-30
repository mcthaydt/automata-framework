import type { UnlistedFile, WorkspaceFile } from '@mcthaydt/automata-editor-kit/ports'
import { createMemoryPorts, type MemoryCheck } from '@mcthaydt/automata-editor-kit/ports/testing'
import { describe, expect, test } from 'vitest'
import { createWritePath } from './write-path'

const TUNING = 'content/tuning.toml'
const NEVER = 'content/secrets.toml'
const CREATED = 'content/poses/wave.toml'

const classify = (path: string): WorkspaceFile | UnlistedFile => {
  if (path === TUNING)
    return {
      path,
      editor: 'tuner',
      gates: ['g-feel'],
      checks: ['content', 'speed', 'fair'],
      modes: ['edit', 'ask'],
      writable: true,
    }
  if (path === CREATED)
    return { path, editor: 'tuner', gates: [], checks: [], modes: ['edit'], writable: true }
  if (path === NEVER)
    return {
      path,
      editor: 'tuner',
      gates: [],
      checks: [],
      modes: ['edit'],
      writable: false,
      why: 'a never path',
    }
  return { path, writable: false, why: 'no row of the editor list' }
}

/** `speed` (before) fails a candidate over 9; `fair` (after) measures the value. */
const speedOf = (text: string): number => Number(/= ([\d.]+)/.exec(text)?.[1] ?? 0)
const CHECKS: MemoryCheck[] = [
  {
    id: 'speed',
    when: 'before',
    run: ['speed'],
    joins: [],
    measure: false,
    respond: ({ candidates }) =>
      speedOf(candidates[0]?.text ?? '') > 9
        ? {
            status: 'fail',
            findings: [{ path: TUNING, line: 1, severity: 'error', message: 'too fast' }],
            output: '',
          }
        : { status: 'pass', findings: [], output: '' },
  },
  {
    id: 'fair',
    when: 'after',
    run: ['fair'],
    joins: [],
    measure: true,
    respond: () => ({
      status: 'pass',
      findings: [],
      output: '',
      measure: [{ id: 'gap', label: 'Gap', value: 1, ok: true }],
    }),
  },
]

async function setup(options: { changeSet?: false; title?: string | undefined } = {}) {
  const memory = await createMemoryPorts({
    files: { [TUNING]: 'MAX_MOVE_SPEED = 7\n', [NEVER]: 'key = 1\n', 'notes.txt': 'n\n' },
    classify,
    checks: CHECKS,
    ...(options.changeSet === false ? { changeSet: false } : {}),
  })
  const titles: number[] = []
  const path = createWritePath({
    ports: memory.ports,
    title: async () => {
      titles.push(1)
      return 'title' in options ? options.title : 'Faster'
    },
  })
  return { ...memory, path, titles }
}

const text = async (ports: { workspace: { read(path: string): Promise<{ text: string } | undefined> } }) =>
  (await ports.workspace.read(TUNING))?.text

describe('the write path (flows 3 and 4)', () => {
  test('a failing before check writes nothing and returns its findings (EDS-g)', async () => {
    const { ports, path, changeSet } = await setup()
    const outcome = await path.write(TUNING, 'MAX_MOVE_SPEED = 12\n', 'Raise speed')
    expect(outcome).toMatchObject({ refused: 'checks', findings: [{ message: 'too fast', line: 1 }] })
    expect(await text(ports)).toBe('MAX_MOVE_SPEED = 7\n')
    expect((await changeSet?.list())?.[0]?.writes).toEqual([])
    expect(path.canUndo()).toBe(false)
  })

  test('a pass writes once, records the write with its text, and starts the after checks', async () => {
    const { ports, path, changeSet, titles } = await setup()
    const outcome = await path.write(TUNING, 'MAX_MOVE_SPEED = 8\n', 'Raise speed')
    expect(outcome).toMatchObject({ written: true })
    expect(titles).toHaveLength(1)
    expect(await text(ports)).toBe('MAX_MOVE_SPEED = 8\n')
    const [summary] = (await changeSet?.list()) ?? []
    expect(summary).toMatchObject({ title: 'Faster', files: [TUNING] })
    expect(summary?.writes).toEqual([
      { path: TUNING, before: 'MAX_MOVE_SPEED = 7\n', after: 'MAX_MOVE_SPEED = 8\n' },
    ])
    if (!('written' in outcome)) throw new Error('not written')
    expect((await outcome.after?.result())?.map((result) => result.status)).toEqual(['pass'])
    await path.settled()
    expect((await changeSet?.list())?.[0]?.checks).toMatchObject([
      { check: 'fair', status: 'pass', before: [{ value: 1 }], after: [{ value: 1 }] },
      { check: 'speed', status: 'pass' },
    ])
    expect(path.undoLabel()).toBe('Raise speed')
  })

  test('the title is asked once; cancelling it writes nothing and opens no change set', async () => {
    const { ports, path, changeSet } = await setup({ title: undefined })
    expect(await path.write(TUNING, 'MAX_MOVE_SPEED = 8\n', 'Raise speed')).toEqual({ cancelled: true })
    expect(await text(ports)).toBe('MAX_MOVE_SPEED = 7\n')
    expect(await changeSet?.current()).toBeUndefined()
  })

  test('without a change set port the edit goes straight to the workspace, with no title asked', async () => {
    const { ports, path, titles } = await setup({ changeSet: false })
    expect(await path.write(TUNING, 'MAX_MOVE_SPEED = 8\n', 'Raise speed')).toMatchObject({ written: true })
    expect(titles).toEqual([])
    expect(await text(ports)).toBe('MAX_MOVE_SPEED = 8\n')
  })

  test('a never path and an unlisted path are refused with why, and nothing is written or opened', async () => {
    const { ports, path, changeSet } = await setup()
    expect(await path.write(NEVER, 'key = 2\n', 'Edit')).toEqual({ refused: 'policy', why: 'a never path' })
    expect(await path.write('notes.txt', 'x', 'Edit')).toEqual({
      refused: 'policy',
      why: 'no row of the editor list names it',
    })
    expect(await changeSet?.current()).toBeUndefined()
    expect((await ports.workspace.read(NEVER))?.text).toBe('key = 1\n')
  })

  test('undo writes the old text back through the same path, and redo writes it again', async () => {
    const { ports, path, changeSet } = await setup()
    await path.write(TUNING, 'MAX_MOVE_SPEED = 8\n', 'Raise speed')
    expect(await path.undo()).toMatchObject({ written: true })
    expect(await text(ports)).toBe('MAX_MOVE_SPEED = 7\n')
    expect(path.canUndo()).toBe(false)
    expect(path.redoLabel()).toBe('Raise speed')
    expect(await path.redo()).toMatchObject({ written: true })
    expect(await text(ports)).toBe('MAX_MOVE_SPEED = 8\n')
    expect((await changeSet?.list())?.[0]?.writes.map((write) => write.after)).toEqual([
      'MAX_MOVE_SPEED = 8\n',
      'MAX_MOVE_SPEED = 7\n',
      'MAX_MOVE_SPEED = 8\n',
    ])
  })

  test('undo of a write that created a file removes it, and redo creates it again', async () => {
    const { ports, path } = await setup()
    expect(await path.write(CREATED, 'pose = 1\n', 'New pose')).toMatchObject({ written: true })
    expect(await path.undo()).toMatchObject({ written: true })
    expect(await ports.workspace.read(CREATED)).toBeUndefined()
    expect(await path.redo()).toMatchObject({ written: true })
    expect((await ports.workspace.read(CREATED))?.text).toBe('pose = 1\n')
  })

  test('undo of a step whose file moved on is refused with the path, and the step is kept', async () => {
    const { ports, path } = await setup()
    await path.write(TUNING, 'MAX_MOVE_SPEED = 8\n', 'Raise speed')
    const current = await ports.workspace.read(TUNING)
    await ports.workspace.write(TUNING, 'MAX_MOVE_SPEED = 5\n', { mtime: current?.mtime ?? 0 })
    expect(await path.undo()).toEqual({ refused: 'moved', path: TUNING })
    expect(await text(ports)).toBe('MAX_MOVE_SPEED = 5\n')
    expect(path.canUndo()).toBe(true)
  })

  test('a write over a file that moved on since the path last wrote it is refused as moved', async () => {
    const { ports, path } = await setup()
    await path.write(TUNING, 'MAX_MOVE_SPEED = 8\n', 'Raise speed')
    const current = await ports.workspace.read(TUNING)
    await ports.workspace.write(TUNING, 'MAX_MOVE_SPEED = 5\n', { mtime: current?.mtime ?? 0 })
    expect(await path.write(TUNING, 'MAX_MOVE_SPEED = 6\n', 'Raise speed')).toEqual({
      refused: 'moved',
      path: TUNING,
    })
    expect(await text(ports)).toBe('MAX_MOVE_SPEED = 5\n')
  })

  test('beginning a change set and clear() empty the history, and listeners hear each change', async () => {
    const { path } = await setup()
    let heard = 0
    path.subscribe(() => heard++)
    await path.write(TUNING, 'MAX_MOVE_SPEED = 8\n', 'Raise speed')
    expect(path.canUndo()).toBe(true)
    expect(heard).toBeGreaterThan(0)
    path.clear()
    expect(path.canUndo()).toBe(false)
    expect(path.canRedo()).toBe(false)
  })
})
