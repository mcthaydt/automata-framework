import { defineComponent } from '../../automata-framework/packages/sim/src/index'

/** The extra jump belongs to each player and travels with snapshots. */
export const AirJump = defineComponent('air-jump', { available: 'bool' }, { render: false })
