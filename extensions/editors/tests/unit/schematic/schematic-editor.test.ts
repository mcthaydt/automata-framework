// @vitest-environment jsdom
import { EDITOR_LIST_PATH, ensureListed } from '@automata/editor/editor-list'
import type { SuitePorts } from '@automata/editor/kit/ports'
import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { samplePorts } from '@automata/editor/suite'
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONTENT_SAMPLE_GAME } from '#src/app/suite/sample-game.ts'
import SchematicCanvas from '#src/features/schematic/SchematicCanvas.svelte'
import SchematicPanel from '#src/features/schematic/SchematicPanel.svelte'
import SchematicStatus from '#src/features/schematic/SchematicStatus.svelte'
import { createSchematic, homeFilesOf } from '#src/features/schematic/schematic-suite-editor.ts'

const HALL = CONTENT_SAMPLE_GAME['content/systems/hall.toml'] as string
const NAV = CONTENT_SAMPLE_GAME['content/nav/hall.toml'] as string
const LIST = CONTENT_SAMPLE_GAME[EDITOR_LIST_PATH] as string

async function open(files: Record<string, string>, given?: SuitePorts) {
  const { ports } = given
    ? { ports: given }
    : await createMemoryPorts({
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
  const listed = await ports.workspace.files('schematic')
  const session = await createSchematic().open(listed, ports)
  render(SchematicPanel, { props: { session } })
  render(SchematicCanvas, { props: { session } })
  render(SchematicStatus, { props: { session } })
  return { ports, session }
}

afterEach(() => {
  document.body.innerHTML = ''
})

// The words a page must never show: the file's key names.
const KEYS = [
  'sawHide',
  'warmthWithin',
  'followThrough',
  'setMode',
  'probe',
  'transition',
  'agent',
  // not 'routine': it is also a mode's name, which "How it decides" says the patrol runs in
  'tunables',
  'matrix',
  'priority',
  'hook',
  'self.',
  'pursuit.',
  'nav',
  'node',
]
function expectNoKeys(): void {
  const text = document.body.textContent ?? ''
  for (const key of KEYS) expect(text.toLowerCase(), key).not.toContain(key.toLowerCase())
}

describe('Home', () => {
  const file = (path: string) =>
    ({ path, editor: 'schematic', gates: [], checks: [], modes: ['edit'], writable: true }) as never
  it('shows one row for a scene, not one for each of its three files', () => {
    const rows = homeFilesOf([
      file('content/puzzles/hall.toml'),
      file('content/nav/hall.toml'),
      file('content/systems/hall.toml'),
      file('content/nav/yard.toml'),
    ])
    expect(rows.map((row) => row.path)).toEqual(['content/systems/hall.toml', 'content/nav/yard.toml'])
  })
})

describe('Schematic', () => {
  it('lists the scene’s characters by name', async () => {
    await open({ 'content/systems/hall.toml': HALL, 'content/nav/hall.toml': NAV })
    const list = screen.getByRole('navigation', { name: 'Characters' })
    expect(within(list).getByRole('button', { name: 'Guard' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('heading', { name: 'Guard' })).toBeInTheDocument()
    expectNoKeys()
  })

  it('offers a scene picker only when there is more than one scene', async () => {
    await open({
      'content/systems/hall.toml': HALL,
      'content/systems/yard.toml': HALL.replace('"hall"', '"yard"'),
    })
    expect(screen.getByRole('combobox', { name: 'Scene' })).toHaveValue('hall')
    expect(
      within(screen.getByRole('combobox', { name: 'Scene' }))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Hall', 'Yard'])
  })

  it('says a scene with no file has no characters, and adds the first one', async () => {
    const { ports } = await open({ [EDITOR_LIST_PATH]: LIST })
    expect(screen.getByRole('heading', { name: 'This scene has no characters yet.' })).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Add a character' })[0] as HTMLElement)
    await vi.waitFor(async () =>
      expect((await ports.workspace.read('content/systems/main.toml'))?.text).toContain('id = "character"'),
    )
    expect(await screen.findByRole('button', { name: 'Character' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('No problems.')
  })

  it('lets a new game add its places before any character, and says to do so first', async () => {
    const { session } = await open({ [EDITOR_LIST_PATH]: LIST })
    // The start page offers the places first: a character with no places has nowhere to walk.
    await userEvent.click(screen.getByRole('button', { name: 'Add the first place' }))
    expect(session.chosen.kind).toBe('places')
    expect(await screen.findByRole('region', { name: 'Places' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add a place' }))
    expect(Object.keys(session.places?.nodes ?? {})).toEqual(['new-place'])
    // A guard added now patrols the place the scene has.
    await session.addCharacter()
    expect(session.def?.agents[0]?.id).toBe('character')
  })

  it("adds Schematic's rows to the game's list on the first Add, with no TOML to copy", async () => {
    const bare =
      'format = "af-editors/1"\n[[file]]\nglob = "content/rooms/*.af2d.json"\neditor = "levels-2d"\nmodes = ["edit"]\nexports = "content"\ngates = []\nchecks = ["content"]\n'
    const base = await samplePorts({ [EDITOR_LIST_PATH]: bare })
    const ports: SuitePorts = { ...base, list: { ensure: (id) => ensureListed(base.workspace, id) } }
    const { session } = await open({}, ports)
    expect(document.body.textContent).not.toContain('content/systems/*.toml')
    for (const button of screen.getAllByRole('button', { name: 'Add a character' }))
      expect((button as HTMLButtonElement).disabled).toBe(false)
    expect((await session.addCharacter()).ok).toBe(true)
    const list = (await ports.workspace.read(EDITOR_LIST_PATH))?.text ?? ''
    for (const glob of ['content/systems/*.toml', 'content/nav/*.toml', 'content/puzzles/*.toml'])
      expect(list).toContain(glob)
    expect((await ports.workspace.files('schematic')).map((file) => file.path)).toEqual([
      'content/systems/main.toml',
    ])
  })

  it('says the game cannot play characters yet, and still lets a person make them', async () => {
    await open({ 'package.json': JSON.stringify({ dependencies: { '@automata/feel': '1.0.0' } }) })
    expect(screen.getAllByText("Your game can't move characters that think yet.").length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: 'How to add it' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Add a character' }).length).toBeGreaterThan(0)
  })

  it('says a file with a mistake is read only', async () => {
    await open({ 'content/systems/hall.toml': 'scene = "hall\nagents = [' })
    expect(screen.getByRole('heading', { name: /has a mistake on line/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add a character' })).toBeNull()
  })

  it('counts the problems, and says the game is still playing the last version that worked', async () => {
    const broken = HALL.replace('initial = "patrol"', 'initial = "chase"')
    await open({ 'content/systems/hall.toml': broken, 'content/nav/hall.toml': NAV })
    expect(screen.getByRole('status')).toHaveTextContent('1 problem in this scene.')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your game is still playing the last version that worked. Fix the problems to see this one.',
    )
  })

  it('finds no problem in the sample scene', async () => {
    const { session } = await open({ 'content/systems/hall.toml': HALL, 'content/nav/hall.toml': NAV })
    expect(session.problems).toEqual([])
  })

  it('keeps the places in step with the behaviour: a patrol stop at a place that is not there is a problem', async () => {
    const { session } = await open({
      'content/systems/hall.toml': HALL,
      'content/nav/hall.toml': NAV.replace('[nodes.window]', '[nodes.sill]'),
    })
    expect(session.problems.length).toBeGreaterThan(0)
  })
})

describe('Schematic’s Undo', () => {
  it('is on after a change to what a character sees, and puts the number back', async () => {
    const { session } = await open({ 'content/systems/hall.toml': HALL, 'content/nav/hall.toml': NAV })
    const undo = createSchematic().undo?.(session)
    expect(undo?.canUndo()).toBe(false)
    const sight = session.def?.agents[0]?.senses.find((sense) => 'sight' in sense)
    expect(sight).toBeDefined()
    await session.setItem(
      'Sees up to',
      'senses',
      0,
      session.def?.agents[0]?.senses.indexOf(sight as never) ?? 0,
      {
        sight: { range: 7 },
      },
    )
    expect(session.def?.agents[0]?.senses[0]).toMatchObject({ sight: { range: 7 } })
    expect(undo?.canUndo()).toBe(true)
    await undo?.undo()
    expect(session.def?.agents[0]?.senses[0]).toMatchObject({ sight: { range: 4.5 } })
    expect(undo?.canUndo()).toBe(false)
  })
})

describe('Undo after a change to the places', () => {
  it('moves the places file back, not the behaviour file', async () => {
    const { session } = await open({ 'content/systems/hall.toml': HALL, 'content/nav/hall.toml': NAV })
    const undo = createSchematic().undo?.(session)
    const [place] = Object.keys(session.places?.nodes ?? {})
    const at = session.places?.nodes[place as string]
    await session.setNumber('walk', 1).catch(() => undefined)
    expect((await session.movePlace(place as string, 'x', (at?.x ?? 0) + 3)).ok).toBe(true)
    expect(undo?.undoLabel()).toBe('Move a place')
    await undo?.undo()
    expect(session.places?.nodes[place as string]?.x).toBe(at?.x)
    expect(undo?.canUndo()).toBe(false)
  })
})

describe('renaming a place', () => {
  it('writes the places and the behaviour together, and one Undo puts both back', async () => {
    const { ports, session } = await open({ 'content/systems/hall.toml': HALL, 'content/nav/hall.toml': NAV })
    const writes: string[][] = []
    // The suite's own wrapper writes several files as one step; the stand-in records what is asked of it.
    const plain = ports.workspace
    ;(plain as { writeAll?: unknown }).writeAll = async (files: { path: string; text: string }[]) => {
      writes.push(files.map((file) => file.path))
      let last: { ok: true; mtime: number } | undefined
      for (const file of files) {
        const had = await plain.read(file.path)
        const result = await plain.write(
          file.path,
          file.text,
          had === undefined ? 'absent' : { mtime: had.mtime },
        )
        if (!result.ok) return result
        last = result
      }
      return last as { ok: true; mtime: number }
    }
    const undo = createSchematic().undo?.(session)
    const places = Object.keys(session.places?.nodes ?? {})
    const [from] = places
    expect(from).toBeDefined()
    expect((await session.renamePlace(from as string, 'corner')).ok).toBe(true)
    expect(writes).toEqual([['content/nav/hall.toml', 'content/systems/hall.toml']])
    expect(Object.keys(session.places?.nodes ?? {})).toContain('corner')
    expect(session.problems).toEqual([])
    expect(undo?.undoLabel()).toBe(`Rename ${from} to corner`)
    // The suite's Undo writes both files back, then asks the editor to move its histories: one call, both files.
    await plain.write('content/nav/hall.toml', NAV, {
      mtime: (await plain.read('content/nav/hall.toml'))?.mtime ?? 0,
    })
    await plain.write('content/systems/hall.toml', HALL, {
      mtime: (await plain.read('content/systems/hall.toml'))?.mtime ?? 0,
    })
    await undo?.undo()
    expect(Object.keys(session.places?.nodes ?? {})).toEqual(places)
    expect(session.problems).toEqual([])
    expect(session.files.nav.history.canUndo).toBe(false)
    expect(undo?.canRedo()).toBe(true)
  })
})
