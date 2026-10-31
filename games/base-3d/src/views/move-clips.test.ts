// G3-d and G3-F1 (DESIGN.md §19): a move's clip, retimed to the move's `total`, shows `contact` on the move's first
// active frame, within one tick. Fixture clips here; the game's own are checked in content.test.ts.
import type { FigureClipDef } from '@mcthaydt/automata-figures'
import { describe, expect, it } from 'vitest'
import type { MoveDef } from '../constants.ts'
import { moveClipProblems } from './move-clips.ts'

// A 22-frame move active from frame 6: contact belongs on tick 5 of 22.
const MOVE: MoveDef = { id: 'cut', clip: 'cut-clip', total: 22, active: [6, 9] }
const SWORD: MoveDef = {
  ...MOVE,
  hit: { near: 0, far: 1, bottom: 0, top: 1, dmg: 1, stop: 1, stun: 1, kb: 0, power: 1 },
}
const clip = (length: number, markers?: Record<string, number>) =>
  ({ length, loop: 'once', keys: [], ...(markers && { markers }) }) as unknown as FigureClipDef

describe('moveClipProblems', () => {
  it('passes a clip whose contact, retimed to the move, lands on the active start', () => {
    // 0.25 s retimed to 22 ticks: contact at 0.0625 s is 5.5 ticks, within one of tick 5.
    expect(moveClipProblems([SWORD], { 'cut-clip': clip(0.25, { contact: 0.0625 }) })).toEqual([])
  })

  it('fails a sword move whose clip has no contact, naming the move and the clip (G3-F1)', () => {
    expect(moveClipProblems([SWORD], { 'cut-clip': clip(0.25) })).toEqual([
      'move "cut": its clip "cut-clip" has no `contact` marker',
    ])
  })

  it('fails a contact more than a tick off the active start', () => {
    const [problem] = moveClipProblems([SWORD], { 'cut-clip': clip(0.22, { contact: 0.07 }) })
    expect(problem).toMatch(/^move "cut": its clip "cut-clip" shows `contact` on tick 7, not 5 \(±1\)/)
  })

  it('fails a move naming a clip that does not exist, and asks nothing of a move with no hit but that it exists', () => {
    expect(moveClipProblems([MOVE], {})).toEqual(['move "cut": its clip "cut-clip" does not exist'])
    expect(moveClipProblems([MOVE], { 'cut-clip': clip(0.3) })).toEqual([])
  })
})
