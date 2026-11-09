import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { undoOf } from '#src/shared/session-hooks.ts'
import { openTomlSession } from '#src/shared/toml-session.ts'

const PATH = 'content/feel/feel.toml'

async function session() {
  const { ports } = await createMemoryPorts({
    files: { [PATH]: 'shake = 0.2\n' },
    classify: (path) => ({
      path,
      editor: 'feel',
      gates: [],
      checks: [],
      modes: ['edit'],
      writable: true,
    }),
  })
  return openTomlSession({ path: PATH, ports, schema: z.strictObject({ shake: z.number() }), empty: '' })
}

describe('the suite hooks of a TOML session', () => {
  it('gives the top bar its Undo and Redo, with their labels', async () => {
    const open = await session()
    const undo = undoOf(open)
    const heard = vi.fn()
    undo.subscribe(heard)
    await open.edit('Shake harder', [{ keyPath: ['shake'], expected: 0.2, set: 0.4 }])
    expect(heard).toHaveBeenCalled()
    expect(undo.canUndo()).toBe(true)
    expect(undo.undoLabel()).toBe('Shake harder')
    undo.undo()
    await vi.waitFor(() => expect(open.history.state.text).toBe('shake = 0.2\n'))
    expect(undo.redoLabel()).toBe('Shake harder')
  })
})
