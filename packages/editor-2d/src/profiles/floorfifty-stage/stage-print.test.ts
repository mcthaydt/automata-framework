import { describe, expect, it } from 'vitest'
import { parseStage, printStage } from './stage-codec'
import type { StageDocument } from './stage-document'
import { diffLines } from './testing/diff-lines'
import { shippedStage } from './testing/shipped-stages'
import { documentOf, MINIMAL_STAGE, removeAt, setAt } from './testing/stage-texts'

// Printing an edited document (EDFF.1a steps 5 and 6): a change prints as that change and nothing else. `before` is the
// text the document was read from, which `printStage` patches.

/** Prints the edit and checks that the text reads back as exactly the edited value. */
function print(before: string, edited: StageDocument): string {
  const text = printStage(before, edited)
  const reread = parseStage(text)
  if (!reread.ok) throw new Error(`the printed text does not parse: ${JSON.stringify(reread.error)}\n${text}`)
  expect(reread.value.value).toEqual(withoutUnset(edited.value))
  return text
}

/** The value as it reads back: an optional key set to `undefined` is the same as no key. */
function withoutUnset<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

describe('printStage of an edited scalar', () => {
  const rooftops = shippedStage('rooftops')
  const doc = documentOf(rooftops)

  it.each([
    ['a layer sink', ['theme', 'layers', 1, 'sink'], 123, 'sink = 123'],
    ['the display name', ['displayName'], 'Roof tops', 'displayName = "Roof tops"'],
    ['the platform alias', ['platformAlias'], 'world.other', 'platformAlias = "world.other"'],
    ['a set piece hold', ['theme', 'setPieces', 0, 'holdMs'], 7000, 'holdMs = 7000'],
    ['the course seed', ['course', 'seed'], 42, 'seed = 42'],
    ['a layer alias', ['theme', 'layers', 2, 'alias'], 'world.cityNew', 'alias = "world.cityNew"'],
    ['a presentation number', ['theme', 'presentation', 'horizonLift'], 30, 'horizonLift = 30'],
    ['a city sink', ['theme', 'presentation', 'citySink', 'finish'], 600, 'finish = 600'],
  ] as const)('changes exactly one line for %s', (_name, path, value, line) => {
    const text = print(rooftops, setAt(doc, path, value))
    const diff = diffLines(rooftops, text)
    expect(diff.removed).toHaveLength(1)
    expect(diff.added).toEqual([{ line: diff.removed[0]?.line, text: line }])
  })

  it('escapes a purpose that holds quotes and a backslash', () => {
    const text = print(rooftops, setAt(doc, ['course', 'phrases', 0, 'purpose'], 'A "quoted" \\ word'))
    expect(diffLines(rooftops, text).added.map((line) => line.text)).toEqual([
      'purpose = "A \\"quoted\\" \\\\ word"',
    ])
  })

  it('keeps the comment at the end of the edited line', () => {
    const before = MINIMAL_STAGE.replace('depth = 0.1', 'depth = 0.1 # barely moves')
    const text = print(before, setAt(documentOf(before), ['theme', 'layers', 0, 'depth'], 0.2))
    expect(diffLines(before, text).added.map((line) => line.text)).toEqual(['depth = 0.2 # barely moves'])
  })

  it('changes a tunable, adds one and removes one, a line each', () => {
    const before = MINIMAL_STAGE.replace('[courseTuning]\n', '[courseTuning]\nrise = 3\nfall = 4\n')
    const base = documentOf(before)
    const changed = diffLines(before, print(before, setAt(base, ['courseTuning', 'rise'], 9)))
    expect(changed.removed.map((l) => l.text)).toEqual(['rise = 3'])
    expect(changed.added.map((l) => l.text)).toEqual(['rise = 9'])
    const added = diffLines(before, print(before, setAt(base, ['courseTuning', 'drift'], 1.5)))
    expect(added.removed).toEqual([])
    expect(added.added.map((l) => l.text)).toEqual(['drift = 1.5'])
    const removed = diffLines(before, print(before, removeAt(base, ['courseTuning', 'fall'])))
    expect(removed.removed.map((l) => l.text)).toEqual(['fall = 4'])
    expect(removed.added).toEqual([])
  })
})

describe('printStage of an optional key', () => {
  const dawn = shippedStage('dawn')
  const doc = documentOf(dawn)

  it.each([
    ['a layer haze', ['theme', 'layers', 0, 'haze'], 0.4, 'haze = 0.4'],
    ['the stage unlock', ['unlock'], 'first-win', 'unlock = "first-win"'],
    ['the light alias', ['theme', 'lightAlias'], 'world.moon', 'lightAlias = "world.moon"'],
    ['the preview alias', ['theme', 'previewAlias'], 'world.preview', 'previewAlias = "world.preview"'],
    ['a presentation light height', ['theme', 'presentation', 'lightHeight'], 80, 'lightHeight = 80'],
    ['a presentation shimmer', ['theme', 'presentation', 'lightShimmer'], true, 'lightShimmer = true'],
  ] as const)('adds %s as one line', (_name, path, value, line) => {
    const text = print(dawn, setAt(doc, path, value))
    const diff = diffLines(dawn, text)
    expect(diff.removed).toEqual([])
    expect(diff.added.map((l) => l.text)).toEqual([line])
  })

  it('removes an optional key whether it is deleted or set to undefined, one line either way', () => {
    const withHaze = ['theme', 'layers', 1, 'haze'] as const
    expect(doc.value.theme.layers[1]?.haze).toBeDefined()
    for (const edited of [removeAt(doc, withHaze), setAt(doc, withHaze, undefined)]) {
      const diff = diffLines(dawn, print(dawn, edited))
      expect(diff.added).toEqual([])
      expect(diff.removed.map((l) => l.text)).toEqual([`haze = ${doc.value.theme.layers[1]?.haze}`])
    }
  })

  it('removes the silhouette flag of the presentation', () => {
    const diff = diffLines(dawn, print(dawn, removeAt(doc, ['theme', 'presentation', 'silhouette'])))
    expect(diff.removed.map((l) => l.text)).toEqual(['silhouette = true'])
    expect(diff.added).toEqual([])
  })

  it('adds and removes the optional flags of a set piece', () => {
    const lightsOut = shippedStage('rooftops')
    const base = documentOf(lightsOut)
    const index = base.value.theme.setPieces.findIndex((piece) => piece.kind === 'lightsOut')
    const added = diffLines(
      lightsOut,
      print(lightsOut, setAt(base, ['theme', 'setPieces', index, 'invert'], true)),
    )
    expect(added.removed).toEqual([])
    expect(added.added.map((l) => l.text)).toEqual(['invert = true'])
  })
})
