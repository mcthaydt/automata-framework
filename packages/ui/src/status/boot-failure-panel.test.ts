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
  { _tag: 'ModelInvalid', file: 'models/crate.glb', reason: 'skinned' },
]

interface Host {
  readonly hostKind: 'ruken' | 'standalone' | 'tauri'
  readonly hostName: string
  readonly canExit: boolean
}
const RUKEN: Host = { hostKind: 'ruken', hostName: 'Ruken', canExit: true }
const STANDALONE: Host = { hostKind: 'standalone', hostName: 'this page', canExit: false }

function open(failure: BootFailure, host: Host = RUKEN) {
  const handlers = { onRetry: vi.fn(), onContinue: vi.fn(), onExit: vi.fn() }
  render(BootFailurePanel, { failure, ...host, ...handlers })
  return handlers
}

describe('BootFailurePanel', () => {
  it.each(FIXTURES)('draws %j as an alert with its state and copy', (failure) => {
    open(failure)
    const alert = screen.getByRole('alert')
    expect(alert.dataset.code).toMatch(
      /^(start|connect|progress|damaged|download|download-stalled|unsupported|model-invalid)$/,
    )
    expect(alert.textContent?.trim().length).toBeGreaterThan(0)
  })

  it('Try again calls onRetry', async () => {
    const { onRetry } = open({ _tag: 'AssetLoadFailed', url: '/a.png', status: 500 })
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't download the game.")
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('names the damaged model and offers Try again (M3 spec §6, D3-f)', async () => {
    const { onRetry } = open({ _tag: 'ModelInvalid', file: 'models/crate.glb', reason: 'skinned' })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'A 3D model in this copy of the game is damaged: crate.glb.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("names the model by its file's basename, not the url it was fetched from (review of #241)", () => {
    open({
      _tag: 'ModelInvalid',
      file: 'http://localhost:5932/assets/nightstand-DkFIQVVx.glb?v=2#x',
      reason: 'skinned',
    })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(
      'A 3D model in this copy of the game is damaged: nightstand-DkFIQVVx.glb.',
    )
    expect(alert).not.toHaveTextContent('localhost')
  })

  it('Continue without loading calls onContinue (standalone, saves not retryable)', async () => {
    const { onContinue } = open(
      { _tag: 'HostError', code: 'QUOTA_EXCEEDED', retryable: false, operation: 'saves.set' },
      STANDALONE,
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

  it('names the host from hostName: Back to itch.io calls onExit', async () => {
    const { onExit } = open(
      { _tag: 'RendererUnavailable', tried: ['webgl2'] },
      { ...RUKEN, hostName: 'itch.io' },
    )
    await userEvent.click(screen.getByRole('button', { name: 'Back to itch.io' }))
    expect(onExit).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: /Ruken|\{host\}/ })).not.toBeInTheDocument()
  })

  it('on the desktop, the exit action reads Quit and calls onExit (DIST spec §8 flow 2)', async () => {
    const { onExit } = open(
      { _tag: 'RendererUnavailable', tried: ['webgl2'] },
      { hostKind: 'tauri', hostName: 'Cinder', canExit: true },
    )
    await userEvent.click(screen.getByRole('button', { name: 'Quit' }))
    expect(onExit).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: /^Back to/ })).not.toBeInTheDocument()
  })

  it('on the desktop, a saves failure that will not clear offers Continue without loading, not Quit', () => {
    open(
      { _tag: 'HostError', code: 'DENIED', retryable: false, operation: 'saves.get' },
      { hostKind: 'tauri', hostName: 'Cinder', canExit: true },
    )
    expect(screen.getByRole('button', { name: 'Continue without loading' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Quit' })).not.toBeInTheDocument()
  })

  it('hides Back to … when the host does not grant exit, leaving a final panel', () => {
    open({ _tag: 'RendererUnavailable', tried: ['webgl2'] }, { ...RUKEN, canExit: false })
    expect(screen.getByRole('alert')).toHaveAttribute('data-code', 'unsupported')
    expect(screen.queryByRole('button', { name: /^Back to/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('without exit, a non-retryable saves failure under Ruken never offers Continue or Back to …', () => {
    open(
      { _tag: 'HostError', code: 'QUOTA_EXCEEDED', retryable: false, operation: 'saves.set' },
      { ...RUKEN, canExit: false },
    )
    expect(screen.getByRole('alert')).toHaveAttribute('data-code', 'progress')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('keeps Try again when exit is not granted', async () => {
    const { onRetry } = open({ _tag: 'AssetLoadFailed', url: '/a.png', status: 500 }, STANDALONE)
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: /^Back to/ })).not.toBeInTheDocument()
  })

  it("fills {host} in the game's own exit copy", () => {
    render(BootFailurePanel, {
      failure: { _tag: 'RendererUnavailable', tried: ['webgl2'] },
      ...RUKEN,
      hostName: 'itch.io',
      copy: { exit: 'Volver a {host}' },
      onRetry: vi.fn(),
      onExit: vi.fn(),
    })
    expect(screen.getByRole('button', { name: 'Volver a itch.io' })).toBeInTheDocument()
  })

  it('a standalone device that cannot run the game shows a final panel with no buttons', () => {
    open({ _tag: 'RendererUnavailable', tried: ['webgl2'] }, STANDALONE)
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
      ...RUKEN,
      copy: { download: 'No se pudo descargar el juego.', retry: 'Reintentar' },
      onRetry: vi.fn(),
      onExit: vi.fn(),
    })
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo descargar el juego.')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
