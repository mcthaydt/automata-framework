/**
 * A game's server: what the generic room runs, given by the game and checked once by `defineServer`.
 *
 * The room steps the same `plugins` and `content` as every client, seats players and bots, and asks the game
 * only what it cannot know: which commands give a new seat its avatar (`seat`), how a bot plays (`bots`) and when a
 * game is over (`ended`). Everything else is the room's.
 */

import { MAX_SEATS } from '@automata/net'
import { netPlugin, ROOM_SOURCE, SeatJoin, SeatLeave } from '@automata/net/sim'
import type { CommandDef, PluginDef, Rng, SimEvent } from '@automata/sim'
import type { SimView } from './sim-view'

/** A command without its header: the room stamps `tick`, `source` and `seq`. */
export interface CommandIntent {
  readonly type: string
  readonly payload: unknown
}

/** The bot-seat hook (PD-5): no AI ships. */
export interface BotPolicy {
  readonly name: string
  /**
   * Called once per tick for each bot seat, while the room takes commands (the countdown and play). Reads the sim;
   * never writes it. Its commands enter the same input queue with the bot's seat as `source`, so they are in the
   * replay and clients see bots only through snapshots.
   */
  commands(view: SimView, seat: number, rng: Rng): readonly CommandIntent[]
}

export interface ServerGameDef {
  /** The game's sim, the same list its client uses; it must include net's `netPlugin`. */
  readonly plugins: readonly PluginDef[]
  /** Compiled content, as `SimOptions.content`; its hash must equal the client's. */
  readonly content?: unknown
  readonly seats: { readonly min: number; readonly max: number }
  readonly lobby?: { readonly countdownSeconds: number; readonly startWhen: 'all-ready' | 'host' }
  /** Commands that give a newly seated seat (a player or a bot) its entities, sent right after `seat.join`. */
  readonly seat?: (seat: number, name: string) => readonly CommandIntent[]
  readonly bots?: BotPolicy
  /**
   * Whether play is over, asked after each tick of play with that tick's events. Without it a game plays until its
   * room closes.
   */
  readonly ended?: (view: SimView, events: readonly SimEvent[]) => boolean
}

export interface ServerDef {
  readonly kind: 'server'
  readonly game: ServerGameDef
  readonly seats: { readonly min: number; readonly max: number }
  readonly lobby: { readonly countdownSeconds: number; readonly startWhen: 'all-ready' | 'host' }
  /**
   * The definition of a command a client may send, by type: every plugin's commands but net's seat commands, which
   * only the room sends. Undefined for any other type.
   */
  clientCommand(type: string): CommandDef | undefined
}

/**
 * The sim `source` of the room's own commands (seat.join, seat.leave and the game's spawn commands): the highest
 * source the sim accepts, never a seat (seats are 0 to MAX_SEATS - 1). Owned by net's sim side, so a game's sim reads
 * the same constant; re-exported here for the server's callers.
 */
export { ROOM_SOURCE }

const DEFAULT_LOBBY = { countdownSeconds: 3, startWhen: 'all-ready' } as const

function checkSeats({ min, max }: { readonly min: number; readonly max: number }): void {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max > MAX_SEATS || min > max)
    throw new Error(`seats must be whole numbers with 1 <= min <= max <= ${MAX_SEATS}; got ${min} to ${max}`)
}

/** Checks a game's server once, so a room never meets a bad one. Throws for a definition no room can run. */
export function defineServer(def: ServerGameDef): ServerDef {
  checkSeats(def.seats)
  const lobby = def.lobby ?? DEFAULT_LOBBY
  if (!Number.isFinite(lobby.countdownSeconds) || lobby.countdownSeconds < 0)
    throw new Error(`the countdown must be zero or more seconds; got ${lobby.countdownSeconds}`)
  if (!def.plugins.includes(netPlugin))
    throw new Error(
      "the game's plugins must include net's netPlugin: the room seats players with its commands",
    )

  const roomOnly = new Set<string>([SeatJoin.id, SeatLeave.id])
  const commands = new Map<string, CommandDef>()
  for (const plugin of def.plugins)
    for (const command of plugin.commands) if (!roomOnly.has(command.id)) commands.set(command.id, command)

  return {
    kind: 'server',
    game: def,
    seats: { min: def.seats.min, max: def.seats.max },
    lobby: { countdownSeconds: lobby.countdownSeconds, startWhen: lobby.startWhen },
    clientCommand: (type) => commands.get(type),
  }
}
