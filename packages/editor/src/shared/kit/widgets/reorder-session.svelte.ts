import { tick, untrack } from 'svelte'
import type { BlockedProps } from './edit-event'
import { previewOffsets, type RowShape, stepTarget, targetIndex } from './reorder-model'
import { autoScroll } from './reorder-scroll'

// What a reorderable list does while a row is moved, as Svelte state: the keyboard's lift, step and drop, the
// pointer's press, drag and drop, the announcements of each, and the transforms that preview the drop. The
// `ReorderList` component only draws the rows and wires their handles to these (split from it in 12.5).
// Call it while the component is set up: its effects stop a move when the items change under it.

export interface ReorderItem {
  id: string
  label: string
  locked?: boolean | undefined
  /** Why a locked row cannot move. */
  reason?: string | undefined
}

export interface ReorderMove {
  id: string
  from: number
  to: number
}

export interface ReorderInputs {
  readonly items: () => readonly ReorderItem[]
  readonly list: () => HTMLElement | undefined
  /** The row's handle, focused again after a drop. */
  readonly handle: (id: string) => HTMLElement | undefined
  readonly onreorder: () => ((move: ReorderMove) => void) | undefined
  readonly onblocked: () => BlockedProps['onblocked']
}

/** A press moves this far before it is a drag, by pointer kind (the same as the gesture layer's). */
const SLOP: Readonly<Record<string, number>> = { touch: 8, pen: 4, mouse: 3 }

interface Session {
  readonly kind: 'pointer' | 'keyboard'
  readonly id: string
  readonly name: string
  readonly from: number
  to: number
  /** Row heights and locks as they were when the move began. */
  readonly shapes: readonly RowShape[]
  /** Where each row goes while the move is previewed, by original index. */
  offsets: readonly number[]
  /** Pointer sessions: the pointer's offset from where it pressed, and the pointer itself. */
  pointerId: number
  pressY: number
  lastY: number
  moved: boolean
  slop: number
}

export interface ReorderSession {
  /** The row being moved and how, or `undefined` at rest. */
  readonly moving:
    | { readonly id: string; readonly kind: 'pointer' | 'keyboard'; readonly moved: boolean }
    | undefined
  /** What the polite live region says about the last step. */
  readonly announcement: string
  keydown(event: KeyboardEvent, row: ReorderItem, index: number): void
  blur(row: ReorderItem): void
  pointerdown(event: PointerEvent, index: number): void
  pointermove(event: PointerEvent): void
  pointerup(event: PointerEvent): void
  pointercancel(event: PointerEvent): void
  /** The translate that previews the move for the row at `index`, or `undefined` where it stays. */
  transformOf(index: number, id: string): string | undefined
}

export const lockedReason = (row: ReorderItem): string => row.reason ?? 'This row is locked'

export function reorderSession({ items, list, handle, onreorder, onblocked }: ReorderInputs): ReorderSession {
  let session = $state.raw<Session>()
  let announcement = $state('')

  const place = (index: number): string => `place ${index + 1} of ${items().length}`

  function measure(): readonly RowShape[] {
    const rows = [...(list()?.querySelectorAll<HTMLElement>(':scope > [data-reorder-row]') ?? [])]
    return items().map((row, index) => ({
      height: rows[index]?.getBoundingClientRect().height ?? 0,
      locked: row.locked === true,
    }))
  }

  function begin(kind: Session['kind'], index: number, extra: Partial<Session> = {}): Session | undefined {
    const row = items()[index]
    if (row === undefined) return undefined
    if (row.locked === true) {
      onblocked()?.(row.reason)
      announcement = `${row.label} is locked. ${lockedReason(row)}`
      return undefined
    }
    const shapes = measure()
    return {
      kind,
      id: row.id,
      name: row.label,
      from: index,
      to: index,
      shapes,
      offsets: shapes.map(() => 0),
      pointerId: -1,
      pressY: 0,
      lastY: 0,
      moved: false,
      slop: 0,
      ...extra,
    }
  }

  function setTarget(to: number): void {
    const current = session
    if (current === undefined || to === current.to) return
    session = { ...current, to, offsets: previewOffsets(current.shapes, current.from, to) }
  }

  function finish(drop: boolean): void {
    const current = session
    if (current === undefined) return
    session = undefined
    scroller.stop()
    // A press that never became a drag changed nothing and says nothing.
    if (current.kind === 'pointer' && !current.moved) return
    const placed = current.to
    if (!drop) {
      announcement = `Move cancelled. ${current.name} stays at ${place(current.from)}`
    } else if (placed === current.from) {
      announcement = `${current.name} dropped where it was`
    } else {
      announcement = `Dropped ${current.name} at ${place(placed)}`
      onreorder()?.({ id: current.id, from: current.from, to: placed })
    }
    void tick().then(() => handle(current.id)?.focus())
  }

  // -- keyboard --------------------------------------------------------------------------------------------------

  function onKeydown(event: KeyboardEvent, row: ReorderItem, index: number): void {
    const current = session
    if (current === undefined || current.kind !== 'keyboard') {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        if (event.key === ' ') lift(index)
      } else if (event.key === 'Escape' && current?.kind === 'pointer') finish(false)
      return
    }
    if (current.id !== row.id) return
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const direction = event.key === 'ArrowUp' ? -1 : 1
      const next = stepTarget(
        current.shapes.map((shape) => shape.locked),
        current.to,
        direction,
      )
      if (next === current.to)
        announcement = `${current.name} cannot move further ${direction < 0 ? 'up' : 'down'}`
      else {
        setTarget(next)
        announcement = `Moved ${current.name} to ${place(next)}`
      }
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      finish(true)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      finish(false)
    }
  }

  function lift(index: number): void {
    const started = begin('keyboard', index)
    if (started === undefined) return
    session = started
    announcement = `Lifted ${started.name}, ${place(index)}. Arrow keys move it, Space drops it, Escape cancels.`
  }

  function onBlur(row: ReorderItem): void {
    if (session?.kind === 'keyboard' && session.id === row.id) finish(false)
  }

  // -- pointer ---------------------------------------------------------------------------------------------------

  function onPointerdown(event: PointerEvent, index: number): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (session?.kind === 'keyboard') finish(false)
    const started = begin('pointer', index, {
      pointerId: event.pointerId,
      pressY: event.clientY,
      lastY: event.clientY,
      slop: SLOP[event.pointerType] ?? SLOP.mouse ?? 3,
    })
    if (started === undefined) return
    session = started
    try {
      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    } catch {
      // Capture is best effort: a synthetic pointer or one that already ended has nothing to capture.
    }
  }

  function targetAt(clientY: number, current: Session): number {
    const top = list()?.getBoundingClientRect().top ?? 0
    return targetIndex(current.shapes, clientY - top, current.from)
  }

  function onPointermove(event: PointerEvent): void {
    const current = session
    if (current?.kind !== 'pointer' || current.pointerId !== event.pointerId) return
    let moving = current
    if (!current.moved) {
      if (Math.abs(event.clientY - current.pressY) <= current.slop) return
      moving = { ...current, moved: true }
      announcement = `Dragging ${current.name}`
      scroller.start()
    }
    session = { ...moving, lastY: event.clientY }
    setTarget(targetAt(event.clientY, moving))
  }

  function onPointerup(event: PointerEvent): void {
    const current = session
    if (current?.kind !== 'pointer' || current.pointerId !== event.pointerId) return
    finish(true)
  }

  function onPointercancel(event: PointerEvent): void {
    if (session?.kind === 'pointer' && session.pointerId === event.pointerId) finish(false)
  }

  // -- auto-scroll: only while a pointer drag has moved past the slop ---------------------------------------------

  const scroller = autoScroll(
    list,
    () => (session?.kind === 'pointer' && session.moved ? session.lastY : undefined),
    () => {
      if (session !== undefined) setTarget(targetAt(session.lastY, session))
    },
  )

  // A drop is reported by index, so a list that changes under a move would make the report wrong.
  $effect.pre(() => {
    void items()
    untrack(() => {
      if (session !== undefined) {
        session = undefined
        scroller.stop()
      }
    })
  })

  $effect(() => scroller.stop)

  function transformOf(index: number, id: string): string | undefined {
    const current = session
    if (current === undefined || (current.kind === 'pointer' && !current.moved)) return undefined
    if (current.id === id) {
      return current.kind === 'pointer' ? `translateY(${current.lastY - current.pressY}px)` : undefined
    }
    const offset = current.offsets[index] ?? 0
    return offset === 0 ? undefined : `translateY(${offset}px)`
  }

  return {
    get moving() {
      return session
    },
    get announcement() {
      return announcement
    },
    keydown: onKeydown,
    blur: onBlur,
    pointerdown: onPointerdown,
    pointermove: onPointermove,
    pointerup: onPointerup,
    pointercancel: onPointercancel,
    transformOf,
  }
}
