// The definition checks (M6 spec §4.6, §6), from the adventure source's `validateSystems`, `validateAgent` and
// `pursuitErrors`: each error in the source's words, reported at its path in the def.
import { sortedKeys } from '@automata/sim'
import { BUILT_IN_HOOKS, hearsIn, PLACES, POLICIES, ROUTINE_MODES, routineMode, waitsIn } from './probe-kinds'
import type { AgentDef, Probe, SysEffect, SystemsDef } from './systems.schema'

export interface SystemsCheckOptions {
  /** The hook names the game gives `createSystems`; `stop` is built in. */
  readonly hooks: readonly string[]
  /** The scene's nav node ids, when known (a load checks them against the loaded graph). */
  readonly nodes?: readonly string[]
}
export type Path = readonly (string | number)[]
export type Report = (path: Path, message: string) => void

const inner = (p: Probe | SysEffect): Probe | SysEffect => ('not' in p ? p.not : p)

/** Probes and effects that need an agent to ask or act; a world rule cannot use them. */
function ruleProbeError(p: Probe): string | null {
  const q = inner(p) as Probe
  if ('sees' in q) return 'sees needs an agent'
  if ('mode' in q && q.agent === undefined) return 'mode needs an agent ID in a world rule'
  if ('fact' in q && q.fact.startsWith('self.')) return `${q.fact} needs an agent`
  return null
}
function ruleEffectError(e: SysEffect): string | null {
  if ('goTo' in e) return 'goTo needs an agent'
  if ('flee' in e) return 'flee needs an agent'
  if ('followThrough' in e) return 'followThrough needs an agent'
  if ('setMode' in e && e.agent === undefined) return 'setMode needs an agent ID in a world rule'
  if ('set' in e && e.set.startsWith('self.')) return `set ${e.set} needs an agent`
  return null
}

/** A follow's or an ambush's modes and agent must exist, and its timings be sensible. */
function pursuitErrors(
  e: SysEffect,
  ownModes: readonly string[] | null,
  agents: Readonly<Record<string, readonly string[]>>,
): string[] {
  const errors: string[] = []
  if ('followThrough' in e) {
    const f = e.followThrough
    if (ownModes && !ownModes.includes(f.then)) errors.push(`followThrough to unknown mode ${f.then}`)
    if (!(f.delay >= 0)) errors.push('followThrough delay must be ≥ 0')
    if (f.portal !== 'crossed' && !f.portal.includes('>'))
      errors.push(`followThrough portal ${f.portal} is not 'crossed' or from>to`)
  }
  if ('ambush' in e) {
    const a = e.ambush
    const modes = agents[a.agent]
    if (!modes) errors.push(`ambush ${a.id} names unknown agent ${a.agent}`)
    for (const m of [a.mode, a.then])
      if (modes && !modes.includes(m)) errors.push(`ambush ${a.id}: no mode ${m} on agent ${a.agent}`)
    if (!(a.sting >= 0 && a.grace >= 0)) errors.push(`ambush ${a.id}: sting and grace must be ≥ 0`)
  }
  return errors
}

/** The sense a probe needs when an agent asks it. */
function needs(p: Probe): string | null {
  if ('not' in p) return needs(p.not)
  if ('sees' in p) return 'sight'
  if ('heard' in p) return 'sound'
  if ('warmthWithin' in p) return 'warmth'
  if ('touching' in p) return p.radius === undefined ? 'touch' : null
  return null
}

function checkAgent(
  def: AgentDef,
  path: Path,
  options: SystemsCheckOptions,
  agents: Readonly<Record<string, readonly string[]>>,
  report: Report,
): void {
  const at = `agent ${def.id}`
  const say = (where: Path, message: string) => report([...path, ...where], `${at}: ${message}`)
  const modes = new Set(def.modes)
  const hasNode = (id: string) => options.nodes === undefined || options.nodes.includes(id)
  const modesOf = (agent?: string) => (agent !== undefined && agent !== def.id ? agents[agent] : def.modes)
  if (!modes.has(def.initial)) say(['initial'], `initial mode ${def.initial} is not one of its modes`)
  for (const mode of sortedKeys(def.speed))
    if (!modes.has(mode)) say(['speed', mode], `speed for unknown mode ${mode}`)
  for (const mode of def.modes) if (!(mode in def.speed)) say(['speed'], `no speed for mode ${mode}`)
  const senses = new Set(def.senses.flatMap((s) => sortedKeys(s)))
  const checkProbe = (p: Probe, where: string, probePath: Path) => {
    const need = needs(p)
    if (need !== null && !senses.has(need)) say(probePath, `${where} needs a ${need} sense`)
    const q = inner(p) as Probe
    if ('mode' in q) {
      const known = modesOf(q.agent)
      if (!known) say(probePath, `${where} names unknown agent ${q.agent}`)
      else if (!known.includes(q.mode)) say(probePath, `${where} names unknown mode ${q.mode}`)
    }
    if ('at' in q && !hasNode(q.at)) say(probePath, `${where} names unknown node ${q.at}`)
  }
  def.transitions.forEach((t, i) => {
    const where = `transition ${i} (${t.from} → ${t.to})`
    if (t.from !== '*' && !modes.has(t.from))
      say(['transitions', i, 'from'], `${where} is from unknown mode ${t.from}`)
    if (!modes.has(t.to)) say(['transitions', i, 'to'], `${where} is to unknown mode ${t.to}`)
    if (hearsIn(t.when) && waitsIn(t.when))
      say(
        ['transitions', i, 'when'],
        `${where} asks both about sound (heard when made) and about waiting (after moving)`,
      )
    t.when.forEach((p, j) => {
      checkProbe(p, where, ['transitions', i, 'when', j])
    })
  })
  const declared = new Set(def.hooks ?? [])
  const effects: [SysEffect, Path][] = [
    ...def.transitions.flatMap((t, i) =>
      (t.do ?? []).map((e, j): [SysEffect, Path] => [e, ['transitions', i, 'do', j]]),
    ),
    ...(def.routine ?? []).flatMap((r, i) =>
      (r.do ?? []).map((e, j): [SysEffect, Path] => [e, ['routine', i, 'do', j]]),
    ),
  ]
  for (const [e, where] of effects) {
    if ('setMode' in e) {
      const known = modesOf(e.agent)
      if (!known) say(where, `setMode names unknown agent ${e.agent}`)
      else if (!known.includes(e.setMode)) say(where, `setMode to unknown mode ${e.setMode}`)
    }
    if ('call' in e && !declared.has(e.call)) say(where, `calls hook ${e.call}, which it does not declare`)
    if (
      'goTo' in e &&
      typeof e.goTo === 'string' &&
      !PLACES.includes(e.goTo) &&
      options.nodes !== undefined &&
      !hasNode(e.goTo) &&
      !(e.goTo in agents)
    )
      say(where, `goTo unknown node ${e.goTo}`)
    for (const message of pursuitErrors(e, def.modes, agents)) say(where, message)
  }
  for (const hook of declared)
    if (!options.hooks.includes(hook) && !BUILT_IN_HOOKS.includes(hook))
      say(['hooks'], `hook ${hook} is not implemented`)
  if (def.routine !== undefined && def.routine.length > 0) {
    if (routineMode(def) === undefined)
      say(['routine'], `has a routine but no ${ROUTINE_MODES.join(' or ')} mode to run it in`)
    def.routine.forEach((stop, i) => {
      if (!hasNode(stop.node)) say(['routine', i, 'node'], `routine stop at unknown node ${stop.node}`)
    })
  }
}

/** Every definition error in a scene's systems, in the source's order, each at its path. */
export function checkSystems(def: SystemsDef, options: SystemsCheckOptions, report: Report): void {
  const ruleIds = new Set<string>()
  def.rules.forEach((rule, i) => {
    const say = (where: Path, message: string) =>
      report(['rules', i, ...where], `rule ${rule.id}: ${message}`)
    if (ruleIds.has(rule.id)) say(['id'], 'defined twice')
    ruleIds.add(rule.id)
    if (rule.every !== undefined && !(rule.every > 0)) say(['every'], 'every must be positive')
    if (rule.every !== undefined && hearsIn(rule.when))
      say(['every'], 'a rule that hears runs when the noise is made, so it cannot have every')
    if (waitsIn(rule.when)) say(['when'], 'only an agent waits')
    rule.when.forEach((p, j) => {
      const e = ruleProbeError(p)
      if (e !== null) say(['when', j], e)
    })
    rule.then.forEach((effect, j) => {
      const e = ruleEffectError(effect)
      if (e !== null) say(['then', j], e)
      if ('call' in effect && !options.hooks.includes(effect.call) && !BUILT_IN_HOOKS.includes(effect.call))
        say(['then', j], `hook ${effect.call} is not implemented`)
    })
  })
  def.matrix.forEach((cell, i) => {
    const at = `matrix ${cell.row} × ${cell.col}`
    if (cell.rule === undefined && cell.presentation === undefined && cell.cut === undefined)
      report(['matrix', i], `${at}: undecided (give a rule, a presentation, or a cut with its reason)`)
    if (cell.rule !== undefined && !ruleIds.has(cell.rule))
      report(['matrix', i, 'rule'], `${at}: names unknown rule ${cell.rule}`)
  })
  for (const name of sortedKeys(def.tunables)) {
    const t = def.tunables[name]
    if (t === undefined) continue
    if (!(t.min <= t.max))
      report(['tunables', name, 'min'], `tunable ${name}: min ${t.min} is above max ${t.max}`)
    else if (t.value < t.min || t.value > t.max)
      report(['tunables', name, 'value'], `tunable ${name}: ${t.value} is outside ${t.min}–${t.max}`)
  }
  const agents: Record<string, readonly string[]> = {}
  def.agents.forEach((a, i) => {
    if (agents[a.id] !== undefined) report(['agents', i, 'id'], `agent ${a.id}: defined twice`)
    agents[a.id] = a.modes
  })
  def.agents.forEach((a, i) => {
    checkAgent(a, ['agents', i], options, agents, report)
  })
  def.rules.forEach((rule, i) => {
    rule.then.forEach((e, j) => {
      for (const message of pursuitErrors(e, null, agents))
        report(['rules', i, 'then', j], `rule ${rule.id}: ${message}`)
    })
  })
  def.rules.forEach((rule, i) => {
    const named: [Probe | SysEffect, Path][] = [
      ...rule.when.map((p, j): [Probe | SysEffect, Path] => [p, ['rules', i, 'when', j]]),
      ...rule.then.map((e, j): [Probe | SysEffect, Path] => [e, ['rules', i, 'then', j]]),
    ]
    for (const [p, path] of named) {
      const q = inner(p)
      if ('mode' in q && q.agent !== undefined && !agents[q.agent]?.includes(q.mode))
        report(path, `rule ${rule.id}: no mode ${q.mode} on agent ${q.agent}`)
      if ('setMode' in q && q.agent !== undefined && !agents[q.agent]?.includes(q.setMode))
        report(path, `rule ${rule.id}: no mode ${q.setMode} on agent ${q.agent}`)
    }
  })
  const scenarioIds = new Set<string>()
  def.scenarios.forEach((s, i) => {
    const say = (where: Path, message: string) =>
      report(['scenarios', i, ...where], `scenario ${s.id}: ${message}`)
    if (scenarioIds.has(s.id)) say(['id'], 'defined twice')
    scenarioIds.add(s.id)
    if (!POLICIES.includes(s.policy)) say(['policy'], `unknown policy ${s.policy}`)
    if (!(s.expect.within > 0)) say(['expect', 'within'], 'within must be positive')
    if (!(s.expect.probability >= 0 && s.expect.probability <= 1))
      say(['expect', 'probability'], 'probability must be within 0–1')
    if (!(Number.isInteger(s.seeds) && s.seeds >= 1)) say(['seeds'], 'seeds must be a whole number ≥ 1')
    for (const id of sortedKeys(s.setup.place ?? {}))
      if (id !== 'player' && agents[id] === undefined)
        say(['setup', 'place', id], `places unknown agent ${id}`)
  })
}
