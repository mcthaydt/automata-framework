import { parseEvidence, type Evidence } from '$lib/evidence'

// The evidence file and its schema, copied here by `pnpm sync:evidence` (scripts/sync-evidence.ts). They are validated
// when this module loads, so a file that does not fit its schema, or is not from a CI run, stops the build instead of
// being rendered. Before the first sync there is no file: EVIDENCE is undefined, /proof says so, and
// tests/evidence.test.ts is red until the sync has run.
const files = import.meta.glob<unknown>(['./evidence.json', './evidence.schema.json'], { eager: true, import: 'default' })
const evidence = files['./evidence.json']
const schema = files['./evidence.schema.json']

if ((evidence === undefined) !== (schema === undefined)) {
  throw new Error('src/data needs evidence.json and evidence.schema.json together; run `pnpm sync:evidence`')
}

export const EVIDENCE: Evidence | undefined = evidence === undefined ? undefined : parseEvidence(evidence, schema)
