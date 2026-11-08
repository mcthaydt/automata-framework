// The names a field may choose from, read from the scene's files: the open character's modes, the scene's characters,
// the facts the file mentions, and the scene's places.
import type { SysEffect, SystemsDef } from '@automata/systems/sim'
import type { Names } from './pieces/piece.ts'

type Probes = SystemsDef['rules'][number]['when']

/** Every fact name the file asks about or sets, in the order it first appears (a character's own notes are not facts). */
export function factsOf(def: SystemsDef): string[] {
  const facts = new Set<string>()
  const probe = (p: Probes[number]): void => {
    if ('not' in p) probe(p.not)
    else if ('fact' in p && !p.fact.startsWith('self.') && !p.fact.startsWith('pursuit.')) facts.add(p.fact)
  }
  const effect = (e: SysEffect): void => {
    if ('set' in e && !e.set.startsWith('self.') && !e.set.startsWith('pursuit.')) facts.add(e.set)
  }
  for (const rule of def.rules) {
    rule.when.forEach(probe)
    rule.then.forEach(effect)
  }
  for (const agent of def.agents) {
    for (const t of agent.transitions) {
      t.when.forEach(probe)
      t.do?.forEach(effect)
    }
    for (const stop of agent.routine ?? []) stop.do?.forEach(effect)
  }
  return [...facts]
}

/** A fact the scene's puzzle sets or asks about comes first: it is what the characters and the puzzle agree on. */
export function namesOf(
  def: SystemsDef,
  agent: number,
  places: readonly string[] = [],
  puzzleFacts: readonly string[] = [],
): Names {
  const character = def.agents[agent]
  return {
    modes: character?.modes ?? [],
    agents: def.agents.map((a) => a.id),
    facts: [...new Set([...puzzleFacts, ...factsOf(def)])],
    places,
    hooks: character?.hooks ?? [],
    doorways: [],
  }
}

/** The names for character `agent` of the open scene: its places, and the puzzle's facts beside the file's. */
export function sceneNames(
  session: {
    readonly def: SystemsDef | undefined
    readonly places: { readonly nodes: Record<string, unknown> } | undefined
    readonly puzzleDef: { readonly facts: Record<string, unknown> } | undefined
  },
  agent: number,
): Names | undefined {
  return session.def === undefined
    ? undefined
    : namesOf(
        session.def,
        agent,
        Object.keys(session.places?.nodes ?? {}),
        Object.keys(session.puzzleDef?.facts ?? {}),
      )
}
