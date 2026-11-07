import { definePlugin, type PluginDef } from '@automata/sim'
import { NetOwner } from './net-owner.component'
import { SeatJoin, SeatLeave } from './seat.command'
import { SeatJoined, SeatLeft } from './seat.event'
import { seats } from './seats.system'

/** `net`'s sim side (M7 spec §4.2): the same plugin runs in the room and in every client. */
export const netPlugin: PluginDef = definePlugin({
  name: 'net',
  components: [NetOwner],
  commands: [SeatJoin, SeatLeave],
  events: [SeatJoined, SeatLeft],
  systems: [seats],
})
