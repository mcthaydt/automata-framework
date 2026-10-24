import type { Project } from '../../model/project-types'
import type { ProfileSummary } from '../profile'

// What Home shows about a project (2D editor spec §8): its name and four counts, worded for a person.

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`

/** "None" for no tilesets; "placeholder" for a set that has no image yet (art replaces it without moving a tile index). */
function tilesetsFact(tilesets: Project['defs']['tilesets']): string {
  if (tilesets.length === 0) return 'None'
  const placeholders = tilesets.filter((tileset) => tileset.image === undefined).length
  if (placeholders === 0) return `${tilesets.length}`
  const word = plural(placeholders, 'placeholder', 'placeholders')
  return placeholders === tilesets.length ? word : `${tilesets.length} (${word})`
}

export function summarizeProject(project: Project): ProfileSummary {
  const { entities, layers, tilesets } = project.defs
  return {
    title: project.name,
    facts: [
      { label: 'Levels', value: `${project.levels.length}` },
      { label: 'Layers', value: `${layers.length}` },
      {
        label: 'Entities',
        value: entities.length === 0 ? 'None' : plural(entities.length, 'definition', 'definitions'),
      },
      { label: 'Tilesets', value: tilesetsFact(tilesets) },
    ],
  }
}
