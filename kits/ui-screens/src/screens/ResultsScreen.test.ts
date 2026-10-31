import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ResultsScreen from './ResultsScreen.svelte'

// PRODUCT.6, UK-D3: the results screen shows rows in the order the caller gives them. It never ranks, sorts or picks a winner:
// whatever decides the order (the sim, a server) decides it, and the screen only shows it.

afterEach(cleanup)
const COPY = { rows: 'Results', empty: 'Nothing to show', more: (count: number) => `+${count} more` }
const ROWS = [
  { id: 'p2', label: 'Wren', value: '41 s', detail: 'new best' },
  { id: 'p1', label: 'Ash', value: '38 s' },
  { id: 'p3', label: 'Moss', value: '52 s' },
]
const ACTIONS = [
  { id: 'again', label: 'Play again', primary: true },
  { id: 'title', label: 'Back to title' },
]
const props = (over: Record<string, unknown> = {}) => ({
  title: 'Race over',
  rows: ROWS,
  actions: ACTIONS,
  copy: COPY,
  onAction: () => {},
  ...over,
})

describe('ResultsScreen', () => {
  it('shows the title and every row with its label, value and detail', () => {
    render(ResultsScreen, props())
    expect(screen.getByRole('heading', { name: 'Race over' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Results' })).toBeInTheDocument()
    expect(screen.getByRole('list')).toBeInTheDocument()
    const first = screen.getAllByRole('listitem')[0]
    expect(first).toHaveTextContent('Wren')
    expect(first).toHaveTextContent('41 s')
    expect(first).toHaveTextContent('new best')
  })

  it('keeps the rows in the order given (it does not rank)', () => {
    render(ResultsScreen, props())
    expect(screen.getAllByRole('listitem').map((row) => row.getAttribute('data-row-id'))).toEqual([
      'p2',
      'p1',
      'p3',
    ])
  })

  it('marks the highlighted row for assistive technology', () => {
    render(ResultsScreen, props({ highlight: 'p1' }))
    const marked = screen
      .getAllByRole('listitem')
      .filter((row) => row.getAttribute('aria-current') === 'true')
    expect(marked.map((row) => row.getAttribute('data-row-id'))).toEqual(['p1'])
  })

  it('says so when there are no rows, in the copy given', () => {
    render(ResultsScreen, props({ rows: [] }))
    expect(screen.getByText('Nothing to show')).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('focuses the primary action first, and the first action when none is primary', () => {
    render(ResultsScreen, props())
    expect(screen.getByRole('button', { name: 'Play again' })).toHaveFocus()
    cleanup()
    render(
      ResultsScreen,
      props({
        actions: [
          { id: 'title', label: 'Back to title' },
          { id: 'x', label: 'More' },
        ],
      }),
    )
    expect(screen.getByRole('button', { name: 'Back to title' })).toHaveFocus()
  })

  it('reports the action chosen', async () => {
    const onAction = vi.fn()
    render(ResultsScreen, props({ onAction }))
    await fireEvent.click(screen.getByRole('button', { name: 'Back to title' }))
    expect(onAction).toHaveBeenCalledExactlyOnceWith('title')
  })

  it('goes back on Escape when the game gives a way back, and ignores it otherwise', async () => {
    const onBack = vi.fn()
    render(ResultsScreen, props({ onBack }))
    await fireEvent.keyDown(window, { key: 'Escape' })
    expect(onBack).toHaveBeenCalledOnce()
    cleanup()
    render(ResultsScreen, props())
    await fireEvent.keyDown(window, { key: 'Escape' })
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('keeps the actions outside the region that scrolls the rows', () => {
    render(
      ResultsScreen,
      props({
        rows: Array.from({ length: 40 }, (_, i) => ({ id: `r${i}`, label: `Row ${i}`, value: String(i) })),
      }),
    )
    const region = screen.getByRole('region', { name: 'Results' })
    expect(region).toHaveAttribute('data-scroll-region')
    expect(region?.contains(screen.getByRole('button', { name: 'Play again' }))).toBe(false)
  })

  it('refuses no actions, because the player would have no way out', () => {
    expect(() => render(ResultsScreen, props({ actions: [] }))).toThrow(/at least one action/)
  })
})
