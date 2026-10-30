import { describe, expect, it } from 'vitest'
import {
  HELD_GRACE_SECONDS,
  heldGraceSeconds,
  holdAllowed,
  isClockName,
  pushHeldDeadlines,
} from './clock-hold'
import { createLobby } from './lobby-rules'

// The clock hold (FloorFifty clock-hold.ts, test 0a of its race-room-clock-hold suite): a test may ask a room to keep
// its countdown and its dropped seats' deadlines where they are, and production never may.

describe('the clock hold', () => {
  it('is refused in production and allowed elsewhere', () => {
    expect(holdAllowed({ NODE_ENV: 'production' })).toBe(false)
    expect(holdAllowed({ NODE_ENV: 'test' })).toBe(true)
    expect(holdAllowed({})).toBe(true)
  })

  it.each(['Production', 'production ', 'production\r'])(
    'reads NODE_ENV %j as production, and refuses',
    (value) => {
      expect(holdAllowed({ NODE_ENV: value })).toBe(false)
    },
  )

  it('names only the clocks a room has', () => {
    expect(isClockName('countdown')).toBe(true)
    expect(isClockName('select')).toBe(false)
    expect(isClockName(3)).toBe(false)
  })

  it("moves a held countdown's end with the tick, and leaves an unheld one", () => {
    const lobby = { ...createLobby(), phase: 'countdown' as const, countdownEndsAtTick: 40 }
    pushHeldDeadlines(lobby, new Map(), new Set(['countdown']))
    expect(lobby.countdownEndsAtTick).toBe(41)
    pushHeldDeadlines(lobby, new Map(), new Set())
    expect(lobby.countdownEndsAtTick).toBe(41)
  })

  it("pushes dropped seats' deadlines while anything is held, and holds Colyseus's grace for a reload", () => {
    const drops = new Map([[1, 100]])
    pushHeldDeadlines(createLobby(), drops, new Set(['countdown']))
    expect(drops.get(1)).toBe(101)
    pushHeldDeadlines(createLobby(), drops, new Set())
    expect(drops.get(1)).toBe(101)
    expect(heldGraceSeconds(new Set(['countdown']), 30)).toBe(HELD_GRACE_SECONDS)
    expect(heldGraceSeconds(new Set(), 30)).toBe(30)
  })
})
