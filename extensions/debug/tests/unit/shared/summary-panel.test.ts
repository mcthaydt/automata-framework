import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DebugOverlay from '#src/features/overlay/DebugOverlay.svelte'
import { type DebugHost, HOST_CONTEXT, installDebug, PANEL_CONTEXT } from '#src/shared/host.ts'
import { debugPanels, summaryPanel } from '#src/shared/panels.ts'
import SummaryPanel from '#src/shared/SummaryPanel.svelte'

// DBG-D4: an extension hands the game a plain `summary()`; one generic panel lists it, so `debug` imports no extension.

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
const mount = (id: string, host: Partial<DebugHost>) =>
  render(SummaryPanel, {
    context: new Map<unknown, unknown>([
      [HOST_CONTEXT, { panels: [], ...host }],
      [PANEL_CONTEXT, id],
    ]),
  })

describe('summaryPanel', () => {
  it('is a debug panel with the given id and title', () => {
    const panel = summaryPanel('puzzle', 'Puzzle')
    expect(panel).toMatchObject({ id: 'puzzle', title: 'Puzzle' })
    expect(() => debugPanels(panel, summaryPanel('puzzle', 'Again'))).toThrow(/puzzle/)
  })
})

describe('SummaryPanel', () => {
  it('lists the summary of its own source and follows it', async () => {
    vi.useFakeTimers()
    let goal = false
    mount('puzzle', {
      summaries: {
        puzzle: { summary: () => ({ goal, items: 2 }) },
        narrative: { summary: () => ({ stance: 9 }) },
      },
    })
    expect(screen.getByText('items').nextElementSibling).toHaveTextContent('2')
    expect(screen.getByText('goal').nextElementSibling).toHaveTextContent('false')
    expect(screen.queryByText('stance')).toBeNull()
    goal = true
    await vi.advanceTimersByTimeAsync(300)
    expect(screen.getByText('goal').nextElementSibling).toHaveTextContent('true')
  })
  it('says so when the host has no summary for it', () => {
    mount('puzzle', { summaries: {} })
    expect(screen.getByText('This game has not turned on the puzzle summary.')).toBeInTheDocument()
  })
})

describe('summary panels in the overlay', () => {
  it('shows each panel its own summary', async () => {
    const dispose = installDebug({
      panels: debugPanels(summaryPanel('puzzle', 'Puzzle'), summaryPanel('narrative', 'Narrative')),
      summaries: {
        puzzle: { summary: () => ({ goal: true }) },
        narrative: { summary: () => ({ stance: 4 }) },
      },
    })
    render(DebugOverlay)
    await fireEvent.keyDown(window, { key: '`' })
    expect(screen.getByText('goal')).toBeInTheDocument()
    await fireEvent.click(screen.getByRole('tab', { name: 'Narrative' }))
    expect(screen.getByText('stance').nextElementSibling).toHaveTextContent('4')
    expect(screen.queryByText('goal')).toBeNull()
    dispose()
  })
})
