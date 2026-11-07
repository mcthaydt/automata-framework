// Storylet deck lint (M6.8b step 3; from the source's `checkDeck`): a deck's lines exist, its triggers can fire, its
// conditions can hold, and no line states a fact before the scene that teaches it. Pure: the caller says which
// hotspots, rooms and facts the scene has. Who may have storylets is the game's (NR-D8).
import type { Canon, LineRecord, Storylet } from '../sim/index'
import { parseTrigger } from '../sim/index'
import { collect, type Finding } from './finding'

export interface DeckRules {
  /** Speakers who have no storylets. */
  readonly silent?: readonly string[] | undefined
  /** A speaker who speaks in these scenes only. */
  readonly only?: Readonly<Record<string, readonly string[]>> | undefined
}
export interface DeckLintInput {
  /** The scene the deck belongs to. */
  readonly scene: string
  readonly storylets: readonly Storylet[]
  readonly records: readonly LineRecord[]
  readonly facts: Canon['facts']
  readonly beats?: readonly { readonly id: string; readonly required: boolean }[] | undefined
  /** The scene's hotspots (an `inspect` trigger names one). */
  readonly hotspots: readonly string[]
  /** Sector ids and zones (`enter` and `dwell` name one). */
  readonly rooms: readonly string[]
  /** Whether a fact a `when` reads resolves: a puzzle fact, a dialogue fact, `stance`, a deck fact. */
  known(name: string): boolean
  /** Fact names (or their prefix before a dot) a later package provides: reported as a warning, not failed. */
  readonly pending?: readonly string[] | undefined
  readonly rules?: DeckRules | undefined
}

const condFacts = (c: Storylet['when'] extends readonly (infer C)[] | undefined ? C : never): string[] =>
  'has' in c ? [] : 'not' in c ? condFacts(c.not) : 'any' in c ? c.any.flatMap(condFacts) : [c.fact]

export function lintDeck(input: DeckLintInput): Finding[] {
  const { findings, add } = collect()
  const records = new Map(input.records.map((r) => [r.id, r]))
  const facts = new Map(input.facts.map((f) => [f.id, f]))
  const ids = new Set<string>()
  for (const s of input.storylets) {
    if (ids.has(s.id)) add('error', 'storylet', s.id, 'two storylets share this id')
    ids.add(s.id)
    const t = parseTrigger(s.trigger)
    if (t === null)
      add(
        'error',
        'trigger',
        s.id,
        `unknown trigger '${s.trigger}' (inspect:<hotspot>, enter:<room>, dwell:<room>:<s>, system:<event>)`,
      )
    else if (t.kind === 'inspect' && !input.hotspots.includes(t.target))
      add('error', 'trigger', s.id, `no hotspot '${t.target}' in ${input.scene}: it can never fire`)
    else if ((t.kind === 'enter' || t.kind === 'dwell') && !input.rooms.includes(t.target))
      add('error', 'trigger', s.id, `no room or sector '${t.target}' in ${input.scene}: it can never fire`)
    if (s.lines.length === 0) add('error', 'line', s.id, 'no lines')
    if (s.once === true && s.max !== undefined) add('error', 'storylet', s.id, 'once and max both set')
    for (const name of (s.when ?? []).flatMap(condFacts)) {
      if (name.startsWith('played.')) {
        if (!input.storylets.some((x) => x.id === name.slice(7)))
          add('error', 'when', s.id, `${name}: no such storylet in the deck`)
        continue
      }
      if (input.known(name)) continue
      if (input.pending?.some((p) => name === p || name.startsWith(`${p}.`)))
        add(
          'warning',
          'pending',
          s.id,
          `${name} is not in the world yet (a later package adds it): it cannot play until then`,
        )
      else add('error', 'when', s.id, `${name} is no puzzle fact, dialogue fact or deck fact: it never holds`)
    }
    for (const id of s.lines) {
      const r = records.get(id)
      if (r === undefined) {
        add('error', 'line', s.id, `no line record ${id}`)
        continue
      }
      const speaker = r.speaker
      if (speaker !== undefined && input.rules?.silent?.includes(speaker))
        add('error', 'speaker', s.id, `${id}: ${speaker} has no storylets`)
      const scenes = speaker === undefined ? undefined : input.rules?.only?.[speaker]
      if (scenes !== undefined && !scenes.includes(input.scene))
        add('error', 'speaker', s.id, `${id}: ${speaker} speaks only in ${scenes.join(', ')}`)
      for (const f of r.facts ?? []) {
        const fact = facts.get(f)
        if (fact === undefined) add('error', 'fact', s.id, `${id} states unknown fact '${f}'`)
        else if (!fact.revealedIn.includes(input.scene))
          add(
            'error',
            'order',
            s.id,
            `${id} states '${f}' in ${input.scene}, before the beat that teaches it (canon reveals it in ${fact.revealedIn.join(', ')})`,
          )
      }
      const beat = r.beat === undefined ? undefined : input.beats?.find((b) => b.id === r.beat)
      if (beat?.required === true)
        add(
          'error',
          'beat',
          s.id,
          `${id} delivers the required beat ${beat.id}: required beats stay proven by routes alone`,
        )
    }
  }
  return findings
}
