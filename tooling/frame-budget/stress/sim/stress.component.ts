import { type ComponentDef, defineComponent } from '@mcthaydt/automata-sim'

/** The stress world, in pixels; positions are in subpixels (`sub` per pixel), as Emberwick's are. */
export const WORLD = { width: 320, height: 192, sub: 256 } as const

const bodyFields = { x: 'i32', y: 'i32', vx: 'i32', vy: 'i32' } as const

/** Where an entity is and how fast it moves, in subpixels. Rendered: its view follows it. */
export const Body: ComponentDef<typeof bodyFields> = defineComponent('stress-body', bodyFields)

const pulseFields = { phase: 'i32' } as const

/** A value every worker system churns each tick; rendered as the view's tint. */
export const Pulse: ComponentDef<typeof pulseFields> = defineComponent('stress-pulse', pulseFields)
