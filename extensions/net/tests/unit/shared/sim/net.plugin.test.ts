import { createSim, defineComponent, definePlugin, type Sim } from '@automata/sim'
import { describe, expect, it } from 'vitest'
import { NetOwner, netPlugin, SeatJoin, SeatLeave } from '#src/entries/sim.ts'
import { MAX_SEATS } from '#src/shared/sim/seat.schema.ts'

// netPlugin (M7 spec §4.2, §4.4): the seat entity and the seat commands, as ordinary sim definitions. The room
// sends seat.join and seat.leave; a game tags its own entities with net-owner to tie them to a seat.

const Score = defineComponent('score', { value: 'i32' })
/** A game's own component, tied to a seat with net-owner. */
const gamePlugin = definePlugin({ name: 'game', components: [Score] })
const join = (seat: number, seq: number) => ({
  type: SeatJoin.id,
  source: 0,
  seq,
  tick: 0,
  payload: { seat },
})
const leave = (seat: number, seq: number) => ({
  type: SeatLeave.id,
  source: 0,
  seq,
  tick: 0,
  payload: { seat },
})

async function sim(): Promise<Sim> {
  return createSim({ seed: 1, plugins: [netPlugin, gamePlugin] })
}
const seats = (s: Sim) => s.query(NetOwner).map((e) => e.get(NetOwner).seat)

describe('netPlugin', () => {
  it('spawns one seat entity on seat.join and emits seat.joined', async () => {
    const s = await sim()
    const result = s.step([{ ...join(2, 0), tick: s.tick }])
    expect(seats(s)).toEqual([2])
    expect(result.events).toEqual([
      { type: 'seat.joined', payload: { seat: 2, sid: s.query(NetOwner)[0]?.sid } },
    ])
    s.dispose()
  })

  it('ignores a join for a seat that is already held', async () => {
    const s = await sim()
    s.step([{ ...join(1, 0), tick: s.tick }])
    const result = s.step([{ ...join(1, 1), tick: s.tick }])
    expect(seats(s)).toEqual([1])
    expect(result.events).toEqual([])
    s.dispose()
  })

  it("despawns every entity of a seat on seat.leave and emits seat.left with the seat entity's id", async () => {
    const s = await sim()
    s.step([
      { ...join(0, 0), tick: s.tick },
      { ...join(1, 1), tick: s.tick },
    ])
    const seatSid = s.query(NetOwner).find((e) => e.get(NetOwner).seat === 1)?.sid
    s.spawn([
      [NetOwner, { seat: 1 }],
      [Score, { value: 3 }],
    ])
    const result = s.step([{ ...leave(1, 2), tick: s.tick }])
    expect(seats(s)).toEqual([0])
    expect(result.events).toEqual([{ type: 'seat.left', payload: { seat: 1, sid: seatSid } }])
    s.dispose()
  })

  // Review of M7.2: despawn waits for the end of the tick, so the commands of one tick must see each other.
  it('gives a seat to a join that follows a leave of it in the same tick', async () => {
    const s = await sim()
    s.step([{ ...join(3, 0), tick: s.tick }])
    const old = s.query(NetOwner)[0]?.sid
    const result = s.step([
      { ...leave(3, 1), tick: s.tick },
      { ...join(3, 2), tick: s.tick },
    ])
    expect(seats(s)).toEqual([3])
    const fresh = s.query(NetOwner)[0]?.sid
    expect(fresh).not.toBe(old)
    expect(result.events).toEqual([
      { type: 'seat.left', payload: { seat: 3, sid: old } },
      { type: 'seat.joined', payload: { seat: 3, sid: fresh } },
    ])
    s.dispose()
  })

  it('leaves a seat empty when a join is followed by a leave in the same tick', async () => {
    const s = await sim()
    const result = s.step([
      { ...join(2, 0), tick: s.tick },
      { ...leave(2, 1), tick: s.tick },
    ])
    expect(seats(s)).toEqual([])
    expect(result.events.map((e) => e.type)).toEqual(['seat.joined', 'seat.left'])
    s.dispose()
  })

  it('emits seat.left once for two leaves of one seat in the same tick', async () => {
    const s = await sim()
    s.step([{ ...join(1, 0), tick: s.tick }])
    const result = s.step([
      { ...leave(1, 1), tick: s.tick },
      { ...leave(1, 2), tick: s.tick },
    ])
    expect(result.events.map((e) => e.type)).toEqual(['seat.left'])
    s.dispose()
  })

  it('ignores a leave for an empty seat', async () => {
    const s = await sim()
    const result = s.step([{ ...leave(3, 0), tick: s.tick }])
    expect(result.events).toEqual([])
    s.dispose()
  })

  it('refuses a seat past the last one', async () => {
    const s = await sim()
    const result = s.step([{ ...join(16, 0), tick: s.tick }])
    expect(result.rejected).toHaveLength(1)
    expect(seats(s)).toEqual([])
    s.dispose()
  })

  it('reproduces the same hash from the same commands', async () => {
    const run = async () => {
      const s = await sim()
      s.step([
        { ...join(0, 0), tick: s.tick },
        { ...join(3, 1), tick: s.tick },
      ])
      s.step([{ ...leave(0, 2), tick: s.tick }])
      const hash = s.hash()
      s.dispose()
      return hash
    }
    expect(await run()).toBe(await run())
  })
})

// PRODUCT.8b: the room's own command source lives on the sim side, so a game's sim can tell the room's commands from
// a seat's without importing the server (which a sim may not). The server uses this same constant.
describe('ROOM_SOURCE', () => {
  it('is 255, above every seat', async () => {
    const { ROOM_SOURCE } = await import('#src/entries/sim.ts')
    expect(ROOM_SOURCE).toBe(255)
    expect(ROOM_SOURCE).toBeGreaterThanOrEqual(MAX_SEATS)
  })
})
