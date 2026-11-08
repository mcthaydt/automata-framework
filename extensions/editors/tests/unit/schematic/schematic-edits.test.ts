import { openDocument } from '@automata/editor/kit/documents'
import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { type AgentDef, checkSystems, type SystemsDef, systemsDefShape } from '@automata/systems/sim'
import { parse as strictParse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import {
  addModeEdits,
  diffEdits,
  newSwitch,
  renameAgentEdits,
  renameModeEdits,
  reorderEdits,
  withAction,
  withCondition,
  withNotToggled,
  withoutAction,
  withoutCondition,
} from '#src/features/schematic/schematic-edits.ts'
import { newAgent, newSystemsFile, systemsFileText } from '#src/features/schematic/starter.ts'
import { changeListText, changeSwitchText, type SwitchChange } from '#src/features/schematic/switch-text.ts'
import { openTomlSession } from '#src/shared/toml-session.ts'
import { fixture, fixtureText } from '../../fixtures/systems-fixtures.ts'

function scene(): SystemsDef {
  const guard: AgentDef = {
    ...newAgent('guard'),
    modes: ['patrol', 'hunt', 'search'],
    speed: { patrol: 1, hunt: 2, search: 1 },
    senses: [{ sight: { range: 5 } }, { sound: {} }],
    transitions: [
      {
        from: 'patrol',
        to: 'hunt',
        priority: 30,
        when: [{ sees: true }, { not: { mode: 'hunt' } }],
        do: [
          { setMode: 'hunt' },
          { setMode: 'alarm', agent: 'nurse' },
          { followThrough: { portal: 'crossed', delay: 1, then: 'hunt' } },
          {
            ambush: {
              id: 'a1',
              agent: 'guard',
              mode: 'hunt',
              at: 'player',
              sting: 1,
              grace: 1,
              then: 'hunt',
            },
          },
        ],
      },
      { from: 'hunt', to: 'search', priority: 20, when: [{ mode: 'alarm', agent: 'nurse' }] },
      { from: 'search', to: 'patrol', priority: 10, when: [{ heard: '*' }] },
      { from: '*', to: 'hunt', priority: 5, when: [] },
    ],
  }
  const nurse: AgentDef = {
    ...newAgent('nurse'),
    modes: ['patrol', 'alarm'],
    speed: { patrol: 1, alarm: 0 },
    senses: [{ sound: {} }],
    transitions: [
      {
        from: 'patrol',
        to: 'alarm',
        priority: 1,
        when: [{ mode: 'hunt', agent: 'guard' }],
        do: [{ setMode: 'hunt', agent: 'guard' }],
      },
    ],
  }
  const def = newSystemsFile('hall', guard)
  return {
    ...def,
    agents: [guard, nurse],
    rules: [
      {
        id: 'cover',
        text: 'Cover.',
        when: [{ mode: 'hunt', agent: 'guard' }],
        then: [
          { setMode: 'hunt', agent: 'guard' },
          {
            ambush: {
              id: 'a2',
              agent: 'guard',
              mode: 'hunt',
              at: 'player',
              sting: 1,
              grace: 1,
              then: 'hunt',
            },
          },
        ],
      },
    ],
    scenarios: [
      {
        id: 'careful',
        setup: { place: { guard: { x: 1, z: 2 } } },
        policy: 'cautious',
        expect: { condition: [{ mode: 'hunt', agent: 'guard' }], within: 20, probability: 0.9 },
        seeds: 3,
      },
    ],
  }
}

const apply = (def: SystemsDef, edits: ReturnType<typeof renameModeEdits>): SystemsDef => {
  if ('refused' in edits) throw new Error(edits.refused)
  const result = openDocument('hall.toml', systemsFileText(def)).edit(edits)
  if (!result.ok) throw new Error(result.message)
  return result.document.value() as SystemsDef
}

const problems = (def: SystemsDef): string[] => {
  const found: string[] = []
  checkSystems(def, { hooks: [] }, (_path, message) => found.push(message))
  return found
}

describe('renaming a mode', () => {
  it('changes every place that names it, and nothing that names another character’s mode', () => {
    const before = scene()
    expect(problems(before)).toEqual([])
    const after = apply(before, renameModeEdits(before, 0, 'hunt', 'chase'))
    expect(problems(after)).toEqual([])
    const guard = after.agents[0]
    expect(guard?.modes).toEqual(['patrol', 'chase', 'search'])
    expect(guard?.speed).toMatchObject({ chase: 2 })
    expect(guard?.speed).not.toHaveProperty('hunt')
    expect(guard?.transitions.map((t) => [t.from, t.to])).toEqual([
      ['patrol', 'chase'],
      ['chase', 'search'],
      ['search', 'patrol'],
      ['*', 'chase'],
    ])
    // Its own switches' conditions and actions, a follow and an ambush in them:
    const first = guard?.transitions[0]
    expect(first?.when[1]).toEqual({ not: { mode: 'chase' } })
    expect(first?.do?.[0]).toEqual({ setMode: 'chase' })
    expect(first?.do?.[2]).toMatchObject({ followThrough: { then: 'chase' } })
    expect(first?.do?.[3]).toMatchObject({ ambush: { mode: 'chase', then: 'chase' } })
    // Another character's switches that name it, a world rule, and a scenario:
    expect(after.agents[1]?.transitions[0]).toMatchObject({
      when: [{ mode: 'chase', agent: 'guard' }],
      do: [{ setMode: 'chase', agent: 'guard' }],
    })
    expect(after.rules[0]?.when).toEqual([{ mode: 'chase', agent: 'guard' }])
    expect(after.rules[0]?.then).toMatchObject([
      { setMode: 'chase', agent: 'guard' },
      { ambush: { mode: 'chase', then: 'chase' } },
    ])
    expect(after.scenarios[0]?.expect.condition).toEqual([{ mode: 'chase', agent: 'guard' }])
    // Another character's own mode of the same name is left alone.
    expect(after.agents[1]?.modes).toEqual(['patrol', 'alarm'])
    expect(JSON.stringify(after)).not.toContain('hunt')
  })

  it('does not touch another character’s mode that has the same name', () => {
    const before = scene()
    const nurse = before.agents[1] as AgentDef
    const withHunt = {
      ...before,
      agents: [
        before.agents[0] as AgentDef,
        { ...nurse, modes: ['patrol', 'alarm', 'hunt'], speed: { patrol: 1, alarm: 0, hunt: 2 } },
      ],
    }
    const after = apply(withHunt, renameModeEdits(withHunt, 0, 'hunt', 'chase'))
    expect(after.agents[1]?.modes).toContain('hunt')
    expect(after.agents[1]?.speed).toHaveProperty('hunt')
  })

  it('is one undo step', async () => {
    const before = scene()
    const { ports } = await createMemoryPorts({
      files: { 'content/systems/hall.toml': systemsFileText(before) },
      classify: (path) => ({
        path,
        editor: 'schematic',
        gates: [],
        checks: [],
        modes: ['edit'],
        writable: true,
      }),
      changeSet: false,
    })
    const session = await openTomlSession<SystemsDef>({
      path: 'content/systems/hall.toml',
      ports,
      schema: systemsDefShape,
      empty: '',
    })
    const edits = renameModeEdits(before, 0, 'hunt', 'chase')
    if ('refused' in edits) throw new Error(edits.refused)
    const original = session.history.state.text
    expect((await session.edit('Rename hunt to chase', edits)).ok).toBe(true)
    expect(session.history.state.text).not.toBe(original)
    await session.undo()
    expect(session.history.state.text).toBe(original)
    expect(session.history.canUndo).toBe(false)
  })

  it('refuses the patrol mode, which walks the patrol', () => {
    const before = scene()
    expect(renameModeEdits(before, 0, 'patrol', 'walk')).toEqual({
      refused: 'This mode walks the patrol, so it keeps its name. Add a new mode instead.',
    })
  })

  it('refuses an empty name and a name the character already has', () => {
    const before = scene()
    expect(renameModeEdits(before, 0, 'hunt', ' ')).toHaveProperty('refused')
    expect(renameModeEdits(before, 0, 'hunt', 'search')).toHaveProperty('refused')
  })
})

describe('renaming a character', () => {
  it('changes its name and every place another part of the file names it', () => {
    const before = scene()
    const after = apply(before, renameAgentEdits(before, 'guard', 'warden'))
    expect(problems(after)).toEqual([])
    expect(after.agents.map((a) => a.id)).toEqual(['warden', 'nurse'])
    expect(after.agents[1]?.transitions[0]).toMatchObject({
      when: [{ mode: 'hunt', agent: 'warden' }],
      do: [{ setMode: 'hunt', agent: 'warden' }],
    })
    expect(after.agents[0]?.transitions[0]?.do?.[3]).toMatchObject({ ambush: { agent: 'warden' } })
    expect(after.rules[0]?.when).toEqual([{ mode: 'hunt', agent: 'warden' }])
    expect(after.rules[0]?.then[1]).toMatchObject({ ambush: { agent: 'warden' } })
    expect(after.scenarios[0]?.setup.place).toEqual({ warden: { x: 1, z: 2 } })
    expect(after.scenarios[0]?.expect.condition).toEqual([{ mode: 'hunt', agent: 'warden' }])
    expect(JSON.stringify(after)).not.toContain('guard')
  })

  it('refuses a name another character has', () => {
    expect(renameAgentEdits(scene(), 'guard', 'nurse')).toHaveProperty('refused')
  })
})

describe('order', () => {
  const agentOf = (def: SystemsDef) => def.agents[0] as SystemsDef['agents'][0]

  it('moves a switch inside its own group and writes descending tens', () => {
    const def = scene()
    const guard = agentOf(def)
    // "All the time" holds switches 0, 1 and 3 (2 hears). Move the last to the top.
    const after = apply(def, reorderEdits(guard, 0, 3, 0))
    const priorities = agentOf(after).transitions.map((t) => t.priority)
    expect(priorities).toEqual([20, 10, 10, 30])
    // The hearing switch is not in the group, so it never moves.
    expect(agentOf(after).transitions[2]?.priority).toBe(10)
  })

  it('keeps the others in the order they were in', () => {
    const def = scene()
    const guard = agentOf(def)
    const after = apply(def, reorderEdits(guard, 0, 0, 2))
    const order = [0, 1, 3].sort(
      (a, b) =>
        (agentOf(after).transitions[b]?.priority ?? 0) - (agentOf(after).transitions[a]?.priority ?? 0) ||
        a - b,
    )
    expect(order).toEqual([1, 3, 0])
  })

  it('changes nothing when it is already there, and only the numbers that change', () => {
    const def = scene()
    expect(reorderEdits(agentOf(def), 0, 0, 0)).toEqual([])
    const edits = reorderEdits(agentOf(def), 0, 1, 0)
    expect(edits.every((edit) => 'set' in edit)).toBe(true)
    expect(edits).toHaveLength(3)
  })
})

describe('adding and removing', () => {
  it('writes a new mode with speed 0, and the file still passes the checks', () => {
    const def = scene()
    const after = apply(def, addModeEdits(0, 'wait'))
    expect(after.agents[0]?.modes).toContain('wait')
    expect(after.agents[0]?.speed.wait).toBe(0)
    expect(problems(after)).toEqual([])
  })
})

/** Applies a structural change to a switch as the editor does: the switch's own tables, as text. */
const change = (def: SystemsDef, c: SwitchChange): SystemsDef => {
  const result = changeSwitchText('hall.toml', systemsFileText(def), c)
  if ('refused' in result) throw new Error(result.refused)
  return openDocument('hall.toml', result.text).value() as SystemsDef
}

describe('changing a switch’s conditions and actions', () => {
  const second = (def: SystemsDef) =>
    def.agents[0]?.transitions[1] as NonNullable<SystemsDef['agents'][0]['transitions'][1]>

  it('turns a condition round with "not", and back', () => {
    const def = scene()
    const first = def.agents[0]?.transitions[0]
    if (first === undefined) throw new Error('fixture')
    const turned = change(def, { kind: 'replace', agent: 0, index: 0, next: withNotToggled(first, 0) })
    expect(turned.agents[0]?.transitions[0]?.when[0]).toEqual({ not: { sees: true } })
    const turnedFirst = turned.agents[0]?.transitions[0]
    if (turnedFirst === undefined) throw new Error('fixture')
    const back = change(turned, { kind: 'replace', agent: 0, index: 0, next: withNotToggled(turnedFirst, 0) })
    expect(back.agents[0]?.transitions[0]?.when[0]).toEqual({ sees: true })
  })

  it('leaves an empty list when the last condition goes: it means always', () => {
    const def = scene()
    const after = change(def, { kind: 'replace', agent: 0, index: 1, next: withoutCondition(second(def), 0) })
    expect(after.agents[0]?.transitions[1]?.when).toEqual([])
    expect(problems(after)).toEqual([])
  })

  it('adds a condition and an action, making the action list when there is none', () => {
    const def = scene()
    const next = withAction(withCondition(second(def), { sees: true }), { goTo: 'player' })
    const after = change(def, { kind: 'replace', agent: 0, index: 1, next })
    expect(after.agents[0]?.transitions[1]?.when).toHaveLength(2)
    expect(after.agents[0]?.transitions[1]?.do).toEqual([{ goTo: 'player' }])
    expect(problems(after)).toEqual([])
    // The last action out takes the list with it.
    const gone = change(after, { kind: 'replace', agent: 0, index: 1, next: withoutAction(next, 0) })
    expect(gone.agents[0]?.transitions[1]).not.toHaveProperty('do')
  })

  it('adds a switch after the character’s last, and takes one out, leaving the others', () => {
    const def = scene()
    const added = change(def, { kind: 'add', agent: 0, next: newSwitch('patrol', 'search') })
    expect(added.agents[0]?.transitions).toHaveLength(5)
    expect(added.agents[0]?.transitions[4]).toMatchObject({ from: 'patrol', to: 'search', when: [] })
    expect(added.agents[1]).toEqual(def.agents[1])
    const removed = change(added, { kind: 'remove', agent: 0, index: 1 })
    expect(removed.agents[0]?.transitions.map((t) => t.from)).toEqual(['patrol', 'search', '*', 'patrol'])
  })

  it('adds the first switch of a character that has none, in the right character', () => {
    const def = scene()
    const bare = { ...def, agents: [def.agents[0] as AgentOf, { ...newAgent('nurse'), transitions: [] }] }
    const added = change(bare, { kind: 'add', agent: 1, next: newSwitch('patrol', 'patrol') })
    expect(added.agents[1]?.transitions).toHaveLength(1)
    expect(added.agents[0]?.transitions).toHaveLength(4)
  })

  it('refuses a switch that is not there, and writes nothing', () => {
    const def = scene()
    const result = changeSwitchText('hall.toml', systemsFileText(def), { kind: 'remove', agent: 0, index: 9 })
    expect(result).toEqual({ refused: expect.stringContaining('could not be found') })
  })
})

type AgentOf = SystemsDef['agents'][0]

describe('a value edit rewrites only its literal', () => {
  it('diffs a changed number into one value edit, a new key into an insert and a dropped one into a remove', () => {
    expect(diffEdits(['a'], { reach: 6, heard: 'x' }, { reach: 9, heard: 'x' })).toEqual([
      { keyPath: ['a', 'reach'], expected: 6, set: 9 },
    ])
    expect(diffEdits(['a'], { heard: 'x' }, { heard: 'x', reach: 9 })).toEqual([
      { keyPath: ['a', 'reach'], insert: 9 },
    ])
    expect(diffEdits(['a'], { heard: 'x', reach: 9 }, { heard: 'x' })).toEqual([
      { keyPath: ['a', 'reach'], remove: true },
    ])
    expect(diffEdits(['a'], { x: 1 }, { x: 1 })).toEqual([])
  })

  it('on the largest converted scene, changing one switch’s number changes only that literal', () => {
    const text = fixtureText('bay')
    const def = fixture('bay')
    const index = def.agents
      .map((a) => a.transitions.length)
      .indexOf(Math.max(...def.agents.map((a) => a.transitions.length)))
    const t = def.agents[index]?.transitions[10]
    if (t === undefined) throw new Error('bay has no tenth switch')
    const result = openDocument('bay.toml', text).edit(
      diffEdits(['agents', index, 'transitions', 10], t, { ...t, priority: t.priority + 1 }),
    )
    if (!result.ok) throw new Error(result.message)
    const after = result.document.text
    expect(after.length).toBe(text.length + (String(t.priority + 1).length - String(t.priority).length))
    let at = 0
    while (at < text.length && text[at] === after[at]) at += 1
    let from = text.length
    let to = after.length
    while (from > at && text[from - 1] === after[to - 1]) {
      from -= 1
      to -= 1
    }
    expect(String(t.priority)).toContain(text.slice(at, from))
    expect(after.slice(0, at) + String(t.priority + 1).slice(0)).toContain(after.slice(0, at))
  })

  it('on the largest converted scene, adding then removing a condition leaves every byte outside that switch alone', () => {
    const text = fixtureText('bay')
    const def = fixture('bay')
    const index = def.agents
      .map((a) => a.transitions.length)
      .indexOf(Math.max(...def.agents.map((a) => a.transitions.length)))
    const t = def.agents[index]?.transitions[10]
    if (t === undefined) throw new Error('bay has no tenth switch')
    const added = changeSwitchText('bay.toml', text, {
      kind: 'replace',
      agent: index,
      index: 10,
      next: withCondition(t, { touching: true }),
    })
    if ('refused' in added) throw new Error(added.refused)
    const addedSwitch = openDocument('bay.toml', added.text).value() as SystemsDef
    expect(addedSwitch.agents[index]?.transitions[10]?.when).toHaveLength(t.when.length + 1)
    const removed = changeSwitchText('bay.toml', added.text, {
      kind: 'replace',
      agent: index,
      index: 10,
      next: withoutCondition(addedSwitch.agents[index]?.transitions[10] ?? t, t.when.length),
    })
    if ('refused' in removed) throw new Error(removed.refused)
    expect(openDocument('bay.toml', removed.text).value()).toEqual(def)
    // Outside the switch's own tables the bytes are the file's: the lines before its heading and after its last table.
    for (const after of [added.text, removed.text]) {
      const lines = text.split('\n')
      const now = after.split('\n')
      let head = 0
      while (head < lines.length && lines[head] === now[head]) head += 1
      let tail = 0
      while (tail < lines.length - head && lines[lines.length - 1 - tail] === now[now.length - 1 - tail])
        tail += 1
      const changed = lines.slice(head, lines.length - tail)
      // What differs sits inside one switch: it opens no heading of anything but that switch's tables.
      expect(
        changed
          .filter((line) => /^\[\[?/.test(line))
          .every((line) => line.startsWith('[[agents.transitions')),
      ).toBe(true)
      expect(changed.filter((line) => line === '[[agents.transitions]]').length).toBeLessThanOrEqual(1)
    }
  })
})

describe('the first and the last item of a list, as the game reads the file', () => {
  const blank = () => systemsFileText(newSystemsFile('hall', newAgent('g')))

  it('does not leave `senses = []` beside `[[agents.senses]]` (the game’s reader refuses a key twice)', () => {
    const added = changeListText('hall.toml', blank(), {
      kind: 'add',
      list: 'senses',
      agent: 0,
      next: { sight: { range: 5 } },
    })
    if ('refused' in added) throw new Error(added.refused)
    expect(() => strictParse(added.text)).not.toThrow()
    expect((strictParse(added.text) as { agents: { senses: unknown[] }[] }).agents[0]?.senses).toEqual([
      { sight: { range: 5 } },
    ])
    const removed = changeListText('hall.toml', added.text, {
      kind: 'remove',
      list: 'senses',
      agent: 0,
      index: 0,
    })
    if ('refused' in removed) throw new Error(removed.refused)
    expect((strictParse(removed.text) as { agents: { senses: unknown[] }[] }).agents[0]?.senses).toEqual([])
  })

  it('writes a first switch and a first stop the same way, and a patrol may go away altogether', () => {
    const stop = changeListText('hall.toml', blank(), {
      kind: 'add',
      list: 'routine',
      agent: 0,
      next: { node: 'door', dwell: 2 },
    })
    if ('refused' in stop) throw new Error(stop.refused)
    const first = changeListText('hall.toml', stop.text, {
      kind: 'add',
      list: 'transitions',
      agent: 0,
      next: newSwitch('patrol', 'patrol'),
    })
    if ('refused' in first) throw new Error(first.refused)
    expect(() => strictParse(first.text)).not.toThrow()
    const back = changeListText('hall.toml', first.text, {
      kind: 'remove',
      list: 'routine',
      agent: 0,
      index: 0,
    })
    if ('refused' in back) throw new Error(back.refused)
    expect((strictParse(back.text) as { agents: Record<string, unknown>[] }).agents[0]).not.toHaveProperty(
      'routine',
    )
    expect(systemsDefShape.safeParse(strictParse(back.text)).success).toBe(true)
  })
})
