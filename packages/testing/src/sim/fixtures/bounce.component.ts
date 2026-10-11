import { type ComponentDef, defineComponent } from '@mcthaydt/automata-sim'

const ballFields = { x: 'i32', y: 'i32', vx: 'i32', vy: 'i32' } as const
/** A ball in the bounce fixture's box: position and velocity in whole units, so every engine agrees trivially. */
export const Ball: ComponentDef<typeof ballFields> = defineComponent('bounce.ball', ballFields)
