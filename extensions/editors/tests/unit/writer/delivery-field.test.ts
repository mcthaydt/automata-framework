// @vitest-environment jsdom
import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import dialogue from '#src/app/suite/sample/dialogue.toml?raw'
import lines from '#src/app/suite/sample/lines.toml?raw'
import WriterCanvas from '#src/features/writer/WriterCanvas.svelte'
import WriterPanel from '#src/features/writer/WriterPanel.svelte'
import { deliveryEdit, deliveryOf } from '#src/features/writer/writer-model.ts'
import { createWriter } from '#src/features/writer/writer-suite-editor.ts'

// How a line is said: Writer shows How, Pace and the pause after each sentence for a line, and an edit writes `delivery`
// into the lines file as one undo step.

const LINES = 'content/lines/shop.toml'
const DIALOGUE = 'content/dialogue/shop.toml'

describe('the delivery of a line, as edits', () => {
  it('reads a delivery as how, pace and a pause after each sentence', () => {
    expect(deliveryOf(undefined, 'One. Two. Three.')).toEqual({ how: '', pace: 1, pauses: [0, 0, 0] })
    expect(
      deliveryOf({ how: 'tired', pace: 0.8, beats: [{ after: 2, pause: 2 }] }, 'One. Two. Three.'),
    ).toEqual({ how: 'tired', pace: 0.8, pauses: [0, 2, 0] })
  })

  it('writes the whole delivery as one edit, leaving out what is plain', () => {
    expect(deliveryEdit(0, undefined, { how: 'tired', pace: 1, pauses: [0, 1] })).toEqual({
      keyPath: ['lines', 0, 'delivery'],
      insert: { how: 'tired', beats: [{ after: 2, pause: 1 }] },
    })
    expect(deliveryEdit(0, { pace: 2 }, { how: '', pace: 1.5, pauses: [0, 0] })).toEqual({
      keyPath: ['lines', 0, 'delivery'],
      expected: { pace: 2 },
      set: { pace: 1.5 },
    })
  })

  it('takes the key away when nothing is left, and writes nothing when nothing was there', () => {
    expect(deliveryEdit(3, { pace: 2 }, { how: '', pace: 1, pauses: [0] })).toEqual({
      keyPath: ['lines', 3, 'delivery'],
      remove: true,
    })
    expect(deliveryEdit(3, undefined, { how: '  ', pace: 1, pauses: [0, 0] })).toBeUndefined()
  })
})

async function open() {
  const { ports } = await createMemoryPorts({
    files: { [LINES]: lines, [DIALOGUE]: dialogue },
    classify: (path) => ({ path, editor: 'writer', gates: [], checks: [], modes: ['edit'], writable: true }),
  })
  const listed = await ports.workspace.files('writer')
  const session = await createWriter().open(listed, ports)
  render(WriterPanel, { props: { session } })
  render(WriterCanvas, { props: { session } })
  return { ports, session }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Writer’s How it is said', () => {
  it('shows How, Pace and the pause after each sentence but the last, for a line', async () => {
    await open()
    const first = screen.getByRole('article', { name: 'Line 1' })
    // Closed, a line's delivery has no controls on the page; the button opens them.
    expect(within(first).queryByLabelText('How fast')).toBeNull()
    await userEvent.click(within(first).getByRole('button', { name: 'How it is said' }))
    expect(within(first).getByLabelText('How it is said')).toHaveValue('')
    expect(within(first).getByLabelText('How fast')).toHaveValue(1)
    // "Welcome in. Mind the step." has two sentences, so one pause to choose, after the first.
    expect(within(first).getAllByLabelText(/^Pause after /)).toHaveLength(1)
    expect(within(first).getByLabelText('Pause after “Welcome in.”')).toHaveValue('0')
  })

  it('writes the direction into the lines file, as one undo step', async () => {
    const { ports, session } = await open()
    const first = screen.getByRole('article', { name: 'Line 1' })
    await userEvent.click(within(first).getByRole('button', { name: 'How it is said' }))
    await userEvent.type(within(first).getByLabelText('How it is said'), 'Warm, a little tired')
    await userEvent.tab()
    await vi.waitFor(async () =>
      expect((await ports.workspace.read(LINES))?.text).toContain('how = "Warm, a little tired"'),
    )
    const undo = session.trail.hook()
    expect(undo.undoLabel()).toBe('Change how it is said')
    undo.undo()
    await vi.waitFor(() => expect(session.files?.lines.content?.lines[0]?.delivery).toBeUndefined())
  })

  it('writes a pause after a sentence and a pace', async () => {
    const { ports } = await open()
    const first = screen.getByRole('article', { name: 'Line 1' })
    await userEvent.click(within(first).getByRole('button', { name: 'How it is said' }))
    await userEvent.selectOptions(within(first).getByLabelText('Pause after “Welcome in.”'), '2')
    await vi.waitFor(async () => expect((await ports.workspace.read(LINES))?.text).toContain('pause = 2'))
    const pace = within(first).getByLabelText('How fast')
    await userEvent.clear(pace)
    await userEvent.type(pace, '1.5')
    await userEvent.tab()
    await vi.waitFor(async () => expect((await ports.workspace.read(LINES))?.text).toContain('pace = 1.5'))
  })
})
