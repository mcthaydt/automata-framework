import { content } from 'virtual:automata/content'
import { type ContentLevel, levelContentSchema, projectContentSchema } from '@automata/content/level-2d'

// The editor's files as data, with no drawing in them: the characters, tilesets and layers (project.toml) and every level.
// The screen draws them (level-scene.ts) and the story reads where things are placed (features/story).

/** The editor's project: the characters, tilesets and layers the levels are made from. */
export const project = projectContentSchema.parse(content.project)

/** Every level, by id. */
export const levels: Readonly<Record<string, ContentLevel>> = Object.fromEntries(
  Object.entries(content.levels ?? {}).map(([id, level]) => [id, levelContentSchema.parse(level)]),
)

/** The level the game starts in and plays. */
export const START_LEVEL = 'start'
export const startLevel: ContentLevel = (() => {
  const level = levels[START_LEVEL]
  if (level === undefined)
    throw new Error(`There is no level "${START_LEVEL}". Open the level in the editor and press Save.`)
  return level
})()
