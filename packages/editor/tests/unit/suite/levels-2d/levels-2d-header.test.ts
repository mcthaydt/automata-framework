import { get } from 'svelte/store'
import { describe, expect, it } from 'vitest'
import { levels2dHeader } from '#src/app/suite/levels-2d/levels-2d-header.ts'
import { levels2dUndo, openLevels2d } from '#src/app/suite/levels-2d/levels-2d-session.ts'
import { createMemoryPorts } from '#src/features/suite/memory/memory-ports.ts'
import type { WorkspaceFile } from '#src/shared/kit/ports/suite-ports.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { levelProject } from '#src/shared/level-2d/profiles/level-project/level-project.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'

// What Levels 2D puts in the suite's breadcrumb ("Levels / Level 1 ▾" and the views Level and Tiles): it follows the open
// level, the view and the game's levels, and it is what the level picker used to be in the top bar's tools.

const PATH = 'content/levels/world.af2d.json'

const file = (path: string): WorkspaceFile => ({
  path,
  editor: 'levels-2d',
  gates: [],
  checks: [],
  modes: ['edit'],
  writable: true,
})

async function setup() {
  const text = levelProject.print('', platformerTemplate.create(counterIds()))
  const memory = await createMemoryPorts({ files: { [PATH]: text }, classify: file })
  const session = await openLevels2d([file(PATH)], memory.ports, { ids: counterIds(500) })
  return { session, header: levels2dHeader(session) }
}

describe('Levels 2D header', () => {
  it('names the open level, lists the world’s levels with the open one marked, and ends with New level', async () => {
    const { header } = await setup()
    const now = get(header)
    expect(now?.doc?.name).toBe('Level 1')
    expect(now?.doc?.items).toEqual([
      { id: 'level-1', label: 'Level 1', detail: 'Open' },
      'separator',
      { id: 'new-level', label: 'New level', disabled: false, reason: undefined },
    ])
  })

  it('gives the views Level and Tiles, and a chosen view changes the session’s view', async () => {
    const { session, header } = await setup()
    const views = get(header)?.views
    expect(views?.options.map((option) => option.label)).toEqual(['Level', 'Tiles'])
    expect(views?.value).toBe('level')
    views?.onchange('tiles')
    expect(get(session.view)).toBe('tiles')
    expect(get(header)?.views?.value).toBe('tiles')
  })

  it('adds a level as one undo step, opens it, and says its name', async () => {
    const { session, header } = await setup()
    get(header)?.doc?.onselect('new-level')
    expect(get(header)?.doc?.name).toBe('Level 2')
    expect(get(header)?.doc?.items.filter((item) => item !== 'separator')).toHaveLength(3)
    levels2dUndo(session).undo()
    expect(get(header)?.doc?.name).toBe('Level 1')
    expect(get(header)?.doc?.items.filter((item) => item !== 'separator')).toHaveLength(2)
  })

  it('opens another level from the menu', async () => {
    const { session, header } = await setup()
    get(header)?.doc?.onselect('new-level')
    get(header)?.doc?.onselect('level-1')
    if (session.state.kind !== 'open') throw new Error(session.state.kind)
    expect(session.state.level.editor.view.level).toBe('level-1')
    expect(get(header)?.doc?.name).toBe('Level 1')
  })

  it('has nothing to say on the Characters view, which has neither views nor a level to pick', async () => {
    const { session, header } = await setup()
    session.view.set('characters')
    expect(get(header)).toBeUndefined()
    session.view.set('level')
    expect(get(header)?.doc?.name).toBe('Level 1')
  })

  it('offers no level menu on the Tiles view, only the views', async () => {
    const { session, header } = await setup()
    session.view.set('tiles')
    expect(get(header)?.doc).toBeUndefined()
    expect(get(header)?.views?.value).toBe('tiles')
  })
})
