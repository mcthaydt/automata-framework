import { readFileSync } from 'node:fs'
import { readTemplateContent } from './template-content.ts'
import type { TemplateFile } from './template-file.ts'

// What a new 2D game with the story starts with: the level the story is set in, the keeper's words and conversation, the
// cutscene, and the guard with the places he walks. Real files in `template-story-content/`, written into the game's
// `content/` over the plain game's level, so each can be opened in the editor that reads it. They are copies of
// `examples/2d-story/content/` (a test keeps them equal). From source the folder is next to this file; in the published
// build `tsdown.config.ts` copies it to `dist/template-story-content/`, so one relative URL finds it in both.

/** The files under `template-story-content/` that are the story's own, as written into the game's `content/`. */
export const TEMPLATE_STORY_CONTENT_PATHS: readonly string[] = [
  'cutscenes/gate.toml',
  'dialogue/keeper.toml',
  'levels/start.af2d.json',
  'levels/start.toml',
  'lines/keeper.toml',
  'nav/guard.toml',
  'project.toml',
  'systems/guard.toml',
  'words/en.json',
  'world.toml',
]

const FOLDER = new URL('./template-story-content/', import.meta.url)

/** One file of `template-story-content/`, by its path there. */
export const readStoryContent = (path: string): string => readFileSync(new URL(path, FOLDER), 'utf8')

/**
 * The story's `content/` files. The level and its project replace the plain game's; the editor list is the plain game's,
 * then the rows Writer and Sequence need (`editors-story.toml`).
 */
export const STORY_CONTENT_FILES: readonly TemplateFile[] = [
  ...TEMPLATE_STORY_CONTENT_PATHS.map((path) => ({
    path: `content/${path}`,
    content: () => readStoryContent(path),
  })),
  {
    path: 'content/editors.toml',
    content: () => readTemplateContent('editors.toml') + readStoryContent('editors-story.toml'),
  },
]
