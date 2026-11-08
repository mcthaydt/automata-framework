import { describe, expect, it } from 'vitest'
import { teardown } from '#src/app/boot/teardown.ts'

describe('teardown', () => {
  it('runs every undo once, last added first, waiting for each', async () => {
    const order: string[] = []
    const owned = teardown()
    owned.add(() => void order.push('first'))
    owned.add(async () => {
      await Promise.resolve()
      order.push('second')
    })
    owned.add(() => void order.push('third'))
    await owned.close()
    await owned.close()
    expect(order).toEqual(['third', 'second', 'first'])
    expect(owned.closed).toBe(true)
  })

  it('reports an undo that throws and still runs the rest', async () => {
    const reported: unknown[] = []
    const ran: string[] = []
    const owned = teardown((cause) => reported.push(cause))
    owned.add(() => void ran.push('kept'))
    owned.add(() => {
      throw new Error('broken undo')
    })
    await owned.close()
    expect(ran).toEqual(['kept'])
    expect(reported).toEqual([new Error('broken undo')])
  })

  it('a second close waits for the first instead of returning at once', async () => {
    const order: string[] = []
    const owned = teardown()
    owned.add(async () => {
      await Promise.resolve()
      await Promise.resolve()
      order.push('slow undo')
    })
    const first = owned.close()
    await owned.close()
    order.push('second close returned')
    await first
    expect(order).toEqual(['slow undo', 'second close returned'])
  })

  it('runs an undo added after close at once, so nothing opened late is leaked', async () => {
    const ran: string[] = []
    const owned = teardown()
    await owned.close()
    owned.add(() => void ran.push('late'))
    await Promise.resolve()
    expect(ran).toEqual(['late'])
  })
})
