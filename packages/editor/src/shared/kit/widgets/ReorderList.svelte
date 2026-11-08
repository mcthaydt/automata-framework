<!--
  A list whose rows the person puts in order. Each row has a handle, 44 px wide, and the list
  reports exactly one `onreorder({ id, from, to })` per move, on the drop. The editor applies it and passes the new
  `items`; the list never reorders itself.

  Keyboard: Space on a handle lifts its row (`aria-pressed`), ArrowUp and ArrowDown move it one unlocked place,
  Space or Enter drops it and Escape puts it back. Every step is announced in a polite live region ("Moved Fog to
  place 3 of 4"), because the row's new place is otherwise only on screen.

  Pointer: pressing a handle and moving past the slop drags the row. The dragged row follows the pointer and the
  others shift to show the drop, as transforms, so no row leaves the DOM (and no focus is lost) until the drop. Near
  the top or bottom of the nearest scrolling ancestor the list scrolls itself, faster the nearer the edge. A
  cancelled pointer, Escape, or a drop on the row's own place reports nothing.

  A locked row keeps its place: its handle is `aria-disabled`, pressing it calls `onblocked` with its reason, and the
  other rows are never dropped onto it.
-->
<script lang="ts">
import { type Snippet, tick, untrack } from 'svelte'
import type { BlockedProps } from './edit-event'
import { autoScrollSpeed, moveRow, type RowShape, rowOffsets, stepTarget, targetIndex } from './reorder-model'

interface ReorderItem {
  id: string
  label: string
  locked?: boolean | undefined
  /** Why a locked row cannot move. */
  reason?: string | undefined
}

interface ReorderMove {
  id: string
  from: number
  to: number
}

interface RowState {
  dragging: boolean
  lifted: boolean
}

interface Props extends Pick<BlockedProps, 'onblocked'> {
  label: string
  items: readonly ReorderItem[]
  /** Draws a row's content beside its handle; without it the row shows its label. */
  item?: Snippet<[ReorderItem, RowState]> | undefined
  onreorder?: ((move: ReorderMove) => void) | undefined
}

/** A press moves this far before it is a drag, by pointer kind (the same as the gesture layer's). */
const SLOP: Readonly<Record<string, number>> = { touch: 8, pen: 4, mouse: 3 }

const { label, items, item: content, onreorder, onblocked }: Props = $props()

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

let list = $state<HTMLElement>()
let session = $state.raw<Session>()
let announcement = $state('')
const handles: Record<string, HTMLElement | undefined> = {}
let frame: number | undefined

const uid = $props.id()
const handleId = (row: ReorderItem): string => `${uid}-${row.id}`
const lockedReason = (row: ReorderItem): string => row.reason ?? 'This row is locked'
const place = (index: number): string => `place ${index + 1} of ${items.length}`

function measure(): readonly RowShape[] {
  const rows = [...(list?.querySelectorAll<HTMLElement>(':scope > [data-reorder-row]') ?? [])]
  return items.map((row, index) => ({
    height: rows[index]?.getBoundingClientRect().height ?? 0,
    locked: row.locked === true,
  }))
}

function previewOffsets(shapes: readonly RowShape[], from: number, to: number): readonly number[] {
  const order = moveRow(
    shapes.map((_, index) => index),
    (index) => shapes[index]?.locked === true,
    from,
    to,
  )
  return rowOffsets(
    shapes.map((shape) => shape.height),
    order,
  )
}

function begin(kind: Session['kind'], index: number, extra: Partial<Session> = {}): Session | undefined {
  const row = items[index]
  if (row === undefined) return undefined
  if (row.locked === true) {
    onblocked?.(row.reason)
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
  stopFrames()
  // A press that never became a drag changed nothing and says nothing.
  if (current.kind === 'pointer' && !current.moved) return
  const placed = current.to
  if (!drop) {
    announcement = `Move cancelled. ${current.name} stays at ${place(current.from)}`
  } else if (placed === current.from) {
    announcement = `${current.name} dropped where it was`
  } else {
    announcement = `Dropped ${current.name} at ${place(placed)}`
    onreorder?.({ id: current.id, from: current.from, to: placed })
  }
  void tick().then(() => handles[current.id]?.focus())
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
  const top = list?.getBoundingClientRect().top ?? 0
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
    startFrames()
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

// -- auto-scroll -----------------------------------------------------------------------------------------------

function scrollArea(): { element: HTMLElement; top: number; bottom: number } | undefined {
  for (let node = list?.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY
    if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) {
      const box = node.getBoundingClientRect()
      return { element: node, top: box.top, bottom: box.bottom }
    }
  }
  const root = document.scrollingElement
  if (root instanceof HTMLElement && root.scrollHeight > root.clientHeight) {
    return { element: root, top: 0, bottom: window.innerHeight }
  }
  return undefined
}

function tickFrame(): void {
  frame = undefined
  const current = session
  if (current?.kind !== 'pointer' || !current.moved) return
  const area = scrollArea()
  if (area) {
    const speed = autoScrollSpeed(current.lastY, area.top, area.bottom)
    if (speed !== 0) {
      area.element.scrollTop += speed
      // The list moved under a still pointer, so the row it is over may have changed.
      setTarget(targetAt(current.lastY, current))
    }
  }
  frame = requestAnimationFrame(tickFrame)
}

function startFrames(): void {
  if (frame === undefined) frame = requestAnimationFrame(tickFrame)
}

function stopFrames(): void {
  if (frame !== undefined) cancelAnimationFrame(frame)
  frame = undefined
}

// A drop is reported by index, so a list that changes under a move would make the report wrong.
$effect.pre(() => {
  void items
  untrack(() => {
    if (session !== undefined) {
      session = undefined
      stopFrames()
    }
  })
})

$effect(() => stopFrames)

function transformOf(index: number, id: string): string | undefined {
  const current = session
  if (current === undefined || (current.kind === 'pointer' && !current.moved)) return undefined
  if (current.id === id) {
    return current.kind === 'pointer' ? `translateY(${current.lastY - current.pressY}px)` : undefined
  }
  const offset = current.offsets[index] ?? 0
  return offset === 0 ? undefined : `translateY(${offset}px)`
}
</script>

<!-- svelte-ignore a11y_no_redundant_roles -- Safari drops list semantics from a list with `list-style: none` -->
<ul class="list" role="list" aria-label={label} data-widget="reorder-list" bind:this={list}>
  {#each items as row, index (row.id)}
    {@const dragging = session?.id === row.id && session.kind === 'pointer' && session.moved}
    {@const lifted = session?.id === row.id && session.kind === 'keyboard'}
    <li
      class="row"
      data-reorder-row
      data-dragging={dragging ? '' : undefined}
      data-lifted={lifted ? '' : undefined}
      data-locked={row.locked ? '' : undefined}
      style:transform={transformOf(index, row.id)}
    >
      <button
        type="button"
        class="handle"
        aria-label={`Reorder ${row.label}`}
        aria-pressed={lifted}
        aria-disabled={row.locked || undefined}
        aria-describedby={row.locked ? `${handleId(row)}-reason` : undefined}
        bind:this={handles[row.id]}
        onkeydown={(event) => onKeydown(event, row, index)}
        onkeyup={(event) => event.key === ' ' && event.preventDefault()}
        onblur={() => onBlur(row)}
        onpointerdown={(event) => onPointerdown(event, index)}
        onpointermove={onPointermove}
        onpointerup={onPointerup}
        onpointercancel={onPointercancel}
        onlostpointercapture={onPointercancel}
        oncontextmenu={(event) => event.preventDefault()}
      >
        <span aria-hidden="true">⋮⋮</span>
      </button>
      {#if row.locked}<span class="reason" id={`${handleId(row)}-reason`}>{lockedReason(row)}</span>{/if}
      <div class="content">
        {#if content}{@render content(row, { dragging, lifted })}{:else}{row.label}{/if}
      </div>
    </li>
  {/each}
</ul>
<div class="reason" role="status" aria-live="polite">{announcement}</div>

<style>
  .list {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .row {
    display: flex;
    align-items: center;
    min-height: var(--size-hit);
    border-bottom: 1px solid var(--line);
    background: var(--paper);
    transition: transform 120ms ease;
  }
  .row[data-dragging] {
    position: relative;
    z-index: 2;
    background: var(--paper);
    box-shadow: var(--shadow);
    transition: none;
  }
  .row[data-lifted] {
    background: var(--cobalt-soft);
  }
  .row[data-locked] {
    color: var(--muted);
  }
  @media (prefers-reduced-motion: reduce) {
    .row {
      transition: none;
    }
  }
  .handle {
    flex: 0 0 auto;
    width: var(--size-hit);
    min-height: var(--size-hit);
    align-self: stretch;
    border: 0;
    background: transparent;
    color: var(--muted);
    font: var(--text-body-13);
    letter-spacing: -2px;
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  .handle[aria-disabled='true'] {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .handle:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
  .content {
    flex: 1 1 auto;
    min-width: 0;
    padding: var(--space-2) var(--space-3) var(--space-2) 0;
    font: var(--text-body-13);
  }
  .reason {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
