import { describe, expect, it } from 'vitest'
import { counterIds, type IdSource } from '../../model/ids'
import { addCourse, addExtension, setPhrase, setSeed } from './commands/course-edits'
import {
  renameStage,
  setAmbienceAlias,
  setBackdropAlias,
  setCourseTuning,
  setLight,
  setPlatformAlias,
  setPreviewAlias,
  setStageId,
  setUnlock,
} from './commands/identity-edits'
import { addLayer, moveLayer, removeLayer, setLayerField } from './commands/layer-edits'
import { addSetPiece, removeSetPiece, type SetPieceField, setSetPieceField } from './commands/piece-edits'
import { setCitySink, setPresentation } from './commands/presentation-edits'
import { floorFiftyStage } from './floorfifty-stage'
import { NEW_STAGE_TEXT } from './new-stage'
import type { PhraseName, StageLayer, StageSetPiece, StageValue } from './stage.schema'
import { PHRASE_NAMES } from './stage.schema'
import { checkStage } from './stage-checks'
import { printStage } from './stage-codec'
import type { StageDocument } from './stage-document'
import { emptyTemplate } from './templates/stage-templates'
import { artAliases } from './testing/check-docs'
import { diffLines } from './testing/diff-lines'
import { SHIPPED_STAGE_IDS, type ShippedStageId, shippedStage } from './testing/shipped-stages'
import { documentOf } from './testing/stage-texts'

// The FloorFifty acceptance cases that need no screen (EDFF.1d step 9, spec §15). FF-o rebuilds the four stages from an
// empty one through the editor's own commands and compares the value with the file's; the screens only call the same
// commands, so a field no command reaches would fail here before any view exists.

const FRESH: IdSource = counterIds(1000)

const LAYER_FIELDS = ['alias', 'plate', 'depth', 'sink', 'haze', 'extend', 'arc', 'drift'] as const

/** Every layer starts blank and gets every field of the target the way the inspector would set it. */
function withLayer(document: StageDocument, target: StageLayer): StageDocument {
  const blank: StageLayer = { alias: 'blank', plate: 'sky', depth: 0, sink: 0, extend: 'none' }
  let next = addLayer(document, FRESH, blank)
  const index = next.value.theme.layers.length - 1
  for (const field of LAYER_FIELDS) next = setLayerField(next, index, field, target[field] as never)
  return next
}

const PIECE_FIELDS: readonly SetPieceField[] = [
  'holdMs',
  'invert',
  'mood',
  'stay',
  'particle',
  'density',
  'layers',
  'flashes',
  'tone',
  'kick',
  'speed',
]

function withPiece(document: StageDocument, target: StageSetPiece): StageDocument {
  let next = addSetPiece(document, FRESH, target.kind, target.floor)
  const index = next.ids.setPieces.findIndex((id) => !document.ids.setPieces.includes(id))
  for (const field of PIECE_FIELDS) {
    if (field in target) next = setSetPieceField(next, index, field, (target as never)[field])
  }
  return next
}

/** The stage `target` says, made from the Empty template by commands alone. */
function rebuild(target: StageValue): StageDocument {
  let document = emptyTemplate.create(FRESH)
  document = setStageId(document, target.id)
  document = renameStage(document, target.displayName)
  document = setUnlock(document, target.unlock)
  document = setPlatformAlias(document, target.platformAlias)
  document = setBackdropAlias(document, target.theme.backdropAlias)
  document = setLight(document, target.theme.lightAlias)
  document = setPreviewAlias(document, target.theme.previewAlias)
  document = setAmbienceAlias(document, target.theme.ambienceAlias)
  for (const [name, value] of Object.entries(target.courseTuning))
    document = setCourseTuning(document, name, value)

  for (const layer of target.theme.layers) document = withLayer(document, layer)
  document = removeLayer(document, 0)

  const { presentation } = target.theme
  if (presentation !== undefined) {
    document = setPresentation(document, 'refractionIntensity', presentation.refractionIntensity)
    document = setPresentation(document, 'horizonLift', presentation.horizonLift)
    document = setPresentation(document, 'lightHeight', presentation.lightHeight)
    document = setPresentation(document, 'lightShimmer', presentation.lightShimmer)
    document = setPresentation(document, 'silhouette', presentation.silhouette)
    if (presentation.citySink !== undefined)
      for (const phrase of PHRASE_NAMES)
        document = setCitySink(document, phrase, presentation.citySink[phrase])
  }

  const { course } = target
  if (course !== undefined) {
    document = addCourse(document, FRESH, { seed: 0, top: 19, tallest: 19 })
    document = setSeed(document, course.seed)
    for (const phrase of course.phrases) {
      const name: PhraseName = phrase.name
      document = setPhrase(document, name, 'fromFloor', phrase.fromFloor)
      document = setPhrase(document, name, 'toFloor', phrase.toFloor)
      document = setPhrase(document, name, 'purpose', phrase.purpose)
    }
    for (const entry of course.extension ?? []) document = addExtension(document, FRESH, entry)
  }

  for (const piece of target.theme.setPieces) document = withPiece(document, piece)
  return document
}

describe('FF-o, the model half: the four stages rebuilt from an empty one by commands alone', () => {
  for (const id of SHIPPED_STAGE_IDS) {
    it(`${id} equals the shipped file's value`, () => {
      const shipped = documentOf(shippedStage(id))
      const rebuilt = rebuild(shipped.value)
      expect(rebuilt.value).toStrictEqual(shipped.value)
    })

    it(`${id} prints to a file that reads back as itself, and the checks accept it`, () => {
      const shipped = documentOf(shippedStage(id))
      const rebuilt = rebuild(shipped.value)
      const text = printStage(NEW_STAGE_TEXT, rebuilt)
      expect(documentOf(text).value).toStrictEqual(shipped.value)
      expect(checkStage(rebuilt, { aliases: artAliases() })).toEqual([])
    })
  }
})

describe('FF-c: remove a layer, add a set piece, reorder two layers', () => {
  const id: ShippedStageId = 'rooftops'
  const base = shippedStage(id)
  const comments = (text: string): string[] =>
    text.split('\n').filter((line) => line.trimStart().startsWith('#'))

  it('reads back as the expected value and keeps every other comment', () => {
    const original = documentOf(base)
    const layers = original.value.theme.layers
    const index = (alias: string): number => layers.findIndex((layer) => layer.alias === alias)

    const removed = removeLayer(original, index('world.birds'))
    const added = addSetPiece(removed, counterIds(), 'lightsOut', 30)
    const details = added.value.theme.layers.findIndex((layer) => layer.alias === 'world.rooftopDetails')
    const reordered = moveLayer(added, details, details + 1)

    const text = printStage(base, reordered)
    expect(documentOf(text).value).toEqual(reordered.value)

    const kept = comments(text)
    const gone = comments(base).filter((line) => !kept.includes(line))
    // Only the removed layer's own comment goes (the paragraph that leads its table).
    expect(gone).toEqual([
      '# A few far birds, a touch nearer than the clouds and drifting a little faster',
      '# against them: the one moving thing in an otherwise still dawn.',
    ])
    expect(kept.every((line) => comments(base).includes(line))).toBe(true)
    expect(kept).toHaveLength(comments(base).length - gone.length)
  })

  it('undoes to the original bytes: the first document prints to the base', () => {
    const original = documentOf(base)
    const step1 = removeLayer(original, 3)
    const step2 = addSetPiece(step1, counterIds(), 'lightsOut', 30)
    const step3 = moveLayer(step2, 0, 1)
    for (const document of [step1, step2, step3]) expect(printStage(base, document)).not.toBe(base)
    // Undo hands back the documents the edits started from, in reverse.
    expect(printStage(base, original)).toBe(base)
    expect(printStage(base, removeSetPiece(step2, step2.value.theme.setPieces.length - 1))).not.toBe(base)
    expect(diffLines(base, printStage(base, step1)).added).toEqual([])
  })
})

describe('FF-a, through the profile: open each shipped stage, change nothing, export', () => {
  it('writes the input back byte for byte', () => {
    for (const id of SHIPPED_STAGE_IDS) {
      const text = shippedStage(id)
      const parsed = floorFiftyStage.parse(text)
      if (!parsed.ok) throw new Error(`${id} did not open`)
      const [file] = floorFiftyStage.exports[0]?.files(parsed.value, text) ?? []
      expect(file?.contents, id).toBe(text)
    }
  })
})
