// The act screenplay: the review artifact, one
// section per scene of the act: its shortest solver route as played in the sim, with the cutscene captions, what the
// player reads and says, items, barks and conversations in play order, and the story beats marked where they land (by
// the lines `beatCoverage` counts: messages, items, captions, and what a conversation says on every path). Then the
// "Storylets" appendix. Pure and deterministic: the same traces give byte-identical text. The text of a line is the
// locale's. The endings a route closes on and a cutscene's stance variants come with the cutscenes.
import type { Cond } from '@automata/puzzle/sim'
import { showCond } from '@automata/puzzle/solver'
import type { Beat } from '../../shared/beats.schema'
import type { DialogueGraph } from '../../shared/sim/dialogue.schema'
import type { LineRecord } from '../../shared/sim/lines.schema'
import { parseTrigger, type Storylet } from '../../shared/sim/storylet.schema'
import type { BeatReport } from './coverage'
import { reach } from './dialogue-lint'
import type { Trace, TraceEvent } from './traces'

/** A storylet as the screenplay's appendix shows it: its trigger in words, its conditions, its lines and the routes that played it. */
export interface ScreenplayStorylet {
  readonly id: string
  readonly phase: string
  /** What fires it, in words: "Ada examines Bed 04 (`bed`)". */
  readonly trigger: string
  /** "once", "at most 3 times" or "every time". */
  readonly limit: string
  readonly when: readonly Cond[]
  /** Line record ids, in the order its plays show them. */
  readonly lines: readonly string[]
  /** The routes that played it, by name. */
  readonly reached: readonly string[]
}
export interface ScreenplayScene {
  readonly scene: string
  readonly title: string
  /** The shortest route's trace. */
  readonly trace: Trace
  /** Every solver route's name, for the reach column. */
  readonly routes: readonly string[]
  readonly beats: readonly Beat[]
  readonly coverage: readonly BeatReport[]
  readonly records: readonly LineRecord[]
  /** The locale's text, by line key. */
  readonly text: Readonly<Record<string, string>>
  readonly dialogues?: readonly DialogueGraph[] | undefined
  /** The scene's storylet deck, for the appendix (`storyletRows`). */
  readonly storylets?: readonly ScreenplayStorylet[] | undefined
}

/** A duration for print: to 0.1 s. */
export const seconds = (n: number): number => Math.round(n * 10) / 10
const clock = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const flat = (text: string): string => text.replace(/\n/g, ' / ')
const upper = (speaker?: string | null): string => (speaker ? speaker.toUpperCase() : '')
const title = (act: string): string => act.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())
const plural = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`
const cell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\n/g, '<br>')

/** The words for a storylet's trigger, naming hotspots as the game does. */
function triggerText(s: Storylet, names: Readonly<Record<string, string>>, player: string): string {
  const t = parseTrigger(s.trigger)
  if (t === null) return `\`${s.trigger}\``
  if (t.kind === 'inspect')
    return `${player} examines ${names[t.target] ?? t.target} (\`${t.target}\`), after the action’s own line`
  if (t.kind === 'enter') return `${player} enters ${t.target}`
  if (t.kind === 'dwell') return `${player} stands still in ${t.target} for ${t.seconds} s`
  return `the systems event \`${t.target}\``
}
const limitText = (s: Storylet): string =>
  s.once === true ? 'once' : s.max !== undefined ? `at most ${s.max} times` : 'every time'

/** The appendix rows of a scene's deck, marked with the routes whose traces played each. */
export function storyletRows(
  deck: readonly Storylet[],
  traces: readonly Trace[],
  options: { readonly names: Readonly<Record<string, string>>; readonly player: string },
): ScreenplayStorylet[] {
  return deck.map((s) => ({
    id: s.id,
    phase: s.phase ?? '—',
    trigger: triggerText(s, options.names, options.player),
    limit: limitText(s),
    when: s.when ?? [],
    lines: s.lines,
    reached: traces
      .filter((t) => t.events.some((e) => e.kind === 'line' && e.storylet === s.id))
      .map((t) => t.route),
  }))
}

/**
 * A graph as screenplay markdown: each node's lines as speeches, and its choices as a table, one column per choice,
 * with the stance it moves and where it leads.
 */
export function dialogueScreenplay(
  graph: DialogueGraph,
  records: readonly LineRecord[],
  text: Readonly<Record<string, string>>,
  name: (speaker: string | null | undefined) => string = upper,
): string {
  const byId = new Map(records.map((r) => [r.id, r]))
  const said = (id: string): string | undefined => {
    const r = byId.get(id)
    return r === undefined ? undefined : text[r.text]
  }
  const order = [...reach(graph, graph.start)]
  order.sort((a, b) => (a === graph.start ? -1 : b === graph.start ? 1 : 0))
  const out = [`### Dialogue: ${graph.id} (${graph.speaker})`, '']
  for (const id of order) {
    const n = graph.nodes[id]
    if (n === undefined) continue
    const gate =
      (n.when ?? []).length > 0 ? ` *(only when ${(n.when ?? []).map(showCond).join(' and ')})*` : ''
    out.push(`**[${id}]**${gate}`, '')
    for (const l of n.say) {
      const r = byId.get(l)
      out.push(`> **${name(r?.speaker ?? graph.speaker)}:** ${flat(said(l) ?? `(${l})`)}`, '')
    }
    const choices = n.choices ?? []
    if (choices.length > 0) {
      const moves = (c: (typeof choices)[number]): string => {
        const stance = c.stance ? (c.stance > 0 ? `+${c.stance}` : String(c.stance)) : '0'
        const sets =
          c.set === undefined
            ? ''
            : `; sets ${Object.entries(c.set)
                .map(([k, v]) => `${k} = ${String(v)}`)
                .join(', ')}`
        return `stance ${stance}${sets}`
      }
      out.push(
        `| ${choices.map((_, i) => `Choice ${i + 1}`).join(' | ')} |`,
        `| ${choices.map(() => '---').join(' | ')} |`,
      )
      out.push(
        `| ${choices.map((c) => cell(`${name(byId.get(c.line)?.speaker)}: ${said(c.line) ?? `(${c.line})`}`)).join(' | ')} |`,
      )
      out.push(`| ${choices.map((c) => cell(moves(c))).join(' | ')} |`)
      out.push(`| ${choices.map((c) => cell(`→ ${c.next}`)).join(' | ')} |`, '')
    }
    if (n.next !== undefined) out.push(`→ ${n.next}`, '')
    else if (choices.length === 0) out.push('*(exit)*', '')
  }
  return out.join('\n')
}

export function screenplay(
  act: string,
  scenes: readonly ScreenplayScene[],
  stamp: string,
  command: string,
): string {
  const L: string[] = [
    `<!-- Generated by \`${command}\`. Do not edit: change the lines, beats or cutscenes and regenerate. -->`,
    `<!-- ${stamp} -->`,
    '',
    `# ${title(act)}: screenplay (generated)`,
    '',
    `> The shortest solver route through each scene of ${act}, played in the real simulation: the cutscene captions, what the player reads and says, the items taken, barks and conversations, in play order, with each story beat marked where it first lands. Times are minutes of play, cutscenes included. Generated by the narrative pipeline; \`narrative check\` fails when it is older than the scene.`,
    '',
  ]
  for (const s of scenes) {
    const records = new Map(s.records.map((r) => [r.id, r]))
    const words = (id: string): string => flat(s.text[records.get(id)?.text ?? ''] ?? `(${id})`)
    // Every beat a line delivers (`beatCoverage`: a beat lands with the first of its lines shown).
    const beatsOf = new Map<string, Beat[]>()
    for (const b of s.beats) for (const id of b.deliveredBy) beatsOf.set(id, [...(beatsOf.get(id) ?? []), b])
    const landed = new Set<string>()
    const steps = s.trace.events.filter((e) => e.kind === 'step').length
    const total = Math.max(0, ...s.trace.events.map((e) => e.at + (e.kind === 'cutscene' ? e.duration : 0)))
    L.push(
      `## ${s.title} (\`${s.scene}\`)`,
      '',
      `Route: **${s.trace.route}**, ${plural(steps, 'step')}, about ${clock(total)} of play. ${plural(s.routes.length, 'solver route')} in all.`,
      '',
    )
    L.push(
      '| Beat | Required | On this route | Reach | What the player learns |',
      '| --- | --- | --- | --- | --- |',
    )
    for (const b of s.coverage)
      L.push(
        `| \`${b.id}\` | ${b.required ? 'yes' : 'no'} | ${b.delivered.includes(s.trace.route) ? 'yes' : '—'} | ${b.delivered.length}/${s.routes.length} | ${b.learn} |`,
      )
    L.push('')
    const mark = (id: string | undefined): void => {
      for (const b of id === undefined ? [] : (beatsOf.get(id) ?? [])) {
        if (landed.has(b.id)) continue
        landed.add(b.id)
        L.push(`> ▸ **Beat \`${b.id}\`**${b.required ? ' (required)' : ''}: ${b.learn}`, '')
      }
    }
    const say = (id: string, from?: string): void => {
      const r = records.get(id)
      if (r === undefined) {
        L.push(`- *(${id}: no record)*`, '')
        return
      }
      const speaker = upper(r.speaker)
      const where = from ? ` *(${from})*` : ''
      L.push(
        speaker ? `**${speaker}**${where}: ${words(id)}` : `> ${words(id)}${where ? ` —${where}` : ''}`,
        '',
      )
      mark(id)
    }
    for (const e of s.trace.events as readonly TraceEvent[]) {
      if (e.kind === 'step') L.push(`### ${clock(e.at)} · ${e.n}. ${e.text}`, '')
      else if (e.kind === 'cutscene') {
        L.push(`### ${clock(e.at)} · Cutscene: ${e.id} (${seconds(e.duration)} s)`, '')
        for (const c of e.captions) {
          const r = records.get(c)
          L.push(r?.speaker ? `**${upper(r.speaker)}**: ${words(c)}` : `*${words(c)}*`, '')
          mark(c)
        }
      } else if (e.kind === 'line') say(e.id, e.title)
      else if (e.kind === 'item') {
        const name = records.get(e.name) === undefined ? e.item : words(e.name)
        const description = records.get(e.text) === undefined ? undefined : words(e.text)
        L.push(`**[ ${name} ]**${description ? ` ${description}` : ''}`, '')
        mark(e.name)
        mark(e.text)
      } else if (e.kind === 'dialogue') {
        const graph = s.dialogues?.find((g) => g.id === e.id)
        L.push(graph ? dialogueScreenplay(graph, s.records, s.text) : `*(dialogue ${e.id}: no graph)*`, '')
        // What the conversation says on every path, before its first choice (`shown`).
        for (const id of e.said) mark(id)
      } else L.push(`> ${flat(e.text)} *(not a line record)*`, '')
    }
    // What a player finds off this route: the beats it does not deliver.
    const off = s.beats.filter((b) => !landed.has(b.id))
    if (off.length > 0) {
      L.push(
        '### Off the route',
        '',
        'Beats this route does not deliver, and the lines that deliver them elsewhere:',
        '',
      )
      for (const b of off) {
        L.push(`- **\`${b.id}\`**${b.required ? ' (required)' : ''}: ${b.learn}`)
        for (const id of b.deliveredBy) {
          const r = records.get(id)
          L.push(
            `  - \`${id}\`: ${r ? `${upper(r.speaker) ? `${upper(r.speaker)}: ` : ''}${words(id)}` : '(no record)'}`,
          )
        }
      }
      L.push('')
    }
  }
  storyletAppendix(L, scenes)
  return L.join('\n')
}

/** The "Storylets" appendix, after every scene: each scene's deck, every storylet with its trigger, conditions and lines, marked where the solver routes played it. */
function storyletAppendix(L: string[], scenes: readonly ScreenplayScene[]): void {
  const decks = scenes.filter((s) => (s.storylets ?? []).length > 0)
  if (decks.length === 0) return
  L.push(
    '## Storylets (appendix)',
    '',
    '> Lines the game picks by context, outside conversation: what the player does, where they are and what they know. Of the storylets whose trigger fires and whose conditions hold, the one with the most conditions plays; on an examine it follows the action’s own line. Routes are played in the sim, so a storylet that needs a pursuer’s mode or a long wait is listed with the state that reaches it.',
    '',
  )
  for (const s of decks) {
    const records = new Map(s.records.map((r) => [r.id, r]))
    const rows = s.storylets ?? []
    L.push(`### ${s.title}: the \`${s.scene}\` deck`, '')
    L.push(
      `${plural(rows.length, 'storylet')}; ${rows.filter((x) => x.reached.length > 0).length} played on a solver route.`,
      '',
    )
    for (const x of rows) {
      L.push(`#### \`${x.id}\` · ${x.phase} · ${x.limit}`, '')
      L.push(`- **Trigger:** ${x.trigger}`)
      L.push(`- **When:** ${x.when.length > 0 ? x.when.map(showCond).join(' and ') : 'always'}`)
      L.push(
        `- **On the routes:** ${x.reached.length > 0 ? `✓ played on ${x.reached.length}/${s.routes.length} (${x.reached.join('; ')})` : 'not on a solver route: it plays when the trigger fires in the state above'}`,
      )
      L.push('')
      for (const id of x.lines) {
        const r = records.get(id)
        const body = flat(s.text[r?.text ?? ''] ?? `(${id})`)
        L.push(
          r
            ? `${upper(r.speaker) ? `**${upper(r.speaker)}**` : '>'} \`${id}\`: ${body}`
            : `- *(${id}: no record)*`,
          '',
        )
      }
    }
  }
}
