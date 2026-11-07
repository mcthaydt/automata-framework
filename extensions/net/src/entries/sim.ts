// `@automata/net/sim`: the sim entry a game's sim may import (`automata.simEntries`). Checked by the
// framework's sim boundaries: no I/O, no clock, no Effect.

export { netPlugin } from '../shared/sim/net.plugin'
export { NetOwner } from '../shared/sim/net-owner.component'
export { SeatJoin, SeatLeave, type SeatPayload } from '../shared/sim/seat.command'
export { type SeatEntity, SeatJoined, SeatLeft } from '../shared/sim/seat.event'
export { ROOM_SOURCE } from '../shared/sim/seat.schema'
