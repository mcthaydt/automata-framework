import { describe, expect, it } from 'vitest'
import { counterIds } from '../../../model/ids'
import type { StageLayer } from '../stage.schema'
import { checkStage } from '../stage-checks'
import { printStage } from '../stage-codec'
import { layer, minimal, withLayers } from '../testing/check-docs'
import { diffLines } from '../testing/diff-lines'
import { shippedStage } from '../testing/shipped-stages'
import { documentOf, MINIMAL_STAGE } from '../testing/stage-texts'
import { addLayer, dragLayerSink, duplicateLayer, moveLayer, removeLayer, setLayerField } from './layer-edits'

// The Compose view's edits to the scenery (EDFF.1d step 3, spec §10.6). The file lists layers back to front, so the end
// of the list is the front; the panel shows it the other way round and the file does not change.

const three = (): ReturnType<typeof withLayers> =>
  withLayers([
    layer('world.sky', 'sky', 0.06, { extend: 'plate' }),
    layer('world.far', 'city', 0.15, { sink: 240 }),
    layer('world.near', 'city', 0.35, { sink: 290 }),
  ])

const aliases = (document: ReturnType<typeof three>): string[] =>
  document.value.theme.layers.map((entry) => entry.alias)

const rooftops = (): ReturnType<typeof documentOf> => documentOf(shippedStage('rooftops'))
const indexOfAlias = (document: ReturnType<typeof documentOf>, alias: string): number =>
  document.value.theme.layers.findIndex((entry) => entry.alias === alias)

const front: StageLayer = { alias: 'world.front', plate: 'city', depth: 0.5, sink: 100, extend: 'none' }

describe('addLayer', () => {
  it('adds the layer in front, with an id from the source', () => {
    const before = three()
    const after = addLayer(before, counterIds(), front)
    expect(aliases(after)).toEqual(['world.sky', 'world.far', 'world.near', 'world.front'])
    expect(after.ids.layers).toEqual(['b0', 'b1', 'b2', '00000001'])
  })

  it('adds at an index, with the id at the same index', () => {
    const after = addLayer(three(), counterIds(), front, 1)
    expect(aliases(after)).toEqual(['world.sky', 'world.front', 'world.far', 'world.near'])
    expect(after.ids.layers).toEqual(['b0', '00000001', 'b1', 'b2'])
  })

  it('adds at the very back', () => {
    const after = addLayer(three(), counterIds(), front, 0)
    expect(aliases(after)[0]).toBe('world.front')
    expect(after.ids.layers[0]).toBe('00000001')
  })

  it('refuses an index outside 0 to the length', () => {
    for (const at of [-1, 4, 1.5])
      expect(() => addLayer(three(), counterIds(), front, at), String(at)).toThrow(RangeError)
  })

  it('takes one id and leaves the other lists and the document it was given alone', () => {
    const before = three()
    const source = counterIds()
    const after = addLayer(before, source, front)
    expect(source.next()).toBe('00000002')
    expect(after.ids.extension).toBe(before.ids.extension)
    expect(after.ids.setPieces).toBe(before.ids.setPieces)
    expect(before.value.theme.layers).toHaveLength(3)
    expect(before.ids.layers).toEqual(['b0', 'b1', 'b2'])
  })

  it('refuses an id the document already has', () => {
    expect(() => addLayer(three(), { next: () => 'b1' }, front)).toThrow(RangeError)
  })

  it('prints as a new table after the layers, and reads back as the edited value', () => {
    const before = shippedStage('rooftops')
    const edited = addLayer(rooftops(), counterIds(), front)
    const text = printStage(before, edited)
    expect(documentOf(text).value).toEqual(edited.value)
    expect(diffLines(before, text).removed).toEqual([])
    expect(diffLines(before, text).added.map((line) => line.text)).toContain('alias = "world.front"')
  })
})

describe('removeLayer', () => {
  it('removes the layer and its id, and the others keep theirs', () => {
    const after = removeLayer(three(), 1)
    expect(aliases(after)).toEqual(['world.sky', 'world.near'])
    expect(after.ids.layers).toEqual(['b0', 'b2'])
  })

  it('may remove the last layer; the checks then say the stage has none', () => {
    const only = withLayers([layer('world.sky', 'sky', 0.06, { extend: 'plate' })])
    const after = removeLayer(only, 0)
    expect(after.value.theme.layers).toEqual([])
    expect(checkStage(after).map((finding) => finding.code)).toContain('noLayers')
  })

  it('refuses a layer that is not there', () => {
    for (const index of [-1, 3, 0.5])
      expect(() => removeLayer(three(), index), String(index)).toThrow(RangeError)
  })

  it('prints the removal of a table and its comment, and nothing else', () => {
    const before = shippedStage('rooftops')
    const edited = removeLayer(rooftops(), indexOfAlias(rooftops(), 'world.birds'))
    const text = printStage(before, edited)
    expect(documentOf(text).value).toEqual(edited.value)
    const diff = diffLines(before, text)
    expect(diff.added).toEqual([])
    expect(diff.removed.map((line) => line.text)).toContain('alias = "world.birds"')
    expect(diff.removed.map((line) => line.text)).toContain(
      '# A few far birds, a touch nearer than the clouds and drifting a little faster',
    )
  })
})

describe('duplicateLayer', () => {
  it('puts a copy in front of the original, with a new id', () => {
    const before = three()
    const after = duplicateLayer(before, counterIds(), 1)
    expect(aliases(after)).toEqual(['world.sky', 'world.far', 'world.far', 'world.near'])
    expect(after.ids.layers).toEqual(['b0', 'b1', '00000001', 'b2'])
    expect(after.value.theme.layers[2]).toEqual(before.value.theme.layers[1])
  })

  it('leaves the alias twice, which the checks report as the next thing to fix', () => {
    const after = duplicateLayer(three(), counterIds(), 1)
    const codes = checkStage(after).map((finding) => finding.code)
    expect(codes).toContain('duplicateAlias')
  })

  it('refuses a layer that is not there, and an id the document already has', () => {
    expect(() => duplicateLayer(three(), counterIds(), 3)).toThrow(RangeError)
    expect(() => duplicateLayer(three(), { next: () => 'b2' }, 1)).toThrow(RangeError)
  })
})

describe('moveLayer', () => {
  it('moves a layer to an index, and its id goes with it', () => {
    const after = moveLayer(three(), 2, 1)
    expect(aliases(after)).toEqual(['world.sky', 'world.near', 'world.far'])
    expect(after.ids.layers).toEqual(['b0', 'b2', 'b1'])
    const forward = moveLayer(three(), 0, 2)
    expect(aliases(forward)).toEqual(['world.far', 'world.near', 'world.sky'])
    expect(forward.ids.layers).toEqual(['b1', 'b2', 'b0'])
  })

  it('is the same document when the layer stays', () => {
    const before = three()
    expect(moveLayer(before, 1, 1)).toBe(before)
  })

  it('refuses an index that is not there, from or to', () => {
    expect(() => moveLayer(three(), 3, 0)).toThrow(RangeError)
    expect(() => moveLayer(three(), 0, 3)).toThrow(RangeError)
    expect(() => moveLayer(three(), -1, 0)).toThrow(RangeError)
  })

  it('breaks the depth order when a layer passes a nearer one: the checks say where', () => {
    const after = moveLayer(three(), 2, 1)
    const finding = checkStage(after).find((entry) => entry.code === 'layerOrder')
    expect(finding?.path).toBe('theme.layers[b1].depth')
    expect(finding?.fix).toBe('reorder-layers')
  })

  it('prints a swap of two layers of one depth as the same two tables in the other order', () => {
    const before = shippedStage('rooftops')
    const details = indexOfAlias(rooftops(), 'world.rooftopDetails')
    const edited = moveLayer(rooftops(), details, details + 1)
    expect(edited.value.theme.layers.slice(details).map((entry) => entry.alias)).toEqual([
      'world.rooftopProps',
      'world.rooftopDetails',
    ])
    const text = printStage(before, edited)
    expect(documentOf(text).value).toEqual(edited.value)
    expect(text.indexOf('world.rooftopProps')).toBeLessThan(text.indexOf('world.rooftopDetails'))
  })
})

describe('setLayerField', () => {
  it('sets each field of one layer and leaves the other layers as they were', () => {
    const before = three()
    const cases: [keyof StageLayer, never][] = [
      ['alias', 'world.renamed' as never],
      ['plate', 'sky' as never],
      ['depth', 0.2 as never],
      ['sink', 10 as never],
      ['haze', 0.5 as never],
      ['extend', 'tile' as never],
      ['arc', 0.1 as never],
      ['drift', 1 as never],
    ]
    for (const [field, value] of cases) {
      const after = setLayerField(before, 1, field, value)
      expect(after.value.theme.layers[1]?.[field], field).toBe(value)
      expect(after.value.theme.layers[0], field).toBe(before.value.theme.layers[0])
      expect(after.value.theme.layers[2], field).toBe(before.value.theme.layers[2])
      expect(after.ids, field).toBe(before.ids)
    }
  })

  it('drops an optional field when given undefined', () => {
    const hazy = setLayerField(three(), 1, 'haze', 0.4)
    const after = setLayerField(hazy, 1, 'haze', undefined)
    expect('haze' in (after.value.theme.layers[1] ?? {})).toBe(false)
    expect(after.value).toEqual(three().value)
  })

  it('is the same document for the value it has', () => {
    const before = three()
    expect(setLayerField(before, 1, 'sink', 240)).toBe(before)
    expect(setLayerField(before, 1, 'haze', undefined)).toBe(before)
  })

  it('refuses a layer that is not there', () => {
    expect(() => setLayerField(three(), 3, 'sink', 1)).toThrow(RangeError)
  })

  it('leaves a value out of range for the checks to report', () => {
    const after = setLayerField(three(), 1, 'depth', 2)
    expect(checkStage(after).some((finding) => finding.code === 'layerRange')).toBe(true)
  })

  it('prints a changed sink as the one line that holds it (FF-b)', () => {
    const before = shippedStage('rooftops')
    const at = indexOfAlias(rooftops(), 'world.rooftopsHorizon')
    const text = printStage(before, setLayerField(rooftops(), at, 'sink', 160))
    const diff = diffLines(before, text)
    expect(diff.removed.map((line) => line.text)).toEqual(['sink = 150'])
    expect(diff.added.map((line) => line.text)).toEqual(['sink = 160'])
  })
})

describe('dragLayerSink', () => {
  it('moves the sink by the delta, in whole units', () => {
    expect(dragLayerSink(three(), 1, 10).value.theme.layers[1]?.sink).toBe(250)
    expect(dragLayerSink(three(), 1, -10.4).value.theme.layers[1]?.sink).toBe(230)
    expect(dragLayerSink(three(), 1, 10.5).value.theme.layers[1]?.sink).toBe(251)
  })

  it('is the same document for no movement, or a movement that rounds to none', () => {
    const before = three()
    expect(dragLayerSink(before, 1, 0)).toBe(before)
    expect(dragLayerSink(before, 1, 0.3)).toBe(before)
  })

  it('never writes a negative zero', () => {
    const level = withLayers([layer('world.sky', 'sky', 0.06, { extend: 'plate', sink: 0 })])
    expect(Object.is(dragLayerSink(level, 0, -0.4).value.theme.layers[0]?.sink, 0)).toBe(true)
  })

  it('does not clamp: a sink dragged out of range is a finding at once', () => {
    const after = dragLayerSink(three(), 2, 5000)
    expect(after.value.theme.layers[2]?.sink).toBe(5290)
    expect(checkStage(after).some((finding) => finding.code === 'layerRange')).toBe(true)
  })

  it('replays from the document the gesture began with, so a gesture is one step', () => {
    const start = three()
    const afterMoves = [3, 8, 14].map((delta) => dragLayerSink(start, 1, delta))
    expect(afterMoves.map((document) => document.value.theme.layers[1]?.sink)).toEqual([243, 248, 254])
  })

  it('refuses a delta that is not a number, and a layer that is not there', () => {
    expect(() => dragLayerSink(three(), 1, Number.NaN)).toThrow(RangeError)
    expect(() => dragLayerSink(three(), 1, Number.POSITIVE_INFINITY)).toThrow(RangeError)
    expect(() => dragLayerSink(three(), 3, 1)).toThrow(RangeError)
  })

  it('prints as one changed line', () => {
    const before = MINIMAL_STAGE
    const document = minimal()
    const text = printStage(before, dragLayerSink(document, 0, 40))
    expect(diffLines(before, text).added.map((line) => line.text)).toEqual(['sink = 40'])
    expect(diffLines(before, text).removed.map((line) => line.text)).toEqual(['sink = 0'])
  })
})
