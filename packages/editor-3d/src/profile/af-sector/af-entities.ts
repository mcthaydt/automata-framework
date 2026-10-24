// The entities of an `af-sector/1` level (ED3D spec §4.7): the file's own `entityDefs` read as typed definitions and its
// `entities` as the things that stand in the level. Nothing is fixed here: what a thing is, the author says.
import { type EntityKit, readEntityKit } from '../../entities/things'
import type { AfSector } from '../../format/af-sector.schema'

export function afEntityKit(level: AfSector): EntityKit {
  return readEntityKit({
    definitions: (level.entityDefs ?? []).map((value, index) => ({ path: ['entityDefs', index], value })),
    instances: (level.entities ?? []).map((value, index) => ({ path: ['entities', index], value })),
  })
}
