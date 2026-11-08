import { TEMPLATE_3D_FILES } from './template-3d.ts'
import { AGENT_FILES_2D } from './template-agent.ts'
import { CI_FILES } from './template-ci.ts'
import { CONTENT_FILES } from './template-content.ts'
import type { TemplateFile, TemplateOptions } from './template-file.ts'
import { GAME_FILES } from './template-game.ts'
import { PROJECT_FILES } from './template-project.ts'
import { STORY_FILES } from './template-story.ts'
import { STORY_CONTENT_FILES } from './template-story-content.ts'
import { STORY_GAME_FILES } from './template-story-game.ts'

// The files of a new game: the project's (package, config, page), the game's (a square the player moves around a level,
// and its tests), its content (the level, which the 2D editor opens) and its release workflow. Each is a function of the options, so one list makes any game.

export type { TemplateFile, TemplateOptions } from './template-file.ts'

/** Every file of a new game, in the order they are written. */
export const TEMPLATE_FILES: readonly TemplateFile[] = [
  ...PROJECT_FILES,
  ...AGENT_FILES_2D,
  ...GAME_FILES,
  ...CONTENT_FILES,
  ...CI_FILES,
]

/** `base` with each file the story has at the same path replaced, and the rest of the story's added. */
function withStory(base: readonly TemplateFile[], story: readonly TemplateFile[]): readonly TemplateFile[] {
  const paths = new Set(base.map((file) => file.path))
  const replaced = new Map(story.filter((file) => paths.has(file.path)).map((file) => [file.path, file]))
  return [
    ...base.map((file) => replaced.get(file.path) ?? file),
    ...story.filter((file) => !paths.has(file.path)),
  ]
}

/** The 2D game with the story: a keeper, a cutscene and a guard, and the editors that change them. */
export const STORY_TEMPLATE_FILES: readonly TemplateFile[] = withStory(TEMPLATE_FILES, [
  ...STORY_GAME_FILES,
  ...STORY_FILES,
  ...STORY_CONTENT_FILES,
])

/** The files of the game `options` ask for: `3d`, the 2D game with the story when `options.story`, or the plain 2D game. */
export const templateFilesOf = (options: TemplateOptions): readonly TemplateFile[] =>
  options.template === '3d'
    ? TEMPLATE_3D_FILES
    : options.story === true
      ? STORY_TEMPLATE_FILES
      : TEMPLATE_FILES
