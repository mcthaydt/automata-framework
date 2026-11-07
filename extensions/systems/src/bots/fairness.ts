// Fairness (M6 spec §4.6), from the adventure source's `fairness`: the rows a playtest and its scenarios are rated on.
// A row with nothing measured passes, except the cautious-bot win rate, which needs runs.
import type { Fairness, SystemsDef } from '../sim/index'
import type { PlaytestRun, ScenarioResult } from './results'

export interface FairnessRow {
  readonly id: keyof Fairness
  readonly label: string
  readonly value: number | null
  readonly threshold: number
  readonly comparison: '≥' | '≤'
  readonly ok: boolean
  readonly detail: string
}
export interface FairnessInput {
  readonly runs: readonly PlaytestRun[]
  readonly scenarios?: readonly ScenarioResult[]
}
/** A scene's safe window, measured: its name and length. */
export interface SafeWindow {
  readonly name: string
  readonly length: number
}

const median = (xs: readonly number[]): number => {
  const v = [...xs].sort((a, b) => a - b)
  return v.length > 0 ? (v[Math.floor((v.length - 1) / 2)] as number) : Number.NaN
}
const minOf = (xs: readonly number[]): number | null => (xs.length > 0 ? Math.min(...xs) : null)
const maxOf = (xs: readonly number[]): number | null => (xs.length > 0 ? Math.max(...xs) : null)
const spread = (xs: readonly number[], unit: string): string =>
  xs.length > 0 ? `median ${median(xs).toFixed(2)} ${unit} over ${xs.length}` : 'none measured'

/** The modes a follow or an ambush puts an agent in, from the data. */
export function pursuitModes(def: SystemsDef): { follow: Set<string>; ambush: Set<string> } {
  const follow = new Set<string>()
  const ambush = new Set<string>()
  const effects = [
    ...def.rules.flatMap((r) => r.then),
    ...def.agents.flatMap((a) => [
      ...a.transitions.flatMap((t) => t.do ?? []),
      ...(a.routine ?? []).flatMap((r) => r.do ?? []),
    ]),
  ]
  for (const agent of def.agents)
    for (const t of agent.transitions) if ((t.do ?? []).some((e) => 'followThrough' in e)) follow.add(t.to)
  for (const e of effects) if ('ambush' in e) ambush.add(e.ambush.mode)
  return { follow, ambush }
}
/** Agent modes that count as a threat: hunting, following through a door, springing an ambush. */
export const threatModes = (def: SystemsDef): string[] => {
  const m = pursuitModes(def)
  return ['hunt', ...[...m.follow].sort(), ...[...m.ambush].sort()]
}

function margin(input: FairnessInput, f: Fairness, window?: SafeWindow): FairnessRow {
  const row = {
    id: 'safeWindowMargin' as const,
    label: 'safe-window margin',
    threshold: f.safeWindowMargin,
    comparison: '≥' as const,
  }
  if (window === undefined)
    return { ...row, value: null, ok: true, detail: 'not measured: the scene times no window against a task' }
  const uses = input.runs
    .filter((r) => r.outcome === 'win' && r.window != null)
    .map((r) => window.length / Math.max(1e-6, (r.window?.won ?? 0) - (r.window?.opened ?? 0)))
  if (uses.length === 0)
    return { ...row, value: null, ok: true, detail: `no run won inside the ${window.name} window` }
  const value = Math.min(...uses)
  return {
    ...row,
    value,
    ok: value >= f.safeWindowMargin,
    detail: `${window.name}, ${window.length} s: ${spread(uses, '')}`,
  }
}

export function fairness(
  input: FairnessInput,
  f: Fairness,
  def?: SystemsDef,
  window?: SafeWindow,
): FairnessRow[] {
  const cautious = input.runs.filter((r) => r.policy === 'cautious')
  const pool = cautious.length > 0 ? cautious : input.runs
  const wins = pool.filter((r) => r.outcome === 'win').length
  const threats = input.runs.map((r) => r.firstThreat).filter((x): x is number => x !== null)
  const telegraphs = input.runs.flatMap((r) => r.telegraphs)
  const deaths = pool.map((r) => r.deaths.length)
  const rows: Omit<FairnessRow, 'ok'>[] = [
    {
      id: 'cautiousWin',
      label: 'cautious-bot win rate',
      value: pool.length > 0 ? wins / pool.length : null,
      threshold: f.cautiousWin,
      comparison: '≥',
      detail: `${wins}/${pool.length} ${cautious.length > 0 ? 'cautious' : 'all'} runs won`,
    },
    {
      id: 'firstThreatAfter',
      label: 'time to the first threat (s, earliest run)',
      value: minOf(threats),
      threshold: f.firstThreatAfter,
      comparison: '≥',
      detail: spread(threats, 's'),
    },
    {
      id: 'telegraph',
      label: 'telegraph before a catch (s, shortest)',
      value: minOf(telegraphs),
      threshold: f.telegraph,
      comparison: '≥',
      detail: spread(telegraphs, 's'),
    },
    {
      id: 'maxDeathsPerRun',
      label: 'deaths per run (most)',
      value: maxOf(deaths),
      threshold: f.maxDeathsPerRun,
      comparison: '≤',
      detail: `${deaths.reduce((a, b) => a + b, 0)} deaths in ${deaths.length} runs`,
    },
  ]
  // The pursuit's guarantees, over the full runs and the scenarios, where the scene sets the threshold.
  const measured = [
    ...input.runs,
    ...(input.scenarios ?? []).flatMap((x) => (x.pursuit === undefined ? [] : [x.pursuit])),
  ]
  const follow = def === undefined ? undefined : pursuitModes(def).follow
  const gaps = measured.flatMap((m) =>
    m.appearances.filter((a) => follow === undefined || follow.has(a.mode)).map((a) => a.gap),
  )
  const ambushes = measured.flatMap((m) => m.ambushCatches)
  const hides = measured.flatMap((m) => m.hides)
  if (f.ambushGrace !== undefined)
    rows.push({
      id: 'ambushGrace',
      label: 'ambush to a catch (s, shortest)',
      value: minOf(ambushes),
      threshold: f.ambushGrace,
      comparison: '≥',
      detail: spread(ambushes, 's'),
    })
  if (f.followClear !== undefined)
    rows.push({
      id: 'followClear',
      label: 'door-follow distance from the player (m, closest)',
      value: minOf(gaps),
      threshold: f.followClear,
      comparison: '≥',
      detail: spread(gaps, 'm'),
    })
  if (f.hideRelease !== undefined)
    rows.push({
      id: 'hideRelease',
      label: 'a threat after the player hid (s, longest)',
      value: maxOf(hides),
      threshold: f.hideRelease,
      comparison: '≤',
      detail: spread(hides, 's'),
    })
  const rated = rows.map((row) => ({
    ...row,
    ok:
      row.value === null
        ? row.id !== 'cautiousWin'
        : row.comparison === '≥'
          ? row.value >= row.threshold
          : row.value <= row.threshold,
  }))
  const safe = margin(input, f, window)
  return [...rated.slice(0, 4), safe, ...rated.slice(4)]
}
