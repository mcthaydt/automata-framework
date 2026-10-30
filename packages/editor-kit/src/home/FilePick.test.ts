import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import FilePick from './FilePick.svelte'
import type { PickedFile } from './picked-file'

// The import button of a Home (moved out of editor-2d's sources panel in ED3D.5c): a label around a file input.

function mount(props: Record<string, unknown> = {}) {
  const onpick = vi.fn()
  render(FilePick, { label: 'Import files…', busy: false, onpick, ...props })
  return { onpick }
}

const input = (label = 'Import files…'): HTMLInputElement => screen.getByLabelText(label) as HTMLInputElement
const text = (bytes: Uint8Array | undefined): string => new TextDecoder().decode(bytes)

describe('FilePick', () => {
  it('is a label around a file input, with no restriction on the extension unless one is asked', () => {
    mount({ multiple: true })
    expect(input()).toHaveAttribute('type', 'file')
    expect(input()).toHaveAttribute('multiple')
    expect(input()).not.toHaveAttribute('accept')
    expect(input()).not.toHaveAttribute('webkitdirectory')
    expect(input().closest('label')).toHaveTextContent('Import files…')
  })

  it('takes one file unless told to take several, and passes an accept hint and a test id on', () => {
    mount({ label: 'Import zip…', accept: '.zip', testId: 'import-zip' })
    expect(input('Import zip…')).not.toHaveAttribute('multiple')
    expect(input('Import zip…')).toHaveAttribute('accept', '.zip')
    expect(screen.getByTestId('import-zip')).toBe(input('Import zip…').closest('label'))
  })

  it('picks a folder when asked', () => {
    mount({ label: 'Import folder…', directory: true })
    expect(input('Import folder…')).toHaveAttribute('webkitdirectory')
  })

  it('hands the files over with their names, paths and bytes, then clears the input so the same file can be chosen again', async () => {
    const { onpick } = mount({ multiple: true })
    const first = new File(['{"a":1}'], 'one.af2d.json')
    const second = new File(['b = 2'], 'two.toml')
    await userEvent.upload(input(), [first, second])
    await waitFor(() => expect(onpick).toHaveBeenCalledOnce())
    const [files] = onpick.mock.calls[0] as [PickedFile[]]
    expect(files.map((file) => [file.name, file.path])).toEqual([
      ['one.af2d.json', 'one.af2d.json'],
      ['two.toml', 'two.toml'],
    ])
    expect(text(files[0]?.bytes)).toBe('{"a":1}')
    expect(text(files[1]?.bytes)).toBe('b = 2')
    expect(input().files).toHaveLength(0)
  })

  it('gives a file of a picked folder its path from the folder down', async () => {
    const { onpick } = mount({ label: 'Import folder…', directory: true, multiple: true })
    const file = new File(['{}'], 'blockout.json')
    Object.defineProperty(file, 'webkitRelativePath', { value: 'blockout-clinic/blockout.json' })
    await userEvent.upload(input('Import folder…'), [file])
    await waitFor(() => expect(onpick).toHaveBeenCalledOnce())
    const [files] = onpick.mock.calls[0] as [PickedFile[]]
    expect(files.map((picked) => [picked.name, picked.path])).toEqual([
      ['blockout.json', 'blockout-clinic/blockout.json'],
    ])
  })

  it('a picker that closes with no file chosen hands nothing over', async () => {
    const { onpick } = mount()
    await fireEvent.change(input())
    await new Promise((resolve) => setTimeout(resolve))
    expect(onpick).not.toHaveBeenCalled()
  })

  it('while another action runs, it is disabled', () => {
    mount({ busy: true })
    expect(input()).toBeDisabled()
    expect(input().closest('label')).toHaveAttribute('aria-disabled', 'true')
  })
})
