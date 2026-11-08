import { levelScene } from '@automata/framework'
import { levels, project, START_LEVEL } from './level-content.ts'

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

/**
 * The scene. The square is the player start and the guard walks, so the game draws them itself (`live`); an area is a
 * zone, not a picture. The keeper stands still, so core draws him where the editor placed him.
 */
export const LEVEL_SCENE = levelScene({
  project,
  levels,
  images,
  start: START_LEVEL,
  live: ['player-start', 'guard', 'area'],
})
