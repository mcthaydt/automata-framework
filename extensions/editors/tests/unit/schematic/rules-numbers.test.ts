// @vitest-environment jsdom
import { EDITOR_LIST_PATH } from '@automata/editor/editor-list'
import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { CONTENT_SAMPLE_GAME } from '#src/app/suite/sample-game.ts'
import NumbersCanvas from '#src/features/schematic/NumbersCanvas.svelte'
import RulesCanvas from '#src/features/schematic/RulesCanvas.svelte'
import { createSchematic } from '#src/features/schematic/schematic-suite-editor.ts'
import { newAgent, newSystemsFile, systemsFileText } from '#src/features/schematic/starter.ts'

const def = {
  ...newSystemsFile('hall', { ...newAgent('guard'), modes: ['patrol'], speed: { patrol: 1 } }),
  tunables: { 'alarm-every': { value: 2, min: 1, max: 5, unit: 's', note: 'Between rings.' } },
  matrix: [{ row: 'light', col: 'figure', verb: 'repels', rule: 'R1' }],
  rules: [
    { id: 'R1', text: 'Light repels.', when: [], then: [] },
    {
      id: 'alarm',
      text: 'The alarm rings while the power is off.',
      every: 2,
      when: [{ fact: 'power', is: false }],
      then: [{ noise: { at: { x: 0, z: -6 }, loudness: 12, kind: 'alarm' } }],
    },
  ],
}

async function open(canvas: typeof RulesCanvas | typeof NumbersCanvas, kind: 'rules' | 'numbers') {
  const { ports } = await createMemoryPorts({
    files: {
      [EDITOR_LIST_PATH]: CONTENT_SAMPLE_GAME[EDITOR_LIST_PATH] as string,
      'content/systems/hall.toml': systemsFileText(def),
      'content/nav/hall.toml': CONTENT_SAMPLE_GAME['content/nav/hall.toml'] as string,
    },
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
  const session = await createSchematic().open(await ports.workspace.files('schematic'), ports)
  session.chosen = { kind }
  render(canvas, { props: { session } })
  return session
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('rules', () => {
  it('read "When … then …, every n s", and a rule with nothing in it as its text only', async () => {
    await open(RulesCanvas, 'rules')
    expect(await screen.findByText(/^Light repels\.$/)).toBeInTheDocument()
    expect(
      screen.getByText(
        /When “power” is no, then make an alarm noise at the point 0 across, -6 down, loudness 12, every 2 s/,
        {
          normalizer: (text) => text.replace(/\s+/g, ' ').trim(),
        },
      ),
    ).toBeInTheDocument()
  })

  it('changes what a rule is for, and how often, each in its own literal', async () => {
    const session = await open(RulesCanvas, 'rules')
    const before = session.files.systems.history.state.text ?? ''
    const every = await screen.findByLabelText('Every')
    await userEvent.clear(every)
    await userEvent.type(every, '3{Enter}')
    expect(session.def?.rules[1]?.every).toBe(3)
    expect(
      (session.files.systems.history.state.text ?? '').replace('every = 3.0', 'every = 2.0').length,
    ).toBe(before.length)
    const forWhat = screen.getAllByLabelText('What it is for')[0] as HTMLElement
    await userEvent.clear(forWhat)
    await userEvent.type(forWhat, 'Light pushes it away.{Enter}')
    expect(session.def?.rules[0]?.text).toBe('Light pushes it away.')
  })
})

describe('rules, added and taken apart', () => {
  it('adds a rule with nothing in it, as one undo step', async () => {
    const session = await open(RulesCanvas, 'rules')
    await userEvent.click(await screen.findByRole('button', { name: 'Add a rule' }))
    expect(session.def?.rules).toHaveLength(3)
    expect(session.def?.rules[2]).toEqual({ id: 'rule-3', text: 'A new rule.', when: [], then: [] })
    await session.files.systems.undo()
    expect(session.def?.rules).toHaveLength(2)
  })

  it('gives a rule a condition and an action from menus that leave out what needs a character', async () => {
    const session = await open(RulesCanvas, 'rules')
    const when = (await screen.findAllByLabelText('Add a condition'))[1] as HTMLSelectElement
    expect(within(when).queryByRole('option', { name: 'sees the player' })).toBeNull()
    expect(within(when).getByRole('option', { name: 'is touching the player' })).toBeInTheDocument()
    await userEvent.selectOptions(when, 'touching')
    expect(session.def?.rules[1]?.when).toHaveLength(2)
    const then = (await screen.findAllByLabelText('Add an action'))[1] as HTMLSelectElement
    expect(within(then).queryByRole('option', { name: 'go to a place' })).toBeNull()
    await userEvent.selectOptions(then, 'cutscene')
    expect(session.problems.filter((p) => p.keyPath[0] === 'rules')).toEqual([])
  })

  it('takes a condition out of a rule, and a rule out of the scene', async () => {
    const session = await open(RulesCanvas, 'rules')
    await userEvent.click(await screen.findByRole('button', { name: /^Remove: “power” is no/ }))
    expect(session.def?.rules[1]?.when).toEqual([])
    await userEvent.click(screen.getAllByRole('button', { name: 'Remove this rule' })[1] as HTMLElement)
    expect(session.def?.rules.map((r) => r.id)).toEqual(['R1'])
  })

  it('will not take out a rule the design table points to, and says which', async () => {
    const session = await open(RulesCanvas, 'rules')
    await userEvent.click(screen.getAllByRole('button', { name: 'Remove this rule' })[0] as HTMLElement)
    expect(session.def?.rules).toHaveLength(2)
    expect(session.message).toBe(
      '“Light repels.” is in the design notes (light repels figure), so it stays. Change what it says instead.',
    )
  })
})

describe('numbers', () => {
  it('show each number with its name in words, its range, its unit and its note', async () => {
    await open(NumbersCanvas, 'numbers')
    expect(await screen.findByLabelText('Alarm every')).toHaveValue(2)
    expect(screen.getByText('From 1 to 5 s. Between rings.')).toBeInTheDocument()
  })

  it('change a number inside its range, and refuse one outside it in words', async () => {
    const session = await open(NumbersCanvas, 'numbers')
    const field = await screen.findByLabelText('Alarm every')
    await userEvent.clear(field)
    await userEvent.type(field, '4{Enter}')
    expect(session.def?.tunables['alarm-every']?.value).toBe(4)
    await userEvent.clear(field)
    await userEvent.type(field, '9{Enter}')
    expect(await screen.findByText('The most is 5.')).toBeInTheDocument()
    expect(session.def?.tunables['alarm-every']?.value).toBe(4)
  })
})
