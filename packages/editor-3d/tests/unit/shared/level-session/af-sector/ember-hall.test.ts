// Ember Hall, the room base-3d ships (`games/base-3d/content/levels/room.af-sector.json`): the real file the editor
// opens (Levels 3D spec §5, §7). Its definitions are only ids, so they have to read as points without a word added.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { moveThing } from '#src/shared/edit/thing-edits.ts'
import { afSectorCodec } from '#src/shared/level-session/af-sector/af-codec.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'

const EMBER_HALL_TEXT = readFileSync(
  new URL('../../../../../../../games/base-3d/content/levels/room.af-sector.json', import.meta.url),
  'utf8',
)
const parsed = afSectorProfile.parse(EMBER_HALL_TEXT)
if (!parsed.ok) throw new Error('Ember Hall does not parse')
const emberHall = parsed.value

describe('Ember Hall in the editor', () => {
  it('opens with its seven things and no problems', () => {
    expect(afSectorProfile.entities(emberHall).things.map((thing) => thing.id)).toEqual([
      'spawn',
      'ember-1',
      'ember-2',
      'ember-3',
      'ember-4',
      'ember-5',
      'goal',
    ])
    expect(afSectorProfile.checks(emberHall).filter((check) => !check.ok)).toEqual([])
  })

  it('draws a bare definition as a point, and writes it back untouched', () => {
    expect(afSectorProfile.entities(emberHall).definitions.find((def) => def.id === 'ember')).toMatchObject({
      shape: 'point',
      fields: [],
    })
  })

  it('moves an ember and writes only its place: the definitions stay as the file wrote them', () => {
    const after = moveThing<typeof emberHall>({ def: 'ember', id: 'ember-1', x: -2, z: 3 }).run(
      afSectorProfile,
      emberHall,
    )
    if (!after.ok) throw new Error(after.reason)
    const written = afSectorCodec.patch(EMBER_HALL_TEXT, emberHall, after.level)
    if (!written.ok) throw new Error(written.detail)
    expect(written.text).toContain('{\n      "id": "ember"\n    }')
    expect(JSON.parse(written.text).entityDefs).toEqual(JSON.parse(EMBER_HALL_TEXT).entityDefs)
    expect(JSON.parse(written.text).entities[1]).toEqual({ def: 'ember', id: 'ember-1', x: -2, z: 3 })
  })
})
