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
// ED3D.7c adds two things the core names only through the definitions and the profile: a definition with an `area`
// (Last Light's camera zone) is placed by dragging a rectangle, and the things of the profile's links (Last Light's nav
// nodes) are joined with `startLink` and a tap on the other one, and parted with `unlink`.
//
// It lives beside `app/` rather than in it while the shell (ED3D.5b) is built there; it follows the same shape.
import type { Size, Viewport2D } from '@mcthaydt/automata-editor-kit/core'
import type { FieldValue, FieldValues } from '@mcthaydt/automata-editor-kit/fields'
import type { PlanPointer } from '../app/plan-controller'
import { lowestFreeId } from '../app/sector-id'
import type { ThingShape } from '../entities/thing-def.schema'
import type { EntityKit } from '../entities/things'
import type { Point } from '../format/sector.schema'
import type { Edit } from '../model/edit'
import type { EditSession, LevelEditor } from '../model/level-editor'
import { parseSelection } from '../model/selection-ref'
import { addThing, moveThing, removeThing, setThingField } from '../model/thing-edits'
import { thingLayer } from '../model/view-store'
import { PICK_RADIUS, type PickOptions } from '../view/plan/plan-pick'
import { gridRounded } from '../view/plan/plan-snap'
import { planViewport, toWorld } from '../view/plan/plan-viewport'
import { isThingLayerOff, pickThing, type ThingHit } from '../view/plan/thing-pick'
import { createLinkMode, type Linking, type LinkPlace } from './link-mode'

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

/** A rectangle of the plan, its sides in metres, `x0` below `x1` and `z0` below `z1`. */
export interface Rectangle {
  readonly x0: number
  readonly z0: number
  readonly x1: number
  readonly z1: number
}

/**
 * Where a tap would place the picked definition, the id it would take, and whether the model would take it. While a
 * rectangle is drawn for a definition with an `area`, the place is its middle and `area` the rectangle.
 */
export type ThingPlace = Point & { readonly id: string; readonly area?: Rectangle | undefined } & (
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
  /**
   * `move` while a drag is moving a thing, `area` while it draws the rectangle of a definition with an `area`. A drag the
   * tool did not take (it started on nothing, with no such definition picked) is the shell's to pan.
   */
  readonly gesture: 'idle' | 'move' | 'area'
  /** The thing a link starts from, and what it will pass through, between `startLink` and the tap that ends it. */
  readonly linking: Linking | undefined
  /** While linking, what a tap on the thing under the pointer would do. */
  readonly link: LinkPlace | undefined
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
  /**
   * Starts a link from the one selected thing of the profile's links, through `via` when it is given: the next tap on
   * another such thing joins the two as one undo step. Answers the sentence it was refused with, else nothing.
   */
  startLink(via?: string): string | undefined
  /** Stops linking. */
  cancelLink(): void
  /** Parts two things of the profile's links as one undo step; answers the edit's sentence, else nothing. */
  unlink(a: string, b: string): string | undefined
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

/** A drag drawing the rectangle of a definition with an `area`: where it was pressed and where it has got to, rounded. */
interface Drawing {
  readonly def: string
  readonly values: FieldValues
  readonly sides: readonly [string, string, string, string]
  readonly press: Point
  readonly at: Point
}

/** The rectangle two corners make, whichever way round. */
const rectangleOf = (a: Point, b: Point): Rectangle => ({
  x0: Math.min(a.x, b.x),
  z0: Math.min(a.z, b.z),
  x1: Math.max(a.x, b.x),
  z1: Math.max(a.z, b.z),
})

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
  let drawing: Drawing | undefined

  /** The things of the live level, read once for each level the editor holds. */
  let read: { readonly level: D; readonly kit: EntityKit } | undefined
  const kit = (): EntityKit => {
    if (read?.level !== editor.level)
      read = { level: editor.level, kit: editor.profile.entities(editor.level) }
    return read.kit
  }

  const currentViewport = (): Viewport2D => planViewport(editor.view.state.camera, size)

  /** A distance in metres rounded to the grid: the fine data step with Shift, not at all with Alt. */
  const rounded = (value: number, at: PlanPointer): number =>
    gridRounded(value, { grid: editor.view.state.grid, shiftKey: at.shift, altKey: at.alt })

  const pickOptions = (at: PlanPointer): PickOptions => {
    const { hidden, locked } = editor.view.state
    return { radius: PICK_RADIUS[at.kind], hidden, locked }
  }

  /** Whether the sub-layer of `def`, or the whole Things layer, is in the view's list. */
  const listed = (list: 'hidden' | 'locked', def: string): boolean =>
    isThingLayerOff({ [list]: editor.view.state[list] }, def)

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
    return options.id === undefined ? lowestFreeId(taken, def) : options.id(def, taken)
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

  /** The thing a drawn rectangle would add: at its middle, the four sides given as the definition's area fields. */
  const areaAddition = (drawn: Drawing) => {
    const area = rectangleOf(drawn.press, drawn.at)
    const point = { x: (area.x0 + area.x1) / 2, z: (area.z0 + area.z1) / 2 }
    const [x0, z0, x1, z1] = drawn.sides
    const values = { ...drawn.values, [x0]: area.x0, [z0]: area.z0, [x1]: area.x1, [z1]: area.z1 }
    const id = idFor(drawn.def)
    return { area, point, id, edit: addThing<D>({ def: drawn.def, id, x: point.x, z: point.z, values }) }
  }

  /** What the end of the drawing would do, without doing it. */
  const drawnPlace = (drawn: Drawing): ThingPlace => {
    const { area, point, id, edit } = areaAddition(drawn)
    const problem = layerProblem(drawn.def) ?? trialProblem(edit)
    return problem === undefined
      ? { ...point, id, area, action: 'add' }
      : { ...point, id, area, action: 'none', reason: problem }
  }

  /** The sentence the live level refuses an edit with, without running it in the history; nothing when it would go in. */
  function trialProblem(edit: Edit<D>): string | undefined {
    const trial = edit.run(editor.profile, editor.level)
    return trial.ok ? undefined : trial.reason
  }

  const links = createLinkMode(editor, layerProblem)

  let view: ThingsToolView = {
    palette: paletteOf(),
    active: undefined,
    hover: undefined,
    place: undefined,
    gesture: 'idle',
    linking: undefined,
    link: undefined,
    refusal,
  }

  const publish = (): void => {
    // An undo has closed the drag's session: nothing of it is left to follow, and its sentence goes with it.
    if (move?.session.open === false) {
      move = undefined
      refusal = undefined
    }
    // A sub-layer hidden or locked mid-drag is not to be changed: the drag ends and keeps nothing.
    const off = move === undefined ? undefined : layerProblem(move.def)
    if (move !== undefined && off !== undefined) {
      endMove(move, false)
      refusal = off
    }
    // Linking stops when the links' sub-layer goes off.
    links.settle()
    const { linking } = links
    const palette = paletteOf()
    // A definition the level no longer has cannot be placed.
    if (active !== undefined && !palette.some((entry) => entry.def === active?.def)) active = undefined
    const hover =
      pointer === undefined ? undefined : pickThing(kit(), currentViewport(), pointer, pickOptions(pointer))
    const place =
      drawing !== undefined
        ? drawnPlace(drawing)
        : active === undefined || pointer === undefined || hover !== undefined || linking !== undefined
          ? undefined
          : placeAt(active, pointer)
    const link =
      pointer === undefined
        ? undefined
        : links.preview(pickThing(kit(), currentViewport(), pointer, pickOptions(pointer)))
    const gesture = move !== undefined ? 'move' : drawing !== undefined ? 'area' : 'idle'
    const next: ThingsToolView = {
      palette,
      active: active?.def,
      hover,
      place,
      gesture,
      linking,
      link,
      refusal,
    }
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
      const definitions = kit().definitions.map((definition) => definition.id)
      if (!definitions.includes(def)) return answer(`no definition ${def}`)
      active = { def, values }
      refusal = undefined
      const layer = thingLayer(def)
      const { hidden } = editor.view.state
      // Showing the whole Things layer to show one sub-layer would show the others too: they stay hidden on their own.
      const others = hidden.includes('things')
        ? definitions.filter((each) => each !== def).map(thingLayer)
        : []
      const shown = hidden.filter((each) => each !== layer && each !== 'things')
      // The view store tells `publish`; when nothing about the view changed, it is told here.
      editor.view.set({ layer, hidden: [...shown, ...others.filter((each) => !shown.includes(each))] })
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
      // While linking, a tap joins or stops linking and does nothing more.
      if (links.linking !== undefined) refusal = links.tap(hit)
      else if (hit !== undefined) {
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
      drawing = undefined
      links.stop()
      refusal = undefined
      const hit = pickThing(kit(), currentViewport(), press, pickOptions(press))
      const thing = kit().things.find((each) => each.def === hit?.def && each.id === hit?.id)
      if (hit !== undefined && thing !== undefined) {
        const session = editor.begin(`Move ${hit.def} ${hit.id}`)
        // A closed session refuses its runs with the history's sentence, which says why the drag cannot start.
        if (!session.open) {
          const blocked = session.run(moveThing({ def: hit.def, id: hit.id, x: thing.x, z: thing.z }))
          refusal = blocked.ok ? undefined : blocked.reason
        } else {
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
      } else if (hit === undefined && active !== undefined) {
        const sides = kit().definitions.find((definition) => definition.id === active?.def)?.area
        if (sides !== undefined) {
          const corner = placeOf(press)
          drawing = { def: active.def, values: active.values, sides, press: corner, at: corner }
        }
      }
      this.drag(at)
    },
    drag(at) {
      pointer = at
      if (move?.session.open) moveGrabbed(move, at)
      if (drawing !== undefined) drawing = { ...drawing, at: placeOf(at) }
      publish()
    },
    dragEnd(at, cancelled) {
      pointer = at
      if (move !== undefined) {
        if (!cancelled && move.session.open) moveGrabbed(move, at)
        endMove(move, !cancelled)
      }
      if (drawing !== undefined) {
        const drawn: Drawing = { ...drawing, at: placeOf(at) }
        drawing = undefined
        if (!cancelled) {
          const problem = layerProblem(drawn.def)
          const result = problem === undefined ? editor.run(areaAddition(drawn).edit) : undefined
          refusal = problem ?? (result?.ok === false ? result.reason : undefined)
        }
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
    startLink(via) {
      return answer(links.start(selectedThings(), via))
    },
    cancelLink() {
      links.stop()
      publish()
    },
    unlink(a, b) {
      return answer(links.unlink(a, b))
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
