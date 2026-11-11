import { describe, expect, it } from 'vitest'
import { plansOf } from '#src/features/room-visibility/room-level.ts'
import { createRoomVisibility } from '#src/features/room-visibility/room-resolver.ts'
import { LEVEL, POLICY } from './fixtures.ts'

const make = () => createRoomVisibility(POLICY, plansOf(LEVEL))
const frame = { dt: 0.016, reducedMotion: false, cutscene: false }
const names = (set: ReadonlySet<string>) => [...set].sort()

describe('the room resolver', () => {
  it('knows which room a point is in, and none outside every sector', () => {
    const rooms = make()
    expect(rooms.roomsAt({ x: 1, z: 1 })).toEqual(['reception'])
    expect(rooms.roomsAt({ x: 5, z: 1 })).toEqual(['reception'])
    expect(rooms.roomsAt({ x: 9, z: 9 })).toEqual([])
  })

  it('shows what the first zone sees, and the room the player stands in', () => {
    const rooms = make()
    expect(names(rooms.update({ ...frame, zone: 'corridor', at: { x: 1, z: 1 } }))).toEqual([
      'corridor',
      'reception',
    ])
  })

  it('keeps the old zone for 0.35 s after a zone change, so the cut does not pop, then drops it', () => {
    const rooms = make()
    rooms.update({ ...frame, zone: 'hall', at: { x: 9, z: 1 } })
    expect(names(rooms.update({ ...frame, zone: 'closet', at: { x: 9, z: 1 } }))).toEqual([
      'corridor',
      'reception',
      'supply',
      'ward',
    ])
    expect(names(rooms.update({ ...frame, dt: 0.2, zone: 'closet', at: { x: 9, z: 1 } }))).toEqual([
      'corridor',
      'reception',
      'supply',
      'ward',
    ])
    expect(names(rooms.update({ ...frame, dt: 0.2, zone: 'closet', at: { x: 9, z: 1 } }))).toEqual([
      'corridor',
      'supply',
    ])
  })

  it('drops the old zone at once for a player who asked for reduced motion', () => {
    const rooms = make()
    rooms.update({ ...frame, zone: 'hall', at: { x: 9, z: 5 } })
    expect(
      names(rooms.update({ ...frame, reducedMotion: true, zone: 'closet', at: { x: 9, z: 5 } })),
    ).toEqual(['supply'])
  })

  it('protects the player at a threshold: the room they stand in shows whatever the zone says', () => {
    const rooms = make()
    expect(names(rooms.update({ ...frame, dt: 1, zone: 'closet', at: { x: 1, z: 5 } }))).toEqual([
      'supply',
      'ward',
    ])
  })

  it('shows the far side of a peek with `also`', () => {
    const rooms = make()
    const shown = rooms.update({ ...frame, dt: 1, zone: 'closet', at: { x: 9, z: 5 }, also: { x: 9, z: 1 } })
    expect(names(shown)).toEqual(['corridor', 'supply'])
  })

  it('shows every room in a cutscene, and forgets the zone', () => {
    const rooms = make()
    expect(names(rooms.update({ ...frame, zone: 'closet', at: { x: 9, z: 5 }, cutscene: true }))).toEqual([
      'corridor',
      'reception',
      'supply',
      'ward',
    ])
  })

  it('resume starts at once in a zone', () => {
    expect(names(make().resume('corridor', { x: 9, z: 1 }))).toEqual(['corridor'])
  })

  it('refuses a zone the policy does not know', () => {
    expect(() => make().update({ ...frame, zone: 'attic', at: { x: 0, z: 0 } })).toThrow(
      'unknown visibility zone attic',
    )
  })

  it('treats a hole as outside the sector', () => {
    const rooms = createRoomVisibility({ rooms: { a: ['ring'] }, zones: { z: ['a'] }, masses: {} }, [
      {
        id: 'ring',
        points: [
          [
            { x: 0, z: 0 },
            { x: 6, z: 0 },
            { x: 6, z: 6 },
            { x: 0, z: 6 },
          ],
          [
            { x: 2, z: 2 },
            { x: 4, z: 2 },
            { x: 4, z: 4 },
            { x: 2, z: 4 },
          ],
        ],
      },
    ])
    expect(rooms.roomsAt({ x: 1, z: 1 })).toEqual(['a'])
    expect(rooms.roomsAt({ x: 3, z: 3 })).toEqual([])
  })
})
