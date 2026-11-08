// The level-wide edits (Levels 3D spec §10.3, plan 16.2): the time of day. One undoable step, written as one member.

import type { AfSector2File } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import type { Edit } from '#src/shared/edit/edit.ts'
import { setTimeOfDay } from '#src/shared/edit/level-edits.ts'
import { afSectorCodec } from '#src/shared/level-session/af-sector/af-codec.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import { levelOf, reasonOf } from '#src/testing/edit-helpers.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'

const text = loadAuthored('depot.af-sector')
const parsed = afSectorProfile.parse(text)
if (!parsed.ok) throw new Error('the depot does not parse')
const depot = parsed.value

const set = (time: string | undefined, level: AfSector2File = depot) =>
  (setTimeOfDay({ time }) as Edit<AfSector2File>).run(afSectorProfile, level)

describe('level.setTimeOfDay', () => {
  it('lists the times in words, each once', () => {
    const options = afSectorProfile.time?.options() ?? []
    expect(options.map((each) => each.id)).toEqual(['day', 'golden', 'dusk', 'night', 'lampLit', 'bar'])
    expect(options.every((each) => each.label !== each.id || each.id === 'day')).toBe(true)
  })

  it('writes the time, and taking it off leaves the file as it was', () => {
    const made = levelOf(set('dusk'))
    expect(afSectorProfile.time?.of(made)).toBe('dusk')
    expect(levelOf(set(undefined, made))).toEqual(depot)
  })

  it('keeps a time’s own overrides when another is chosen', () => {
    const tuned = { ...depot, time: { preset: 'day', scene: { sun: 1 } } }
    const made = levelOf(set('night', tuned))
    expect(made.time).toEqual({ preset: 'night', scene: { sun: 1 } })
    expect(afSectorProfile.time?.of(tuned)).toBe('day')
  })

  it('changes nothing when the time is the one it has, or there is none to take off', () => {
    const made = levelOf(set('dusk'))
    expect(levelOf(set('dusk', made))).toBe(made)
    expect(levelOf(set(undefined))).toBe(depot)
  })

  it('writes only the `time` member, and Undo puts the text back byte for byte', () => {
    const made = levelOf(set('night'))
    const patched = afSectorCodec.patch(text, depot, made)
    if (!patched.ok) throw new Error(patched.detail)
    expect(JSON.parse(patched.text).time).toBe('night')
    const back = afSectorCodec.patch(patched.text, made, depot)
    expect(back.ok && back.text).toBe(text)
  })

  it('says what it does in words, and refuses a time the game cannot show', () => {
    expect(setTimeOfDay({ time: 'dusk', label: 'Dusk' }).label).toBe('Set the time of day to Dusk')
    expect(setTimeOfDay({ time: undefined }).label).toBe('Take off the time of day')
    expect(reasonOf(set('teatime'))).toBe(
      'There is no time of day called "teatime" (day, golden, dusk, night, lampLit, bar)',
    )
  })
})
