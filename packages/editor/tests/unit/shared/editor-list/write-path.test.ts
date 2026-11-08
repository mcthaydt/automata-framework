import { describe, expect, test } from 'vitest'
import type { MemoryCheck } from '#src/features/suite/memory/memory-checks.ts'
import { createMemoryPorts } from '#src/features/suite/memory/memory-ports.ts'
import { createWritePath } from '#src/shared/editor-list/write-path.ts'
import type { UnlistedFile, WorkspaceFile } from '#src/shared/kit/ports/suite-ports.ts'
import { createMemoryStore } from '#src/shared/kit/storage/memory-store.ts'
import { type ProjectStore, StorageError } from '#src/shared/kit/storage/project-store.ts'

const TUNING = 'content/tuning.toml'
const NEVER = 'content/secrets.toml'
const CREATED = 'content/poses/wave.toml'
const MODE = 'content/modes/fast.toml'

const classify = (path: string): WorkspaceFile | UnlistedFile => {
  if (path === TUNING)
    return {
      path,
      editor: 'tuner',
      gates: ['g-feel'],
      checks: ['content', 'speed', 'fair'],
      modes: ['edit'],
      writable: true,
    }
  if (path === MODE)
    return { path, editor: 'tuner', gates: [], checks: ['content', 'speed'], modes: ['edit'], writable: true }
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

/** `speed` (before) fails when any candidate is over 9; `fair` (after) measures the value. */
const speedOf = (text: string): number => Number(/= ([\d.]+)/.exec(text)?.[1] ?? 0)
const CHECKS: MemoryCheck[] = [
  {
    id: 'speed',
    when: 'before',
    run: ['speed'],
    joins: [],
    measure: false,
    respond: ({ candidates }) =>
      candidates.some((candidate) => speedOf(candidate.text) > 9)
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

async function setup() {
  const memory = await createMemoryPorts({
    files: {
      [TUNING]: 'MAX_MOVE_SPEED = 7\n',
      [MODE]: 'MAX_MOVE_SPEED = 3\n',
      [NEVER]: 'key = 1\n',
      'notes.txt': 'n\n',
    },
    classify,
    checks: CHECKS,
  })
  const path = createWritePath({ ports: memory.ports })
  return { ...memory, path }
}

const text = async (ports: { workspace: { read(path: string): Promise<{ text: string } | undefined> } }) =>
  (await ports.workspace.read(TUNING))?.text

describe('the write path (flows 3 and 4)', () => {
  test('a failing before check writes nothing and returns its findings (EDS-g)', async () => {
    const { ports, path } = await setup()
    const outcome = await path.write(TUNING, 'MAX_MOVE_SPEED = 12\n', 'Raise speed')
    expect(outcome).toMatchObject({ refused: 'checks', findings: [{ message: 'too fast', line: 1 }] })
    expect(await text(ports)).toBe('MAX_MOVE_SPEED = 7\n')
    expect(path.canUndo()).toBe(false)
  })

  test('a pass writes once and starts the after checks', async () => {
    const { ports, path } = await setup()
    const outcome = await path.write(TUNING, 'MAX_MOVE_SPEED = 8\n', 'Raise speed')
    expect(outcome).toMatchObject({ written: true })
    expect(await text(ports)).toBe('MAX_MOVE_SPEED = 8\n')
    if (!('written' in outcome)) throw new Error('not written')
    expect((await outcome.after?.result())?.map((result) => result.status)).toEqual(['pass'])
    await path.settled()
    expect(path.undoLabel()).toBe('Raise speed')
  })

  test('a never path and an unlisted path are refused with why, and nothing is written', async () => {
    const { ports, path } = await setup()
    expect(await path.write(NEVER, 'key = 2\n', 'Edit')).toEqual({ refused: 'policy', why: 'a never path' })
    expect(await path.write('notes.txt', 'x', 'Edit')).toEqual({
      refused: 'policy',
      why: 'no row of the editor list names it',
    })
    expect((await ports.workspace.read(NEVER))?.text).toBe('key = 1\n')
  })

  test('undo writes the old text back through the same path, and redo writes it again', async () => {
    const { ports, path } = await setup()
    await path.write(TUNING, 'MAX_MOVE_SPEED = 8\n', 'Raise speed')
    expect(await path.undo()).toMatchObject({ written: true })
    expect(await text(ports)).toBe('MAX_MOVE_SPEED = 7\n')
    expect(path.canUndo()).toBe(false)
    expect(path.redoLabel()).toBe('Raise speed')
    expect(await path.redo()).toMatchObject({ written: true })
    expect(await text(ports)).toBe('MAX_MOVE_SPEED = 8\n')
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

  test('a forced write goes over a file that moved on, because the person chose Use mine', async () => {
    const { ports, path } = await setup()
    await path.write(TUNING, 'MAX_MOVE_SPEED = 8\n', 'Raise speed')
    const current = await ports.workspace.read(TUNING)
    await ports.workspace.write(TUNING, 'MAX_MOVE_SPEED = 5\n', { mtime: current?.mtime ?? 0 })
    expect(
      await path.writeAll([{ path: TUNING, text: 'MAX_MOVE_SPEED = 6\n', force: true }], 'Raise speed'),
    ).toMatchObject({ written: true })
    expect(await text(ports)).toBe('MAX_MOVE_SPEED = 6\n')
    // From here the path watches the file again.
    expect(await path.write(TUNING, 'MAX_MOVE_SPEED = 7\n', 'Raise speed')).toMatchObject({ written: true })
  })

  test('listeners hear each change', async () => {
    const { path } = await setup()
    let heard = 0
    path.subscribe(() => heard++)
    await path.write(TUNING, 'MAX_MOVE_SPEED = 8\n', 'Raise speed')
    expect(path.canUndo()).toBe(true)
    expect(heard).toBeGreaterThan(0)
  })
})

describe('writeAll: one step over several files (an import, EDS-D19)', () => {
  const read = async (
    ports: { workspace: { read(path: string): Promise<{ text: string } | undefined> } },
    path: string,
  ) => (await ports.workspace.read(path))?.text

  test('writes every file as one step; one Undo puts all back and one Redo writes all again', async () => {
    const { ports, path } = await setup()
    const outcome = await path.writeAll(
      [
        { path: TUNING, text: 'MAX_MOVE_SPEED = 8\n' },
        { path: MODE, text: 'MAX_MOVE_SPEED = 4\n' },
      ],
      'Import',
    )
    expect(outcome).toMatchObject({ written: true })
    expect(path.undoLabel()).toBe('Import')
    expect(await read(ports, MODE)).toBe('MAX_MOVE_SPEED = 4\n')
    expect(await path.undo()).toMatchObject({ written: true })
    expect([await read(ports, TUNING), await read(ports, MODE)]).toEqual([
      'MAX_MOVE_SPEED = 7\n',
      'MAX_MOVE_SPEED = 3\n',
    ])
    expect(path.canUndo()).toBe(false)
    expect(await path.redo()).toMatchObject({ written: true })
    expect([await read(ports, TUNING), await read(ports, MODE)]).toEqual([
      'MAX_MOVE_SPEED = 8\n',
      'MAX_MOVE_SPEED = 4\n',
    ])
  })

  test('a before check failing on either file writes neither', async () => {
    const { ports, path } = await setup()
    const outcome = await path.writeAll(
      [
        { path: TUNING, text: 'MAX_MOVE_SPEED = 8\n' },
        { path: MODE, text: 'MAX_MOVE_SPEED = 12\n' },
      ],
      'Import',
    )
    expect(outcome).toMatchObject({ refused: 'checks', findings: [{ message: 'too fast' }] })
    expect([await read(ports, TUNING), await read(ports, MODE)]).toEqual([
      'MAX_MOVE_SPEED = 7\n',
      'MAX_MOVE_SPEED = 3\n',
    ])
    expect(path.canUndo()).toBe(false)
  })

  test('an expected mtime that moved on refuses with the path before anything is written', async () => {
    const { ports, path } = await setup()
    const mode = await ports.workspace.read(MODE)
    const tuning = await ports.workspace.read(TUNING)
    await ports.workspace.write(MODE, 'MAX_MOVE_SPEED = 2\n', { mtime: mode?.mtime ?? 0 })
    const outcome = await path.writeAll(
      [
        { path: TUNING, text: 'MAX_MOVE_SPEED = 8\n', expected: { mtime: tuning?.mtime ?? 0 } },
        { path: MODE, text: 'MAX_MOVE_SPEED = 4\n', expected: { mtime: mode?.mtime ?? 0 } },
      ],
      'Import',
    )
    expect(outcome).toEqual({ refused: 'moved', path: MODE })
    expect(await read(ports, TUNING)).toBe('MAX_MOVE_SPEED = 7\n')
  })

  test('a storage failure on the second file puts the first back and keeps no step', async () => {
    const { ports } = await setup()
    const failing = {
      ...ports,
      workspace: {
        ...ports.workspace,
        write: (target: string, body: string, expected: { mtime: number } | 'absent') =>
          target === MODE
            ? Promise.resolve({ ok: false as const, reason: 'quota' as const, message: 'full' })
            : ports.workspace.write(target, body, expected),
      },
    }
    const path = createWritePath({ ports: failing })
    const outcome = await path.writeAll(
      [
        { path: TUNING, text: 'MAX_MOVE_SPEED = 8\n' },
        { path: MODE, text: 'MAX_MOVE_SPEED = 4\n' },
      ],
      'Import',
    )
    expect(outcome).toEqual({ refused: 'storage', reason: 'quota', message: 'full' })
    expect(await read(ports, TUNING)).toBe('MAX_MOVE_SPEED = 7\n')
    expect(path.canUndo()).toBe(false)
  })

  test('Undo of the step when one file moved on is refused with that path, and neither file changes', async () => {
    const { ports, path } = await setup()
    await path.writeAll(
      [
        { path: TUNING, text: 'MAX_MOVE_SPEED = 8\n' },
        { path: MODE, text: 'MAX_MOVE_SPEED = 4\n' },
      ],
      'Import',
    )
    const mode = await ports.workspace.read(MODE)
    await ports.workspace.write(MODE, 'MAX_MOVE_SPEED = 2\n', { mtime: mode?.mtime ?? 0 })
    expect(await path.undo()).toEqual({ refused: 'moved', path: MODE })
    expect([await read(ports, TUNING), await read(ports, MODE)]).toEqual([
      'MAX_MOVE_SPEED = 8\n',
      'MAX_MOVE_SPEED = 2\n',
    ])
    expect(path.canUndo()).toBe(true)
  })

  test('EDS-aa: Undo removes a created file; after an outside edit it is refused with the path and the file stays', async () => {
    const { ports, path } = await setup()
    await path.writeAll([{ path: CREATED, text: 'pose = 1\n', expected: 'absent' }], 'New pose')
    expect(await path.undo()).toMatchObject({ written: true })
    expect(await ports.workspace.read(CREATED)).toBeUndefined()

    await path.writeAll([{ path: CREATED, text: 'pose = 2\n', expected: 'absent' }], 'New pose')
    const created = await ports.workspace.read(CREATED)
    await ports.workspace.write(CREATED, 'pose = 3\n', { mtime: created?.mtime ?? 0 })
    expect(await path.undo()).toEqual({ refused: 'moved', path: CREATED })
    expect(await read(ports, CREATED)).toBe('pose = 3\n')
  })
})

describe('one history per editor (EDS-D19, EDS-k)', () => {
  test('undoes and redoes the named editor’s own last step, leaving another editor’s alone', async () => {
    const { path, ports } = await setup()
    await path.write(MODE, 'MAX_MOVE_SPEED = 4\n', 'Paint', 'levels-2d')
    await path.write(TUNING, 'MAX_MOVE_SPEED = 8\n', 'Raise speed', 'tuner')
    expect(path.undoLabel('levels-2d')).toBe('Paint')
    expect(path.undoLabel('tuner')).toBe('Raise speed')
    expect(path.canUndo()).toBe(false)

    expect(await path.undo('levels-2d')).toEqual(expect.objectContaining({ written: true }))
    expect((await ports.workspace.read(MODE))?.text).toBe('MAX_MOVE_SPEED = 3\n')
    expect(await text(ports)).toBe('MAX_MOVE_SPEED = 8\n')
    expect(path.canUndo('levels-2d')).toBe(false)
    expect(path.redoLabel('levels-2d')).toBe('Paint')
    expect(path.canUndo('tuner')).toBe(true)

    await path.redo('levels-2d')
    expect((await ports.workspace.read(MODE))?.text).toBe('MAX_MOVE_SPEED = 4\n')
  })
})

describe('a file the server stops serving while it is open', () => {
  // `automata editor` re-reads the list: a hand edit that takes a row out makes it answer 403 to the file's reads, and the
  // page, which still has the old list, finds out only when it asks. That is a refusal to say, not an error to throw.
  test('a refused read is a refused write with the server’s words, and nothing is written', async () => {
    const store = createMemoryStore()
    await store.write(TUNING, 'MAX_MOVE_SPEED = 7\n')
    let unlisted = false
    const served: ProjectStore = {
      ...store,
      read: async (path) => {
        if (unlisted && path === TUNING)
          throw new StorageError('policy', `${TUNING} is not one the editor may read`)
        return store.read(path)
      },
    }
    const { ports } = await createMemoryPorts({ classify, checks: CHECKS, store: served })
    const path = createWritePath({ ports })
    unlisted = true
    expect(await path.write(TUNING, 'MAX_MOVE_SPEED = 8\n', 'Raise speed')).toEqual({
      refused: 'policy',
      why: `${TUNING} is not one the editor may read`,
    })
    unlisted = false
    expect((await ports.workspace.read(TUNING))?.text).toBe('MAX_MOVE_SPEED = 7\n')
  })
})
