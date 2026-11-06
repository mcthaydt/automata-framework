// The Studio's typed edits (EDS.9a to EDS.9c): each one turns a figure, a pose or a clip and a person's change into the
// content edits that make it, or into the sentence for why it cannot be made. Every result is applied here to the
// fixture files and read back through the figures schemas, so an edit that makes a file the game would refuse fails.
import { openDocument } from '@mcthaydt/automata-editor/kit/documents'
import { describe, expect, it } from 'vitest'
import { readStudioContent } from './studio-content'
import {
  addCue,
  addKey,
  clipEdits,
  figureFieldEdit,
  handleEdit,
  moveKey,
  removeHandle,
  removeKey,
  removeMarker,
  setKeyEase,
  setKeyPose,
  setLength,
  setMarker,
  sliderEdit,
  sliderReset,
  type TypedEdit,
} from './studio-edits'
import { studioFixtureFiles } from './testing/studio-fixtures'

const files = studioFixtureFiles()
const content = readStudioContent(Object.entries(files).map(([path, text]) => ({ path, text })))
const wick = content.figures[0]?.value as NonNullable<(typeof content.figures)[number]['value']>
const stand = content.poses.find((entry) => entry.id === 'stand')?.value as NonNullable<
  (typeof content.poses)[number]['value']
>
const roll = content.clips.find((entry) => entry.id === 'roll')?.value as NonNullable<
  (typeof content.clips)[number]['value']
>
const WICK = 'content/figures/wick.toml'
const STAND = 'content/figure-poses/stand.toml'
const ROLL = 'content/figure-clips/roll.toml'

/** Applies a typed edit to a fixture file and reads the result back; the new value, or the problem. */
function apply(path: string, edit: TypedEdit, text: string = files[path] as string) {
  if ('message' in edit) return { problem: edit.message }
  const result = openDocument(path, text).edit(edit.edits)
  if (!result.ok) return { problem: result.message }
  const next = readStudioContent(
    Object.entries({ ...files, [path]: result.document.text }).map(([p, text]) => ({ path: p, text })),
  )
  return { text: result.document.text, problems: next.problems, content: next }
}

describe('figure edits', () => {
  it('sets a body slider, and writes a face slider into the face table, creating it', () => {
    const body = apply(WICK, sliderEdit(wick, ['height'], 132))
    expect(body.text).toContain('height = 132')
    expect(body.problems).toEqual([])
    const face = apply(WICK, sliderEdit(wick, ['face', 'jaw'], 0.7))
    expect(face.content?.figures[0]?.value?.sliders.face?.jaw).toBe(0.7)
    expect(face.problems).toEqual([])
    const jawed = face.content?.figures[0]?.value as typeof wick
    const more = apply(WICK, sliderEdit(jawed, ['face', 'chin'], 0.3), face.text)
    expect(more.content?.figures[0]?.value?.sliders.face).toEqual({ jaw: 0.7, chin: 0.3 })
    const reset = apply(WICK, sliderReset(jawed, ['face', 'jaw']), face.text)
    expect(reset.content?.figures[0]?.value?.sliders.face?.jaw).toBeUndefined()
  })

  it('refuses a slider outside its range with the schema’s own sentence', () => {
    const result = apply(WICK, sliderEdit(wick, ['height'], 300))
    expect(result.problems?.map((problem) => problem.message).join(' ')).toMatch(/height|240/)
  })

  it('sets, adds and clears a figure field', () => {
    expect(apply(WICK, figureFieldEdit(wick, 'hand', 'L')).text).toContain('hand = "L"')
    expect(apply(WICK, figureFieldEdit(wick, 'stand', 'hand-on-hip')).content?.figures[0]?.value?.stand).toBe(
      'hand-on-hip',
    )
    expect(
      apply(WICK, figureFieldEdit(wick, 'rig', undefined)).content?.figures[0]?.value?.rig,
    ).toBeUndefined()
  })
})

describe('pose edits', () => {
  it('moves a handle, adds one, and removes one', () => {
    const moved = apply(STAND, handleEdit(stand, 'handL', 'pos', [0.3, 0.8, 0.1]))
    expect(moved.content?.poses.find((p) => p.id === 'stand')?.value?.effectors?.handL?.pos).toEqual([
      0.3, 0.8, 0.1,
    ])
    const added = apply(STAND, handleEdit(stand, 'footL', 'pos', [0.1, 0.08, 0.3]))
    expect(added.problems).toEqual([])
    expect(added.content?.poses.find((p) => p.id === 'stand')?.value?.effectors?.footL?.pos).toEqual([
      0.1, 0.08, 0.3,
    ])
    const turned = apply(STAND, handleEdit(stand, 'chest', 'rot', [4, 0, 0]))
    expect(turned.text).toContain('rot = [ 4, 0, 0 ]')
    const removed = apply(STAND, removeHandle(stand, 'chest'))
    expect(removed.content?.poses.find((p) => p.id === 'stand')?.value?.effectors?.chest).toBeUndefined()
  })
})

describe('clip edits', () => {
  it('adds a key at the playhead in time order, with an ease', () => {
    const result = apply(ROLL, addKey(roll, 0.2, 'guard-high', 'out'))
    expect(result.problems).toEqual([])
    expect(result.content?.clips.find((c) => c.id === 'roll')?.value?.keys.map((key) => key.t)).toEqual([
      0, 0.12, 0.2, 0.28, 0.4,
    ])
  })

  it('refuses a key on an existing key, at an end, or outside the clip, in words', () => {
    expect(addKey(roll, 0.12, 'stand')).toEqual({ message: 'there is already a key at 0.12 s' })
    expect(addKey(roll, 0, 'stand')).toEqual({ message: 'the first key stays at 0 s' })
    expect(addKey(roll, 0.4, 'stand')).toEqual({ message: 'the last key stays at the clip’s length, 0.4 s' })
    expect(addKey(roll, 0.9, 'stand')).toEqual({ message: '0.9 s is outside the clip (0 to 0.4 s)' })
  })

  it('moves an inner key between its neighbours, and refuses past them or an end key', () => {
    expect(
      apply(ROLL, moveKey(roll, 1, 0.2)).content?.clips.find((c) => c.id === 'roll')?.value?.keys[1]?.t,
    ).toBe(0.2)
    expect(moveKey(roll, 1, 0.3)).toEqual({ message: 'key 1 stays between key 0 (0 s) and key 2 (0.28 s)' })
    expect(moveKey(roll, 0, 0.1)).toEqual({
      message: 'the first and last keys keep their times; change the length instead',
    })
  })

  it('sets a key’s pose and ease, and clears the ease', () => {
    expect(apply(ROLL, setKeyPose(roll, 1, 'guard-high')).text).toContain('pose = "guard-high"')
    expect(apply(ROLL, setKeyEase(roll, 1, [0.4, 0, 0.2, 1])).problems).toEqual([])
    expect(apply(ROLL, setKeyEase(roll, 1, 'inOut')).text).toContain('ease = "inOut"')
    const cleared = apply(ROLL, setKeyEase(roll, 1, undefined))
    expect(cleared.content?.clips.find((c) => c.id === 'roll')?.value?.keys[1]?.ease).toBeUndefined()
  })

  it('removes an inner key, and keeps two keys', () => {
    expect(
      apply(ROLL, removeKey(roll, 2)).content?.clips.find((c) => c.id === 'roll')?.value?.keys,
    ).toHaveLength(3)
    expect(removeKey(roll, 0)).toEqual({ message: 'the first and last keys stay' })
    const two = { ...roll, keys: [roll.keys[0], roll.keys[3]] } as typeof roll
    expect(removeKey(two, 1)).toEqual({ message: 'the first and last keys stay' })
  })

  it('changes the length by moving the last key with it, and refuses a length before the key before it', () => {
    const longer = apply(ROLL, setLength(roll, 0.5))
    const clip = longer.content?.clips.find((c) => c.id === 'roll')?.value
    expect([clip?.length, clip?.keys.at(-1)?.t]).toEqual([0.5, 0.5])
    expect(setLength(roll, 0.28)).toEqual({ message: 'the length must be after the key at 0.28 s' })
  })

  it('sets loop, mode and the mask, and refuses an empty mask', () => {
    expect(apply(ROLL, clipEdits.loop(roll, 'loop')).text).toContain('loop = "loop"')
    expect(apply(ROLL, clipEdits.mode(roll, 'additive')).text).toContain('mode = "additive"')
    expect(apply(ROLL, clipEdits.mask(roll, ['torso', 'head'])).problems).toEqual([])
    expect(clipEdits.mask(roll, [])).toEqual({ message: 'a clip owns at least one body group' })
  })

  it('adds, moves and removes a marker and a cue, inside the clip', () => {
    const marked = apply(ROLL, setMarker(roll, 'contact', 0.2))
    expect(marked.content?.clips.find((c) => c.id === 'roll')?.value?.markers).toEqual({ contact: 0.2 })
    expect(setMarker(roll, 'contact', 0.5)).toEqual({ message: '0.5 s is outside the clip (0 to 0.4 s)' })
    const withMarker = marked.content?.clips.find((c) => c.id === 'roll')?.value as typeof roll
    const unmarked = apply(ROLL, removeMarker(withMarker, 'contact'), marked.text)
    expect(unmarked.content?.clips.find((c) => c.id === 'roll')?.value?.markers).toBeUndefined()
    expect(
      apply(ROLL, addCue(roll, 0.1, 'dust')).content?.clips.find((c) => c.id === 'roll')?.value?.cues,
    ).toEqual([{ t: 0.1, id: 'dust' }])
  })
})
