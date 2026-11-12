import { describe, expect, it } from 'vitest'
import { playRoute } from '#src/testing/bot.ts'
import { ROUTE } from '#src/testing/route.ts'

// A careful player is never caught: the route (the lamp put out at lights out, hiding behind the screen until she has
// gone) over twenty seeds finishes the scene with no practice catch. The creature's own fairness targets are the systems
// file's, checked by the systems extension's bots.

describe('a careful night', () => {
  it('is never caught in 20 seeds, and finishes each', async () => {
    const runs = []
    for (let seed = 1; seed <= 20; seed += 1) runs.push(await playRoute(ROUTE, seed))
    expect(runs.map((run) => run.stuck).filter((stuck) => stuck !== undefined)).toEqual([])
    expect(runs.map((run) => run.caught)).toEqual(Array(20).fill(0))
    expect(runs.every((run) => run.finished)).toBe(true)
  }, 120_000)
})
