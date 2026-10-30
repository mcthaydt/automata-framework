// The file a New level starts from (ED3D.13a step 4): a hand-formatted `af-sector/1` file with an empty materials
// table, no sectors, the spawn definition and no things, which the codec then patches like any other level.
import { describe, expect, it } from 'vitest'
import type { AfSector } from '../../format/af-sector.schema'
import { addDefinition } from '../../model/definition-edits'
import type { Edit } from '../../model/edit'
import { createLevelEditor } from '../../model/level-editor'
import { addSector } from '../../model/sector-edits'
import { addThing } from '../../model/thing-edits'
import { rect } from '../../testing/edit-helpers'
import { afSectorProfile } from '../af-sector-profile'
import { addMaterial } from './af-material-edits'
import { newAfSectorLevel } from './af-template'

const EXPECTED = `{
  "format": "af-sector/1",
  "name": "cellar",
  "materials": {},
  "sectors": [],
  "entityDefs": [
    {"id": "spawn", "shape": "point", "single": true, "fields": [{"id": "facing", "type": "angle", "default": 0}]}
  ],
  "entities": []
}
`

const made = (name: string) => {
  const result = newAfSectorLevel(name)
  if (!result.ok) throw new Error(result.reason)
  return result
}

describe('newAfSectorLevel', () => {
  it('writes the starting file, which parses to its model and has no check errors', () => {
    const { text, level } = made('cellar')
    expect(text).toBe(EXPECTED)
    expect(afSectorProfile.parse(text)).toEqual({ ok: true, value: level })
    expect(
      afSectorProfile.checks(level).filter((result) => result.severity === 'error' && !result.ok),
    ).toEqual([])
    expect(afSectorProfile.entities(level).definitions.map((def) => def.id)).toEqual(['spawn'])
  })

  it('trims the name and escapes it as a JSON string', () => {
    expect(made('  cellar  ').level.name).toBe('cellar')
    const quoted = made('the "old" cellar')
    expect(quoted.text).toContain('"name": "the \\"old\\" cellar"')
    expect(quoted.level.name).toBe('the "old" cellar')
  })

  it('refuses an empty name', () => {
    expect(newAfSectorLevel('  ')).toEqual({ ok: false, reason: 'a level has a name' })
  })

  it('is patched from its empty containers: a material, a sector, a definition and a spawn written back re-read the same', () => {
    const { text, level } = made('cellar')
    const e = createLevelEditor({ profile: afSectorProfile, level, now: () => 0 })
    const edits: Edit<AfSector>[] = [
      addMaterial({ id: 'stone', material: { category: 'walls' } }),
      addSector<AfSector>({ id: 'room', corners: rect(0, 0, 6, 4), floor: 0, ceiling: 3 }),
      addDefinition<AfSector>({ definition: { id: 'crate', shape: 'box', size: [1, 1, 1], fields: [] } }),
      addThing<AfSector>({ def: 'spawn', id: 'spawn', x: 1, z: 1 }),
    ]
    for (const edit of edits) expect(e.run(edit)).toMatchObject({ ok: true })
    const saved = afSectorProfile.patch(text, level, e.level)
    if (!saved.ok)
      throw new Error(`the new level does not save: ${JSON.stringify(saved.path)} ${saved.detail}`)
    expect(afSectorProfile.parse(saved.text)).toEqual({ ok: true, value: e.level })
    expect(saved.text.startsWith('{\n  "format": "af-sector/1",\n  "name": "cellar",\n')).toBe(true)
  })
})
