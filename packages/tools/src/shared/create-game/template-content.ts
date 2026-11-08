import { readFileSync } from 'node:fs'
import type { TemplateFile } from './template-file.ts'

// The level a new game starts with, and its editor list: real files in `template-content/`, written into the game's
// `content/`. The level project opens in the 2D editor; `project.toml`, `world.toml` and `levels/start.toml` are what
// the editor's Save writes from it, made by `scripts/write-template-content.ts` (a test keeps them equal). They are the
// same for every game, so none of them depends on the options.
//
// From source the folder is next to this file; in the published build `tsdown.config.ts` copies it to
// `dist/template-content/`, next to the bundle this file is part of, so one relative URL finds it in both.

/** The files under `template-content/`, as written into the game's `content/`. */
export const TEMPLATE_CONTENT_PATHS: readonly string[] = [
  'audio/audio.toml',
  'controls.toml',
  'editors.toml',
  'feel/feel.toml',
  'levels/start.af2d.json',
  'levels/start.toml',
  'project.toml',
  'tuning.toml',
  'world.toml',
]

const FOLDER = new URL('./template-content/', import.meta.url)

/** One file of `template-content/`, by its path there. */
export const readTemplateContent = (path: string): string => readFileSync(new URL(path, FOLDER), 'utf8')

/** The game's `content/` files. */
export const CONTENT_FILES: readonly TemplateFile[] = TEMPLATE_CONTENT_PATHS.map((path) => ({
  path: `content/${path}`,
  content: () => readTemplateContent(path),
}))
