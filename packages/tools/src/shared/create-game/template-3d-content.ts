import { readFileSync } from 'node:fs'
import type { TemplateFile } from './template-file.ts'

// What a new 3D game starts with: one room, Wick, a keeper and a guard, the swatches and props they use, a tuning file,
// what Feel and Audio make of his bump, the keeper's words, a cutscene, the guard's rules and rounds, and the editor list.
// Real files in `template-3d-content/`, written into the game's `content/`, so each can be opened in the editor that
// reads it. From source the folder is next to this file; in the published build `tsdown.config.ts` copies it to
// `dist/template-3d-content/`, next to the bundle this file is part of, so one relative URL finds it in both.

/** The files under `template-3d-content/`, as written into the game's `content/`. */
export const TEMPLATE_3D_CONTENT_PATHS: readonly string[] = [
  'audio/audio.toml',
  'cutscenes/look.toml',
  'dialogue/keeper.toml',
  'editors.toml',
  'feel/feel.toml',
  'figure-gaits/bounce.toml',
  'figure-swatches/brow.toml',
  'figure-swatches/guard-cloak-shade.toml',
  'figure-swatches/guard-cloak.toml',
  'figure-swatches/keeper-cloak-shade.toml',
  'figure-swatches/keeper-cloak.toml',
  'figure-swatches/lid.toml',
  'figure-swatches/mouth.toml',
  'figure-swatches/sole.toml',
  'figure-swatches/wick-boot.toml',
  'figure-swatches/wick-cloak-shade.toml',
  'figure-swatches/wick-cloak.toml',
  'figure-swatches/wick-eye.toml',
  'figure-swatches/wick-shadow.toml',
  'figure-swatches/wick-trim.toml',
  'figures/guard.toml',
  'figures/keeper.toml',
  'figures/wick.toml',
  'levels/room.af-sector.json',
  'lines/keeper.toml',
  'nav/guard.toml',
  'systems/guard.toml',
  'tuning.toml',
  'words/en.json',
  'world-props/barrel.toml',
  'world-props/crate.toml',
  'world-swatches/barrel.toml',
  'world-swatches/ceiling.toml',
  'world-swatches/crate.toml',
  'world-swatches/floor.toml',
  'world-swatches/wall.toml',
]

const FOLDER = new URL('./template-3d-content/', import.meta.url)

/** The 3D game's `content/` files. */
export const CONTENT_3D_FILES: readonly TemplateFile[] = TEMPLATE_3D_CONTENT_PATHS.map((path) => ({
  path: `content/${path}`,
  content: () => readFileSync(new URL(path, FOLDER), 'utf8'),
}))
