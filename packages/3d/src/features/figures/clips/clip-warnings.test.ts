import { describe, expect, it } from 'vitest'
import type { FigureClipDef } from './clip.schema.ts'
import { clipWarnings } from './clip-warnings.ts'

const clip = (keys: FigureClipDef['keys']): FigureClipDef => ({
  length: 1,
  loop: 'once',
  mask: ['armL'],
  keys,
})

describe('clipWarnings', () => {
  it('lists each neighbouring pair whose channel changes space, at the later key', () => {
    const poses = {
      chest: { effectors: { handL: { pos: [0.1, -0.2, 0.3] as const, space: 'chest' as const } } },
      root: { effectors: { handL: { pos: [0.3, 1, 0.2] as const } } },
    }
    const c = clip([
      { t: 0, pose: 'root' },
      { t: 0.5, pose: 'chest' },
      { t: 0.7, pose: { effectors: {}, poles: { elbowL: { dir: [1, 0, 0], space: 'chest' } } } },
      { t: 1, pose: 'chest' },
    ])
    expect(clipWarnings(c, poses)).toEqual([
      {
        path: ['keys', 1],
        message: expect.stringMatching(/handL is in root space at key 0 and in chest space at key 1/),
      },
      {
        path: ['keys', 2],
        message: expect.stringMatching(
          /elbowL is left to its default \(root space\) at key 1 and in chest space at key 2/,
        ),
      },
      {
        path: ['keys', 3],
        message: expect.stringMatching(
          /elbowL is in chest space at key 2 and left to its default \(root space\) at key 3/,
        ),
      },
    ])
  })
  it('lists a handle both keys name with different fields, which pops when the segment ends', () => {
    const c = clip([
      { t: 0, pose: { effectors: { handR: { pos: [0, 1, 0.3], rot: [0, 10, 0] } } } },
      { t: 1, pose: { effectors: { handR: { pos: [0, 1, 0.4] } } } },
    ])
    expect(clipWarnings(c, {})).toEqual([
      {
        path: ['keys', 1],
        message: expect.stringMatching(
          /handR sets pos and rot at key 0 but pos at key 1: rot is held, then drops/,
        ),
      },
    ])
  })
  it('has nothing to say about a clip in one space, or about a pose it cannot find', () => {
    const p = { effectors: { handL: { pos: [0.1, -0.2, 0.3] as const, space: 'chest' as const } } }
    expect(
      clipWarnings(
        clip([
          { t: 0, pose: p },
          { t: 1, pose: p },
        ]),
        {},
      ),
    ).toEqual([])
    expect(
      clipWarnings(
        clip([
          { t: 0, pose: 'gone' },
          { t: 1, pose: p },
        ]),
        {},
      ),
    ).toEqual([])
  })
})
