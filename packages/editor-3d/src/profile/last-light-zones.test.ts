// Last Light's camera zones as things (ED3D.7c step 2): a zone stands at its look point, its area is four sides, and the
// thing edits write it back into the `zones` list in the file's own order, refused in the `ids` check's sentences where
// they would break its zone rules. Clinic-dawn's zones are the hall (the first: no area), the corridor (`z1` -1.25) and
// the closet (`x0` 1.7, `z1` -1.25, a camera `x` of 2.2); its rooms name all three.
import { describe, expect, it } from 'vitest'
import { idProblems } from '../checks/last-light/ids'
import type { Blockout, ZoneSpec } from '../format/blockout.schema'
import { expand } from '../format/expand'
import type { Edit } from '../model/edit'
import { addThing, moveThing, removeThing, setThingField } from '../model/thing-edits'
import { levelOf, reasonOf } from '../testing/edit-helpers'
import { loadFixture } from '../testing/fixtures'
import { literalEdits } from '../testing/text-diff'
import { must, toyBlockout } from '../testing/toy-blockout'
import { blockoutCodec } from './last-light-codecs'
import { lastLightProfile } from './last-light-profile'
import { lastLightThingAccess } from './last-light-things'

const text = loadFixture('blockout-clinic-dawn')
const dawn: Blockout = (() => {
  const result = blockoutCodec.parse(text)
  if (!result.ok) throw new Error('clinic-dawn does not parse')
  return result.value
})()

const run = (edit: Edit<Blockout>, level: Blockout = dawn) => edit.run(lastLightProfile, level)
const zoneOf = (level: Blockout, id: string): ZoneSpec => must(level.zones.find((zone) => zone.id === id))
const patched = (before: Blockout, after: Blockout): string => {
  const result = blockoutCodec.patch(text, before, after)
  if (!result.ok) throw new Error(`patch refused at ${JSON.stringify(result.path)}: ${result.detail}`)
  return result.text
}
const zoneMessages = (level: Blockout) =>
  idProblems(level, expand(level))
    .map((problem) => problem.message)
    .filter((message) => message.includes('zone'))

describe('moving a zone', () => {
  it('moves its look point and nothing else, the camera x and the enter rule kept', () => {
    const level = levelOf(run(moveThing({ def: 'zone', id: 'closet', x: 3, z: -4.5 })))
    expect(zoneOf(level, 'closet')).toEqual({
      ...zoneOf(dawn, 'closet'),
      look: [3, 0.6, -4.5],
    })
    expect(Object.keys(zoneOf(level, 'closet'))).toEqual(Object.keys(zoneOf(dawn, 'closet')))
    const at = dawn.zones.findIndex((zone) => zone.id === 'closet')
    expect(literalEdits(text, patched(dawn, level))).toEqual([
      `["zones",${at},"look",0]`,
      `["zones",${at},"look",2]`,
    ])
  })

  it('changes its look height with a y', () => {
    const level = levelOf(run(moveThing({ def: 'zone', id: 'hall', x: 0, z: 0.75, y: 1.4 })))
    expect(zoneOf(level, 'hall').look).toEqual([0, 1.4, 0.75])
  })
})

describe('setting a side of a zone', () => {
  it('gives the area that side, and clearing it takes the side away', () => {
    const level = levelOf(run(setThingField({ def: 'zone', id: 'corridor', field: 'x1', value: 1.5 })))
    expect(zoneOf(level, 'corridor').area).toEqual({
      z: [null, -1.25],
      x: [null, 1.5],
    })
    const back = levelOf(
      run(
        setThingField({
          def: 'zone',
          id: 'corridor',
          field: 'x1',
          value: null,
        }),
        level,
      ),
    )
    expect(zoneOf(back, 'corridor').area).toEqual({ z: [null, -1.25] })
  })

  it('keeps the area as the very same value when the sides are what they were', () => {
    const level = levelOf(
      run(
        setThingField({
          def: 'zone',
          id: 'closet',
          field: 'distance',
          value: 14,
        }),
      ),
    )
    expect(zoneOf(level, 'closet').area).toBe(zoneOf(dawn, 'closet').area)
    expect(zoneOf(level, 'closet').distance).toBe(14)
  })

  it("refuses to take a later zone's last side away, in the ids check's sentence", () => {
    expect(
      reasonOf(
        run(
          setThingField({
            def: 'zone',
            id: 'corridor',
            field: 'z1',
            value: null,
          }),
        ),
      ),
    ).toBe('zone corridor needs an area (only the first zone covers the rest)')
  })

  it('refuses a side on the first zone, which is the rest of the map', () => {
    expect(reasonOf(run(setThingField({ def: 'zone', id: 'hall', field: 'x0', value: 2 })))).toBe(
      'the first zone has no area: it is the rest of the map',
    )
  })

  it('refuses two sides of one axis less than half a metre apart, or the wrong way round', () => {
    expect(reasonOf(run(setThingField({ def: 'zone', id: 'closet', field: 'x1', value: 2 })))).toBe(
      'the area is at least 0.5 m along x',
    )
    expect(reasonOf(run(setThingField({ def: 'zone', id: 'closet', field: 'x1', value: 1 })))).toBe(
      'the area is at least 0.5 m along x',
    )
  })

  it('refuses a follow past 1 by the field, and takes 1 (the follow camera) and 0 (a fixed shot)', () => {
    expect(
      reasonOf(
        run(
          setThingField({
            def: 'zone',
            id: 'hall',
            field: 'follow',
            value: 1.5,
          }),
        ),
      ),
    ).toMatch(/^entity hall: follow/)
    for (const follow of [0, 1])
      expect(
        zoneOf(
          levelOf(
            run(
              setThingField({
                def: 'zone',
                id: 'hall',
                field: 'follow',
                value: follow,
              }),
            ),
          ),
          'hall',
        ).follow,
      ).toBe(follow)
  })
})

describe('adding a zone', () => {
  const office = { x0: 2.5, z0: -7, x1: 5, z1: -5 }

  it('appends id, look, distance, follow and area in the order of the file, at the look height given', () => {
    const level = levelOf(
      run(
        addThing({
          def: 'zone',
          id: 'office',
          x: 3.75,
          z: -6,
          y: 1,
          values: { distance: 14, follow: 1, ...office },
        }),
      ),
    )
    const added = must(level.zones.at(-1))
    expect(added).toEqual({
      id: 'office',
      look: [3.75, 1, -6],
      distance: 14,
      follow: 1,
      area: { x: [2.5, 5], z: [-7, -5] },
    })
    expect(Object.keys(added)).toEqual(['id', 'look', 'distance', 'follow', 'area'])
    expect(level.zones.slice(0, -1)).toEqual(dawn.zones)
    expect(zoneMessages(level)).toEqual(zoneMessages(dawn))
    const written = blockoutCodec.parse(patched(dawn, level))
    expect(written.ok && written.value).toEqual(level)
  })

  it('floats at the floor of its sector when no height is given', () => {
    const level = levelOf(
      run(
        addThing({
          def: 'zone',
          id: 'office',
          x: 3.75,
          z: -6,
          values: { distance: 14, ...office },
        }),
      ),
    )
    expect(must(level.zones.at(-1)).look).toEqual([3.75, 0, -6])
  })

  it('is refused without an area, as a later zone needs one, and with no distance', () => {
    expect(
      reasonOf(
        run(
          addThing({
            def: 'zone',
            id: 'office',
            x: 3.75,
            z: -6,
            values: { distance: 14 },
          }),
        ),
      ),
    ).toBe('zone office needs an area (only the first zone covers the rest)')
    expect(
      reasonOf(
        run(
          addThing({
            def: 'zone',
            id: 'office',
            x: 3.75,
            z: -6,
            values: office,
          }),
        ),
      ),
    ).toMatch(/^entity office: .*distance/)
  })

  it('takes the id of no other zone', () => {
    expect(lastLightThingAccess.takenIds(dawn, 'zone')).toEqual(['hall', 'corridor', 'closet'])
    expect(
      reasonOf(
        run(
          addThing({
            def: 'zone',
            id: 'closet',
            x: 3.75,
            z: -6,
            values: { distance: 14, ...office },
          }),
        ),
      ),
    ).toBe('there is already something called closet')
  })

  it('is the first zone, with no area, in a level that has none', () => {
    const empty = toyBlockout({ zones: [] })
    const level = levelOf(
      run(
        addThing({
          def: 'zone',
          id: 'a',
          x: 2,
          z: 2,
          values: { distance: 14 },
        }),
        empty,
      ),
    )
    expect(level.zones).toEqual([{ id: 'a', look: [2, 0, 2], distance: 14 }])
    expect(
      reasonOf(
        run(
          addThing({
            def: 'zone',
            id: 'a',
            x: 2,
            z: 2,
            values: { distance: 14, ...office },
          }),
          empty,
        ),
      ),
    ).toBe('the first zone has no area: it is the rest of the map')
  })
})

describe('removing a zone', () => {
  it('is refused while a room names it', () => {
    expect(reasonOf(run(removeThing({ def: 'zone', id: 'closet' })))).toBe(
      'zone closet is still referenced: room closet: zone closet',
    )
  })

  it('is refused while an opening names it', () => {
    const toy = toyBlockout()
    const level: Blockout = {
      ...toy,
      zones: [...toy.zones, { id: 'door', look: [4, 1, 2], distance: 14, area: { x: [3.5, 4.5] } }],
      openings: (toy.openings ?? []).map((opening) => ({
        ...opening,
        zone: 'door',
      })),
    }
    expect(reasonOf(run(removeThing({ def: 'zone', id: 'door' }), level))).toBe(
      'zone door is still referenced: opening ab: zone door',
    )
  })

  it('takes out a later zone nothing names', () => {
    const toy = toyBlockout()
    const level: Blockout = {
      ...toy,
      zones: [...toy.zones, { id: 'spare', look: [2, 1, 2], distance: 14, area: { x: [1, 3] } }],
    }
    expect(levelOf(run(removeThing({ def: 'zone', id: 'spare' }), level)).zones).toEqual(toy.zones)
  })

  it('is refused for the first of several, which would make a zone with an area the first, and for the only one', () => {
    const toy = toyBlockout()
    const level: Blockout = {
      ...toy,
      rooms: toy.rooms.map((room) => ({ ...room, zone: 'other' })),
      zones: [...toy.zones, { id: 'other', look: [2, 1, 2], distance: 14, area: { x: [1, 3] } }],
    }
    expect(reasonOf(run(removeThing({ def: 'zone', id: 'a' }), level))).toBe(
      'the first zone has no area: it is the rest of the map',
    )
    const alone: Blockout = { ...level, zones: toy.zones }
    expect(reasonOf(run(removeThing({ def: 'zone', id: 'a' }), alone))).toBe(
      'the first zone has no area: it is the rest of the map',
    )
  })

  it('answers that there is no such zone', () => {
    expect(reasonOf(run(removeThing({ def: 'zone', id: 'gone' })))).toBe('no zone gone')
  })
})
