import { z } from 'zod'
import { ITEM_ID } from '../../model/ids'

// Auto-tile rule shapes (2D editor spec §5.6). The engine that evaluates them is ED2D.2; the shapes live here because
// a layer definition carries its rule groups and the project schema has to validate them.

/** One cell of a rule's pattern, read against the source IntGrid layer. */
export type PatternCell = 'any' | 'empty' | 'filled' | { readonly is: number } | { readonly not: number }

export interface Rule {
  readonly id: string
  readonly active: boolean
  /** The pattern is size × size, row-major; the centre is the cell being decided. */
  readonly size: 1 | 3 | 5
  readonly pattern: readonly PatternCell[]
  /** Candidate output tiles; more than one picks a variant by hash. Empty while a rule is still being drawn. */
  readonly tiles: readonly number[]
  /** 0 to 1: how often a match applies. */
  readonly chance: number
  /** Also try the mirrored pattern, and draw the tile mirrored. */
  readonly flipX: boolean
  readonly flipY: boolean
  /** Stop the remaining rules for this cell once this one matches. */
  readonly breakOnMatch: boolean
  /** The value read beyond the level edge (0 is empty); `'same'` repeats the centre cell. */
  readonly outside: number | 'same'
}

export interface RuleGroup {
  readonly id: string
  readonly label: string
  readonly active: boolean
  readonly rules: readonly Rule[]
}

const intValue = z.number().int().min(1).max(255)

export const patternCellSchema: z.ZodType<PatternCell> = z.union([
  z.enum(['any', 'empty', 'filled']),
  z.strictObject({ is: intValue }),
  z.strictObject({ not: intValue }),
])

export const ruleSchema: z.ZodType<Rule> = z
  .strictObject({
    id: z.string().regex(ITEM_ID),
    active: z.boolean(),
    size: z.union([z.literal(1), z.literal(3), z.literal(5)]),
    pattern: z.array(patternCellSchema),
    tiles: z.array(z.number().int().min(0)),
    chance: z.number().min(0).max(1),
    flipX: z.boolean(),
    flipY: z.boolean(),
    breakOnMatch: z.boolean(),
    outside: z.union([z.number().int().min(0).max(255), z.literal('same')]),
  })
  .superRefine((rule, ctx) => {
    if (rule.pattern.length !== rule.size * rule.size) {
      ctx.addIssue({
        code: 'custom',
        message: `a ${rule.size}×${rule.size} pattern has ${rule.size * rule.size} cells, not ${rule.pattern.length}`,
        path: ['pattern'],
      })
    }
  })

export const ruleGroupSchema: z.ZodType<RuleGroup> = z.strictObject({
  id: z.string().regex(ITEM_ID),
  label: z.string(),
  active: z.boolean(),
  rules: z.array(ruleSchema),
})
