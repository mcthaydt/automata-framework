// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { get, writable } from 'svelte/store'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StageRenderer } from '#src/features/studio/stage/stage-renderer.ts'
import { createStudioController, type StudioController } from '#src/features/studio/studio-controller.ts'
import StudioCanvas from '#src/features/studio/ui/StudioCanvas.svelte'
import StudioInspector from '#src/features/studio/ui/StudioInspector.svelte'
import StudioPanel from '#src/features/studio/ui/StudioPanel.svelte'
import StudioTimeline from '#src/features/studio/ui/StudioTimeline.svelte'
import { studioFixtureFiles, studioFixturePorts } from '#src/testing/studio/studio-fixtures.ts'

// The Studio's components in jsdom (EDS.9a to EDS.9c): the lists, the fields of each mode, the handles and the timeline,
// mounted over the fixture game with a stand-in stage (jsdom has no WebGL). What reaches the files is checked through
// the controller's session; the stage's own picture is the canvas test's.

afterEach(() => vi.unstubAllGlobals())

/** A `ResizeObserver` that reports one box at once, as a browser does when it starts observing. */
function measuredAt(width: number, height: number): void {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(
        private readonly report: (entries: { contentRect: { width: number; height: number } }[]) => void,
      ) {}
      observe(): void {
        this.report([{ contentRect: { width, height } }])
      }
      disconnect(): void {}
    },
  )
}

interface Standin extends StageRenderer {
  readonly calls: string[]
}
function standin(): Standin {
  const paused = writable(false)
  const calls: string[] = []
  return {
    calls,
    paused: { subscribe: paused.subscribe },
    show: () => void calls.push('show'),
    pose: () => void calls.push('pose'),
    face: () => void calls.push('face'),
    look: () => void calls.push('look'),
    resize: () => void calls.push('resize'),
    render: () => void calls.push('render'),
    destroy: () => void calls.push('destroy'),
  }
}

async function open(): Promise<StudioController> {
  return createStudioController(await studioFixturePorts())
}
const text = (controller: StudioController, path: string): string =>
  controller.session.history.state.texts[path] ?? ''

describe('StudioPanel', () => {
  it('lists the figures, poses and clips, chooses one, and flags a file with a problem', async () => {
    const controller = await open()
    render(StudioPanel, { controller })
    const poses = within(screen.getByRole('region', { name: 'Poses' }))
    expect(poses.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toContain('stand')
    await userEvent.click(poses.getByRole('button', { name: 'stand' }))
    expect(get(controller.view.state).pose).toBe('stand')
    expect(poses.getByRole('button', { name: 'stand' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('adds a clip from the chosen pose, and says why a bad id is refused', async () => {
    const controller = await open()
    render(StudioPanel, { controller })
    const clips = within(screen.getByRole('region', { name: 'Clips' }))
    await userEvent.click(clips.getByRole('button', { name: 'New clip' }))
    await userEvent.type(clips.getByLabelText('Clip id'), 'Bad Id')
    await userEvent.click(clips.getByRole('button', { name: 'Add' }))
    expect(controller.content().clips.map((entry) => entry.id)).not.toContain('bad id')
    await userEvent.clear(clips.getByLabelText('Clip id'))
    await userEvent.type(clips.getByLabelText('Clip id'), 'idle')
    await userEvent.click(clips.getByRole('button', { name: 'Add' }))
    expect(controller.content().clips.map((entry) => entry.id)).toContain('idle')
    expect(clips.getByRole('button', { name: 'idle' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('StudioInspector, Look', () => {
  it('shows the figure’s fields and writes a slider change as one step', async () => {
    const controller = await open()
    render(StudioInspector, { controller })
    expect(screen.getByRole('heading', { name: 'wick' })).toBeInTheDocument()
    const height = screen.getByRole('slider', { name: 'Height' })
    height.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(text(controller, 'content/figures/wick.toml')).toMatch(/height = 12[1-9]/)
    expect(controller.session.history.undoLabel).toBe('Set height of wick')
  })

  it('lists the face’s five groups folded, and writes a face slider into the face table', async () => {
    const controller = await open()
    render(StudioInspector, { controller })
    const groups = screen.getAllByRole('group', { hidden: true })
    expect(groups.length).toBeGreaterThan(0)
    const summary = screen.getByText('Structure')
    await userEvent.click(summary)
    const jaw = screen.getByRole('slider', { name: 'Jaw' })
    jaw.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(controller.content().figures[0]?.value?.sliders.face?.jaw).toBeGreaterThan(0.5)
  })

  it('dresses the stage in the outfit chosen and sets the hand', async () => {
    const controller = await open()
    render(StudioInspector, { controller })
    await userEvent.click(screen.getByRole('radio', { name: 'Left' }))
    expect(controller.content().figures[0]?.value?.hand).toBe('L')
  })
})

describe('StudioCanvas', () => {
  async function mounted(
    mode: 'look' | 'pose' | 'animate',
    pose = 'guard-high',
    extra: Record<string, string> = {},
  ) {
    measuredAt(800, 600)
    const controller = await createStudioController(
      await studioFixturePorts({ ...studioFixtureFiles(), ...extra }),
    )
    controller.view.setMode(mode)
    controller.view.select('pose', pose)
    const renderer = standin()
    render(StudioCanvas, {
      controller,
      stage: async () => renderer,
      frames: { request: () => 0, cancel: () => {} },
      background: 0,
    })
    await vi.waitFor(() => expect(renderer.calls).toContain('show'))
    return { controller, renderer }
  }

  it('draws the figure, the facing, the camera and the pose when the view changes', async () => {
    const { renderer, controller } = await mounted('look')
    expect(renderer.calls).toEqual(expect.arrayContaining(['show', 'face', 'look', 'pose']))
    expect(screen.getByTestId('studio-stage')).toHaveAttribute('data-status', 'ready')
    controller.view.setFacing(1)
    await vi.waitFor(() => expect(renderer.calls.filter((call) => call === 'face').length).toBeGreaterThan(1))
  })

  it('keeps its renderer when the page hands it the same stage again (the suite re-derives its props as editors open)', async () => {
    measuredAt(800, 600)
    const controller = await open()
    const renderer = standin()
    const made: number[] = []
    const factory = async () => {
      made.push(1)
      return renderer
    }
    const { rerender } = render(StudioCanvas, {
      controller,
      stage: factory,
      frames: { request: () => 0, cancel: () => {} },
      background: 0,
    })
    await vi.waitFor(() => expect(renderer.calls).toContain('show'))
    // A destroyed Pixi renderer loses its canvas's WebGL context for good, so a second renderer on the same canvas hangs.
    await rerender({ stage: async () => factory(), background: 0 })
    await new Promise((done) => setTimeout(done, 50))
    expect(made).toEqual([1])
    expect(renderer.calls).not.toContain('destroy')
  })

  it('says when there is no WebGL2 and offers Try again, with the fields untouched', async () => {
    measuredAt(800, 600)
    const controller = await open()
    const calls: number[] = []
    render(StudioCanvas, {
      controller,
      stage: async () => {
        calls.push(1)
        return undefined
      },
      frames: { request: () => 0, cancel: () => {} },
      background: 0,
    })
    await vi.waitFor(() => expect(screen.getByTestId('studio-stage-notice')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await vi.waitFor(() => expect(calls.length).toBe(2))
  })

  it('shows the handles in Pose and moves a focused one by 2 cm with the arrows, one step', async () => {
    const { controller } = await mounted('pose')
    const hand = await screen.findByRole('button', { name: /^handR handle/ })
    const before = controller.content().poses.find((entry) => entry.id === 'guard-high')?.value?.effectors
      .handR?.pos
    hand.focus()
    await userEvent.keyboard('{ArrowUp}')
    await vi.waitFor(() => expect(controller.session.history.undoLabel).toBe('Move handR of guard-high'))
    const after = controller.content().poses.find((entry) => entry.id === 'guard-high')?.value?.effectors
      .handR?.pos
    expect(after?.[1]).toBeCloseTo((before?.[1] ?? 0) + 0.02, 6)
  })

  it('keeps a chest-space target in the chest’s frame when an arrow moves its handle', async () => {
    const carry = `about = "Held in the chest's frame."\n\n[effectors.handR]\npos = [ -0.15, -0.23, 0.3 ]\nspace = "chest"\n`
    const path = 'content/figure-poses/carry.toml'
    const { controller } = await mounted('pose', 'carry', { [path]: carry })
    const hand = await screen.findByRole('button', { name: /^handR handle/ })
    hand.focus()
    await userEvent.keyboard('{ArrowUp}')
    await vi.waitFor(() => expect(controller.session.history.undoLabel).toBe('Move handR of carry'))
    const text = controller.session.history.state.texts[path] ?? ''
    // The file still says chest, and the value moved by the chest's own up, not the world's.
    expect(text).toContain('space = "chest"')
    const moved = controller.content().poses.find((entry) => entry.id === 'carry')?.value?.effectors.handR
    expect(moved?.space).toBe('chest')
    expect(moved?.pos?.[0]).toBeCloseTo(-0.15, 1)
    expect((moved?.pos?.[1] ?? 0) - -0.23).toBeGreaterThan(0.015)
    expect((moved?.pos?.[1] ?? 0) - -0.23).toBeLessThan(0.025)
  })

  it('has no handles in Look or Animate', async () => {
    await mounted('look')
    expect(screen.queryByRole('button', { name: /handle/ })).toBeNull()
  })
})

describe('StudioTimeline and the Animate fields', () => {
  it('adds a key at the playhead, chooses it, and sets its ease from the inspector', async () => {
    const controller = await open()
    controller.view.setMode('animate')
    controller.view.select('clip', 'roll')
    controller.view.select('pose', 'guard-high')
    render(StudioTimeline, { controller })
    render(StudioInspector, { controller })
    controller.view.setPlayhead(0.2)
    await userEvent.click(screen.getByRole('button', { name: 'Add key' }))
    const keys = () => controller.content().clips.find((entry) => entry.id === 'roll')?.value?.keys ?? []
    expect(keys().map((key) => key.t)).toEqual([0, 0.12, 0.2, 0.28, 0.4])
    expect(screen.getByRole('button', { name: /^Key 2 at 0.2 seconds, guard-high/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await userEvent.click(screen.getByRole('button', { name: /^Ease into this key/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'inOut' }))
    expect(keys()[2]?.ease).toBe('inOut')
  })

  it('says why a key cannot be added where one is', async () => {
    const controller = await open()
    controller.view.setMode('animate')
    controller.view.select('clip', 'roll')
    render(StudioTimeline, { controller })
    render(StudioInspector, { controller })
    controller.view.setPlayhead(0.12)
    await userEvent.click(screen.getByRole('button', { name: 'Add key' }))
    expect(screen.getByTestId('studio-refusal')).toHaveTextContent('there is already a key at 0.12 s')
  })

  it('plays and pauses', async () => {
    const controller = await open()
    controller.view.setMode('animate')
    render(StudioTimeline, { controller })
    await userEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(get(controller.view.state).playing).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(get(controller.view.state).playing).toBe(false)
  })
})
