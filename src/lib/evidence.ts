import { z } from 'zod'

// The evidence file (framework DX spec §3.10, tooling/evidence): what one parity run on `main` proved. The site renders
// proof from it and never types a hash by hand. The framework also writes the file's JSON Schema; the site validates
// with that schema, not a copy of its own, and adds only the policy below (what counts as proof).

export const ENGINES = ['node', 'chromium', 'firefox', 'webkit'] as const
export type Engine = (typeof ENGINES)[number]

export interface EngineHash {
  engine: Engine
  version: string
  hash: string
}

export interface Golden {
  scenario: string
  seed: number
  ticks: number
  enginesAgree: boolean
  sources: string[]
  hashes: EngineHash[]
}

export interface Evidence {
  schemaVersion: 1
  generatedAt: string
  revision: { sha: string; dirty: boolean }
  run:
    | { kind: 'ci'; url: string; id: string; attempt: number; workflow: string; job: string; event: string; ref: string }
    | { kind: 'local' }
  playwright: string
  goldens: Golden[]
  packages: { name: string; version: string; released: boolean }[]
  automataCheck: { status: 'pending'; waitingOn: string[]; note: string }
}

export class EvidenceError extends Error {
  override readonly name = 'EvidenceError'
}

const fail = (message: string): never => {
  throw new EvidenceError(`Evidence file rejected: ${message}`)
}

/**
 * Validates `evidence` with the JSON Schema that came with it, then applies the site's policy:
 * - only a CI run on a clean checkout is proof, so a developer's local run cannot be published;
 * - `enginesAgree` is recomputed from the hashes, never believed;
 * - each golden names each engine exactly once.
 */
export function parseEvidence(evidence: unknown, schema: unknown): Evidence {
  const checked = z.fromJSONSchema(schema as Parameters<typeof z.fromJSONSchema>[0]).safeParse(evidence)
  if (!checked.success) {
    const problems = checked.error.issues.map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    return fail(`it does not fit its schema (${problems.slice(0, 5).join('; ')}${problems.length > 5 ? `; and ${problems.length - 5} more` : ''})`)
  }
  const doc = checked.data as Evidence
  if (doc.run.kind !== 'ci') fail('it is not from a CI run, and only a CI run on main is proof')
  if (doc.revision.dirty) fail('its revision had uncommitted changes')
  for (const golden of doc.goldens) {
    const engines = golden.hashes.map(entry => entry.engine)
    if (new Set(engines).size !== ENGINES.length) fail(`${golden.scenario} must list each engine once`)
    const agree = new Set(golden.hashes.map(entry => entry.hash)).size === 1
    if (golden.enginesAgree && !agree) fail(`${golden.scenario} says its engines agree, but the hashes differ`)
    if (!golden.enginesAgree && agree) fail(`${golden.scenario} says its engines differ, but the hashes agree`)
  }
  return doc
}

/** Whether the file proves cross-engine determinism: it has goldens and the engines agree on every one of them. */
export function allGoldensAgree(evidence: Evidence | undefined): boolean {
  return evidence !== undefined && evidence.goldens.length > 0 && evidence.goldens.every(golden => golden.enginesAgree)
}

export const ENGINE_NAMES: Record<Engine, string> = { node: 'Node', chromium: 'Chromium', firefox: 'Firefox', webkit: 'WebKit' }
