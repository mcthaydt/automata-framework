import { defineComponent } from '@automata/sim'

/**
 * Ada's facing and whether she is walking, and where she stood last tick (so a step can be told from standing still).
 * Where she is lives in `InSector`, which the sectors' places read: one owner for her position. The screen reads her
 * place from there and her pose from here.
 */
export const Ada = defineComponent('ada', { yaw: 'f32', walking: 'bool', lastX: 'f64', lastZ: 'f64' })
