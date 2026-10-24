import type { TemplateDef } from '../../profile'
import { addCourse } from '../commands/course-edits'
import { setLight } from '../commands/identity-edits'
import { addLayer } from '../commands/layer-edits'
import { setPresentation } from '../commands/presentation-edits'
import type { StageLayer } from '../stage.schema'
import type { StageDocument } from '../stage-document'

// The three ways a new stage starts (2D editor spec §10.6): Empty, Sky only and Simple city, each a valid stage. They use
// the game's own aliases, so a loaded art manifest accepts them and an unloaded one only notes that aliases are not
// checked; the author points the layers at their own art. Values are Rooftops', the stage whose composition was tuned
// against the accepted board. The ids of the layers come from the injected source, so a test can name them.

const SKY_PLATE: StageLayer = {
  alias: 'world.rooftopsSky',
  plate: 'sky',
  depth: 0.06,
  sink: 200,
  extend: 'plate',
}
const CLOUDS: StageLayer = {
  alias: 'world.clouds',
  plate: 'sky',
  depth: 0.06,
  sink: -140,
  extend: 'none',
  drift: 1.5,
}
const CITY_FAR: StageLayer = {
  alias: 'world.cityFar',
  plate: 'city',
  depth: 0.15,
  sink: 240,
  haze: 0.25,
  extend: 'skirt',
}
const CITY_NEAR: StageLayer = {
  alias: 'world.cityNear',
  plate: 'city',
  depth: 0.35,
  sink: 290,
  haze: 0,
  extend: 'skirt',
}

/** The course the shipped Rooftops plays (seed 35229): a known-good climb to start from. */
const COURSE = { seed: 35229, top: 19, tallest: 49 }

type Source = Parameters<TemplateDef<StageDocument>['create']>[0]

function empty(source: Source): StageDocument {
  return {
    value: {
      id: 'new-stage',
      displayName: 'New stage',
      platformAlias: 'world.platform',
      courseTuning: {},
      theme: { backdropAlias: SKY_PLATE.alias, layers: [SKY_PLATE], setPieces: [] },
    },
    ids: { extension: [], layers: [source.next()], setPieces: [] },
  }
}

function skyOnly(source: Source): StageDocument {
  return setLight(addLayer(empty(source), source, CLOUDS), 'world.sun')
}

function simpleCity(source: Source): StageDocument {
  const withCity = addLayer(addLayer(skyOnly(source), source, CITY_FAR), source, CITY_NEAR)
  const lit = setPresentation(setPresentation(withCity, 'refractionIntensity', 0.45), 'horizonLift', 12)
  return addCourse(lit, source, COURSE)
}

export const emptyTemplate: TemplateDef<StageDocument> = { id: 'empty', label: 'Empty', create: empty }
export const skyOnlyTemplate: TemplateDef<StageDocument> = {
  id: 'sky-only',
  label: 'Sky only',
  create: skyOnly,
}
export const simpleCityTemplate: TemplateDef<StageDocument> = {
  id: 'simple-city',
  label: 'Simple city',
  create: simpleCity,
}
