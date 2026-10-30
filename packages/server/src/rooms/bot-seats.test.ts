import { describe, expect, it } from 'vitest'
import { addBot, botCount, botSeed, removeBot } from './bot-seats'
import {
  createLobby,
  endGame,
  type LobbyRules,
  type LobbyState,
  nextHost,
  removeSeat,
  seatPlayer,
  setReady,
  startGame,
  startOver,
} from './lobby-rules'
import { RoomCommandError } from './room-errors'

// FloorFifty `tests/server/rooms/cpu-rules.test.ts` (18 cases): its seat rules for a client-less seat (always
// connected and ready, never the host), 9 cases ported. Colours, personalities, characters, public-room fill and
// select stay FloorFifty's. New: no bot policy refuses `bot.add` (spec §4.3), and a bot never hosts.

const HOST = 0
const GUEST = 1
const RULES: LobbyRules = { minSeats: 2, maxSeats: 4, countdownTicks: 180, startWhen: 'all-ready' }

function lobby(count: number): LobbyState {
  const state = createLobby()
  for (let index = 0; index < count; index += 1) seatPlayer(state, RULES)
  return state
}

function refusal(run: () => void): { code: string; message: string } | undefined {
  try {
    run()
  } catch (error) {
    if (error instanceof RoomCommandError) return { code: error.code, message: error.message }
    throw error
  }
  return undefined
}

describe('adding a bot', () => {
  it('seats a ready, connected bot in the lowest open seat', () => {
    const state = lobby(1)
    const seat = addBot(state, HOST, RULES, true)
    expect(seat).toBe(1)
    expect(state.seats.find((entry) => entry.seat === seat)).toEqual({
      seat: 1,
      ready: true,
      connected: true,
      bot: true,
    })
    expect(botCount(state)).toBe(1)
  })

  it('draws the same seed for the same room and seat, so a room’s story is repeatable', () => {
    expect(botSeed(99, 1)).toBe(botSeed(99, 1))
    expect(botSeed(99, 1)).not.toBe(botSeed(99, 2))
    expect(botSeed(99, 1)).not.toBe(botSeed(98, 1))
  })

  it('is refused when the game has no bot policy', () => {
    expect(refusal(() => addBot(lobby(1), HOST, RULES, false))).toEqual({
      code: 'REFUSED',
      message: 'this game has no bots',
    })
  })

  it('is the host’s alone', () => {
    expect(refusal(() => addBot(lobby(2), GUEST, RULES, true))?.message).toMatch(/host/)
  })

  it('is refused outside the lobby', () => {
    const state = lobby(1)
    state.phase = 'countdown'
    expect(refusal(() => addBot(state, HOST, RULES, true))?.code).toBe('REFUSED')
  })

  it('is refused once every seat is taken', () => {
    const state = lobby(1)
    for (let seat = 1; seat < RULES.maxSeats; seat += 1) addBot(state, HOST, RULES, true)
    expect(refusal(() => addBot(state, HOST, RULES, true))?.code).toBe('ROOM_FULL')
    expect(state.seats).toHaveLength(RULES.maxSeats)
  })

  it('never lets a bot hold the room up: the host’s own Ready starts it', () => {
    const state = lobby(1)
    addBot(state, HOST, RULES, true)
    setReady(state, HOST, true, RULES)
    expect(state.phase).toBe('countdown')
  })

  it('never makes a bot the host', () => {
    const state = lobby(1)
    addBot(state, HOST, RULES, true)
    seatPlayer(state, RULES)
    removeSeat(state, HOST)
    expect(state.hostSeat).toBe(2)
    removeSeat(state, 2)
    expect(nextHost(state)).toBeUndefined()
    expect(state.hostSeat).toBeUndefined()
  })
})

describe('removing a bot', () => {
  it('frees its seat', () => {
    const state = lobby(1)
    const seat = addBot(state, HOST, RULES, true)
    removeBot(state, HOST, seat)
    expect(state.seats.find((entry) => entry.seat === seat)).toBeUndefined()
  })

  it('refuses a guest, a person’s seat and an unknown one', () => {
    const state = lobby(2)
    const seat = addBot(state, HOST, RULES, true)
    expect(refusal(() => removeBot(state, GUEST, seat))?.message).toMatch(/host/)
    expect(refusal(() => removeBot(state, HOST, GUEST))?.message).toMatch(/not a bot/)
    expect(refusal(() => removeBot(state, HOST, 15))?.message).toMatch(/not a bot/)
    expect(botCount(state)).toBe(1)
  })
})

describe('starting over', () => {
  it('keeps the room’s bots, ready', () => {
    const state = lobby(1)
    const seat = addBot(state, HOST, RULES, true)
    setReady(state, HOST, true, RULES)
    startGame(state)
    endGame(state)
    startOver(state)
    expect(state.seats.find((entry) => entry.seat === seat)).toMatchObject({ bot: true, ready: true })
  })
})
