import { cleanup, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import LoadingScreen from '#src/features/loading/LoadingScreen.svelte'

// The loading screen is the game's title and core's LoaderOverlay on the ui frame; the words are the game's.

afterEach(cleanup)
const props = (over: Record<string, unknown> = {}) => ({
  title: 'Moss Garden',
  label: 'Loading',
  slowLabel: 'Still loading…',
  ...over,
})

describe('LoadingScreen', () => {
  it('shows the title and a progress bar named by the label', () => {
    render(LoadingScreen, props())
    expect(screen.getByRole('heading', { name: 'Moss Garden' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeInTheDocument()
  })

  it('is indeterminate until it knows the progress, then reports a percent', () => {
    const { rerender } = render(LoadingScreen, props())
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
    rerender(props({ progress: 0.426 }))
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '43')
  })

  it('says it is taking long only when asked to', () => {
    const { rerender } = render(LoadingScreen, props())
    expect(screen.queryByText('Still loading…')).toBeNull()
    rerender(props({ slow: true }))
    expect(screen.getByText('Still loading…')).toBeInTheDocument()
  })
})
