// The talk game's toy content: a phone that starts a conversation, a bed with its own line, and a deck with one
// storylet of each trigger. The conversation is the dialogue runtime's toy graph.
import type { PuzzleDef } from '@automata/puzzle/sim'
import type { NarrativeScene } from '../sim/index'

export const TALK_PUZZLE: PuzzleDef = {
  scene: 'talk',
  facts: {},
  items: [],
  hotspots: { phone: { x: 0, z: 3 }, bed: { x: -3, z: -2 } },
  entry: [{ name: 'start', items: [] }],
  actions: [
    { id: 'phone', at: 'phone', then: [{ dialogue: 'meet' }], say: '' },
    { id: 'bed', at: 'bed', then: [], say: 'bed.own' },
  ],
  systemic: [],
  lethal: [],
  goal: [{ fact: 'done', is: true }],
  fallback: { '*': 'nothing' },
}

export const TALK_SCENE: NarrativeScene = {
  graphs: [
    {
      id: 'meet',
      speaker: 'porter',
      start: 'open',
      nodes: {
        open: {
          say: ['toy.hello', 'toy.ask'],
          choices: [
            { line: 'toy.duty', stance: -1, next: 'join' },
            { line: 'toy.unsure', next: 'join' },
            { line: 'toy.yours', stance: 1, set: { metPorter: true }, next: 'join' },
          ],
        },
        join: { say: [], next: 'warm' },
        warm: { say: ['toy.warm'], when: [{ fact: 'light', is: 'lighter' }], next: 'bye' },
        bye: { say: ['toy.bye'] },
      },
    },
  ],
  storylets: [
    { id: 'st.bed', trigger: 'inspect:bed', lines: ['st.bed.1'], once: true },
    { id: 'st.corridor', trigger: 'enter:corridor', lines: ['st.corridor.1', 'st.corridor.2'], max: 2 },
    {
      id: 'st.closet',
      trigger: 'dwell:closet:2',
      lines: ['st.closet.1'],
      when: [{ fact: 'metPorter', is: true }],
    },
    { id: 'st.lit', trigger: 'system:light.on', lines: ['st.lit.1'], once: true },
  ],
}
