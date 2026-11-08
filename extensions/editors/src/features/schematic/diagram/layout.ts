// A character's modes and switches as a diagram, worked out every time from the character: the file holds no
// positions, so the file stays the only truth. Modes are boxes in columns (the start mode first, then by how far a
// walk from it reaches); switches are arrows; switches between the same two modes asked at the same time are one arrow.
// Pure and DOM-free, so it is tested on the converted scenes without a browser.
import { type AgentDef, hearsIn, isStill, routineMode, waitsIn } from '@automata/systems/sim'

export interface Size {
  readonly box: { readonly w: number; readonly h: number }
  /** The space between columns, and between rows. */
  readonly gap: number
  /** A label's height. */
  readonly label: number
  /** A label's width; a box's when left out. A label is meant to fit in the gap between two columns. */
  readonly labelW?: number
  /**
   * Tall: the columns are rows, so the modes stack from the top down and a level's siblings sit side by side. It is what a
   * narrow area wants, where a wide board would have to shrink until its words could not be read.
   */
  readonly tall?: boolean
}

export interface Box {
  /** The mode's name, or `'*'` for "Any mode it moves in". */
  readonly mode: string
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly start: boolean
  readonly still: boolean
  readonly patrol: boolean
}

/** When the interpreter asks a switch: every moment, when a noise is made, or after the character stops. */
export type Timing = 'always' | 'hears' | 'stops'

export interface Arrow {
  readonly from: string
  readonly to: string
  /** Indices into the character's `transitions`, in file order. */
  readonly switches: readonly number[]
  readonly loop: boolean
  readonly timing: Timing
  readonly points: readonly (readonly [number, number])[]
  readonly label: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
}

export interface Diagram {
  readonly boxes: readonly Box[]
  readonly arrows: readonly Arrow[]
  readonly width: number
  readonly height: number
}

export const ANY_MODE = '*'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

export function timingOf(when: AgentDef['transitions'][number]['when']): Timing {
  if (hearsIn(when)) return 'hears'
  if (waitsIn(when)) return 'stops'
  return 'always'
}

/** The modes in columns: a walk from the start mode, then what nothing reaches. */
function columns(agent: AgentDef): string[][] {
  const known = new Set(agent.modes)
  for (const t of agent.transitions) {
    if (t.from !== ANY_MODE) known.add(t.from)
    known.add(t.to)
  }
  const modes = [...known]
  const seen = new Set<string>()
  const result: string[][] = []
  let level = known.has(agent.initial) ? [agent.initial] : []
  for (const mode of level) seen.add(mode)
  while (level.length > 0) {
    result.push(level)
    const next: string[] = []
    for (const mode of level) {
      const targets = agent.transitions.filter(
        (t) => t.from === mode || (t.from === ANY_MODE && !isStill(agent, mode)),
      )
      for (const t of targets)
        if (!seen.has(t.to)) {
          seen.add(t.to)
          next.push(t.to)
        }
    }
    level = next
  }
  const lost = modes.filter((mode) => !seen.has(mode))
  if (lost.length > 0) result.push(lost)
  return result
}

/**
 * Wide is worked out directly. Tall is worked out as a wide board whose boxes and labels are turned on their side and
 * whose result is then turned back, so the modes, the arrows and what each links to are the same in both and only
 * where they sit differs.
 */
export function layoutAgent(agent: AgentDef, size: Size): Diagram {
  if (size.tall !== true) return layoutWide(agent, size)
  const labelW = size.labelW ?? size.box.w
  const turned = layoutWide(agent, {
    box: { w: size.box.h, h: size.box.w },
    // A level's gap holds a label's height now, and a sibling's gap its width.
    gap: size.label + 40,
    label: labelW,
    labelW: size.label,
    siblingGap: labelW + 40,
  })
  const rect = <T extends Rect>(r: T): T => ({ ...r, x: r.y, y: r.x, w: r.h, h: r.w })
  return {
    boxes: turned.boxes.map(rect),
    arrows: turned.arrows.map((arrow) => ({
      ...arrow,
      points: arrow.points.map(([x, y]) => [y, x] as const),
      label: rect(arrow.label),
    })),
    width: turned.height,
    height: turned.width,
  }
}

function layoutWide(agent: AgentDef, size: Size & { readonly siblingGap?: number }): Diagram {
  const { box: cell, gap, label } = size
  const labelW = size.labelW ?? cell.w
  // Rows are closer than columns: a label sits in the gap beside an arrow, and above a loop.
  const rowGap = size.siblingGap ?? label + 40
  const usesAny = agent.transitions.some((t) => t.from === ANY_MODE)
  const grid = columns(agent)
  if (usesAny) grid.unshift([ANY_MODE])
  // The first row leaves room above for loops and for arrows that pass over a column.
  const top = label + 56
  const boxes: Box[] = grid.flatMap((column, c) =>
    column.map((mode, r) => ({
      mode,
      x: c * (cell.w + gap),
      y: top + r * (cell.h + rowGap),
      w: cell.w,
      h: cell.h,
      start: mode === agent.initial,
      still: mode !== ANY_MODE && isStill(agent, mode),
      patrol: mode !== ANY_MODE && routineMode(agent) === mode,
    })),
  )
  const column = new Map(grid.flatMap((modes, c) => modes.map((mode) => [mode, c] as const)))
  const boxOf = (mode: string): Box | undefined => boxes.find((b) => b.mode === mode)

  // One arrow per pair of modes and time of asking.
  const groups = new Map<string, { from: string; to: string; timing: Timing; switches: number[] }>()
  agent.transitions.forEach((t, index) => {
    const timing = timingOf(t.when)
    const key = `${t.from}\u0000${t.to}\u0000${timing}`
    const group = groups.get(key) ?? { from: t.from, to: t.to, timing, switches: [] }
    group.switches.push(index)
    groups.set(key, group)
  })

  const bottom = Math.max(0, ...boxes.map((b) => b.y + b.h))
  let lane = 0
  const placed: Rect[] = boxes.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h }))
  const arrows: Arrow[] = []
  for (const group of groups.values()) {
    const a = boxOf(group.from)
    const b = boxOf(group.to)
    if (a === undefined || b === undefined) continue
    const ca = column.get(group.from) ?? 0
    const cb = column.get(group.to) ?? 0
    const loop = group.from === group.to
    let points: [number, number][]
    let anchor: { x: number; y: number }
    if (loop) {
      const cx = a.x + a.w / 2
      points = [
        [cx - 14, a.y],
        [cx - 14, a.y - 28],
        [cx + 14, a.y - 28],
        [cx + 14, a.y],
      ]
      anchor = { x: cx, y: a.y - 28 - label / 2 }
    } else if (cb > ca + 1) {
      // Over the columns between, along a lane above every box.
      lane += 1
      const laneY = top - 6 - 5 * (lane % 6)
      const x1 = a.x + a.w
      const x2 = b.x
      points = [
        [x1, a.y + a.h / 2],
        [x1 + gap / 3, a.y + a.h / 2],
        [x1 + gap / 3, laneY],
        [x2 - gap / 3, laneY],
        [x2 - gap / 3, b.y + b.h / 2],
        [x2, b.y + b.h / 2],
      ]
      anchor = { x: (x1 + x2) / 2, y: laneY - label / 2 - 2 }
    } else if (cb === ca + 1) {
      const mx = a.x + a.w + gap / 2
      points = [
        [a.x + a.w, a.y + a.h / 2],
        [mx, a.y + a.h / 2],
        [mx, b.y + b.h / 2],
        [b.x, b.y + b.h / 2],
      ]
      anchor = { x: mx, y: a.y + a.h / 2 - 6 - label / 2 }
    } else {
      // Back, or down the same column: round the far side, below the boxes.
      lane += 1
      const laneY = bottom + 28 + 6 * (lane % 8)
      const x1 = a.x + a.w / 2
      const x2 = b.x + b.w / 2
      points = [
        [x1, a.y + a.h],
        [x1, laneY],
        [x2, laneY],
        [x2, b.y + b.h],
      ]
      anchor = { x: (x1 + x2) / 2, y: laneY + label / 2 + 2 }
    }
    const spot = freeLabel(anchor, labelW, label, placed)
    placed.push(spot)
    arrows.push({
      from: group.from,
      to: group.to,
      switches: group.switches,
      loop,
      timing: group.timing,
      points,
      label: spot,
    })
  }

  const width = Math.max(
    0,
    ...boxes.map((b) => b.x + b.w),
    ...arrows.map((arrow) => arrow.label.x + arrow.label.w),
    ...arrows.flatMap((arrow) => arrow.points.map(([x]) => x)),
  )
  const height = Math.max(
    0,
    ...boxes.map((b) => b.y + b.h),
    ...arrows.map((arrow) => arrow.label.y + arrow.label.h),
    ...arrows.flatMap((arrow) => arrow.points.map(([, y]) => y)),
  )
  return { boxes, arrows, width, height }
}

/** A label centred on `anchor`, moved the least distance that leaves it clear of every box and label already placed. */
function freeLabel(anchor: { x: number; y: number }, w: number, h: number, placed: readonly Rect[]): Rect {
  for (let ring = 0; ring < 400; ring++)
    for (let dy = -ring; dy <= ring; dy++)
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue
        const rect = {
          x: Math.max(0, anchor.x - w / 2 + (dx * w) / 2),
          y: Math.max(0, anchor.y - h / 2 + dy * h),
          w,
          h,
        }
        if (!placed.some((other) => overlaps(rect, other))) return rect
      }
  return { x: Math.max(0, anchor.x - w / 2), y: Math.max(0, anchor.y), w, h }
}
