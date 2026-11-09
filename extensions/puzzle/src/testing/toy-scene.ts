// The source pipeline tests' toy scene as a `PuzzleScene`: a drawer that gives a key, a door it unlocks.

import type { PuzzleDef } from '../entries/sim'
import type { PuzzleScene } from '../entries/solver'

const AT: Record<string, { x: number; z: number }> = { drawer: { x: 3, z: 0 }, door: { x: 3, z: 4 } }

export const toyScene = (actions?: PuzzleDef['actions']): PuzzleScene => ({
  id: 'toy',
  def: {
    scene: 'toy',
    facts: { drawerOpen: false, doorOpen: false },
    items: ['key'],
    hotspots: AT,
    entry: [{ name: 'start', items: [] }],
    actions: actions ?? [
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
        then: [{ take: 'key' }, { set: 'doorOpen', to: true }],
        say: 'door',
        seconds: 3,
      },
      { id: 'door.locked', at: 'door', then: [], say: 'locked' },
    ],
    systemic: [],
    lethal: [],
    goal: [{ fact: 'doorOpen', is: true }],
    fallback: { '*': 'nothing' },
  },
  model: {},
  names: { drawer: 'Drawer', door: 'Door' },
  spawn: { x: 0, z: 0 },
  story: {
    lines: { drawer: 'A key.', door: 'It opens.', locked: 'Locked.', nothing: 'Nothing.' },
    items: { key: 'Key' },
  },
  cutscenes: [],
  walk: (from, to) => {
    const a = from === null ? { x: 0, z: 0 } : (AT[from] as { x: number; z: number })
    const b = AT[to] as { x: number; z: number }
    return Math.hypot(b.x - a.x, b.z - a.z)
  },
  sources: [
    { path: 'puzzles/toy.toml', hash: 'a'.repeat(16) },
    { path: 'puzzle-model.ts', hash: 'b'.repeat(16) },
  ],
})
