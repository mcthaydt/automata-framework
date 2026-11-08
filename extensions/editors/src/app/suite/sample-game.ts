// The game the suite page opens when no checkout answers (the site's try-it page): a tuning file, the 3D sample's hall and
// Wick, and one file of each kind the content editors edit, so a person trying the editors sees each one working. Levels 2D
// has no file yet: it starts one from a template.
import { EDITOR_LIST_PATH } from '@automata/editor/editor-list'
import { SAMPLE_3D } from '@automata/editor-3d/suite'
import audio from './sample/audio.toml?raw'
import cutscene from './sample/cutscene.toml?raw'
import dialogue from './sample/dialogue.toml?raw'
import list from './sample/editors.toml?raw'
import feel from './sample/feel.toml?raw'
import lines from './sample/lines.toml?raw'
import nav from './sample/nav.toml?raw'
import systems from './sample/systems.toml?raw'

// The 3D sample's own list and tuning are replaced by this page's.
const { [EDITOR_LIST_PATH]: _list, 'content/tuning.toml': _tuning, ...sample3d } = SAMPLE_3D

export const CONTENT_SAMPLE_GAME: Readonly<Record<string, string>> = {
  ...sample3d,
  [EDITOR_LIST_PATH]: list,
  'content/tuning.toml': '[player]\nspeed = 6.5 # m/s\n',
  'content/feel/feel.toml': feel,
  'content/audio/audio.toml': audio,
  'content/lines/shop.toml': lines,
  'content/dialogue/shop.toml': dialogue,
  'content/cutscenes/opening.toml': cutscene,
  'content/systems/hall.toml': systems,
  'content/nav/hall.toml': nav,
}
