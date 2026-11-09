import { describe, expect, it } from 'vitest'
import {
  acceptsInput,
  countdownElapsed,
  createLobby,
  endGame,
  evaluateReadiness,
  isPreGame,
  type LobbyRules,
  type LobbyState,
  nextHost,
  openSeat,
  removeSeat,
  seatPlayer,
  setConnected,
  setReady,
  startCountdown,
  startGame,
  startOver,
} from '#src/features/room/rules/lobby-rules.ts'
import { RoomCommandError } from '#src/features/room/rules/room-errors.ts'

// The lobby: phases, readiness, the countdown, starting, starting over and the next host, plus the host-start
// rule, the seat minimum, seating and dropping. A game's own modes and settings are not the lobby's.

const HOST = 0
const GUEST = 1
const THIRD = 2

const RULES: LobbyRules = { minSeats: 1, maxSeats: 4, countdownTicks: 180, startWhen: 'all-ready' }

/** A fresh lobby with players seated in this order, the first of them hosting. */
function lobby(count: number, rules: LobbyRules = RULES): LobbyState {
  const state = createLobby()
  for (let index = 0; index < count; index += 1) seatPlayer(state, rules)
  return state
}

const seat = (state: LobbyState, number: number) => state.seats.find((entry) => entry.seat === number)

/** The code and words a rule refused with, or undefined if it did not refuse. */
function refusal(run: () => void): { code: string; message: string } | undefined {
  try {
    run()
  } catch (error) {
    if (error instanceof RoomCommandError) return { code: error.code, message: error.message }
    throw error
  }
  return undefined
}

describe('the phases', () => {
  it('counts only the lobby as before the game', () => {
    expect(isPreGame({ phase: 'lobby' })).toBe(true)
    expect(isPreGame({ phase: 'countdown' })).toBe(false)
    expect(isPreGame({ phase: 'playing' })).toBe(false)
    expect(isPreGame({ phase: 'ended' })).toBe(false)
  })

  it('takes input from the countdown until the game ends', () => {
    expect(acceptsInput({ phase: 'lobby' })).toBe(false)
    expect(acceptsInput({ phase: 'countdown' })).toBe(true)
    expect(acceptsInput({ phase: 'playing' })).toBe(true)
    expect(acceptsInput({ phase: 'ended' })).toBe(false)
  })
})

describe('seating', () => {
  it('seats players in the lowest open seat, the first one hosting', () => {
    const state = lobby(2)
    expect(state.seats).toEqual([
      { seat: HOST, ready: false, connected: true, bot: false },
      { seat: GUEST, ready: false, connected: true, bot: false },
    ])
    expect(state.hostSeat).toBe(HOST)
    removeSeat(state, HOST, RULES)
    expect(openSeat(state, RULES)).toBe(HOST)
    expect(seatPlayer(state, RULES)).toBe(HOST)
  })

  it('refuses a seat once every seat is taken, and outside the lobby', () => {
    const full = lobby(4)
    expect(openSeat(full, RULES)).toBeUndefined()
    expect(refusal(() => seatPlayer(full, RULES))?.code).toBe('ROOM_FULL')
    const playing = lobby(1)
    playing.phase = 'playing'
    expect(refusal(() => seatPlayer(playing, RULES))?.code).toBe('REFUSED')
  })

  it('clears a dropped seat’s readiness, and hands the host on only when the host leaves', () => {
    const state = lobby(2)
    setReady(state, HOST, true, RULES)
    setConnected(state, HOST, false, RULES)
    expect(seat(state, HOST)).toMatchObject({ connected: false, ready: false })
    expect(state.hostSeat).toBe(HOST)
    setConnected(state, HOST, true, RULES)
    removeSeat(state, HOST, RULES)
    expect(state.hostSeat).toBe(GUEST)
  })
})

describe('readiness', () => {
  it('starts the countdown once every connected player is ready', () => {
    const state = lobby(2)
    setReady(state, HOST, true, RULES)
    expect(state.phase).toBe('lobby')

    setReady(state, GUEST, true, RULES)
    expect(state.phase).toBe('countdown')
    expect(state.countdownEndsAtTick).toBe(state.tick + RULES.countdownTicks)
  })

  it('does not wait for a player who dropped', () => {
    const state = lobby(2)
    setConnected(state, GUEST, false, RULES)
    setReady(state, HOST, true, RULES)
    expect(state.phase).toBe('countdown')
  })

  it('refuses un-readying once the countdown has started', () => {
    const state = lobby(2)
    setReady(state, HOST, true, RULES)
    setReady(state, GUEST, true, RULES)
    expect(refusal(() => setReady(state, GUEST, false, RULES))?.code).toBe('REFUSED')
    expect(state.phase).toBe('countdown')
  })

  it('never counts down a room with nobody connected', () => {
    const state = lobby(1)
    setConnected(state, HOST, false, RULES)
    const host = seat(state, HOST)
    if (host !== undefined) host.ready = true
    evaluateReadiness(state, RULES)
    expect(state.phase).toBe('lobby')
  })

  it('leaves a game that has begun alone', () => {
    const state = lobby(1)
    state.phase = 'playing'
    evaluateReadiness(state, RULES)
    expect(state.phase).toBe('playing')
  })

  it('refuses a readiness change once the game has begun', () => {
    const state = lobby(1)
    state.phase = 'playing'
    expect(refusal(() => setReady(state, HOST, true, RULES))?.code).toBe('REFUSED')
  })

  it('refuses readiness for a seat that is not in the room', () => {
    expect(refusal(() => setReady(lobby(1), GUEST, true, RULES))).toEqual({
      code: 'REFUSED',
      message: 'no such seat in this room',
    })
  })

  it('waits for the game’s minimum number of seats', () => {
    const rules: LobbyRules = { ...RULES, minSeats: 2 }
    const state = lobby(1, rules)
    setReady(state, HOST, true, rules)
    expect(state.phase).toBe('lobby')
    seatPlayer(state, rules)
    setReady(state, GUEST, true, rules)
    expect(state.phase).toBe('countdown')
  })
})

describe('the host’s start', () => {
  const HOST_RULES: LobbyRules = { ...RULES, minSeats: 2, startWhen: 'host' }

  it('starts the countdown on the host’s word, ready or not, and never on readiness alone', () => {
    const state = lobby(2, HOST_RULES)
    setReady(state, HOST, true, HOST_RULES)
    setReady(state, GUEST, true, HOST_RULES)
    expect(state.phase).toBe('lobby')
    startCountdown(state, HOST, HOST_RULES)
    expect(state.phase).toBe('countdown')
    expect(state.countdownEndsAtTick).toBe(state.tick + HOST_RULES.countdownTicks)
  })

  it('refuses a guest, a room short of its minimum, a room past the lobby and an all-ready room', () => {
    const state = lobby(2, HOST_RULES)
    expect(refusal(() => startCountdown(state, GUEST, HOST_RULES))?.message).toMatch(/host/)
    expect(refusal(() => startCountdown(lobby(1, HOST_RULES), HOST, HOST_RULES))?.message).toMatch(/seats/)
    const started = lobby(2, HOST_RULES)
    started.phase = 'countdown'
    expect(refusal(() => startCountdown(started, HOST, HOST_RULES))?.code).toBe('REFUSED')
    expect(refusal(() => startCountdown(lobby(2), HOST, RULES))?.message).toMatch(/ready/)
  })
})

describe('the countdown', () => {
  it('has not elapsed in the lobby', () => {
    expect(countdownElapsed(lobby(1))).toBe(false)
  })

  it('elapses on the tick it was set to end', () => {
    const state = lobby(1)
    setReady(state, HOST, true, RULES)
    state.tick = RULES.countdownTicks - 1
    expect(countdownElapsed(state)).toBe(false)
    state.tick = RULES.countdownTicks
    expect(countdownElapsed(state)).toBe(true)
  })
})

describe('starting and ending a game', () => {
  it('starts playing on the tick, keeping each seat’s connection and readiness', () => {
    const state = lobby(2)
    setReady(state, HOST, true, RULES)
    setReady(state, GUEST, true, RULES)
    setConnected(state, GUEST, false, RULES)
    state.tick = 180

    startGame(state)

    expect(state.phase).toBe('playing')
    expect(state.startedAtTick).toBe(180)
    expect(state.countdownEndsAtTick).toBeUndefined()
    expect(seat(state, HOST)).toMatchObject({ connected: true, ready: true })
    expect(seat(state, GUEST)).toMatchObject({ connected: false })
  })

  it('starts only from the countdown, and ends only a game in play', () => {
    expect(refusal(() => startGame(lobby(1)))?.code).toBe('REFUSED')
    expect(refusal(() => endGame(lobby(1)))?.code).toBe('REFUSED')
    const state = lobby(1)
    setReady(state, HOST, true, RULES)
    startGame(state)
    endGame(state)
    expect(state.phase).toBe('ended')
  })
})

describe('starting over', () => {
  /** A room of `count` players whose game has ended at tick 5 000. */
  function ended(count: number): LobbyState {
    const state = lobby(count)
    for (let index = 0; index < count; index += 1) setReady(state, index, true, RULES)
    state.tick = 5_000
    startGame(state)
    endGame(state)
    return state
  }

  it('opens a fresh lobby on the same clock, with readiness cleared', () => {
    const state = ended(2)
    startOver(state)
    expect(state.phase).toBe('lobby')
    expect(state.tick).toBe(5_000)
    expect(state.startedAtTick).toBeUndefined()
    expect(state.seats.map((entry) => [entry.seat, entry.ready])).toEqual([
      [HOST, false],
      [GUEST, false],
    ])
  })

  it('carries a dropped player over, still dropped', () => {
    const state = ended(2)
    setConnected(state, GUEST, false, RULES)
    startOver(state)
    expect(seat(state, GUEST)).toMatchObject({ connected: false, ready: false })
    expect(seat(state, HOST)).toMatchObject({ connected: true })
  })

  it('keeps the host', () => {
    const state = ended(2)
    startOver(state)
    expect(state.hostSeat).toBe(HOST)
  })

  it('refuses while a game is still running', () => {
    const state = lobby(1)
    setReady(state, HOST, true, RULES)
    startGame(state)
    expect(refusal(() => startOver(state))?.code).toBe('REFUSED')
  })
})

describe('choosing the next host', () => {
  it('prefers the longest-seated player who is still connected', () => {
    const state = lobby(3)
    removeSeat(state, HOST, RULES)
    setConnected(state, GUEST, false, RULES)
    expect(nextHost(state)).toBe(THIRD)
  })

  it('falls back to the longest-seated player when nobody is connected', () => {
    const state = lobby(3)
    removeSeat(state, HOST, RULES)
    setConnected(state, GUEST, false, RULES)
    setConnected(state, THIRD, false, RULES)
    expect(nextHost(state)).toBe(GUEST)
  })

  it('finds nobody when no seat is taken', () => {
    expect(nextHost(createLobby())).toBeUndefined()
  })

  // The seat minimum holds through the countdown, not only at its start.
  it('cancels a countdown when a leave leaves fewer seats than the minimum', () => {
    const rules: LobbyRules = { ...RULES, minSeats: 2 }
    const state = lobby(2, rules)
    setReady(state, HOST, true, rules)
    setReady(state, GUEST, true, rules)
    expect(state.phase).toBe('countdown')
    removeSeat(state, GUEST, rules)
    expect(state.phase).toBe('lobby')
    expect(state.countdownEndsAtTick).toBeUndefined()
  })

  it('cancels an all-ready countdown when every connected player has dropped', () => {
    const state = lobby(2)
    setReady(state, HOST, true, RULES)
    setReady(state, GUEST, true, RULES)
    setConnected(state, HOST, false, RULES)
    expect(state.phase).toBe('countdown')
    setConnected(state, GUEST, false, RULES)
    expect(state.phase).toBe('lobby')
    expect(state.countdownEndsAtTick).toBeUndefined()
  })

  it('keeps the host role with a host who drops while a guest is connected', () => {
    const state = lobby(2)
    setConnected(state, HOST, false, RULES)
    expect(state.hostSeat).toBe(HOST)
  })
})
