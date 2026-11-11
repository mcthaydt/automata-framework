// A level's hotspots are its entities of one definition; each one that is not a usable hotspot is a problem in words.
import type { AfSector2 } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { hotspotsOf } from '#src/entries/sim.ts'

const level = (entities: readonly Record<string, unknown>[]): AfSector2 =>
  ({
    format: 'af-sector/2',
    name: 'test',
    sectors: [],
    entityDefs: [{ id: 'hotspot' }, { id: 'lamp' }],
    entities,
  }) as unknown as AfSector2

const jar = { def: 'hotspot', id: 'jar', x: 2, z: 1, reach: 1.2, name: 'name.jar' }

describe('hotspotsOf', () => {
  it('reads the entities of the hotspot definition and ignores the others', () => {
    const read = hotspotsOf(level([jar, { def: 'lamp', id: 'lamp1', x: 0, z: 0 }]))
    expect(read.problems).toEqual([])
    expect(read.hotspots).toEqual([{ id: 'jar', x: 2, z: 1, reach: 1.2, name: 'name.jar' }])
  })

  it('keeps `hide` and `when`', () => {
    const when = [{ fact: 'doorOpen', is: true }]
    const read = hotspotsOf(level([{ ...jar, hide: true, when }]))
    expect(read.hotspots).toEqual([{ id: 'jar', x: 2, z: 1, reach: 1.2, name: 'name.jar', hide: true, when }])
  })

  it('reads another definition when asked', () => {
    expect(hotspotsOf(level([{ ...jar, def: 'lamp' }]), 'lamp').hotspots).toHaveLength(1)
  })

  it('reports an entity with no reach, by id, and leaves it out', () => {
    const { reach: _reach, ...noReach } = jar
    const read = hotspotsOf(level([noReach, { ...jar, id: 'crate' }]))
    expect(read.hotspots.map((h) => h.id)).toEqual(['crate'])
    expect(read.problems).toHaveLength(1)
    expect(read.problems[0]).toMatch(/hotspot "jar".*reach/)
  })

  it('reports a reach that is not above zero', () => {
    expect(hotspotsOf(level([{ ...jar, reach: 0 }])).problems[0]).toMatch(/hotspot "jar".*reach/)
  })

  it('reports a condition that is not one', () => {
    expect(hotspotsOf(level([{ ...jar, when: [{ nonsense: 1 }] }])).problems[0]).toMatch(
      /hotspot "jar".*when/,
    )
  })

  it('reports two hotspots with one id', () => {
    const read = hotspotsOf(level([jar, { ...jar, x: 5 }]))
    expect(read.hotspots).toHaveLength(1)
    expect(read.problems[0]).toMatch(/"jar".*twice/)
  })

  it('reads a level with no entities', () => {
    expect(hotspotsOf({ format: 'af-sector/2', name: 't', sectors: [] } as unknown as AfSector2)).toEqual({
      hotspots: [],
      problems: [],
    })
  })
})
