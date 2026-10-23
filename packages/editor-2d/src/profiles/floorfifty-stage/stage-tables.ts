import { stringify } from '@decimalturn/toml-patch'
import type {
  StageCitySink,
  StageCourse,
  StageExtension,
  StageLayer,
  StagePresentation,
  StageSetPiece,
} from './stage.schema'

// The text of a table the codec adds (EDFF.1a decision 9). The four shipped stages are the style guide: `[name]` or
// `[[name]]`, then `key = value` lines with no spaces inside the brackets of a list, in the order the files use. The
// comments and the blank lines between tables are the block engine's.

/** The tables of a stage in the order the files list them; a table with no sibling goes after the nearest one before it. */
export const RANK: Readonly<Record<string, number>> = {
  courseTuning: 0,
  course: 1,
  'course.phrases': 2,
  'course.extension': 3,
  theme: 4,
  'theme.layers': 5,
  'theme.presentation': 6,
  'theme.presentation.citySink': 7,
  'theme.setPieces': 8,
}

const COURSE_KEYS = ['seed'] as const
const PHRASE_KEYS = ['name', 'fromFloor', 'toFloor', 'purpose'] as const
const EXTENSION_KEYS = ['fromFloor', 'toFloor', 'purpose'] as const
const LAYER_KEYS = ['alias', 'plate', 'depth', 'sink', 'haze', 'extend', 'arc', 'drift'] as const
// The files write `kind` before `holdMs`; the schema lists `holdMs` first.
const SET_PIECE_KEYS: Readonly<Record<StageSetPiece['kind'], readonly string[]>> = {
  lightsOut: ['floor', 'kind', 'holdMs', 'invert'],
  paletteShift: ['floor', 'kind', 'holdMs', 'mood', 'stay'],
  weatherBurst: ['floor', 'kind', 'holdMs', 'particle', 'density', 'layers'],
  skyFlash: ['floor', 'kind', 'holdMs', 'flashes', 'tone', 'kick'],
  swarm: ['floor', 'kind', 'holdMs', 'layers', 'speed'],
}
// The files disagree on where `lightHeight` goes; the schema's order is used.
const PRESENTATION_KEYS = [
  'profile',
  'refractionIntensity',
  'horizonLift',
  'lightHeight',
  'lightShimmer',
  'silhouette',
] as const
const CITY_SINK_KEYS = ['teach', 'combine', 'recover', 'finish'] as const

/** `[header]`, then the keys of `data` in `order`. A key whose value is `undefined` is not written, and every table has a key. */
function table(header: string, data: object, order: readonly string[]): string[] {
  const values = data as Record<string, unknown>
  const ordered: Record<string, unknown> = {}
  for (const key of order) ordered[key] = values[key]
  return [header, ...stringify(ordered, { bracketSpacing: false }).trimEnd().split('\n')]
}

export type ListName = 'course.extension' | 'theme.layers' | 'theme.setPieces'

/** One element of a list: `[[name]]` and its keys. */
export function elementTable(list: ListName, element: StageExtension | StageLayer | StageSetPiece): string[] {
  const header = `[[${list}]]`
  if (list === 'theme.layers') return table(header, element, LAYER_KEYS)
  if (list === 'course.extension') return table(header, element, EXTENSION_KEYS)
  return table(header, element, SET_PIECE_KEYS[(element as StageSetPiece).kind])
}

/** The tables of a course in file order: `[course]`, its phrases, then its extension. */
export function courseTables(course: StageCourse): string[][] {
  return [
    table('[course]', course, COURSE_KEYS),
    ...course.phrases.map((phrase) => table('[[course.phrases]]', phrase, PHRASE_KEYS)),
    ...(course.extension ?? []).map((entry) => elementTable('course.extension', entry)),
  ]
}

export function citySinkTable(citySink: StageCitySink): string[] {
  return table('[theme.presentation.citySink]', citySink, CITY_SINK_KEYS)
}

/** The presentation and, when it has one, its city sink. */
export function presentationTables(presentation: StagePresentation): string[][] {
  return [
    table('[theme.presentation]', presentation, PRESENTATION_KEYS),
    ...(presentation.citySink === undefined ? [] : [citySinkTable(presentation.citySink)]),
  ]
}
