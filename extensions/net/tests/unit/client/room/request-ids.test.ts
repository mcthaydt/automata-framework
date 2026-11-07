import { describe, expect, it } from 'vitest'
import { createRequestIds, newLoadToken } from '#src/features/client/room/request-ids.ts'
import { REQUEST_ID_MAX_LENGTH } from '#src/shared/wire/limits.ts'
import { reqIdSchema } from '#src/shared/wire/primitives.schema.ts'

// FloorFifty "numbers commands uniquely across two page loads": the room keeps the last answers per Colyseus session,
// and a session survives a reload's `resume`, so a reloaded client numbering from 1 again would collide with stored
// answers and its requests would do nothing.
describe('request ids', () => {
  it('numbers requests uniquely across two page loads', () => {
    const first = createRequestIds(newLoadToken(() => new Uint8Array([1, 2, 3, 4])))
    const second = createRequestIds(newLoadToken(() => new Uint8Array([5, 6, 7, 8])))
    expect(first.next()).not.toBe(second.next())
  })

  it('numbers requests uniquely within a load', () => {
    const ids = createRequestIds('abcd0123')
    expect(new Set([ids.next(), ids.next(), ids.next()]).size).toBe(3)
  })

  it('stays within the wire bound, even after many requests', () => {
    const ids = createRequestIds(newLoadToken())
    let last = ''
    for (let index = 0; index < 10_000; index += 1) last = ids.next()
    expect(last.length).toBeLessThanOrEqual(REQUEST_ID_MAX_LENGTH)
    expect(reqIdSchema.safeParse(last).success).toBe(true)
  })

  it('draws a load token of eight hex characters by default', () => {
    expect(newLoadToken()).toMatch(/^[0-9a-f]{8}$/)
  })
})
