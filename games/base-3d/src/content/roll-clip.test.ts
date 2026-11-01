// Wick's roll clip (EDITOR-GAPS EG-6, art direction spec §4.11): a tucked forward roll in place of the pickup's crouch.
// The view retimes the clip to the roll's 24 ticks (views/index.ts `heroFigureState`), so the authored clip is that
// long at 60 Hz and its markers (the tuck and the rise) fall inside it, in order.
import { content } from 'virtual:automata/content'
import { describe, expect, it } from 'vitest'
import { ROLL, TICK_HZ } from '../constants/index.ts'
import { figureContent } from '../views/index.ts'

const { motion } = figureContent(content)
const roll = motion.clips.roll

describe('the roll clip', () => {
  it('lasts the roll’s 24 ticks', () => {
    expect(roll?.length).toBeCloseTo(ROLL.ticks / TICK_HZ, 9)
  })

  it('tucks into its own pose, not the pickup’s crouch', () => {
    const poses = roll?.keys.map((key) => key.pose)
    expect(poses).toContain('roll-tuck')
    expect(poses).not.toContain('pickup-low')
    expect(motion.poses['roll-tuck']).toBeDefined()
  })

  it('marks the tuck and the rise inside the roll, the tuck first', () => {
    const markers = roll?.markers ?? {}
    expect(markers.tuck).toBeGreaterThan(0)
    expect(markers.rise).toBeGreaterThan(markers.tuck as number)
    expect(markers.rise).toBeLessThan(roll?.length as number)
  })
})
