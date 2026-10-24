import type { StageCourse, StageLayer, StageSetPiece } from '../stage.schema'
import type { StageDocument } from '../stage-document'
import { documentOf, MINIMAL_STAGE } from './stage-texts'

// Documents for the check tests: the smallest valid stage with one thing replaced, with ids numbered as a parse numbers them.

const numbered = (items: readonly unknown[]): string[] => items.map((_, index) => `b${index}`)

export function minimal(): StageDocument {
  return documentOf(MINIMAL_STAGE)
}

export function layer(
  alias: string,
  plate: 'sky' | 'city',
  depth: number,
  rest: Partial<StageLayer> = {},
): StageLayer {
  return { alias, plate, depth, sink: 0, extend: 'none', ...rest }
}

/** The minimal stage with these layers, back to front. */
export function withLayers(layers: readonly StageLayer[]): StageDocument {
  const base = minimal()
  return {
    value: { ...base.value, theme: { ...base.value.theme, layers } },
    ids: { ...base.ids, layers: numbered(layers) },
  }
}

export function withPieces(setPieces: readonly StageSetPiece[]): StageDocument {
  const base = minimal()
  return {
    value: { ...base.value, theme: { ...base.value.theme, setPieces } },
    ids: { ...base.ids, setPieces: numbered(setPieces) },
  }
}

/** The four phrases of a course that covers floors 1 to 19, as the shipped stages divide them. */
export const PHRASES: StageCourse['phrases'] = [
  { name: 'teach', fromFloor: 1, toFloor: 5, purpose: 'Learn to bounce' },
  { name: 'combine', fromFloor: 6, toFloor: 10, purpose: 'Chain bounces' },
  { name: 'recover', fromFloor: 11, toFloor: 14, purpose: 'Catch your breath' },
  { name: 'finish', fromFloor: 15, toFloor: 19, purpose: 'Climb out' },
]

export function withCourse(course: StageCourse): StageDocument {
  const base = minimal()
  return {
    value: { ...base.value, course },
    ids: { ...base.ids, extension: numbered(course.extension ?? []) },
  }
}
