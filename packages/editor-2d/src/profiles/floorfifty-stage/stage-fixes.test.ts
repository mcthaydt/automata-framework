import { describe, expect, it } from 'vitest'
import type { Diagnostic } from '../profile'
import { setPhrase } from './commands/course-edits'
import { setCourseTuning } from './commands/identity-edits'
import { moveLayer } from './commands/layer-edits'
import { checkStage } from './stage-checks'
import { applyStageFix } from './stage-fixes'
import { layer, PHRASES, withCourse, withLayers, withPieces } from './testing/check-docs'
import { shippedStage } from './testing/shipped-stages'
import { documentOf } from './testing/stage-texts'

// The one-step repairs the checks name (EDFF.1d step 6, spec §10.6 flows "Fix"): each takes the document and the finding
// and returns the next document, and applying it clears the finding.

const rooftops = (): ReturnType<typeof documentOf> => documentOf(shippedStage('rooftops'))
const codes = (document: ReturnType<typeof rooftops>): string[] =>
  checkStage(document).map((finding) => finding.code)
const finding = (document: ReturnType<typeof rooftops>, code: string): Diagnostic => {
  const found = checkStage(document).find((entry) => entry.code === code)
  if (found === undefined) throw new Error(`expected a ${code} finding`)
  return found
}
const aliases = (document: ReturnType<typeof rooftops>): string[] =>
  document.value.theme.layers.map((entry) => entry.alias)

describe('reorder-layers', () => {
  it('puts a layer that was moved in front of a nearer one back (FF-d)', () => {
    const before = rooftops()
    const mid = before.value.theme.layers.findIndex((entry) => entry.alias === 'world.cityMid')
    const near = before.value.theme.layers.findIndex((entry) => entry.alias === 'world.cityNear')
    const broken = moveLayer(before, mid, near)
    const reported = finding(broken, 'layerOrder')
    expect(reported.fix).toBe('reorder-layers')
    expect(reported.message).toContain('"world.cityMid"')
    const fixed = applyStageFix(broken, reported)
    expect(codes(fixed)).not.toContain('layerOrder')
    expect(fixed).toEqual(before)
  })

  it('clears every depth-order finding at once', () => {
    const jumbled = withLayers([
      layer('world.near', 'city', 0.35),
      layer('world.far', 'city', 0.15),
      layer('world.mid', 'city', 0.24),
    ])
    const reported = finding(jumbled, 'layerOrder')
    const fixed = applyStageFix(jumbled, reported)
    expect(aliases(fixed)).toEqual(['world.far', 'world.mid', 'world.near'])
    expect(fixed.ids.layers).toEqual(['b1', 'b2', 'b0'])
    expect(codes(fixed)).not.toContain('layerOrder')
  })

  it('keeps each plate in the slots it holds, so the drawing order across plates is the author’s', () => {
    const mixed = withLayers([
      layer('world.cityA', 'city', 0.3),
      layer('world.skyA', 'sky', 0.1),
      layer('world.cityB', 'city', 0.2),
      layer('world.skyB', 'sky', 0.05),
    ])
    const fixed = applyStageFix(mixed, finding(mixed, 'layerOrder'))
    expect(fixed.value.theme.layers.map((entry) => [entry.alias, entry.plate])).toEqual([
      ['world.cityB', 'city'],
      ['world.skyB', 'sky'],
      ['world.cityA', 'city'],
      ['world.skyA', 'sky'],
    ])
  })

  it('keeps layers of one depth in the order they have', () => {
    const tied = withLayers([
      layer('world.late', 'city', 0.35),
      layer('world.first', 'city', 0.2),
      layer('world.tie1', 'city', 0.35),
      layer('world.tie2', 'city', 0.35),
    ])
    const fixed = applyStageFix(tied, finding(tied, 'layerOrder'))
    expect(aliases(fixed)).toEqual(['world.first', 'world.late', 'world.tie1', 'world.tie2'])
  })

  it('is the same document when the layers are already in order', () => {
    const ordered = rooftops()
    const reported: Diagnostic = {
      severity: 'error',
      code: 'layerOrder',
      path: 'theme.layers[b1].depth',
      message: 'm',
      fix: 'reorder-layers',
    }
    expect(applyStageFix(ordered, reported)).toBe(ordered)
  })
})

describe('fit-phrases', () => {
  const short = (): ReturnType<typeof withCourse> =>
    setPhrase(
      withCourse({ seed: 1, phrases: PHRASES, extension: [{ fromFloor: 20, toFloor: 49, purpose: 'x' }] }),
      'finish',
      'toFloor',
      17,
    )

  it('stretches the phrases over the floors nobody claims, and clears the finding (FF-f)', () => {
    const before = short()
    const reported = finding(before, 'floorsUnaccounted')
    expect(reported.fix).toBe('fit-phrases')
    const fixed = applyStageFix(before, reported)
    expect(fixed.value.course?.phrases.at(-1)).toMatchObject({ name: 'finish', fromFloor: 15, toFloor: 19 })
    expect(codes(fixed)).not.toContain('floorsUnaccounted')
  })

  it('reads the top floor from the stage’s own COURSE_FLOOR_COUNT', () => {
    const before = setCourseTuning(short(), 'COURSE_FLOOR_COUNT', 25)
    const fixed = applyStageFix(before, finding(before, 'floorsUnaccounted'))
    expect(fixed.value.course?.phrases.at(-1)?.toFloor).toBe(24)
  })

  it('reads it from the base tuning of the context, under the stage’s own', () => {
    const before = short()
    const reported = finding(before, 'floorsUnaccounted')
    const fixed = applyStageFix(before, reported, { baseTuning: { COURSE_FLOOR_COUNT: 30 } })
    expect(fixed.value.course?.phrases.at(-1)?.toFloor).toBe(29)
    const own = setCourseTuning(short(), 'COURSE_FLOOR_COUNT', 25)
    const fixedOwn = applyStageFix(own, reported, { baseTuning: { COURSE_FLOOR_COUNT: 30 } })
    expect(fixedOwn.value.course?.phrases.at(-1)?.toFloor).toBe(24)
  })

  it('refuses when the course length is out of range: that is the finding to fix first', () => {
    const broken = setCourseTuning(short(), 'COURSE_FLOOR_COUNT', 5)
    const reported: Diagnostic = {
      severity: 'error',
      code: 'floorsUnaccounted',
      path: 'course.phrases',
      message: 'm',
      fix: 'fit-phrases',
    }
    expect(() => applyStageFix(broken, reported)).toThrow('COURSE_FLOOR_COUNT')
  })
})

describe('remove-name', () => {
  const pieces = (): ReturnType<typeof withPieces> =>
    withPieces([
      { floor: 10, holdMs: 5000, kind: 'swarm', layers: ['world.sky', 'world.gone', 'world.also'], speed: 8 },
      {
        floor: 20,
        holdMs: 5000,
        kind: 'weatherBurst',
        particle: 'rain',
        density: 0.5,
        layers: ['world.gone'],
      },
    ])
  const withSky = (document: ReturnType<typeof withPieces>): ReturnType<typeof withPieces> => ({
    ...document,
    value: {
      ...document.value,
      theme: { ...document.value.theme, layers: [layer('world.sky', 'sky', 0.06, { extend: 'plate' })] },
    },
    ids: { ...document.ids, layers: ['b0'] },
  })
  const unknown = (document: ReturnType<typeof withPieces>): Diagnostic[] =>
    checkStage(document).filter((entry) => entry.code === 'unknownReference')

  it('removes the name the finding points at and no other', () => {
    const before = withSky(pieces())
    const [first] = unknown(before)
    expect(first?.fix).toBe('remove-name')
    expect(first?.path).toBe('theme.setPieces[b0].layers[1]')
    const fixed = applyStageFix(before, first as Diagnostic)
    const piece = fixed.value.theme.setPieces[0]
    expect(piece?.kind === 'swarm' && piece.layers).toEqual(['world.sky', 'world.also'])
    expect(fixed.value.theme.setPieces[1]).toBe(before.value.theme.setPieces[1])
  })

  it('offers the next name at its new position', () => {
    const before = withSky(pieces())
    const once = applyStageFix(before, unknown(before)[0] as Diagnostic)
    const next = unknown(once)
    expect(next.map((entry) => entry.path)).toEqual([
      'theme.setPieces[b0].layers[1]',
      'theme.setPieces[b1].layers[0]',
    ])
    const twice = applyStageFix(once, next[0] as Diagnostic)
    const piece = twice.value.theme.setPieces[0]
    expect(piece?.kind === 'swarm' && piece.layers).toEqual(['world.sky'])
  })

  it('drops the layers of a weather burst that names nothing else, which means every layer', () => {
    const before = withSky(pieces())
    const burst = unknown(before).find((entry) => entry.path.startsWith('theme.setPieces[b1]'))
    const fixed = applyStageFix(before, burst as Diagnostic)
    expect('layers' in (fixed.value.theme.setPieces[1] ?? {})).toBe(false)
    expect(unknown(fixed).map((entry) => entry.path)).toEqual([
      'theme.setPieces[b0].layers[1]',
      'theme.setPieces[b0].layers[2]',
    ])
  })

  it('leaves a swarm with no layer, which the checks then report in its own words', () => {
    const lonely = withSky(
      withPieces([{ floor: 10, holdMs: 5000, kind: 'swarm', layers: ['world.gone'], speed: 8 }]),
    )
    const fixed = applyStageFix(lonely, unknown(lonely)[0] as Diagnostic)
    const piece = fixed.value.theme.setPieces[0]
    expect(piece?.kind === 'swarm' && piece.layers).toEqual([])
    expect(codes(fixed)).toContain('setPieceRange')
    expect(codes(fixed)).not.toContain('unknownReference')
  })

  it('refuses a piece or a position that is no longer there', () => {
    const before = withSky(pieces())
    const stale = (path: string): Diagnostic => ({
      severity: 'error',
      code: 'unknownReference',
      path,
      message: 'm',
      fix: 'remove-name',
    })
    expect(() => applyStageFix(before, stale('theme.setPieces[nope].layers[0]'))).toThrow('no longer')
    expect(() => applyStageFix(before, stale('theme.setPieces[b0].layers[7]'))).toThrow(RangeError)
    expect(() => applyStageFix(before, stale('theme.setPieces[b0].layers[3]'))).toThrow(RangeError)
    expect(() => applyStageFix(before, stale('somewhere.else'))).toThrow('cannot read')
  })
})

describe('refusals', () => {
  it('a finding with no repair, and a repair this profile does not know', () => {
    const document = rooftops()
    const none: Diagnostic = { severity: 'error', code: 'seedInvalid', path: 'course.seed', message: 'm' }
    expect(() => applyStageFix(document, none)).toThrow('no repair')
    expect(() => applyStageFix(document, { ...none, fix: 'make-it-better' })).toThrow('"make-it-better"')
  })
})
