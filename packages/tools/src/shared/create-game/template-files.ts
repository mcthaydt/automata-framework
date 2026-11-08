import { CONTENT_FILES } from './template-content.ts'
import type { TemplateFile, TemplateOptions } from './template-file.ts'
import { GAME_FILES } from './template-game.ts'
import { PROJECT_FILES } from './template-project.ts'

// The files of a new game: the project's (package, config, page), the game's (a square the player moves around a level,
// and its tests) and its content (the level, which the 2D editor opens). Each is a function of the options, so one list makes any game.

const TEMPLATE_FILES: readonly TemplateFile[] = [...PROJECT_FILES, ...GAME_FILES, ...CONTENT_FILES]

/** A file of a new game: its path below the game's folder, and its text. */
export interface GameFile {
  readonly path: string
  readonly text: string
}

/**
 * Every file of a new game, in the order they are written, as text in memory. It reads no disk and imports neither
 * Node nor Effect, so a phone makes a game with it; `create-game` writes the same files to a folder.
 */
export function templateFiles(options: TemplateOptions): readonly GameFile[] {
  return TEMPLATE_FILES.map((file) => ({ path: file.path, text: file.content(options) }))
}
