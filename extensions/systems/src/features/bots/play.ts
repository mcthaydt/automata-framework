// One run of a bot in a real sim: the bot answers each step's view with
// commands, and the run measures what fairness rates. A catch reloads the last checkpoint (or the start) until the run
// has caught the player more than `maxDeaths` times.
import { PuzzleState } from '@automata/puzzle/sim'
import type { Point } from '@automata/sectors/sim'
import { canonicalJson, createRng, type Sim, type SimEvent } from '@automata/sim'
import { SystemsPursuit, SystemsState } from '../../shared/sim/systems.resource'
import type { Probe } from '../../shared/sim/systems.schema'
import { createWatch } from '../../shared/sim/watch.plugin'
import { SystemsWatch } from '../../shared/sim/watch.resource'
import type { Bot } from './bot'
import { pursuitModes, threatModes } from './fairness'
import type { Appearance, Death, RunResult, ThreatCause } from './results'
import type { Setup, SystemsScene } from './scene'
import type { Order } from './view'

export interface PlayOptions {
  readonly bot: Bot
  readonly seed: number
  /** Seconds the run may take. */
  readonly limit: number
  readonly setup?: Setup | undefined
  /** A scenario's condition: the run ends when it holds. */
  readonly until?: readonly Probe[] | undefined
  /** The agent the condition asks as (else a world rule). */
  readonly as?: string | undefined
  /** Catches the run survives (each reloads); one more loses. Default 3. */
  readonly maxDeaths?: number | undefined
  /** Metres each placed agent is moved, from the seed, so seeds differ (the original's 0.25 for scenarios). */
  readonly jitter?: number | undefined
}

/** A step this far (m) is an appearance, not a walk. */
const JUMP = 0.5
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.z - b.z)

function jittered(setup: Setup, seed: number, jitter: number): Setup {
  if (jitter === 0 || setup.place === undefined) return setup
  const rng = createRng(seed)
  const place: Record<string, Point> = {}
  for (const id of Object.keys(setup.place).sort()) {
    const p = setup.place[id] as Point
    place[id] = { x: p.x + (rng.next() * 2 - 1) * jitter, z: p.z + (rng.next() * 2 - 1) * jitter }
  }
  return { ...setup, place }
}

const stamp = (sim: Sim, orders: readonly Order[]) =>
  sim.step(orders.map((order, seq) => ({ tick: sim.tick, source: 0, seq, ...order })))

/** What was going on when agent `a` first became a threat. */
function causeOf(
  sim: Sim,
  a: { readonly id: string; readonly x: number; readonly z: number; readonly mode: string },
  player: Point,
  issued: readonly string[],
  verbAt: number | null,
  t: number,
): ThreatCause {
  const record = sim.resource(SystemsState).agents[a.id]
  const state: Record<string, string | number | boolean | null> = {}
  for (const k of Object.keys(record?.own ?? {}).sort()) state[k] = record?.own[k] ?? null
  const verbs = issued.filter((token) => token !== 'light')
  const round = (n: number) => Math.round(n * 100) / 100
  return {
    agent: a.id,
    mode: a.mode,
    moving: record?.moving ?? false,
    distance: round(distance(a, player)),
    goalToPlayer: record?.goal == null ? null : round(distance(record.goal, player)),
    state,
    lastVerb: verbs[verbs.length - 1] ?? null,
    sinceVerb: verbAt === null || verbs.length === 0 ? null : round(t - verbAt),
  }
}

export async function play(scene: SystemsScene, o: PlayOptions): Promise<RunResult> {
  const sim = await scene.create(o.until === undefined ? [] : [createWatch(scene.options, o.until, o.as)])
  try {
    return run(sim, scene, o)
  } finally {
    sim.dispose()
  }
}

function run(sim: Sim, scene: SystemsScene, o: PlayOptions): RunResult {
  const hz = sim.tickHz
  const threat = new Set(threatModes(scene.def))
  const { follow, ambush } = pursuitModes(scene.def)
  const maxDeaths = o.maxDeaths ?? 3
  const deaths: Death[] = []
  const telegraphs: number[] = []
  const modes: Record<string, number> = {}
  const safeWindows: number[] = []
  const skeleton: string[] = []
  const appearances: Appearance[] = []
  const ambushCatches: number[] = []
  const hides: number[] = []
  const threatSince: Record<string, number> = {}
  const ambushedAt: Record<string, number> = {}
  let firstThreat: number | null = null
  let safeFrom = 0
  let hide: { from: number; last: number } | undefined
  let conditionAt: number | null = null
  let cause: ThreatCause | null = null
  let verbAt: number | null = null
  let outcome: RunResult['outcome'] = 'timeout'
  let last: Record<string, Point> = {}

  stamp(sim, scene.start(jittered(o.setup ?? {}, o.seed, o.jitter ?? 0)))
  let checkpoint = sim.snapshot()
  const steps = Math.round(o.limit * hz)
  let step = 1
  for (; step <= steps; step++) {
    const t = step / hz
    const before = canonicalJson(sim.resource(PuzzleState))
    const issued = o.bot.issued.length
    const events: readonly SimEvent[] = stamp(sim, o.bot.next(scene.view(sim, (step - 1) / hz))).events
    if (o.bot.issued.length > issued) verbAt = (step - 1) / hz
    if (canonicalJson(sim.resource(PuzzleState)) !== before)
      skeleton.push(...o.bot.issued.slice(issued).filter((token) => token !== 'light'))
    const view = scene.view(sim, t)
    // Threats, modes, appearances.
    let threatened = false
    for (const a of view.agents) {
      modes[a.mode] = (modes[a.mode] ?? 0) + 1 / hz
      if (threat.has(a.mode)) {
        threatened = true
        if (threatSince[a.id] === undefined) threatSince[a.id] = t
        if (firstThreat === null) {
          firstThreat = t
          cause = causeOf(sim, a, view.player, o.bot.issued, verbAt, t)
        }
      } else delete threatSince[a.id]
      const was = last[a.id]
      if (was !== undefined && distance(was, a) > JUMP && (follow.has(a.mode) || ambush.has(a.mode))) {
        appearances.push({ t, agent: a.id, mode: a.mode, gap: distance(a, view.player) })
        if (ambush.has(a.mode)) ambushedAt[a.id] = t
      }
    }
    last = Object.fromEntries(view.agents.map((a) => [a.id, { x: a.x, z: a.z }]))
    if (threatened && safeFrom >= 0) {
      if (t - safeFrom > 0) safeWindows.push(t - safeFrom)
      safeFrom = -1
    } else if (!threatened && safeFrom < 0) safeFrom = t
    // Hiding: how long an agent stays a threat after the player hid.
    const hidden = sim.resource(SystemsPursuit).hidden !== ''
    if (hidden && hide === undefined) hide = { from: t, last: t }
    if (hide !== undefined && threatened) hide.last = t
    if (!hidden && hide !== undefined) {
      hides.push(hide.last - hide.from)
      hide = undefined
    }
    if (events.some((e) => e.type === 'puzzle.checkpoint')) checkpoint = sim.snapshot()
    if (events.some((e) => e.type === 'puzzle.goal')) {
      outcome = 'win'
      break
    }
    const caught = events.find((e) => e.type === 'systems.caught')
    if (caught !== undefined) {
      // The catching agent: the nearest threat (the event names a cause, not an agent).
      const by = [...view.agents]
        .filter((a) => threat.has(a.mode))
        .sort((a, b) => distance(a, view.player) - distance(b, view.player) || (a.id < b.id ? -1 : 1))[0]
      const since = by === undefined ? undefined : threatSince[by.id]
      const telegraph = since === undefined ? null : t - since
      deaths.push({ cause: (caught.payload as { cause: string }).cause, t, telegraph })
      if (telegraph !== null) telegraphs.push(telegraph)
      const ambushed = by === undefined ? undefined : ambushedAt[by.id]
      if (ambushed !== undefined) ambushCatches.push(t - ambushed)
      if (deaths.length > maxDeaths) {
        outcome = 'lose'
        break
      }
      sim.restore(checkpoint)
      o.bot.restart()
      for (const id of Object.keys(threatSince)) delete threatSince[id]
      last = {}
      continue
    }
    if (o.until !== undefined && sim.resource(SystemsWatch).held) {
      outcome = 'condition'
      conditionAt = t
      break
    }
  }
  const end = Math.min(step, steps) / hz
  if (safeFrom >= 0 && end - safeFrom > 0) safeWindows.push(end - safeFrom)
  if (hide !== undefined) hides.push(hide.last - hide.from)
  return {
    outcome,
    time: end,
    deaths,
    firstThreat,
    telegraphs,
    modes,
    safeWindows,
    skeleton,
    conditionAt,
    cause,
    appearances,
    ambushCatches,
    hides,
  }
}
