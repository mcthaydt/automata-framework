import { describe, expect, it } from 'vitest'
import { sceneProblems } from '#src/features/sequence/scene-problems.ts'

const lines = new Map([
  ['keeper.hi', 'Welcome in.'],
  ['keeper.empty', ''],
])
const base = { id: 'gate', duration: 10, camera: [{ t: 0, pos: [0, 1, 0], look: [1, 1, 0] }] }
const check = (extra: object) => sceneProblems({ ...base, ...extra } as never, lines)

describe('sceneProblems', () => {
  it('is quiet about a good scene', () => {
    expect(check({ caption: [{ t: 1, until: 3, line: 'keeper.hi' }] })).toEqual([])
  })

  it('says a caption’s line was removed, or has nothing written, on that caption', () => {
    expect(check({ caption: [{ t: 1, until: 3, line: 'gone.line' }] })).toEqual([
      { track: 'caption', index: 0, words: 'This step’s words were removed.' },
    ])
    expect(check({ caption: [{ t: 1, until: 3, line: 'keeper.empty' }] })[0]?.words).toBe(
      'These words have nothing written yet.',
    )
  })

  it('says where two words on screen overlap, on the later one', () => {
    expect(
      check({
        caption: [
          { t: 1, until: 4.5, line: 'keeper.hi' },
          { t: 4, until: 6, line: 'keeper.hi' },
        ],
      }),
    ).toEqual([{ track: 'caption', index: 1, words: 'Two words on screen overlap from 4 s to 4.5 s.' }])
  })

  it('says a step is after the end', () => {
    expect(check({ fade: [{ t: 12, value: 1 }] })).toEqual([
      { track: 'fade', index: 0, words: 'This step comes after the end of the scene.' },
    ])
  })

  it('says a shot under a second is short, but keys at one time are a cut', () => {
    const cuts = [
      { t: 0, pos: [0, 1, 0], look: [1, 1, 0] },
      { t: 0.5, pos: [0, 1, 0], look: [1, 1, 0], cut: true },
      { t: 5, pos: [0, 1, 0], look: [1, 1, 0], cut: true },
    ]
    expect(check({ camera: cuts })).toEqual([
      { track: 'camera', index: 0, words: 'This shot is shorter than a second.' },
    ])
    const same = [cuts[0], { ...cuts[1], t: 0 }, cuts[2]]
    expect(check({ camera: same })).toEqual([])
  })
})
