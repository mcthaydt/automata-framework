// What each profile lists for the material picker, and the hints its views take (ED3D.8a step 1, spec §4.1, D8, D10).
import { describe, expect, it } from 'vitest'
import type { AfSector } from '../format/af-sector.schema'
import { loadAuthored, loadFixture } from '../testing/fixtures'
import { loadGameFacts } from '../testing/game-facts'
import { toyAfSector } from '../testing/toy-af-sector'
import { afSectorProfile } from './af-sector-profile'
import { lastLightProfile } from './last-light-profile'
import { LAST_LIGHT_NO_LIST } from './materials'

const depot = (): AfSector => {
  const parsed = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!parsed.ok) throw new Error('the depot does not parse')
  return parsed.value
}

const clinic = () => {
  const parsed = lastLightProfile.parse(loadFixture('blockout-clinic'))
  if (!parsed.ok) throw new Error('the clinic does not parse')
  return parsed.value
}

describe('afSectorProfile.materials', () => {
  it('lists the file’s table in file order, with what each entry says', () => {
    expect(afSectorProfile.materials(depot())).toEqual({
      ok: true,
      materials: [
        { id: 'brick', category: 'walls', label: 'Brick' },
        { id: 'plank', category: 'floors', label: 'Planks' },
        { id: 'tile', category: 'floors' },
      ],
    })
  })

  it('keeps wallOnly, and ignores the context (the table is the file’s)', () => {
    const level = toyAfSector({ materials: { brick: { category: 'walls', wallOnly: true } } })
    expect(afSectorProfile.materials(level, { materials: ['other'] })).toEqual({
      ok: true,
      materials: [{ id: 'brick', category: 'walls', wallOnly: true }],
    })
  })

  it('refuses a level with no table, and an empty table is an empty list', () => {
    expect(afSectorProfile.materials(toyAfSector())).toEqual({
      ok: false,
      reason: 'the level has no materials table',
    })
    expect(afSectorProfile.materials(toyAfSector({ materials: {} }))).toEqual({ ok: true, materials: [] })
  })
})

describe('lastLightProfile.materials', () => {
  const list = loadGameFacts().options.materials
  if (list === null) throw new Error('the golden has no material list')

  it('lists the renderer’s materials from the context, lit unless the context says unlit', () => {
    const answer = lastLightProfile.materials(clinic(), {
      materials: list,
      unlitMaterials: ['glass', 'moonGlass'],
    })
    if (!answer.ok) throw new Error(answer.reason)
    expect(answer.materials.map((material) => material.id)).toEqual(list)
    expect(answer.materials.filter((material) => material.category === 'unlit').map((m) => m.id)).toEqual([
      'glass',
      'moonGlass',
    ])
    expect(answer.materials.find((material) => material.id === 'plaster')).toEqual({
      id: 'plaster',
      category: 'lit',
    })
  })

  it('takes every material as lit when the context does not say which are unlit', () => {
    const answer = lastLightProfile.materials(clinic(), { materials: ['plaster', 'glass'] })
    expect(answer).toEqual({
      ok: true,
      materials: [
        { id: 'plaster', category: 'lit' },
        { id: 'glass', category: 'lit' },
      ],
    })
  })

  it('refuses, in Last Light’s own sentence, when the host could not read the list', () => {
    const refusal = { ok: false, reason: LAST_LIGHT_NO_LIST }
    expect(LAST_LIGHT_NO_LIST).toBe(
      'the material keys could not be read from the renderer (src/render/stage.ts)',
    )
    expect(lastLightProfile.materials(clinic())).toEqual(refusal)
    expect(lastLightProfile.materials(clinic(), {})).toEqual(refusal)
    expect(lastLightProfile.materials(clinic(), { materials: null })).toEqual(refusal)
  })
})

describe('hints', () => {
  it('is metres, an eye 1.6 m up, a field of 69 degrees in radians and a snap of 5 cm, for both profiles', () => {
    for (const profile of [afSectorProfile, lastLightProfile])
      expect(profile.hints).toEqual({ unit: 'm', eyeHeight: 1.6, fov: (69 * Math.PI) / 180, snap: 0.05 })
  })
})
