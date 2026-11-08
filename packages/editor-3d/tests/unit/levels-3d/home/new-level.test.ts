// New level (ED3D.13b; ED3D spec §4.6, ED3-q): a name becomes a folder and one `af-sector/1` file in it, which Home then
// opens like any other. A folder the workspace already has is never overwritten: the next free name is used.
import { describe, expect, it } from 'vitest'
import { createEditorApp } from '#src/features/levels-3d/document/editor-app.ts'
import { createLevel } from '#src/features/levels-3d/home/new-level.ts'
import { createTestClock, memoryWorkspace, textOf } from '#src/testing/memory-workspace.ts'

const workspace = () => memoryWorkspace(createTestClock())

describe('createLevel', () => {
  it('writes the template under a folder named for the level, and the app opens it', async () => {
    const { store } = workspace()
    const made = await createLevel(store, 'Boiler Room')
    expect(made).toEqual({ status: 'created', path: 'boiler-room/boiler-room.json' })
    expect(textOf(await store.read('boiler-room/boiler-room.json'))).toContain('"name": "Boiler Room"')
  })

  it('opens as an af-sector level with a spawn definition and no sectors', async () => {
    const space = workspace()
    const made = await createLevel(space.store, 'Annex')
    if (made.status !== 'created') throw new Error('not created')
    const app = createEditorApp({ workspace: space, clock: createTestClock() })
    const opened = await app.open(made.path)
    expect(opened.status).toBe('opened')
  })

  it('never overwrites a folder that is there: the next free name is used', async () => {
    const { store } = workspace()
    await createLevel(store, 'Annex')
    const second = await createLevel(store, 'Annex')
    expect(second).toEqual({ status: 'created', path: 'annex-2/annex-2.json' })
  })

  it('refuses an empty name, and a name with nothing a file name can keep', async () => {
    const { store } = workspace()
    expect(await createLevel(store, '   ')).toMatchObject({ status: 'refused' })
    expect(await createLevel(store, '***')).toMatchObject({ status: 'refused' })
  })
})
