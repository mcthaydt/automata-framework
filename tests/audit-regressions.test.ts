import { fireEvent, render, waitFor } from '@testing-library/svelte'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import TerminalBox from '../src/lib/components/TerminalBox.svelte'
import Header from '../src/lib/components/Header.svelte'
import CommandMenu from '../src/lib/components/CommandMenu.svelte'
import { CHEATSHEET_MODULES } from '../src/data/cheatsheet'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => vi.restoreAllMocks())

describe('Audit regressions', () => {
  it('reports denied clipboard access without claiming success', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    const view = render(TerminalBox, { props: { command: 'example command' } })
    await fireEvent.click(view.getByRole('button', { name: /copy command/i }))
    await waitFor(() => expect(view.getByRole('status').textContent).toMatch(/couldn.t copy/i))
    expect(view.queryByText(/^Copied$/)).toBeNull()
  })

  it('exposes mobile navigation and marks the current page', () => {
    const view = render(Header, { props: { pathname: '/examples' } })
    expect(view.getByText('Menu').closest('summary')).toBeTruthy()
    expect(view.getAllByRole('link', { name: 'Examples' }).every(a => a.getAttribute('aria-current') === 'page')).toBe(true)
  })

  it('documents actual async sim creation and does not invent runtime exports', () => {
    const sim = CHEATSHEET_MODULES[0].entries.find(entry => entry.name === 'createSim')!
    expect(sim.returnType).toBe('Promise<Sim>')
    expect(CHEATSHEET_MODULES.flatMap(mod => mod.entries).some(entry => entry.name === 'runApp')).toBe(false)
  })

  it('provides labelled search across documentation and API entries', async () => {
    const view = render(CommandMenu, { props: { isOpen: true } })
    const input = view.getByRole('searchbox', { name: /search/i })
    await fireEvent.input(input, { target: { value: 'createSim' } })
    expect(view.getByRole('link', { name: /createSim/i }).getAttribute('href')).toContain('/cheatsheet#')
    await fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(document.activeElement?.tagName).toBe('A')
  })
})
