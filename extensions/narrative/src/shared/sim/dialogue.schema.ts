// Dialogue graphs: a conversation's nodes say line records in order, then offer the player's choices or
// go on to `next`. A node whose `when` fails is passed over. Conditions are puzzle's `Cond`.

import { type Cond, condSchema, type Value, valueSchema } from '@automata/puzzle/sim'
import { sortedKeys } from '@automata/sim'
import { z } from 'zod'

export interface Choice {
  readonly line: string
  readonly stance?: number | undefined
  readonly set?: Readonly<Record<string, Value>> | undefined
  readonly next: string
}
export interface DialogueNode {
  /** Line ids, said in order. */
  readonly say: readonly string[]
  readonly choices?: readonly Choice[] | undefined
  readonly next?: string | undefined
  readonly when?: readonly Cond[] | undefined
}
export interface DialogueGraph {
  readonly id: string
  readonly speaker: string
  readonly start: string
  readonly nodes: Readonly<Record<string, DialogueNode>>
}
const nodeSchema: z.ZodType<DialogueNode> = z.strictObject({
  say: z.array(z.string()),
  choices: z
    .array(
      z.strictObject({
        line: z.string(),
        stance: z.number().optional(),
        set: z.record(z.string(), valueSchema).optional(),
        next: z.string(),
      }),
    )
    .optional(),
  next: z.string().optional(),
  when: z.array(condSchema).optional(),
})
export const dialogueGraphSchema: z.ZodType<DialogueGraph> = z.strictObject({
  id: z.string().min(1),
  speaker: z.string(),
  start: z.string(),
  nodes: z.record(z.string(), nodeSchema),
})
export interface DialogueFile {
  readonly graphs: readonly DialogueGraph[]
}
export const dialogueFileSchema: z.ZodType<DialogueFile> = z
  .strictObject({ graphs: z.array(dialogueGraphSchema) })
  .superRefine((file, ctx) => {
    file.graphs.forEach((g, i) => {
      const has = (id: string) => Object.hasOwn(g.nodes, id)
      if (!has(g.start))
        ctx.addIssue({
          code: 'custom',
          path: ['graphs', i, 'start'],
          message: `no node ${g.start} in graph ${g.id}`,
        })
      for (const id of sortedKeys(g.nodes)) {
        const node = g.nodes[id] as DialogueNode
        if (node.next !== undefined && !has(node.next))
          ctx.addIssue({
            code: 'custom',
            path: ['graphs', i, 'nodes', id, 'next'],
            message: `no node ${node.next} in graph ${g.id}`,
          })
        ;(node.choices ?? []).forEach((c, j) => {
          if (!has(c.next))
            ctx.addIssue({
              code: 'custom',
              path: ['graphs', i, 'nodes', id, 'choices', j, 'next'],
              message: `no node ${c.next} in graph ${g.id}`,
            })
        })
      }
    })
  })
