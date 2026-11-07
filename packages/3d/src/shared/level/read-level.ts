// The one door a level file comes in by: `/2` as it is, `/1` migrated, anything else a problem. Nothing here
// throws on a file it cannot read; the problems say where and why, and the level is empty so a caller can go on.
import type { z } from 'zod'
import { afFormatVersion, afSectorSchema } from './af-sector.schema.ts'
import { migrateAfSector1 } from './af-sector-1-to-2.migration.ts'
import { AF_SECTOR_2_FORMAT, type AfSector2, afSector2Schema } from './af-sector-2.schema.ts'
import { type LevelProblem, pathText } from './problem.ts'

export interface LevelRead {
  readonly level: AfSector2
  /** The file was `/1`: saving it writes `/2`, which the editor says first. */
  readonly migrated: boolean
  readonly problems: LevelProblem[]
}

const EMPTY: AfSector2 = { format: AF_SECTOR_2_FORMAT, name: '', sectors: [] }

const problemsOf = (issues: readonly z.core.$ZodIssue[]): LevelProblem[] =>
  issues.map((issue) => {
    const path = issue.path.map((part) => (typeof part === 'symbol' ? String(part) : part))
    const where = pathText(path.slice(0, 2))
    return { path, code: 'invalid-level', message: issue.message, where }
  })

const unreadable = (problems: LevelProblem[]): LevelRead => ({ level: EMPTY, migrated: false, problems })

/** `json` (a parsed `af-sector` file of either format) as a `/2` level. */
export function readLevel(json: unknown): LevelRead {
  const format = (json as { format?: unknown } | null)?.format
  const version = typeof format === 'string' ? afFormatVersion(format) : undefined
  if (json === null || typeof json !== 'object' || (typeof format === 'string' && version === undefined))
    return unreadable(
      typeof format === 'string'
        ? [unknownFormat(format)]
        : [
            {
              path: [],
              code: 'invalid-level',
              message: 'a level is an object with a format and a name',
              where: '',
            },
          ],
    )
  if (version?.major === 1) {
    const parsed = afSectorSchema.safeParse(json)
    return parsed.success
      ? { level: migrateAfSector1(parsed.data), migrated: true, problems: [] }
      : unreadable(problemsOf(parsed.error.issues))
  }
  if (version?.major === 2) {
    const parsed = afSector2Schema.safeParse(json)
    return parsed.success
      ? { level: parsed.data, migrated: false, problems: [] }
      : unreadable(problemsOf(parsed.error.issues))
  }
  return unreadable([unknownFormat(typeof format === 'string' ? format : '')])
}

const unknownFormat = (format: string): LevelProblem => ({
  path: ['format'],
  code: 'unknown-format',
  message: `${format === '' ? 'this file' : format} is not a level format this reader opens (af-sector/1 or ${AF_SECTOR_2_FORMAT})`,
  where: 'format',
  name: format,
})
