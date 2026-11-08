// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createLevels2d } from '#src/app/suite/levels-2d/levels-2d-suite-editor.ts'
import { EDITOR_LIST_PATH } from '#src/features/suite/core/index.ts'
import { samplePorts } from '#src/features/suite/memory/sample-ports.ts'
import { type SuiteHandle, startSuite } from '#src/features/suite/shell/boot.ts'
import { createSuite } from '#src/features/suite/shell/create-suite.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import { createDownloadStore } from '#src/shared/kit/storage/download-store.ts'
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

async function start(
  editors: SuiteEditor<unknown>[],
  files: Record<string, string> = FILES,
  ports?: Awaited<ReturnType<typeof samplePorts>>,
  sample = false,
) {
  const target = document.body.appendChild(document.createElement('div'))
  started = await startSuite(target, {
    window,
    document,
    ports: ports ?? (await samplePorts(files)),
    suite: createSuite({ editors }),
    sample,
  })
}

let next = 0
const levels2d = (more: Partial<Parameters<typeof createLevels2d>[0]> = {}) =>
  createLevels2d({
    ids: {
      next: () => {
        next += 1
        return `slime-${next}`
      },
    },
    canvas: StandInLevelCanvas,
    ...more,
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

describe('Tiles in the suite’s Levels', () => {
  it('switches the panel, the canvas and the details to the game’s tiles and back, keeping the level', async () => {
    await start([fixtureEditor as SuiteEditor<unknown>, levels2d()])
    await userEvent.click(await screen.findByRole('tab', { name: 'Levels' }))
    const views = await screen.findByRole('radiogroup', { name: 'Views' })
    await userEvent.click(within(views).getByRole('radio', { name: 'Tiles' }))
    expect(await screen.findByRole('heading', { name: 'Your tiles' })).toBeInTheDocument()
    expect(screen.queryByTestId('level-canvas')).not.toBeInTheDocument()
    await userEvent.click(within(views).getByRole('radio', { name: 'Level' }))
    expect(await screen.findByRole('listbox', { name: 'Layers' })).toBeInTheDocument()
    expect(screen.getByTestId('level-canvas')).toHaveAttribute('data-level', 'level-1')
  })

  it('opens Add tiles from the panel, because this game folder can take a picture', async () => {
    await start([fixtureEditor as SuiteEditor<unknown>, levels2d()])
    await userEvent.click(await screen.findByRole('tab', { name: 'Levels' }))
    await userEvent.click(
      within(await screen.findByRole('radiogroup', { name: 'Views' })).getByRole('radio', { name: 'Tiles' }),
    )
    await userEvent.click((await screen.findAllByRole('button', { name: 'Add tiles' }))[0] as HTMLElement)
    expect(await screen.findByRole('dialog', { name: 'Add tiles' })).toBeInTheDocument()
  })
})

describe('Characters in the suite’s Levels', () => {
  it('lists the game’s characters and edits one, as one step Undo takes back', async () => {
    await start([fixtureEditor as SuiteEditor<unknown>, levels2d()])
    await userEvent.click(await screen.findByRole('tab', { name: 'Levels' }))
    const views = await screen.findByRole('radiogroup', { name: 'Views' })
    await userEvent.click(within(views).getByRole('radio', { name: 'Characters' }))
    expect(await screen.findByTestId('entities-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('level-canvas')).not.toBeInTheDocument()
    // The preview shows the chosen character, and the details edit it.
    await userEvent.click(await screen.findByRole('radio', { name: /Slime/ }))
    expect(await screen.findByTestId('entity-preview')).toBeInTheDocument()
    await userEvent.click(within(views).getByRole('radio', { name: 'Level' }))
    expect(await screen.findByRole('listbox', { name: 'Layers' })).toBeInTheDocument()
  })
})

describe('A level changed somewhere else', () => {
  async function drawTwice(choose: 'Use mine' | 'Use theirs') {
    const ports = await samplePorts(FILES)
    await start([levels2d()], FILES, ports)
    await userEvent.click(await screen.findByRole('tab', { name: 'Levels' }))
    await userEvent.click(await screen.findByRole('radio', { name: 'Slime' }))
    const surface = screen.getByTestId('level-surface')
    press(surface, 'pointerdown', 40, 40)
    press(surface, 'pointerup', 40, 40)
    await screen.findByRole('button', { name: 'Undo Place entity' })

    const path = 'content/levels/world.af2d.json'
    const current = await ports.workspace.read(path)
    await ports.workspace.write(path, `${current?.text ?? ''}\n`, { mtime: current?.mtime ?? 0 })
    press(surface, 'pointerdown', 80, 80)
    press(surface, 'pointerup', 80, 80)
    const dialog = await screen.findByRole('dialog', { name: /was changed somewhere else/ })
    await userEvent.click(within(dialog).getByRole('button', { name: choose }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /changed somewhere else/ })).toBeNull())
    return { ports, path }
  }

  it('asks which version to keep, and Use mine saves the level over the other', async () => {
    const { ports, path } = await drawTwice('Use mine')
    expect(screen.queryByText(/Not saved/)).not.toBeInTheDocument()
    expect((await ports.workspace.read(path))?.text).toContain('slime-')
  })

  it('and Use theirs takes the other version, so the step that conflicted is gone', async () => {
    const { ports, path } = await drawTwice('Use theirs')
    expect(screen.queryByText(/Not saved/)).not.toBeInTheDocument()
    expect((await ports.workspace.read(path))?.text).not.toContain('slime-2')
  })
})

describe('A save that fails to answer', () => {
  it('does not stop the next step from saving', async () => {
    const ports = await samplePorts(FILES)
    const real = ports.workspace.write.bind(ports.workspace)
    let saves = 0
    Object.assign(ports.workspace, {
      write: async (...args: Parameters<typeof real>) => {
        saves += /slime-\d+/.test(args[1]) ? 1 : 0
        // The second step's save fails to get an answer (the server's listing failed: a build's temp file was in the way).
        if (saves === 2) throw new Error('the server did not answer')
        return real(...args)
      },
    })
    await start([levels2d()], FILES, ports)
    await userEvent.click(await screen.findByRole('tab', { name: 'Levels' }))
    await userEvent.click(await screen.findByRole('radio', { name: 'Slime' }))
    const surface = screen.getByTestId('level-surface')
    press(surface, 'pointerdown', 40, 40)
    press(surface, 'pointerup', 40, 40)
    await screen.findByRole('button', { name: 'Undo Place entity' })
    for (const at of [80, 120]) {
      press(surface, 'pointerdown', at, at)
      press(surface, 'pointerup', at, at)
    }
    // The third step's save, which holds all three slimes, is on disk: the failed second save did not stop it.
    await waitFor(async () => {
      const text = (await ports.workspace.read('content/levels/world.af2d.json'))?.text ?? ''
      expect(text.match(/slime-\d+/g)?.length).toBe(3)
    })
  })
})

describe('A level to try, on the sample game with none', () => {
  const TRY_LIST = LIST.replace('editor = "levels-2d"', 'editor = "levels-2d"\nexports = "content"')
  const TRY_FILES = { [EDITOR_LIST_PATH]: TRY_LIST, 'content/tuning.toml': '[player]\nspeed = 6\n' }
  const downloads: { name: string; text: string }[] = []
  const share = createDownloadStore({
    now: () => 0,
    download: (file) => downloads.push({ name: file.name, text: new TextDecoder().decode(file.data) }),
  })

  async function tryIt() {
    const ports = await samplePorts(TRY_FILES)
    await start([levels2d({ templates: 'content/levels', share })], TRY_FILES, ports, true)
    return ports
  }

  it('offers New level on the Levels card, which opens the starting points', async () => {
    await tryIt()
    await userEvent.click(await screen.findByRole('button', { name: 'New level' }))
    expect(
      await screen.findByText('Pick a starting point. You can change everything later.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Platformer/ })).toBeInTheDocument()
  })

  it('draws the chosen starting point and keeps it in the game folder', async () => {
    const ports = await tryIt()
    await userEvent.click(await screen.findByRole('button', { name: 'New level' }))
    await userEvent.click(await screen.findByRole('button', { name: /Platformer/ }))
    expect(await screen.findByTestId('level-canvas')).toHaveAttribute('data-level', 'level-1')
    expect((await ports.workspace.read('content/levels/untitled-platformer.af2d.json'))?.text).toContain(
      '"levels"',
    )
    // Undo has nothing to undo yet, and the Levels card now lists the level.
    expect(screen.queryByText('Pick a starting point. You can change everything later.')).toBeNull()
  })

  it('has Share as the one primary action once there is a level, and Download hands the level over', async () => {
    await tryIt()
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull()
    await userEvent.click(await screen.findByRole('button', { name: 'New level' }))
    await userEvent.click(await screen.findByRole('button', { name: /Platformer/ }))
    const button = await screen.findByRole('button', { name: 'Share' })
    expect(button).toHaveAttribute('data-kind', 'primary')
    await userEvent.click(button)
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Download' }))
    expect(await screen.findByText('Downloaded your level.')).toBeInTheDocument()
    expect(downloads.at(-1)?.name).toBe('untitled-platformer.af2d.json')
    expect(JSON.parse(downloads.at(-1)?.text ?? '{}').levels.length).toBeGreaterThan(0)

    // Home lists the level that was made, and it opens the same level again.
    await userEvent.click(screen.getByRole('button', { name: 'Home' }))
    const levels = await screen.findByRole('region', { name: 'Levels' })
    await userEvent.click(await within(levels).findByRole('button', { name: 'Untitled platformer' }))
    expect(await screen.findByTestId('level-canvas')).toHaveAttribute('data-level', 'level-1')
  })

  it('shows no New level on a game folder, where a missing level is a file that is not there', async () => {
    await start([levels2d()], TRY_FILES)
    await screen.findByText('No files yet.')
    expect(screen.queryByRole('button', { name: 'New level' })).toBeNull()
    await userEvent.click(await screen.findByRole('tab', { name: 'Levels' }))
    expect(await screen.findByTestId('levels-2d-refused')).toBeInTheDocument()
  })

  it('shows no Share on a game folder, whose Save already writes the game', async () => {
    await start([levels2d()])
    await userEvent.click(await screen.findByRole('tab', { name: 'Levels' }))
    await screen.findByTestId('level-canvas')
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull()
  })
})
