// The af-sector profile (ED3D.1b step 5): its codec plus the geometry the views draw and the checks the problems list
// shows, behind the one shape the editor core imports.

import type { AfSector2File } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { entitySelection } from '#src/shared/checks/check.ts'
import { parseSelection } from '#src/shared/edit/selection-ref.ts'
import { resolveMap } from '#src/shared/geometry/sectors.ts'
import { afSectorChecks } from '#src/shared/level-session/af-sector/af-checks.ts'
import { afEntityKit } from '#src/shared/level-session/af-sector/af-entities.ts'
import { afSectorAccess } from '#src/shared/level-session/af-sector/af-sectors.ts'
import { buildSectors } from '#src/shared/level-session/af-sector/build.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import { GeometryError } from '#src/shared/level-session/level-profile.ts'
import { must } from '#src/testing/edit-helpers.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'
import { toyAfSector, toyHall } from '#src/testing/toy-af-sector.ts'

/** The error a call throws, which a test knows is a `GeometryError` and checks to the word. */
function geometryError(call: () => unknown): GeometryError {
  try {
    call()
  } catch (error) {
    if (error instanceof GeometryError) return error
    throw error
  }
  throw new Error('the call did not throw')
}

const depot = (): AfSector2File => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
}

describe('GeometryError', () => {
  it('is an error that says what the engine said', () => {
    const error = new GeometryError('a: unknown portal target b')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('GeometryError')
    expect(error.message).toBe('a: unknown portal target b')
  })
})

describe('the af-sector profile', () => {
  it('is the af-sector codec: its id, its parse and its patch', () => {
    expect(afSectorProfile.id).toBe('af-sector')
    const text = loadAuthored('depot.af-sector')
    const level = depot()
    expect(afSectorProfile.patch(text, level, structuredClone(level))).toStrictEqual({ ok: true, text })
  })

  it('draws the depot as one layer of sectors with no nav', () => {
    const { layers } = afSectorProfile.geometry(depot())
    expect(layers).toHaveLength(1)
    const layer = must(layers[0])
    expect(layer.kind).toBe('sectors')
    expect(layer).not.toHaveProperty('nav')
    expect(layer.map.masses).toEqual([])
    expect(layer.map).toEqual(resolveMap(buildSectors(depot())))
  })

  it('throws the engine’s sentence for a style that does not exist and for a portal to nowhere', () => {
    const style = toyAfSector({ sectors: [{ ...toyHall, style: 'brick' }] })
    expect(geometryError(() => afSectorProfile.geometry(style)).message).toBe('unknown style brick')
    const portal = toyAfSector({ sectors: [toyHall] })
    expect(geometryError(() => afSectorProfile.geometry(portal)).message).toBe(
      'hall: unknown portal target dock',
    )
  })

  it('checks as afSectorChecks does', () => {
    expect(afSectorProfile.checks(depot())).toEqual(afSectorChecks(depot()))
    const broken = toyAfSector({ sectors: [toyHall] })
    expect(afSectorProfile.checks(broken)).toEqual(afSectorChecks(broken))
    expect(afSectorProfile.checks(broken).map((result) => result.id)).toEqual(['ids', 'rooms'])
  })

  it('reaches the sectors of a level through the af-sector access', () => {
    expect(afSectorProfile.sectors).toBe(afSectorAccess)
    expect(afSectorProfile.sectors.takenIds(depot())).toEqual(['hall', 'dock'])
  })
})

describe('the entities of a profile', () => {
  it('are the af-sector kit for an af-sector level', () => {
    const level = depot()
    expect(afSectorProfile.entities(level)).toEqual(afEntityKit(level))
  })

  it('give every thing a selection id that names it back', () => {
    const kit = afSectorProfile.entities(depot())
    expect(kit.things.length).toBeGreaterThan(0)
    for (const thing of kit.things)
      expect(parseSelection(entitySelection(thing.def, thing.id))).toEqual({
        kind: 'entity',
        definition: thing.def,
        id: thing.id,
      })
  })

  it('read the depot as a spawn and a crate, without a problem', () => {
    const kit = afSectorProfile.entities(depot())
    expect(kit.things.map((thing) => `${thing.def}/${thing.id}`)).toEqual(['spawn/spawn', 'crate/crate1'])
    expect(kit.problems).toEqual([])
  })
})
