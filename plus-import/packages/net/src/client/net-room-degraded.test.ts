import { afterEach, describe, expect, it } from 'vitest'
import { type Harness, startHarness } from '../test-support/net-room-harness'

// `ConnectionState` `degraded` (M7 spec §4.2 "Degraded"): the session's diagnostics say the link is slow or silent, and the
// connection reads `degraded` while it stays up. A drop or a leave wins over it, and the mark does not outlive the connection.

let harnesses: Harness[] = []
afterEach(async () => {
  for (const h of harnesses) await h.close()
  harnesses = []
})
const start = async () => {
  const h = await startHarness()
  harnesses.push(h)
  return h
}

describe('markDegraded', () => {
  it('reads degraded while the connection is up and connected again when cleared', async () => {
    const h = await start()
    await h.run(h.room.create({ name: 'Ada' }))
    expect(h.connection()).toBe('connected')
    h.room.markDegraded(true)
    expect(h.connection()).toBe('degraded')
    h.room.markDegraded(false)
    expect(h.connection()).toBe('connected')
  })

  it('is remembered across a reconnect that is still bad, and a drop shows reconnecting meanwhile', async () => {
    const h = await start()
    await h.run(h.room.create({ name: 'Ada' }))
    const first = h.fake.rooms[0]
    first?.message({ t: 'seated', seat: 0 })
    h.room.markDegraded(true)
    first?.close(1006)
    expect(h.connection()).toBe('reconnecting')
    await h.settle()
    expect(h.connection()).toBe('degraded')
  })

  it('is forgotten when the player leaves', async () => {
    const h = await start()
    await h.run(h.room.create({ name: 'Ada' }))
    h.room.markDegraded(true)
    await h.run(h.room.leave)
    expect(h.connection()).toBe('offline')
    await h.run(h.room.create({ name: 'Ada' }))
    expect(h.connection()).toBe('connected')
  })

  it('does nothing before a connection exists', async () => {
    const h = await start()
    h.room.markDegraded(true)
    expect(h.connection()).toBe('offline')
  })
})
