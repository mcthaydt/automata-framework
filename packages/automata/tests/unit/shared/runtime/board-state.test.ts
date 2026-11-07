import { describe, expect, it } from 'vitest'
import { boardStateFromError, boardStateFromSubmit } from '#src/shared/runtime/board-state.ts'
import type { HostRefusal } from '../../../../src/shared/host/errors.ts'

const hostError = (code: HostRefusal['code']): HostRefusal => ({
  code,
  retryable: false,
  operation: 'leaderboard.submit',
})

// M5 spec §4.8 and §6: every host answer is one named state a screen can show; none is a local board.
describe('board states from the host', () => {
  it('is accepted, with the personal best and the rank when the host gives one', () => {
    expect(boardStateFromSubmit({ accepted: true, personalBest: 31_250, rank: 4 })).toEqual({
      state: 'accepted',
      personalBest: 31_250,
      rank: 4,
    })
    expect(boardStateFromSubmit({ accepted: true, personalBest: 31_250 })).toEqual({
      state: 'accepted',
      personalBest: 31_250,
    })
  })

  it('is refused when the host does not accept the score', () => {
    expect(boardStateFromSubmit({ accepted: false, personalBest: 20_000 })).toEqual({ state: 'refused' })
  })

  it.each([
    ['UNSUPPORTED', 'unavailable'],
    ['DENIED', 'unavailable'],
    ['OFFLINE', 'offline'],
    ['TIMEOUT', 'offline'],
    ['INVALID_PAYLOAD', 'refused'],
    ['NOT_READY', 'unavailable'],
    ['RATE_LIMITED', 'unavailable'],
    ['QUOTA_EXCEEDED', 'unavailable'],
    ['CANCELLED', 'unavailable'],
    ['INTERNAL', 'unavailable'],
  ] as const)('maps %s to %s', (code, state) => {
    expect(boardStateFromError(hostError(code))).toEqual({ state })
  })
})
