import { describe, expect, it } from 'vitest'
import { levels2dHomeNames } from '#src/app/suite/levels-2d/levels-2d-home-names.ts'
import type { WorkspaceFile } from '#src/shared/kit/ports/suite-ports.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { levelProject } from '#src/shared/level-2d/profiles/level-project/level-project.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'

// What Home's Characters card lists: the names of the game's characters, read from the level file before it is opened.

const PATH = 'content/levels/world.af2d.json'
const file: WorkspaceFile = {
  path: PATH,
  editor: 'levels-2d',
  gates: [],
  checks: [],
  modes: ['edit'],
  writable: true,
}
const text = levelProject.print('', platformerTemplate.create(counterIds()))
const read = async (path: string) => (path === PATH ? text : undefined)

describe('Levels 2D names on Home', () => {
  it('lists the characters of the game by the names the editor shows', async () => {
    const names = await levels2dHomeNames('characters', [file], read)
    const parsed = levelProject.parse(text)
    if (!parsed.ok) throw new Error('template did not parse')
    expect(names).toEqual(parsed.value.defs.entities.map((entity) => entity.label ?? entity.id))
    expect(names.length).toBeGreaterThan(0)
  })

  it('says nothing for a file it cannot read or a view it has no names for', async () => {
    expect(await levels2dHomeNames('characters', [file], async () => undefined)).toEqual([])
    expect(await levels2dHomeNames('characters', [file], async () => 'not a level')).toEqual([])
    expect(await levels2dHomeNames('level', [file], read)).toEqual([])
  })
})
