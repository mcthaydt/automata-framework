// Every suite screen, in gallery order. Each file holds one editor's screens.

import { audioScreens } from './screens-audio.mjs'
import { floorFiftyScreens } from './screens-floorfifty.mjs'
import { portraitScreens } from './screens-portrait.mjs'
import { schematicScreens } from './screens-schematic.mjs'
import { sequenceScreens } from './screens-sequence.mjs'
import { statesScreens } from './screens-states.mjs'
import { studioScreens } from './screens-studio.mjs'
import { suiteScreens } from './screens-suite.mjs'
import { tunerScreens } from './screens-tuner.mjs'
import { writerScreens } from './screens-writer.mjs'

export const screens = [
  ...sequenceScreens,
  ...tunerScreens,
  ...floorFiftyScreens,
  ...writerScreens,
  ...studioScreens,
  ...schematicScreens,
  ...audioScreens,
  ...suiteScreens,
  ...statesScreens,
  ...portraitScreens,
]
