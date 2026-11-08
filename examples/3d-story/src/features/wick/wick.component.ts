import { defineComponent } from '@automata/sim'

/**
 * Wick: where his feet are on the floor (metres, y up), the way he faces (radians, 0 toward +z and growing toward +x)
 * and whether he is walking. The screen reads these to place and pose his figure.
 */
export const Wick = defineComponent('wick', { x: 'f32', y: 'f32', z: 'f32', yaw: 'f32', walking: 'bool' })
