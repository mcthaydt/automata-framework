import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import LoaderOverlay from '#src/status/LoaderOverlay.svelte'

describe('LoaderOverlay', () => {
  it('says what is loading, with its progress as a percentage', () => {
    render(LoaderOverlay, { label: 'Loading the level', progress: 0.42, slowLabel: 'Still loading' })
    expect(screen.getByText('Loading the level')).toBeInTheDocument()
    const bar = screen.getByRole('progressbar', { name: 'Loading the level' })
    expect(bar).toHaveAttribute('aria-valuenow', '42')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('has no value while progress is unknown (indeterminate)', () => {
    render(LoaderOverlay, { label: 'Loading', slowLabel: 'Still loading' })
    expect(screen.getByRole('progressbar', { name: 'Loading' })).not.toHaveAttribute('aria-valuenow')
  })

  it('clamps progress to 0..100', () => {
    render(LoaderOverlay, { label: 'Loading', progress: 1.7, slowLabel: 'Still loading' })
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })

  it('says it is slow in a polite live line that is always there', () => {
    const { rerender } = render(LoaderOverlay, { label: 'Loading', slowLabel: 'Still loading' })
    const line = screen.getByTestId('loader-slow')
    expect(line).toHaveAttribute('aria-live', 'polite')
    expect(line).toBeEmptyDOMElement()
    rerender({ label: 'Loading', slowLabel: 'Still loading', slow: true })
    expect(line).toHaveTextContent('Still loading')
  })
})
