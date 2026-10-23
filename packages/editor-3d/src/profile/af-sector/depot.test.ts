// The shipped depot (ED3D.1b step 3): the `af-sector/1` sample that proves the format reads and builds into the same
// engine data as a Last Light level, with none of Last Light's concepts in the file.
import { describe, expect, it } from 'vitest'
import { resolveMap } from '../../geometry/sectors'
import { loadAuthored } from '../../testing/fixtures'
import { must } from '../../testing/toy-blockout'
import { afSectorCodec } from './af-codec'
import { buildSectors } from './build'

const text = loadAuthored('depot.af-sector')

function depot() {
  const result = afSectorCodec.parse(text)
  if (!result.ok) throw new Error(`the depot does not parse: ${JSON.stringify(result.issues)}`)
  return result
}

/** Every key at every depth of a JSON value. */
function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf)
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, member]) => [key, ...keysOf(member)])
}

describe('the depot sample', () => {
  it('reads without a warning', () => {
    expect(depot().warnings).toBeUndefined()
  })

  it('names the format and its two sectors, one step apart', () => {
    const { value } = depot()
    expect(value.format).toBe('af-sector/1')
    expect(value.name).toBe('depot')
    expect(value.sectors.map((sector) => [sector.id, sector.floor])).toEqual([
      ['hall', 0],
      ['dock', -0.5],
    ])
  })

  it('holds none of Last Light’s members: no scene, rooms, openings, zones, nav graph, masses or exports', () => {
    const lastLight = [
      'scene',
      'rooms',
      'openings',
      'zones',
      'zone',
      'nav',
      'masses',
      'exports',
      'hideFrom',
      'cut',
    ]
    expect(keysOf(JSON.parse(text)).filter((key) => lastLight.includes(key))).toEqual([])
  })

  it('builds and resolves: a portal pair along x = 8, a door and a window', () => {
    const map = resolveMap(buildSectors(depot().value))
    const portals = map.edges.filter((edge) => edge.next !== undefined)
    expect(portals.map((edge) => [edge.sector.id, edge.next?.id])).toEqual([
      ['hall', 'dock'],
      ['dock', 'hall'],
    ])
    const hall = map.edges.filter((edge) => edge.sector.id === 'hall')
    expect(must(hall.find((edge) => edge.wall.door)).wall.door).toEqual({ at: 3, width: 1.2, height: 2.2 })
    expect(must(hall.find((edge) => edge.wall.window)).wall.window).toEqual({
      at: 4,
      width: 1.6,
      y0: 1,
      y1: 2.6,
    })
  })

  it('defines the things it places: spawn once, crates, each instance of a definition the file has', () => {
    const { value } = depot()
    const defs = (value.entityDefs ?? []).map((def) => def.id)
    expect(defs).toEqual(['spawn', 'crate'])
    const instances = value.entities ?? []
    expect(instances.map((entity) => [entity.def, entity.id])).toEqual([
      ['spawn', 'spawn'],
      ['crate', 'crate1'],
    ])
    expect(instances.every((entity) => defs.includes(entity.def))).toBe(true)
  })
})
