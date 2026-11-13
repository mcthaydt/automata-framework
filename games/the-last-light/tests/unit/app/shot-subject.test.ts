import { describe, expect, it } from 'vitest'
import { shotSubject } from '#src/app/shot-subject.ts'

// What a cutscene's shot keeps in sight, for the occluder rule: the figure it frames, or nobody. The opening's noticeboard insert frames
// nobody; by its look point (on the board, a hair in front of the wall) the rule cut the board and the wall, and the shot showed the dark.

const ADA = { x: 0.6, y: 0, z: 3.6, alpha: 1 }
const NURSE = { x: 0, y: 0, z: -6.1, alpha: 1 }

describe('the subject of a cutscene shot', () => {
  it('is nobody in the opening’s noticeboard insert: Ada stands behind the camera', () => {
    const shot = { eye: { x: 2.05, y: 1.95, z: 1.6 }, look: { x: 3.3, y: 1.85, z: -0.86 }, lens: 32 }
    expect(shotSubject(shot, [ADA])).toBeNull()
  })

  it('is Ada in the opening’s close-up, feet to head', () => {
    const shot = { eye: { x: 0.9, y: 1.61, z: 2.35 }, look: { x: 0.6, y: 1.36, z: 3.6 }, lens: 28.5 }
    expect(shotSubject(shot, [ADA, NURSE])).toEqual({
      feet: { x: 0.6, y: 0, z: 3.6 },
      head: { x: 0.6, y: 1.62, z: 3.6 },
    })
  })

  it('is the figure at the corridor’s end when the shot looks down it, Ada behind the camera', () => {
    const shot = { eye: { x: 0, y: 1.7, z: 0.2 }, look: { x: 0, y: 1.2, z: -6.1 }, lens: 58.3 }
    expect(shotSubject(shot, [ADA, NURSE])?.feet).toEqual({ x: 0, y: 0, z: -6.1 })
  })

  it('passes over a figure the scene has faded out', () => {
    const shot = { eye: { x: 0.9, y: 1.61, z: 2.35 }, look: { x: 0.6, y: 1.36, z: 3.6 }, lens: 28.5 }
    expect(shotSubject(shot, [{ ...ADA, alpha: 0 }])).toBeNull()
  })
})
