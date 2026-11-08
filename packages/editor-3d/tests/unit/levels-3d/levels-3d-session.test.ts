import type { AfSector } from '@automata/3d/level'
import type { WorkspaceFile } from '@automata/editor/kit/ports'
import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { describe, expect, it } from 'vitest'
import { levels3dUndo, openLevels3d } from '#src/features/levels-3d/levels-3d-session.ts'
import { ok } from '#src/shared/edit/edit.ts'
import type { LevelProfile } from '#src/shared/level-session/level-profile.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'

// The Levels 3D session in Node (plan EDS.2d step 4; editor suite spec §4.1, §4.7, EDS-D12): opened over the suite's
// ports, it holds the level editor (history, selection, view) and patches each new step into the file's text, written
// through the suite's workspace. `depot.af-sector.json` is the package's authored sample; `hall` is one of its sectors.

const PATH = 'content/levels/depot.af-sector.json'
const DEPOT = loadAuthored('depot.af-sector')

const file = (path: string): WorkspaceFile => ({
  path,
  editor: 'levels-3d',
  gates: [],
  checks: [],
  modes: ['edit'],
  writable: true,
})

const now = () => 0

async function setup(text = DEPOT) {
  const memory = await createMemoryPorts({ files: { [PATH]: text }, classify: file })
  const session = await openLevels3d([file(PATH)], memory.ports, { now })
  return { ports: memory.ports, session }
}

const dimHall = {
  id: 'test.dim',
  label: 'Dim the hall',
  run: (profile: LevelProfile<unknown>, level: unknown) => {
    const sectors = profile.sectors.list(level as AfSector)
    return ok(
      profile.sectors.withSectors(
        level as AfSector,
        sectors.map((s) => (s.id === 'hall' ? { ...s, light: 0.2 } : s)),
      ),
    )
  },
}

describe('Levels 3D session', () => {
  it('opens the row group’s level with its editor', async () => {
    const { session } = await setup()
    if (session.state.kind !== 'open') throw new Error(session.state.kind)
    expect(session.state.editor.profile.id).toBe('af-sector')
    session.state.editor.selection.set(['hall'])
    expect(session.state.editor.selection.ids).toEqual(['hall'])
  })

  it('makes a file it cannot read a state, not a rejection', async () => {
    const { session } = await setup('{ "format": ')
    expect(session.state.kind).toBe('error')
  })

  it('adapts the level’s history to the suite’s Undo and writes each new step as a patch', async () => {
    const { ports, session } = await setup()
    if (session.state.kind !== 'open') throw new Error(session.state.kind)
    const undo = levels3dUndo(session)
    expect(undo.canUndo()).toBe(false)
    session.state.editor.run(dimHall as never)
    expect(undo.undoLabel()).toBe('Dim the hall')
    await session.settled()
    const written = (await ports.workspace.read(PATH))?.text ?? ''
    expect(written).not.toBe(DEPOT)
    expect(written).toContain('"light": 0.2')
    undo.undo()
    await session.settled()
    expect(undo.canUndo()).toBe(false)
    expect((await ports.workspace.read(PATH))?.text).toBe(written)
  })

  it('writes a step that was drawn live once, when it is committed, so one Undo of the suite takes it back', async () => {
    const memory = await createMemoryPorts({ files: { [PATH]: DEPOT }, classify: file })
    const writes: string[] = []
    const write = memory.ports.workspace.write.bind(memory.ports.workspace)
    const ports = {
      ...memory.ports,
      workspace: {
        ...memory.ports.workspace,
        write: (path: string, text: string, expected: Parameters<typeof write>[2]) => {
          writes.push(text)
          return write(path, text, expected)
        },
      },
    }
    const session = await openLevels3d([file(PATH)], ports as typeof memory.ports, { now })
    if (session.state.kind !== 'open') throw new Error(session.state.kind)
    const { editor } = session.state
    const step = editor.begin('Draw a room')
    step.run(dimHall as never)
    step.run({ ...dimHall, label: 'again' } as never)
    await session.settled()
    expect(writes).toHaveLength(0)
    step.commit()
    await session.settled()
    expect(writes).toHaveLength(1)
    expect(editor.history.undoLabel).toBe('Draw a room')
  })
})
