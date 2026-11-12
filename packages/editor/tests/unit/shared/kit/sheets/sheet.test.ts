// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import SheetFixture from '#src/testing/kit/SheetFixture.svelte'

const opener = (): HTMLElement => screen.getByRole('button', { name: 'Open' })
const sheet = (): HTMLElement => screen.getByRole('dialog', { name: 'More editors' })

async function open(): Promise<void> {
  render(SheetFixture)
  await userEvent.click(opener())
}

describe('Sheet', () => {
  test('renders nothing while closed', () => {
    render(SheetFixture)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('open, it is a modal dialog named for what it is for, and focus moves into it', async () => {
    await open()
    expect(sheet()).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
  })

  test('Tab stays inside: from the last control it goes to the first, and Shift+Tab goes back', async () => {
    await open()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus()
  })

  test('Escape closes it and focus goes back to the button that opened it', async () => {
    await open()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener()).toHaveFocus()
  })

  test('a press that starts and ends on the scrim closes it, and focus returns', async () => {
    await open()
    const scrim = sheet().parentElement as HTMLElement
    await fireEvent.pointerDown(scrim)
    await fireEvent.click(scrim)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener()).toHaveFocus()
  })

  test('a press that starts inside the sheet and ends on the scrim leaves it open', async () => {
    await open()
    const scrim = sheet().parentElement as HTMLElement
    await fireEvent.pointerDown(sheet())
    await fireEvent.click(scrim)
    expect(sheet()).toBeInTheDocument()
  })
})
