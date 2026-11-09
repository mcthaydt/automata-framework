import { defineComponent } from '@automata/sim'

/**
 * Marks the square the player moves (the guard has a body too, and the player's moves must not carry him along).
 * `frozen` is set while the player cannot walk: in a conversation, or in a cutscene.
 */
export const Hero = defineComponent('hero', { frozen: 'bool' })
