// The source tests' small definitions, re-pointed at AF: a world-rule toy (an alarm that wakes a watchman), the toy
// watchman agent that patrols the clinic's corridor, and a chaser for pursuit.
import type { AgentDef, SystemsDef } from '../shared/sim/systems.schema'

const base = {
  objects: [
    { id: 'power', name: 'Power', signal: 'lamps' },
    { id: 'sound', name: 'Sound', signal: 'rings' },
    { id: 'watchman', name: 'Watchman', signal: 'footsteps' },
  ],
  fairness: {
    cautiousWin: 0.9,
    firstThreatAfter: 20,
    telegraph: 1.5,
    maxDeathsPerRun: 1,
    safeWindowMargin: 1.3,
  },
}

/** The original's `systems.test.ts` toy: the alarm rings every 2 s while the power is off, and wakes the watchman. */
export const alarmToy = (): SystemsDef => ({
  scene: 'clinic',
  ...base,
  matrix: [
    { row: 'power', col: 'sound', verb: 'the alarm rings while the power is off', rule: 'alarm' },
    { row: 'sound', col: 'watchman', verb: 'draws him', presentation: 'he turns toward the ring' },
    { row: 'power', col: 'watchman', verb: 'stuns him', cut: 'no puddle in the toy' },
  ],
  tunables: { alarmEvery: { value: 2, min: 1, max: 5, unit: 's', note: 'between rings' } },
  rules: [
    {
      id: 'alarm',
      text: 'The alarm rings every 2 s while the power is off.',
      every: 2,
      when: [{ fact: 'power', is: false }],
      then: [{ noise: { at: { x: 0, z: -6 }, loudness: 12, kind: 'alarm' } }],
    },
    {
      id: 'wake',
      text: 'The first ring wakes the watchman.',
      when: [
        { mode: 'asleep', agent: 'watchman' },
        { heard: 'alarm', reach: 30 },
      ],
      then: [{ setMode: 'patrol', agent: 'watchman' }, { call: 'woke' }],
    },
  ],
  agents: [
    {
      id: 'watchman',
      modes: ['asleep', 'patrol', 'investigate'],
      initial: 'asleep',
      speed: { asleep: 0, patrol: 1, investigate: 1.5 },
      senses: [{ sound: { reach: 14 } }],
      transitions: [
        {
          from: 'patrol',
          to: 'investigate',
          when: [{ heard: 'alarm', reach: 14 }],
          priority: 1,
          do: [{ goTo: 'noise' }],
        },
      ],
    },
  ],
  scenarios: [
    {
      id: 'alarmWakes',
      setup: {},
      policy: 'scripted',
      expect: { condition: [{ mode: 'investigate', agent: 'watchman' }], within: 5, probability: 1 },
      seeds: 1,
    },
  ],
})

/** The original's `agents.test.ts` watchman: patrols the corridor, hunts what it sees, investigates what it hears. */
export const watchman = (): AgentDef => ({
  id: 'watchman',
  modes: ['patrol', 'investigate', 'hunt', 'stunned'],
  initial: 'patrol',
  speed: { patrol: 1, investigate: 1.5, hunt: 2, stunned: 0 },
  senses: [{ sight: { range: 4.5, wallsOnly: true } }, { sound: { reach: 10 } }, { touch: { radius: 0.6 } }],
  transitions: [
    { from: '*', to: 'stunned', when: [{ fact: 'power', is: true }], priority: 30, do: [{ call: 'shriek' }] },
    { from: '*', to: 'hunt', when: [{ sees: true }], priority: 20, do: [{ goTo: 'player' }] },
    {
      from: 'patrol',
      to: 'investigate',
      when: [{ heard: '*', reach: 10 }],
      priority: 10,
      do: [{ goTo: 'noise' }, { set: 'self.timer', to: 0 }],
    },
    {
      from: 'hunt',
      to: 'hunt',
      when: [{ touching: true }],
      priority: 25,
      do: [{ emit: { caught: 'nurse' } }],
    },
    {
      from: 'investigate',
      to: 'patrol',
      when: [{ fact: 'self.idle', is: true }, { timer: 3 }],
      priority: 5,
      do: [{ set: 'self.timer', to: 0 }],
    },
  ],
  routine: [
    { node: 'end', dwell: 1, do: [{ set: 'monitorSeen', to: true }] },
    { node: 'cmid', dwell: 0.5 },
  ],
  hooks: ['shriek'],
})

/** A scene with one agent and nothing else. */
export const sceneOf = (agent: AgentDef, extra: Partial<SystemsDef> = {}): SystemsDef => ({
  scene: 'clinic',
  ...base,
  matrix: [],
  tunables: {},
  rules: [],
  agents: [agent],
  scenarios: [],
  ...extra,
})
