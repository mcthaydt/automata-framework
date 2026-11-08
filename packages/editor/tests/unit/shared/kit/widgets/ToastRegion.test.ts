// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { tick } from 'svelte'
import { describe, expect, test, vi } from 'vitest'
import ToastRegion from '#src/shared/kit/widgets/ToastRegion.svelte'
import { createToasts } from '#src/shared/kit/widgets/toasts.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'

function mount() {
  const clock = createTestClock()
  const toasts = createToasts({ clock })
  render(ToastRegion, { toasts })
  return { clock, toasts }
}

describe('ToastRegion', () => {
  test('is a polite live region that exists before the first toast', () => {
    mount()
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region.children).toHaveLength(0)
  })

  test('shows each toast with its kind and message', async () => {
    const { toasts } = mount()
    toasts.push({ kind: 'error', message: 'Could not save' })
    toasts.push({ message: 'Layer added' })
    await tick()
    expect(screen.getByText('Could not save').closest('[data-kind]')).toHaveAttribute('data-kind', 'error')
    expect(screen.getByText('Layer added').closest('[data-kind]')).toHaveAttribute('data-kind', 'info')
  })

  test('a toast appearing does not move focus', async () => {
    const { toasts } = mount()
    const field = document.createElement('input')
    document.body.append(field)
    field.focus()
    toasts.push({ message: 'Saved' })
    await tick()
    expect(field).toHaveFocus()
    field.remove()
  })

  test('the dismiss button removes the toast', async () => {
    const { toasts } = mount()
    toasts.push({ message: 'Saved' })
    toasts.push({ message: 'Exported' })
    await tick()
    const [first] = screen.getAllByRole('button', { name: 'Dismiss' })
    await userEvent.click(first as HTMLElement)
    expect(screen.queryByText('Saved')).toBeNull()
    expect(screen.getByText('Exported')).toBeInTheDocument()
  })

  test('the action button runs the action and dismisses the toast', async () => {
    const { toasts } = mount()
    const run = vi.fn()
    toasts.push({ message: 'Layer deleted', action: { label: 'Undo', run } })
    await tick()
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(run).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Layer deleted')).toBeNull()
  })

  test('a toast leaves when its time is up', async () => {
    const { clock, toasts } = mount()
    toasts.push({ message: 'Saved' })
    await tick()
    clock.advance(5000)
    await tick()
    expect(screen.queryByText('Saved')).toBeNull()
  })

  test('a sticky toast stays', async () => {
    const { clock, toasts } = mount()
    toasts.push({ message: 'Offline', duration: 0 })
    await tick()
    clock.advance(60_000)
    await tick()
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })
})
