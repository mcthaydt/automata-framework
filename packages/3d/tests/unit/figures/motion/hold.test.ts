// Holds: an item's grip is applied last and changes only the holding arm (F-b). Ported from The Last Light
// (mcthaydt/PixiJS3D_Experiment_001) tests/procedural-figure.test.ts at 92e6704 ("holding an item changes only
// the holding arm", "the hold is applied after the base pose and leaves the base untouched") onto AF's
// fixture figures and items, and checked against the recorded holds.

import { beforeAll, describe, expect, it } from 'vitest'
import { armChain, at, JOINTS } from '#src/features/figures/body/rig.ts'
import type { ItemDef } from '#src/features/figures/content/item.schema.ts'
import type { FigureDef } from '#src/features/figures/figure/figure.schema.ts'
import { skeleton } from '#src/features/figures/figure/figure-skeleton.ts'
import { base } from '#src/features/figures/motion/base.ts'
import { gaitOf } from '#src/features/figures/motion/gait-of.ts'
import { applyHold, evaluateMotion, holdOf } from '#src/features/figures/motion/hold.ts'
import type { MotionState } from '#src/features/figures/motion/motion-state.ts'
import { apply, length, sub } from '#src/shared/math/math.ts'
import { type FixtureFigures, fixtureFigures } from '#src/testing/fixture-library.ts'
import { GOLDEN_OUTFITS } from '#src/testing/golden-outfits.ts'
import { expectClose, expectDigest, MOTION_GOLDENS } from '#src/testing/motion-goldens.ts'
import { GOLDEN_SOME_STATES, GOLDEN_STATES, locomotionStates } from '#src/testing/motion-states.ts'

let fixture: FixtureFigures
beforeAll(async () => {
  fixture = await fixtureFigures()
})
const figure = (id: string): FigureDef => {
  const def = fixture.figures[id]
  if (!def) throw new Error(`no figure ${id}`)
  return def
}
const item = (id: string): ItemDef => {
  const def = fixture.library.items[id]
  if (!def) throw new Error(`no item ${id}`)
  return def
}

describe('F-b: holding an item changes only the holding arm', () => {
  for (const id of ['wick', 'keeper'])
    for (const itemId of ['hand-lamp', 'lighter', 'torch'])
      it(`${id} with the ${itemId}: every joint outside the holding arm keeps its exact world matrix`, () => {
        const def = figure(id)
        const s = skeleton(def)
        const gait = gaitOf(def, fixture.gaits)
        const hold = holdOf(item(itemId), s, def.hand)
        const chain = new Set(armChain(def.hand))
        // Walk, idle and turn (The Last Light's states without its actions), and standing in the figure's own
        // stand, whose placed hand the item's hold takes over.
        const states: [string, MotionState][] = [...locomotionStates()]
        const stand = def.stand ? fixture.stands[def.stand] : undefined
        if (stand) states.push(['own stand', { ...at(locomotionStates(), 24)[1], stand }])
        let armMoved = 0
        for (const [label, st] of states) {
          const without = evaluateMotion(s, gait, st).world
          const withItem = evaluateMotion(s, gait, { ...st, hold }).world
          for (let j = 0; j < JOINTS.length; j++) {
            if (chain.has(j)) {
              armMoved = Math.max(
                armMoved,
                length(sub(apply(at(withItem, j), [0, 0, 0]), apply(at(without, j), [0, 0, 0]))),
              )
              continue
            }
            // Exactly equal, not just close: the hold runs last and nothing upstream reads it.
            expect(at(withItem, j), `${label}: ${JOINTS[j]}`).toEqual(at(without, j))
          }
        }
        // And the holding arm really is posed by the hold.
        expect(armMoved).toBeGreaterThan(0.05)
      })
  it('the hold is applied after the base pose and leaves the base untouched', () => {
    const def = figure('wick')
    const s = skeleton(def)
    const evaluated = base(s, gaitOf(def, fixture.gaits), { ...at(locomotionStates(), 6)[1] })
    const copy = JSON.stringify(evaluated)
    applyHold(s, evaluated, holdOf(item('lighter'), s, 'R'))
    expect(JSON.stringify(evaluated)).toBe(copy)
  })
})

describe('holds match their recorded goldens', () => {
  it("every item's hold on Wick's and the keeper's bodies, each hand, in walk, idle and turn", () => {
    const bodies: Record<string, FigureDef['sliders']> = {
      wick: at(GOLDEN_OUTFITS, 0).sliders,
      keeper: at(GOLDEN_OUTFITS, 1).sliders,
    }
    const strut = fixture.gaits.strut
    if (!strut) throw new Error('no strut')
    let compared = 0
    for (const [key, golden] of Object.entries(MOTION_GOLDENS.holds)) {
      const [body = '', itemId = '', side = '', ...label] = key.split(' ')
      const s = skeleton({ sliders: bodies[body] ?? {} })
      const hold = holdOf(item(itemId), s, side === 'L' ? 'L' : 'R')
      for (const c of [0, 1, 2] as const) {
        expectClose(hold.hand[c], golden.hold.hand[c], `${key} hand`)
        expectClose(hold.turn[c], golden.hold.turn[c], `${key} turn`)
        expectClose(hold.pole[c], golden.hold.pole[c], `${key} pole`)
      }
      const state = GOLDEN_STATES[label.join(' ')]
      if (!state) throw new Error(`no state ${label.join(' ')}`)
      expectDigest(evaluateMotion(s, strut, { ...state, hold }).world, golden.world, key)
      compared++
    }
    // Two bodies, three items, two hands, three states.
    expect(compared).toBe(2 * 3 * 2 * GOLDEN_SOME_STATES.length)
  })
})
