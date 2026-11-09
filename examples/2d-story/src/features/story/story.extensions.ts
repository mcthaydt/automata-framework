import { cutscenesExtension } from '@automata/cutscenes'
import { level2dExtension } from '@automata/level-2d'
import { level2dPlaces } from '@automata/level-2d/sim'
import { narrativeExtension } from '@automata/narrative'
import { createNavExtension } from '@automata/nav'
import { puzzleExtension } from '@automata/puzzle'
import { systemsExtension } from '@automata/systems'
import { METRE } from '../../shared/constants.ts'
import { project, startLevel } from '../level/level-content.ts'
import { itemOf } from '../level/level-items.ts'
import { Square } from '../square/square.component.ts'
import { createStoryPlugin } from './story.plugin.ts'
import { GRAPHS, lineOf, NAV, SCRIPTS, SYSTEMS, wordsOf } from './story-content.ts'

// The extensions this story opts into, all given the same places: the level's areas, its solid cells, and the square's own
// position. One metre is one cell of the walls layer, so the guard's one metre a second is one cell a second.

/** Where things stand in the level, answered from the editor's files. */
export const PLACES = level2dPlaces({
  level: startLevel,
  project,
  metre: METRE,
  position: { component: Square, x: 'x', y: 'y' },
})

export const narrative = narrativeExtension({ places: PLACES, words: wordsOf, lines: lineOf })
export const cutscenes = cutscenesExtension({
  places: PLACES,
  words: wordsOf,
  lines: lineOf,
  scripts: SCRIPTS,
})
export const systems = systemsExtension({ places: PLACES })

/** The extensions `defineGame` registers. */
export const EXTENSIONS = [
  level2dExtension,
  puzzleExtension({ extensions: ['level-2d', 'nav', 'narrative', 'cutscenes', 'systems'] }),
  createNavExtension({ places: PLACES }),
  narrative.extension,
  cutscenes.extension,
  systems.extension,
]

/** The story's own sim plugin, given the extensions' handles and the story's files. */
export const storyPlugin = createStoryPlugin({
  narrative,
  cutscenes,
  systems,
  graphs: GRAPHS,
  scripts: Object.values(SCRIPTS),
  nav: NAV,
  guardDef: SYSTEMS,
  keeper: itemOf('keeper'),
  guard: itemOf('guard'),
  metre: METRE,
})
