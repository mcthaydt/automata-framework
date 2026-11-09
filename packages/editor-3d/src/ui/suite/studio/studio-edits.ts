import type { ContentEdit } from '@automataframework/automata-editor/kit/documents'
import type {
  Ease,
  EffectorId,
  FigureClipDef,
  FigureDef,
  MaskGroup,
  PoseDef,
  Vec3,
} from '@automataframework/automata-figures'

// The Studio's typed edits (EDS.9a to EDS.9c; editor suite spec §6.2): each turns a figure, a pose or a clip and a
// person's change into the content edits that make it (span-preserving: only the literals it names move), or into the
// sentence for why it cannot be made. The figures schemas still judge the result when the session writes it; these
// refuse what a person can see is wrong (a key onto another key, a length before a key) in words of their own.

/** The edits that make a change, or why it cannot be made. */
export type TypedEdit = { readonly edits: readonly ContentEdit[] } | { readonly message: string }

const no = (message: string): TypedEdit => ({ message })
const edits = (...list: ContentEdit[]): TypedEdit => ({ edits: list })

/** The number as a person reads it in seconds: `0.4`, not `0.4000000001`. */
const seconds = (t: number): string => String(Math.round(t * 1e6) / 1e6)

// --- figures ---------------------------------------------------------------------------------------------------

/** A slider by its path under `sliders`: `['height']` or `['face', 'jaw']`. Writes the value, creating the face table. */
export function sliderEdit(figure: FigureDef, path: readonly string[], value: number): TypedEdit {
  const keyPath = ['sliders', ...path]
  const sliders = figure.sliders as Readonly<Record<string, unknown>>
  if (path.length === 1) {
    const [id] = path as [string]
    const old = sliders[id]
    return typeof old === 'number'
      ? edits({ keyPath, expected: old, set: value })
      : edits({ keyPath, insert: value })
  }
  const [group, id] = path as [string, string]
  const table = sliders[group] as Readonly<Record<string, unknown>> | undefined
  if (table === undefined) return edits({ keyPath: ['sliders', group], insert: { [id]: value } })
  const old = table[id]
  return typeof old === 'number'
    ? edits({ keyPath, expected: old, set: value })
    : edits({ keyPath, insert: value })
}

/** A face slider put back to its default is not written (EDS-D16): the key goes. */
export function sliderReset(figure: FigureDef, path: readonly string[]): TypedEdit {
  const table = (figure.sliders as Readonly<Record<string, unknown>>)[path[0] ?? ''] as
    | Readonly<Record<string, unknown>>
    | undefined
  if (path.length !== 2 || table?.[path[1] ?? ''] === undefined) return edits()
  return edits({ keyPath: ['sliders', ...path], remove: true })
}

type FigureField = 'skin' | 'gait' | 'hand' | 'default' | 'stand' | 'rig'

/** Sets, adds or (with `undefined`) clears one of a figure's plain fields. */
export function figureFieldEdit(figure: FigureDef, key: FigureField, value: string | undefined): TypedEdit {
  const old = (figure as unknown as Readonly<Record<string, unknown>>)[key]
  if (value === undefined) return old === undefined ? edits() : edits({ keyPath: [key], remove: true })
  return old === undefined
    ? edits({ keyPath: [key], insert: value })
    : edits({ keyPath: [key], expected: old, set: value })
}

// --- poses -----------------------------------------------------------------------------------------------------

/** Moves a handle's target (`pos` or `rot`), adding the handle or the part when the pose has none. */
export function handleEdit(pose: PoseDef, handle: EffectorId, part: 'pos' | 'rot', value: Vec3): TypedEdit {
  const target = pose.effectors[handle] as Readonly<Record<string, unknown>> | undefined
  if (target === undefined) return edits({ keyPath: ['effectors', handle], insert: { [part]: [...value] } })
  const old = target[part]
  return old === undefined
    ? edits({ keyPath: ['effectors', handle, part], insert: [...value] })
    : edits({ keyPath: ['effectors', handle, part], expected: old, set: [...value] })
}

export function removeHandle(pose: PoseDef, handle: EffectorId): TypedEdit {
  return pose.effectors[handle] === undefined
    ? edits()
    : edits({ keyPath: ['effectors', handle], remove: true })
}

// --- clips -----------------------------------------------------------------------------------------------------

const outside = (clip: FigureClipDef, t: number): TypedEdit | undefined =>
  t < 0 || t > clip.length
    ? no(`${seconds(t)} s is outside the clip (0 to ${seconds(clip.length)} s)`)
    : undefined

/** A key at the playhead, in time order; the first and last keys stay at the ends. */
export function addKey(clip: FigureClipDef, t: number, pose: string, ease?: Ease): TypedEdit {
  const wrong = outside(clip, t)
  if (wrong) return wrong
  if (t === 0) return no('the first key stays at 0 s')
  if (t === clip.length) return no(`the last key stays at the clip’s length, ${seconds(clip.length)} s`)
  if (clip.keys.some((key) => key.t === t)) return no(`there is already a key at ${seconds(t)} s`)
  const at = clip.keys.findIndex((key) => key.t > t)
  const key = { t, pose, ...(ease === undefined ? {} : { ease: Array.isArray(ease) ? [...ease] : ease }) }
  return edits({ keyPath: ['keys'], insert: key, at })
}

/** Moves an inner key between its neighbours. */
export function moveKey(clip: FigureClipDef, index: number, t: number): TypedEdit {
  const key = clip.keys[index]
  const before = clip.keys[index - 1]
  const after = clip.keys[index + 1]
  if (key === undefined) return no(`there is no key ${index}`)
  if (before === undefined || after === undefined)
    return no('the first and last keys keep their times; change the length instead')
  if (!(t > before.t && t < after.t))
    return no(
      `key ${index} stays between key ${index - 1} (${seconds(before.t)} s) and key ${index + 1} (${seconds(after.t)} s)`,
    )
  return edits({ keyPath: ['keys', index, 't'], expected: key.t, set: t })
}

export function setKeyPose(clip: FigureClipDef, index: number, pose: string): TypedEdit {
  const key = clip.keys[index]
  if (key === undefined) return no(`there is no key ${index}`)
  return edits({ keyPath: ['keys', index, 'pose'], expected: key.pose, set: pose })
}

/** The ease into a key; `undefined` clears it (linear). */
export function setKeyEase(clip: FigureClipDef, index: number, ease: Ease | undefined): TypedEdit {
  const key = clip.keys[index]
  if (key === undefined) return no(`there is no key ${index}`)
  const keyPath = ['keys', index, 'ease']
  const value = Array.isArray(ease) ? [...ease] : ease
  if (ease === undefined) return key.ease === undefined ? edits() : edits({ keyPath, remove: true })
  return key.ease === undefined
    ? edits({ keyPath, insert: value })
    : edits({ keyPath, expected: Array.isArray(key.ease) ? [...key.ease] : key.ease, set: value })
}

export function removeKey(clip: FigureClipDef, index: number): TypedEdit {
  if (index <= 0 || index >= clip.keys.length - 1) return no('the first and last keys stay')
  return edits({ keyPath: ['keys', index], remove: true })
}

/** The length, with the last key moving to it (a clip's last key is at its length). */
export function setLength(clip: FigureClipDef, length: number): TypedEdit {
  const last = clip.keys.at(-1)
  const before = clip.keys.at(-2)
  if (last === undefined || before === undefined) return no('a clip has two keys at least')
  if (!(length > before.t)) return no(`the length must be after the key at ${seconds(before.t)} s`)
  return edits(
    { keyPath: ['length'], expected: clip.length, set: length },
    { keyPath: ['keys', clip.keys.length - 1, 't'], expected: last.t, set: length },
  )
}

const plain = <T>(key: string, old: T | undefined, value: T | undefined): TypedEdit => {
  if (value === undefined) return old === undefined ? edits() : edits({ keyPath: [key], remove: true })
  return old === undefined
    ? edits({ keyPath: [key], insert: value })
    : edits({ keyPath: [key], expected: old, set: value })
}

/** The clip's own settings. */
export const clipEdits = {
  loop: (clip: FigureClipDef, value: FigureClipDef['loop']): TypedEdit => plain('loop', clip.loop, value),
  mode: (clip: FigureClipDef, value: 'override' | 'additive' | undefined): TypedEdit =>
    plain('mode', clip.mode, value),
  rate: (clip: FigureClipDef, value: number | undefined): TypedEdit => plain('rate', clip.rate, value),
  mask(clip: FigureClipDef, groups: readonly MaskGroup[]): TypedEdit {
    if (groups.length === 0) return no('a clip owns at least one body group')
    return edits({ keyPath: ['mask'], expected: [...clip.mask], set: [...groups] })
  },
}

/** A marker's time, adding the marker (or the markers table) when needed. */
export function setMarker(clip: FigureClipDef, name: string, t: number): TypedEdit {
  const wrong = outside(clip, t)
  if (wrong) return wrong
  if (clip.markers === undefined) return edits({ keyPath: ['markers'], insert: { [name]: t } })
  const old = clip.markers[name]
  return old === undefined
    ? edits({ keyPath: ['markers', name], insert: t })
    : edits({ keyPath: ['markers', name], expected: old, set: t })
}

export function removeMarker(clip: FigureClipDef, name: string): TypedEdit {
  if (clip.markers?.[name] === undefined) return edits()
  // The last marker takes its table with it, so no empty `[markers]` stays behind.
  return Object.keys(clip.markers).length === 1
    ? edits({ keyPath: ['markers'], remove: true })
    : edits({ keyPath: ['markers', name], remove: true })
}

export function addCue(clip: FigureClipDef, t: number, id: string): TypedEdit {
  const wrong = outside(clip, t)
  if (wrong) return wrong
  if (id.trim() === '') return no('a cue needs a name')
  // An array of tables cannot be inserted at a new key after the `[[keys]]` tables (the patcher fails), so the array is
  // added empty and the cue goes into it.
  if (clip.cues === undefined)
    return edits({ keyPath: ['cues'], insert: [] }, { keyPath: ['cues'], insert: { t, id }, at: 0 })
  const at = clip.cues.findIndex((cue) => cue.t > t)
  return edits({ keyPath: ['cues'], insert: { t, id }, at: at < 0 ? clip.cues.length : at })
}

export function removeCue(clip: FigureClipDef, index: number): TypedEdit {
  if (clip.cues?.[index] === undefined) return no(`there is no cue ${index}`)
  return clip.cues.length === 1
    ? edits({ keyPath: ['cues'], remove: true })
    : edits({ keyPath: ['cues', index], remove: true })
}
