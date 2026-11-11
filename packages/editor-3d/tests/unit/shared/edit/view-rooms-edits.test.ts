// The rooms a camera view draws (`rooms` of a level's `views`): one undoable step written as one member, an empty list taking
// the member off (a view that draws no rooms is not one), and a refusal in words for a view or a room the level lacks.

import type { AfSector2File } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import type { Edit } from '#src/shared/edit/edit.ts'
import { setViewRooms } from '#src/shared/edit/level-edits.ts'
import { afSectorCodec } from '#src/shared/level-session/af-sector/af-codec.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import { levelOf, reasonOf } from '#src/testing/edit-helpers.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'

const text = loadAuthored('depot.af-sector')
const parsed = afSectorProfile.parse(text)
if (!parsed.ok) throw new Error('the depot does not parse')
/** The depot with two camera views: `start` with a tilt of its own, `goal` with nothing. */
const depot: AfSector2File = { ...parsed.value, views: { start: { tiltDeg: 32 }, goal: {} } }

const set = (view: string, rooms: readonly string[] | undefined, level: AfSector2File = depot) =>
  (setViewRooms({ view, rooms }) as Edit<AfSector2File>).run(afSectorProfile, level)

describe('level.setViewRooms', () => {
  it('writes the rooms a view draws and keeps its other fields', () => {
    const made = levelOf(set('start', ['hall']))
    expect(made.views?.start).toEqual({ tiltDeg: 32, rooms: ['hall'] })
    expect(made.views?.goal).toEqual({})
    expect(afSectorProfile.viewRooms?.of(made, 'start')).toEqual(['hall'])
    expect(afSectorProfile.viewRooms?.of(made, 'goal')).toBeUndefined()
  })

  it('takes the member off for none or an empty list, and the level is as it was', () => {
    const made = levelOf(set('start', ['hall', 'dock']))
    expect(levelOf(set('start', [], made))).toEqual(depot)
    expect(levelOf(set('start', undefined, made))).toEqual(depot)
  })

  it('changes nothing when the rooms are the ones the view has, or there are none to take off', () => {
    const made = levelOf(set('goal', ['dock']))
    expect(levelOf(set('goal', ['dock'], made))).toBe(made)
    expect(levelOf(set('goal', undefined))).toBe(depot)
  })

  it('refuses a view the level does not have, in words', () => {
    expect(reasonOf(set('nowhere', ['hall']))).toBe('There is no camera called "nowhere" in this level')
  })

  it('refuses a room the level does not have, naming it and the rooms there are', () => {
    expect(reasonOf(set('start', ['hall', 'attic']))).toBe('There is no room called "attic" (hall, dock)')
  })

  it('refuses in a format with no rooms to name', () => {
    const bare = { ...afSectorProfile, viewRooms: undefined }
    const edit = setViewRooms({ view: 'start', rooms: ['hall'] }) as Edit<AfSector2File>
    expect(reasonOf(edit.run(bare, depot))).toBe('this kind of level has no rooms for a camera to draw')
  })

  it('writes only the `views` member, and Undo puts the text back byte for byte', () => {
    const withViews = JSON.stringify(
      { ...JSON.parse(text), views: { start: { tiltDeg: 32 }, goal: {} } },
      null,
      2,
    )
    const base = afSectorProfile.parse(withViews)
    if (!base.ok) throw new Error('the depot with views does not parse')
    const made = levelOf(set('start', ['hall'], base.value))
    const patched = afSectorCodec.patch(withViews, base.value, made)
    if (!patched.ok) throw new Error(patched.detail)
    expect(JSON.parse(patched.text).views.start).toEqual({ tiltDeg: 32, rooms: ['hall'] })
    const back = afSectorCodec.patch(patched.text, made, base.value)
    if (!back.ok) throw new Error(back.detail)
    expect(back.text).toBe(withViews)
  })
})
