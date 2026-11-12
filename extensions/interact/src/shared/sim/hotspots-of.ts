// A level's hotspots: its entities of one definition, read with the hotspot schema. An entity that is not a usable
// hotspot is a problem in words naming it, and is left out, so a bad edit is caught by the check that reads the level
// and not found by a player standing at nothing.
import type { AfSector2 } from '@automataframework/3d/level'
import { type Hotspot, hotspotSchema } from './hotspot.schema'

export interface HotspotsRead {
  readonly hotspots: readonly Hotspot[]
  readonly problems: readonly string[]
}

const FIELDS = ['id', 'x', 'z', 'reach', 'name', 'hide', 'when'] as const

/** The level's entities of definition `def` as hotspots; a problem for each one that is not a valid hotspot. */
export function hotspotsOf(level: AfSector2, def = 'hotspot'): HotspotsRead {
  const hotspots: Hotspot[] = []
  const problems: string[] = []
  const seen = new Set<string>()
  for (const entity of level.entities ?? []) {
    if (entity.def !== def) continue
    // A level entity carries its definition and height as well; a hotspot is only these fields.
    const fields = Object.fromEntries(
      FIELDS.filter((f) => entity[f] !== undefined).map((f) => [f, entity[f]]),
    )
    const read = hotspotSchema.safeParse(fields)
    if (!read.success) {
      const issue = read.error.issues[0]
      problems.push(
        `hotspot "${entity.id}": ${issue?.path.join('.') ?? ''}: ${issue?.message ?? 'not a hotspot'}`,
      )
    } else if (seen.has(read.data.id)) problems.push(`hotspot "${read.data.id}" is declared twice`)
    else {
      seen.add(read.data.id)
      hotspots.push(read.data)
    }
  }
  return { hotspots, problems }
}
