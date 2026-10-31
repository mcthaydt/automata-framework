import type { SuitePorts } from '@mcthaydt/automata-editor-kit/ports'
import type { Ease, EffectorId, FigureClipDef, MaskGroup, PoseDef, Vec3 } from '@mcthaydt/automata-figures'
import { MASK_GROUPS } from '@mcthaydt/automata-figures'
import { type Readable, writable } from 'svelte/store'
import type { StudioContent } from './studio-content'
import {
  addCue,
  addKey,
  clipEdits,
  figureFieldEdit,
  handleEdit,
  moveKey,
  removeCue,
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
import { openStudio, type StudioOutcome, type StudioSession } from './studio-session'
import { createStudioView, type StudioView } from './studio-view'

// What a person does in the Studio (EDS.9a to EDS.9c): each action reads what is chosen, makes the typed edit (the
// sentence for why not, when it cannot be made), writes it through the session as one undo step and keeps a refusal
// in words until the next action. The components call these and draw what comes back; nothing here draws.

export interface StudioController {
  readonly session: StudioSession
  readonly view: StudioView
  /** The sentence for the last refused action; cleared by the next. */
  readonly refusal: Readable<string | undefined>
  /** Moves after every step, Undo and Redo: what a component re-reads `content()` on. */
  readonly revision: Readable<number>
  content(): StudioContent
  undo(): Promise<StudioOutcome>
  redo(): Promise<StudioOutcome>
  // look
  setSlider(path: readonly string[], value: number): Promise<StudioOutcome>
  resetSlider(path: readonly string[]): Promise<StudioOutcome>
  setFigureField(
    key: 'skin' | 'gait' | 'hand' | 'default' | 'stand' | 'rig',
    value: string | undefined,
  ): Promise<StudioOutcome>
  // pose
  dragHandle(handle: EffectorId, position: Vec3): void
  dropHandle(handle: EffectorId, position: Vec3): Promise<StudioOutcome>
  /** A turn of the chest or the head, in degrees. */
  setHandleTurn(handle: EffectorId, rot: Vec3): Promise<StudioOutcome>
  removeHandle(handle: EffectorId): Promise<StudioOutcome>
  cancelDrag(): void
  addPose(id: string): Promise<StudioOutcome>
  // animate
  addKeyAtPlayhead(): Promise<StudioOutcome>
  moveKey(index: number, t: number): Promise<StudioOutcome>
  setKeyPose(index: number, pose: string): Promise<StudioOutcome>
  setKeyEase(index: number, ease: Ease | undefined): Promise<StudioOutcome>
  removeKey(index: number): Promise<StudioOutcome>
  addClip(id: string): Promise<StudioOutcome>
  setClipLength(length: number): Promise<StudioOutcome>
  setClipLoop(loop: FigureClipDef['loop']): Promise<StudioOutcome>
  setClipMode(mode: 'override' | 'additive' | undefined): Promise<StudioOutcome>
  setClipMask(mask: readonly MaskGroup[]): Promise<StudioOutcome>
  setMarker(name: string, t: number): Promise<StudioOutcome>
  removeMarker(name: string): Promise<StudioOutcome>
  addCue(t: number, id: string): Promise<StudioOutcome>
  removeCue(index: number): Promise<StudioOutcome>
}

const ID = /^[a-z][a-z0-9-]*$/
const no = (message: string): StudioOutcome => ({ ok: false, message })

const dirOf = (entries: readonly { readonly path: string }[], fallback: string): string => {
  const path = entries[0]?.path
  return path === undefined ? fallback : path.slice(0, path.lastIndexOf('/'))
}

export async function createStudioController(ports: SuitePorts): Promise<StudioController> {
  const session = await openStudio(ports)
  const view = createStudioView(session.content())
  const refusal = writable<string | undefined>(undefined)
  const revision = writable(0)
  session.history.subscribe(() => {
    view.reconcile(session.content())
    revision.update((count) => count + 1)
  })
  const content = (): StudioContent => session.content()

  const say = (outcome: StudioOutcome): StudioOutcome => {
    refusal.set(outcome.ok ? undefined : outcome.message)
    return outcome
  }

  const figure = () => content().figures.find((entry) => entry.id === view.current.figure)
  const pose = () => content().poses.find((entry) => entry.id === view.current.pose)
  const clip = () => content().clips.find((entry) => entry.id === view.current.clip)

  /** Makes `typed` on a file, as one step, or says why not. */
  async function run(
    entry: { readonly path: string } | undefined,
    typed: TypedEdit,
    label: string,
  ): Promise<StudioOutcome> {
    if (entry === undefined) return say(no(`${label}: nothing is chosen`))
    if ('message' in typed) return say(no(typed.message))
    if (typed.edits.length === 0) return say({ ok: true })
    return say(await session.edit(entry.path, typed.edits, label))
  }

  /** An edit of the chosen clip, labelled by what it does to which clip. */
  const onClip = (what: string, make: (value: FigureClipDef) => TypedEdit): Promise<StudioOutcome> => {
    const entry = clip()
    const label = `${what} ${view.current.clip}`
    return run(
      entry,
      entry?.value === undefined ? { message: 'no clip is chosen' } : make(entry.value),
      label,
    )
  }

  const travel = async (back: boolean): Promise<StudioOutcome> =>
    say(await (back ? session.undo() : session.redo()))

  /** The chosen figure, pose or clip's value, or a refusal sentence. */
  function withFigure<T>(
    use: (value: NonNullable<ReturnType<typeof figure>>['value'] & object, id: string) => T,
  ): T | undefined {
    const entry = figure()
    return entry?.value === undefined ? undefined : use(entry.value, entry.id)
  }

  return {
    session,
    view,
    refusal: { subscribe: refusal.subscribe },
    revision: { subscribe: revision.subscribe },
    content,
    undo: () => travel(true),
    redo: () => travel(false),

    setSlider: (path, value) =>
      withFigure((def, id) => run(figure(), sliderEdit(def, path, value), `Set ${path.at(-1)} of ${id}`)) ??
      Promise.resolve(say(no('no figure is chosen'))),
    resetSlider: (path) =>
      withFigure((def, id) => run(figure(), sliderReset(def, path), `Reset ${path.at(-1)} of ${id}`)) ??
      Promise.resolve(say(no('no figure is chosen'))),
    setFigureField: (key, value) =>
      withFigure((def, id) => run(figure(), figureFieldEdit(def, key, value), `Set ${key} of ${id}`)) ??
      Promise.resolve(say(no('no figure is chosen'))),

    dragHandle(handle, position) {
      const base = pose()?.value
      if (base === undefined) return
      const target = base.effectors[handle]
      view.setLive({
        ...base,
        effectors: { ...base.effectors, [handle]: { ...target, pos: [...position] as unknown as Vec3 } },
      } as PoseDef)
      view.selectHandle(handle)
    },
    async dropHandle(handle, position) {
      const entry = pose()
      view.setLive(undefined)
      if (entry?.value === undefined) return say(no('no pose is chosen'))
      return run(entry, handleEdit(entry.value, handle, 'pos', position), `Move ${handle} of ${entry.id}`)
    },
    async setHandleTurn(handle, rot) {
      const entry = pose()
      if (entry?.value === undefined) return say(no('no pose is chosen'))
      return run(entry, handleEdit(entry.value, handle, 'rot', rot), `Turn ${handle} of ${entry.id}`)
    },
    async removeHandle(handle) {
      const entry = pose()
      if (entry?.value === undefined) return say(no('no pose is chosen'))
      return run(entry, removeHandle(entry.value, handle), `Remove ${handle} of ${entry.id}`)
    },
    cancelDrag: () => view.setLive(undefined),
    async addPose(id) {
      if (!ID.test(id)) return say(no('a pose id is lowercase letters, digits and -, starting with a letter'))
      const from = pose()
      if (from === undefined) return say(no('choose a pose to copy first'))
      const path = `${dirOf(content().poses, 'content/figure-poses')}/${id}.toml`
      const made = await session.create(path, from.text, `Add pose ${id}`)
      if (made.ok) view.select('pose', id)
      return say(made)
    },

    async addKeyAtPlayhead() {
      const entry = clip()
      const posed = view.current.pose
      if (entry?.value === undefined) return say(no('no clip is chosen'))
      if (posed === undefined) return say(no('choose a pose for the key first'))
      const t = view.current.playhead
      const result = await onClip('Add key to', (value) => addKey(value, t, posed))
      if (result.ok) view.selectKey(clip()?.value?.keys.findIndex((key) => key.t === t))
      return result
    },
    moveKey: (index, t) => onClip('Move key of', (value) => moveKey(value, index, t)),
    setKeyPose: (index, posed) => onClip('Set key pose of', (value) => setKeyPose(value, index, posed)),
    setKeyEase: (index, ease) => onClip('Set ease of', (value) => setKeyEase(value, index, ease)),
    async removeKey(index) {
      const result = await onClip('Remove key of', (value) => removeKey(value, index))
      if (result.ok) view.selectKey(undefined)
      return result
    },
    async addClip(id) {
      if (!ID.test(id)) return say(no('a clip id is lowercase letters, digits and -, starting with a letter'))
      const posed = view.current.pose
      if (posed === undefined) return say(no('choose a pose for the clip’s keys first'))
      const path = `${dirOf(content().clips, 'content/figure-clips')}/${id}.toml`
      const text = `length = 1\nloop = "once"\nmask = [ ${MASK_GROUPS.map((group) => `"${group}"`).join(', ')} ]\n\n[[keys]]\nt = 0\npose = "${posed}"\n\n[[keys]]\nt = 1\npose = "${posed}"\n`
      const made = await session.create(path, text, `Add clip ${id}`)
      if (made.ok) view.select('clip', id)
      return say(made)
    },
    setClipLength: (length) => onClip('Set length of', (value) => setLength(value, length)),
    setClipLoop: (loop) => onClip('Set loop of', (value) => clipEdits.loop(value, loop)),
    setClipMode: (mode) => onClip('Set mode of', (value) => clipEdits.mode(value, mode)),
    setClipMask: (mask) => onClip('Set mask of', (value) => clipEdits.mask(value, mask)),
    setMarker: (name, t) => onClip(`Set marker ${name} of`, (value) => setMarker(value, name, t)),
    removeMarker: (name) => onClip(`Remove marker ${name} of`, (value) => removeMarker(value, name)),
    addCue: (t, id) => onClip(`Add cue ${id} to`, (value) => addCue(value, t, id)),
    removeCue: (index) => onClip('Remove cue of', (value) => removeCue(value, index)),
  }
}
