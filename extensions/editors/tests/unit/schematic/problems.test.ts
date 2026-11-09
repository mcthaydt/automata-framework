import type { SystemsDef } from '@automata/systems/sim'
import { describe, expect, it } from 'vitest'
import { schematicProblems } from '#src/features/schematic/schematic-problems.ts'
import { fixture, SCENES } from '../../fixtures/systems-fixtures.ts'

type Draft = {
  -readonly [K in keyof SystemsDef]: SystemsDef[K] extends readonly (infer U)[]
    ? U[]
    : SystemsDef[K] extends Readonly<Record<string, infer V>>
      ? Record<string, V>
      : SystemsDef[K]
}

const base = (): Draft => ({
  scene: 'hall',
  objects: [],
  matrix: [],
  tunables: { chase: { value: 2, min: 1, max: 4, unit: 'm/s', note: 'how fast' } },
  rules: [
    {
      id: 'lights',
      text: 'Lights go out.',
      when: [{ fact: 'power', is: false }],
      then: [{ set: 'dark', to: true }],
    },
  ],
  agents: [
    {
      id: 'guard',
      modes: ['patrol', 'hunt'],
      initial: 'patrol',
      speed: { patrol: 1, hunt: 2 },
      senses: [{ sight: { range: 5 } }],
      transitions: [{ from: 'patrol', to: 'hunt', when: [{ sees: true }], priority: 1 }],
      routine: [{ node: 'desk', dwell: 2 }],
    },
    {
      id: 'nurse',
      modes: ['patrol'],
      initial: 'patrol',
      speed: { patrol: 1 },
      senses: [],
      transitions: [],
    },
  ],
  scenarios: [],
  fairness: {
    cautiousWin: 0.9,
    firstThreatAfter: 20,
    telegraph: 1.5,
    maxDeathsPerRun: 1,
    safeWindowMargin: 1.3,
  },
})

type Change = (def: Draft) => unknown
type Agent = Draft['agents'][0]
type Switch = Agent['transitions'][0]
type Effect = NonNullable<Switch['do']>[0]

const patch = (def: Draft, change: Partial<Agent>, index = 0) =>
  Object.assign(def.agents[index] as Agent, change)
const switching = (def: Draft, ...transitions: Switch[]) => patch(def, { transitions })
const swtch = (over: Partial<Switch>): Switch => ({
  from: 'patrol',
  to: 'hunt',
  when: [],
  priority: 1,
  ...over,
})
const doing =
  (...effects: Effect[]) =>
  (def: Draft) =>
    switching(def, swtch({ do: effects }))
const asking =
  (...when: Switch['when']) =>
  (def: Draft) =>
    switching(def, swtch({ when }))
const rule = (def: Draft) => def.rules[0] as Draft['rules'][0] & { every?: number }
const scenario =
  (over: Partial<Draft['scenarios'][0]> = {}) =>
  (def: Draft) =>
    def.scenarios.push({ ...SCENARIO(), ...over })
const ambush = (over: Record<string, unknown>) =>
  doing({
    ambush: { id: 'a', agent: 'guard', mode: 'hunt', at: 'desk', sting: 1, grace: 1, then: 'hunt', ...over },
  } as Effect)
const follow = (over: Record<string, unknown>) =>
  doing({ followThrough: { portal: 'crossed', delay: 1, then: 'hunt', ...over } } as Effect)
const AT = (n: number) => [
  'agents',
  0,
  'transitions',
  0,
  ...(n === 0 ? ['when', 0] : n === 1 ? ['do', 0] : []),
]

// One broken copy per kind of message the checks can make: what to break, where it lands, and what it says.
const BROKEN: [string, Change, (string | number)[], RegExp][] = [
  [
    'a character twice',
    (d) => patch(d, { id: 'guard' }, 1),
    ['agents', 1, 'id'],
    /Two characters are called “guard”/,
  ],
  [
    'a start mode it lacks',
    (d) => patch(d, { initial: 'chase' }),
    ['agents', 0, 'initial'],
    /starts in “chase”.*not one of its modes/,
  ],
  [
    'a speed for a mode it lacks',
    (d) => patch(d, { speed: { patrol: 1, hunt: 2, ghost: 1 } }),
    ['agents', 0, 'speed', 'ghost'],
    /speed for “ghost”/,
  ],
  [
    'a mode with no speed',
    (d) => patch(d, { speed: { patrol: 1 } }),
    ['agents', 0, 'speed'],
    /Hunt has no speed/,
  ],
  ['a sense it lacks', (d) => patch(d, { senses: [] }), AT(0), /needs it to see/],
  ['a character it lacks', asking({ mode: 'hunt', agent: 'ghost' }), AT(0), /“ghost”.*not in this scene/],
  [
    'a mode the other character lacks',
    asking({ mode: 'hunt', agent: 'nurse' }),
    AT(0),
    /“hunt”.*does not have/,
  ],
  ['a place it lacks', asking({ at: 'moon' }), AT(0), /“moon”.*not one of the scene’s places/],
  [
    'a switch from a mode it lacks',
    (d) => switching(d, swtch({ from: 'ghost' })),
    ['agents', 0, 'transitions', 0, 'from'],
    /switches from “ghost”/,
  ],
  [
    'a switch to a mode it lacks',
    (d) => switching(d, swtch({ to: 'ghost' })),
    ['agents', 0, 'transitions', 0, 'to'],
    /switches to “ghost”/,
  ],
  [
    'a switch that hears and waits',
    (d) => {
      patch(d, { senses: [{ sound: {} }] })
      return switching(d, swtch({ when: [{ heard: '*' }, { fact: 'self.idle', is: true }] }))
    },
    ['agents', 0, 'transitions', 0, 'when'],
    /both about a noise/,
  ],
  [
    'a switch to a character it lacks',
    doing({ setMode: 'hunt', agent: 'ghost' }),
    AT(1),
    /“ghost”.*not in this scene/,
  ],
  ['a switch to a mode it lacks, in an action', doing({ setMode: 'ghost' }), AT(1), /switches to “ghost”/],
  ['a go-to a place it lacks', doing({ goTo: 'moon' }), AT(1), /goes to “moon”/],
  ['game code it does not list', doing({ call: 'chase' }), AT(1), /“chase”.*game’s code.*does not list/],
  [
    'a patrol with no patrol mode',
    (d) =>
      patch(d, { modes: ['walk', 'hunt'], initial: 'walk', speed: { walk: 1, hunt: 2 }, transitions: [] }),
    ['agents', 0, 'routine'],
    /no mode called Patrol/,
  ],
  [
    'a patrol stop at a place it lacks',
    (d) => patch(d, { routine: [{ node: 'moon', dwell: 1 }] }),
    ['agents', 0, 'routine', 0, 'node'],
    /patrol stop is at “moon”/,
  ],
  ['a follow to a mode it lacks', follow({ then: 'ghost' }), AT(1), /follows.*“ghost”/],
  ['a follow with a delay below zero', follow({ delay: -1 }), AT(1), /wait.*0 or more/],
  ['a follow through a doorway that is not one', follow({ portal: 'wall' }), AT(1), /doorway/],
  ['an ambush by a character it lacks', ambush({ agent: 'ghost' }), AT(1), /“ghost”.*not in this scene/],
  ['an ambush in a mode it lacks', ambush({ mode: 'ghost' }), AT(1), /no mode “ghost”/],
  ['an ambush with a time below zero', ambush({ sting: -1 }), AT(1), /0 or more/],
  ['a rule twice', (d) => d.rules.push({ ...rule(d) }), ['rules', 1, 'id'], /Two rules are called “lights”/],
  [
    'a rule that repeats never',
    (d) => Object.assign(rule(d), { every: 0 }),
    ['rules', 0, 'every'],
    /more than 0 seconds/,
  ],
  [
    'a rule that hears and repeats',
    (d) => Object.assign(rule(d), { every: 2, when: [{ heard: '*' }] }),
    ['rules', 0, 'every'],
    /listens.*timer/,
  ],
  [
    'a rule that waits',
    (d) => Object.assign(rule(d), { when: [{ fact: 'self.idle', is: true }] }),
    ['rules', 0, 'when'],
    /got where it was going/,
  ],
  [
    'a rule that sees',
    (d) => Object.assign(rule(d), { when: [{ sees: true }] }),
    ['rules', 0, 'when', 0],
    /Only a character can see/,
  ],
  [
    'a rule that asks a mode with no character',
    (d) => Object.assign(rule(d), { when: [{ mode: 'patrol' }] }),
    ['rules', 0, 'when', 0],
    /whose mode/,
  ],
  [
    'a rule that uses a character’s own note',
    (d) => Object.assign(rule(d), { when: [{ fact: 'self.seen', is: true }] }),
    ['rules', 0, 'when', 0],
    /own note/,
  ],
  [
    'a rule that sends a character',
    (d) => Object.assign(rule(d), { then: [{ goTo: 'desk' }] }),
    ['rules', 0, 'then', 0],
    /cannot move a character/,
  ],
  [
    'a rule that switches nobody',
    (d) => Object.assign(rule(d), { then: [{ setMode: 'hunt' }] }),
    ['rules', 0, 'then', 0],
    /which character to switch/,
  ],
  [
    'a rule that sets a character’s note',
    (d) => Object.assign(rule(d), { then: [{ set: 'self.seen', to: true }] }),
    ['rules', 0, 'then', 0],
    /own note/,
  ],
  [
    'a rule that asks a mode a character lacks',
    (d) => Object.assign(rule(d), { when: [{ mode: 'ghost', agent: 'guard' }] }),
    ['rules', 0, 'when', 0],
    /“ghost”.*guard/,
  ],
  [
    'a design note nobody decided',
    (d) => d.matrix.push({ row: 'power', col: 'sound', verb: 'draws' }),
    ['matrix', 0],
    /nothing decided/,
  ],
  [
    'a design note that names a rule it lacks',
    (d) => d.matrix.push({ row: 'power', col: 'sound', verb: 'draws', rule: 'ghost' }),
    ['matrix', 0, 'rule'],
    /“ghost”/,
  ],
  [
    'a number whose lowest is above its highest',
    (d) => Object.assign(d.tunables, { chase: { value: 2, min: 5, max: 4, unit: 'm/s', note: '' } }),
    ['tunables', 'chase', 'min'],
    /“chase”.*lowest.*highest/,
  ],
  [
    'a number out of its range',
    (d) => Object.assign(d.tunables, { chase: { value: 9, min: 1, max: 4, unit: 'm/s', note: '' } }),
    ['tunables', 'chase', 'value'],
    /“chase”.*between 1 and 4/,
  ],
  [
    'a scenario twice',
    (d) => d.scenarios.push(SCENARIO(), SCENARIO()),
    ['scenarios', 1, 'id'],
    /Two checks are called “careful”/,
  ],
  [
    'a scenario with a player that does not exist',
    scenario({ policy: 'sneaky' }),
    ['scenarios', 0, 'policy'],
    /“sneaky”/,
  ],
  [
    'a scenario of no time',
    scenario({ expect: { condition: [], within: 0, probability: 1 } }),
    ['scenarios', 0, 'expect', 'within'],
    /more than 0 seconds/,
  ],
  [
    'a scenario with a chance outside 0 to 1',
    scenario({ expect: { condition: [], within: 5, probability: 2 } }),
    ['scenarios', 0, 'expect', 'probability'],
    /between 0 and 100/,
  ],
  ['a scenario of no tries', scenario({ seeds: 0 }), ['scenarios', 0, 'seeds'], /whole number/],
  [
    'a scenario that places a character it lacks',
    scenario({ setup: { place: { ghost: { x: 0, z: 0 } } } }),
    ['scenarios', 0, 'setup', 'place', 'ghost'],
    /“ghost”/,
  ],
]

function SCENARIO(): SystemsDef['scenarios'][0] {
  return {
    id: 'careful',
    setup: {},
    policy: 'cautious',
    expect: { condition: [], within: 30, probability: 0.8 },
    seeds: 5,
  }
}

const JARGON =
  /\b(transition|probe|agent|node|hook|priority|routine|tunable|matrix|setMode|goTo|followThrough|self\.|pursuit\.)/i

describe('the problems', () => {
  it('finds none in the converted scenes', () => {
    for (const scene of SCENES) expect(schematicProblems(fixture(scene), undefined), scene).toEqual([])
  })

  it('finds none in a good copy', () => {
    expect(schematicProblems(base(), ['desk'])).toEqual([])
  })

  it.each(BROKEN)('says %s in words, at its field', (_name, change, path, words) => {
    const def = base()
    change(def)
    const found = schematicProblems(def, ['desk'])
    const hit = found.find((problem) => JSON.stringify(problem.keyPath) === JSON.stringify(path))
    expect(hit, JSON.stringify(found)).toBeDefined()
    expect(hit?.message).toMatch(words)
    expect(hit?.message).not.toMatch(JARGON)
    expect(hit?.message).toMatch(/[.!?]$/)
  })

  it('never reports a hook the file names, for the game’s code to answer', () => {
    const def = base()
    patch(def, { hooks: ['chase'] })
    doing({ call: 'chase' })(def)
    expect(schematicProblems(def, ['desk'])).toEqual([])
  })

  it('does not check places when it does not know them', () => {
    const def = base()
    asking({ at: 'moon' })(def)
    expect(schematicProblems(def, undefined)).toEqual([])
  })
})
