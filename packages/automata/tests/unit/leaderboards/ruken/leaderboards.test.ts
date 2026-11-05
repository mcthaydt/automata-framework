import { describe, expect, it } from 'vitest'
import { createLeaderboards, type Leaderboards } from '#src/features/leaderboards/leaderboards.manager.ts'
import {
  createPresentationBus,
  type RuntimeFacts,
} from '#src/shared/runtime/presentation/presentation-bus.manager.ts'
import {
  type FakeHostHandle,
  type HostingTestOptions,
  withHostingTest,
} from '#src/testing/host/page/ruken/hosting-test.ts'

// The `Leaderboards` service over `Hosting.leaderboards` (M5 spec §4.8, §6), under the fake Ruken host. Every
// answer is a named state; no state ever comes from a board kept here.

const granted: HostingTestOptions = {
  hosting: { wants: ['leaderboards'] },
  host: { grant: ['leaderboards'] },
}

type Submitted = RuntimeFacts['leaderboard.submitted']

/** Runs `test` with a ready host and a `Leaderboards`, collecting the `leaderboard.submitted` facts. */
function withBoards<A>(
  test: (boards: Leaderboards, facts: Submitted[], handle: FakeHostHandle) => Promise<A>,
  options: HostingTestOptions = granted,
): Promise<A> {
  return withHostingTest(({ hosting, handle }) => {
    const bus = createPresentationBus()
    const facts: Submitted[] = []
    bus.subscribe('leaderboard.submitted', (fact) => facts.push(fact))
    return test(createLeaderboards(hosting, bus), facts, handle)
  }, options)
}

describe('submitScore', () => {
  it('is accepted with the personal best on a granted host (L-a), and says so on the bus', async () => {
    await withBoards(async (boards, facts, { host }) => {
      expect(boards.state('best')).toEqual({ state: 'idle' })
      const state = await boards.submitScore('best', 42)
      expect(state).toEqual({ state: 'accepted', personalBest: 42, rank: 1 })
      expect(boards.state('best')).toEqual(state)
      expect(host.fakes.leaderboards.submits).toEqual([{ board: 'best', score: 42 }])
      expect(facts).toEqual([
        { board: 'best', state: { state: 'submitting' } },
        { board: 'best', state },
      ])
    })
  })

  it('is offline when the host is offline, and keeps nothing for the board here (L-b)', async () => {
    await withBoards(async (boards, _facts, { host }) => {
      host.fakes.leaderboards.offline = true
      expect(await boards.submitScore('best', 42)).toEqual({ state: 'offline' })
      expect(host.fakes.leaderboards.submits).toEqual([])
      expect(await boards.readBoard('best')).toEqual({ state: 'offline' })
    })
  })

  it('is unavailable without the leaderboards grant, and sends the host nothing', async () => {
    await withBoards(
      async (boards, _facts, { host }) => {
        expect(await boards.submitScore('best', 42)).toEqual({ state: 'unavailable' })
        expect(host.fakes.leaderboards.submits).toEqual([])
      },
      { hosting: { wants: ['leaderboards'] }, host: { grant: ['saves'] } },
    )
  })

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses %s before it reaches the host: a score is a whole number',
    async (score) => {
      await withBoards(async (boards, _facts, { host }) => {
        expect(await boards.submitScore('best', score)).toEqual({ state: 'refused' })
        expect(host.fakes.leaderboards.submits).toEqual([])
      })
    },
  )
})

describe('readBoard', () => {
  it("lists the host's entries, the player's marked isMe", async () => {
    await withBoards(async (boards) => {
      await boards.submitScore('best', 42)
      expect(await boards.readBoard('best', { scope: 'around-me', limit: 5 })).toEqual({
        state: 'entries',
        entries: [{ rank: 1, displayName: 'You', score: 42, isMe: true }],
      })
    })
  })

  it('is empty when the host has no entries for the board', async () => {
    await withBoards(async (boards) => {
      expect(await boards.readBoard('best')).toEqual({ state: 'empty' })
    })
  })

  it('is unavailable without the grant, and offline when the host is', async () => {
    await withBoards(
      async (boards) => {
        expect(await boards.readBoard('best')).toEqual({ state: 'unavailable' })
      },
      { hosting: { wants: ['leaderboards'] }, host: { grant: ['saves'] } },
    )
    await withBoards(async (boards, _facts, { host }) => {
      await boards.submitScore('best', 42)
      host.fakes.leaderboards.offline = true
      // The 42 the host stored a moment ago is not shown: nothing here keeps a copy of the board.
      expect(await boards.readBoard('best')).toEqual({ state: 'offline' })
    })
  })
})
