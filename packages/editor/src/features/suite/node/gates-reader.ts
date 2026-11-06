// The recorded gate decisions, read from the files each `[[gate]]` row's `records` glob names. Read only: an editor shows a gate's state and never records one. A gate with no record is `unknown`; a
// records file that cannot be read rejects the whole call, so the pill says "Gates not readable" rather than guess.
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { GateState, Gates } from '../../../shared/kit/ports/suite-ports.ts'
import { type GateRow, globMatch } from '../core'
import { type GateRecord, gateRecordsSchema } from './gate-records.schema'

export interface GatesReaderOptions {
  /** The game's checkout. */
  readonly root: string
  /** The editor list's `[[gate]]` rows. */
  readonly gates: readonly GateRow[]
}

/** The folder a glob's files are all under: its segments before the first with a wildcard or `{scene}`. */
function fixedPrefix(glob: string): string {
  const segments = glob.split('/')
  const fixed: string[] = []
  for (const segment of segments.slice(0, -1)) {
    if (/[*?{]/.test(segment)) break
    fixed.push(segment)
  }
  return fixed.join('/')
}

/** The files under `dir` (relative to `root`) that `glob` matches; none when the folder does not exist yet. */
async function matching(root: string, glob: string): Promise<string[]> {
  const prefix = fixedPrefix(glob)
  let names: string[]
  try {
    names = await readdir(join(root, prefix), { recursive: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  return names
    .map((name) => (prefix === '' ? name : `${prefix}/${name}`).split('\\').join('/'))
    .filter((path) => globMatch(glob, path) !== undefined)
    .sort()
}

async function readRecords(root: string, path: string): Promise<readonly GateRecord[]> {
  const text = await readFile(join(root, path), 'utf8')
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (error) {
    throw new Error(`${path} is not JSON: ${(error as Error).message}`)
  }
  const parsed = gateRecordsSchema.safeParse(json)
  if (!parsed.success) throw new Error(`${path} is not a gate records file: ${parsed.error.message}`)
  return parsed.data.gates
}

/** The later of two records; one with a date wins over one without. */
const later = (a: GateRecord | undefined, b: GateRecord): GateRecord =>
  a === undefined || (b.decidedAt ?? '') > (a.decidedAt ?? '') ? b : a

export function createGatesReader(options: GatesReaderOptions): Gates {
  return {
    async states(ids) {
      const states: GateState[] = []
      for (const id of ids) {
        const row = options.gates.find((gate) => gate.id === id)
        if (row === undefined) {
          states.push({ id, name: id, decision: 'unknown' })
          continue
        }
        let latest: GateRecord | undefined
        for (const path of await matching(options.root, row.records))
          for (const record of await readRecords(options.root, path))
            if (record.id === id) latest = later(latest, record)
        states.push(
          latest === undefined
            ? { id, name: row.name, decision: 'unknown' }
            : {
                id,
                name: row.name,
                decision: latest.decision,
                ...(latest.decidedAt === undefined ? {} : { decidedAt: latest.decidedAt }),
                ...(latest.url === undefined ? {} : { url: latest.url }),
              },
        )
      }
      return states
    },
  }
}
