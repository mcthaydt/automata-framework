// The cutscene lint (M6.9a step 5, M6 spec §4.8, §6), from the source's `cutscene-lint` cases: a camera that leaves the map,
// an actor off the floor, a caption whose line does not exist or is shown too briefly, a sound or lamp that does not exist,
// a shot that is too short, dead air. The source's rules that read its renderer (ceiling, cut-away walls, sprite scale,
// back to camera, solid boxes) come with the renderer (CS-D3).
import { resolveMap } from '@automata/sectors/sim'
import clinicMapToml from '@automata/sectors/testing/fixtures/clinic.sector-map.toml?raw'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import type { CutsceneScript } from '../sim/index'
import { type LintWorld, lintCutscene, lintCutscenes, readingTime } from './lint'

const map = resolveMap(parse(clinicMapToml) as never)
const world = (over: Partial<LintWorld> = {}): LintWorld => ({
  map,
  text: { 'toy.a': 'The clock has stopped.', 'toy.b': 'Someone is at the door.' },
  sounds: new Set(['thud']),
  lamps: new Set(['hall']),
  anchor: (name) => (name === 'player' ? { x: 0, z: 3 } : undefined),
  ...over,
})
const CAP_A = { t: 0.2, until: 2.8, line: 'toy.a', speaker: 'ada' }
const CAP_B = { t: 3.2, until: 5.8, line: 'toy.b' }
/** A sound script in the clinic's hall: two shots, a caption in each, an actor crossing the floor. */
const GOOD: CutsceneScript = {
  id: 'good',
  duration: 6,
  camera: [
    { t: 0, pos: [0, 1.6, 5], look: [0, 1.2, 3] },
    { t: 3, pos: [1, 1.6, 5], look: [0, 1.2, 3], cut: true },
  ],
  actor: [
    { who: 'ada', t: 0, x: 0, z: 2.5, moving: true },
    { who: 'ada', t: 6, x: 0, z: 4, moving: true },
  ],
  caption: [CAP_A, CAP_B],
}
const rules = (s: CutsceneScript, w: LintWorld = world()) =>
  lintCutscene(s, w).map((f) => `${f.level} ${f.rule}`)

describe('lintCutscene', () => {
  it('passes a sound script', () => {
    expect(lintCutscene(GOOD, world())).toEqual([])
  })
  it('fails a script that runs too long, and a fade outside 0..1', () => {
    expect(rules({ ...GOOD, duration: 30 })).toContain('error duration')
    expect(rules({ ...GOOD, fade: [{ t: 1, value: 1.5 }] })).toEqual(['error fade'])
  })
  it('fails a caption whose line the locale lacks', () => {
    expect(rules({ ...GOOD, caption: [{ t: 0.2, until: 2.8, line: 'toy.zzz' }, CAP_B] })).toEqual([
      'error line',
    ])
  })
  it('fails a caption shown too briefly to read, or too long, or overlapping the one before', () => {
    expect(rules({ ...GOOD, caption: [{ ...CAP_A, until: 0.7 }, CAP_B] })).toContain('error reading')
    expect(rules({ ...GOOD, duration: 12, caption: [{ ...CAP_A, until: 9 }] })).toContain('error reading')
    expect(
      rules({
        ...GOOD,
        caption: [
          { ...CAP_A, until: 3.5 },
          { t: 3.2, until: 5.8, line: 'toy.b' },
        ],
      }),
    ).toContain('error overlap')
  })
  it('reads time as the longer of 1.2 s plus 0.06 s a character and 1 s plus 15 characters a second, at most 7 s', () => {
    expect(readingTime('x'.repeat(10))).toBeCloseTo(Math.max(1.2 + 0.6, 1 + 10 / 15))
    expect(readingTime('x'.repeat(500))).toBe(7)
  })
  it('fails a sound or a lamp the game does not have', () => {
    expect(rules({ ...GOOD, sound: [{ t: 1, kind: 'thud' }] })).toEqual([])
    expect(rules({ ...GOOD, sound: [{ t: 1, kind: 'boom' }] })).toEqual(['error sound'])
    expect(rules({ ...GOOD, light: [{ t: 1, lamp: 'hall', level: 0.5 }] })).toEqual([])
    expect(rules({ ...GOOD, light: [{ t: 1, lamp: 'attic', level: 0.5 }] })).toEqual(['error lamp'])
  })
  it('fails a shot shorter than a second', () => {
    expect(
      rules({
        ...GOOD,
        camera: [
          { t: 0, pos: [0, 1.6, 5], look: [0, 1.2, 3] },
          { t: 0.5, pos: [1, 1.6, 5], look: [0, 1.2, 3], cut: true },
        ],
      }),
    ).toContain('error cut')
  })
  it('fails dead air: a stretch with nothing said, moving or changing', () => {
    const still: CutsceneScript = { id: 'still', duration: 6, camera: GOOD.camera.slice(0, 1) as never }
    expect(rules(still)).toEqual(['error dead'])
  })
  it('fails a camera outside the map, and one against a wall', () => {
    const at = (pos: [number, number, number]): CutsceneScript => ({
      ...GOOD,
      camera: [{ t: 0, pos, look: [0, 1.2, 3] }],
    })
    expect(rules(at([40, 1.6, 40]))).toContain('error camera')
    expect(rules(at([4.8, 1.6, 3]))).toContain('error camera')
  })
  it('fails an actor off the floor, and one in a wall, unless the key may pass through', () => {
    const stand = (x: number, z: number, through = false): CutsceneScript => ({
      ...GOOD,
      actor: [
        { who: 'ada', t: 0, x, z, moving: true, ...(through ? { through: true } : {}) },
        { who: 'ada', t: 6, x, z: z + 0.01, moving: true, ...(through ? { through: true } : {}) },
      ],
    })
    expect(rules(stand(40, 40))).toContain('error floor')
    expect(rules(stand(4.8, 3))).toContain('error wall')
    expect(rules(stand(40, 40, true))).toEqual([])
  })
  it('places an actor at an anchor, and fails an anchor the scene does not have', () => {
    const at = (name: string): CutsceneScript => ({
      ...GOOD,
      actor: [
        { who: 'ada', t: 0, at: name, moving: true },
        { who: 'ada', t: 6, x: 0, z: 4, moving: true },
      ],
    })
    expect(rules(at('player'))).toEqual([])
    expect(rules(at('actor:nurse'))).toEqual(['error anchor'])
  })
  it('lets a script break a rule it names, with the reason, only where allowed', () => {
    const still: CutsceneScript = {
      id: 'still',
      duration: 6,
      camera: GOOD.camera.slice(0, 1) as never,
      lintAllow: [{ rule: 'dead', reason: 'a held beat' }],
    }
    expect(rules(still)).toEqual([])
  })
})

describe('lintCutscenes', () => {
  it('lints every script and names the one each finding is in', () => {
    const found = lintCutscenes([GOOD, { ...GOOD, id: 'long', duration: 30 }], world())
    expect(found.map((f) => `${f.cutscene} ${f.rule}`)).toContain('long duration')
    expect(found.every((f) => f.cutscene !== 'good')).toBe(true)
  })
})
