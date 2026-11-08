import { content } from 'virtual:automata/content'
import { levelContentSchema, projectContentSchema } from '@automata/content/level-2d'
import { levelScene } from '@automata/framework'

// What the game shows of the level: core draws the tiles, auto tiles, objects and placed characters the editor made,
// from the same files the sim reads. Press Save in the editor and the game shows the change.

/** The pictures Add tiles put in `assets/`, by the path the editor knows them by (`assets/terrain.png`). */
const found: Record<string, string> = import.meta.glob('/assets/*.{png,webp,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
})
export const images: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(found).map(([path, url]) => [path.slice(1), url]),
)

/** The editor's project: the characters, tilesets and layers the levels are made from. */
export const project = projectContentSchema.parse(content.project)

const levels = Object.fromEntries(
  Object.entries(content.levels ?? {}).map(([id, level]) => [id, levelContentSchema.parse(level)]),
)

/**
 * The scene. The square is the player start, so the game draws it itself (`live`); an area is a zone, not a picture.
 */
export const LEVEL_SCENE = levelScene({
  project,
  levels,
  images,
  start: 'start',
  live: ['player-start', 'area'],
})
