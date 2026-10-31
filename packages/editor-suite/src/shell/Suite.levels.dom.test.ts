import { createLevels2d } from '@mcthaydt/automata-editor-2d/suite'
import { createLevels3d, type PlanRendererFactory } from '@mcthaydt/automata-editor-3d/suite'
import type { SuiteEditor } from '@mcthaydt/automata-editor-kit/ports'
import { screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EDITOR_LIST_PATH } from '../core'
import { fixtureEditor } from '../testing/fixture-editor'
import depot from '../testing/fixtures/depot.af-sector.json?raw'
import platformer from '../testing/fixtures/platformer.af2d.json?raw'
import StandInLevelCanvas from '../testing/StandInLevelCanvas.svelte'
import { samplePorts } from '../testing/sample-ports'
import { type SuiteHandle, startSuite } from './boot'
import { createSuite } from './create-suite'

// The level editors mounted in the suite (plan EDS.2d steps 3 and 6; editor suite spec §4.7, EDS-D12, §13 EDS-k): the
// suite's one shell holds their regions, and a switch to the Tuner and back keeps the level's selection and its own
// Undo. `platformer.af2d.json` is editor-2d's platformer template as its canonical printer writes it (counter ids);
// `depot.af-sector.json` is a copy of editor-3d's authored sample (`src/testing/fixtures`), whose rooms are `hall` and
// `dock`.

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

const LIST_3D = `format = "af-editors/1"
[[file]]
glob = "content/tuning.toml"
editor = "tuner"
modes = ["edit"]
gates = []
checks = []

[[file]]
glob = "content/levels/*.af-sector.json"
editor = "levels-3d"
modes = ["edit", "ask"]
gates = []
checks = []
`

const FILES_3D = {
  [EDITOR_LIST_PATH]: LIST_3D,
  'content/tuning.toml': '[player]\nspeed = 6\n',
  'content/levels/depot.af-sector.json': depot,
}

describe('Levels 3D in the suite', () => {
  // Every observer in the page (the shell measures its foot too) hears the size, as a real one would.
  const observed: ((w: number, h: number) => void)[] = []
  const resize = (w: number, h: number): void => {
    for (const run of observed) run(w, h)
  }
  const draws: { fills: { sector: string; points: number[]; selected?: boolean }[] }[] = []
  const renderer: PlanRendererFactory = async () => ({
    paused: {
      subscribe: (run: (value: boolean) => void) => {
        run(false)
        return () => {}
      },
    },
    draw: (paint) => void draws.push(paint as never),
    resize: () => {},
    destroy: () => {},
  })

  beforeEach(() => {
    draws.length = 0
    observed.length = 0
    // jsdom has no ResizeObserver: this one reports the size the test gives.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly run: ResizeObserverCallback) {}
        observe(): void {
          observed.push((w, h) =>
            this.run(
              [{ contentRect: { width: w, height: h } } as ResizeObserverEntry],
              this as unknown as ResizeObserver,
            ),
          )
        }
        disconnect(): void {}
      },
    )
    Object.assign(HTMLElement.prototype, {
      setPointerCapture: () => undefined,
      releasePointerCapture: () => undefined,
      hasPointerCapture: () => false,
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  const levels3d = () =>
    createLevels3d({ now: () => 0, renderer, schedule: () => () => {} }) as SuiteEditor<unknown>

  function tap(x: number, y: number): void {
    const host = screen.getByTestId('plan-canvas')
    for (const type of ['pointerdown', 'pointerup'])
      host.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: 'mouse',
          clientX: x,
          clientY: y,
        }),
      )
  }

  async function selectHall(): Promise<void> {
    // The plan's observer may start after the shell's, so the size is reported until the plan has drawn.
    await waitFor(() => {
      resize(640, 480)
      expect(draws.length).toBeGreaterThan(0)
    })
    const hall = draws.at(-1)?.fills.find((fill) => fill.sector === 'hall')
    const [x0 = 0, y0 = 0, x1 = 0, , , y2 = 0] = hall?.points ?? []
    // jsdom puts every element at (0, 0), so client and element coordinates agree.
    tap((x0 + x1) / 2, (y0 + y2) / 2)
    await waitFor(() => expect(screen.getByTestId('levels-3d-selection')).toHaveTextContent(/hall/))
  }

  it('EDS-k: select a sector, switch to the Tuner and edit, switch back: the sector is still selected and Undo is the level’s', async () => {
    await start([fixtureEditor as SuiteEditor<unknown>, levels3d()], FILES_3D)
    await userEvent.click(await screen.findByRole('tab', { name: 'Levels' }))
    expect(await screen.findByTestId('layers-panel')).toBeInTheDocument()
    await selectHall()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()

    await userEvent.click(screen.getByRole('tab', { name: 'Tuner' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Raise speed' }))
    const dialog = await screen.findByRole('dialog', { name: 'Name this change' })
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Faster')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Start' }))
    expect(await screen.findByRole('button', { name: 'Undo Raise speed' })).toBeEnabled()

    await userEvent.click(screen.getByRole('tab', { name: 'Levels' }))
    expect(await screen.findByTestId('levels-3d-selection')).toHaveTextContent(/hall/)
    // The Tuner's step is not the level's to undo.
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
  })

  it('shows a file it cannot open as a state', async () => {
    await start([levels3d()], { ...FILES_3D, 'content/levels/depot.af-sector.json': '{ "format": ' })
    await userEvent.click(await screen.findByRole('tab', { name: 'Levels' }))
    const refused = await screen.findByTestId('levels-3d-refused')
    expect(within(refused).getByText(/can’t be opened as a level/)).toBeInTheDocument()
  })
})
