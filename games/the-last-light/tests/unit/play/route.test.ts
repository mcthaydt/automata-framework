import { describe, expect, it } from 'vitest'
import { playRoute } from '#src/testing/bot.ts'
import { ROUTE } from '#src/testing/route.ts'

// The bot plays the prologue from its first tap to its end: the scene can be finished by hand, and the same seed gives the
// same hash. (A hash that differs between two runs is a bug to find, never to re-record.)

describe('the old solver’s route', { timeout: 60_000 }, () => {
  it('finishes the prologue, and is never caught', async () => {
    const run = await playRoute(ROUTE, 1)
    expect(run.stuck).toBeUndefined()
    expect(run.finished).toBe(true)
    expect(run.caught).toBe(0)
  })

  it('twice, the same hash', async () => {
    expect((await playRoute(ROUTE, 1)).hash).toBe((await playRoute(ROUTE, 1)).hash)
  })
})
