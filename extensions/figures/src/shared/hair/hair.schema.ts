import { z } from 'zod'
import { asWritten } from '../math/as-written'
import type { HairStyle } from './hair-types'

const n = z.number()
const v3 = z.tuple([n, n, n])
/** A line along the head: [u, v] knots. */
const line = z.array(z.tuple([n, n]))
const tone = z.string()
const tie = z.union([z.boolean(), z.string()])

/** One strand of a rope of hair (hair-types.ts Rope). */
const rope = z.strictObject({
  r: n,
  flat: n.optional(),
  e: n.optional(),
  beads: n.optional(),
  pitch: n.optional(),
  depth: n.optional(),
  ridges: z.tuple([n, n]).optional(),
  plait: z.union([n, z.literal(false)]).optional(),
  phase: n.optional(),
  slant: n.optional(),
  streaks: z.tuple([n, n, n, n.optional()]).optional(),
  tip: z.enum(['point', 'round', 'blunt']).optional(),
  root: n.optional(),
  taper: n.optional(),
  seg: n.optional(),
})
const scalp = z.strictObject({
  from: line,
  to: line.optional(),
  lift: n,
  crown: n.optional(),
  edge: n.optional(),
  ridges: z.tuple([n, n]).optional(),
  comb: z.union([v3, z.literal('back')]).optional(),
  tone: tone.optional(),
  sheen: z
    .strictObject({
      count: n,
      from: n,
      to: n,
      width: n.optional(),
      ragged: n.optional(),
      at: n.optional(),
    })
    .optional(),
  grade: z.array(z.tuple([n, tone])).optional(),
  span: n.optional(),
  foot: line.optional(),
  reach: n.optional(),
  under: n.optional(),
  parting: n.optional(),
})
const rows = z.strictObject({
  count: n,
  at: n.optional(),
  span: n,
  from: line,
  to: z.union([v3, z.literal('nape')]),
  nape: line.optional(),
  lift: n,
  rope,
  apart: z.boolean().optional(),
  matte: z.boolean().optional(),
  tone: tone.optional(),
})
const tail = z.strictObject({
  at: v3,
  count: n,
  rope,
  rise: n,
  length: n,
  spread: z.tuple([n, n]),
  tie: tie.optional(),
  cuffs: z.string().optional(),
  matte: z.boolean().optional(),
  hang: z.literal('down').optional(),
})
const bun = z.strictObject({
  at: v3,
  r: n,
  flat: n.optional(),
  turns: n.optional(),
  rope,
  tie: tie.optional(),
})
const fall = z.strictObject({
  from: line,
  part: n.optional(),
  count: n,
  length: n,
  curl: n.optional(),
  volume: n.optional(),
  rope,
  front: n.optional(),
  turn: n.optional(),
  rest: z.enum(['head', 'trunk']).optional(),
})
const fringe = z.strictObject({
  from: line,
  width: n,
  length: n,
  count: n,
  rope,
  sweep: n.optional(),
})

/** The kinds of piece the painter draws itself, each with its own strict shape. */
const OWN = { scalp, rows, tail, bun, fall, fringe } as const

/**
 * A piece: an object with the kind it is for its key. The kinds the painter draws (`OWN`) are checked key by key; a kind a
 * fork registers (`registerHairPiece`) is the fork's to check, so its value passes as it is. A misspelt key inside a known
 * kind is refused, naming the key.
 */
const piece = z.record(z.string(), z.unknown()).superRefine((p, ctx) => {
  for (const [kind, value] of Object.entries(p)) {
    const own = (OWN as Record<string, z.ZodType>)[kind]
    if (!own) continue
    const checked = own.safeParse(value)
    if (!checked.success) ctx.addIssue({ code: 'custom', path: [kind], message: checked.error.message })
  }
})

/** A hair style (library/hair.json): its pieces fitted to the head, and the finish they are painted with. */
export const hairStyleSchema = z.strictObject({
  about: z.string(),
  pieces: z.array(piece),
  finish: z.string(),
}) satisfies z.ZodType<HairStyle>

/** The whole file: styles by name. */
export const hairSchema = asWritten(z.record(z.string(), hairStyleSchema))
