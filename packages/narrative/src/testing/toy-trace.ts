// A toy game to play routes in (M6.8b step 5): a drawer that gives a key, a door it unlocks that starts a conversation
// and a cutscene, and a storylet on the drawer. It has the talk game's shape (sectors, puzzle and narrative loaded by
// a command) with its own load command, so the narrative golden's commands stay as they are.
import { createPuzzlePlugin, loadPuzzle, type PuzzleDef } from '@mcthaydt/automata-puzzle/sim'
import type { PuzzleScene } from '@mcthaydt/automata-puzzle/solver'
import { toyScene } from '@mcthaydt/automata-puzzle/testing/toy-scene'
import { loadSectorMap, type SectorMap, sectorsPlugin } from '@mcthaydt/automata-sectors/sim'
import clinicMapToml from '@mcthaydt/automata-sectors/testing/fixtures/clinic.sector-map.toml?raw'
import { createSim, defineCommand, definePlugin, defineSystem } from '@mcthaydt/automata-sim'
import { parse } from 'smol-toml'
import { z } from 'zod'
import { createNarrative, type DialogueGraph, type LineRecord, type Storylet } from '../sim/index'
import type { TraceGame } from '../tools/traces'
import { rec, TALK } from './toy-dialogue'

const Load = defineCommand('toy.load', z.strictObject({ entry: z.string() }))

export const TOY_ACTIONS: PuzzleDef['actions'] = [
  {
    id: 'drawer.open',
    at: 'drawer',
    when: [{ fact: 'drawerOpen', is: false }],
    then: [{ set: 'drawerOpen', to: true }, { give: 'key' }],
    say: 'drawer',
  },
  {
    id: 'door.unlock',
    at: 'door',
    use: 'key',
    then: [{ take: 'key' }, { set: 'doorOpen', to: true }, { dialogue: 'meet' }, { cutscene: 'dawn' }],
    say: 'door',
    seconds: 3,
  },
  { id: 'door.locked', at: 'door', then: [], say: 'locked' },
]
export const TOY_STORYLETS: Storylet[] = [
  { id: 'st.murmur', trigger: 'inspect:drawer', lines: ['toy.murmur'], once: true },
]
const LINES = [
  rec('toy.drawer', 'ada', 'A drawer, and a key in it.'),
  rec('toy.door', 'ada', 'The door gives.'),
  rec('toy.locked', 'ada', 'Locked.'),
  rec('toy.nothing', 'ada', 'Nothing.'),
  rec('toy.item.key.name', null, 'Key'),
  rec('toy.item.key', 'ada', 'A small brass key.'),
  rec('toy.murmur', 'ada', 'Someone has been here.'),
  rec('toy.dawn.1', null, 'First light.'),
  rec('toy.hello', 'porter', 'Cold tonight. The river is high.'),
  rec('toy.ask', 'porter', 'Who are you, then?'),
  rec('toy.duty', 'ada', 'Staff.'),
  rec('toy.unsure', 'ada', 'I don’t know yet.'),
  rec('toy.yours', 'ada', 'I think I’m for you.'),
  rec('toy.warm', 'porter', 'You are warm.'),
  rec('toy.bye', 'porter', 'First light, then.'),
]
export const TOY_RECORDS: LineRecord[] = LINES.map((l) => l.record)
export const TOY_TEXT: Record<string, string> = Object.fromEntries(LINES.map((l) => [l.record.id, l.text]))

export function toyTraceScene(actions: PuzzleDef['actions'] = TOY_ACTIONS): PuzzleScene {
  const base = toyScene(actions)
  return { ...base, cutscenes: ['dawn'] }
}

export function toyTraceGame(over: Partial<TraceGame> = {}): TraceGame {
  const puzzle = toyTraceScene()
  const graphs: DialogueGraph[] = [TALK]
  return {
    scene: 'toy',
    puzzle,
    records: TOY_RECORDS,
    graphs,
    cutscene: (id) =>
      id === 'dawn' ? { duration: 8, captions: ['toy.dawn.1'] } : { duration: 0, captions: [] },
    async create(entry) {
      const narrative = createNarrative()
      const game = definePlugin({
        name: 'toy',
        dependsOn: ['sectors', 'puzzle', 'narrative'],
        commands: [Load],
        systems: [
          defineSystem('toy.load', 'input', (ctx) => {
            for (const { payload } of ctx.commands.of(Load)) {
              loadSectorMap(ctx, parse(clinicMapToml) as unknown as SectorMap)
              loadPuzzle(ctx, puzzle.def, payload.entry)
              narrative.load(ctx, { graphs, storylets: TOY_STORYLETS })
            }
          }),
        ],
      })
      const sim = await createSim({
        seed: 2026,
        plugins: [
          sectorsPlugin,
          createPuzzlePlugin({ dialogue: narrative.startDialogue, verb: narrative.heardVerb }),
          narrative.plugin,
          game,
        ],
      })
      sim.step([{ tick: sim.tick, source: 0, seq: 0, type: 'toy.load', payload: { entry } }])
      return sim
    },
    ...over,
  }
}
