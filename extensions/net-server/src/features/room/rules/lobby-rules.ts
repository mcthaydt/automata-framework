/**
 * The rules around a game: seating, readiness, the countdown, the host, starting and starting over.
 *
 * Plain functions over a `LobbyState`, with no Colyseus, no clock and no I/O, so every rule is tested by building a
 * lobby and calling it. Each rule mutates the lobby it is given, as the room's own state is mutated everywhere else;
 * the room then does what only it can: telling the sim (`seat.join`, `seat.leave`), publishing, and setting `tick`
 * once per tick. The room calls `evaluateReadiness` on every join, leave, drop and return, and a ready change
 * calls it itself.
 *
 * A request a player may not make throws `RoomCommandError`; the room's `CommandLedger` turns that into the answer
 * the player sees.
 */

import { type LobbyPhase, MAX_SEATS } from '@automata/net'
import { RoomCommandError } from './room-errors'

/** One taken seat. A bot has no client: always connected and ready, never the host (`bot-seats.ts`). */
export interface LobbySeat {
  readonly seat: number
  ready: boolean
  connected: boolean
  readonly bot: boolean
}

/**
 * The room's lobby: its phase, the host, who is seated and ready, and the countdown's end. The
 * lobby rules change it in place.
 */
export interface LobbyState {
  phase: LobbyPhase
  /** The room's tick, set by the room once per tick: the countdown runs on it. */
  tick: number
  hostSeat: number | undefined
  countdownEndsAtTick: number | undefined
  startedAtTick: number | undefined
  /** Taken seats in seating order: the longest-seated first. */
  readonly seats: LobbySeat[]
}

/** A game's lobby. */
export interface LobbyRules {
  /** Seats, bots included, that must be taken before a game starts. */
  readonly minSeats: number
  /** Seats the room offers; never more than net's `MAX_SEATS`. */
  readonly maxSeats: number
  readonly countdownTicks: number
  /** `all-ready`: the countdown starts when every connected player is ready. `host`: when the host says so. */
  readonly startWhen: 'all-ready' | 'host'
}

/** A new, empty lobby, before anyone has sat down. */
export function createLobby(): LobbyState {
  return {
    phase: 'lobby',
    tick: 0,
    hostSeat: undefined,
    countdownEndsAtTick: undefined,
    startedAtTick: undefined,
    seats: [],
  }
}

/** Before the game: the lobby, and only the lobby. From the countdown on, nobody new sits down or readies. */
export function isPreGame(lobby: Pick<LobbyState, 'phase'>): boolean {
  return lobby.phase === 'lobby'
}

/**
 * Whether the room takes commands for the sim: from the countdown on, so a player holding a direction through GO
 * moves on the first tick of play exactly as they would locally; never in the lobby, and never once the game ended.
 */
export function acceptsInput(lobby: Pick<LobbyState, 'phase'>): boolean {
  return lobby.phase === 'countdown' || lobby.phase === 'playing'
}

const seatEntry = (lobby: LobbyState, seat: number): LobbySeat | undefined =>
  lobby.seats.find((entry) => entry.seat === seat)

/** The lowest seat number nobody holds, or undefined when the room is full. */
export function openSeat(lobby: LobbyState, rules: LobbyRules): number | undefined {
  const seats = Math.min(rules.maxSeats, MAX_SEATS)
  if (lobby.seats.length >= seats) return undefined
  for (let seat = 0; seat < seats; seat += 1) if (seatEntry(lobby, seat) === undefined) return seat
  return undefined
}

/** Takes the lowest open seat for a seat entry; refuses outside the lobby and in a full room. */
export function takeSeat(lobby: LobbyState, rules: LobbyRules, bot: boolean): number {
  if (!isPreGame(lobby)) throw new RoomCommandError('REFUSED', 'seats are taken in the lobby')
  const seat = openSeat(lobby, rules)
  if (seat === undefined) throw new RoomCommandError('ROOM_FULL', 'every seat is taken')
  lobby.seats.push({ seat, ready: bot, connected: true, bot })
  return seat
}

/** Seats a joining player in the lowest open seat; the first player to sit down hosts. Returns the seat. */
export function seatPlayer(lobby: LobbyState, rules: LobbyRules): number {
  const seat = takeSeat(lobby, rules, false)
  if (lobby.hostSeat === undefined) lobby.hostSeat = seat
  return seat
}

/**
 * A player's drop (false) or return (true). A dropped player cannot hold the room up, so their readiness is cleared;
 * they keep the host role while their seat is held. A countdown that no longer has anyone
 * connected is cancelled.
 */
export function setConnected(lobby: LobbyState, seat: number, connected: boolean, rules: LobbyRules): void {
  const entry = seatEntry(lobby, seat)
  if (entry === undefined || entry.bot) return
  entry.connected = connected
  if (!connected) entry.ready = false
  cancelCountdownIfUnmet(lobby, rules)
}

/**
 * Frees a seat for good: a leave, or a drop past the grace. A host who leaves hands the role on (`nextHost`), and a
 * countdown left short of the game's minimum is cancelled.
 */
export function removeSeat(lobby: LobbyState, seat: number, rules: LobbyRules): void {
  const index = lobby.seats.findIndex((entry) => entry.seat === seat)
  if (index === -1) return
  lobby.seats.splice(index, 1)
  if (lobby.hostSeat === seat) lobby.hostSeat = nextHost(lobby)
  cancelCountdownIfUnmet(lobby, rules)
}

/**
 * The conditions that started a countdown must still hold when it ends: the minimum of seats, and under `all-ready`
 * someone connected. The seat minimum is held through the countdown, not only at its start.
 */
function cancelCountdownIfUnmet(lobby: LobbyState, rules: LobbyRules): void {
  if (lobby.phase !== 'countdown') return
  const short = lobby.seats.length < rules.minSeats
  const nobodyThere = rules.startWhen === 'all-ready' && connectedPlayers(lobby).length === 0
  if (!short && !nobodyThere) return
  lobby.phase = 'lobby'
  lobby.countdownEndsAtTick = undefined
}

/**
 * Who hosts next, from the seated players in seating order: the longest-seated player who is still connected,
 * because a host who has dropped would block everyone who is there; when nobody is connected, the longest-seated
 * player, so a room always has a host to hand on. Never a bot.
 */
export function nextHost(lobby: LobbyState): number | undefined {
  const players = lobby.seats.filter((entry) => !entry.bot)
  return (players.find((entry) => entry.connected) ?? players[0])?.seat
}

/** The players a room waits on: connected people. A dropped player is not connected; a bot never makes anyone wait. */
const connectedPlayers = (lobby: LobbyState): LobbySeat[] =>
  lobby.seats.filter((entry) => entry.connected && !entry.bot)

function beginCountdown(lobby: LobbyState, rules: LobbyRules): void {
  lobby.phase = 'countdown'
  lobby.countdownEndsAtTick = lobby.tick + rules.countdownTicks
}

/**
 * Under `all-ready`, starts the countdown once every connected player is ready and the game's minimum of seats is
 * taken. A room with nobody connected never starts. Outside the lobby, or under `host`, it does nothing.
 */
export function evaluateReadiness(lobby: LobbyState, rules: LobbyRules): void {
  if (!isPreGame(lobby) || rules.startWhen !== 'all-ready') return
  if (lobby.seats.length < rules.minSeats) return
  const connected = connectedPlayers(lobby)
  if (connected.length === 0 || !connected.every((entry) => entry.ready)) return
  beginCountdown(lobby, rules)
}

/** A player's Ready toggle, in the lobby only. */
export function setReady(lobby: LobbyState, seat: number, ready: boolean, rules: LobbyRules): void {
  if (!isPreGame(lobby)) throw new RoomCommandError('REFUSED', 'readiness only changes in the lobby')
  const entry = seatEntry(lobby, seat)
  if (entry === undefined) throw new RoomCommandError('REFUSED', 'no such seat in this room')
  entry.ready = ready
  evaluateReadiness(lobby, rules)
}

/**
 * The host's Start, under `host`. A guest is told they are not the host before anything else, so the lobby can
 * disable the control for the right reason rather than "not now".
 */
export function startCountdown(lobby: LobbyState, by: number, rules: LobbyRules): void {
  if (by !== lobby.hostSeat) throw new RoomCommandError('REFUSED', 'only the host starts the game')
  if (rules.startWhen !== 'host')
    throw new RoomCommandError('REFUSED', 'this game starts when everyone is ready')
  if (!isPreGame(lobby)) throw new RoomCommandError('REFUSED', 'the game has already started')
  if (lobby.seats.length < rules.minSeats)
    throw new RoomCommandError('REFUSED', `the game needs ${rules.minSeats} seats taken`)
  beginCountdown(lobby, rules)
}

/** Whether a running countdown has reached zero on this tick. */
export function countdownElapsed(lobby: LobbyState): boolean {
  return (
    lobby.phase === 'countdown' &&
    lobby.countdownEndsAtTick !== undefined &&
    lobby.tick >= lobby.countdownEndsAtTick
  )
}

/** Play begins on this tick; every seat keeps its connection and readiness. Only from the countdown. */
export function startGame(lobby: LobbyState): void {
  if (lobby.phase !== 'countdown') throw new RoomCommandError('REFUSED', 'a game starts from the countdown')
  lobby.phase = 'playing'
  lobby.startedAtTick = lobby.tick
  lobby.countdownEndsAtTick = undefined
}

/** The game says it is over. Only from play. */
export function endGame(lobby: LobbyState): void {
  if (lobby.phase !== 'playing') throw new RoomCommandError('REFUSED', 'no game is being played')
  lobby.phase = 'ended'
}

/**
 * Play again: a fresh lobby after an ended game, keeping every seat, the host and the room's clock (`tick` is kept,
 * so a dropped seat's grace deadline stays meaningful). A dropped player comes over still dropped; were they rebuilt
 * as connected, they would count as a player who is not ready and the countdown could never start. People ready
 * again in the lobby; a bot is always ready.
 */
export function startOver(lobby: LobbyState): void {
  if (lobby.phase !== 'ended') throw new RoomCommandError('REFUSED', 'a game is still in progress')
  lobby.phase = 'lobby'
  lobby.startedAtTick = undefined
  lobby.countdownEndsAtTick = undefined
  for (const entry of lobby.seats) entry.ready = entry.bot
}
