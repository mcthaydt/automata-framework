// @vitest-environment jsdom
import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import cutscene from '#src/app/suite/sample/cutscene.toml?raw'
import lines from '#src/app/suite/sample/lines.toml?raw'
import SequenceCanvas from '#src/features/sequence/SequenceCanvas.svelte'
import SequencePanel from '#src/features/sequence/SequencePanel.svelte'
import SequenceStatus from '#src/features/sequence/SequenceStatus.svelte'
import type { Clock } from '#src/features/sequence/sequence-session.svelte.ts'
import { createSequence } from '#src/features/sequence/sequence-suite-editor.ts'

const PATH = 'content/cutscenes/opening.toml'

async function open(files: Record<string, string>) {
  const { ports } = await createMemoryPorts({
    files,
    classify: (path) => ({
      path,
      editor: 'sequence',
      gates: [],
      checks: [],
      modes: ['edit'],
      writable: true,
    }),
    changeSet: false,
  })
  const listed = await ports.workspace.files('sequence')
  const session = await createSequence().open(listed, ports)
  render(SequencePanel, { props: { session } })
  render(SequenceCanvas, { props: { session } })
  render(SequenceStatus, { props: { session } })
  return { ports, session }
}
type Opened = Awaited<ReturnType<typeof open>>
const text = async (ports: Opened['ports'], path = PATH) => (await ports.workspace.read(path))?.text ?? ''

afterEach(() => {
  document.body.innerHTML = ''
})

const GAME = { [PATH]: cutscene, 'content/lines/shop.toml': lines }

describe('Sequence cutscenes', () => {
  it('starts a game with no cutscenes by asking a name and a length', async () => {
    const { ports } = await open({})
    expect(screen.getByRole('heading', { name: 'This game has no cutscenes yet.' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('What is it called?'), 'Big Opening')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    const made = await waitFor(async () => {
      const found = await ports.workspace.read('content/cutscenes/big-opening.toml')
      expect(found).toBeDefined()
      return found?.text ?? ''
    })
    expect(made).toContain('duration = 10')
    expect(made).toContain('[[camera]]')
    expect(await screen.findByRole('button', { name: 'Big opening' })).toBeInTheDocument()
  })

  it('lists each cutscene by its name and opens one with a mistake read only', async () => {
    await open({ ...GAME, 'content/cutscenes/broken.toml': 'id = ' })
    expect(screen.getByRole('button', { name: 'Broken' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Opening' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Broken' }))
    expect(await screen.findByRole('heading', { name: /This cutscene has a mistake/ })).toBeInTheDocument()
    expect(screen.getAllByText(/read only/).length).toBeGreaterThan(0)
  })

  it('draws a row for each thing the scene moves, in words, with its steps as marks', async () => {
    await open(GAME)
    for (const name of ['Camera, 0 s', 'Camera, 5 s', 'Words on screen, 4.5 s to 7.5 s', 'Fade, 7 s'])
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    expect(screen.getByText('Shopkeeper')).toBeInTheDocument()
    expect(screen.getByText('No problems.')).toBeInTheDocument()
  })
})

describe('Sequence steps', () => {
  it('shows the fields of a chosen step in words and writes a change, with Undo', async () => {
    const { ports, session } = await open(GAME)
    await userEvent.click(screen.getByRole('button', { name: 'Fade, 7 s' }))
    const dark = screen.getByLabelText('How dark')
    await userEvent.clear(dark)
    await userEvent.type(dark, '0.5')
    await userEvent.tab()
    await waitFor(async () => expect(await text(ports)).toContain('value = 0.5'))
    expect(session.current?.toml.history.canUndo).toBe(true)
    expect(screen.queryByText('value')).not.toBeInTheDocument()
  })

  it('picks a caption’s line by its words', async () => {
    const { ports } = await open(GAME)
    await userEvent.click(screen.getByRole('button', { name: 'Words on screen, 4.5 s to 7.5 s' }))
    const which = screen.getByLabelText('Which line')
    await userEvent.selectOptions(which, "I'm just looking.")
    await waitFor(async () => expect(await text(ports)).toContain('line = "shop.just_looking"'))
  })

  it('names a caption whose line was removed in words, never its id', async () => {
    await open({ [PATH]: cutscene.replace('shop.welcome_in', 'shop.gone'), 'content/lines/shop.toml': lines })
    await userEvent.click(screen.getByRole('button', { name: 'Words on screen, 4.5 s to 7.5 s' }))
    expect(screen.getAllByText('This step’s words were removed.').length).toBeGreaterThan(0)
    expect(screen.queryByText('shop.gone')).not.toBeInTheDocument()
  })

  it('adds a step at the playhead, keeping the shot where it is', async () => {
    const { ports, session } = await open(GAME)
    session.seek(2)
    const camera = screen.getAllByRole('button', { name: 'Add here' })[0] as HTMLElement
    await userEvent.click(camera)
    await waitFor(async () => expect(await text(ports)).toMatch(/t = 2\n/))
    // The new key starts from the shot as the director has it at 2 s, not from the key before it.
    expect(await text(ports)).toMatch(/t = 2\npos = \[0\.\d+, 1\.6, 0\]/)
    expect(session.selection).toEqual({ track: 'camera', index: 1 })
  })

  it('drags a step along its row with a pointer: one write, one undo step', async () => {
    const { ports, session } = await open(GAME)
    const mark = screen.getByRole('button', { name: 'Camera, 5 s' })
    await fireEvent.pointerDown(mark, { clientX: 100, pointerId: 1 })
    await fireEvent.pointerMove(mark, { clientX: 100 + 2 * session.zoom, pointerId: 1 })
    await fireEvent.pointerUp(mark, { clientX: 100 + 2 * session.zoom, pointerId: 1 })
    await waitFor(async () => expect(await text(ports)).toMatch(/\[\[camera\]\]\nt = 7\n/))
    expect(session.current?.toml.history.undoLabel).toMatch(/Move a camera step/)
  })

  it('does not write when a drag ends where it started', async () => {
    const { ports, session } = await open(GAME)
    const before = await text(ports)
    const mark = screen.getByRole('button', { name: 'Camera, 5 s' })
    await fireEvent.pointerDown(mark, { clientX: 100, pointerId: 1 })
    await fireEvent.pointerMove(mark, { clientX: 100 + session.zoom, pointerId: 1 })
    await fireEvent.pointerMove(mark, { clientX: 100, pointerId: 1 })
    await fireEvent.pointerUp(mark, { clientX: 100, pointerId: 1 })
    expect(await text(ports)).toBe(before)
    expect(session.current?.toml.history.canUndo).toBe(false)
  })

  it('moves a selected step to the playhead', async () => {
    const { ports, session } = await open(GAME)
    await userEvent.click(screen.getByRole('button', { name: 'Fade, 7 s' }))
    session.seek(6)
    await userEvent.click(screen.getByRole('button', { name: 'Move to the playhead' }))
    await waitFor(async () => expect(await text(ports)).toMatch(/\[\[fade\]\]\nt = 6\n/))
  })
})

describe('Sequence length and playing', () => {
  it('asks before a shorter scene takes steps away, counting them', async () => {
    const { ports } = await open(GAME)
    const length = screen.getByLabelText('Length')
    await userEvent.clear(length)
    await userEvent.type(length, '4')
    await userEvent.tab()
    expect(await screen.findByText(/steps are after the new end\. Remove them\?/)).toBeInTheDocument()
    expect(await text(ports)).toContain('duration = 8')
    await userEvent.click(screen.getByRole('button', { name: 'Remove them' }))
    await waitFor(async () => expect(await text(ports)).toContain('duration = 4'))
    expect(await text(ports)).not.toContain('[[fade]]')
  })

  it('plays from the playhead with an injected clock and stops at the end', async () => {
    const { session } = await open(GAME)
    let now = 0
    let next: (() => void) | undefined
    const clock: Clock = {
      now: () => now,
      frame: (callback) => {
        next = callback
        return () => (next = undefined)
      },
    }
    session.play(clock)
    expect(session.playing).toBe(true)
    now = 2500
    next?.()
    expect(session.playhead).toBeCloseTo(2.5)
    now = 20000
    next?.()
    expect(session.playhead).toBe(8)
    expect(session.playing).toBe(false)
  })
})

describe('Sequence in a 2D and a 3D game', () => {
  it('shows a 3D-only row in a 2D game with a warning, and says why a 3D game has no walls', async () => {
    const withLamp = `${cutscene}\n[[light]]\nt = 1\nlamp = "porch"\nlevel = 0.5\n`
    const two = await open({ ...GAME, [PATH]: withLamp, 'content/levels/hall.toml': 'x = 1' })
    expect(within(document.body).getByText('Lights')).toBeInTheDocument()
    expect(two.session.is2d).toBe(false)
    expect(screen.getByText('Walls show for 2D levels only, for now.')).toBeInTheDocument()
  })
})
