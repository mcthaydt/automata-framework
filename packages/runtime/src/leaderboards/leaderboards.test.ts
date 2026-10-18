import type { Hosting } from '@mcthaydt/automata-host'
import {
  FakeHostHandle,
  HostingTest,
  type HostingTestOptions,
  runScoped,
} from '@mcthaydt/automata-host/testing'
import { Effect, type Scope } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  makePresentationBus,
  PresentationBus,
  type RuntimeFacts,
} from '../presentation/presentation-bus.manager.js'
import { type Leaderboards, makeLeaderboards } from './leaderboards.manager.js'

// The `Leaderboards` service over `Hosting.leaderboards` (M5 spec §4.8, §6), under the fake Ruken host. Every
// answer is a named state; no state ever comes from a board kept here.

const granted: HostingTestOptions = {
  hosting: { wants: ['leaderboards'] },
  host: { grant: ['leaderboards'] },
}

type Submitted = RuntimeFacts['leaderboard.submitted']

/** Runs `test` with a ready host and a `Leaderboards`, collecting the `leaderboard.submitted` facts. */
function withBoards<A, E>(
  test: (
    boards: Leaderboards,
    facts: Submitted[],
  ) => Effect.Effect<A, E, Hosting | FakeHostHandle | Scope.Scope>,
  options: HostingTestOptions = granted,
): Promise<A> {
  return runScoped(
    Effect.gen(function* () {
      const bus = yield* makePresentationBus()
      const facts: Submitted[] = []
      bus.subscribe('leaderboard.submitted', (fact) => facts.push(fact))
      const boards = yield* makeLeaderboards.pipe(Effect.provideService(PresentationBus, bus))
      return yield* test(boards, facts)
    }).pipe(Effect.provide(HostingTest(options))),
  )
}

describe('submitScore', () => {
  it('is accepted with the personal best on a granted host (L-a), and says so on the bus', async () => {
    await withBoards((boards, facts) =>
      Effect.gen(function* () {
        const { host } = yield* FakeHostHandle
        expect(boards.state('best')).toEqual({ state: 'idle' })
        const state = yield* boards.submitScore('best', 42)
        expect(state).toEqual({ state: 'accepted', personalBest: 42, rank: 1 })
        expect(boards.state('best')).toEqual(state)
        expect(host.fakes.leaderboards.submits).toEqual([{ board: 'best', score: 42 }])
        expect(facts).toEqual([
          { board: 'best', state: { state: 'submitting' } },
          { board: 'best', state },
        ])
      }),
    )
  })

  it('is offline when the host is offline, and keeps nothing for the board here (L-b)', async () => {
    await withBoards((boards) =>
      Effect.gen(function* () {
        const { host } = yield* FakeHostHandle
        host.fakes.leaderboards.offline = true
        expect(yield* boards.submitScore('best', 42)).toEqual({ state: 'offline' })
        expect(host.fakes.leaderboards.submits).toEqual([])
        expect(yield* boards.readBoard('best')).toEqual({ state: 'offline' })
      }),
    )
  })

  it('is unavailable without the leaderboards grant, and sends the host nothing', async () => {
    await withBoards(
      (boards) =>
        Effect.gen(function* () {
          const { host } = yield* FakeHostHandle
          expect(yield* boards.submitScore('best', 42)).toEqual({ state: 'unavailable' })
          expect(host.fakes.leaderboards.submits).toEqual([])
        }),
      { hosting: { wants: ['leaderboards'] }, host: { grant: ['saves'] } },
    )
  })

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses %s before it reaches the host: a score is a whole number',
    async (score) => {
      await withBoards((boards) =>
        Effect.gen(function* () {
          const { host } = yield* FakeHostHandle
          expect(yield* boards.submitScore('best', score)).toEqual({ state: 'refused' })
          expect(host.fakes.leaderboards.submits).toEqual([])
        }),
      )
    },
  )
})
