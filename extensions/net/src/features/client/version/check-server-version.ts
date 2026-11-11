import { z } from 'zod'

// The client's half of the stale-build check: the facts a tab joins with, and the comparison with the server's.
// The server serves its facts on `GET /version`; the join check (`refuseStaleVersion`) stays the authority, so this only
// has to be right when it says "stale" and may pass anything it cannot read.

/** What identifies a build: the wire protocol, the sim's schema and the content, as a join sends them. */
export interface BuildFacts {
  readonly protocol: number
  readonly schemaHash: string
  readonly contentHash: string
}

/** The shape of a build's facts, as `GET /version` answers them. Strict, so a shape it does not know is unreadable. */
export const buildFactsSchema: z.ZodType<BuildFacts> = z.strictObject({
  protocol: z.number(),
  schemaHash: z.string(),
  contentHash: z.string(),
})

/**
 * Asks the server for its build facts (`fetchFacts` is the game's own fetch of `<server>/version`) and compares them
 * with `own`. `stale` only when the server answered readable facts that differ. A throw, a rejection, a 503 or a shape
 * it does not know is `current`: the join check refuses a stale client either way, and a flaky probe must never lock a
 * player out.
 */
export async function checkServerVersion(
  fetchFacts: () => Promise<unknown>,
  own: BuildFacts,
): Promise<'current' | 'stale'> {
  let answer: unknown
  try {
    answer = await fetchFacts()
  } catch {
    return 'current'
  }
  const parsed = buildFactsSchema.safeParse(answer)
  if (!parsed.success) return 'current'
  const theirs = parsed.data
  return theirs.protocol === own.protocol &&
    theirs.schemaHash === own.schemaHash &&
    theirs.contentHash === own.contentHash
    ? 'current'
    : 'stale'
}
