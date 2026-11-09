// What the inspector does to the behaviour file, as the kit's content edits by key path: a value edit rewrites only its
// own literal, a structural edit only the table it touches, and a rename changes every place that names the thing in one
// list, so it is one undo step. Nothing here writes: the session applies the list.
import type { ContentEdit } from '@automata/editor/kit/documents'
import {
  type AgentDef,
  type Probe,
  routineMode,
  type SysEffect,
  type SystemsDef,
  type Transition,
} from '@automata/systems/sim'
import { timingOf } from './diagram/layout.ts'
import { groupOf } from './switch-words.ts'

type Path = readonly (string | number)[]

/** A refusal, in words, instead of edits. */
export interface Refused {
  readonly refused: string
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/**
 * The edits that turn `before` into `after` at `path`: a changed number or text is a value edit on its own key, a new
 * key an insert, a dropped key a remove. Two objects are compared key by key, so one changed field rewrites one literal.
 */
export function diffEdits(path: Path, before: unknown, after: unknown): ContentEdit[] {
  if (same(before, after)) return []
  if (isObject(before) && isObject(after)) {
    const edits: ContentEdit[] = []
    for (const key of Object.keys(before))
      if (!(key in after)) edits.push({ keyPath: [...path, key], remove: true })
    for (const key of Object.keys(after)) {
      const next = after[key]
      if (!(key in before)) edits.push({ keyPath: [...path, key], insert: next })
      else if (isObject(before[key]) && isObject(next))
        edits.push(...diffEdits([...path, key], before[key], next))
      else if (!same(before[key], next))
        edits.push({ keyPath: [...path, key], expected: before[key], set: next })
    }
    return edits
  }
  if (Array.isArray(before) && Array.isArray(after) && before.length === after.length)
    return before.flatMap((item, i) => diffEdits([...path, i], item, after[i]))
  return [{ keyPath: [...path], expected: before, set: after }]
}

/** Whether `after` has the keys and list lengths `before` has, so only values differ and each can be written in its own literal. */
export function sameShape(before: unknown, after: unknown): boolean {
  if (Array.isArray(before) || Array.isArray(after))
    return (
      Array.isArray(before) &&
      Array.isArray(after) &&
      before.length === after.length &&
      before.every((item, i) => sameShape(item, after[i]))
    )
  if (isObject(before) && isObject(after)) {
    const keys = Object.keys(before).filter((k) => before[k] !== undefined)
    const others = Object.keys(after).filter((k) => after[k] !== undefined)
    return keys.length === others.length && keys.every((k) => k in after && sameShape(before[k], after[k]))
  }
  return !isObject(before) && !isObject(after)
}

// ── Walking every place a mode, a character or a place is named ─────────────────────────────────────────────────

interface Site<T> {
  readonly value: T
  readonly path: Path
  /** The index of the character whose list it is in, or -1 for a world rule or a scenario. */
  readonly owner: number
}

function probesIn(list: readonly Probe[], path: Path, owner: number, out: Site<Probe>[]): void {
  list.forEach((probe, i) => {
    out.push({ value: probe, path: [...path, i], owner })
    let inner: Probe = probe
    let at: Path = [...path, i]
    while ('not' in inner) {
      inner = inner.not
      at = [...at, 'not']
      out.push({ value: inner, path: at, owner })
    }
  })
}

/** Every condition in the file, nested `not`s included, with where it is. */
export function allProbes(def: SystemsDef): Site<Probe>[] {
  const out: Site<Probe>[] = []
  def.agents.forEach((agent, a) => {
    agent.transitions.forEach((t, i) => {
      probesIn(t.when, ['agents', a, 'transitions', i, 'when'], a, out)
    })
  })
  def.rules.forEach((rule, r) => {
    probesIn(rule.when, ['rules', r, 'when'], -1, out)
  })
  def.scenarios.forEach((s, i) => {
    probesIn(s.expect.condition, ['scenarios', i, 'expect', 'condition'], -1, out)
  })
  return out
}

/** Every action in the file, with where it is. */
export function allEffects(def: SystemsDef): Site<SysEffect>[] {
  const out: Site<SysEffect>[] = []
  def.agents.forEach((agent, a) => {
    agent.transitions.forEach((t, i) => {
      t.do?.forEach((e, j) => {
        out.push({ value: e, path: ['agents', a, 'transitions', i, 'do', j], owner: a })
      })
    })
    agent.routine?.forEach((stop, i) => {
      stop.do?.forEach((e, j) => {
        out.push({ value: e, path: ['agents', a, 'routine', i, 'do', j], owner: a })
      })
    })
  })
  def.rules.forEach((rule, r) => {
    rule.then.forEach((e, j) => {
      out.push({ value: e, path: ['rules', r, 'then', j], owner: -1 })
    })
  })
  return out
}

// ── Renames ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Every edit that renames character `agent`'s mode `from` to `to`, or why it cannot be done. */
export function renameModeEdits(
  def: SystemsDef,
  agent: number,
  from: string,
  to: string,
): ContentEdit[] | Refused {
  const character = def.agents[agent]
  if (character === undefined) return { refused: 'That character is not in this scene any more.' }
  if (to.trim() === '') return { refused: 'A mode needs a name.' }
  if (to !== from && character.modes.includes(to))
    return { refused: `This character already has a mode called “${to}”.` }
  if (routineMode(character) === from)
    return { refused: 'This mode walks the patrol, so it keeps its name. Add a new mode instead.' }
  const id = character.id
  const base: Path = ['agents', agent]
  const edits: ContentEdit[] = []
  const set = (path: Path, before: string): void => {
    edits.push({ keyPath: [...path], expected: before, set: to })
  }
  character.modes.forEach((mode, i) => {
    if (mode === from) set([...base, 'modes', i], mode)
  })
  if (character.initial === from) set([...base, 'initial'], from)
  if (from in character.speed) {
    edits.push({ keyPath: [...base, 'speed', from], remove: true })
    edits.push({ keyPath: [...base, 'speed', to], insert: character.speed[from] })
  }
  character.transitions.forEach((t, i) => {
    if (t.from === from) set([...base, 'transitions', i, 'from'], from)
    if (t.to === from) set([...base, 'transitions', i, 'to'], from)
  })
  const mine = (owner: number, named: string | undefined): boolean =>
    named === id || (named === undefined && owner === agent)
  for (const { value, path, owner } of allProbes(def))
    if ('mode' in value && value.mode === from && mine(owner, value.agent)) set([...path, 'mode'], from)
  for (const { value, path, owner } of allEffects(def)) {
    if ('setMode' in value && value.setMode === from && mine(owner, value.agent))
      set([...path, 'setMode'], from)
    if ('followThrough' in value && owner === agent && value.followThrough.then === from)
      set([...path, 'followThrough', 'then'], from)
    if ('ambush' in value && value.ambush.agent === id) {
      if (value.ambush.mode === from) set([...path, 'ambush', 'mode'], from)
      if (value.ambush.then === from) set([...path, 'ambush', 'then'], from)
    }
  }
  return edits
}

/** Every edit that renames character `from` to `to`: its name, and every place another part of the file names it. */
export function renameAgentEdits(def: SystemsDef, from: string, to: string): ContentEdit[] | Refused {
  if (to.trim() === '') return { refused: 'A character needs a name.' }
  if (to !== from && def.agents.some((a) => a.id === to))
    return { refused: `There is already a character called “${to}”.` }
  const edits: ContentEdit[] = []
  const set = (path: Path): void => {
    edits.push({ keyPath: [...path], expected: from, set: to })
  }
  def.agents.forEach((a, i) => {
    if (a.id === from) set(['agents', i, 'id'])
  })
  for (const { value, path } of allProbes(def))
    if ('mode' in value && value.agent === from) set([...path, 'agent'])
  for (const { value, path } of allEffects(def)) {
    if ('setMode' in value && value.agent === from) set([...path, 'agent'])
    if ('ambush' in value && value.ambush.agent === from) set([...path, 'ambush', 'agent'])
  }
  def.scenarios.forEach((s, i) => {
    const place = s.setup.place
    if (place !== undefined && from in place) {
      edits.push({ keyPath: ['scenarios', i, 'setup', 'place', from], remove: true })
      edits.push({ keyPath: ['scenarios', i, 'setup', 'place', to], insert: place[from] })
    }
  })
  return edits
}

// ── Order ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Moves the switch at `index` to place `to` inside its own group (the times the game asks switches never mix) and
 * writes the group's order numbers as descending tens, only the ones that change.
 */
export function reorderEdits(agent: AgentDef, agentIndex: number, index: number, to: number): ContentEdit[] {
  const target = agent.transitions[index]
  if (target === undefined) return []
  const group = groupOf(agent, timingOf(target.when))
  const at = group.indexOf(index)
  const place = Math.max(0, Math.min(group.length - 1, to))
  if (at < 0 || place === at) return []
  const order = group.filter((i) => i !== index)
  order.splice(place, 0, index)
  const edits: ContentEdit[] = []
  order.forEach((i, position) => {
    const t = agent.transitions[i]
    const priority = (order.length - position) * 10
    if (t !== undefined && t.priority !== priority)
      edits.push({
        keyPath: ['agents', agentIndex, 'transitions', i, 'priority'],
        expected: t.priority,
        set: priority,
      })
  })
  return edits
}

// ── Adding and removing ───────────────────────────────────────────────────────────────────────────────────────

/** A new mode: it stands still until it is given a speed, and the file needs a speed for every mode. */
export function addModeEdits(agentIndex: number, name: string): ContentEdit[] {
  return [
    { keyPath: ['agents', agentIndex, 'modes'], insert: name },
    { keyPath: ['agents', agentIndex, 'speed', name], insert: 0 },
  ]
}

/** A new switch, checked first in its group: always, until it is given a condition. */
export const newSwitch = (from: string, to: string): Transition => ({ from, to, when: [], priority: 10 })

// A switch's conditions and actions change as a whole switch (the text of its tables is rewritten, `switch-text.ts`).

/** The switch with a condition added to its list. */
export const withCondition = (t: Transition, probe: Probe): Transition => ({ ...t, when: [...t.when, probe] })

/** The switch without the condition at `at`; the last one leaves an empty list, which means "always". */
export const withoutCondition = (t: Transition, at: number): Transition => ({
  ...t,
  when: t.when.filter((_, i) => i !== at),
})

/** The switch with an action added: the first makes the list. */
export const withAction = (t: Transition, effect: SysEffect): Transition => ({
  ...t,
  do: [...(t.do ?? []), effect],
})

/** The switch without the action at `at`; the last one takes the list with it. */
export function withoutAction(t: Transition, at: number): Transition {
  const rest = (t.do ?? []).filter((_, i) => i !== at)
  const { do: _gone, ...others } = t
  return rest.length === 0 ? others : { ...others, do: rest }
}

/** "Not": the condition at `at` turned round, or turned back (one level; a `not` inside a `not` is left as it is). */
export function withNotToggled(t: Transition, at: number): Transition {
  return {
    ...t,
    when: t.when.map((probe, i) => (i !== at ? probe : 'not' in probe ? probe.not : { not: probe })),
  }
}
