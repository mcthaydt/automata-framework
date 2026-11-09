// The definition checks: the original's `validateSystems`, `validateAgent` and pursuit validation
// cases, each error reported with the original's words at its path, so the content compiler names the file and line.
import { describe, expect, it } from 'vitest'
import type { SystemsDef } from '#src/shared/sim/systems.schema.ts'
import { checkSystems, type SystemsCheckOptions } from '#src/shared/sim/systems-checks.ts'
import { converted, SCENES } from '#src/testing/converted-systems.ts'
import { alarmToy, sceneOf, watchman } from '#src/testing/toy.ts'

const NODES = ['end', 'cmid', 'closet', 'hallN']
/** A def the tests break by hand. */
type Editable = Omit<SystemsDef, 'matrix' | 'tunables' | 'rules' | 'agents' | 'scenarios'> & {
  matrix: SystemsDef['matrix'][number][]
  tunables: Record<string, { value: number; min: number; max: number; unit: string; note: string }>
  rules: (SystemsDef['rules'][number] & { then: SystemsDef['rules'][number]['then'][number][] })[]
  agents: (SystemsDef['agents'][number] & {
    transitions: SystemsDef['agents'][number]['transitions'][number][]
  })[]
  scenarios: SystemsDef['scenarios'][number][]
}
const errorsOf = (def: SystemsDef, options: SystemsCheckOptions) => {
  const found: { path: readonly (string | number)[]; message: string }[] = []
  checkSystems(def, options, (path, message) => found.push({ path, message }))
  return found
}
const messages = (def: SystemsDef, options: SystemsCheckOptions) =>
  errorsOf(def, options).map((e) => e.message)

it('takes the four converted scenes with their hooks declared', () => {
  for (const scene of SCENES) {
    const def = converted(scene)
    const hooks = [...new Set(def.agents.flatMap((a) => a.hooks ?? []))]
    const calls = def.rules.flatMap((r) => r.then.flatMap((e) => ('call' in e ? [e.call] : [])))
    expect(messages(def, { hooks: [...hooks, ...calls] }), scene).toEqual([])
  }
})

describe("the original's validateSystems cases", () => {
  it('a valid definition has no errors', () => {
    expect(messages(alarmToy(), { hooks: ['woke'] })).toEqual([])
  })

  it('reports bad definitions', () => {
    const bad = structuredClone(alarmToy()) as unknown as Editable
    bad.matrix.push(
      { row: 'sound', col: 'power', verb: '?' },
      { row: 'watchman', col: 'power', verb: 'x', rule: 'R99' },
    )
    const alarm = bad.tunables.alarmEvery as { value: number }
    alarm.value = 9
    bad.rules.push({
      id: 'alarm',
      text: 'twice',
      when: [{ sees: true }],
      then: [{ goTo: 'player' }, { setMode: 'awake', agent: 'watchman' }],
    })
    bad.agents[0]?.transitions.push({ from: 'patrol', to: 'hunt', when: [], priority: 2 })
    bad.scenarios.push({
      id: 'odd',
      setup: { place: { ghost: { x: 0, z: 0 } } },
      policy: 'lazy',
      expect: { condition: [], within: 0, probability: 2 },
      seeds: 0,
    })
    const errors = messages(bad, { hooks: [] })
    for (const pattern of [
      /sound × power: undecided/,
      /names unknown rule R99/,
      /alarmEvery: 9 is outside 1–5/,
      /rule alarm: defined twice/,
      /sees needs an agent/,
      /goTo needs an agent/,
      /no mode awake on agent watchman/,
      /to unknown mode hunt/,
      /hook woke is not implemented/,
      /unknown policy lazy/,
      /within must be positive/,
      /probability must be within/,
      /seeds must be/,
      /places unknown agent ghost/,
    ])
      expect(errors, String(pattern)).toEqual(expect.arrayContaining([expect.stringMatching(pattern)]))
  })

  it('reports each error at its path', () => {
    const bad = structuredClone(alarmToy()) as unknown as Editable
    const alarm = bad.tunables.alarmEvery as { value: number }
    alarm.value = 9
    bad.rules[1]?.then.push({ goTo: 'player' })
    expect(errorsOf(bad, { hooks: ['woke'] })).toEqual([
      { path: ['rules', 1, 'then', 2], message: 'rule wake: goTo needs an agent' },
      { path: ['tunables', 'alarmEvery', 'value'], message: 'tunable alarmEvery: 9 is outside 1–5' },
    ])
  })
})

describe("the original's validateAgent cases", () => {
  it('rejects a transition to an unknown mode, and other definition errors', () => {
    const bad = {
      ...watchman(),
      initial: 'nap',
      senses: [],
      routine: [{ node: 'nowhere', dwell: 1 }],
      transitions: [
        {
          from: 'ghost',
          to: 'patrol',
          when: [{ sees: true as const }],
          priority: 1,
          do: [{ call: 'teleport' }],
        },
      ],
    }
    const errors = messages(sceneOf(bad), { hooks: ['shriek'], nodes: NODES })
    for (const pattern of [
      /initial mode nap/,
      /from unknown mode ghost/,
      /needs a sight sense/,
      /hook teleport, which it does not declare/,
      /unknown node nowhere/,
    ])
      expect(errors, String(pattern)).toEqual(expect.arrayContaining([expect.stringMatching(pattern)]))
    expect(messages(sceneOf(watchman()), { hooks: [], nodes: NODES })).toEqual([
      'agent watchman: hook shriek is not implemented',
    ])
  })
})

describe("the original's pursuit validation cases", () => {
  const chaser = () => ({
    id: 'chaser',
    modes: ['patrol', 'hunt', 'follow', 'ambush'],
    initial: 'patrol',
    speed: { patrol: 1, hunt: 2, follow: 2, ambush: 0 },
    senses: [{ sight: { range: 6 } }, { touch: { radius: 0.5 } }],
    transitions: [{ from: 'patrol', to: 'hunt', when: [{ sees: true as const }], priority: 1 }],
  })
  const ambush = (id: string, agent: string, mode: string, sting: number) => ({
    ambush: { id, agent, mode, at: 'closet', sting, grace: 2, then: 'hunt' },
  })

  it('a valid pursuit definition has no errors', () => {
    const def = sceneOf(chaser(), {
      rules: [{ id: 'a', text: '', when: [], then: [ambush('x', 'chaser', 'ambush', 0.6)] }],
    })
    expect(messages(def, { hooks: [], nodes: NODES })).toEqual([])
  })

  it('reports unknown modes and agents, bad timings, and a follow in a world rule', () => {
    const agent = chaser()
    agent.transitions.push({
      from: 'hunt',
      to: 'follow',
      when: [{ crossed: true }] as never,
      priority: 1,
      do: [{ followThrough: { portal: 'hall', delay: 2, then: 'chase' } }],
    } as never)
    const def = sceneOf(agent, {
      rules: [
        { id: 'a', text: '', when: [], then: [ambush('x', 'ghost', 'ambush', 0.6)] },
        { id: 'b', text: '', when: [], then: [ambush('y', 'chaser', 'lurk', -1)] },
        {
          id: 'c',
          text: '',
          when: [],
          then: [{ followThrough: { portal: 'crossed', delay: 2, then: 'hunt' } }],
        },
      ],
    })
    const errors = messages(def, { hooks: [], nodes: NODES })
    for (const e of [
      'rule a: ambush x names unknown agent ghost',
      'rule b: ambush y: no mode lurk on agent chaser',
      'rule b: ambush y: sting and grace must be ≥ 0',
      'rule c: followThrough needs an agent',
      'agent chaser: followThrough to unknown mode chase',
      "agent chaser: followThrough portal hall is not 'crossed' or from>to",
    ])
      expect(errors).toContain(e)
  })
})
