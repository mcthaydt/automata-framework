// Beat coverage and the hint cross-check. Pure: the caller plays the
// puzzle solver's routes in the sim (`traces.ts`) and hands over what each one showed.
import type { Lethal } from '@automata/puzzle/sim'
import type { Beat } from '../../shared/beats.schema'
import type { LineRecord } from '../../shared/sim/lines.schema'
import { collect, type Finding } from './finding'
import { shown, type Trace } from './traces'

export interface BeatReport {
  readonly id: string
  readonly required: boolean
  readonly learn: string
  /** Routes that deliver it, by name. */
  readonly delivered: readonly string[]
  /** Routes that do not. */
  readonly missing: readonly string[]
  /** delivered / routes. */
  readonly reach: number
}

/**
 * Required beats on every route, `after` order on every route that delivers a beat, and each optional beat's reach.
 * A beat is delivered by the first of its `deliveredBy` lines a route shows.
 */
export function beatCoverage(
  beats: readonly Beat[],
  traces: readonly Trace[],
): { beats: BeatReport[]; findings: Finding[] } {
  const { findings, add } = collect()
  const at = traces.map((t) => {
    const lines = shown(t)
    const first = new Map<string, number>()
    for (const b of beats) {
      const i = lines.findIndex((id) => b.deliveredBy.includes(id))
      if (i >= 0) first.set(b.id, i)
    }
    return first
  })
  for (const t of traces)
    if (!t.goal) add('error', 'route', t.route, 'the route did not reach the goal in the simulation')
  const reports = beats.map((b) => {
    const delivered = traces.filter((_, i) => at[i]?.has(b.id)).map((t) => t.route)
    const missing = traces.filter((_, i) => !at[i]?.has(b.id)).map((t) => t.route)
    if (b.required)
      for (const r of missing)
        add(
          'error',
          'required',
          b.id,
          `not delivered on route "${r}" (by any of ${b.deliveredBy.join(', ')})`,
        )
    traces.forEach((t, i) => {
      const mine = at[i]?.get(b.id)
      if (mine === undefined) return
      for (const before of b.after ?? []) {
        const theirs = at[i]?.get(before)
        if (theirs === undefined)
          add(
            'error',
            'order',
            b.id,
            `delivered on route "${t.route}" without ${before}, which must come first`,
          )
        else if (theirs > mine)
          add('error', 'order', b.id, `delivered on route "${t.route}" before ${before}`)
      }
    })
    return {
      id: b.id,
      required: b.required,
      learn: b.learn,
      delivered,
      missing,
      reach: traces.length > 0 ? delivered.length / traces.length : 0,
    }
  })
  for (const r of reports)
    if (!r.required && traces.length > 0 && r.delivered.length === 0)
      add(
        'warning',
        'reach',
        r.id,
        'optional, and no solver route delivers it (it is found only off the routes)',
      )
  return { beats: reports, findings }
}

/** What a hint action showed when played, at the first point on a route where it can be taken before the risk. */
export interface HintProbe {
  readonly lethal: string
  readonly route: string
  readonly action: string
  readonly lines: readonly string[]
}
/** The parts of a systems definition the hint check reads: the game passes its own, which has more. */
export interface HintSystems {
  readonly rules: readonly { readonly id: string; readonly text: string; readonly then: readonly object[] }[]
  readonly agents: readonly {
    readonly id: string
    readonly modes: readonly string[]
    readonly transitions: readonly {
      readonly from: string
      readonly to: string
      readonly do?: readonly object[] | undefined
    }[]
  }[]
}
export interface HintInput {
  readonly records: readonly LineRecord[]
  readonly lethal: readonly Lethal[]
  /** One probe per lethal rule, route and `hintedBy` action the route can take before the risk. */
  readonly probes: readonly HintProbe[]
  /** Each lethal rule and route whose risk the route exposes (at `step`), so a rule with no probe there is caught. */
  readonly exposes: readonly { readonly lethal: string; readonly route: string; readonly step: number }[]
  readonly systems?: HintSystems | undefined
  /** Before the story's last act an agent mode without barks is a warning; from then on, an error. */
  readonly barksRequired: boolean
  /** Agents who bark little by design: their silent modes are always a warning. */
  readonly quiet?: readonly string[] | undefined
  readonly scene: string
}
/** A bark for an agent's mode is a `bark` record spoken by the agent, with the id `<scene>.<agent>.<mode>.<n>`. */
export const barkPattern = (scene: string, agent: string, mode: string): RegExp =>
  new RegExp(`^${scene}\\.${agent}\\.${mode}\\.[^.]+$`)

interface Emitting {
  readonly emit?: { readonly line?: string; readonly caught?: string } | undefined
}
const condEmits = (x: object): Emitting['emit'] => (x as Emitting).emit

/**
 * Every lethal rule's `hintedBy` actions show a line tagged with the rule (`hints`) wherever a route can take them
 * before the risk; on every route at least one of them does. With systems: every rule that can catch the player is
 * hinted by a tagged line, every line a systems effect emits exists, and every agent mode has two barks.
 */
export function hintCheck(input: HintInput): {
  rules: { id: string; tagged: string[]; ok: boolean }[]
  findings: Finding[]
} {
  const { findings, add } = collect()
  const byId = new Map(input.records.map((r) => [r.id, r]))
  const tagged = (rule: string): string[] =>
    input.records.filter((r) => r.hints?.includes(rule)).map((r) => r.id)
  const hints = (lines: readonly string[], rule: string): boolean =>
    lines.some((id) => byId.get(id)?.hints?.includes(rule))
  const rules = input.lethal.map((l) => {
    const lines = tagged(l.id)
    if (lines.length === 0) add('error', 'untagged', l.id, `no line is tagged hints: ['${l.id}'] (${l.rule})`)
    for (const { route, step } of input.exposes.filter((x) => x.lethal === l.id)) {
      const probes = input.probes.filter((p) => p.lethal === l.id && p.route === route)
      if (probes.length === 0)
        add(
          'error',
          'unreachable',
          l.id,
          `on route "${route}" none of ${l.hintedBy.join(', ')} can be taken before step ${step} exposes the risk`,
        )
      else if (!probes.some((p) => hints(p.lines, l.id)))
        add(
          'error',
          'hint-line',
          l.id,
          `on route "${route}" ${probes.map((p) => `${p.action} shows ${p.lines.join(', ') || 'nothing'}`).join('; ')}: none tagged hints: ['${l.id}']`,
        )
    }
    for (const p of input.probes.filter(
      (x) => x.lethal === l.id && x.lines.length > 0 && !hints(x.lines, l.id),
    ))
      if (!findings.some((f) => f.id === l.id && f.rule === 'hint-line' && f.detail.includes(`"${p.route}"`)))
        add(
          'warning',
          'hint-line',
          l.id,
          `${p.action} on route "${p.route}" shows ${p.lines.join(', ')}, not tagged for ${l.id} (another hint covers the route)`,
        )
    return { id: l.id, tagged: lines, ok: !findings.some((f) => f.id === l.id && f.level === 'error') }
  })
  const sys = input.systems
  if (sys !== undefined) {
    const effects = [
      ...sys.rules.map((r) => ({ where: `rule ${r.id}`, list: r.then })),
      ...sys.agents.flatMap((a) =>
        a.transitions.map((t) => ({ where: `${a.id} ${t.from}→${t.to}`, list: t.do ?? [] })),
      ),
    ]
    for (const e of effects)
      for (const x of e.list) {
        // A line is named by its record id, or given as a record's text (a story view, as the agents show it).
        const line = condEmits(x)?.line
        if (line !== undefined && !byId.has(line) && !input.records.some((r) => r.text === line))
          add('error', 'line', e.where, `emits line ${line}, which is not a record`)
      }
    // A puzzle lethal rule that names a systems rule first (`R6: a live puddle kills.`) is that rule: its hint lines count.
    const named = (id: string): string[] =>
      input.lethal.filter((l) => l.rule.startsWith(`${id}:`)).map((l) => l.id)
    for (const r of sys.rules)
      if (
        r.then.some((x) => condEmits(x)?.caught !== undefined) &&
        ![r.id, ...named(r.id)].some((id) => tagged(id).length > 0)
      )
        add(
          'error',
          'untagged',
          r.id,
          `catches the player, and no line is tagged hints: ['${r.id}'] (${r.text}), nor for a lethal rule that names it`,
        )
    for (const a of sys.agents)
      for (const mode of a.modes) {
        const barks = input.records.filter(
          (r) => r.kind === 'bark' && r.speaker === a.id && barkPattern(input.scene, a.id, mode).test(r.id),
        )
        if (barks.length < 2)
          add(
            input.barksRequired && !input.quiet?.includes(a.id) ? 'error' : 'warning',
            'barks',
            `${a.id}.${mode}`,
            `${barks.length} barks (at least 2: ${input.scene}.${a.id}.${mode}.<n>)`,
          )
      }
  }
  return { rules, findings }
}
