// @vitest-environment jsdom
import { EDITOR_LIST_PATH } from '@automata/editor/editor-list'
import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { CONTENT_SAMPLE_GAME } from '#src/app/suite/sample-game.ts'
import SchematicInspector from '#src/features/schematic/SchematicInspector.svelte'
import { createSchematic } from '#src/features/schematic/schematic-suite-editor.ts'

const HALL = CONTENT_SAMPLE_GAME['content/systems/hall.toml'] as string
const NAV = CONTENT_SAMPLE_GAME['content/nav/hall.toml'] as string
const FORBIDDEN =
  /sawHide|warmthWithin|followThrough|setMode|probe|transition|priority|routine|tunables|matrix|\bnode\b/

async function open() {
  const { ports } = await createMemoryPorts({
    files: {
      [EDITOR_LIST_PATH]: CONTENT_SAMPLE_GAME[EDITOR_LIST_PATH] as string,
      'content/systems/hall.toml': HALL,
      'content/nav/hall.toml': NAV,
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
  render(SchematicInspector, { props: { session } })
  return { session }
}

const text = (session: Awaited<ReturnType<typeof open>>['session']) =>
  session.files.systems.history.state.text ?? ''

afterEach(() => {
  document.body.innerHTML = ''
})

describe('a mode', () => {
  it('renames in one undo step, and every place that names it follows', async () => {
    const { session } = await open()
    session.selected = { kind: 'mode', mode: 'hunt' }
    const name = await screen.findByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, 'chase{Enter}')
    expect(session.def?.agents[0]?.modes).toEqual(['patrol', 'chase', 'search'])
    expect(text(session)).not.toContain('"hunt"')
    expect(session.selected).toEqual({ kind: 'mode', mode: 'chase' })
    await session.files.systems.undo()
    expect(session.def?.agents[0]?.modes).toEqual(['patrol', 'hunt', 'search'])
  })

  it('keeps the patrol mode’s name, in words', async () => {
    const { session } = await open()
    session.selected = { kind: 'mode', mode: 'patrol' }
    expect(await screen.findByText('This mode walks the patrol, so it keeps its name.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Name')).toBeNull()
  })

  it('changes its speed in that one literal', async () => {
    const { session } = await open()
    session.selected = { kind: 'mode', mode: 'hunt' }
    const speed = await screen.findByLabelText('Moves at')
    const before = text(session)
    await userEvent.clear(speed)
    await userEvent.type(speed, '3{Enter}')
    expect(session.def?.agents[0]?.speed.hunt).toBe(3)
    // Only that literal moved (a float stays a float).
    expect(text(session).replace('hunt = 3.0', 'hunt = 2.2')).toBe(before)
  })

  it('adds a mode that stands still, and a switch out of it', async () => {
    const { session } = await open()
    session.selected = { kind: 'mode', mode: 'hunt' }
    await userEvent.click(await screen.findByRole('button', { name: 'Add a mode' }))
    expect(session.def?.agents[0]?.modes).toContain('mode-4')
    expect(session.def?.agents[0]?.speed['mode-4']).toBe(0)
    await userEvent.click(await screen.findByRole('button', { name: 'Add a switch out of it' }))
    const count = session.def?.agents[0]?.transitions.length ?? 0
    expect(session.selected).toEqual({ kind: 'switch', index: count - 1 })
    expect(session.problems).toEqual([])
  })
})

describe('a switch', () => {
  it('says the switch in words, with no key name on the page', async () => {
    const { session } = await open()
    session.selected = { kind: 'switch', index: 0 }
    await screen.findByRole('heading', { name: /Patrol to Hunt: sees the player/ })
    expect(document.body.textContent).not.toMatch(FORBIDDEN)
  })

  it('adds a condition from the menu and takes it out again, as two undo steps', async () => {
    const { session } = await open()
    session.selected = { kind: 'switch', index: 0 }
    const menu = await screen.findByLabelText('Add a condition')
    await userEvent.selectOptions(menu, 'is touching the player')
    expect(session.def?.agents[0]?.transitions[0]?.when).toHaveLength(2)
    expect(session.problems).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: /^Remove: .*touching/ }))
    expect(session.def?.agents[0]?.transitions[0]?.when).toHaveLength(1)
    await session.files.systems.undo()
    expect(session.def?.agents[0]?.transitions[0]?.when).toHaveLength(2)
  })

  it('turns a condition round with Not, and back', async () => {
    const { session } = await open()
    session.selected = { kind: 'switch', index: 0 }
    const not = await screen.findByRole('button', { name: /^Not: sees the player/ })
    await userEvent.click(not)
    expect(session.def?.agents[0]?.transitions[0]?.when[0]).toEqual({ not: { sees: true } })
    await userEvent.click(await screen.findByRole('button', { name: /^Not: / }))
    expect(session.def?.agents[0]?.transitions[0]?.when[0]).toEqual({ sees: true })
  })

  it('adds an action and the last one out takes the list with it', async () => {
    const { session } = await open()
    session.selected = { kind: 'switch', index: 0 }
    await userEvent.selectOptions(await screen.findByLabelText('Add an action'), 'make a noise')
    expect(session.def?.agents[0]?.transitions[0]?.do).toHaveLength(1)
    expect(session.problems).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: /^Remove: .*noise/ }))
    expect(session.def?.agents[0]?.transitions[0]?.do).toBeUndefined()
  })

  it('moves a switch earlier or later inside its own group', async () => {
    const { session } = await open()
    const order = () => session.def?.agents[0]?.transitions.map((t) => t.priority)
    session.selected = { kind: 'switch', index: 0 }
    const first = await screen.findByRole('button', { name: 'Check earlier' })
    expect(first).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Check later' }))
    // Another switch that was tied with it at 30 is now checked first; this one keeps 30 and no longer wins the tie.
    expect(order()?.[3]).toBeGreaterThan(order()?.[0] ?? 0)
  })

  it('removes the switch', async () => {
    const { session } = await open()
    const before = session.def?.agents[0]?.transitions.length ?? 0
    session.selected = { kind: 'switch', index: 0 }
    await userEvent.click(await screen.findByRole('button', { name: 'Remove this switch' }))
    expect(session.def?.agents[0]?.transitions).toHaveLength(before - 1)
    expect(session.selected).toBeUndefined()
  })

  it('writes a changed number in its own literal only', async () => {
    const { session } = await open()
    session.selected = { kind: 'switch', index: 4 }
    const field = await screen.findByLabelText('More than')
    const before = text(session)
    await userEvent.clear(field)
    await userEvent.type(field, '8{Enter}')
    expect(session.def?.agents[0]?.transitions[4]?.when).toEqual([
      { fact: 'self.idle', is: true },
      { timer: 8 },
    ])
    expect(text(session)).toBe(before.replace('timer = 5', 'timer = 8'))
  })
})
