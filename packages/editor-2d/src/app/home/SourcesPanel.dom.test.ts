import type { Workspace } from '@mcthaydt/automata-editor-kit/core'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { memoryWorkspace } from '../../testing/memory-workspace'
import { createTestClock } from '../../testing/test-clock'
import SourcesPanel from './SourcesPanel.svelte'

const stored = (): Workspace => memoryWorkspace(createTestClock())
const unstored = (): Workspace => ({
  ...stored(),
  persistent: false,
  reason: 'Private file storage is unavailable: Quota exceeded.',
})

function mount(props: { workspace?: Workspace; count?: number; busy?: boolean } = {}) {
  const onimport = vi.fn()
  render(SourcesPanel, { workspace: stored(), count: 4, busy: false, onimport, ...props })
  return { onimport }
}

const fileInput = (): HTMLInputElement => screen.getByLabelText('Import files…') as HTMLInputElement

describe('SourcesPanel', () => {
  it('names the workspace and says how many projects it holds and where it lives', () => {
    mount()
    const source = screen.getByRole('heading', { name: 'Open from' }).parentElement as HTMLElement
    expect(within(source).getByText('This workspace')).toBeInTheDocument()
    expect(within(source).getByText('4 projects · browser storage')).toBeInTheDocument()
  })

  it('says "this session only" when nothing is kept on the device', () => {
    mount({ workspace: unstored(), count: 0 })
    expect(screen.getByText('No projects · this session only')).toBeInTheDocument()
  })

  it('lists the storage notes: autosave and persistence when stored', () => {
    mount()
    const storage = screen.getByRole('region', { name: 'Storage' })
    expect(within(storage).getByText('Autosave on')).toBeInTheDocument()
    expect(within(storage).getByText('Kept in this browser’s private storage')).toBeInTheDocument()
  })

  it('warns, with the kit’s reason, when the browser keeps nothing', () => {
    mount({ workspace: unstored() })
    const storage = screen.getByRole('region', { name: 'Storage' })
    expect(within(storage).getByText('Not saved on this device')).toHaveAttribute('data-tone', 'warn')
    expect(
      within(storage).getByText('Private file storage is unavailable: Quota exceeded.'),
    ).toBeInTheDocument()
    expect(within(storage).getByText(/Export keeps your work/)).toBeInTheDocument()
  })

  it('has no folder source: that arrives with the folder store', () => {
    mount()
    expect(screen.queryByText(/folder/i)).toBeNull()
  })

  it('Import is a label around a file input that takes several files, with no restriction on the extension', () => {
    mount()
    const input = fileInput()
    expect(input).toHaveAttribute('type', 'file')
    expect(input).toHaveAttribute('multiple')
    expect(input).not.toHaveAttribute('accept')
    expect(input.closest('label')).toHaveTextContent('Import files…')
  })

  it('hands the files to its owner as names and bytes, then clears the input so the same file can be chosen again', async () => {
    const { onimport } = mount()
    const first = new File(['{"a":1}'], 'one.af2d.json')
    const second = new File(['b = 2'], 'two.toml')
    await userEvent.upload(fileInput(), [first, second])
    await waitFor(() => expect(onimport).toHaveBeenCalledOnce())
    const [files] = onimport.mock.calls[0] as [{ name: string; bytes: Uint8Array }[]]
    expect(files.map((file) => file.name)).toEqual(['one.af2d.json', 'two.toml'])
    expect(new TextDecoder().decode(files[0]?.bytes)).toBe('{"a":1}')
    expect(new TextDecoder().decode(files[1]?.bytes)).toBe('b = 2')
    expect(fileInput().files).toHaveLength(0)
  })

  it('a picker that closes with no file chosen imports nothing', async () => {
    const { onimport } = mount()
    await fireEvent.change(fileInput())
    await new Promise((resolve) => setTimeout(resolve))
    expect(onimport).not.toHaveBeenCalled()
  })

  it('draws a dot before a state of the storage, not before the explanation of it', () => {
    mount()
    const storage = screen.getByRole('region', { name: 'Storage' })
    expect(within(storage).getByText('Autosave on').querySelector('.dot')).not.toBeNull()
    expect(
      within(storage)
        .getByText(/Edits are autosaved/)
        .querySelector('.dot'),
    ).toBeNull()
  })

  it('while another action runs, Import is disabled', () => {
    mount({ busy: true })
    expect(fileInput()).toBeDisabled()
    expect(fileInput().closest('label')).toHaveAttribute('aria-disabled', 'true')
  })
})
