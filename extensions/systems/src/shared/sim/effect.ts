// Effects: what a rule or a transition does, in order. A catch or a cutscene ends the step for the
// rest of the systems (the original's halt).
import { route } from '@automata/nav/sim'
import type { Point } from '@automata/sectors/sim'
import { sortedKeys } from '@automata/sim'
import { heardNoises, lit, type Subject, setFact } from './probe'
import { dist, FOLLOW_CLEAR, portal, zoneAt } from './pursuit'
import { reachable } from './reserve'
import { SystemsCaught, SystemsCutscene, SystemsLine, SystemsNoise } from './systems.event'
import type { AgentRecord, Noise } from './systems.resource'
import type { SysEffect } from './systems.schema'
import { type SystemsWorld, setMode } from './world'

/** What an effect did that ends a step: the player caught, or a cutscene started. */
export type Outcome = 'caught' | 'cutscene' | null

/** Where a named place is: the player, the noise heard, a light or warm thing, a nav node, an agent, or a point. */
export function place(w: SystemsWorld, target: string | Point, subject: Subject): Point | null {
  if (typeof target !== 'string') return { x: target.x, z: target.z }
  const actor = subject.id === null ? w.player : (w.at[subject.id] as Point)
  switch (target) {
    case 'player':
      return { x: w.player.x, z: w.player.z }
    case 'self':
      return { x: actor.x, z: actor.z }
    case 'noise': {
      const heard = heardNoises(w, subject, '*')
      const n = heard[heard.length - 1]
      return n === undefined ? null : { x: n.x, z: n.z }
    }
    case 'light':
      return lit(w, actor)
    case 'warmth': {
      let best: Point | null = null
      for (const s of w.env.warmth)
        if (best === null || dist(s, actor) < dist(best, actor)) best = { x: s.x, z: s.z }
      return best
    }
    default: {
      const node = w.graph.nodes[target]
      if (node !== undefined) return { x: node.x, z: node.z }
      const agent = w.at[target]
      return agent === undefined ? null : { x: agent.x, z: agent.z }
    }
  }
}

/** The nav node to run to from `source`: far from it, not far from here, reachable and out of the light. */
export function fleeNode(w: SystemsWorld, id: string, source: Point): Point | null {
  const from = w.at[id] as Point
  let best: Point | null = null
  let score = Number.NEGATIVE_INFINITY
  for (const nodeId of sortedKeys(w.graph.nodes)) {
    const node = w.graph.nodes[nodeId] as Point
    if (!reachable(w.ctx, nodeId, id) || lit(w, node) !== null) continue
    const s = dist(node, source) - dist(node, from) * 0.35
    if (s > score) {
      score = s
      best = { x: node.x, z: node.z }
    }
  }
  return best
}

/** Gives an agent a goal and the route to it from where it stands. */
export function goTo(w: SystemsWorld, id: string, goal: Point | null): void {
  const record = w.state.agents[id] as AgentRecord
  record.goal = goal === null ? null : { x: goal.x, z: goal.z }
  record.path =
    goal === null ? [] : route(w.at[id] as Point, goal, w.graph, w.walk).map((p) => ({ x: p.x, z: p.z }))
}

/** Makes a noise: on the world and emitted. `hear` also has the systems react to it. */
export function makeNoise(w: SystemsWorld, noise: Noise): void {
  w.noises.push(noise)
  w.ctx.emit(SystemsNoise, { at: { x: noise.x, z: noise.z }, loudness: noise.loudness, kind: noise.kind })
}

/** Applies one effect for `subject` (an agent acting, or a world rule). */
export function applyEffect(
  w: SystemsWorld,
  effect: SysEffect,
  subject: Subject,
  heard: (n: Noise) => void,
): Outcome {
  const actor = subject.id === null ? undefined : (w.state.agents[subject.id] as AgentRecord)
  if ('setMode' in effect) {
    const target = effect.agent ?? subject.id
    if (target !== null) setMode(w, target, effect.setMode)
    return null
  }
  if ('goTo' in effect || 'flee' in effect) {
    if (subject.id === null) return null
    if ('goTo' in effect) goTo(w, subject.id, place(w, effect.goTo, subject))
    else {
      const source = place(w, effect.flee, subject)
      goTo(w, subject.id, source === null ? null : fleeNode(w, subject.id, source))
    }
    return null
  }
  if ('noise' in effect) {
    const at = place(w, effect.noise.at, subject)
    if (at === null) return null
    heard({ x: at.x, z: at.z, loudness: effect.noise.loudness, kind: effect.noise.kind, age: 0 })
    return null
  }
  if ('set' in effect) {
    setFact(w, effect.set, effect.to, subject)
    return null
  }
  if ('emit' in effect) {
    const e = effect.emit
    if ('cutscene' in e) {
      w.ctx.emit(SystemsCutscene, { id: e.cutscene })
      return 'cutscene'
    }
    if ('caught' in e) {
      w.ctx.emit(SystemsCaught, { cause: e.caught })
      return 'caught'
    }
    w.ctx.emit(SystemsLine, { by: subject.id ?? 'world', line: e.line })
    return null
  }
  if ('followThrough' in effect) {
    if (subject.id === null || actor === undefined) return null
    const f = effect.followThrough
    const through = f.portal === 'crossed' ? w.pursuit.last : portal(w, f.portal)
    // Already on the player's side, or no portal to follow her through: on with the chase.
    if (through === null || zoneAt(w, w.at[subject.id] as Point) === through.zone) {
      setMode(w, subject.id, f.then)
      return null
    }
    actor.pending = {
      mode: actor.mode,
      at: { x: through.into.x, z: through.into.z },
      in: f.delay,
      hold: 0,
      clear: f.clear ?? FOLLOW_CLEAR,
      then: f.then,
      zone: through.zone,
    }
    goTo(w, subject.id, through.into)
    actor.timer = 0
    return null
  }
  if ('ambush' in effect) {
    const a = effect.ambush
    const agent = w.state.agents[a.agent]
    const at = place(w, a.at, subject)
    if (w.pursuit.ambushes[a.id] === true || agent === undefined || at === null) return null
    w.pursuit.ambushes[a.id] = true
    setMode(w, a.agent, a.mode)
    agent.path = []
    agent.goal = null
    agent.moving = false
    agent.timer = 0
    agent.pending = { mode: a.mode, at, in: a.sting, hold: a.grace, clear: FOLLOW_CLEAR, then: a.then }
    return null
  }
  if ('call' in effect) {
    const hook = w.options.hooks?.[effect.call]
    if (hook !== undefined) hook(w, subject.id)
    // `stop` is built in: it drops the agent's path. (A content check refuses any other undeclared hook.)
    else if (effect.call === 'stop' && actor !== undefined) actor.path = []
    else throw new Error(`systems: no hook ${effect.call}`)
  }
  return null
}

/** Applies effects in order; stops at the first that ends the step, and says which. */
export function applyEffects(
  w: SystemsWorld,
  effects: readonly SysEffect[] | undefined,
  subject: Subject,
  heard: (n: Noise) => void,
): Outcome {
  for (const e of effects ?? []) {
    const outcome = applyEffect(w, e, subject, heard)
    if (outcome !== null) return outcome
  }
  return null
}
