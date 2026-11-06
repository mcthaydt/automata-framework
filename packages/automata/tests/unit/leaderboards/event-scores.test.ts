import { describe, expect, it } from 'vitest'
import { submitEventScores } from '#src/features/leaderboards/event-scores.ts'
import type { BoardState } from '#src/shared/runtime/board-state.ts'
import { createPresentationBus } from '#src/shared/runtime/presentation/presentation-bus.manager.ts'

// The game's scores for sim events (M5 spec §4.8): the sim emits an event, and the runtime submits the score the
// game computes from its payload. The score is never typed by anyone (Ruken request R-80).

function recordingBoards() {
  const sent: { board: string; score: number }[] = []
  return {
    sent,
    submitScore: async (board: string, score: number): Promise<BoardState> => {
      sent.push({ board, score })
      return { state: 'accepted', personalBest: score }
    },
  }
}

describe('submitEventScores', () => {
  it("submits each scored event once, with the score computed from the event's payload", () => {
    const bus = createPresentationBus()
    const boards = recordingBoards()
    const stop = submitEventScores(bus, boards, {
      'run-ended': { board: 'best', score: (payload) => (payload as { ticks: number }).ticks * 10 },
    })
    bus.publish('sim.events', [
      { type: 'run-ended', payload: { ticks: 30 } },
      { type: 'coin', payload: {} },
      { type: 'run-ended', payload: { ticks: 7 } },
    ])
    expect(boards.sent).toEqual([
      { board: 'best', score: 300 },
      { board: 'best', score: 70 },
    ])
    stop()
    bus.publish('sim.events', [{ type: 'run-ended', payload: { ticks: 1 } }])
    expect(boards.sent).toHaveLength(2)
  })
})
