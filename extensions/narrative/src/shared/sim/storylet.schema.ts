// Storylets: lines outside dialogue, picked by salience from what the player does, where she
// is and what she knows. Triggers: `inspect:<hotspot>`, `enter:<room>`, `dwell:<room>:<seconds>`, `system:<event>`.
// A room is a sector id or a zone. `phase` is a label the game may keep; the sim ignores it.
import { type Cond, condSchema } from '@automata/puzzle/sim'
import { z } from 'zod'

export interface Storylet {
  readonly id: string
  readonly trigger: string
  readonly phase?: string | undefined
  readonly when?: readonly Cond[] | undefined
  /** Line ids; each play says the next. */
  readonly lines: readonly string[]
  /** A milestone: it plays once. */
  readonly once?: boolean | undefined
  /** At most this many plays. */
  readonly max?: number | undefined
  /** Breaks a tie on the number of conditions; higher wins. */
  readonly priority?: number | undefined
  readonly hints?: readonly string[] | undefined
}
export type Trigger =
  | { readonly kind: 'inspect' | 'enter' | 'system'; readonly target: string }
  | { readonly kind: 'dwell'; readonly target: string; readonly seconds: number }

/** A trigger's parts, or null when it is not one of the four kinds. */
export function parseTrigger(t: string): Trigger | null {
  const [kind, target, seconds] = t.split(':')
  if (target === undefined || target === '') return null
  if (kind === 'inspect' || kind === 'enter' || kind === 'system')
    return seconds === undefined ? { kind, target } : null
  if (kind === 'dwell') {
    const s = Number(seconds)
    return Number.isFinite(s) && s > 0 ? { kind, target, seconds: s } : null
  }
  return null
}

export const storyletSchema: z.ZodType<Storylet> = z.strictObject({
  id: z.string().min(1),
  trigger: z.string().refine((t) => parseTrigger(t) !== null, {
    message: 'not inspect:, enter:, dwell:<room>:<s> or system:',
  }),
  phase: z.string().optional(),
  when: z.array(condSchema).optional(),
  lines: z.array(z.string()).min(1),
  once: z.boolean().optional(),
  max: z.number().int().min(1).optional(),
  priority: z.number().optional(),
  hints: z.array(z.string()).optional(),
})
export interface StoryletsFile {
  readonly storylets: readonly Storylet[]
}
export const storyletsFileSchema: z.ZodType<StoryletsFile> = z.strictObject({
  storylets: z.array(storyletSchema),
})
