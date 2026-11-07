import { defineSystem, type SystemDef } from '@mcthaydt/automata-sim'
import { NetOwner } from './net-owner.component'
import { SeatJoin, SeatLeave } from './seat.command'
import { SeatJoined, SeatLeft } from './seat.event'

interface SeatCommand {
  readonly kind: 'join' | 'leave'
  readonly seat: number
  readonly source: number
  readonly seq: number
}

/**
 * Applies the room's seat commands in the order the room sent them (by seq, then source), so a leave and a join of
 * one seat in the same tick hand the seat over. Despawns wait for the end of the tick, so the entities this tick has
 * already let go are kept out of `owned`: a later join sees the seat as free and a second leave sees it empty. The
 * seat entity is the first `net-owner` entity of a seat (the lowest id, since `query` is in id order).
 */
export const seats: SystemDef = defineSystem({
  name: 'net-seats',
  phase: 'input',
  run(ctx) {
    const commands: SeatCommand[] = [
      ...ctx.commands
        .of(SeatJoin)
        .map((c) => ({ kind: 'join' as const, seat: c.payload.seat, source: c.source, seq: c.seq })),
      ...ctx.commands
        .of(SeatLeave)
        .map((c) => ({ kind: 'leave' as const, seat: c.payload.seat, source: c.source, seq: c.seq })),
    ].sort((a, b) => a.seq - b.seq || a.source - b.source)
    const released = new Set<number>()
    const owned = (seat: number) =>
      ctx.query(NetOwner).filter((entity) => entity.get(NetOwner).seat === seat && !released.has(entity.sid))
    for (const command of commands) {
      const entities = owned(command.seat)
      if (command.kind === 'join') {
        if (entities.length > 0) continue
        const sid = ctx.spawn([NetOwner, { seat: command.seat }])
        ctx.emit(SeatJoined, { seat: command.seat, sid })
        continue
      }
      const seatEntity = entities[0]
      if (seatEntity === undefined) continue
      for (const entity of entities) {
        ctx.despawn(entity.sid)
        released.add(entity.sid)
      }
      ctx.emit(SeatLeft, { seat: command.seat, sid: seatEntity.sid })
    }
  },
})
