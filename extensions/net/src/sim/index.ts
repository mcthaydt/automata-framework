// `@automata/net/sim`: the sim entry a game's sim may import (`automata.simEntries`). Checked by the
// framework's sim boundaries: no I/O, no clock, no Effect.

export { netPlugin } from './net.plugin'
export { NetOwner } from './net-owner.component'
export { SeatJoin, SeatLeave, type SeatPayload } from './seat.command'
export { type SeatEntity, SeatJoined, SeatLeft } from './seat.event'
export { ROOM_SOURCE } from './seat.schema'
