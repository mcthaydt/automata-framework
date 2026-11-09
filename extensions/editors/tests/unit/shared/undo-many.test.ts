import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { openTomlSession } from '#src/shared/toml-session.ts'
import { UndoTrail } from '#src/shared/undo-many.ts'

async function two() {
  const { ports } = await createMemoryPorts({
    files: { 'a.toml': 'n = 1\n', 'b.toml': 'n = 1\n' },
    classify: (path) => ({ path, editor: 'writer', gates: [], checks: [], modes: ['edit'], writable: true }),
  })
  const open = (path: string) =>
    openTomlSession({ path, ports, schema: z.strictObject({ n: z.number() }), empty: '' })
  return { a: await open('a.toml'), b: await open('b.toml') }
}

describe('one Undo over several files', () => {
  it('takes back the file that was written last, then the one before', async () => {
    const { a, b } = await two()
    const trail = new UndoTrail()
    trail.add(a)
    trail.add(b)
    const undo = trail.hook()
    const heard = vi.fn()
    undo.subscribe(heard)
    await a.edit('Write the player’s line', [{ keyPath: ['n'], expected: 1, set: 2 }])
    await b.edit('Add a choice', [{ keyPath: ['n'], expected: 1, set: 3 }])
    expect(heard).toHaveBeenCalled()
    expect(undo.undoLabel()).toBe('Add a choice')
    undo.undo()
    await vi.waitFor(() => expect(b.history.state.text).toBe('n = 1\n'))
    expect(a.history.state.text).toBe('n = 2\n')
    expect(undo.undoLabel()).toBe('Write the player’s line')
    expect(undo.redoLabel()).toBe('Add a choice')
    undo.undo()
    await vi.waitFor(() => expect(a.history.state.text).toBe('n = 1\n'))
    expect(undo.canUndo()).toBe(false)
    undo.redo()
    await vi.waitFor(() => expect(a.history.state.text).toBe('n = 2\n'))
    expect(undo.undoLabel()).toBe('Write the player’s line')
  })

  it('forgets what could be redone once something new is written', async () => {
    const { a, b } = await two()
    const trail = new UndoTrail()
    trail.add(a)
    trail.add(b)
    const undo = trail.hook()
    await a.edit('One', [{ keyPath: ['n'], expected: 1, set: 2 }])
    undo.undo()
    await vi.waitFor(() => expect(a.history.state.text).toBe('n = 1\n'))
    await b.edit('Two', [{ keyPath: ['n'], expected: 1, set: 5 }])
    expect(undo.canRedo()).toBe(false)
  })
})
