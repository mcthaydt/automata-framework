import type { GestureHandlers } from './gesture-events'

// Two or more touch pointers that are down together (editor kit spec §4.5). The first two are the pair that pans and
// pinches; every finger counts toward a `multiTap`. A cluster lives from its second finger down to its last finger
// up, and what it does is decided once: it becomes a transform when the pair travels past the slop, a multi-tap when
// every finger lifts quickly and still, and otherwise nothing.

/** A touch pointer that is down. The recognizer updates `x` and `y` in place as it moves. */
export interface TouchPoint {
  readonly id: number
  readonly startX: number
  readonly startY: number
  x: number
  y: number
  readonly downAt: number
}

export interface ClusterEnv {
  readonly handlers: GestureHandlers
  readonly slop: number
  readonly tapMs: number
  readonly rotate: boolean
  now(): number
}

export interface TouchCluster {
  has(id: number): boolean
  /** A finger landed. Only a cluster that has not decided anything yet can still become a transform. */
  join(point: TouchPoint): void
  move(point: TouchPoint): void
  /** A finger lifted (`cancelled` false) or was taken away (true). */
  lift(id: number, cancelled: boolean): void
  /** The pen took over: ends a transform cancelled. */
  abort(): void
  readonly empty: boolean
}

interface Frame {
  readonly x: number
  readonly y: number
  readonly spread: number
  readonly angle: number
}

/** The angle between two angles, as the shortest signed turn. */
function turn(from: number, to: number): number {
  let delta = to - from
  while (delta > Math.PI) delta -= 2 * Math.PI
  while (delta <= -Math.PI) delta += 2 * Math.PI
  return delta
}

const ratio = (from: number, to: number): number => (from === 0 ? 1 : to / from)

export function createCluster(env: ClusterEnv, first: readonly TouchPoint[]): TouchCluster {
  const startAt = Math.min(...first.map((point) => point.downAt))
  const members = new Map<number, TouchPoint>()
  const down = new Set<number>()
  let state: 'pending' | 'transforming' | 'done' = 'pending'
  let moved = false
  let maxFingers = 0
  let init: Frame | undefined
  let last: Frame | undefined
  let totalScale = 1
  let totalRotation = 0

  const pair = (): [TouchPoint, TouchPoint] | undefined => {
    const [a, b] = [...members.values()]
    return a && b && down.has(a.id) && down.has(b.id) ? [a, b] : undefined
  }

  function frame(a: TouchPoint, b: TouchPoint): Frame {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      spread: Math.hypot(b.x - a.x, b.y - a.y),
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    }
  }

  function emit(phase: 'start' | 'change' | 'end', from: Frame, to: Frame, cancelled: boolean): void {
    const scale = phase === 'end' ? 1 : ratio(from.spread, to.spread)
    const rotation = phase === 'end' || !env.rotate ? 0 : turn(from.angle, to.angle)
    totalScale *= scale
    totalRotation += rotation
    env.handlers.pan?.({
      phase,
      x: to.x,
      y: to.y,
      dx: phase === 'end' ? 0 : to.x - from.x,
      dy: phase === 'end' ? 0 : to.y - from.y,
      cancelled,
    })
    env.handlers.pinch?.({ phase, x: to.x, y: to.y, scale, totalScale, rotation, totalRotation, cancelled })
  }

  function endTransform(cancelled: boolean): void {
    if (state !== 'transforming' || last === undefined) return
    state = 'done'
    emit('end', last, last, cancelled)
  }

  function join(point: TouchPoint): void {
    members.set(point.id, point)
    down.add(point.id)
    maxFingers = Math.max(maxFingers, down.size)
    if (state === 'transforming' && members.size > 2) endTransform(false)
  }

  for (const point of first) join(point)
  const seed = pair()
  if (seed) init = last = frame(seed[0], seed[1])

  function tapCentre(): { x: number; y: number } {
    const all = [...members.values()]
    return {
      x: all.reduce((sum, point) => sum + point.startX, 0) / all.length,
      y: all.reduce((sum, point) => sum + point.startY, 0) / all.length,
    }
  }

  return {
    has: (id) => down.has(id),
    join,

    move(point) {
      if (!down.has(point.id) || state === 'done') return
      if (Math.hypot(point.x - point.startX, point.y - point.startY) > env.slop) moved = true
      const fingers = pair()
      if (!fingers || init === undefined || last === undefined) return
      const now = frame(fingers[0], fingers[1])
      if (state === 'pending') {
        if (
          Math.hypot(now.x - init.x, now.y - init.y) <= env.slop &&
          Math.abs(now.spread - init.spread) <= env.slop
        )
          return
        state = 'transforming'
        emit('start', init, now, false)
      } else if (
        now.x !== last.x ||
        now.y !== last.y ||
        now.spread !== last.spread ||
        now.angle !== last.angle
      ) {
        emit('change', last, now, false)
      } else return
      last = now
    },

    lift(id, cancelled) {
      if (!down.delete(id)) return
      if (state === 'transforming') endTransform(cancelled)
      else if (cancelled && state === 'pending') moved = true
      if (down.size > 0) return
      const quick = env.now() - startAt <= env.tapMs
      if (state === 'pending' && !moved && quick)
        env.handlers.multiTap?.({ ...tapCentre(), fingers: maxFingers })
    },

    abort() {
      endTransform(true)
      state = 'done'
    },

    get empty() {
      return down.size === 0
    },
  }
}
