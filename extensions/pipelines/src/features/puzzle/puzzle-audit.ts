// The scene audit: what the puzzle, its systems and its
// generated files say about a scene, for the people who decide. Its findings never fail `check` (a stale doc does,
// through its file row). Objective guidance, emergent search and recorded gate decisions are not part of it.
import type { FairnessRow, Policy, ThreatCause } from '@automata/systems/bots'
import type { FileStatus } from '../../shared/file-status.ts'

export type { ThreatCause }

export interface AuditRun {
  readonly route: string
  readonly policy: Policy
  readonly seed: number
  readonly outcome: string
  readonly time: number
  readonly deaths: number
  readonly firstThreat: number | null
  readonly cause: ThreatCause | null
}
export interface AuditFinding {
  readonly level: 'fix' | 'watch' | 'note'
  readonly id: string
  readonly detail: string
}
export interface Audit {
  readonly scene: string
  readonly sources: readonly { readonly path: string; readonly hash: string }[]
  readonly puzzle: {
    readonly routes: readonly { readonly name: string; readonly steps: number; readonly seconds: number }[]
    readonly states: number
    readonly softlocks: number
    readonly never: readonly string[]
  }
  readonly systems: null | {
    readonly policies: readonly string[]
    readonly seeds: number
    readonly scenarios: readonly { readonly id: string; readonly ok: boolean; readonly detail: string }[]
    readonly fairness: readonly FairnessRow[]
    readonly runs: readonly AuditRun[]
  }
  readonly files: readonly FileStatus[]
  readonly findings: readonly AuditFinding[]
}

const r2 = (n: number): number => Math.round(n * 100) / 100
const fmt = (n: number | null): string => (n === null ? '—' : String(r2(n)))
/** Groups by a key, in first-seen order. */
function by<T>(xs: readonly T[], key: (x: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const x of xs) out.set(key(x), [...(out.get(key(x)) ?? []), x])
  return out
}
const stateText = (state: ThreatCause['state']): string =>
  Object.keys(state)
    .map((k) => `${k} ${String(state[k])}`)
    .join(', ')

/** The earliest first threat on each route, over every policy and seed. */
export function earliestByRoute(runs: readonly AuditRun[]): { route: string; run: AuditRun | null }[] {
  return [...by(runs, (r) => r.route)].map(([route, rs]) => ({
    route,
    run:
      rs
        .filter((r) => r.firstThreat !== null)
        .sort((a, b) => (a.firstThreat as number) - (b.firstThreat as number))[0] ?? null,
  }))
}

function causeText(c: ThreatCause): string {
  const parts = [`${c.agent} ${c.mode}${c.moving ? ', moving' : ''}, ${c.distance} m from the player`]
  if (c.goalToPlayer !== null) parts.push(`heading for a point ${c.goalToPlayer} m from her`)
  const own = Object.keys(c.state).filter((k) => typeof c.state[k] === 'string')
  if (own.length > 0) parts.push(own.map((k) => `${k} ${String(c.state[k])}`).join(', '))
  if (c.lastVerb !== null)
    parts.push(`the player's last verb ${c.lastVerb}, issued ${c.sinceVerb ?? 0} s before`)
  return parts.join('; ')
}

export function findingsOf(a: Audit): AuditFinding[] {
  const out: AuditFinding[] = []
  const sys = a.systems
  if (sys !== null) {
    for (const f of sys.fairness.filter((f) => !f.ok))
      out.push({
        level: 'watch',
        id: `fairness:${f.id}`,
        detail: `${f.label}: ${fmt(f.value)}, against ${f.comparison} ${f.threshold} (${f.detail})`,
      })
    const limit = sys.fairness.find((f) => f.id === 'firstThreatAfter')?.threshold ?? null
    for (const { route, run } of earliestByRoute(sys.runs)) {
      if (run === null || limit === null || (run.firstThreat as number) >= limit) continue
      out.push({
        level: 'watch',
        id: `first-threat:${route}`,
        detail: `first threat at ${run.firstThreat} s on "${route}" (${run.policy}, seed ${run.seed}): ${run.cause === null ? 'no cause recorded' : causeText(run.cause)}`,
      })
    }
    for (const [key, rs] of by(sys.runs, (r) => `${r.route}\u0000${r.policy}`)) {
      if (rs.some((r) => r.outcome === 'win')) continue
      const [route, policy] = key.split('\u0000')
      const deaths = rs.reduce((n, r) => n + r.deaths, 0)
      out.push({
        level: 'watch',
        id: `never-wins:${policy}:${route}`,
        detail: `the ${policy} bot never wins "${route}": 0 of ${rs.length} runs, ${deaths} deaths, outcomes ${[...new Set(rs.map((r) => r.outcome))].join(', ')}`,
      })
    }
    const deaths = by(
      sys.runs.filter((r) => r.deaths > 0),
      (r) => r.policy,
    )
    const total = sys.runs.reduce((n, r) => n + r.deaths, 0)
    if (total > 0 && deaths.size === 1) {
      const [policy, rs] = [...deaths][0] as [string, AuditRun[]]
      out.push({
        level: 'note',
        id: `deaths:${policy}`,
        detail: `all ${total} deaths are the ${policy} bot's, on ${[...new Set(rs.map((r) => `"${r.route}"`))].join(', ')}`,
      })
    }
    for (const sc of sys.scenarios.filter((sc) => !sc.ok))
      out.push({ level: 'fix', id: `scenario:${sc.id}`, detail: `scenario ${sc.id} fails: ${sc.detail}` })
  }
  if (a.puzzle.softlocks > 0)
    out.push({
      level: 'fix',
      id: 'softlocks',
      detail: `${a.puzzle.softlocks} softlocks in ${a.puzzle.states} states`,
    })
  if (a.puzzle.never.length > 0)
    out.push({
      level: 'fix',
      id: 'never-taken',
      detail: `never taken in any reachable state: ${a.puzzle.never.join(', ')} (dead data, or a gap in the solver model)`,
    })
  for (const f of a.files.filter((f) => !f.ok))
    out.push({ level: 'fix', id: `file:${f.path}`, detail: `${f.path} ${f.detail}` })
  const order = { fix: 0, watch: 1, note: 2 }
  return out.sort((x, y) => order[x.level] - order[y.level])
}

export const AUDIT = 'audit.md'

export function renderAudit(a: Audit): string {
  const L: string[] = [
    `<!-- Generated by \`automata pipe puzzle run ${a.scene}\`. Do not edit: change the scene and regenerate. -->`,
    `<!-- sources: ${a.sources.map((s) => `${s.path} xxh64 ${s.hash}`).join('; ')} -->`,
    '',
    `# ${a.scene}: audit (generated)`,
    '',
    `> What the puzzle, its systems and its generated files say about the scene. The bots play the systems playtest's runs (every route × ${a.systems === null ? 'policy' : a.systems.policies.join(' and ')} bot × ${a.systems?.seeds ?? 0} seeds), watched for their first threat. Findings never fail \`check\`; a stale doc does.`,
    '',
    '## Findings',
    '',
  ]
  if (a.findings.length === 0) L.push('None.')
  else
    L.push(
      '| Level | Finding |',
      '| --- | --- |',
      ...a.findings.map((f) => `| ${f.level} | ${f.detail.replace(/\|/g, '\\|')} |`),
    )
  L.push(
    '',
    '## Puzzle',
    '',
    `- **Routes:** ${a.puzzle.routes.length}; **softlocks:** ${a.puzzle.softlocks} in ${a.puzzle.states} reachable states.`,
    `- **Never taken:** ${a.puzzle.never.length > 0 ? a.puzzle.never.map((n) => `\`${n}\``).join(', ') : 'none'}.`,
    '',
    '| Route | Steps | Seconds (floor) |',
    '| --- | --- | --- |',
    ...a.puzzle.routes.map((r) => `| ${r.name} | ${r.steps} | ${r.seconds} |`),
  )
  const sys = a.systems
  if (sys !== null) {
    L.push(
      '',
      '## Fairness',
      '',
      '| Metric | Value | Target | | Detail |',
      '| --- | --- | --- | --- | --- |',
      ...sys.fairness.map(
        (f) =>
          `| ${f.label} | ${fmt(f.value)} | ${f.comparison} ${f.threshold} | ${f.ok ? 'ok' : 'miss'} | ${f.detail} |`,
      ),
    )
    L.push(
      '',
      '## First threat by route',
      '',
      'The earliest first threat on each route over every bot and seed, and what was going on at that moment.',
      '',
      "| Route | First threat | Bot | Agent and mode | Distance to the player | Its goal to the player | Agent state | The player's last verb |",
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
    )
    for (const { route, run } of earliestByRoute(sys.runs)) {
      const c = run?.cause ?? null
      L.push(
        run !== null && c !== null
          ? `| ${route} | ${run.firstThreat} s | ${run.policy}, seed ${run.seed} | ${c.agent}, ${c.mode}${c.moving ? ', moving' : ''} | ${c.distance} m | ${c.goalToPlayer === null ? '—' : `${c.goalToPlayer} m`} | ${stateText(c.state) || '—'} | ${c.lastVerb === null ? '—' : `\`${c.lastVerb}\`, ${c.sinceVerb ?? 0} s before`} |`
          : `| ${route} | none | | | | | | |`,
      )
    }
    L.push(
      '',
      '## Outcomes by route and bot',
      '',
      '| Route | Bot | Runs | Wins | Deaths | Other outcomes | Median time |',
      '| --- | --- | --- | --- | --- | --- | --- |',
    )
    for (const [key, rs] of by(sys.runs, (r) => `${r.route}\u0000${r.policy}`)) {
      const [route, policy] = key.split('\u0000')
      const times = rs.map((r) => r.time).sort((x, y) => x - y)
      const other =
        [
          ...by(
            rs.filter((r) => r.outcome !== 'win'),
            (r) => r.outcome,
          ),
        ]
          .map(([o, xs]) => `${o} ${xs.length}`)
          .join(', ') || '—'
      L.push(
        `| ${route} | ${policy} | ${rs.length} | ${rs.filter((r) => r.outcome === 'win').length} | ${rs.reduce((n, r) => n + r.deaths, 0)} | ${other} | ${r2(times[Math.floor((times.length - 1) / 2)] as number)} s |`,
      )
    }
    L.push(
      '',
      '## Scenarios',
      '',
      '| Scenario | Result |',
      '| --- | --- |',
      ...sys.scenarios.map((s) => `| ${s.id} | ${s.ok ? 'pass' : 'FAIL'}: ${s.detail} |`),
    )
  } else L.push('', '## Systems', '', 'The scene module exports no systems scene: no agents to audit.')
  L.push(
    '',
    '## Generated files',
    '',
    '| File | Status |',
    '| --- | --- |',
    ...a.files.map((f) => `| \`${f.path}\` | ${f.ok ? 'current' : f.detail} |`),
  )
  return `${L.join('\n')}\n`
}
