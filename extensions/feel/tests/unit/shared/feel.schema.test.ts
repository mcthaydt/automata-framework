// The `feel` content kind (M6.1a step 1, M6 spec §4.1): `feel.toml`'s limits and entries, checked at their paths, and the
// warnings for a value above a limit (the runtime clamps it too).
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LIMITS, feelSchema, limitWarnings, resolveLimits } from '#src/shared/feel.schema.ts'

const SPEC_EXAMPLE = `
[limits]
shake_px = 3
hit_stop_ms = 120
flash_frames = 3
flash_alpha = 0.85

[springs]
squash = { f = 4, zeta = 0.35, r = 0 }

[[entry]]
on = "slam"
camera = [{ shake = 0.6 }]
pose = [{ hit_stop_ms = 90, target = "subject" }]
visual = [{ flash = "white", frames = 2 }, { squash = 0.35 }]
word = [{ key = "feel.word.slam", at = "subject" }]
haptic = [{ strong = 0.6, weak = 0.4, ms = 90, phone_ms = 18 }]
audio = [{ cue = "slam" }]
`
const paths = (value: unknown) => {
  const r = feelSchema.safeParse(value)
  return r.success ? [] : r.error.issues.map((i) => i.path)
}

describe('feelSchema', () => {
  it('parses the spec’s example', () => {
    expect(paths(parse(SPEC_EXAMPLE))).toEqual([])
  })
  it('parses an empty file: no limits set, no entries', () => {
    expect(paths({})).toEqual([])
  })
  it('fails an entry with no `on`, two entries for one `on`, and an unknown channel row', () => {
    expect(paths({ entry: [{ camera: [{ shake: 0.5 }] }] })).toEqual([['entry', 0, 'on']])
    expect(paths({ entry: [{ on: 'slam' }, { on: 'slam' }] })).toEqual([['entry', 1, 'on']])
    expect(paths({ entry: [{ on: 'slam', camera: [{ wobble: 1 }] }] })).toEqual([
      ['entry', 0, 'camera', 0, 'shake'],
      ['entry', 0, 'camera', 0],
    ])
  })
  it('fails a trauma outside 0..1, a rumble outside 0..1, and a flash of no frames', () => {
    expect(paths({ entry: [{ on: 'a', camera: [{ shake: 1.5 }] }] })).toEqual([
      ['entry', 0, 'camera', 0, 'shake'],
    ])
    expect(paths({ entry: [{ on: 'a', haptic: [{ strong: 2, weak: 0, ms: 10 }] }] })).toEqual([
      ['entry', 0, 'haptic', 0, 'strong'],
    ])
    expect(paths({ entry: [{ on: 'a', visual: [{ flash: 'white', frames: 0 }] }] })).toEqual([
      ['entry', 0, 'visual', 0, 'frames'],
    ])
  })
  it('fails a word that is a literal rather than a key, a spring with no frequency and an unknown field', () => {
    expect(paths({ entry: [{ on: 'a', word: [{ key: '' }] }] })).toEqual([['entry', 0, 'word', 0, 'key']])
    expect(paths({ springs: { squash: { f: 0, zeta: 0.3, r: 0 } } })).toEqual([['springs', 'squash', 'f']])
    expect(paths({ colour: 'red' })).toEqual([[]])
  })
})

describe('limits', () => {
  it('default to the spec’s, and the file’s override them one by one', () => {
    expect(DEFAULT_LIMITS).toEqual({ shake_px: 3, hit_stop_ms: 120, flash_frames: 3, flash_alpha: 0.85 })
    expect(resolveLimits({ limits: { shake_px: 5 } })).toEqual({ ...DEFAULT_LIMITS, shake_px: 5 })
    expect(resolveLimits({})).toEqual(DEFAULT_LIMITS)
  })
  it('warn for each value above a limit, naming the entry', () => {
    const feel = {
      entry: [
        { on: 'slam', pose: [{ hit_stop_ms: 400 }], visual: [{ flash: 'white', frames: 9, alpha: 1 }] },
        { on: 'ok', pose: [{ hit_stop_ms: 100 }] },
      ],
    }
    expect(limitWarnings(feel)).toEqual([
      'entry slam: hit_stop_ms 400 is above the limit 120',
      'entry slam: flash frames 9 is above the limit 3',
      'entry slam: flash alpha 1 is above the limit 0.85',
    ])
  })
})
