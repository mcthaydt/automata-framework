// A gate records file as the gates reader reads it (EDS.1d-a plan, decision 3): `{ "gates": [{ id, decision,
// decidedAt?, url? }] }`, other keys ignored. The pipelines platform owns the real shape (automata-plus, M3.8a) and
// replaces this when it lands. A decision outside the three is an unreadable record, never a guess.
import { z } from 'zod'

export interface GateRecord {
  readonly id: string
  readonly decision: 'approved' | 'rejected' | 'open'
  readonly decidedAt?: string | undefined
  readonly url?: string | undefined
}

export const gateRecordsSchema: z.ZodType<{ readonly gates: readonly GateRecord[] }> = z.object({
  gates: z.array(
    z.object({
      id: z.string().min(1),
      decision: z.enum(['approved', 'rejected', 'open']),
      decidedAt: z.string().optional(),
      url: z.string().optional(),
    }),
  ),
})
