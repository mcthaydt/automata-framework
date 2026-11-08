// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ImportPlan } from '#src/features/suite/core/interchange.ts'
import { lineDiff } from '#src/features/suite/core/text-diff.ts'
import InterchangeDialog from '#src/features/suite/shell/InterchangeDialog.svelte'
import type { WriteOutcome } from '#src/shared/editor-list/write-path.ts'

// The `interchange` and `interchange-export` frames: export as TOML or JSON; import
// as a plan of changes, diffs, gates, checks and refusals, with Apply only on an applicable plan.
const TUNING = 'content/tuning.toml'
const CLEAN: ImportPlan = {
  changes: [
    {
      path: TUNING,
      editor: 'tuner',
      before: 'MAX_MOVE_SPEED = 356.0\n',
      after: 'MAX_MOVE_SPEED = 400.0\n',
      expected: { mtime: 1 },
      hunks: lineDiff('MAX_MOVE_SPEED = 356.0\n', 'MAX_MOVE_SPEED = 400.0\n'),
      gates: [],
      checks: ['content', 'content-check'],
    },
  ],
  refused: [],
  applicable: true,
}

type Apply = (plan: ImportPlan) => Promise<WriteOutcome | { readonly refused: 'plan' }>

function setup(
  mode: 'export' | 'import',
  plan: ImportPlan = CLEAN,
  apply = vi.fn<Apply>(async () => ({ written: true })),
) {
  const handlers = {
    onexport: vi.fn(async (format: 'toml' | 'json') =>
      format === 'toml' ? 'format = "scene-interchange"\n' : '{"format":"scene-interchange"}\n',
    ),
    onplan: vi.fn(async () => plan),
    onapply: apply,
    onclose: vi.fn(),
  }
  render(InterchangeDialog, { open: true, mode, ...handlers })
  return handlers
}

async function planned(text = 'pasted') {
  await userEvent.type(screen.getByLabelText('Paste the text to import'), text)
  await userEvent.click(screen.getByRole('button', { name: 'See changes' }))
}

describe('InterchangeDialog', () => {
  it('import: "Choose a file" is a kit button that opens the chooser, and the file fills the document', async () => {
    setup('import')
    const chooser = document.querySelector<HTMLInputElement>('input[type="file"]')
    if (chooser === null) throw new Error('no file input')
    const opened = vi.spyOn(chooser, 'click').mockImplementation(() => {})
    const button = screen.getByRole('button', { name: 'Choose a file' })
    expect(button).toHaveAttribute('data-kind', 'plain')
    await userEvent.click(button)
    expect(opened).toHaveBeenCalledOnce()
    opened.mockRestore()
    await userEvent.upload(chooser, new File(['JUMP = 4\n'], 'scene.toml', { type: 'text/plain' }))
    await vi.waitFor(() =>
      expect(screen.getByLabelText('Paste the text to import')).toHaveValue('JUMP = 4\n'),
    )
  })

  it('export: TOML by default, JSON on choice, in a read-only text to copy', async () => {
    const { onexport } = setup('export')
    const text = screen.getByLabelText('Your game as text')
    await vi.waitFor(() => expect(text).toHaveValue('format = "scene-interchange"\n'))
    expect(text).toHaveAttribute('readonly')
    await userEvent.click(screen.getByRole('radio', { name: 'JSON' }))
    await vi.waitFor(() => expect(text).toHaveValue('{"format":"scene-interchange"}\n'))
    expect(onexport).toHaveBeenLastCalledWith('json')
  })

  it('export: Copy, the one primary, puts the text on the clipboard and says so', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    setup('export')
    await vi.waitFor(() =>
      expect(screen.getByLabelText('Your game as text')).toHaveValue('format = "scene-interchange"\n'),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledWith('format = "scene-interchange"\n')
    expect(await screen.findByRole('status')).toHaveTextContent('Copied. Paste it anywhere to keep it.')
  })

  it('import: one primary at a time, See changes before a plan and Import after one', async () => {
    setup('import')
    expect(screen.getByRole('button', { name: 'See changes' })).toHaveAttribute('data-kind', 'primary')
    await planned()
    expect(screen.getByRole('button', { name: 'Import' })).toHaveAttribute('data-kind', 'primary')
    expect(screen.getByRole('button', { name: 'See changes' })).not.toHaveAttribute('data-kind', 'primary')
  })

  it('EDS-o: a clean plan names the file in words with its diff; Import writes and says Undo', async () => {
    const { onplan, onapply } = setup('import')
    await planned()
    expect(onplan).toHaveBeenCalledWith('pasted')
    // The file is named in words, never by its path; the gate and check names are not a person's words.
    expect(screen.getByText('Tuning')).toBeInTheDocument()
    expect(screen.queryByText(TUNING)).toBeNull()
    expect(screen.getByText('+ MAX_MOVE_SPEED = 400.0')).toBeInTheDocument()
    expect(screen.queryByText('No gates')).toBeNull()
    expect(screen.queryByText(/^Checks:/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(onapply).toHaveBeenCalledWith(CLEAN)
    expect(await screen.findByRole('status')).toHaveTextContent('Imported. Undo takes it back.')
  })

  it('EDS-p: an empty plan says there is nothing to change, and Apply is disabled', async () => {
    setup('import', { changes: [], refused: [], applicable: false })
    await planned()
    expect(screen.getByText('Nothing to change: the document matches the files.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
  })

  it('EDS-p2 and refusals: each refusal names its reason; a blocking one disables Apply', async () => {
    setup('import', {
      ...CLEAN,
      refused: [
        { editor: 'sequence', reason: 'not-installed', why: 'editor not installed' },
        { editor: 'tuner', path: 'package.json', reason: 'read-only', why: 'never written by an editor' },
      ],
      applicable: false,
    })
    await planned()
    expect(screen.getByText('sequence: editor not installed')).toBeInTheDocument()
    expect(screen.getByText('package.json: never written by an editor')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
  })

  it('a plan error is shown in place of the plan', async () => {
    setup('import', { error: 'scene-interchange version 1 is not supported; this suite reads version 2' })
    await planned()
    expect(screen.getByRole('alert')).toHaveTextContent('version 1 is not supported')
  })

  it('a file moved on since the plan: Import is refused and See changes again plans afresh', async () => {
    const { onplan } = setup(
      'import',
      CLEAN,
      vi.fn<Apply>(async () => ({ refused: 'moved', path: TUNING })),
    )
    await planned()
    await userEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tuning changed since you looked. See the changes again.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'See changes again' }))
    expect(onplan).toHaveBeenCalledTimes(2)
  })
})
