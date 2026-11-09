// The free base-3d room as a level file (the free base-3d plan, step 6): a valid `af-sector/1` file of axis-aligned
// rectangles, with the pits the roll crosses (a channel is 2 m wide, the roll carries 3.2 m) and the spawn, the embers
// and the goal standing in rooms. The converter and the sim read it after the strip commits.
import { afSectorSchema } from '@automata/sector-format'
import { describe, expect, it } from 'vitest'
import file from './levels/room.af-sector.json'

const room = afSectorSchema.parse(file)
const boxes = room.sectors.map((sector) => {
  const xs = sector.corners.map((corner) => corner[0])
  const zs = sector.corners.map((corner) => corner[1])
  return {
    sector,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  }
})
const ROLL_METRES = 3.2
const pits = boxes.filter(({ sector }) => sector.floor < 0)
const rooms = boxes.filter(({ sector }) => sector.floor >= 0)

describe('room.af-sector.json', () => {
  it('is four-cornered rectangles: three rooms and two pits', () => {
    expect(room.sectors.every((sector) => sector.corners.length === 4)).toBe(true)
    expect(pits).toHaveLength(2)
    expect(rooms.filter(({ sector }) => sector.view !== undefined)).toHaveLength(3)
  })

  it('has channels the roll crosses and walking does not', () => {
    for (const { minZ, maxZ } of pits) {
      expect(maxZ - minZ).toBeGreaterThan(1)
      expect(maxZ - minZ).toBeLessThan(ROLL_METRES - 0.6)
    }
  })

  it('stands the spawn, the embers and the goal in rooms, the goal the farthest', () => {
    const entities = room.entities ?? []
    expect(entities.filter((entity) => entity.def === 'spawn')).toHaveLength(1)
    const goals = entities.filter((entity) => entity.def === 'goal')
    expect(goals).toHaveLength(1)
    for (const entity of entities)
      expect(
        rooms.some(
          (box) => entity.x > box.minX && entity.x < box.maxX && entity.z > box.minZ && entity.z < box.maxZ,
        ),
        entity.id,
      ).toBe(true)
    expect(Math.max(...entities.map((entity) => entity.z))).toBe(goals[0]?.z)
  })
})
