// @vitest-environment jsdom
import { EDITOR_LIST_PATH } from '@automata/editor/editor-list'
import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { CONTENT_SAMPLE_GAME } from '#src/app/suite/sample-game.ts'
import PlacesCanvas from '#src/features/schematic/PlacesCanvas.svelte'
import { createSchematic } from '#src/features/schematic/schematic-suite-editor.ts'

async function open(nav = true) {
  const { ports } = await createMemoryPorts({
    files: {
      [EDITOR_LIST_PATH]: CONTENT_SAMPLE_GAME[EDITOR_LIST_PATH] as string,
      'content/systems/hall.toml': CONTENT_SAMPLE_GAME['content/systems/hall.toml'] as string,
      ...(nav ? { 'content/nav/hall.toml': CONTENT_SAMPLE_GAME['content/nav/hall.toml'] as string } : {}),
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
  session.chosen = { kind: 'places' }
  render(PlacesCanvas, { props: { session } })
  return session
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('the places screen', () => {
  it('reads each place as a sentence', async () => {
    await open()
    expect(await screen.findByText('desk: 5 across, 4 down. Walks to door, window')).toBeInTheDocument()
  })

  it('writes the places file on the first place of a new scene', async () => {
    const session = await open(false)
    expect(await screen.findByText(/Add the first place/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add a place' }))
    expect(Object.keys(session.places?.nodes ?? {})).toEqual(['new-place'])
    expect(session.files.nav.exists()).toBe(true)
  })

  it('renames a place, and the behaviour file follows the rename', async () => {
    const session = await open()
    await userEvent.click(await screen.findByRole('button', { name: /^desk: / }))
    const name = screen.getByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, 'counter{Enter}')
    expect(Object.keys(session.places?.nodes ?? {})).toContain('counter')
    expect(session.def?.agents[0]?.routine?.map((s) => s.node)).toContain('counter')
    expect(session.problems).toEqual([])
  })

  it('refuses to remove a place that a patrol uses, in words', async () => {
    const session = await open()
    await userEvent.click(await screen.findByRole('button', { name: /^desk: / }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove this place' }))
    expect(session.message).toContain('patrols to it')
    expect(Object.keys(session.places?.nodes ?? {})).toContain('desk')
  })
})
