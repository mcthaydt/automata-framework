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
import type { FieldValue, FieldValues } from '@mcthaydt/automata-editor-kit/fields'
import type { PlanPointer } from '../app/plan-controller'
import type { ThingShape } from '../entities/thing-def.schema'
import type { EntityKit } from '../entities/things'
import type { Point } from '../format/sector.schema'
import type { EditSession, LevelEditor } from '../model/level-editor'
import { parseSelection } from '../model/selection-ref'
import { addThing, moveThing, removeThing, setThingField } from '../model/thing-edits'
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
  /** `move` while a drag is moving a thing. A drag the tool did not take (it started on nothing) is the shell's to pan. */
  readonly gesture: 'idle' | 'move'
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
  /** A press that has moved past the slop: it grabs the thing under `press`; `at` is where the drag has got to. */
  dragStart(press: PlanPointer, at: PlanPointer): void
  drag(at: PlanPointer): void
  /** `cancelled` is a cancelled pointer: nothing is kept. */
  dragEnd(at: PlanPointer, cancelled: boolean): void
  /**
   * Takes the selected things out as one undo step, all or nothing; what is not a thing in the selection stays. Answers
   * the sentence of the first refusal, else nothing.
   */
  remove(): string | undefined
  /** Sets a field of the one selected thing (`null` clears it); answers the edit's sentence, else nothing. */
  setField(field: string, value: FieldValue | null): string | undefined
  /** The canvas has a new size: the camera keeps its centre. */
  resize(size: Size): void
  /** Stops following the editor. */
  dispose(): void
}

/** Equal as data: a view is a few points and a few names. */
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** A drag moving a thing. The session shows its runs live and is one undo step when it commits. */
interface Move<D> {
  readonly session: EditSession<D>
  /** The level as the drag found it: what the drag is compared with when it ends. */
  readonly base: D
  readonly def: string
  readonly id: string
  /** The thing's place, and the press, in metres, when the drag began: the thing goes to `from` plus the rounded offset. */
  readonly from: Point
  readonly press: Point
}

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
  let move: Move<D> | undefined

  /** The things of the live level, read once for each level the editor holds. */
  let read: { readonly level: D; readonly kit: EntityKit } | undefined
  const kit = (): EntityKit => {
    if (read?.level !== editor.level)
      read = { level: editor.level, kit: editor.profile.entities(editor.level) }
    return read.kit
  }

  const currentViewport = (): Viewport2D => planViewport(editor.view.state.camera, size)

  /** A distance in metres rounded to the grid: the fine data step with Shift, not at all with Alt. */
  const rounded = (value: number, at: PlanPointer): number => {
    const { step } = stepOf({ grid: editor.view.state.grid, shiftKey: at.shift })
    return snapValue(value, at.alt === true ? 0 : step)
  }

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

  /** The pointer rounded to the grid. */
  const placeOf = (at: PlanPointer): Point => {
    const world = toWorld(currentViewport(), at)
    return { x: rounded(world.x, at), z: rounded(world.z, at) }
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
    gesture: 'idle',
    refusal,
  }

  const publish = (): void => {
    // An undo has closed the drag's session: nothing of it is left to follow.
    if (move?.session.open === false) move = undefined
    const palette = paletteOf()
    // A definition the level no longer has cannot be placed.
    if (active !== undefined && !palette.some((entry) => entry.def === active?.def)) active = undefined
    const hover =
      pointer === undefined ? undefined : pickThing(kit(), currentViewport(), pointer, pickOptions(pointer))
    const place =
      active === undefined || pointer === undefined || hover !== undefined
        ? undefined
        : placeAt(active, pointer)
    const gesture = move === undefined ? 'idle' : 'move'
    const next: ThingsToolView = { palette, active: active?.def, hover, place, gesture, refusal }
    if (same(view, next)) return
    view = next
    for (const run of [...listeners]) run()
  }

  /** Runs the grabbed thing to its place plus the pointer's rounded offset. A refusal keeps the last accepted run. */
  const moveGrabbed = (grabbed: Move<D>, at: PlanPointer): void => {
    const world = toWorld(currentViewport(), at)
    const x = grabbed.from.x + rounded(world.x - grabbed.press.x, at)
    const z = grabbed.from.z + rounded(world.z - grabbed.press.z, at)
    const result = grabbed.session.run(moveThing({ def: grabbed.def, id: grabbed.id, x, z }))
    refusal = result.ok ? undefined : result.reason
  }

  /**
   * Ends the drag: its step is kept unless it was cancelled or ended with the level as it began. The drag is over before
   * the history hears of the commit or the cancel.
   */
  const endMove = (grabbed: Move<D>, keep: boolean): void => {
    move = undefined
    refusal = undefined
    // A session that is already closed (an undo ended it) ignores both.
    if (keep && !same(editor.level, grabbed.base)) grabbed.session.commit()
    else grabbed.session.cancel()
  }

  /** The things the selection names, as their definition and id. */
  const selectedThings = (): { readonly def: string; readonly id: string }[] =>
    editor.selection.ids.flatMap((id) => {
      const ref = parseSelection(id)
      return ref?.kind === 'entity' ? [{ def: ref.definition, id: ref.id }] : []
    })

  /** Shows the sentence an action answered with, or that it went in, and hands the sentence back. */
  const answer = (sentence: string | undefined): string | undefined => {
    refusal = sentence
    publish()
    return sentence
  }

  /** The things removed in one session, or the first sentence that refused one (and then none of them goes). */
  const removeAll = (
    things: readonly { readonly def: string; readonly id: string }[],
  ): string | undefined => {
    const [only] = things
    const label =
      things.length === 1 && only !== undefined
        ? `Remove ${only.def} ${only.id}`
        : `Remove ${things.length} things`
    const session = editor.begin(label)
    for (const thing of things) {
      const result = session.run(removeThing(thing))
      if (!result.ok) {
        session.cancel()
        return result.reason
      }
    }
    session.commit()
    return undefined
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
    dragStart(press, at) {
      if (move !== undefined) endMove(move, false)
      refusal = undefined
      const hit = pickThing(kit(), currentViewport(), press, pickOptions(press))
      const thing = kit().things.find((each) => each.def === hit?.def && each.id === hit?.id)
      if (hit !== undefined && thing !== undefined) {
        const session = editor.begin(`Move ${hit.def} ${hit.id}`)
        if (session.open) {
          editor.selection.set([hit.selection])
          move = {
            session,
            base: editor.level,
            def: hit.def,
            id: hit.id,
            from: { x: thing.x, z: thing.z },
            press: toWorld(currentViewport(), press),
          }
        }
      }
      this.drag(at)
    },
    drag(at) {
      pointer = at
      if (move?.session.open) moveGrabbed(move, at)
      publish()
    },
    dragEnd(at, cancelled) {
      pointer = at
      if (move !== undefined) {
        if (!cancelled && move.session.open) moveGrabbed(move, at)
        endMove(move, !cancelled)
      }
      publish()
    },
    remove() {
      const things = selectedThings()
      if (things.length === 0) return answer('select a thing first')
      const off = things.map((thing) => layerProblem(thing.def)).find((problem) => problem !== undefined)
      return answer(off ?? removeAll(things))
    },
    setField(field, value) {
      const things = selectedThings()
      const [thing] = things
      if (things.length !== 1 || thing === undefined) return answer('select one thing first')
      const off = layerProblem(thing.def)
      if (off !== undefined) return answer(off)
      const result = editor.run(setThingField({ ...thing, field, value }))
      return answer(result.ok ? undefined : result.reason)
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
