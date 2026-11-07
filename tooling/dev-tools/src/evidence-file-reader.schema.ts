import { z } from 'zod'

// A READER of core's evidence file (`evidence.json`, written by the framework's tooling/evidence; DX spec §3.10),
// not a definition of it: core's `EvidenceSchema` owns the format (one contract owner). Promotion needs three facts
// from it, so this reads only those and strips the rest. The contract test parses a file with core's schema first,
// so a change in core that this reader no longer accepts fails here.

/** What promotion reads from an evidence file. */
export interface EvidenceFileReading {
  readonly schemaVersion: 1
  readonly revision: { readonly sha: string; readonly dirty: boolean }
  readonly goldens: ReadonlyArray<{ readonly scenario: string; readonly enginesAgree: boolean }>
}

export const EvidenceFileReaderSchema: z.ZodType<EvidenceFileReading> = z.object({
  schemaVersion: z.literal(1),
  revision: z.object({ sha: z.string().regex(/^[0-9a-f]{40}$/), dirty: z.boolean() }),
  goldens: z.array(z.object({ scenario: z.string().min(1), enginesAgree: z.boolean() })).min(1),
})

/**
 * Why an evidence file may not be promoted, or null when it may: it must parse, come from a clean tree, and every
 * golden's engines must agree, so a committed file never claims what its run did not prove (plan DT-D6).
 */
export function evidenceFileRefusal(text: string): string | null {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (error) {
    return `not JSON: ${(error as Error).message}`
  }
  const parsed = EvidenceFileReaderSchema.safeParse(json)
  if (!parsed.success) return `not an evidence file: ${z.prettifyError(parsed.error).replace(/\n/g, '; ')}`
  const { revision, goldens } = parsed.data
  if (revision.dirty) return `made from a dirty tree at ${revision.sha.slice(0, 7)}`
  const disagreeing = goldens.filter((golden) => !golden.enginesAgree).map((golden) => golden.scenario)
  if (disagreeing.length > 0) return `the engines disagree on ${disagreeing.join(', ')}`
  return null
}
