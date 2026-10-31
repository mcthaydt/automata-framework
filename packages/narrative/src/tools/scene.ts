// The scene runner (M6.8b step 7): what `automata pipe narrative` does with a game's scene. The pipeline's scene module
// exports a `NarrativeToolsScene` (the narrative counterpart of puzzle's `PuzzleScene`, PZ-D2): the game's trace game
// (its puzzle, lines, conversations and the sim to play them in), its canon and locale text, its deck and beats and its
// puzzle help, with the rules that are the game's own (NR-D8). Nothing here imports a game.
import { showCond } from '@mcthaydt/automata-puzzle/solver'
import type { Canon, Storylet } from '../sim/index'
import type { Beat } from './beats.schema'
import { type BeatReport, beatCoverage, type HintSystems, hintCheck } from './coverage'
import { type DeckRules, lintDeck } from './deck-lint'
import { type DialogueRules, lintDialogues } from './dialogue-lint'
import type { Finding } from './finding'
import { helpInputOf, lintHelp } from './help'
import type { SceneHelp } from './help.schema'
import { hintProbes } from './hint-probes'
import { type Boxes, lintNarrative, type Measure } from './lint'
import { screenplay, storyletRows } from './screenplay'
import { solverRoutes, type Trace, type TraceGame, traces } from './traces'

export interface NarrativeToolsScene {
  /** The scene id, its puzzle and lines, and the sim to play routes in. */
  readonly game: TraceGame
  readonly title: string
  readonly canon: Canon
  /** The locale's text, by line key. */
  readonly text: Readonly<Record<string, string>>
  readonly storylets: readonly Storylet[]
  readonly beats: readonly Beat[]
  readonly help?: SceneHelp | undefined
  /** Line length is checked only with a measure (NR-D7): a canvas, a font table. */
  readonly measure?: Measure | undefined
  readonly boxes?: Boxes | undefined
  readonly dialogueRules?: DialogueRules | undefined
  readonly deck?:
    | {
        /** Sector ids and zones a trigger may name. */
        readonly rooms: readonly string[]
        /** Facts the game keeps itself, which a condition may read. */
        readonly facts?: readonly string[] | undefined
        /** Facts a later package provides: a condition on one is a warning. */
        readonly pending?: readonly string[] | undefined
        readonly rules?: DeckRules | undefined
      }
    | undefined
  readonly hint?:
    | {
        readonly systems?: HintSystems | undefined
        /** Before the story's last act an agent without barks is a warning. */
        readonly barksRequired?: boolean | undefined
        readonly quiet?: readonly string[] | undefined
      }
    | undefined
  /** What the screenplay calls the player: "Ada examines Drawer". */
  readonly player?: string | undefined
}

const records = (s: NarrativeToolsScene) => s.game.records
const dialogueFacts = (s: NarrativeToolsScene): Set<string> => {
  const out = new Set(['stance'])
  for (const g of s.game.graphs)
    for (const n of Object.values(g.nodes))
      for (const c of n.choices ?? []) for (const k of Object.keys(c.set ?? {})) out.add(k)
  return out
}

/** Lint, dialogue lint (a dead end fails, NR-c) and deck lint. */
export function lintScene(scene: NarrativeToolsScene): {
  narrative: Finding[]
  dialogue: Finding[]
  deck: Finding[]
} {
  const { game } = scene
  const def = game.puzzle.def
  const started = new Set(
    def.actions.flatMap((a) => a.then.flatMap((e) => ('dialogue' in e ? [e.dialogue] : []))),
  )
  const puzzleFacts = new Set([
    ...Object.keys(def.facts),
    ...def.entry.flatMap((e) => Object.keys(e.facts ?? {})),
  ])
  const said = dialogueFacts(scene)
  const own = new Set(scene.deck?.facts ?? [])
  return {
    narrative: lintNarrative({
      canon: scene.canon,
      records: records(scene),
      text: scene.text,
      beats: scene.beats,
      measure: scene.measure,
      boxes: scene.boxes,
    }),
    dialogue: lintDialogues({
      canon: scene.canon,
      graphs: game.graphs,
      records: records(scene),
      text: scene.text,
      started,
      measure: scene.measure,
      rules: scene.dialogueRules,
    }),
    deck: lintDeck({
      scene: game.scene,
      storylets: scene.storylets,
      records: records(scene),
      facts: scene.canon.facts,
      beats: scene.beats,
      hotspots: Object.keys(def.hotspots),
      rooms: scene.deck?.rooms ?? [],
      known: (name) => puzzleFacts.has(name) || said.has(name) || own.has(name),
      pending: scene.deck?.pending,
      rules: scene.deck?.rules,
    }),
  }
}

export interface Coverage {
  readonly routes: readonly { name: string; entry: string; steps: string[] }[]
  readonly traces: readonly Trace[]
  readonly beats: readonly BeatReport[]
  /** Required beats, `after` order, the goal, and any message that is no line record. */
  readonly findings: readonly Finding[]
  readonly hints: ReturnType<typeof hintCheck>
}

/** Every solver route played in the sim: beat coverage, then the hints probed before their risk. */
export async function coverageOf(scene: NarrativeToolsScene): Promise<Coverage> {
  const { game } = scene
  const routes = solverRoutes(game.puzzle)
  const played = await traces(game, routes)
  const covered = beatCoverage(scene.beats, played)
  // A message that is no line record is text the narrative tools cannot see (lint, canon, beats).
  const unrecorded = [
    ...new Set(played.flatMap((t) => t.events.flatMap((e) => (e.kind === 'unrecorded' ? [e.text] : [])))),
  ]
  const findings: Finding[] = [
    ...covered.findings,
    ...unrecorded.map(
      (text): Finding => ({
        level: 'error',
        rule: 'unrecorded',
        id: game.scene,
        detail: `a route shows text that is no line record: ${JSON.stringify(text)}`,
      }),
    ),
  ]
  const { probes, exposes } = await hintProbes(game, routes)
  const hints = hintCheck({
    records: records(scene),
    lethal: game.puzzle.def.lethal,
    probes,
    exposes,
    systems: scene.hint?.systems,
    barksRequired: scene.hint?.barksRequired ?? true,
    quiet: scene.hint?.quiet,
    scene: game.scene,
  })
  return {
    routes: routes.map((r) => ({ name: r.name, entry: r.entry, steps: r.steps.map((s) => s.action) })),
    traces: played,
    beats: covered.beats,
    findings,
    hints,
  }
}

/** The puzzle-help rules (three hints per puzzle, three clues per deduction) checked against the solver's routes. */
export function helpFindings(scene: NarrativeToolsScene): Finding[] {
  return lintHelp(
    helpInputOf({
      puzzle: scene.game.puzzle,
      records: records(scene),
      graphs: scene.game.graphs,
      help: scene.help,
    }),
  )
}

/** The act screenplay for a scene, from the routes `coverageOf` played. */
export function screenplayOf(
  scene: NarrativeToolsScene,
  played: Coverage,
  options: { readonly act: string; readonly stamp: string; readonly command: string },
): string {
  const routeNames = played.routes.map((r) => r.name)
  // The shortest route over every entry (the first of the fewest steps).
  const best = played.routes.reduce(
    (b, r, i) => (r.steps.length < (played.routes[b]?.steps.length ?? 0) ? i : b),
    0,
  )
  const trace = played.traces[best]
  if (trace === undefined) throw new Error(`${scene.game.scene}: no solver route to write a screenplay from`)
  return screenplay(
    options.act,
    [
      {
        scene: scene.game.scene,
        title: scene.title,
        trace,
        routes: routeNames,
        beats: scene.beats,
        coverage: played.beats,
        records: records(scene),
        text: scene.text,
        dialogues: scene.game.graphs,
        storylets: storyletRows(scene.storylets, played.traces, {
          names: scene.game.puzzle.names,
          player: scene.player ?? 'the player',
        }),
      },
    ],
    options.stamp,
    options.command,
  )
}

/** The puzzle-help doc: each ladder's three hints and each deduction's clues, with their text and where the player meets them. */
export function helpDoc(scene: NarrativeToolsScene, stamp: string): string {
  const byId = new Map(records(scene).map((r) => [r.id, r]))
  const clue = (c: { line: string; at: string }): string => {
    const words = (scene.text[byId.get(c.line)?.text ?? ''] ?? `(${c.line})`).replace(/\n/g, ' / ')
    return `“${words}” — \`${c.line}\` at ${c.at}`
  }
  const L: string[] = [
    '<!-- Generated by `automata pipe narrative help`. Do not edit: change the help, the lines or the puzzle and regenerate. -->',
    `<!-- ${stamp} -->`,
    '',
    `# ${scene.title}: puzzle help (generated)`,
    '',
    '> Every puzzle has three escalating hints, a nudge, a direction, then nearly the answer, all lines the player meets by playing; every deduction has about three clues from different places. `narrative check` fails when this doc is older than the help.',
    '',
  ]
  const help = scene.help
  if (help === undefined) return `${L.join('\n')}No help is written for this scene.\n`
  L.push('## Hint ladders', '')
  for (const h of help.hints) {
    L.push(`### \`${h.id}\`: ${h.puzzle}`, '')
    L.push(
      (h.done ?? []).length > 0
        ? `- Done when ${(h.done ?? []).map(showCond).join(' and ')}`
        : '- Done when: the last puzzle, never done',
      '',
    )
    h.levels.forEach((c, i) => {
      L.push(`${i + 1}. ${clue(c)}`)
    })
    L.push('')
  }
  L.push('## Deductions', '')
  for (const d of help.deductions) {
    L.push(`### \`${d.id}\`: ${d.learn}`, '', `For: ${d.for.join(', ')}`, '')
    for (const c of d.clues) L.push(`- ${clue(c)}`)
    L.push('')
  }
  return L.join('\n')
}
