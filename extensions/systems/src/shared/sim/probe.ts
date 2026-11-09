// Probes: the small vocabulary systems data uses to ask about the world. An agent asks from where it
// stands, with its own senses; a world rule asks about the player. Facts go through puzzle's state, except an
// agent's own (`self.<name>`) and pursuit's (`pursuit.hidden`, `pursuit.hiddenFor`).
import { PuzzleState, type Value } from '@automata/puzzle/sim'
import type { Point } from '@automata/sectors/sim'
import { sortedKeys } from '@automata/sim'
import { isStill } from './probe-kinds'
import { dist, saw, UNHEARD } from './pursuit'
import type { AgentRecord, Noise } from './systems.resource'
import type { AgentDef, Probe, Sense } from './systems.schema'
import type { SystemsWorld } from './world'

/** How close counts as being at a nav node. */
export const AT_NODE = 0.3

/**
 * Who is asking: an agent with its senses, or a world rule (about the player) with its own clock. An agent that stood
 * still this step is `waiting`: at the end of its path ('idle') or at a step it refused ('blocked').
 */
export type Subject =
  | { readonly id: string; readonly def: AgentDef; readonly waiting?: 'idle' | 'blocked' }
  | { readonly id: null; readonly clock: number }

type SenseKey = 'light' | 'sound' | 'sight' | 'warmth' | 'touch'
export function sense<K extends SenseKey>(
  def: AgentDef,
  kind: K,
): Extract<Sense, Record<K, unknown>>[K] | undefined {
  const found = def.senses.find((s) => kind in s) as Record<K, unknown> | undefined
  return found?.[kind] as Extract<Sense, Record<K, unknown>>[K] | undefined
}

/** Where the subject stands: the agent's position, or the player's for a world rule. */
export const here = (w: SystemsWorld, subject: Subject): Point =>
  subject.id === null ? w.player : (w.at[subject.id] as Point)

/** The gameplay light covering `p`: the first disc, in order, that covers it. */
export function lit(w: SystemsWorld, p: Point): Point | null {
  const light = w.env.lights.find((l) => dist(l, p) <= l.radius)
  return light === undefined ? null : { x: light.x, z: light.z }
}

const RECORD_FIELDS = ['mode', 'facing', 'moving', 'timer', 'replan', 'patrol'] as const
type RecordField = (typeof RECORD_FIELDS)[number]
const isRecordField = (key: string): key is RecordField => (RECORD_FIELDS as readonly string[]).includes(key)

/** A fact as a probe or an effect names it. */
export function readFact(w: SystemsWorld, name: string, subject: Subject): unknown {
  if (name.startsWith('self.')) {
    if (subject.id === null) return undefined
    const key = name.slice(5)
    if (key === 'idle') return subject.waiting === 'idle'
    if (key === 'blocked') return subject.waiting === 'blocked'
    const derived = w.options.derived?.[key]
    if (derived !== undefined) return derived(w, subject.id)
    const record = w.state.agents[subject.id] as AgentRecord
    return isRecordField(key) ? record[key] : record.own[key]
  }
  if (name === 'pursuit.hidden') return w.pursuit.hidden
  if (name === 'pursuit.hiddenFor') return w.pursuit.hiddenFor
  const derived = w.options.derived?.[name]
  if (derived !== undefined) return derived(w, subject.id)
  return w.options.facts?.get(w.ctx, name) ?? w.ctx.resource(PuzzleState).facts[name]
}

/** Sets a fact; `pursuit.hidden` set to '' brings the player out of hiding. */
export function setFact(w: SystemsWorld, name: string, to: Value, subject: Subject): void {
  if (name.startsWith('self.')) {
    if (subject.id === null) return
    const record = w.state.agents[subject.id] as AgentRecord
    const key = name.slice(5)
    if (key === 'mode' && typeof to === 'string') record.mode = to
    else if (key === 'moving' && typeof to === 'boolean') record.moving = to
    else if (isRecordField(key) && key !== 'mode' && key !== 'moving' && typeof to === 'number')
      record[key] = to
    else record.own[key] = to
    return
  }
  if (name === 'pursuit.hidden' && typeof to === 'string') {
    w.pursuit.hidden = to
    if (to === '') {
      w.pursuit.hiddenFor = 0
      w.pursuit.watchers = {}
    }
    return
  }
  if (w.options.facts?.set(w.ctx, name, to) === true) return
  w.ctx.resource(PuzzleState).facts[name] = to
}

/**
 * Noises this subject can hear. Sound is heard when it is made, so while the systems react to a noise (`hearing`) that
 * is the only one; otherwise the noises made since the last step (age 0), for `goTo: 'noise'`.
 */
export function heardNoises(w: SystemsWorld, subject: Subject, kind: string, reach?: number): Noise[] {
  const from = here(w, subject)
  const cap = subject.id === null ? undefined : sense(subject.def, 'sound')
  if (subject.id !== null && cap === undefined) return []
  const limit = Math.min(reach ?? Number.POSITIVE_INFINITY, cap?.reach ?? Number.POSITIVE_INFINITY)
  const pool = w.hearing !== undefined ? [w.hearing] : w.noises.filter((n) => n.age === 0)
  // An agent's footfalls are for the player's ears: no agent hears them.
  return pool.filter(
    (n) =>
      (kind === '*' || n.kind === kind) &&
      !(subject.id !== null && UNHEARD.includes(n.kind)) &&
      dist(n, from) <= Math.min(limit, n.loudness),
  )
}

/** Whether a probe holds for this subject now. */
export function probe(w: SystemsWorld, p: Probe, subject: Subject): boolean {
  const spot = here(w, subject)
  const hidden = w.pursuit.hidden !== ''
  if ('not' in p) return !probe(w, p.not, subject)
  if ('inLight' in p) {
    const source = lit(w, spot)
    const cap = p.radius ?? (subject.id === null ? undefined : sense(subject.def, 'light')?.radius)
    return source !== null && dist(source, spot) <= (cap ?? Number.POSITIVE_INFINITY)
  }
  if ('heard' in p) return heardNoises(w, subject, p.heard, p.reach).length > 0
  if ('sees' in p) {
    // Hidden, the player cannot be seen.
    if (subject.id === null || hidden) return false
    const sight = sense(subject.def, 'sight')
    if (sight === undefined || !(dist(spot, w.player) < sight.range)) return false
    const query = sight.wallsOnly === false ? w.walk : w.sight
    return !query.segment(spot, w.player, 0)
  }
  if ('warmthWithin' in p) {
    const sources = subject.id === null ? undefined : sense(subject.def, 'warmth')?.sources
    if (subject.id !== null && sources === undefined) return false
    return w.env.warmth.some(
      (s) =>
        (sources === undefined || s.kind in sources) &&
        dist(s, spot) <= Math.min(p.warmthWithin, sources?.[s.kind] ?? Number.POSITIVE_INFINITY),
    )
  }
  if ('touching' in p) {
    // Hidden, the player cannot be touched: an agent that saw her go in brings her out first (its data unhides her).
    if (hidden) return false
    if (subject.id === null)
      return sortedKeys(w.at).some((id) => dist(w.at[id] as Point, w.player) < (p.radius ?? 0.5))
    return dist(spot, w.player) < (p.radius ?? sense(subject.def, 'touch')?.radius ?? 0)
  }
  if ('fact' in p) return readFact(w, p.fact, subject) === p.is
  if ('mode' in p) return w.state.agents[p.agent ?? subject.id ?? '']?.mode === p.mode
  if ('at' in p) {
    const node = w.graph.nodes[p.at]
    return node !== undefined && dist(spot, node) < AT_NODE
  }
  // More than `timer` seconds: an agent's waiting time, or a world rule's time since it last fired.
  if ('timer' in p)
    return (subject.id === null ? subject.clock : (w.state.agents[subject.id]?.timer ?? 0)) > p.timer
  if ('crossed' in p) return w.pursuit.crossed !== null
  if ('sawHide' in p) {
    const { radius, los } = p.sawHide
    if (subject.id !== null) return saw(w, subject.id, radius, los, (m) => isStill(subject.def, m))
    return sortedKeys(w.state.agents).some((id) => saw(w, id, radius, los))
  }
  return false
}

export const holds = (w: SystemsWorld, when: readonly Probe[], subject: Subject): boolean =>
  when.every((p) => probe(w, p, subject))
