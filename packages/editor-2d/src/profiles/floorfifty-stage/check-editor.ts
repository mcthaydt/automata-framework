import type { Diagnostic } from '../profile'
import { elementPath, warning } from './check-types'
import type { StageSetPiece } from './stage.schema'
import type { StageDocument } from './stage-document'

// The rules only the editor has (spec §10.7): stages the game would run, that a person should think twice about.

/** FloorFifty's `set-piece-director.ts`: a flash starts no closer than this to the one before it (under three a second). */
const FLASH_SPACING_MS = 334
const WINDOW_MS = 1000
const MAX_FLASHES_PER_WINDOW = 3

type SkyFlash = Extract<StageSetPiece, { kind: 'skyFlash' }>

/**
 * When the flashes of a piece start, in ms after the piece does: the director spreads them over the hold, and never
 * closer than `FLASH_SPACING_MS`. A piece with a count or hold outside its range has no schedule (the range check says so).
 */
function flashStarts(piece: SkyFlash): number[] {
  const { flashes, holdMs } = piece
  if (!Number.isInteger(flashes) || flashes < 1 || flashes > 3 || !(holdMs > 0) || !Number.isFinite(holdMs))
    return []
  const spacing = Math.max(FLASH_SPACING_MS, holdMs / flashes)
  return Array.from({ length: flashes }, (_, i) => i * spacing)
}

/**
 * The most flashes that start within one second of each other, by a window that begins at each start. (All the pieces of
 * a floor begin together, so the first second is in practice the busiest; the window is the rule as WCAG states it.)
 */
function busiestSecond(starts: readonly number[]): number {
  const sorted = [...starts].sort((a, b) => a - b)
  let most = 0
  sorted.forEach((first, i) => {
    const inWindow = sorted.filter((start, j) => j >= i && start - first < WINDOW_MS).length
    most = Math.max(most, inWindow)
  })
  return most
}

/**
 * Pieces on one floor start together, when the first racer reaches it, so their flashes stack; pieces on different floors
 * start when the climber reaches them, which no check can know. More than three flashes starting inside one second is
 * the photosensitivity limit (WCAG 2.3.1).
 */
function checkFlashRate(document: StageDocument): Diagnostic[] {
  const byFloor = new Map<number, { index: number; piece: SkyFlash }[]>()
  document.value.theme.setPieces.forEach((piece, index) => {
    if (piece.kind !== 'skyFlash') return
    byFloor.set(piece.floor, [...(byFloor.get(piece.floor) ?? []), { index, piece }])
  })
  const found: Diagnostic[] = []
  for (const [floor, group] of byFloor) {
    const second = group[1]
    if (second === undefined) continue
    const count = busiestSecond(group.flatMap(({ piece }) => flashStarts(piece)))
    if (count > MAX_FLASHES_PER_WINDOW)
      found.push(
        warning(
          'flashRate',
          elementPath(document.ids, 'setPieces', second.index),
          `The sky flashes at floor ${floor} can start ${count} flashes within one second; the limit is ${MAX_FLASHES_PER_WINDOW} (WCAG 2.3.1). Move one to another floor or give it a longer hold.`,
        ),
      )
  }
  return found
}

export function checkEditorRules(document: StageDocument): Diagnostic[] {
  return checkFlashRate(document)
}
