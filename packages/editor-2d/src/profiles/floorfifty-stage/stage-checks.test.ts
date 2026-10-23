import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { checkStage } from './stage-checks'
import { layer, minimal, PHRASES, withCourse, withLayers } from './testing/check-docs'
import { SHIPPED_STAGE_IDS, shippedStage } from './testing/shipped-stages'
import { documentOf, setAt } from './testing/stage-texts'

// The runner (EDFF.1b): every source of findings, in one list, errors first (acceptance FF-o: the shipped stages open
// with zero errors).

const aliases = new Set<string>(
  JSON.parse(readFileSync(new URL('./testing/art-aliases.json', import.meta.url), 'utf8')),
)

describe('the shipped stages', () => {
  it.each(SHIPPED_STAGE_IDS)('open with no finding at all when the art manifest is loaded: %s', (id) => {
    expect(checkStage(documentOf(shippedStage(id)), { aliases })).toEqual([])
  })

  it.each(SHIPPED_STAGE_IDS)(
    'open with only the note that aliases are unchecked when it is not: %s',
    (id) => {
      expect(
        checkStage(documentOf(shippedStage(id))).map((finding) => `${finding.severity} ${finding.code}`),
      ).toEqual(['info aliasesUnchecked'])
    },
  )
})

describe('checkStage', () => {
  it('collects the findings of every source, errors first', () => {
    const document = setAt(
      setAt(withCourse({ seed: 1, phrases: PHRASES.slice(0, 3) }), ['courseTuning'], { GRAVTY: 1 }),
      ['theme', 'layers'],
      withLayers([layer('a', 'city', 0.5), layer('a', 'city', 0.2)]).value.theme.layers,
    )
    const found = checkStage(document, { aliases: new Set(['world.platform', 'world.sky']) })
    expect(found.map((finding) => finding.code)).toEqual([
      'phraseOrder', // the shape of the course
      'duplicateAlias', // a layer rule
      'layerOrder',
      'floorsUnaccounted', // the course against the climb
      'extensionUnaccounted',
      'unknownAssetAlias', // the manifest, once for each of the two layers
      'unknownAssetAlias',
      'unknownTunable', // the tuning
    ])
    expect(found.every((finding) => finding.severity === 'error')).toBe(true)
  })

  it('lists a warning and an info after the errors', () => {
    const pieces = [
      { floor: 7, kind: 'skyFlash', holdMs: 500, flashes: 2, tone: 'aurora' },
      { floor: 7, kind: 'skyFlash', holdMs: 500, flashes: 2, tone: 'aurora' },
    ]
    const document = setAt(setAt(minimal(), ['theme', 'setPieces'], pieces), ['id'], 'Bad Id')
    expect(checkStage(document).map((finding) => `${finding.severity} ${finding.code}`)).toEqual([
      'error id',
      'warning flashRate',
      'info aliasesUnchecked',
    ])
  })

  it('judges the course against the base tuning and the tallest course it is given', () => {
    const document = withCourse({ seed: 1, phrases: PHRASES })
    expect(
      checkStage(document, { aliases: new Set(['world.platform', 'world.sky']) }).map((f) => f.code),
    ).toEqual(['extensionUnaccounted'])
    expect(
      checkStage(document, { aliases: new Set(['world.platform', 'world.sky']), tallestFloor: 19 }),
    ).toEqual([])
    expect(
      checkStage(document, {
        aliases: new Set(['world.platform', 'world.sky']),
        baseTuning: { COURSE_FLOOR_COUNT: 30 },
        tallestFloor: 29,
      }).map((f) => f.message),
    ).toEqual(['No phrase accounts for floors 20–29; every floor a player climbs needs a recorded purpose.'])
  })

  it('finds an override the schema would refuse as not a number, whatever the name', () => {
    for (const name of ['GRAVITY', 'GRAVTY', 'TICK_HZ'])
      expect(
        checkStage(setAt(minimal(), ['courseTuning'], { [name]: Number.NaN })).map(
          (f) => `${f.severity} ${f.path}`,
        ),
      ).toContain(`error courseTuning.${name}`)
  })

  it('includes the ranges of the set pieces', () => {
    const piece = { floor: 99, kind: 'lightsOut', holdMs: 1000 }
    expect(
      checkStage(setAt(minimal(), ['theme', 'setPieces'], [piece]), { aliases }).map((f) => f.code),
    ).toContain('setPieceRange')
  })

  it('finds nothing in a stage with the minimum a template starts from, apart from the unchecked note', () => {
    expect(checkStage(minimal()).map((finding) => finding.code)).toEqual(['aliasesUnchecked'])
  })
})
