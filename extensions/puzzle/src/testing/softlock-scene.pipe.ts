// A toy scene with a softlock (the only key used up in the wrong lock), for the pipeline's failing check (P-d).
import type { PuzzleScene } from '../entries/solver'
import { toyScene } from './toy-scene'

const scene = toyScene([
  {
    id: 'drawer',
    at: 'drawer',
    when: [{ fact: 'drawerOpen', is: false }],
    then: [{ set: 'drawerOpen', to: true }, { give: 'key' }],
    say: 'drawer',
  },
  { id: 'cupboard', at: 'drawer', use: 'key', then: [{ take: 'key' }], say: 'locked' },
  { id: 'door', at: 'door', use: 'key', then: [{ take: 'key' }, { set: 'doorOpen', to: true }], say: 'door' },
])
export const puzzle: PuzzleScene = { ...scene, sources: [{ path: 'toy.puzzle.toml', hash: '' }] }
