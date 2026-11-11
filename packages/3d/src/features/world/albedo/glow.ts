// What a glowing swatch (a bulb, a neon, a lit window) needs of its library entry: its ladder, and whether the room behind
// it is shown (`interior`). A prop's glowing parts dim with the prop's own lamps.
import type { LadderSwatch } from './ladder.ts'

export interface GlowSwatch extends LadderSwatch {
  /** A lit window: the glass shows a room behind it. */
  readonly interior?: boolean | undefined
}

/** The id of a prop's n-th lamp: the builder names it so, and a glow finds its lamps by it. */
export const propLampId = (prop: string, n: number): string => `${prop}.light${n}`

/** The ids among `lamps` that are lamps of `prop`. */
export const lampsOfProp = (lamps: readonly { readonly id: string }[], prop: string): string[] =>
  lamps
    .filter((lamp) => lamp.id.startsWith(`${prop}.light`) && /^\d+$/.test(lamp.id.slice(prop.length + 6)))
    .map((lamp) => lamp.id)
