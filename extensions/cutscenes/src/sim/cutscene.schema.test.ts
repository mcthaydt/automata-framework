// The `cutscene` content kind (M6.9a step 1): a script as data. Each bad reference is reported at its path, so the content
// compiler names the file and line.
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { cutsceneSchema } from './cutscene.schema'

const paths = (value: unknown) => {
  const r = cutsceneSchema.safeParse(value)
  return r.success ? [] : r.error.issues.map((i) => i.path)
}
const SPEC_EXAMPLE = `
id = "night-nurse"
duration = 6
lens = 50
camera = [{ t = 0.0, pos = [1.0, 1.6, 4.0], look = [0.0, 1.2, 0.0], ease = "smooth" }]
actor = [{ who = "nurse", t = 0.0, at = "door.ward", facing = 4 }]
caption = [{ t = 1.2, until = 3.0, line = "clinic.nurse.03" }]
light = [{ t = 2.0, lamp = "ward.ceiling", level = 0.2 }]
`
const base = {
  id: 'toy',
  duration: 4,
  camera: [{ t: 0, pos: [0, 1.6, 4], look: [0, 1.2, 0] }],
}

describe('cutsceneSchema', () => {
  it('parses the spec’s example, an actor placed at an anchor', () => {
    expect(paths(parse(SPEC_EXAMPLE))).toEqual([])
  })
  it('parses an actor placed at a point, with its pose and a caption’s speaker', () => {
    expect(
      paths({
        ...base,
        actor: [{ who: 'ada', t: 0, x: 1, z: 2, facing: 0.5, pose: 'look', frame: 2, moving: true }],
        caption: [{ t: 0, until: 2, line: 'toy.a', speaker: 'ada' }],
        shake: [[1, 2, 0.05]],
        fade: [{ t: 0, value: 1 }],
        flicker: [[1, 1.5]],
        states: [{ t: 2, state: 'cabinet.open' }],
        sound: [{ t: 1, kind: 'thud' }],
        lintAllow: [{ rule: 'dead', reason: 'a held beat' }],
      }),
    ).toEqual([])
  })
  it('fails a script with no camera key, or a camera key with a short position', () => {
    expect(paths({ ...base, camera: [] })).toEqual([['camera']])
    expect(paths({ ...base, camera: [{ t: 0, pos: [0, 1], look: [0, 1, 0] }] })).toEqual([
      ['camera', 0, 'pos'],
    ])
  })
  it('fails a caption that ends before it starts', () => {
    expect(paths({ ...base, caption: [{ t: 2, until: 1, line: 'toy.a' }] })).toEqual([
      ['caption', 0, 'until'],
    ])
  })
  it('fails an actor placed neither at an anchor nor at a point, or both', () => {
    expect(paths({ ...base, actor: [{ who: 'ada', t: 0 }] })).toEqual([['actor', 0]])
    expect(paths({ ...base, actor: [{ who: 'ada', t: 0, x: 1, z: 2, at: 'player' }] })).toEqual([
      ['actor', 0],
    ])
    expect(paths({ ...base, actor: [{ who: 'ada', t: 0, x: 1 }] })).toEqual([['actor', 0]])
  })
  it('fails keys out of time order, a negative duration and an unknown field', () => {
    expect(
      paths({
        ...base,
        camera: [
          { t: 2, pos: [0, 0, 0], look: [0, 0, 0] },
          { t: 1, pos: [0, 0, 0], look: [0, 0, 0] },
        ],
      }),
    ).toEqual([['camera', 1, 't']])
    expect(
      paths({
        ...base,
        actor: [
          { who: 'a', t: 2, x: 0, z: 0 },
          { who: 'a', t: 1, x: 0, z: 0 },
        ],
      }),
    ).toEqual([['actor', 1, 't']])
    expect(paths({ ...base, duration: -1 })).toEqual([['duration']])
    expect(paths({ ...base, colour: 'red' })).toEqual([[]])
  })
})
