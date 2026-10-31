// Dialogue lint (M6.8b step 3, NR-c; from the source's `dialogue-lint.ts`): a scene's conversations against the rules
// that keep a conversation playable. Structure is the platform's: every node leads somewhere that exists, every node
// can be reached, there is exactly one exit and every node reaches it, so a conversation has no dead end (NR-c).
// Voice is the game's (NR-D8): who the player is, who never shouts, who has only a few lines, how far a choice moves
// the stance and how wide the answer column is are options, not the source's people.
import {
  type Canon,
  DEFAULT_STANCE,
  type DialogueGraph,
  type DialogueNode,
  type LineRecord,
} from '../sim/index'
import { collect, type Finding } from './finding'
import { type Box, type Measure, wrap } from './lint'

export interface DialogueRules {
  /** The speaker whose lines are choices. When set, a choice by anyone else is an error. */
  readonly player?: string | undefined
  /** Speakers who never use an exclamation mark. */
  readonly quiet?: readonly string[] | undefined
  /** A speaker who says only these lines: a record id must end in one of the suffixes. */
  readonly only?: Readonly<Record<string, readonly string[]>> | undefined
  /** Each choice moves the stance by a whole number of at most this; the canon's axis bounds it when unset. */
  readonly maxStep?: number | undefined
  /** The dialogue panel's answer column; with a measure, a choice must fit its lines. */
  readonly choiceBox?: (Box & { readonly prefix: string }) | undefined
}

export interface DialogueLintInput {
  readonly canon: Pick<Canon, 'stance'>
  readonly graphs: readonly DialogueGraph[]
  readonly records: readonly LineRecord[]
  /** The locale's text, by line key. */
  readonly text: Readonly<Record<string, string>>
  /** Graph ids some puzzle action starts (`{ dialogue }`); when given, a graph nobody starts is a warning. */
  readonly started?: ReadonlySet<string> | undefined
  readonly measure?: Measure | undefined
  readonly rules?: DialogueRules | undefined
}

export const targets = (n: DialogueNode): string[] => [
  ...(n.next !== undefined ? [n.next] : []),
  ...(n.choices ?? []).map((c) => c.next),
]
export const isExit = (n: DialogueNode): boolean => n.next === undefined && (n.choices ?? []).length === 0

/** Node ids reachable from `from` over `next` and every choice. */
export function reach(graph: DialogueGraph, from: string): Set<string> {
  const seen = new Set<string>()
  const queue = [from]
  for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
    const node = graph.nodes[id]
    if (seen.has(id) || node === undefined) continue
    seen.add(id)
    queue.push(...targets(node))
  }
  return seen
}

export function lintDialogues(input: DialogueLintInput): Finding[] {
  const { findings, add } = collect()
  const rules = input.rules ?? {}
  const bounds = input.canon.stance ?? DEFAULT_STANCE
  const lines = new Map(input.records.map((r) => [r.id, r]))
  const said = (r: LineRecord): string => input.text[r.text] ?? ''
  const quiet = new Set(rules.quiet ?? [])
  for (const r of input.records)
    for (const [speaker, only] of Object.entries(rules.only ?? {}))
      if (r.speaker === speaker && !only.some((suffix) => r.id.endsWith(suffix)))
        add('error', 'voice', r.id, `${speaker} speaks only her lines (${only.join(', ')})`)
  const ids = new Set<string>()
  for (const g of input.graphs) {
    const at = (node?: string) => (node === undefined ? g.id : `${g.id}/${node}`)
    if (ids.has(g.id)) add('error', 'graph', g.id, 'two graphs share this id')
    ids.add(g.id)
    if (g.nodes[g.start] === undefined) {
      add('error', 'graph', g.id, `start ${g.start} is not a node`)
      continue
    }
    if (input.started !== undefined && !input.started.has(g.id))
      add('warning', 'started', g.id, 'no puzzle action starts this graph ({ dialogue })')
    // Structure: names, reachability, one exit that every node reaches.
    let broken = false
    for (const [id, n] of Object.entries(g.nodes))
      for (const t of targets(n))
        if (g.nodes[t] === undefined) {
          add('error', 'node', at(id), `leads to ${t}, which is not a node`)
          broken = true
        }
    const live = reach(g, g.start)
    for (const id of Object.keys(g.nodes))
      if (!live.has(id)) add('error', 'unreachable', at(id), `no path from ${g.start} reaches it`)
    const exits = [...live].filter((id) => isExit(g.nodes[id] as DialogueNode))
    const [exit] = exits
    if (exits.length !== 1)
      add(
        'error',
        'exit',
        g.id,
        exits.length > 0
          ? `${exits.length} exits (${exits.join(', ')}); every graph reconverges to one`
          : 'no exit: the conversation never ends',
      )
    else if (!broken && exit !== undefined)
      for (const id of live)
        if (!reach(g, id).has(exit))
          add('error', 'reconverge', at(id), `cannot reach the exit ${exit}: a dead end`)
    // A gated node passed over by a `next` goes on to its own `next`; without one it would be a second exit.
    const viaNext = new Set(
      Object.values(g.nodes)
        .flatMap((n) => (n.next !== undefined ? [n.next] : []))
        .concat(g.start),
    )
    for (const [id, n] of Object.entries(g.nodes))
      if ((n.when ?? []).length > 0 && viaNext.has(id) && n.next === undefined)
        add(
          'error',
          'gate',
          at(id),
          'a `next` reaches this gated node, so it needs its own `next` to pass over to',
        )
    for (const [id, n] of Object.entries(g.nodes)) {
      for (const l of n.say) {
        const r = lines.get(l)
        if (r === undefined) {
          add('error', 'line', at(id), `says unknown line ${l}`)
          continue
        }
        if (r.speaker !== undefined && quiet.has(r.speaker) && said(r).includes('!'))
          add('error', 'voice', l, `${r.speaker} never uses an exclamation mark`)
      }
      if (n.choices === undefined) continue
      if (n.choices.length < 2 || n.choices.length > 3)
        add('error', 'choices', at(id), `${n.choices.length} choices; a conversation offers 2–3`)
      for (const c of n.choices) {
        const r = lines.get(c.line)
        const where = `${at(id)}:${c.line}`
        if (c.stance !== undefined) {
          const step = rules.maxStep ?? Number.POSITIVE_INFINITY
          if (
            !Number.isInteger(c.stance) ||
            c.stance < bounds.min ||
            c.stance > bounds.max ||
            Math.abs(c.stance) > step
          )
            add(
              'error',
              'stance',
              where,
              `stance ${c.stance}; each choice moves it by a whole number within the canon’s ${bounds.min}..${bounds.max}${rules.maxStep === undefined ? '' : ` and at most ${rules.maxStep}`}`,
            )
        }
        if (c.set !== undefined && 'stance' in c.set)
          add('error', 'stance', where, "sets `stance` as a fact; move it with the choice's `stance`")
        if (r === undefined) {
          add('error', 'line', at(id), `offers unknown line ${c.line}`)
          continue
        }
        if (rules.player !== undefined && r.speaker !== rules.player)
          add(
            'error',
            'voice',
            c.line,
            `a choice is ${rules.player}'s line; this one is ${r.speaker ?? 'nobody'}'s`,
          )
        if (r.speaker !== undefined && quiet.has(r.speaker) && said(r).includes('!'))
          add('error', 'voice', c.line, `${r.speaker} never uses an exclamation mark`)
        const box = rules.choiceBox
        if (input.measure !== undefined && box !== undefined) {
          const count = wrap(`${box.prefix}${said(r)}`, box.width, box.font, input.measure)
          if (count > box.lines)
            add(
              'error',
              'length',
              c.line,
              `${count} lines in the answer column (${box.width} px, ${box.font}); a choice is at most ${box.lines}`,
            )
        }
      }
    }
  }
  return findings
}
