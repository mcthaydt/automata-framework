// The Plan view's Things tool as plain TypeScript (ED3D.7b, ED3D spec §4.7, §5.2 and §5.4): the palette over the level's
// entity definitions with one sub-layer each, a tap that places the picked definition or selects the thing under it, a
// drag that moves a thing as one undo step, delete and set a field. No Svelte, DOM, Pixi or clock in here: the view
// forwards what the kit's gesture recogniser says (canvas pixels, the pointer kind and the modifier keys, as for the
// other tools), reads `view` and paints the palette, the things and where a tap would place one. The level, the
// selection and the camera stay in the editor.
//
// The place is a dry run of the edit: `view.place` says what a tap would do by running `addThing` against the live level
// and not committing it, so the preview cannot disagree with the model, and a refusal is the model's own sentence.
//
// It lives beside `app/` rather than in it while the shell (ED3D.5b) is built there; it follows the same shape.
import type { Size, Viewport2D } from '@mcthaydt/automata-editor-kit/core'
import type { FieldValues } from '@mcthaydt/automata-editor-kit/fields'
import type { PlanPointer } from '../app/plan-controller'
import type { ThingShape } from '../entities/thing-def.schema'
import type { EntityKit } from '../entities/things'
import type { Point } from '../format/sector.schema'
import type { LevelEditor } from '../model/level-editor'
import { addThing } from '../model/thing-edits'
import { thingLayer } from '../model/view-store'
import { PICK_RADIUS, type PickOptions } from '../view/plan/plan-pick'
import { stepOf } from '../view/plan/plan-snap'
import { planViewport, snapValue, toWorld } from '../view/plan/plan-viewport'
import { pickThing, type ThingHit } from '../view/plan/thing-pick'

/** A definition as the palette shows it, with its sub-layer and whether that is hidden or locked. */
export interface PaletteEntry {
  readonly def: string
  /** The definition's label, else its id. */
  readonly label: string
  readonly shape: ThingShape
  readonly color: string | undefined
  /** `things:<def>`. */
  readonly layer: string
  /** It, or the whole Things layer, is hidden: not drawn and not hit. */
  readonly hidden: boolean
  /** It, or the whole Things layer, is locked: drawn and not hit. */
  readonly locked: boolean
}

/** Where a tap would place the picked definition, the id it would take, and whether the model would take it. */
export type ThingPlace = Point & { readonly id: string } & (
    | { readonly action: 'add' }
    /** Nothing: the sentence a tap would be refused with. */
    | { readonly action: 'none'; readonly reason: string }
  )

export interface ThingsToolView {
  readonly palette: readonly PaletteEntry[]
  /** The definition a tap on nothing places; nothing when none is picked. */
  readonly active: string | undefined
  /** The thing under the pointer, on a sub-layer that is on. */
  readonly hover: ThingHit | undefined
  /** Only with a definition picked and no thing under the pointer. */
  readonly place: ThingPlace | undefined
  /** The sentence the last action was refused with, until the next action. */
  readonly refusal: string | undefined
}

export interface ThingsToolOptions {
  /** The id of a new thing of `def`; by default `<def>N`, the lowest N from 1 not among `taken`. */
  readonly id?: ((def: string, taken: readonly string[]) => string) | undefined
}

export interface ThingsTool {
  readonly view: ThingsToolView
  /** Called after `view` changes; returns a way to stop. */
  subscribe(run: () => void): () => void
  /**
   * Picks the definition a tap places, with the values a new one starts with (a required field has no default, so the
   * palette gives it here), puts the view on its sub-layer and switches that on. `undefined` picks nothing. Answers the
   * sentence it was refused with, else nothing.
   */
  pick(def: string | undefined, values?: FieldValues): string | undefined
  hover(at: PlanPointer): void
  /** The pointer left the canvas. */
  leave(): void
  /** Selects the thing under the pointer (`additive` adds or takes off); on nothing, places the picked definition. */
  tap(at: PlanPointer): void
  /** The canvas has a new size: the camera keeps its centre. */
  resize(size: Size): void
  /** Stops following the editor. */
  dispose(): void
}

/** Equal as data: a view is a few points and a few names. */
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** `<def>N`, the lowest N from 1 that is not taken. */
function nextId(def: string, taken: readonly string[]): string {
  for (let n = 1; ; n++) if (!taken.includes(`${def}${n}`)) return `${def}${n}`
}

export function createThingsTool<D>(
  editor: LevelEditor<D>,
  canvas: Size,
  options: ThingsToolOptions = {},
): ThingsTool {
  const listeners = new Set<() => void>()
  let size = canvas
  let pointer: PlanPointer | undefined
  let active: { readonly def: string; readonly values: FieldValues } | undefined
  let refusal: string | undefined

  /** The things of the live level, read once for each level the editor holds. */
  let read: { readonly level: D; readonly kit: EntityKit } | undefined
  const kit = (): EntityKit => {
    if (read?.level !== editor.level)
      read = { level: editor.level, kit: editor.profile.entities(editor.level) }
    return read.kit
  }

  const currentViewport = (): Viewport2D => planViewport(editor.view.state.camera, size)

  const pickOptions = (at: PlanPointer): PickOptions => {
    const { hidden, locked } = editor.view.state
    return { radius: PICK_RADIUS[at.kind], hidden, locked }
  }

  /** Whether the sub-layer of `def`, or the whole Things layer, is in the view's list. */
  const listed = (list: 'hidden' | 'locked', def: string): boolean => {
    const layers = editor.view.state[list]
    return layers.includes('things') || layers.includes(thingLayer(def))
  }

  /** The sentence a placement on the sub-layer of `def` is refused with, when it is off. */
  const layerProblem = (def: string): string | undefined => {
    if (listed('hidden', def)) return `the ${def} layer is hidden`
    return listed('locked', def) ? `the ${def} layer is locked` : undefined
  }

  const paletteOf = (): PaletteEntry[] =>
    kit().definitions.map((definition) => ({
      def: definition.id,
      label: definition.label ?? definition.id,
      shape: definition.shape,
      color: definition.color,
      layer: thingLayer(definition.id),
      hidden: listed('hidden', definition.id),
      locked: listed('locked', definition.id),
    }))

  /** The pointer rounded to the grid: the fine data step with Shift, not at all with Alt. */
  const placeOf = (at: PlanPointer): Point => {
    const world = toWorld(currentViewport(), at)
    const { step } = stepOf({ grid: editor.view.state.grid, shiftKey: at.shift })
    const fine = at.alt === true ? 0 : step
    return { x: snapValue(world.x, fine), z: snapValue(world.z, fine) }
  }

  const idFor = (def: string): string => {
    const taken = editor.profile.things.takenIds(editor.level, def)
    return (options.id ?? nextId)(def, taken)
  }

  const additionAt = (def: string, values: FieldValues, at: PlanPointer) => {
    const point = placeOf(at)
    const id = idFor(def)
    return { point, id, edit: addThing<D>({ def, id, x: point.x, z: point.z, values }) }
  }

  /** What a tap on nothing at `at` would do with the picked definition, without doing it. */
  const placeAt = (picked: NonNullable<typeof active>, at: PlanPointer): ThingPlace => {
    const { point, id, edit } = additionAt(picked.def, picked.values, at)
    const problem = layerProblem(picked.def)
    if (problem !== undefined) return { ...point, id, action: 'none', reason: problem }
    const trial = edit.run(editor.profile, editor.level)
    return trial.ok ? { ...point, id, action: 'add' } : { ...point, id, action: 'none', reason: trial.reason }
  }

  let view: ThingsToolView = {
    palette: paletteOf(),
    active: undefined,
    hover: undefined,
    place: undefined,
    refusal,
  }

  const publish = (): void => {
    const palette = paletteOf()
    // A definition the level no longer has cannot be placed.
    if (active !== undefined && !palette.some((entry) => entry.def === active?.def)) active = undefined
    const hover =
      pointer === undefined ? undefined : pickThing(kit(), currentViewport(), pointer, pickOptions(pointer))
    const place =
      active === undefined || pointer === undefined || hover !== undefined
        ? undefined
        : placeAt(active, pointer)
    const next: ThingsToolView = { palette, active: active?.def, hover, place, refusal }
    if (same(view, next)) return
    view = next
    for (const run of [...listeners]) run()
  }

  const stops = [editor.history.subscribe(publish), editor.view.subscribe(publish)]

  return {
    get view() {
      return view
    },
    subscribe(run) {
      listeners.add(run)
      return () => {
        listeners.delete(run)
      }
    },
    pick(def, values = {}) {
      if (def === undefined) {
        active = undefined
        refusal = undefined
        publish()
        return undefined
      }
      if (!kit().definitions.some((definition) => definition.id === def)) return `no definition ${def}`
      active = { def, values }
      refusal = undefined
      const layer = thingLayer(def)
      const { hidden } = editor.view.state
      // The view store tells `publish`; when nothing about the view changed, it is told here.
      editor.view.set({ layer, hidden: hidden.filter((each) => each !== layer && each !== 'things') })
      publish()
      return undefined
    },
    hover(at) {
      pointer = at
      publish()
    },
    leave() {
      pointer = undefined
      publish()
    },
    tap(at) {
      pointer = at
      refusal = undefined
      const hit = pickThing(kit(), currentViewport(), at, pickOptions(at))
      if (hit !== undefined) {
        if (at.additive === true) editor.selection.toggle(hit.selection)
        else editor.selection.set([hit.selection])
      } else if (active !== undefined) {
        const problem = layerProblem(active.def)
        if (problem === undefined) {
          const result = editor.run(additionAt(active.def, active.values, at).edit)
          if (!result.ok) refusal = result.reason
        } else refusal = problem
      } else if (at.additive !== true) editor.selection.clear()
      publish()
    },
    resize(next) {
      size = next
      publish()
    },
    dispose() {
      for (const stop of stops) stop()
      listeners.clear()
    },
  }
}
