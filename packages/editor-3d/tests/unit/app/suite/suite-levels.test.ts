// @vitest-environment jsdom
import { EDITOR_LIST_PATH } from '@automata/editor/editor-list'
import type { SuiteEditor } from '@automata/editor/kit/ports'
import { createSuite, type SuiteHandle, samplePorts, startSuite } from '@automata/editor/suite'
import { fixtureEditor } from '@automata/editor/suite/testing'
import { screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLevels3d } from '#src/features/levels-3d/levels-3d-suite-editor.ts'
import type { PlanRendererFactory } from '#src/features/levels-3d/plan/plan-renderer.ts'
import depot from '#src/testing/fixtures/depot.af-sector.json?raw'

// The 3D level editor mounted in the suite (editor suite spec §4.7, EDS-D12, §13 EDS-k): the suite's one shell holds its
// regions, and a switch to the Tuner and back keeps the sector selected and the level's own Undo. `depot.af-sector.json`
// is this package's authored sample (`src/testing/fixtures`), whose rooms are `hall` and `dock`. The 2D editor's twin of
// this test is in editor.

let started: SuiteHandle | undefined
afterEach(async () => {
  await started?.dispose()
  started = undefined
  document.body.innerHTML = ''
})

async function start(editors: SuiteEditor<unknown>[], files: Record<string, string>) {
  const target = document.body.appendChild(document.createElement('div'))
  started = await startSuite(target, {
    window,
    document,
    ports: await samplePorts(files),
    suite: createSuite({ editors }),
  })
}

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
modes = ["edit"]
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
    await waitFor(() => expect(screen.getByTestId('inspector')).toHaveTextContent(/hall/))
  }

  it('EDS-k: select a sector, switch to the Tuner and edit, switch back: the sector is still selected and Undo is the level’s', async () => {
    await start([fixtureEditor as SuiteEditor<unknown>, levels3d()], FILES_3D)
    await userEvent.click(await screen.findByRole('tab', { name: 'Levels 3D' }))
    expect(await screen.findByTestId('layers-panel')).toBeInTheDocument()
    await selectHall()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()

    await userEvent.click(screen.getByRole('tab', { name: 'Tuner' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Raise speed' }))
    expect(await screen.findByRole('button', { name: 'Undo Raise speed' })).toBeEnabled()

    await userEvent.click(screen.getByRole('tab', { name: 'Levels 3D' }))
    expect(await screen.findByTestId('inspector')).toHaveTextContent(/hall/)
    // The Tuner's step is not the level's to undo.
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
  })

  it('shows a file it cannot open as a state', async () => {
    await start([levels3d()], { ...FILES_3D, 'content/levels/depot.af-sector.json': '{ "format": ' })
    await userEvent.click(await screen.findByRole('tab', { name: 'Levels 3D' }))
    const refused = await screen.findByTestId('levels-3d-refused')
    expect(within(refused).getByText(/can’t be opened as a level/)).toBeInTheDocument()
  })
})
