import { definePlugin } from '../../automata-framework/packages/sim/src/index'
import { AirJump } from './air-jump.component'
import { doubleJump } from './double-jump.system'

export const doubleJumpPlugin = definePlugin({
  name: 'double-jump',
  dependsOn: ['base-2d'],
  components: [AirJump],
  systems: [doubleJump],
})
