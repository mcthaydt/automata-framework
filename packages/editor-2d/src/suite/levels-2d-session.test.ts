import type { WorkspaceFile } from '@mcthaydt/automata-editor-kit/ports'
import { createMemoryPorts } from '@mcthaydt/automata-editor-kit/ports/testing'
import { describe, expect, it } from 'vitest'
import { counterIds } from '../model/ids'
import type { Project } from '../model/project-types'
import { levelProject } from '../profiles/level-project/level-project'
import { platformerTemplate } from '../profiles/level-project/templates/platformer'
import { levels2dUndo, openLevels2d } from './levels-2d-session'

// The Levels 2D session in Node (plan EDS.2d step 1; editor suite spec §4.1, §4.7, EDS-D12): it is opened over the
// suite's ports, holds the document's history and the Level view's session, and writes every new step through the
// suite's workspace. The platformer's `level-1` is 512 × 288 on a 16 px grid; the view opens on its entity layer, so a tap places one.

const PATH = 'content/levels/world.af2d.json'

const file = (path: string): WorkspaceFile => ({
  path,
  editor: 'levels-2d',
  gates: [],
  checks: [],
  modes: ['edit'],
  writable: true,
})

async function setup(text = levelProject.print('', platformerTemplate.create(counterIds()))) {
  const memory = await createMemoryPorts({ files: { [PATH]: text }, classify: file, changeSet: false })
  const session = await openLevels2d([file(PATH)], memory.ports, { ids: counterIds(500) })
  return { ports: memory.ports, session }
}

describe('Levels 2D session', () => {
  it('opens the row group’s level project on its first level', async () => {
    const { session } = await setup()
    expect(session.path).toBe(PATH)
    if (session.state.kind !== 'open') throw new Error(session.state.kind)
    expect(session.state.level.editor.view.level).toBe('level-1')
  })

  it('makes a broken file a state, not a rejection', async () => {
    const { session } = await setup('{ "format": "af2d", ')
    expect(session.state.kind).toBe('error')
    if (session.state.kind === 'error') expect(session.state.message).toMatch(/can’t be opened/)
  })

  it('adapts the document’s history to the suite’s Undo, and writes each new step', async () => {
    const { ports, session } = await setup()
    if (session.state.kind !== 'open') throw new Error(session.state.kind)
    const undo = levels2dUndo(session)
    expect(undo.canUndo()).toBe(false)
    let heard = 0
    undo.subscribe(() => (heard += 1))

    const { editor } = session.state.level
    editor.pointerDown({ x: 8, y: 8 })
    editor.pointerUp()
    expect(undo.canUndo()).toBe(true)
    expect(undo.undoLabel()).toBe('Place entity')
    expect(heard).toBeGreaterThan(0)
    await session.settled()
    const written = await ports.workspace.read(PATH)
    expect(written?.text).toBe(levelProject.print('', session.state.history.state as Project))

    undo.undo()
    expect(undo.canUndo()).toBe(false)
    expect(undo.canRedo()).toBe(true)
    await session.settled()
    // The suite's write path puts the file back on Undo; the session's own Undo does not write it again.
    expect((await ports.workspace.read(PATH))?.text).toBe(written?.text)
  })

  it('takes a step back when the workspace refuses its write, and says why', async () => {
    const memory = await createMemoryPorts({
      files: { [PATH]: levelProject.print('', platformerTemplate.create(counterIds())) },
      classify: (path) => ({ ...file(path), writable: false, why: 'generated' }),
      changeSet: false,
    })
    const session = await openLevels2d([file(PATH)], memory.ports, { ids: counterIds(500) })
    if (session.state.kind !== 'open') throw new Error(session.state.kind)
    session.state.level.editor.pointerDown({ x: 8, y: 8 })
    session.state.level.editor.pointerUp()
    await session.settled()
    expect(session.state.history.canUndo).toBe(false)
    expect(session.refusal).toMatch(/generated/)
  })
})
