/**
 * The room's switchboard: every client message, from raw text to the rule it runs (FloorFifty
 * `race-room-commands.ts`, over net's one wire instead of a message type per command).
 *
 * The order is spec §4.3's: the size cap and the strict schema first (net's `parseClientMessage`), then a `cmd`'s
 * payload by the sim's own command schema (`RoomEngine.submit`). A message that fails anywhere is dropped and
 * counted, never answered with a disconnect, and never reaches the sim.
 *
 * `ready`, `bot.add`, `bot.remove` and `leave` carry a request id and are answered exactly once through the
 * ledger, so a resent request never acts twice. `cmd` and `ping` are fire and forget: each is only worth anything
 * on the tick it arrives.
 */

import { type ClientMessage, parseClientMessage } from '@automata/net'
import type { RoomEngine } from './room-engine'

/** The rule a correlated request runs for the seat that sent it; it refuses by throwing `RoomCommandError`. */
function requestRule(engine: RoomEngine, seat: number, message: ClientMessage): (() => void) | undefined {
  switch (message.t) {
    case 'ready':
      return () => engine.setReady(seat, message.ready)
    case 'bot.add':
      return () => {
        engine.addBot(seat)
      }
    case 'bot.remove':
      return () => engine.removeBot(seat, message.seat)
    case 'leave':
      return () => undefined
    default:
      return undefined
  }
}

export function receiveMessage(engine: RoomEngine, session: string, raw: unknown): void {
  const seat = engine.seatOf(session)
  // A message from a session without a seat has nobody to act for.
  if (seat === undefined) return
  if (typeof raw !== 'string') {
    engine.log({ event: 'refused', seat, code: 'not-text' })
    return
  }
  const parsed = parseClientMessage(raw)
  if (!parsed.ok) {
    // Spec §6 names the size refusal `size`; the others keep net's reason.
    engine.log({ event: 'refused', seat, code: parsed.reason === 'too-large' ? 'size' : parsed.reason })
    return
  }
  const message = parsed.message
  if (message.t === 'cmd') {
    const outcome = engine.submit(
      seat,
      { seq: message.seq, tick: message.tick, type: message.type, payload: message.payload },
      true,
    )
    if (outcome !== 'accepted' && outcome !== 'late') engine.log({ event: 'refused', seat, code: outcome })
    return
  }
  if (message.t === 'ping') {
    answerPing(engine, session, message.id, message.tick)
    return
  }

  const rule = requestRule(engine, seat, message)
  if (rule === undefined || !('req' in message)) return
  const { result } = engine.ledger.answer(session, message.req, rule)
  engine.answer(
    session,
    result.ok
      ? { t: 'answer', req: message.req }
      : {
          t: 'answer',
          req: message.req,
          error: result.error.code,
        },
  )
  if (message.t === 'leave') engine.leaveAndClose(session)
}

/**
 * A clock probe, answered at once with how many ticks early its tick arrived. Bounded per session on the room
 * clock. A client without a clock yet sends -1 and is answered against tick 0, which tells it the room's tick.
 */
function answerPing(engine: RoomEngine, session: string, id: number, tick: number): void {
  const now = engine.now()
  const last = engine.lastPingAt.get(session)
  if (last !== undefined && now - last < 50) return
  engine.lastPingAt.set(session, now)
  engine.answer(session, { t: 'pong', id, slack: Math.round(Math.max(0, tick) - engine.nowTicks()) })
}
