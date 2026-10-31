// The toy scene with a conversation that never ends: two nodes that lead to each other, so no node reaches an exit.
// `narrative check` fails it (NR-c).
import type { NarrativeToolsScene } from '../tools/scene'
import { toyNarrativeScene, toyTraceGame } from './toy-trace'

export const narrative: NarrativeToolsScene = toyNarrativeScene({
  game: toyTraceGame({
    graphs: [
      {
        id: 'meet',
        speaker: 'porter',
        start: 'a',
        nodes: {
          a: { say: ['toy.hello'], choices: [{ line: 'toy.duty', next: 'b' }, { line: 'toy.unsure', next: 'b' }] },
          b: { say: ['toy.ask'], next: 'a' },
        },
      },
    ],
  }),
})
