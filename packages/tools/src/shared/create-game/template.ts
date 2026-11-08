import { CONTENT_FILES } from './template-content.ts'
import type { TemplateFile } from './template-file.ts'
import { GAME_FILES } from './template-game.ts'
import { PROJECT_FILES } from './template-project.ts'

// The files of a new game: the project's (package, config, page), the game's (a square the player moves around a level,
// and its tests) and its content (the level, which the 2D editor opens). Each is a function of the options, so one list makes any game.

export type { TemplateFile, TemplateOptions } from './template-file.ts'

/** Every file of a new game, in the order they are written. */
export const TEMPLATE_FILES: readonly TemplateFile[] = [...PROJECT_FILES, ...GAME_FILES, ...CONTENT_FILES]
