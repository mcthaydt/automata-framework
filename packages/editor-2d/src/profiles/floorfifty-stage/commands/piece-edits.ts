import type { IdSource } from '../../../model/ids'
import type { StageSetPiece } from '../stage.schema'
import type { StageDocument } from '../stage-document'
import { checkIndex, freshId, insertAt, removeAt, withKey, withTheme } from './edit-helpers'

// The Pieces view's edits (2D editor spec §10.6, EDFF.1d). A set piece is a code-owned kind the stage picks and
// parameterises, placed on a floor of a fifty-floor race. Whether a value is in range is the checks' business.

export type SetPieceKind = StageSetPiece['kind']

type FieldsOf<P> = P extends unknown ? Exclude<keyof P, 'kind' | 'floor'> : never
type ValueOf<P, F extends PropertyKey> = P extends unknown ? (F extends keyof P ? P[F] : never) : never

/** Every field some kind has besides its floor and kind: `holdMs`, `mood`, `layers`, `speed`, … */
export type SetPieceField = FieldsOf<StageSetPiece>

const DEFAULT_HOLD_MS = 6000

/** The fields each kind has, so that an edit cannot give a piece one it does not have or take one it needs. */
const KIND_FIELDS: Readonly<
  Record<
    SetPieceKind,
    { readonly required: readonly SetPieceField[]; readonly optional: readonly SetPieceField[] }
  >
> = {
  lightsOut: { required: ['holdMs'], optional: ['invert'] },
  paletteShift: { required: ['holdMs', 'mood'], optional: ['stay'] },
  weatherBurst: { required: ['holdMs', 'particle', 'density'], optional: ['layers'] },
  skyFlash: { required: ['holdMs', 'flashes', 'tone'], optional: ['kick'] },
  swarm: { required: ['holdMs', 'layers', 'speed'], optional: [] },
}

function withPieceList(
  document: StageDocument,
  setPieces: readonly StageSetPiece[],
  ids?: readonly string[],
): StageDocument {
  const themed = withTheme(document, { ...document.value.theme, setPieces })
  return ids === undefined ? themed : { ...themed, ids: { ...themed.ids, setPieces: ids } }
}

function pieceAt(document: StageDocument, index: number): StageSetPiece {
  checkIndex('set piece', index, document.value.theme.setPieces.length)
  return document.value.theme.setPieces[index] as StageSetPiece
}

/**
 * A piece of `kind` with values that do something visible and are in range. A swarm needs layers to sweep: the front sky
 * layer that is not the plate (the clouds, the birds), else the front layer, else none (and the checks say so).
 */
function newPiece(document: StageDocument, kind: SetPieceKind, floor: number): StageSetPiece {
  const base = { floor, holdMs: DEFAULT_HOLD_MS }
  switch (kind) {
    case 'lightsOut':
      return { ...base, kind }
    case 'paletteShift':
      return { ...base, kind, mood: 'night' }
    case 'weatherBurst':
      return { ...base, kind, particle: 'snow', density: 0.5 }
    case 'skyFlash':
      return { ...base, kind, flashes: 1, tone: 'lightning' }
    case 'swarm': {
      const { layers } = document.value.theme
      const cloud = layers.filter((layer) => layer.plate === 'sky' && layer.extend !== 'plate').at(-1)
      const chosen = cloud ?? layers.at(-1)
      return { ...base, kind, layers: chosen === undefined ? [] : [chosen.alias], speed: 8 }
    }
  }
}

/**
 * Adds a piece after the last one on a floor at or below its own, so a file written in floor order stays in it, and
 * pieces on one floor play in the order they were added.
 */
export function addSetPiece(
  document: StageDocument,
  source: IdSource,
  kind: SetPieceKind,
  floor: number,
): StageDocument {
  const { setPieces } = document.value.theme
  let at = 0
  setPieces.forEach((existing, index) => {
    if (existing.floor <= floor) at = index + 1
  })
  const id = freshId(source, document.ids.setPieces)
  return withPieceList(
    document,
    insertAt(setPieces, at, newPiece(document, kind, floor)),
    insertAt(document.ids.setPieces, at, id),
  )
}

/** Moves a piece to another floor. The list keeps its order, so the index a drag holds stays the piece's. */
export function moveSetPiece(document: StageDocument, index: number, floor: number): StageDocument {
  const piece = pieceAt(document, index)
  const next = withKey(piece, 'floor', floor)
  if (next === piece) return document
  return withPieceList(
    document,
    document.value.theme.setPieces.map((entry, position) => (position === index ? next : entry)),
  )
}

/**
 * Sets a field of a piece; `undefined` drops an optional one. A field the piece's kind does not have, or no value for
 * one it needs, is a programmer error.
 */
export function setSetPieceField<F extends SetPieceField>(
  document: StageDocument,
  index: number,
  field: F,
  value: ValueOf<StageSetPiece, F>,
): StageDocument {
  const piece = pieceAt(document, index)
  const { required, optional } = KIND_FIELDS[piece.kind]
  if (!required.includes(field) && !optional.includes(field))
    throw new RangeError(`a ${piece.kind} piece has no ${field}`)
  if (value === undefined && required.includes(field))
    throw new RangeError(`a ${piece.kind} piece needs ${field}`)
  // The kind's own type would not take a field it does not know; the table above is what vouches for this one.
  const next = withKey(piece as unknown as Record<string, unknown>, field, value) as unknown as StageSetPiece
  if (next === piece) return document
  return withPieceList(
    document,
    document.value.theme.setPieces.map((entry, position) => (position === index ? next : entry)),
  )
}

export function removeSetPiece(document: StageDocument, index: number): StageDocument {
  pieceAt(document, index)
  return withPieceList(
    document,
    removeAt(document.value.theme.setPieces, index),
    removeAt(document.ids.setPieces, index),
  )
}
