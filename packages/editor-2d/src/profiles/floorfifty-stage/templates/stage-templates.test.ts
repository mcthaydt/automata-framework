import { describe, expect, it } from 'vitest'
import { counterIds } from '../../../model/ids'
import { NEW_STAGE_TEXT } from '../new-stage'
import { checkStage } from '../stage-checks'
import { printStage } from '../stage-codec'
import { artAliases } from '../testing/check-docs'
import { documentOf } from '../testing/stage-texts'
import { emptyTemplate, simpleCityTemplate, skyOnlyTemplate } from './stage-templates'

// The three starting points of "New stage" (EDFF.1d step 7): each is a valid stage, with ids from the injected source.

const TEMPLATES = [emptyTemplate, skyOnlyTemplate, simpleCityTemplate]
const manifest = (): ReadonlySet<string> => artAliases()

describe('the templates', () => {
  it('are called Empty, Sky only and Simple city', () => {
    expect(TEMPLATES.map((template) => [template.id, template.label])).toEqual([
      ['empty', 'Empty'],
      ['sky-only', 'Sky only'],
      ['simple-city', 'Simple city'],
    ])
  })

  for (const template of TEMPLATES) {
    describe(template.label, () => {
      it('has no error and no warning, with the art manifest loaded', () => {
        const document = template.create(counterIds())
        expect(checkStage(document, { aliases: manifest() })).toEqual([])
      })

      it('has only the note that aliases are not checked, without a manifest', () => {
        const findings = checkStage(template.create(counterIds()))
        expect(findings.map((finding) => finding.code)).toEqual(['aliasesUnchecked'])
      })

      it('numbers every element from the source, each id once', () => {
        const document = template.create(counterIds())
        const all = [...document.ids.extension, ...document.ids.layers, ...document.ids.setPieces]
        expect(new Set(all).size).toBe(all.length)
        expect([...all].sort()).toEqual(all.map((_, index) => (index + 1).toString(36).padStart(8, '0')))
        expect(document.ids.layers).toHaveLength(document.value.theme.layers.length)
        expect(document.ids.extension).toHaveLength(document.value.course?.extension?.length ?? 0)
      })

      it('is the same document for the same source, and another for another', () => {
        expect(template.create(counterIds())).toEqual(template.create(counterIds()))
        expect(template.create(counterIds(50)).ids.layers[0]).not.toBe(
          template.create(counterIds()).ids.layers[0],
        )
      })

      it('prints against the text of a new stage and reads back as itself', () => {
        const document = template.create(counterIds())
        const text = printStage(NEW_STAGE_TEXT, document)
        expect(documentOf(text).value).toEqual(document.value)
      })
    })
  }

  it('Empty is the smallest valid stage: one sky plate and nothing else', () => {
    const { value } = emptyTemplate.create(counterIds())
    expect(value.theme.layers).toEqual([
      { alias: 'world.rooftopsSky', plate: 'sky', depth: 0.06, sink: 200, extend: 'plate' },
    ])
    expect(value.course).toBeUndefined()
    expect(value.theme.lightAlias).toBeUndefined()
    expect(value.theme.presentation).toBeUndefined()
    expect(value.theme.setPieces).toEqual([])
  })

  it('write down the layers of Sky only and Simple city, value for value', () => {
    const plate = { alias: 'world.rooftopsSky', plate: 'sky', depth: 0.06, sink: 200, extend: 'plate' }
    const clouds = {
      alias: 'world.clouds',
      plate: 'sky',
      depth: 0.06,
      sink: -140,
      extend: 'none',
      drift: 1.5,
    }
    const far = { alias: 'world.cityFar', plate: 'city', depth: 0.15, sink: 240, haze: 0.25, extend: 'skirt' }
    const near = { alias: 'world.cityNear', plate: 'city', depth: 0.35, sink: 290, haze: 0, extend: 'skirt' }
    expect(skyOnlyTemplate.create(counterIds()).value.theme.layers).toEqual([plate, clouds])
    expect(simpleCityTemplate.create(counterIds()).value.theme.layers).toEqual([plate, clouds, far, near])
  })

  it('Sky only adds the sun and a band of clouds', () => {
    const { value } = skyOnlyTemplate.create(counterIds())
    expect(value.theme.lightAlias).toBe('world.sun')
    expect(value.theme.layers.map((layer) => [layer.alias, layer.plate])).toEqual([
      ['world.rooftopsSky', 'sky'],
      ['world.clouds', 'sky'],
    ])
    expect(value.course).toBeUndefined()
  })

  it('Simple city adds two skylines, the presentation and a course on the default climb', () => {
    const { value } = simpleCityTemplate.create(counterIds())
    expect(value.theme.layers.map((layer) => layer.alias)).toEqual([
      'world.rooftopsSky',
      'world.clouds',
      'world.cityFar',
      'world.cityNear',
    ])
    expect(value.theme.presentation).toEqual({
      profile: 'aquarian',
      refractionIntensity: 0.45,
      horizonLift: 12,
    })
    expect(value.course?.seed).toBe(35229)
    expect(value.course?.phrases.at(-1)?.toFloor).toBe(19)
    expect(value.course?.extension).toEqual([{ fromFloor: 20, toFloor: 49, purpose: expect.any(String) }])
  })

  it('the text of a new stage is the Empty template, id for id', () => {
    const fromText = documentOf(NEW_STAGE_TEXT).value
    expect(fromText).toEqual(emptyTemplate.create(counterIds()).value)
  })
})
