// `validate` (M6 spec §4.5, §6), from the adventure source's puzzle pipeline: static checks of a puzzle against its
// scene and its solver model. Errors fail `check`; warnings are for review.
import type { Action, Cond } from '../sim/index'
import { SPECIAL } from './model'
import type { PuzzleScene } from './scene'

export interface Finding {
  readonly level: 'error' | 'warning'
  readonly rule: string
  readonly id: string
  readonly detail: string
}
const VIRTUAL = new Set(['held', 'code'])

export const condFacts = (c: Cond): string[] =>
  'not' in c ? condFacts(c.not) : 'any' in c ? c.any.flatMap(condFacts) : 'fact' in c ? [c.fact] : []
export const condItems = (c: Cond): string[] =>
  'not' in c ? condItems(c.not) : 'any' in c ? c.any.flatMap(condItems) : 'has' in c ? [c.has] : []
export const used = (a: Action): string[] =>
  a.use === undefined ? [] : typeof a.use === 'string' ? [a.use] : [...a.use]

export function validate(p: PuzzleScene): Finding[] {
  const { def, model } = p
  const out: Finding[] = []
  const error = (rule: string, id: string, detail: string) => out.push({ level: 'error', rule, id, detail })
  const warn = (rule: string, id: string, detail: string) => out.push({ level: 'warning', rule, id, detail })
  const hotspots = new Set(Object.keys(def.hotspots))
  const items = new Set(def.items)
  const ids = new Set<string>()
  const known = new Set([
    ...Object.keys(def.facts),
    ...def.entry.flatMap((e) => Object.keys(e.facts ?? {})),
    ...def.systemic.flatMap((s) => s.enables.flatMap(condFacts)),
  ])
  const solverKnown = new Set([...known, ...Object.keys(model.facts ?? {})])
  if (def.scene !== p.id)
    error('scene', def.scene, `the puzzle says scene ${def.scene}, its scene is ${p.id}`)
  if (new Set(def.items).size !== def.items.length) error('items', def.scene, 'an item is declared twice')
  for (const item of def.items)
    if (p.story.items[item] === undefined)
      error('item-text', item, "no entry in the story's items (its name is shown when it is gained)")
  const line = (id: string, where: string) => {
    if (p.story.lines[id] === undefined) error('line', where, `line ${id} is not in the story`)
  }
  const item = (id: string, where: string) => {
    if (!items.has(id)) error('item', where, `item ${id} is not declared in the puzzle's items`)
  }
  for (const e of def.entry) for (const i of e.items) item(i, `entry ${e.name}`)
  const given = new Set([
    ...def.entry.flatMap((e) => e.items),
    ...def.actions.flatMap((a) => a.then.flatMap((e) => ('give' in e ? [e.give] : []))),
  ])
  def.actions.forEach((a, index) => {
    if (ids.has(a.id)) error('id', a.id, 'the action id is used twice')
    ids.add(a.id)
    if (!SPECIAL.has(a.at) && !hotspots.has(a.at))
      error('hotspot', a.id, `${a.at} is not a hotspot of ${p.id}`)
    const pair = a.use !== undefined && typeof a.use !== 'string'
    if (a.use !== undefined && pair !== (a.at === 'combine'))
      error('use', a.id, a.at === 'combine' ? 'a combine uses a pair' : 'only a combine uses a pair')
    if (a.at === 'combine' && !pair) error('use', a.id, 'a combine names its pair')
    for (const i of [...used(a), ...(a.when ?? []).flatMap(condItems)]) item(i, a.id)
    for (const f of (a.when ?? []).flatMap(condFacts))
      if (!VIRTUAL.has(f) && !known.has(f)) error('fact', a.id, `reads fact ${f}, which is not declared`)
    if (a.say !== '') line(a.say, a.id)
    for (const e of a.then) {
      if ('set' in e && !known.has(e.set)) error('fact', a.id, `sets fact ${e.set}, which is not declared`)
      if ('add' in e && !known.has(e.add)) error('fact', a.id, `adds to fact ${e.add}, which is not declared`)
      if ('give' in e) item(e.give, a.id)
      if ('take' in e) item(e.take, a.id)
      if ('cutscene' in e && !p.cutscenes.includes(e.cutscene))
        error('cutscene', a.id, `cutscene ${e.cutscene} is not in the scene`)
      if ('exit' in e && !p.cutscenes.includes(e.exit.cutscene))
        error('cutscene', a.id, `cutscene ${e.exit.cutscene} is not in the scene`)
      if ('noise' in e && typeof e.noise.at === 'string' && !hotspots.has(e.noise.at))
        error('hotspot', a.id, `noise at ${e.noise.at}, which is not a hotspot`)
      if ('call' in e && model.calls?.[e.call] === undefined)
        error('model', a.id, `call ${e.call} has no solver model (the model's calls)`)
    }
    for (const i of used(a))
      if (!given.has(i))
        warn('obtainable', a.id, `uses ${i}, which no action gives and no entry holds (a call may make it)`)
    // An earlier action at the same place that matches whatever this one matches hides it.
    const hidden = def.actions
      .slice(0, index)
      .find(
        (b) =>
          b.at === a.at &&
          (b.when ?? []).length === 0 &&
          (b.use === undefined || JSON.stringify(b.use) === JSON.stringify(a.use)),
      )
    if (hidden !== undefined) error('unreachable', a.id, `${hidden.id} comes first and always matches`)
  })
  for (const at of Object.keys(def.fallback).sort()) {
    if (at !== '*' && !SPECIAL.has(at) && !hotspots.has(at))
      error('hotspot', `fallback ${at}`, `${at} is not a hotspot of ${p.id}`)
    line(def.fallback[at] as string, `fallback ${at}`)
  }
  for (const s of def.systemic)
    for (const v of s.via)
      if (!ids.has(v)) error('ref', `systemic ${s.id}`, `via ${v}, which is not an action`)
  for (const l of def.lethal)
    for (const h of l.hintedBy)
      if (!ids.has(h)) error('ref', `lethal ${l.id}`, `hinted by ${h}, which is not an action`)
  for (const f of def.goal.flatMap(condFacts))
    if (!known.has(f)) error('fact', 'goal', `reads fact ${f}, which is not declared`)
  for (const i of def.goal.flatMap(condItems)) item(i, 'goal')
  if (def.entry.length === 0) error('entry', def.scene, 'the puzzle has no entry')
  if (def.goal.length === 0) error('goal', def.scene, 'the puzzle has no goal')
  for (const [name, list] of [
    ['effects', model.effects],
    ['require', model.require],
  ] as const)
    for (const id of Object.keys(list ?? {}).sort())
      if (!ids.has(id)) error('model', `model ${name}`, `${id} is not an action`)
  for (const c of Object.values(model.require ?? {})
    .flat()
    .flatMap(condFacts))
    if (!VIRTUAL.has(c) && !solverKnown.has(c))
      error('model', 'model require', `reads fact ${c}, which is not declared`)
  const steps = new Set([...ids, ...def.systemic.map((x) => `systemic:${x.id}`)])
  for (const k of model.keys ?? [])
    for (const id of [...k.uses, ...(k.ban ?? [])])
      if (!steps.has(id))
        error('model', `model keys ${k.lock}: ${k.key}`, `${id} is not an action or a systemic step`)
  for (const k of model.keys ?? [])
    if (k.entry !== undefined && !def.entry.some((e) => e.name === k.entry))
      error('model', `model keys ${k.lock}: ${k.key}`, `no entry ${k.entry}`)
  for (const id of Object.keys(model.systemic ?? {}).sort())
    if (!def.systemic.some((x) => x.id === id))
      error('model', 'model systemic', `${id} is not one of the puzzle's systemic set-ups`)
  return out
}
