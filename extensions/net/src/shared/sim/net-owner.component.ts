import { type ComponentDef, defineComponent } from '@automata/sim'

/**
 * The seat an entity belongs to (M7 spec §4.2). `netPlugin` gives each joined seat one entity with it; a game tags
 * its own entities (a player's character) with the same seat, and `seat.leave` despawns them together.
 */
export const NetOwner: ComponentDef<{ seat: 'u32' }> = defineComponent('net-owner', { seat: 'u32' })
