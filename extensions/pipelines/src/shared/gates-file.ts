// `gates.json`, the file the review desk reads (`@automata/editor/gate-records`) and the pipelines write. The runner keeps
// a gate as `pending`, `approved` or `rejected`; the file says `open` for a gate nobody has decided.
import type { GateRecord as EditorGateRecord } from '@automata/editor/gate-records'
import { z } from 'zod'
import type { GateRecord } from './state.schema.ts'

/**
 * A gate as the file keeps it: the editor's keys (`@automata/editor/gate-records`, where a gate not yet decided is
 * `open`) and the keys the pipelines add beside them.
 */
export type GateFileRecord = EditorGateRecord & Omit<GateRecord, 'id' | 'decision' | 'decidedAt'>

const gateKeys = {
  id: z.string().min(1),
  stage: z.string(),
  files: z.array(z.string()),
  summary: z.string().optional(),
  note: z.string().optional(),
  requestedAt: z.string().optional(),
  decidedAt: z.string().optional(),
  by: z.literal('owner').optional(),
}

const fromFile = z
  .object({
    gates: z.array(
      z
        .object({
          ...gateKeys,
          decision: z.enum(['open', 'approved', 'rejected']),
          url: z.string().optional(),
        })
        .strict(),
    ),
  })
  .strict()
  .transform((file): Record<string, GateRecord> => {
    const gates: Record<string, GateRecord> = {}
    for (const { decision, url: _url, ...rest } of file.gates)
      gates[rest.id] = { ...rest, decision: decision === 'open' ? 'pending' : decision }
    return gates
  })

/** The first pipelines kept gates as an object keyed by gate id; one is read once and written the new way. */
const fromKeyedFile = z.record(
  z.string(),
  z.object({ ...gateKeys, decision: z.enum(['pending', 'approved', 'rejected']) }).strict(),
)

/** `gates.json` into gates by id, in either shape. */
export const gateFileSchema: z.ZodType<Record<string, GateRecord>> = z.union([fromFile, fromKeyedFile])

/** Gates as the file keeps them: `{ gates: [...] }` sorted by id, a gate not yet decided written as `open`. */
export const gateFileOf = (
  gates: Readonly<Record<string, GateRecord>>,
): { readonly gates: GateFileRecord[] } => ({
  gates: Object.values(gates)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((gate) => ({ ...gate, decision: gate.decision === 'pending' ? 'open' : gate.decision })),
})
