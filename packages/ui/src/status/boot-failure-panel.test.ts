import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import BootFailurePanel from './BootFailurePanel.svelte'
import type { BootFailure } from './boot-failure'

// The ui lane draws every BootError state from a fixture without a renderer (shared contracts §4).
const FIXTURES: readonly BootFailure[] = [
  { _tag: 'HostError', code: 'TIMEOUT', retryable: true, operation: 'init' },
  { _tag: 'HostError', code: 'TIMEOUT', retryable: true, operation: 'saves.get' },
  { _tag: 'HostError', code: 'TIMEOUT', retryable: true, operation: 'ready' },
  { _tag: 'ContentHashMismatch', expected: 'a', actual: 'b' },
  { _tag: 'AssetLoadFailed', url: '/a.png', status: 404 },
  { _tag: 'LoadStalled', url: '/a.png', bytesSoFar: 10, stalledMs: 30_000 },
  { _tag: 'RendererUnavailable', tried: ['webgl2'] },
  { _tag: 'BootDefect' },
]

function open(failure: BootFailure, hostKind: 'ruken' | 'standalone' = 'ruken') {
  const handlers = { onRetry: vi.fn(), onContinue: vi.fn(), onExit: vi.fn() }
  render(BootFailurePanel, { failure, hostKind, ...handlers })
  return handlers
}

describe('BootFailurePanel', () => {
  it.each(FIXTURES)('draws %j as an alert with its state and copy', (failure) => {
    open(failure)
    const alert = screen.getByRole('alert')
    expect(alert.dataset.code).toMatch(
      /^(start|connect|progress|damaged|download|download-stalled|unsupported)$/,
    )
    expect(alert.textContent?.trim().length).toBeGreaterThan(0)
  })

  it('Try again calls onRetry', async () => {
    const { onRetry } = open({ _tag: 'AssetLoadFailed', url: '/a.png', status: 500 })
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't download the game.")
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('Continue without loading calls onContinue (standalone, saves not retryable)', async () => {
    const { onContinue } = open(
      { _tag: 'HostError', code: 'QUOTA_EXCEEDED', retryable: false, operation: 'saves.set' },
      'standalone',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Continue without loading' }))
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('Back to Ruken calls onExit', async () => {
    const { onExit } = open({ _tag: 'RendererUnavailable', tried: ['webgl2'] })
    expect(screen.getByRole('alert')).toHaveTextContent("This device can't run the game.")
    await userEvent.click(screen.getByRole('button', { name: 'Back to Ruken' }))
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('a standalone device that cannot run the game shows a final panel with no buttons', () => {
    open({ _tag: 'RendererUnavailable', tried: ['webgl2'] }, 'standalone')
    expect(screen.getByRole('alert')).toHaveAttribute('data-code', 'unsupported')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('a host that cannot start for a build or config fault shows a final panel with no buttons', () => {
    open({ _tag: 'HostError', code: 'INVALID_PAYLOAD', retryable: false, operation: 'init' })
    expect(screen.getByRole('alert')).toHaveAttribute('data-code', 'start')
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't start the game.")
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it("takes the game's own copy", () => {
    render(BootFailurePanel, {
      failure: { _tag: 'AssetLoadFailed', url: '/a.png', status: 500 },
      hostKind: 'ruken',
      copy: { download: 'No se pudo descargar el juego.', retry: 'Reintentar' },
      onRetry: vi.fn(),
      onExit: vi.fn(),
    })
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo descargar el juego.')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
