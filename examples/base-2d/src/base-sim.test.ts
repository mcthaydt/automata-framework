import { describe, expect, it } from 'vitest'
import { createBaseSim, readPlayer } from './base-sim.ts'
import { BASE_SIM_CONTENT, ROOM } from './content/room.ts'
import { readRoomGrid } from './content/room-grid.ts'
import { SUB } from './sim/tuning.ts'

// createBaseSim takes the compiled sim content (the `rooms` kind), so a demo can make the base's sim from
// content it compiled itself (M2.2's content-restore demo).
describe('createBaseSim', () => {
  it('makes the sim from the compiled base content by default, the same sim as passing it', async () => {
    const byDefault = await createBaseSim()
    const passed = await createBaseSim({ content: BASE_SIM_CONTENT })
    expect(byDefault.hash()).toBe(passed.hash())
    byDefault.dispose()
    passed.dispose()
  })

  it('makes a different sim from a different room (the room is part of the hash)', async () => {
    const corridor = readRoomGrid(8, ['######', '#....#', '#.P.G#', '######'])
    const base = await createBaseSim()
    const other = await createBaseSim({ content: { rooms: { 'room-1': corridor } } })
    expect(other.hash()).not.toBe(base.hash())
    base.dispose()
    other.dispose()
  })

  it('reads the room from the content it is given, and starts the character at that room’s P', async () => {
    const corridor = readRoomGrid(8, ['######', '#....#', '#.P.G#', '######'])
    const sim = await createBaseSim({ content: { rooms: { 'room-1': corridor } } })
    expect(Math.floor(readPlayer(sim).x / SUB)).toBe(16)
    sim.dispose()
  })

  it('makes the same sim from the shipped room’s rows as from the compiled content, so snapshots cross', async () => {
    const fromContent = await createBaseSim()
    const fromRoom = await createBaseSim({ room: ROOM })
    expect(fromRoom.hash()).toBe(fromContent.hash())
    fromContent.dispose()
    fromRoom.dispose()
  })

  it('refuses content and a room together', async () => {
    await expect(
      createBaseSim({ content: BASE_SIM_CONTENT, room: { id: 'room-1', tileSize: 8, rows: ['####'] } }),
    ).rejects.toThrow('pass content or room, not both')
  })

  it('is made by default from the compiled sim partition, tuning and rooms (M2.2’s simContent)', () => {
    expect(Object.keys(BASE_SIM_CONTENT).sort()).toEqual(['rooms', 'tuning'])
    expect(BASE_SIM_CONTENT.tuning).toEqual({})
  })

  it('refuses content without the base’s room', async () => {
    await expect(createBaseSim({ content: { rooms: {} } })).rejects.toThrow('room-1')
  })
})
