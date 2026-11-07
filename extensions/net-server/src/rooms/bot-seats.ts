/**
 * Bot seats (FloorFifty `cpu-rules.ts`' seat rules, spec §4.3 and PD-5).
 *
 * A bot is a seat with no client: always connected, always ready, never the host. The host adds one to an open seat
 * in the lobby; each tick the room asks the game's `BotPolicy` for its commands (M7.3b), and they enter the same
 * input queue with the bot's seat as `source`, so they are in the replay and clients see bots only through snapshots.
 * A game with no policy refuses `bot.add`. FloorFifty's colours, personalities, characters and public-room fill stay
 * FloorFifty's.
 */

import { deriveSeed } from '@automata/sim'
import { isPreGame, type LobbyRules, type LobbyState, takeSeat } from './lobby-rules'
import { RoomCommandError } from './room-errors'

export const botCount = (lobby: LobbyState): number => lobby.seats.filter((entry) => entry.bot).length

/**
 * The host's tap on an open seat, in the lobby only. `botsAllowed` is whether the game configured a `BotPolicy`.
 * Returns the bot's seat.
 */
export function addBot(lobby: LobbyState, by: number, rules: LobbyRules, botsAllowed: boolean): number {
  if (!botsAllowed) throw new RoomCommandError('REFUSED', 'this game has no bots')
  if (by !== lobby.hostSeat) throw new RoomCommandError('REFUSED', 'only the host adds a bot')
  if (!isPreGame(lobby)) throw new RoomCommandError('REFUSED', 'bots are added in the lobby')
  return takeSeat(lobby, rules, true)
}

/** The host's tap on a bot's seat: frees it. */
export function removeBot(lobby: LobbyState, by: number, seat: number): void {
  if (by !== lobby.hostSeat) throw new RoomCommandError('REFUSED', 'only the host removes a bot')
  if (!isPreGame(lobby)) throw new RoomCommandError('REFUSED', 'bots are removed in the lobby')
  const index = lobby.seats.findIndex((entry) => entry.seat === seat && entry.bot)
  if (index === -1) throw new RoomCommandError('REFUSED', 'that seat is not a bot')
  lobby.seats.splice(index, 1)
}

/**
 * The seed of a bot seat's RNG (spec §4.3: `deriveSeed(roomSeed, seat)`; the sim's `deriveSeed` names its stream
 * with a string). The same room and seat draw the same stream, so a room's story repeats from its replay.
 */
export const botSeed = (roomSeed: number, seat: number): number => deriveSeed(roomSeed, `bot:${seat}`)
