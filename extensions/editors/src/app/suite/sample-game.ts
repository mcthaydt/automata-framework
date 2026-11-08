// The game the suite page opens when no checkout answers: a tuning file and one file of each kind the content editors
// edit, so a person trying the editors sees each one working.
import { EDITOR_LIST_PATH } from '@automata/editor/editor-list'
import dialogue from './sample/dialogue.toml?raw'
import list from './sample/editors.toml?raw'
import feel from './sample/feel.toml?raw'
import lines from './sample/lines.toml?raw'

export const CONTENT_SAMPLE_GAME: Readonly<Record<string, string>> = {
  [EDITOR_LIST_PATH]: list,
  'content/tuning.toml': '[player]\nspeed = 6.5 # m/s\n',
  'content/feel/feel.toml': feel,
  'content/lines/shop.toml': lines,
  'content/dialogue/shop.toml': dialogue,
}
