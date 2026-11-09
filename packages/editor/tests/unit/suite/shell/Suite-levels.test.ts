// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createLevels2d } from '#src/app/suite/levels-2d/levels-2d-suite-editor.ts'
import { EDITOR_LIST_PATH } from '#src/features/suite/core/index.ts'
import { type SuiteHandle, startSuite } from '#src/features/suite/shell/boot.ts'
import { createSuite } from '#src/features/suite/shell/create-suite.ts'
import { samplePorts } from '#src/features/suite/shell/sample-ports.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import { fixtureEditor } from '#src/testing/suite/fixture-editor.ts'
import platformer from '#src/testing/suite/fixtures/platformer.af2d.json?raw'
import StandInLevelCanvas from '#src/testing/suite/StandInLevelCanvas.svelte'

// The 2D level editor mounted in the suite: the suite's one shell holds its
// regions, and a switch to the Tuner and back keeps the level's selection and its own Undo. `platformer.af2d.json` is the
// platformer template as its canonical printer writes it (counter ids). The 3D editor's twin of this test is in
// editor-3d, which owns that editor.

const LIST = `format = "af-editors/1"
[[file]]
glob = "content/tuning.toml"
editor = "tuner"
modes = ["edit"]
gates = []
checks = []

[[file]]
glob = "content/levels/*.af2d.json"
editor = "levels-2d"
modes = ["edit"]
gates = []
checks = []
`

const FILES = {
  [EDITOR_LIST_PATH]: LIST,
  'content/tuning.toml': '[player]\nspeed = 6\n',
  'content/levels/world.af2d.json': platformer,
}

let started: SuiteHandle | undefined
afterEach(async () => {
  await started?.dispose()
  started = undefined
  document.body.innerHTML = ''
})

async function start(editors: SuiteEditor<unknown>[], files: Record<string, string> = FILES) {
  const target = document.body.appendChild(document.createElement('div'))
  started = await startSuite(target, {
    window,
    document,
    ports: await samplePorts(files),
    suite: createSuite({ editors }),
  })
}

let next = 0
const levels2d = () =>
  createLevels2d({
    ids: {
      next: () => {
        next += 1
        return `slime-${next}`
      },
    },
    canvas: StandInLevelCanvas,
  }) as SuiteEditor<unknown>

function press(target: HTMLElement, type: 'pointerdown' | 'pointerup', x: number, y: number): void {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 })
  Object.assign(event, { pointerId: 1, pointerType: 'mouse', pressure: type === 'pointerdown' ? 0.5 : 0 })
  target.dispatchEvent(event)
}

const selected = (): string | null => screen.getByTestId('level-canvas').getAttribute('data-selected')

describe('Levels 2D in the suite', () => {
  it('fills the suite’s one shell with the layers, the palette and the canvas', async () => {
    await start([fixtureEditor as SuiteEditor<unknown>, levels2d()])
    await userEvent.click(await screen.findByRole('tab', { name: 'Levels' }))
    expect(await screen.findByRole('listbox', { name: 'Layers' })).toBeInTheDocument()
    expect(screen.getByTestId('level-canvas')).toHaveAttribute('data-level', 'level-1')
    expect(screen.getAllByTestId('suite-shell')).toHaveLength(1)
    expect(screen.getByText('content/levels/world.af2d.json')).toBeInTheDocument()
  })

  it('EDS-k: a switch to the Tuner and back keeps the selection, and Undo undoes the level’s own step', async () => {
    await start([fixtureEditor as SuiteEditor<unknown>, levels2d()])
    await userEvent.click(await screen.findByRole('tab', { name: 'Levels' }))
    await userEvent.click(await screen.findByRole('radio', { name: 'Slime' }))
    const surface = screen.getByTestId('level-surface')
    press(surface, 'pointerdown', 40, 40)
    press(surface, 'pointerup', 40, 40)
    // The first edit asks for the change set's title, then writes.
    const dialog = await screen.findByRole('dialog', { name: 'Name this change' })
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Slimes')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Start' }))
    expect(await screen.findByRole('button', { name: 'Undo Place entity' })).toBeEnabled()
    const placed = selected()
    expect(placed).not.toBe('')

    await userEvent.click(screen.getByRole('tab', { name: 'Tuner' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Raise speed' }))
    expect(await screen.findByRole('button', { name: 'Undo Raise speed' })).toBeEnabled()

    await userEvent.click(screen.getByRole('tab', { name: 'Levels' }))
    expect(await screen.findByTestId('level-canvas')).toHaveAttribute('data-selected', placed)
    const undo = await screen.findByRole('button', { name: 'Undo Place entity' })
    await userEvent.click(undo)
    await waitFor(() => expect(selected()).toBe(''))
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeDisabled()
    // The Tuner's step is still its own to undo.
    await userEvent.click(screen.getByRole('tab', { name: 'Tuner' }))
    expect(await screen.findByRole('button', { name: 'Undo Raise speed' })).toBeEnabled()
    expect(screen.getByTestId('fixture-text')).toHaveTextContent('speed = 7')
  })

  it('shows a file it cannot open as a state, with the file unchanged', async () => {
    await start([levels2d()], { ...FILES, 'content/levels/world.af2d.json': '{ "format": "af2d", ' })
    await userEvent.click(await screen.findByRole('tab', { name: 'Levels' }))
    const refused = await screen.findByTestId('levels-2d-refused')
    expect(within(refused).getByText(/can’t be opened as a level project/)).toBeInTheDocument()
    expect(within(refused).getByText('Your file is unchanged.')).toBeInTheDocument()
  })
})
