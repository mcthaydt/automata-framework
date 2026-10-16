import type { FieldRecord } from '@mcthaydt/automata-sim'
import type { Container } from 'pixi.js'

/** Where an entity view draws: position in world pixels and rotation in radians (Pixi `rotation`). */
export interface Pose {
  readonly x: number
  readonly y: number
  readonly angle: number
}

type Components = Readonly<Record<string, Readonly<FieldRecord>>>

const TAU = Math.PI * 2

/** Linear blend; `t = 1` returns `b` exactly, because `a + (b - a)` can round away from it. */
export function lerp(a: number, b: number, t: number): number {
  if (t === 1) return b
  return a + (b - a) * t
}

/**
 * Blends two angles (radians) along the shorter arc, so a body turning from just under π to just over -π
 * swings through π instead of spinning the long way round through 0. At `t = 1` it returns `b` exactly, so a
 * view at rest shows the sim's own value rather than an equivalent angle 2π away.
 */
export function lerpAngle(a: number, b: number, t: number): number {
  if (t === 1) return b
  // Wrap the difference into [-π, π): the shortest signed turn from a to b.
  const turn = b - a - TAU * Math.floor((b - a + Math.PI) / TAU)
  return a + turn * t
}

function numberField(record: Readonly<FieldRecord> | undefined, field: string): number {
  const value = record?.[field]
  return typeof value === 'number' ? value : 0
}

function hasPosition(record: Readonly<FieldRecord>): boolean {
  return typeof record.x === 'number' && typeof record.y === 'number'
}

/**
 * The component a view reads its pose from: the one it was registered under, or (for a bare function
 * resolver, which has no id) the first component in row order with numeric `x` and `y`.
 */
export function poseComponent(
  components: Components,
  componentId?: string | undefined,
): Readonly<FieldRecord> | undefined {
  if (componentId !== undefined) return components[componentId]
  for (const record of Object.values(components)) {
    if (hasPosition(record)) return record
  }
  return undefined
}

/**
 * The pose between the previous tick (`alpha = 0`) and the current one (`alpha = 1`). With no previous tick
 * (just added, or after a resync) it is the current pose. A missing `angle`, or a non-numeric `x`/`y`, is 0.
 */
export function interpolatePose(
  curr: Readonly<FieldRecord>,
  prev: Readonly<FieldRecord> | undefined,
  alpha: number,
): Pose {
  const x = numberField(curr, 'x')
  const y = numberField(curr, 'y')
  const angle = numberField(curr, 'angle')
  if (prev === undefined) return { x, y, angle }
  return {
    x: lerp(numberField(prev, 'x'), x, alpha),
    y: lerp(numberField(prev, 'y'), y, alpha),
    angle: lerpAngle(numberField(prev, 'angle'), angle, alpha),
  }
}

/** Where the view's own box sits on its position: 0 = left/top, 0.5 = centre, 1 = right/bottom. */
export type ViewAnchor = number | { readonly x: number; readonly y: number }

/** The default anchor is the centre, so `angle` turns a view about its position. */
export function anchorXY(anchor: ViewAnchor | undefined): { x: number; y: number } {
  if (anchor === undefined) return { x: 0.5, y: 0.5 }
  if (typeof anchor === 'number') return { x: anchor, y: anchor }
  return { x: anchor.x, y: anchor.y }
}

/**
 * Moves a view's container to the interpolated pose of its component. `alpha` is the frame's position
 * between the previous tick and the current one, as `RenderDeltaConsumer` passes it.
 */
export function placeView(
  container: Container,
  curr: Components,
  prev: Components | undefined,
  alpha: number,
  componentId: string | undefined,
): void {
  const current = poseComponent(curr, componentId)
  if (current === undefined) return
  const previous = prev === undefined ? undefined : poseComponent(prev, componentId)
  const pose = interpolatePose(current, previous, alpha)
  container.position.set(pose.x, pose.y)
  container.rotation = pose.angle
}
