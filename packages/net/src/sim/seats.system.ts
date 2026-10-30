import { defineSystem, type SystemDef } from '@mcthaydt/automata-sim'
import { NetOwner } from './net-owner.component'
import { SeatJoin, SeatLeave } from './seat.command'
import { SeatJoined, SeatLeft } from './seat.event'

/**
 * Applies the room's seat commands. The seat entity is the first `net-owner` entity of a seat (the lowest id, since
 * `query` is in id order); a join for a held seat and a leave for an empty one change nothing.
 */
export const seats: SystemDef = defineSystem({
  name: 'net-seats',
  phase: 'input',
  run(ctx) {
    const owned = (seat: number) => ctx.query(NetOwner).filter((entity) => entity.get(NetOwner).seat === seat)
    for (const { payload } of ctx.commands.of(SeatJoin)) {
      if (owned(payload.seat).length > 0) continue
      const sid = ctx.spawn([NetOwner, { seat: payload.seat }])
      ctx.emit(SeatJoined, { seat: payload.seat, sid })
    }
    for (const { payload } of ctx.commands.of(SeatLeave)) {
      const entities = owned(payload.seat)
      const seatEntity = entities[0]
      if (seatEntity === undefined) continue
      for (const entity of entities) ctx.despawn(entity.sid)
      ctx.emit(SeatLeft, { seat: payload.seat, sid: seatEntity.sid })
    }
  },
})
