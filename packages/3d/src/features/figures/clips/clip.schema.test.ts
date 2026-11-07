import { describe, expect, it } from 'vitest'
import { clipSchema, type FigureClipDef } from './clip.schema.ts'

/** The issues a parse fails with, as `path: message` lines. Content refs parse to markers, so ids here are plain. */
function issues(input: unknown): string[] {
  const result = clipSchema.safeParse(input)
  if (result.success) return []
  return result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
}

const full = {
  length: 0.5,
  loop: 'once',
  mask: ['armR', 'torso'],
  mode: 'additive',
  rate: 12,
  blend: { inMs: 80, outMs: 120 },
  keys: [
    { t: 0, pose: { effectors: { handR: { pos: [-0.2, 1.3, -0.1] } } } },
    { t: 0.3, pose: { effectors: { handR: { pos: [-0.1, 1.1, 0.5] } } }, ease: 'in' },
    { t: 0.5, pose: { effectors: { handR: { pos: [-0.2, 0.9, 0.3] } } }, ease: [0.3, 1.4, 0.6, 1] },
  ],
  markers: { windup: 0.1, contact: 0.3 },
  cues: [{ t: 0.3, id: 'swing' }],
} satisfies FigureClipDef

const withChange = (change: Record<string, unknown>): unknown => ({ ...full, ...change })

describe('clipSchema', () => {
  it('reads a clip that sets every field as written', () => {
    expect(clipSchema.parse(full)).toEqual(full)
  })
  it('refuses keys out of order, not starting at 0, not ending at the length, or fewer than two', () => {
    const [a, b, c] = full.keys
    // Out of order, and so also not ending at the length.
    expect(issues(withChange({ keys: [a, c, b] }))).toEqual([
      expect.stringMatching(/^keys\.2\.t: key 2 at 0.3 s is not after key 1/),
      expect.stringMatching(/^keys\.2\.t: the last key must be at the length/),
    ])
    expect(issues(withChange({ keys: [a, { ...b, t: 0 }, c] }))).toEqual([
      expect.stringMatching(/^keys\.1\.t: /),
    ])
    expect(issues(withChange({ keys: [{ ...a, t: 0.1 }, b, c] }))).toEqual([
      expect.stringMatching(/^keys\.0\.t: .*0/),
    ])
    expect(issues(withChange({ keys: [a, b, { ...c, t: 0.4 }] }))).toEqual([
      expect.stringMatching(/^keys\.2\.t: .*length/),
    ])
    expect(issues(withChange({ keys: [a] }))).not.toEqual([])
  })
  it('refuses an unknown or repeated mask group, and an empty mask', () => {
    expect(issues(withChange({ mask: ['armR', 'tail'] }))).toEqual([expect.stringMatching(/^mask\.1: /)])
    expect(issues(withChange({ mask: ['armR', 'armR'] }))).toEqual([
      expect.stringMatching(/^mask\.1: .*twice/),
    ])
    expect(issues(withChange({ mask: [] }))).not.toEqual([])
  })
  it('refuses a marker or a cue outside 0 to length', () => {
    expect(issues(withChange({ markers: { contact: 0.6 } }))).toEqual([
      expect.stringMatching(/^markers\.contact: /),
    ])
    expect(issues(withChange({ cues: [{ t: -0.1, id: 'swing' }] }))).toEqual([
      expect.stringMatching(/^cues\.0\.t: /),
    ])
  })
  it('refuses a length or rate that is not positive, a negative ramp, an unknown loop or mode', () => {
    expect(issues(withChange({ rate: 0 }))).toEqual([expect.stringMatching(/^rate: /)])
    expect(issues(withChange({ blend: { inMs: -1, outMs: 0 } }))).toEqual([
      expect.stringMatching(/^blend\.inMs: /),
    ])
    expect(issues(withChange({ loop: 'bounce' }))).toEqual([expect.stringMatching(/^loop: /)])
    expect(issues(withChange({ mode: 'mix' }))).toEqual([expect.stringMatching(/^mode: /)])
    expect(issues({ ...full, length: 0, keys: [full.keys[0], { ...full.keys[1], t: 0 }] })).not.toEqual([])
  })
  it('refuses a Bézier ease whose x leaves 0 to 1', () => {
    const [a, b, c] = full.keys
    expect(issues(withChange({ keys: [a, b, { ...c, ease: [1.2, 0, 0.5, 1] }] }))).toEqual([
      expect.stringMatching(/^keys\.2\.ease\.0: /),
    ])
  })
  it('checks an inline pose as a pose, at its own key', () => {
    const [a, b, c] = full.keys
    const bad = { ...b, pose: { effectors: { handX: { pos: [0, 1, 0] } } } }
    expect(issues(withChange({ keys: [a, bad, c] }))).toEqual([
      expect.stringMatching(/^keys\.1\.pose\.effectors: /),
    ])
  })
})
