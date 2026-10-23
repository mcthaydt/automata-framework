import { describe, expect, it } from 'vitest'
import { checkEditorRules } from './check-editor'
import type { StageSetPiece } from './stage.schema'
import { withPieces } from './testing/check-docs'
import { SHIPPED_STAGE_IDS, shippedStage } from './testing/shipped-stages'
import { documentOf } from './testing/stage-texts'

// The rules only the editor has (spec §10.7): the game would run these stages, a person should think twice.

const flash = (floor: number, flashes: number, holdMs: number): StageSetPiece => ({
  floor,
  kind: 'skyFlash',
  holdMs,
  flashes,
  tone: 'lightning',
})

const check = (...pieces: StageSetPiece[]) => checkEditorRules(withPieces(pieces))

const warned = (path: string, count: number, floor: number) => ({
  severity: 'warning',
  code: 'flashRate',
  path,
  message: `The sky flashes at floor ${floor} can start ${count} flashes within one second; the limit is 3 (WCAG 2.3.1). Move one to another floor or give it a longer hold.`,
})

describe('flashRate', () => {
  it('lets one piece flash three times: the director spaces its flashes 334 ms apart at the least', () => {
    expect(check(flash(10, 3, 500))).toEqual([])
    expect(check(flash(10, 3, 20_000))).toEqual([])
  })

  it('lets two pieces on one floor share the hold when their flashes are far enough apart', () => {
    expect(check(flash(45, 2, 6000), flash(45, 2, 6000))).toEqual([])
  })

  it('warns when pieces on one floor stack more than three flashes into a second', () => {
    expect(check(flash(45, 2, 500), flash(45, 2, 500))).toEqual([warned('theme.setPieces[b1]', 4, 45)])
  })

  it('counts the flashes in the busiest second, three of one piece and one of another', () => {
    expect(check(flash(45, 3, 500), flash(45, 1, 500))).toEqual([warned('theme.setPieces[b1]', 4, 45)])
  })

  it('draws the line at a thousand milliseconds between the first and the fourth start', () => {
    // 2 flashes in 2000 ms: spacing 1000. Four starts at 0, 0, 1000, 1000: the fourth is a whole second after the first.
    expect(check(flash(45, 2, 2000), flash(45, 2, 2000))).toEqual([])
    // 2 flashes in 1998 ms: spacing 999. Starts at 0, 0, 999, 999.
    expect(check(flash(45, 2, 1998), flash(45, 2, 1998))).toEqual([warned('theme.setPieces[b1]', 4, 45)])
  })

  it('names the second piece of the floor, however many are stacked, and says it once', () => {
    expect(check(flash(45, 2, 500), flash(45, 2, 500), flash(45, 2, 500))).toEqual([
      warned('theme.setPieces[b1]', 6, 45),
    ])
  })

  it('judges each floor on its own, and ignores the other kinds of piece', () => {
    expect(check(flash(44, 2, 500), flash(45, 2, 500), flash(46, 2, 500))).toEqual([])
    const burst = { floor: 45, kind: 'weatherBurst', holdMs: 500, particle: 'rain', density: 1 } as const
    expect(check(flash(45, 3, 500), burst)).toEqual([])
  })

  it('leaves a piece with a flash count or hold outside its range to the range check', () => {
    expect(check(flash(45, 0, 500), flash(45, 3, 500))).toEqual([])
    expect(check(flash(45, 2.5, 500), flash(45, 3, 500))).toEqual([])
    expect(check(flash(45, 4, 500), flash(45, 3, 500))).toEqual([])
    expect(check(flash(45, 3, Number.NaN), flash(45, 3, 500))).toEqual([])
    expect(check(flash(45, 3, -5), flash(45, 3, 500))).toEqual([])
    expect(check(flash(45, 3, 0), flash(45, 3, 500))).toEqual([])
  })

  it.each(SHIPPED_STAGE_IDS)('finds nothing in %s', (id) => {
    expect(checkEditorRules(documentOf(shippedStage(id)))).toEqual([])
  })
})
