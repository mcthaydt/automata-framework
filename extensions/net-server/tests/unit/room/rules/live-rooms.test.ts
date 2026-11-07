import { describe, expect, it, vi } from 'vitest'
import { type DrainableRoom, LiveRooms } from '#src/features/room/rules/live-rooms.ts'

// Every room a process holds, so a drain can speak to each one and the room cap can count them.

const room = (): DrainableRoom => ({ beginDrain: vi.fn() })

describe('live rooms', () => {
  it('counts the rooms registered and not yet forgotten', () => {
    const rooms = new LiveRooms()
    const a = room()
    const b = room()
    rooms.register(a)
    rooms.register(b)
    rooms.register(a)
    expect(rooms.size).toBe(2)
    rooms.forget(a)
    expect(rooms.size).toBe(1)
    expect([...rooms]).toEqual([b])
  })

  it('lets a drain reach every live room', () => {
    const rooms = new LiveRooms()
    const a = room()
    const b = room()
    rooms.register(a)
    rooms.register(b)
    for (const live of rooms) live.beginDrain()
    expect(a.beginDrain).toHaveBeenCalledTimes(1)
    expect(b.beginDrain).toHaveBeenCalledTimes(1)
  })
})
