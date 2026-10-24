import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { checkReferences } from './check-references'
import { resolveContext } from './check-types'
import type { StageDocument } from './stage-document'
import { layer, minimal, withLayers, withPieces } from './testing/check-docs'
import { SHIPPED_STAGE_IDS, shippedStage } from './testing/shipped-stages'
import { documentOf, setAt } from './testing/stage-texts'

// Names the stage uses (EDFF.1b decision 3 and §10.7): asset aliases against the loaded art manifest, and the layers a
// set piece names against the layers the stage draws.

const MANIFEST: readonly string[] = JSON.parse(
  readFileSync(new URL('./testing/art-aliases.json', import.meta.url), 'utf8'),
)
const aliases = new Set(MANIFEST)
/** The names the minimal stage uses, plus the layers the set-piece cases draw. */
const KNOWN = new Set(['world.platform', 'world.sky', 'sky.birds', 'city.near'])

const error = (code: string, path: string, message: string, fix?: string) => ({
  severity: 'error',
  code,
  path,
  message,
  ...(fix === undefined ? {} : { fix }),
})

const check = (document: StageDocument, known: ReadonlySet<string> | null = aliases) =>
  checkReferences(document, resolveContext({ aliases: known ?? undefined }))

describe('the art manifest fixture', () => {
  it('holds 304 aliases', () => {
    expect(MANIFEST).toHaveLength(304)
  })
})

describe('asset aliases', () => {
  it.each(SHIPPED_STAGE_IDS)('knows every alias of %s', (id) => {
    expect(check(documentOf(shippedStage(id)))).toEqual([])
  })

  it('says once that nothing is checked when no manifest is loaded', () => {
    expect(check(documentOf(shippedStage('rooftops')), null)).toEqual([
      {
        severity: 'info',
        code: 'aliasesUnchecked',
        path: '',
        message: 'No art manifest is loaded, so asset aliases are not checked.',
      },
    ])
  })

  it.each([
    ['platformAlias', ['platformAlias'], 'world.platfrom', 'world.platform'],
    ['theme.backdropAlias', ['theme', 'backdropAlias'], 'world.dawnsky', 'world.dawnSky'],
    ['theme.ambienceAlias', ['theme', 'ambienceAlias'], 'ambience.dawm', 'ambience.dawn'],
  ] as const)('finds a misspelt %s and suggests the near one', (path, field, wrong, right) => {
    const found = check(setAt(documentOf(shippedStage('dawn')), field, wrong))
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ severity: 'error', code: 'unknownAssetAlias', path })
    expect(found[0]?.message).toBe(`"${wrong}" is not in the art manifest. Did you mean "${right}"?`)
  })

  it('checks the light and the select-screen still when they are named', () => {
    const rooftops = documentOf(shippedStage('rooftops'))
    const lit = setAt(
      setAt(rooftops, ['theme', 'lightAlias'], 'light.nonesuch'),
      ['theme', 'previewAlias'],
      'preview.nonesuch',
    )
    expect(check(lit).map((f) => f.path)).toEqual(['theme.lightAlias', 'theme.previewAlias'])
    const unlit = setAt(
      setAt(rooftops, ['theme', 'lightAlias'], undefined),
      ['theme', 'previewAlias'],
      undefined,
    )
    expect(check(unlit)).toEqual([])
  })

  it('finds a layer alias by the layer’s id, with no suggestion when nothing is near', () => {
    const base = documentOf(shippedStage('dawn'))
    const found = check(setAt(base, ['theme', 'layers', 1, 'alias'], 'completely.unrelated.zzzzzzzz'))
    expect(found).toEqual([
      error(
        'unknownAssetAlias',
        'theme.layers[b1].alias',
        '"completely.unrelated.zzzzzzzz" is not in the art manifest.',
      ),
    ])
  })

  it('does not call an empty alias unknown: the shape check already says it is empty', () => {
    expect(check(setAt(documentOf(shippedStage('dawn')), ['platformAlias'], ''))).toEqual([])
  })
})

describe('the suggestions in a message', () => {
  const known = (...names: string[]) => new Set(['world.sky', ...names])

  it('lists two as “a or b” and three as “a, b or c”', () => {
    expect(check(minimal(), known('world.platfor1', 'world.platfor2'))[0]?.message).toBe(
      '"world.platform" is not in the art manifest. Did you mean "world.platfor1" or "world.platfor2"?',
    )
    expect(check(minimal(), known('world.platfor1', 'world.platfor2', 'world.platfor3'))[0]?.message).toBe(
      '"world.platform" is not in the art manifest. Did you mean "world.platfor1", "world.platfor2" or "world.platfor3"?',
    )
  })
})

describe('layers a set piece names', () => {
  const swarm = (layers: string[]) => ({ floor: 12, kind: 'swarm', holdMs: 4000, speed: 6, layers }) as never

  const stage = (layers: string[]): StageDocument => {
    const base = withLayers([layer('sky.birds', 'sky', 0.2), layer('city.near', 'city', 0.5)])
    const pieces = withPieces([swarm(layers)])
    return {
      ...pieces,
      value: { ...pieces.value, theme: { ...pieces.value.theme, layers: base.value.theme.layers } },
      ids: { ...pieces.ids, layers: base.ids.layers },
    }
  }

  it('accepts names the stage draws', () => {
    expect(check(stage(['sky.birds', 'city.near']), KNOWN)).toEqual([])
  })

  it('finds a name the stage does not draw, by its place in the list, with the repair', () => {
    expect(check(stage(['sky.birds', 'city.gone']), KNOWN)).toEqual([
      error(
        'unknownReference',
        'theme.setPieces[b0].layers[1]',
        'The swarm piece at floor 12 names "city.gone", which this stage does not draw.',
        'remove-name',
      ),
    ])
  })

  it('checks a weather burst’s optional list and leaves a missing list alone', () => {
    const burst = { floor: 20, holdMs: 3000, kind: 'weatherBurst', particle: 'rain', density: 0.5 } as const
    const base = withLayers([layer('sky.birds', 'sky', 0.2)])
    const document = (piece: unknown) => {
      const pieces = withPieces([piece as never])
      return {
        ...pieces,
        value: { ...pieces.value, theme: { ...pieces.value.theme, layers: base.value.theme.layers } },
        ids: { ...pieces.ids, layers: base.ids.layers },
      }
    }
    expect(check(document(burst), KNOWN)).toEqual([])
    expect(check(document({ ...burst, layers: ['nope'] }), KNOWN)).toHaveLength(1)
  })

  it('does not call an empty name unknown, and reports them whether or not a manifest is loaded', () => {
    expect(check(stage(['']), null).map((f) => f.code)).toEqual(['aliasesUnchecked'])
    expect(check(stage(['gone']), null).map((f) => f.code)).toEqual(['unknownReference', 'aliasesUnchecked'])
  })

  it('has no pieces to check in a stage without any', () => {
    expect(check(minimal(), KNOWN)).toEqual([])
  })
})
