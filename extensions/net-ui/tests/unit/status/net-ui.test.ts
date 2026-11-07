// DOM behaviour of the connection badge and the reconnect overlay: states, focus, Back, hidden when unavailable.
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NetBadge from '#src/features/status/NetBadge.svelte'
import NetHud from '#src/features/status/NetHud.svelte'
import ReconnectOverlay from '#src/features/status/ReconnectOverlay.svelte'
import { installNetUi } from '#src/shared/host.ts'
import { fakeConnection } from '#src/testing/fake-connection.ts'

let dispose: (() => void) | undefined
beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  dispose?.()
  dispose = undefined
  vi.useRealTimers()
})
const tick = async (ms: number, c: ReturnType<typeof fakeConnection>) => {
  c.advance(ms)
  await vi.advanceTimersByTimeAsync(ms)
}

describe('NetBadge', () => {
  it('keeps a polite live region and shows nothing offline', () => {
    const c = fakeConnection('offline')
    dispose = installNetUi(c.host)
    render(NetBadge)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.queryByTestId('net-badge')).toBeNull()
  })
  it('shows connecting, then connected for two seconds, then nothing', async () => {
    const c = fakeConnection('offline')
    dispose = installNetUi(c.host)
    render(NetBadge)
    c.set('connecting')
    expect(await screen.findByTestId('net-badge')).toHaveTextContent('Connecting…')
    c.set('connected')
    expect(await screen.findByTestId('net-badge')).toHaveTextContent('Online')
    await tick(1900, c)
    expect(screen.getByTestId('net-badge')).toBeInTheDocument()
    await tick(400, c)
    expect(screen.queryByTestId('net-badge')).toBeNull()
  })
  it('shows degraded for as long as it lasts', async () => {
    const c = fakeConnection('connected')
    dispose = installNetUi(c.host)
    render(NetBadge)
    c.set('degraded')
    expect(await screen.findByTestId('net-badge')).toHaveAttribute('data-state', 'degraded')
    await tick(60_000, c)
    expect(screen.getByTestId('net-badge')).toHaveTextContent('Poor connection')
  })
  it('shows the seconds left while reconnecting, counting down', async () => {
    const c = fakeConnection('connected', 30)
    dispose = installNetUi(c.host)
    render(NetBadge)
    c.set('reconnecting')
    expect(await screen.findByTestId('net-badge')).toHaveTextContent('Reconnecting… 30 s')
    await tick(5000, c)
    expect(screen.getByTestId('net-badge')).toHaveTextContent('Reconnecting… 25 s')
  })
  it('is not interactive', async () => {
    const c = fakeConnection('connecting')
    dispose = installNetUi(c.host)
    render(NetBadge)
    expect(screen.queryAllByRole('button')).toEqual([])
  })
  it('draws nothing when no host is installed', () => {
    render(NetBadge)
    expect(screen.queryByTestId('net-badge')).toBeNull()
  })
  it('uses the words of the catalog the game gives', async () => {
    const c = fakeConnection('offline')
    dispose = installNetUi({ ...c.host, copy: { 'net.badge.degraded': 'Mala conexión' } })
    render(NetBadge)
    c.set('degraded')
    expect(await screen.findByTestId('net-badge')).toHaveTextContent('Mala conexión')
  })
})

describe('ReconnectOverlay', () => {
  it('is hidden unless reconnecting', () => {
    const c = fakeConnection('connected')
    dispose = installNetUi(c.host)
    render(ReconnectOverlay)
    expect(screen.queryByTestId('net-reconnect')).toBeNull()
  })
  it('counts down while reconnecting and offers Leave', async () => {
    const c = fakeConnection('connected', 30)
    dispose = installNetUi(c.host)
    render(ReconnectOverlay)
    c.set('reconnecting')
    expect(await screen.findByTestId('net-reconnect')).toHaveTextContent('Connection lost')
    expect(screen.getByTestId('net-reconnect')).toHaveTextContent('30 s left')
    await tick(10_000, c)
    expect(screen.getByTestId('net-reconnect')).toHaveTextContent('20 s left')
    expect(screen.getByRole('button', { name: 'Leave' })).toBeInTheDocument()
  })
  it('says it could not reconnect once the grace has passed, with Leave focused', async () => {
    const c = fakeConnection('connected', 30)
    dispose = installNetUi(c.host)
    render(ReconnectOverlay)
    c.set('reconnecting')
    await tick(31_000, c)
    expect(screen.getByTestId('net-reconnect')).toHaveTextContent('Could not reconnect')
    expect(screen.getByRole('button', { name: 'Leave' })).toHaveFocus()
  })
  it('leaves when Leave is pressed', async () => {
    const c = fakeConnection('connected')
    dispose = installNetUi(c.host)
    render(ReconnectOverlay)
    c.set('reconnecting')
    await fireEvent.click(await screen.findByRole('button', { name: 'Leave' }))
    expect(c.host.leaves).toBe(1)
  })
  it('treats Back (Escape) as Leave while it is up, and not otherwise', async () => {
    const c = fakeConnection('connected')
    dispose = installNetUi(c.host)
    render(ReconnectOverlay)
    await fireEvent.keyDown(window, { key: 'Escape' })
    expect(c.host.leaves).toBe(0)
    c.set('reconnecting')
    await screen.findByTestId('net-reconnect')
    await fireEvent.keyDown(window, { key: 'Escape' })
    expect(c.host.leaves).toBe(1)
  })
  it('goes away when the connection returns', async () => {
    const c = fakeConnection('connected')
    dispose = installNetUi(c.host)
    render(ReconnectOverlay)
    c.set('reconnecting')
    await screen.findByTestId('net-reconnect')
    c.set('connected')
    await vi.advanceTimersByTimeAsync(0)
    expect(screen.queryByTestId('net-reconnect')).toBeNull()
  })
})

describe('NetHud', () => {
  it('holds the badge and the overlay together, for the one hud.overlay slot', async () => {
    const c = fakeConnection('connected')
    dispose = installNetUi(c.host)
    render(NetHud)
    c.set('reconnecting')
    expect(await screen.findByTestId('net-badge')).toBeInTheDocument()
    expect(await screen.findByTestId('net-reconnect')).toBeInTheDocument()
  })
})
