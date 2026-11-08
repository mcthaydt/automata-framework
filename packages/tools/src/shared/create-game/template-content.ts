import { EMBEDDED_TEMPLATE_CONTENT } from './template-embedded.ts'
import type { TemplateFile } from './template-file.ts'

// The level a new game starts with, and its editor list: real files in `template-content/`, written into the game's
// `content/`. The level project opens in the 2D editor; `project.toml`, `world.toml` and `levels/start.toml` are what
// the editor's Save writes from it, made by `scripts/write-template-content.ts` (a test keeps them equal). They are the
// same for every game, so none of them depends on the options.
//
// The text is read from `template-embedded.ts`, made from the folder by `scripts/write-template-embedded.ts` (a test
// keeps them equal), so no disk is read and the Automata app can make a game on a phone.

/** The files under `template-content/`, as written into the game's `content/`. */
export const TEMPLATE_CONTENT_PATHS: readonly string[] = [
  'editors.toml',
  'levels/start.af2d.json',
  'levels/start.toml',
  'project.toml',
  'world.toml',
]

/** One file of `template-content/`, by its path there. */
export function readTemplateContent(path: string): string {
  const text = EMBEDDED_TEMPLATE_CONTENT[path]
  if (text === undefined) throw new Error(`There is no template file ${path}.`)
  return text
}

/** The game's `content/` files. */
export const CONTENT_FILES: readonly TemplateFile[] = TEMPLATE_CONTENT_PATHS.map((path) => ({
  path: `content/${path}`,
  content: () => readTemplateContent(path),
}))
