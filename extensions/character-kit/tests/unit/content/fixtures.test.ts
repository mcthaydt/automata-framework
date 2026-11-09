import { describe, expect, it } from 'vitest'
import { characterKitExtension } from '#src/app/character-kit.extension.ts'
import { seatSchema } from '#src/features/seats/seat.schema.ts'
import { kitFixture } from '#src/testing/kit-fixture.ts'

// The kit's content compiles with core's: the hairstyles through core's `figure-hair` kind (whose pieces are the kit's), the
// seats through the kit's own `figure-seat` kind.

describe('the kit’s fixtures compile with the figures’ content', () => {
  it('the styles and the seats are all there', async () => {
    const { library, seats } = await kitFixture()
    expect(Object.keys(library.hair)).toHaveLength(11)
    expect(Object.keys(seats)).toHaveLength(8)
  })
  it('the seat kind is the one the extension brings, and refuses a seat with no height', () => {
    expect(characterKitExtension.content?.map((c) => [c.kind, c.place])).toEqual([
      ['figure-seat', { folder: 'figure-seats' }],
    ])
    expect(seatSchema.safeParse({ lean: 0.2 }).success).toBe(false)
    expect(seatSchema.safeParse({ height: 0.45, lean: 0.2 }).success).toBe(true)
  })
})
