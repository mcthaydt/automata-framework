import { describe, expect, it } from 'vitest'
import { playRoute } from '#src/testing/bot.ts'
import { DRY_ROUTE } from '#src/testing/route.ts'

// Review focus 2: the lamp runs dry, and the paraffin is in the ward while she is in the supply room: the scene must still be
// finishable, because the nightstand always has one more bottle.

describe('with the lamp let run dry', () => {
  it('can still be finished', async () => {
    const run = await playRoute(DRY_ROUTE, 1)
    expect(run.stuck).toBeUndefined()
    expect(run.finished).toBe(true)
  })
})
