import type { Diagnostic } from '../profile'
import { elementPath, inRange, problem, rangeText } from './check-types'
import type { StageSetPiece } from './stage.schema'
import type { StageDocument } from './stage-document'

// The ranges of the set pieces (EDFF.1b decision 1). Which layers a piece may name is the references check's.

const MAX_PIECES = 16
const LAYER_COUNT = { min: 1, max: 6 }

interface Bounded {
  readonly field: string
  readonly min: number
  readonly max: number
  readonly whole: boolean
}

const FLOOR: Bounded = { field: 'floor', min: 1, max: 50, whole: true }
const HOLD: Bounded = { field: 'holdMs', min: 500, max: 20_000, whole: true }

function checkPiece(piece: StageSetPiece, path: string): Diagnostic[] {
  const found: Diagnostic[] = []
  const piece_ = `${piece.kind} piece`
  const at = ` at floor ${piece.floor}`
  const measure = (bounds: Bounded, value: number | undefined): void => {
    if (value === undefined) return
    if (inRange(value, bounds.min, bounds.max) && (!bounds.whole || Number.isInteger(value))) return
    // The floor is what `at` names, so the sentence about the floor itself leaves it off.
    const where = bounds === FLOOR ? '' : at
    found.push(
      problem(
        'setPieceRange',
        `${path}.${bounds.field}`,
        rangeText(
          `The ${bounds.field} of the ${piece_}${where}`,
          `The ${piece_}${where} has ${bounds.field}`,
          value,
          bounds.min,
          bounds.max,
          bounds.whole,
        ),
      ),
    )
  }
  measure(FLOOR, piece.floor)
  measure(HOLD, piece.holdMs)
  switch (piece.kind) {
    case 'weatherBurst':
      measure({ field: 'density', min: 0, max: 1, whole: false }, piece.density)
      break
    case 'skyFlash':
      measure({ field: 'flashes', min: 1, max: 3, whole: true }, piece.flashes)
      measure({ field: 'kick', min: 0, max: 4, whole: false }, piece.kick)
      break
    case 'swarm':
      measure({ field: 'speed', min: 1, max: 20, whole: false }, piece.speed)
      break
    default:
      break
  }
  if ((piece.kind === 'weatherBurst' || piece.kind === 'swarm') && piece.layers !== undefined) {
    const count = piece.layers.length
    if (count < LAYER_COUNT.min || count > LAYER_COUNT.max)
      found.push(
        problem(
          'setPieceRange',
          `${path}.layers`,
          `The ${piece_}${at} names ${count === 0 ? 'no layers' : `${count} layers`}; it needs ${LAYER_COUNT.min} to ${LAYER_COUNT.max}.`,
        ),
      )
    piece.layers.forEach((name, index) => {
      if (name === '')
        found.push(
          problem(
            'emptyAlias',
            `${path}.layers[${index}]`,
            `The ${piece_}${at} names a layer with an empty alias.`,
          ),
        )
    })
  }
  return found
}

export function checkSetPieces(document: StageDocument): Diagnostic[] {
  const { setPieces } = document.value.theme
  const found: Diagnostic[] = []
  if (setPieces.length > MAX_PIECES)
    found.push(
      problem(
        'tooManyPieces',
        'theme.setPieces',
        `A stage has at most ${MAX_PIECES} set pieces; this one has ${setPieces.length}.`,
      ),
    )
  setPieces.forEach((piece, index) => {
    found.push(...checkPiece(piece, elementPath(document.ids, 'setPieces', index)))
  })
  return found
}
