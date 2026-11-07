// `lintHelp` and `currentHint` (M6.8b step 4): the owner's two puzzle-design rules (2026-10-11), checked on a toy puzzle
// scene with its solver routes, and on the four converted scenes' help against their converted puzzles.

import { createSolver, routesOf } from '@automata/puzzle/solver'
import { scenePuzzle } from '@automata/puzzle/testing/converted-puzzles'
import { toyScene } from '@automata/puzzle/testing/toy-scene'
import { describe, expect, it } from 'vitest'
import type { DialogueGraph, LineRecord } from '../sim/index'
import { fixture, SCENES } from '../testing/converted-narrative'
import { currentHint, type HelpInput, helpInputOf, lintHelp } from './help'
import type { SceneHelp } from './help.schema'

const line = (id: string, kind: LineRecord['kind'], extra: Partial<LineRecord> = {}): LineRecord => ({
  id,
  kind,
  text: id,
  ...extra,
})
const RECORDS: LineRecord[] = [
  line('toy.drawer', 'examine'),
  line('toy.door', 'examine'),
  line('toy.locked', 'examine'),
  line('toy.hint1', 'bark', { speaker: 'guard' }),
  line('toy.hint2', 'note'),
  line('toy.hint3', 'item'),
  line('toy.hint4', 'bark', { speaker: 'guard' }),
  line('toy.objective.door', 'objective'),
]
const HELP: SceneHelp = {
  hints: [
    {
      id: 'drawer',
      puzzle: 'Find the key.',
      done: [{ fact: 'drawerOpen', is: true }],
      levels: [
        { line: 'toy.hint1', at: 'bark:guard' },
        { line: 'toy.hint2', at: 'door' },
        { line: 'toy.drawer', at: 'drawer' },
      ],
    },
    {
      id: 'door',
      puzzle: 'Open the door.',
      levels: [
        { line: 'toy.hint4', at: 'bark:guard' },
        { line: 'toy.hint3', at: 'item:key' },
        { line: 'toy.door', at: 'door' },
      ],
    },
  ],
  deductions: [
    {
      id: 'keyInDrawer',
      learn: 'The key is in the drawer.',
      for: ['drawer'],
      clues: [
        { line: 'toy.hint1', at: 'bark:guard' },
        { line: 'toy.hint2', at: 'door' },
        { line: 'toy.drawer', at: 'drawer' },
      ],
    },
    {
      id: 'keyOpensDoor',
      learn: 'The key opens the door.',
      for: ['door'],
      clues: [
        { line: 'toy.hint4', at: 'bark:guard' },
        { line: 'toy.hint3', at: 'item:key' },
        { line: 'toy.door', at: 'door' },
      ],
    },
  ],
}
const scene = toyScene()
const solver = createSolver(scene.def, scene.model)
const routes = routesOf(solver.solve())
const input = (help: SceneHelp | undefined, over: Partial<HelpInput> = {}): HelpInput => ({
  ...helpInputOf({ puzzle: scene, records: RECORDS, graphs: [], help, routes }),
  ...over,
})
const errors = (i: HelpInput) => lintHelp(i).filter((f) => f.level === 'error')
const keys = (i: HelpInput) => errors(i).map((f) => `${f.rule} ${f.id}`)
type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> }
const at = <T>(list: T[], i: number): T => list[i] as T
const clone = (): Mutable<SceneHelp> => structuredClone(HELP) as Mutable<SceneHelp>

describe('helpInputOf', () => {
  it('reads the places a clue can be met, who says a line, and each route as states', () => {
    const i = input(HELP)
    expect(i.places).toEqual(expect.arrayContaining(['drawer', 'door', 'item:key', 'bark:guard']))
    expect(i.says).toEqual({ 'toy.drawer': ['drawer'], 'toy.door': ['door'], 'toy.locked': ['door'] })
    expect(i.facts).toEqual(['drawerOpen', 'doorOpen'])
    expect(i.routes[0]?.states.length).toBe((routes[0]?.solution.steps.length ?? 0) + 1)
  })
  it('lists a dialogue graph and a cutscene as places', () => {
    const graph: DialogueGraph = { id: 'meet', speaker: 'guard', start: 'a', nodes: { a: { say: [] } } }
    const i = helpInputOf({
      puzzle: { ...scene, cutscenes: ['dawn'] },
      records: RECORDS,
      graphs: [graph],
      help: HELP,
      routes,
    })
    expect(i.places).toEqual(expect.arrayContaining(['dialogue:meet', 'cutscene:dawn']))
  })
})

describe('lintHelp', () => {
  it('passes help with three hints per puzzle and three clues from three places per deduction, on every route', () => {
    expect(errors(input(HELP))).toEqual([])
  })
  it('fails a scene with no help', () => {
    expect(errors(input(undefined)).map((f) => f.rule)).toEqual(['missing'])
  })
  it('fails a puzzle without three hints, hints from one place, and a UI line as a hint', () => {
    const h = clone()
    at(h.hints, 0).levels = at(h.hints, 0).levels.slice(0, 2)
    at(h.hints, 1).levels = [
      { line: 'toy.hint4', at: 'bark:guard' },
      { line: 'toy.hint1', at: 'bark:guard' },
      { line: 'toy.objective.door', at: 'bark:guard' },
    ]
    expect(keys(input(h))).toEqual(expect.arrayContaining(['levels drawer', 'places door', 'kind door']))
  })
  it('fails a deduction with two clues, or three from two places, and a puzzle no deduction is for', () => {
    const h = clone()
    at(h.deductions, 0).clues = at(h.deductions, 0).clues.slice(0, 2)
    at(h.deductions, 1).clues = [
      { line: 'toy.door', at: 'door' },
      { line: 'toy.locked', at: 'door' },
      { line: 'toy.hint4', at: 'bark:guard' },
    ]
    expect(keys(input(h))).toEqual(expect.arrayContaining(['clues keyInDrawer', 'places keyOpensDoor']))
    h.deductions = h.deductions.filter((d) => d.id !== 'keyOpensDoor')
    expect(keys(input(h))).toContain('deduction door')
  })
  it('fails a clue placed where it is not said, and a place the scene does not have', () => {
    const h = clone()
    at(h.deductions, 0).clues[1] = { line: 'toy.door', at: 'drawer' }
    at(h.deductions, 0).clues[2] = { line: 'toy.drawer', at: 'cutscene:nowhere' }
    // toy.door is said at the door, not the drawer; toy.drawer is met at no cutscene the scene has, nor where it is said.
    expect(errors(input(h)).map((f) => `${f.rule} ${f.detail.split(' ')[0]}`)).toEqual([
      'at toy.door',
      'at toy.drawer',
      'at toy.drawer',
    ])
  })
  it('fails a line that is not in the story, a ladder reading a fact the puzzle lacks, and a ladder listed twice', () => {
    const h = clone()
    at(h.deductions, 0).clues[0] = { line: 'toy.nope', at: 'door' }
    at(h.hints, 0).done = [{ fact: 'ghost', is: true }]
    h.hints.push({ ...at(h.hints, 1), done: [{ fact: 'doorOpen', is: true }] })
    expect(keys(input(h))).toEqual(expect.arrayContaining(['line keyInDrawer', 'fact drawer', 'id door']))
  })
  it('fails a ladder with no `done` that is not last, because it would hide the ladders after it', () => {
    const h = clone()
    at(h.hints, 0).done = undefined
    expect(keys(input(h))).toContain('done drawer')
  })
  it('fails a route step with no puzzle to hint at', () => {
    const h = clone()
    // Both ladders are done by the time of the door step: that step belongs to no puzzle with hints.
    at(h.hints, 1).done = [{ fact: 'drawerOpen', is: true }]
    expect(keys(input(h))).toContain(`uncovered ${routes[0]?.name}`)
  })
  it('warns of a deduction whose clues are all one kind', () => {
    const h = clone()
    at(h.deductions, 1).clues = [
      { line: 'toy.door', at: 'door' },
      { line: 'toy.drawer', at: 'drawer' },
      { line: 'toy.locked', at: 'door' },
    ]
    const warnings = lintHelp(input(h)).filter((f) => f.level === 'warning')
    expect(warnings.map((f) => f.rule)).toContain('kinds')
  })
})

describe('currentHint', () => {
  it('is the first ladder whose `done` does not hold', () => {
    const at = (facts: Record<string, boolean>) => ({ fact: (n: string) => facts[n], has: () => false })
    expect(currentHint(HELP, at({}))?.id).toBe('drawer')
    expect(currentHint(HELP, at({ drawerOpen: true }))?.id).toBe('door')
    expect(currentHint(undefined, at({}))).toBeNull()
  })
})

describe('the converted scenes', () => {
  it('have help whose lines exist and whose clues are met where the puzzle says them', () => {
    for (const name of SCENES) {
      const puzzle = scenePuzzle(name)
      const records = (fixture(`${name}.lines.toml`) as { lines: LineRecord[] }).lines
      const graphs = (fixture(`${name}.dialogue.toml`) as { graphs: DialogueGraph[] }).graphs
      const help = fixture(`${name}.help.toml`) as unknown as SceneHelp
      const cutscenes = [
        ...new Set(
          [...help.hints.flatMap((h) => h.levels), ...help.deductions.flatMap((d) => d.clues)]
            .map((c) => c.at)
            .filter((at) => at.startsWith('cutscene:'))
            .map((at) => at.slice(9)),
        ),
      ]
      const i = helpInputOf({
        puzzle: {
          id: name,
          def: puzzle,
          model: {},
          names: {},
          spawn: { x: 0, z: 0 },
          story: { lines: {}, items: {} },
          cutscenes,
          walk: () => 0,
          sources: [],
        },
        records,
        graphs,
        help,
        routes: [],
      })
      expect(
        lintHelp(i).filter((f) => f.level === 'error'),
        name,
      ).toEqual([])
    }
  })
})
