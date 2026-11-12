import { z } from 'zod'

// The client's half of the stale-build check: the facts a tab joins with, and the comparison with the server's.
// The server serves its facts on `GET /version`; the join check (`refuseStaleVersion`) stays the authority, so this only
// has to be right when it says "stale". What it cannot read is `unchecked`, which a caller lets through but never takes
// for a pass: a check that could not run (a browser refusing a cross-origin read looks exactly like an offline server)
// must not be mistaken for one that found the tab current.

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

/** What `checkServerVersion` found: the same build, a different one, or no answer it could read. */
export type VersionVerdict = 'current' | 'stale' | 'unchecked'

/**
 * Asks the server for its build facts (`fetchFacts` is the game's own fetch of `<server>/version`) and compares them
 * with `own`. `current` and `stale` only when the server answered readable facts. A throw, a rejection, a 503 or a
 * shape it does not know is `unchecked`: the join check refuses a stale client either way, so a caller goes on, and a
 * flaky probe never locks a player out, but it is told the check did not run.
 */
export async function checkServerVersion(
  fetchFacts: () => Promise<unknown>,
  own: BuildFacts,
): Promise<VersionVerdict> {
  let answer: unknown
  try {
    answer = await fetchFacts()
  } catch {
    return 'unchecked'
  }
  const parsed = buildFactsSchema.safeParse(answer)
  if (!parsed.success) return 'unchecked'
  const theirs = parsed.data
  return theirs.protocol === own.protocol &&
    theirs.schemaHash === own.schemaHash &&
    theirs.contentHash === own.contentHash
    ? 'current'
    : 'stale'
}
