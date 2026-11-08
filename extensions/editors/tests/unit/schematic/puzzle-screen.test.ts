// @vitest-environment jsdom
import { EDITOR_LIST_PATH } from '@automata/editor/editor-list'
import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import type { PuzzleDef } from '@automata/puzzle/sim'
import { render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { stringify } from 'smol-toml'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONTENT_SAMPLE_GAME } from '#src/app/suite/sample-game.ts'
import PuzzleCanvas from '#src/features/schematic/PuzzleCanvas.svelte'
import type { PuzzleAnswer } from '#src/features/schematic/puzzle/solve.ts'
import SchematicPanel from '#src/features/schematic/SchematicPanel.svelte'
import { createSchematic } from '#src/features/schematic/schematic-suite-editor.ts'

const puzzle: PuzzleDef = {
  scene: 'hall',
  facts: { power: false, fuel: 2 },
  items: ['crank', 'fuse'],
  hotspots: { shutter: { x: 0, z: 0 }, desk: { x: 3, z: 1 } },
  entry: [{ name: 'start', items: ['crank'] }],
  actions: [
    {
      id: 'crank-it',
      at: 'shutter',
      use: 'crank',
      when: [{ fact: 'fuel', atLeast: 1 }],
      then: [{ set: 'power', to: true }, { noise: { at: 'shutter', loudness: 8, kind: 'clang' } }],
      say: 'It whirs.',
    },
  ],
  systemic: [
    { id: 'porter', note: 'The porter opens it for you.', enables: [{ fact: 'power', is: true }], via: [] },
  ],
  lethal: [{ id: 'fall', rule: 'Stepping off the ledge kills you.', hintedBy: [] }],
  goal: [{ fact: 'power', is: true }],
  fallback: {},
}

async function open(options: { withPuzzle?: boolean; answer?: PuzzleAnswer } = {}) {
  const files: Record<string, string> = {
    [EDITOR_LIST_PATH]: CONTENT_SAMPLE_GAME[EDITOR_LIST_PATH] as string,
    'content/systems/hall.toml': CONTENT_SAMPLE_GAME['content/systems/hall.toml'] as string,
    'content/nav/hall.toml': CONTENT_SAMPLE_GAME['content/nav/hall.toml'] as string,
  }
  if (options.withPuzzle !== false)
    files['content/puzzles/hall.toml'] =
      `# The puzzle.\n${stringify(puzzle as unknown as Record<string, unknown>)}`
  const { ports } = await createMemoryPorts({
    files,
    classify: (path) => ({
      path,
      editor: 'schematic',
      gates: [],
      checks: [],
      modes: ['edit'],
      writable: true,
    }),
  })
  const session = await createSchematic().open(await ports.workspace.files('schematic'), ports)
  const checker = {
    ask: vi.fn(async () => options.answer ?? { finishable: true, words: 'Yes, in 1 step.' }),
    stop: vi.fn(),
  }
  session.chosen = { kind: 'puzzle' }
  return { session, checker }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('the puzzle in the panel', () => {
  it('is listed only when the scene has a puzzle file', async () => {
    const without = await open({ withPuzzle: false })
    render(SchematicPanel, { props: { session: without.session } })
    expect(screen.queryByRole('button', { name: 'Puzzle' })).toBeNull()
    document.body.innerHTML = ''
    const withOne = await open()
    render(SchematicPanel, { props: { session: withOne.session } })
    expect(screen.getByRole('button', { name: 'Puzzle' })).toBeInTheDocument()
  })
})

describe('the puzzle page', () => {
  it('shows the items, the facts and where they start, the actions as sentences, and the goal', async () => {
    const { session, checker } = await open()
    render(PuzzleCanvas, { props: { session, checker } })
    expect(await screen.findByText('crank')).toBeInTheDocument()
    expect(screen.getByLabelText('“power” starts as')).toHaveValue('no')
    expect(screen.getByLabelText('“fuel” starts as')).toHaveValue(2)
    expect(
      screen.getByText(
        /At the shutter, using the crank: when “fuel” is at least 1, set “power” to yes, make a clang noise at shutter, loudness 8/,
        {
          normalizer: (text) => text.replace(/\s+/g, ' ').trim(),
        },
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('“power” is yes')).toBeInTheDocument()
  })

  it('shows how the characters open the way, and what can kill the player, as sentences only', async () => {
    const { session, checker } = await open()
    render(PuzzleCanvas, { props: { session, checker } })
    expect(await screen.findByText('The porter opens it for you.')).toBeInTheDocument()
    expect(screen.getByText('Stepping off the ledge kills you.')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Rule/)).toBeNull()
  })

  it('changes where a fact starts in its own literal', async () => {
    const { session, checker } = await open()
    render(PuzzleCanvas, { props: { session, checker } })
    const before = session.files.puzzle?.history.state.text ?? ''
    const field = await screen.findByLabelText('“fuel” starts as')
    await userEvent.clear(field)
    await userEvent.type(field, '5{Enter}')
    expect(session.puzzleDef?.facts.fuel).toBe(5)
    expect((session.files.puzzle?.history.state.text ?? '').length).toBe(before.length)
  })

  it('adds an item, and will not take out one an action uses', async () => {
    const { session, checker } = await open()
    render(PuzzleCanvas, { props: { session, checker } })
    await userEvent.type(await screen.findByLabelText('New item'), 'torch')
    await userEvent.click(screen.getByRole('button', { name: 'Add an item' }))
    expect(session.puzzleDef?.items).toEqual(['crank', 'fuse', 'torch'])
    await userEvent.click(screen.getByRole('button', { name: 'Remove item: crank' }))
    expect(session.puzzleDef?.items).toEqual(['crank', 'fuse', 'torch'])
    expect(session.message).toMatch(/^“crank” is still used by the way in start, the action crank-it/)
    await userEvent.click(screen.getByRole('button', { name: 'Remove item: torch' }))
    expect(session.puzzleDef?.items).toEqual(['crank', 'fuse'])
  })

  it('gives an action another condition and takes an effect out, each as one undo step', async () => {
    const { session, checker } = await open()
    render(PuzzleCanvas, { props: { session, checker } })
    const menu = (await screen.findAllByLabelText('Add a condition'))[0] as HTMLSelectElement
    await userEvent.selectOptions(menu, 'has')
    expect(session.puzzleDef?.actions[0]?.when).toEqual([{ fact: 'fuel', atLeast: 1 }, { has: 'crank' }])
    await userEvent.click(screen.getByRole('button', { name: /^Remove: set “power” to yes/ }))
    expect(session.puzzleDef?.actions[0]?.then).toHaveLength(1)
    await session.files.puzzle?.undo()
    expect(session.puzzleDef?.actions[0]?.then).toHaveLength(2)
    await session.files.puzzle?.undo()
    expect(session.puzzleDef?.actions[0]?.when).toHaveLength(1)
  })

  it('adds an action and an item to the goal, and takes the action out again', async () => {
    const { session, checker } = await open()
    render(PuzzleCanvas, { props: { session, checker } })
    await userEvent.click(await screen.findByRole('button', { name: 'Add an action' }))
    expect(session.puzzleDef?.actions.map((a) => a.id)).toEqual(['crank-it', 'action-2'])
    await userEvent.click(screen.getByRole('button', { name: 'Remove action: action 2' }))
    expect(session.puzzleDef?.actions.map((a) => a.id)).toEqual(['crank-it'])
    const goal = screen.getByLabelText('Add to the goal') as HTMLSelectElement
    await userEvent.selectOptions(goal, 'has')
    expect(session.puzzleDef?.goal).toEqual([{ fact: 'power', is: true }, { has: 'crank' }])
  })

  it('asks the solver about the puzzle as it is, and greys the answer after a change', async () => {
    const { session, checker } = await open()
    render(PuzzleCanvas, { props: { session, checker } })
    await userEvent.click(await screen.findByRole('button', { name: 'Can it be finished?' }))
    expect(await screen.findByText('Yes, in 1 step.')).toBeInTheDocument()
    expect(checker.ask).toHaveBeenCalledWith(puzzle)
    expect(screen.queryByText('This is from before your last change. Ask again.')).toBeNull()
    const field = screen.getByLabelText('“fuel” starts as')
    await userEvent.clear(field)
    await userEvent.type(field, '3{Enter}')
    await waitFor(() =>
      expect(screen.getByText('This is from before your last change. Ask again.')).toBeInTheDocument(),
    )
  })

  it('stops the worker when the page goes', async () => {
    const { session, checker } = await open()
    const view = render(PuzzleCanvas, { props: { session, checker } })
    view.unmount()
    expect(checker.stop).toHaveBeenCalled()
  })

  it('shows no sentence with a key’s name in it', async () => {
    const { session, checker } = await open()
    const view = render(PuzzleCanvas, { props: { session, checker } })
    await screen.findByText('crank')
    const words = view.container.textContent ?? ''
    for (const banned of ['atLeast', 'hotspot', 'systemic', 'lethal', 'fallback'])
      expect(words, banned).not.toContain(banned)
    expect(within(view.container).getByRole('region', { name: 'Puzzle' })).toBeInTheDocument()
  })
})
