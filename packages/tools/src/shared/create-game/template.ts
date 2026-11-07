import { TEMPLATE_3D_FILES } from './template-3d.ts'
import { CI_FILES } from './template-ci.ts'
import { CONTENT_FILES } from './template-content.ts'
import type { TemplateFile, TemplateOptions } from './template-file.ts'
import { GAME_FILES } from './template-game.ts'
import { PROJECT_FILES } from './template-project.ts'

// The files of a new game: the project's (package, config, page), the game's (a square the player moves around a level,
// and its tests), its content (the level, which the 2D editor opens) and its release workflow. Each is a function of the options, so one list makes any game.

export type { TemplateFile, TemplateOptions } from './template-file.ts'

/** Every file of a new game, in the order they are written. */
export const TEMPLATE_FILES: readonly TemplateFile[] = [
  ...PROJECT_FILES,
  ...GAME_FILES,
  ...CONTENT_FILES,
  ...CI_FILES,
]

/** The files of the game `options.template` names: the 2D game unless it asks for `3d`. */
export const templateFilesOf = (options: TemplateOptions): readonly TemplateFile[] =>
  options.template === '3d' ? TEMPLATE_3D_FILES : TEMPLATE_FILES
