// The agent interpreter: each step an agent counts down an
// appearance, takes the highest-priority transition whose probes hold, then walks its path at its mode's speed (or
// waits, and asks its waiting transitions), and runs its routine. Hearing runs when a noise is made.
import { route } from '@automata/nav/sim'
import type { Point } from '@automata/sectors/sim'
import { atan2, hypot } from '@automata/sim/math'
import { applyEffects, type Outcome } from './effect'
import { AT_NODE, holds, type Subject } from './probe'
import { hearsIn, isStill, routineMode, waitsIn } from './probe-kinds'
import { dist, zoneAt } from './pursuit'
import { reachable } from './reserve'
import type { AgentRecord, Noise, Pending } from './systems.resource'
import type { AgentDef, Transition } from './systems.schema'
import { type SystemsWorld, setMode } from './world'

/** Close enough to a path point to take the next one. */
export const ARRIVE = 0.08

interface Ordered {
  readonly deciding: readonly Transition[]
  readonly waiting: readonly Transition[]
  readonly hearing: readonly Transition[]
}
/** An agent's transitions by when they run, highest priority first (ties keep their written order). */
export function ordered(def: AgentDef): Ordered {
  const sorted = def.transitions
    .map((t, i) => ({ t, i }))
    .sort((a, b) => b.t.priority - a.t.priority || a.i - b.i)
    .map(({ t }) => t)
  return {
    deciding: sorted.filter((t) => !hearsIn(t.when) && !waitsIn(t.when)),
    waiting: sorted.filter((t) => waitsIn(t.when)),
    hearing: sorted.filter((t) => hearsIn(t.when)),
  }
}

const applies = (def: AgentDef, from: string, mode: string): boolean =>
  from === mode || (from === '*' && !isStill(def, mode))

/** Runs transitions in order; true when the step ends here for this agent. */
function run(
  w: SystemsWorld,
  list: readonly Transition[],
  record: AgentRecord,
  subject: Subject & { id: string },
  heard: (n: Noise) => void,
): boolean {
  for (const t of list) {
    if (!applies(subject.def, t.from, record.mode) || !holds(w, t.when, subject)) continue
    const before = record.mode
    const changed = t.to !== before
    if (changed) setMode(w, subject.id, t.to)
    if (applyEffects(w, t.do, subject, heard) !== null) return true
    if (changed && (isStill(subject.def, before) || isStill(subject.def, t.to))) return true
  }
  return false
}

/**
 * Counts an appearance down. True when it ended and the agent took its next mode: the step ends. Door-follow never
 * puts the agent within `clear` m of the player, nor on a spot the game refuses: it waits.
 */
function appear(w: SystemsWorld, id: string, record: AgentRecord, p: Pending): boolean {
  const at = w.at[id] as { x: number; z: number }
  if (p.shown !== true) {
    // Through on foot already (a follow): no need to appear.
    if (p.zone !== undefined && zoneAt(w, at) === p.zone) p.shown = true
    else {
      p.in -= w.ctx.dt
      if (p.in <= 1e-9 && dist(w.player, p.at) >= p.clear && w.options.refuses?.(w, id, p.at) !== true) {
        at.x = p.at.x
        at.z = p.at.z
        record.path = []
        record.moving = false
        record.facing = atan2(w.player.x - p.at.x, w.player.z - p.at.z)
        p.shown = true
      }
    }
    if (p.shown !== true || p.hold > 1e-9) return false
  } else {
    p.hold -= w.ctx.dt
    if (p.hold > 1e-9) return false
  }
  delete record.pending
  setMode(w, id, p.then)
  record.timer = 0
  record.goal = { x: w.player.x, z: w.player.z }
  record.path = route(at, record.goal, w.graph, w.walk).map((q) => ({ x: q.x, z: q.z }))
  return true
}

/** One fixed step for agent `def`. */
export function stepAgent(w: SystemsWorld, def: AgentDef, heard: (n: Noise) => void): void {
  const id = def.id
  const record = w.state.agents[id]
  const at = w.at[id]
  if (record === undefined || at === undefined) return
  const order = ordered(def)
  const subject = { id, def }
  record.moving = false
  if (record.pending !== undefined && record.pending.mode !== record.mode) delete record.pending
  if (record.pending !== undefined && appear(w, id, record, record.pending)) return
  if (run(w, order.deciding, record, subject, heard)) return
  if (isStill(def, record.mode)) return
  const next = record.path[0]
  if (next !== undefined) {
    const dx = next.x - at.x
    const dz = next.z - at.z
    const length = hypot(dx, dz)
    const step = Math.min(length, (def.speed[record.mode] ?? 0) * w.ctx.dt)
    const to = {
      x: at.x + (length > 0 ? (dx / length) * step : 0),
      z: at.z + (length > 0 ? (dz / length) * step : 0),
    }
    if (w.options.refuses?.(w, id, to) === true) {
      record.timer += w.ctx.dt
      if (run(w, order.waiting, record, { ...subject, waiting: 'blocked' }, heard)) return
    } else {
      at.x = to.x
      at.z = to.z
      record.moving = step > 1e-4
      if (length > 1e-4) record.facing = atan2(dx, dz)
    }
    if (length < ARRIVE) record.path.shift()
    return
  }
  record.timer += w.ctx.dt
  const mode = record.mode
  if (run(w, order.waiting, record, { ...subject, waiting: 'idle' }, heard)) return
  // The routine: at the stop, dwell, act, then on to the next reachable stop.
  const stops = def.routine ?? []
  const stop = stops[record.patrol % Math.max(stops.length, 1)]
  if (
    stop === undefined ||
    record.mode !== routineMode(def) ||
    record.mode !== mode ||
    record.timer <= stop.dwell
  )
    return
  const node = w.graph.nodes[stop.node] as Point
  if (dist(at, node) < AT_NODE && applyEffects(w, stop.do, subject, heard) !== null) return
  for (let i = 0; i < stops.length; i++) {
    record.patrol = (record.patrol + 1) % stops.length
    if (reachable(w.ctx, (stops[record.patrol] as { node: string }).node, id)) break
  }
  const target = w.graph.nodes[(stops[record.patrol] as { node: string }).node] as Point
  record.path = route(at, target, w.graph, w.walk).map((q) => ({ x: q.x, z: q.z }))
  record.timer = 0
}

/** Reacts to a noise as it is made (`w.hearing`): the highest-priority sound transition that holds, if any. */
export function hearAgent(w: SystemsWorld, def: AgentDef, heard: (n: Noise) => void): Outcome {
  const record = w.state.agents[def.id]
  if (record === undefined) return null
  const subject = { id: def.id, def }
  const t = ordered(def).hearing.find((h) => applies(def, h.from, record.mode) && holds(w, h.when, subject))
  if (t === undefined) return null
  if (t.to !== record.mode) setMode(w, def.id, t.to)
  return applyEffects(w, t.do, subject, heard)
}
