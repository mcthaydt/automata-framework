// @vitest-environment jsdom
import { EDITOR_LIST_PATH } from '@automata/editor/editor-list'
import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import type { Sense } from '@automata/systems/sim'
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { CONTENT_SAMPLE_GAME } from '#src/app/suite/sample-game.ts'
import { startWords } from '#src/features/schematic/patrol.ts'
import SchematicInspector from '#src/features/schematic/SchematicInspector.svelte'
import { createSchematic } from '#src/features/schematic/schematic-suite-editor.ts'
import {
  freshSense,
  missingSenses,
  senseFields,
  senseWords,
  TWO_D_LINT,
  writeSense,
} from '#src/features/schematic/senses.ts'

const LIST = CONTENT_SAMPLE_GAME[EDITOR_LIST_PATH] as string
const HALL = CONTENT_SAMPLE_GAME['content/systems/hall.toml'] as string
const NAV = CONTENT_SAMPLE_GAME['content/nav/hall.toml'] as string

describe('the sentences', () => {
  it('say each sense in words', () => {
    // In the games a person makes (sectors, level-2d) a wall or a closed door blocks sight whatever `wallsOnly` says
    // (`sight-boxes.test.ts` in systems), so the sentence says that and offers no setting.
    expect(senseWords({ sight: { range: 4.5 } })).toBe(
      'Sees up to 4.5 m. Walls and closed doors block its view',
    )
    expect(senseWords({ sight: { range: 4.5, wallsOnly: true } })).toBe(
      'Sees up to 4.5 m. Walls and closed doors block its view',
    )
    expect(senseWords({ sight: { range: 4.5, wallsOnly: false } })).toBe(
      'Sees up to 4.5 m. Walls and closed doors block its view',
    )
    expect(senseWords({ sound: { reach: 8 } })).toBe('Hears up to 8 m')
    expect(senseWords({ sound: {} })).toBe('Hears from anywhere')
    expect(senseWords({ touch: { radius: 0.6 } })).toBe('Touches within 0.6 m')
    expect(senseWords({ light: { radius: 2 } })).toBe('Notices light within 2 m')
    expect(senseWords({ light: {} })).toBe('Notices light within 2 m')
    expect(senseWords({ warmth: { sources: { stove: 3 } } })).toBe('Feels stove within 3 m')
  })

  it('write a field back into its own sense', () => {
    expect(writeSense({ sight: { range: 4 } }, 'range', 6)).toEqual({ sight: { range: 6 } })
    // A setting the file already has stays when the range changes; the editor never writes or offers it.
    expect(writeSense({ sight: { range: 4, wallsOnly: false } }, 'range', 6)).toEqual({
      sight: { range: 6, wallsOnly: false },
    })
    expect(senseFields({ sight: { range: 4 } }).map((field) => field.key)).toEqual(['range'])
    expect(writeSense({ sound: {} }, 'limit', 'near')).toEqual({ sound: { reach: 10 } })
    expect(writeSense({ sound: { reach: 9 } }, 'limit', 'anywhere')).toEqual({ sound: {} })
    expect(writeSense({ warmth: { sources: { a: 1 } } }, 'radius:a', 4)).toEqual({
      warmth: { sources: { a: 4 } },
    })
    expect(writeSense({ warmth: { sources: { a: 1, b: 2 } } }, 'name:a', 'c')).toEqual({
      warmth: { sources: { c: 1, b: 2 } },
    })
    expect(senseFields({ warmth: { sources: { a: 1, b: 2 } } })).toHaveLength(4)
  })

  it('offer only the senses a character lacks, and each new one passes the checks', () => {
    const have: Sense[] = [{ sight: { range: 4 } }, { touch: { radius: 1 } }]
    expect(missingSenses(have).map((m) => m.kind)).toEqual(['sound', 'light', 'warmth'])
    for (const kind of ['sight', 'sound', 'touch', 'light', 'warmth'] as const)
      expect(Object.keys(freshSense(kind))).toEqual([kind])
  })

  it('say where a character starts', () => {
    expect(startWords({ id: 'a', modes: [], initial: '', speed: {}, senses: [], transitions: [] })).toBe(
      "the level's corner. Give it a patrol stop to start at.",
    )
    expect(
      startWords({
        id: 'a',
        modes: [],
        initial: '',
        speed: {},
        senses: [],
        transitions: [],
        routine: [{ node: 'front-desk', dwell: 1 }],
      }),
    ).toBe('its first patrol stop, front desk')
  })
})

async function open(options: { list?: string; nav?: string | undefined } = {}) {
  const { ports } = await createMemoryPorts({
    files: {
      [EDITOR_LIST_PATH]: options.list ?? LIST,
      'content/systems/hall.toml': HALL,
      ...(options.nav === undefined && 'nav' in options
        ? {}
        : { 'content/nav/hall.toml': options.nav ?? NAV }),
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
  return session
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('the character in the inspector', () => {
  it('shows where it starts, its senses and its patrol', async () => {
    await open()
    expect(await screen.findByText(/its first patrol stop, door/)).toBeInTheDocument()
    expect(screen.getByText('Sees up to 4.5 m. Walls and closed doors block its view')).toBeInTheDocument()
    expect(screen.getByText('Touches within 0.6 m')).toBeInTheDocument()
    expect(screen.getByText('Stop 1')).toBeInTheDocument()
    expect(screen.getByText('Stop 3')).toBeInTheDocument()
  })

  it('changes how far it sees in that one literal', async () => {
    const session = await open()
    const field = await screen.findByLabelText('Sees up to')
    const before = session.files.systems.history.state.text ?? ''
    await userEvent.clear(field)
    await userEvent.type(field, '6{Enter}')
    expect(session.def?.agents[0]?.senses[0]).toEqual({ sight: { range: 6 } })
    expect((session.files.systems.history.state.text ?? '').replace('range = 6.0', 'range = 4.5')).toBe(
      before,
    )
  })

  it('adds a sense and takes one away, each one undo step', async () => {
    const session = await open()
    await userEvent.selectOptions(await screen.findByLabelText('Add a sense'), 'sound')
    expect(session.def?.agents[0]?.senses.map((s) => Object.keys(s)[0])).toEqual(['sight', 'touch', 'sound'])
    expect(session.problems).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: 'Remove: Hears from anywhere' }))
    expect(session.def?.agents[0]?.senses).toHaveLength(2)
    await session.files.systems.undo()
    expect(session.def?.agents[0]?.senses).toHaveLength(3)
  })

  it('moves a stop earlier, as one undo step, and adds and removes a stop', async () => {
    const session = await open()
    const nodes = () => session.def?.agents[0]?.routine?.map((s) => s.node)
    await userEvent.click(await screen.findByRole('button', { name: 'Move stop 2 earlier' }))
    expect(nodes()).toEqual(['desk', 'door', 'window'])
    await session.files.systems.undo()
    expect(nodes()).toEqual(['door', 'desk', 'window'])
    await userEvent.click(screen.getByRole('button', { name: 'Add a stop' }))
    expect(nodes()).toHaveLength(4)
    await userEvent.click(screen.getByRole('button', { name: 'Remove stop 4' }))
    expect(nodes()).toEqual(['door', 'desk', 'window'])
    expect(session.problems).toEqual([])
  })

  it('shows the 2D words beside light and warmth when the game has only a 2D level editor', async () => {
    const list = `${LIST}\n[[file]]\nglob = "content/levels/*.toml"\neditor = "levels-2d"\nmodes = ["edit"]\ngates = []\nchecks = []\n`
    const session = await open({ list })
    expect(session.facts.twoD).toBe(true)
    await userEvent.selectOptions(await screen.findByLabelText('Add a sense'), 'light')
    expect(await screen.findByText(TWO_D_LINT)).toBeInTheDocument()
  })

  it('says a game with no places needs the first one', async () => {
    const session = await open({ nav: '# nothing\n' })
    expect(await screen.findByText('Characters need places to walk between.')).toBeInTheDocument()
    // The way there is one press away, not a sentence to remember.
    await userEvent.click(screen.getByRole('button', { name: 'Add the first place' }))
    expect(session.chosen.kind).toBe('places')
  })
})
